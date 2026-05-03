import { Router } from "express";
import {
  db,
  users,
  skillCategories,
  timeListings,
  bids,
  escrowRecords,
  priceSnapshots,
  deliveryLogs,
  deliveryConfirmations,
  notifications,
  disputes,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import {
  eq,
  and,
  gte,
  sum,
  desc,
  sql,
  inArray,
  isNull,
  or,
} from "drizzle-orm";
import { LogDeliveryBody, OpenDisputeBody, MarkNotificationsReadBody } from "@workspace/api-zod";

const router = Router();

// ---------------------------------------------------------------------------
// Notification helpers
// ---------------------------------------------------------------------------

export async function createNotification(
  userId: number,
  type: typeof notifications.$inferInsert["type"],
  payload: Record<string, unknown>,
) {
  await db.insert(notifications).values({ userId, type, payload });
}

// ---------------------------------------------------------------------------
// Commitment helpers
// ---------------------------------------------------------------------------

async function hoursDelivered(listingId: number): Promise<number> {
  const [row] = await db
    .select({ total: sum(deliveryLogs.hoursLogged) })
    .from(deliveryLogs)
    .where(eq(deliveryLogs.listingId, listingId));
  return Number(row?.total ?? 0);
}

function totalContractHours(listing: { hoursPerWeek: number; startDate: string; endDate: string }): number {
  const start = new Date(listing.startDate);
  const end = new Date(listing.endDate);
  const weeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  return listing.hoursPerWeek * weeks;
}

async function buildDeliveryLogs(listingId: number) {
  const rows = await db
    .select()
    .from(deliveryLogs)
    .leftJoin(deliveryConfirmations, eq(deliveryConfirmations.deliveryLogId, deliveryLogs.id))
    .where(eq(deliveryLogs.listingId, listingId))
    .orderBy(desc(deliveryLogs.loggedAt));

  return rows.map(({ delivery_logs: dl, delivery_confirmations: dc }) => ({
    id: dl.id,
    listingId: dl.listingId,
    professionalId: dl.professionalId,
    hoursLogged: dl.hoursLogged,
    note: dl.note ?? null,
    loggedAt: dl.loggedAt.toISOString(),
    confirmedAt: dc?.confirmedAt?.toISOString() ?? null,
    disputed: dc?.disputed ?? false,
  }));
}

async function buildDispute(listingId: number) {
  const [d] = await db
    .select()
    .from(disputes)
    .where(eq(disputes.listingId, listingId))
    .orderBy(desc(disputes.createdAt))
    .limit(1);
  if (!d) return null;
  return {
    id: d.id,
    listingId: d.listingId,
    initiatorId: d.initiatorId,
    reason: d.reason,
    status: d.status,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// GET /dashboard/professional/commitments
// ---------------------------------------------------------------------------

router.get("/dashboard/professional/commitments", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  try {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const listings = await db
      .select()
      .from(timeListings)
      .innerJoin(skillCategories, eq(skillCategories.id, timeListings.skillCategoryId))
      .where(
        and(
          eq(timeListings.professionalId, user.id),
          inArray(timeListings.status, ["committed", "in_dispute", "completed"]),
        ),
      )
      .orderBy(desc(timeListings.updatedAt));

    const now = new Date();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    const result = await Promise.all(
      listings.map(async ({ time_listings: l, skill_categories: cat }) => {
        const [buyer] = l.buyerId
          ? await db.select().from(users).where(eq(users.id, l.buyerId)).limit(1)
          : [undefined];
        const logs = await buildDeliveryLogs(l.id);
        const delivered = logs.reduce((s, log) => s + log.hoursLogged, 0);
        const total = totalContractHours({ hoursPerWeek: l.hoursPerWeek, startDate: l.startDate, endDate: l.endDate });
        const [escrow] = await db.select().from(escrowRecords).where(eq(escrowRecords.listingId, l.id)).limit(1);
        const dispute = await buildDispute(l.id);

        if (l.status === "committed") {
          const endMs = new Date(l.endDate).getTime();
          if (endMs - now.getTime() <= sevenDays && endMs > now.getTime()) {
            const existing = await db
              .select()
              .from(notifications)
              .where(
                and(
                  eq(notifications.userId, user.id),
                  eq(notifications.type, "contract_expiring"),
                  sql`${notifications.payload}->>'listingId' = ${String(l.id)}`,
                ),
              )
              .limit(1);
            if (existing.length === 0) {
              await createNotification(user.id, "contract_expiring", {
                listingId: l.id,
                listingTitle: l.title,
                endDate: l.endDate,
              });
            }
          }
        }

        return {
          id: l.id,
          title: l.title,
          skillCategoryId: l.skillCategoryId,
          skillCategoryName: cat.name,
          buyerDisplayName: buyer?.displayName ?? "Unknown",
          hoursPerWeek: l.hoursPerWeek,
          startDate: l.startDate,
          endDate: l.endDate,
          rateCents: l.rateCents,
          status: l.status,
          hoursDelivered: delivered,
          hoursRemaining: Math.max(0, total - delivered),
          totalHours: total,
          deliveryLogs: logs,
          dispute,
          escrowStatus: escrow?.status ?? null,
        };
      }),
    );

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "getProfessionalCommitments error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /dashboard/professional/cash-flow
// ---------------------------------------------------------------------------

router.get("/dashboard/professional/cash-flow", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  try {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const active = await db
      .select()
      .from(timeListings)
      .where(and(eq(timeListings.professionalId, user.id), eq(timeListings.status, "committed")));

    const weeks: Map<string, { projectedCents: number; contracts: number }> = new Map();

    for (const l of active) {
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      let cursor = new Date(start);
      cursor.setDate(cursor.getDate() - cursor.getDay());
      while (cursor <= end) {
        const key = cursor.toISOString().split("T")[0];
        const weekStart = new Date(cursor);
        const weekEnd = new Date(cursor);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const overlap =
          new Date(Math.max(start.getTime(), weekStart.getTime())) <=
          new Date(Math.min(end.getTime(), weekEnd.getTime()));
        if (overlap) {
          const existing = weeks.get(key) ?? { projectedCents: 0, contracts: 0 };
          weeks.set(key, {
            projectedCents: existing.projectedCents + l.rateCents * l.hoursPerWeek,
            contracts: existing.contracts + 1,
          });
        }
        cursor.setDate(cursor.getDate() + 7);
      }
    }

    const result = Array.from(weeks.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, { projectedCents, contracts }]) => ({ weekStart, projectedCents, contracts }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "getProfessionalCashFlow error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /dashboard/professional/earnings
// ---------------------------------------------------------------------------

router.get("/dashboard/professional/earnings", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  try {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const completed = await db
      .select()
      .from(timeListings)
      .innerJoin(skillCategories, eq(skillCategories.id, timeListings.skillCategoryId))
      .where(and(eq(timeListings.professionalId, user.id), eq(timeListings.status, "completed")))
      .orderBy(desc(timeListings.updatedAt));

    const result = await Promise.all(
      completed.map(async ({ time_listings: l, skill_categories: cat }) => {
        const [buyer] = l.buyerId
          ? await db.select().from(users).where(eq(users.id, l.buyerId)).limit(1)
          : [undefined];
        const [dlSum] = await db
          .select({ total: sum(deliveryLogs.hoursLogged) })
          .from(deliveryLogs)
          .where(eq(deliveryLogs.listingId, l.id));
        const delivered = Number(dlSum?.total ?? 0);
        return {
          id: l.id,
          title: l.title,
          skillCategoryName: cat.name,
          buyerDisplayName: buyer?.displayName ?? "Unknown",
          rateCents: l.rateCents,
          hoursDelivered: delivered,
          totalEarnedCents: delivered * l.rateCents,
          completedAt: l.updatedAt.toISOString(),
        };
      }),
    );

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "getProfessionalEarnings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /dashboard/professional/rate-health
// ---------------------------------------------------------------------------

router.get("/dashboard/professional/rate-health", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  try {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const myListings = await db
      .select()
      .from(timeListings)
      .innerJoin(skillCategories, eq(skillCategories.id, timeListings.skillCategoryId))
      .where(and(eq(timeListings.professionalId, user.id), inArray(timeListings.status, ["open", "in_bidding", "committed"])));

    const uniqueCats = [...new Map(myListings.map(({ skill_categories: c }) => [c.id, c])).entries()].map(([, c]) => c);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const vwapRows = uniqueCats.length > 0
      ? await db
          .select({
            skillCategoryId: priceSnapshots.skillCategoryId,
            vwapCents: sql<number>`
              cast(
                sum(cast(${priceSnapshots.vwapCents} as bigint) * cast(${priceSnapshots.volumeHours} as bigint))::float
                / nullif(sum(${priceSnapshots.volumeHours}), 0)
              as int)`,
          })
          .from(priceSnapshots)
          .where(
            and(
              inArray(priceSnapshots.skillCategoryId, uniqueCats.map((c) => c.id)),
              gte(priceSnapshots.snapshotAt, thirtyDaysAgo),
            ),
          )
          .groupBy(priceSnapshots.skillCategoryId)
      : [];
    const vwapMap = Object.fromEntries(vwapRows.map((r) => [r.skillCategoryId, r.vwapCents != null ? Number(r.vwapCents) : null]));

    const rateMap = new Map<number, number>();
    for (const { time_listings: l } of myListings) {
      const existing = rateMap.get(l.skillCategoryId);
      if (existing == null || l.rateCents > existing) {
        rateMap.set(l.skillCategoryId, l.rateCents);
      }
    }

    const result = uniqueCats.map((cat) => {
      const myRate = rateMap.get(cat.id) ?? 0;
      const vwap = vwapMap[cat.id] ?? null;
      let recommendation: "raise" | "lower" | "hold" | "no_data" = "no_data";
      let deltaPercent: number | null = null;
      if (vwap != null) {
        deltaPercent = ((myRate - vwap) / vwap) * 100;
        if (deltaPercent < -10) recommendation = "raise";
        else if (deltaPercent > 10) recommendation = "lower";
        else recommendation = "hold";
      }
      return { skillCategoryId: cat.id, skillCategoryName: cat.name, myRateCents: myRate, marketVwapCents: vwap, recommendation, deltaPercent };
    });

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "getProfessionalRateHealth error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /dashboard/buyer/commitments
// ---------------------------------------------------------------------------

router.get("/dashboard/buyer/commitments", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  try {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const listings = await db
      .select()
      .from(timeListings)
      .innerJoin(skillCategories, eq(skillCategories.id, timeListings.skillCategoryId))
      .where(
        and(
          eq(timeListings.buyerId, user.id),
          inArray(timeListings.status, ["committed", "in_dispute", "completed"]),
        ),
      )
      .orderBy(desc(timeListings.updatedAt));

    const now = new Date();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    const result = await Promise.all(
      listings.map(async ({ time_listings: l, skill_categories: cat }) => {
        const [professional] = await db.select().from(users).where(eq(users.id, l.professionalId)).limit(1);
        const logs = await buildDeliveryLogs(l.id);
        const delivered = logs.reduce((s, log) => s + log.hoursLogged, 0);
        const total = totalContractHours({ hoursPerWeek: l.hoursPerWeek, startDate: l.startDate, endDate: l.endDate });
        const [escrow] = await db.select().from(escrowRecords).where(eq(escrowRecords.listingId, l.id)).limit(1);
        const dispute = await buildDispute(l.id);

        if (l.status === "committed") {
          const endMs = new Date(l.endDate).getTime();
          if (endMs - now.getTime() <= sevenDays && endMs > now.getTime()) {
            const existing = await db
              .select()
              .from(notifications)
              .where(
                and(
                  eq(notifications.userId, user.id),
                  eq(notifications.type, "contract_expiring"),
                  sql`${notifications.payload}->>'listingId' = ${String(l.id)}`,
                ),
              )
              .limit(1);
            if (existing.length === 0) {
              await createNotification(user.id, "contract_expiring", {
                listingId: l.id,
                listingTitle: l.title,
                endDate: l.endDate,
              });
            }
          }
        }

        return {
          id: l.id,
          title: l.title,
          skillCategoryId: l.skillCategoryId,
          skillCategoryName: cat.name,
          professionalDisplayName: professional?.displayName ?? "Unknown",
          hoursPerWeek: l.hoursPerWeek,
          startDate: l.startDate,
          endDate: l.endDate,
          rateCents: l.rateCents,
          status: l.status,
          hoursDelivered: delivered,
          hoursRemaining: Math.max(0, total - delivered),
          totalHours: total,
          deliveryLogs: logs,
          dispute,
          escrowStatus: escrow?.status ?? null,
        };
      }),
    );

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "getBuyerCommitments error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /listings/:listingId/deliveries — log delivered hours (professional only)
// ---------------------------------------------------------------------------

router.post("/listings/:listingId/deliveries", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const listingId = Number(String(req.params.listingId));
  if (!listingId) { res.status(400).json({ error: "Invalid listing id" }); return; }

  const parsed = LogDeliveryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  try {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [listing] = await db.select().from(timeListings).where(eq(timeListings.id, listingId)).limit(1);
    if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }
    if (listing.professionalId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
    if (listing.status !== "committed") { res.status(400).json({ error: "Contract is not in committed state" }); return; }

    const [log] = await db
      .insert(deliveryLogs)
      .values({ listingId, professionalId: user.id, hoursLogged: parsed.data.hoursLogged, note: parsed.data.note ?? null })
      .returning();

    if (listing.buyerId) {
      await createNotification(listing.buyerId, "delivery_logged", {
        listingId,
        listingTitle: listing.title,
        hoursLogged: parsed.data.hoursLogged,
        deliveryLogId: log.id,
      });
    }

    res.status(201).json({
      id: log.id,
      listingId: log.listingId,
      professionalId: log.professionalId,
      hoursLogged: log.hoursLogged,
      note: log.note ?? null,
      loggedAt: log.loggedAt.toISOString(),
      confirmedAt: null,
      disputed: false,
    });
  } catch (err) {
    req.log.error({ err }, "logDelivery error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /listings/:listingId/deliveries/:deliveryId/confirm — buyer confirms
// ---------------------------------------------------------------------------

router.post("/listings/:listingId/deliveries/:deliveryId/confirm", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const listingId = Number(String(req.params.listingId));
  const deliveryId = Number(String(req.params.deliveryId));
  if (!listingId || !deliveryId) { res.status(400).json({ error: "Invalid ids" }); return; }

  try {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [listing] = await db.select().from(timeListings).where(eq(timeListings.id, listingId)).limit(1);
    if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }
    if (listing.buyerId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }

    const [log] = await db.select().from(deliveryLogs).where(and(eq(deliveryLogs.id, deliveryId), eq(deliveryLogs.listingId, listingId))).limit(1);
    if (!log) { res.status(404).json({ error: "Delivery log not found" }); return; }

    const existing = await db.select().from(deliveryConfirmations).where(eq(deliveryConfirmations.deliveryLogId, deliveryId)).limit(1);
    if (existing.length > 0) { res.status(400).json({ error: "Already confirmed" }); return; }

    const [conf] = await db
      .insert(deliveryConfirmations)
      .values({ deliveryLogId: deliveryId, buyerId: user.id })
      .returning();

    await createNotification(listing.professionalId, "delivery_confirmed", {
      listingId,
      listingTitle: listing.title,
      hoursLogged: log.hoursLogged,
      deliveryLogId: deliveryId,
    });

    const confirmedRows = await db
      .select({ hoursLogged: deliveryLogs.hoursLogged })
      .from(deliveryConfirmations)
      .innerJoin(deliveryLogs, eq(deliveryLogs.id, deliveryConfirmations.deliveryLogId))
      .where(eq(deliveryLogs.listingId, listingId));
    const totalConfirmed = confirmedRows.reduce((s, r) => s + r.hoursLogged, 0);
    const contractHours = totalContractHours({
      hoursPerWeek: listing.hoursPerWeek,
      startDate: listing.startDate,
      endDate: listing.endDate,
    });

    if (listing.status === "committed" && totalConfirmed >= contractHours) {
      await db.update(timeListings).set({ status: "completed", updatedAt: new Date() }).where(eq(timeListings.id, listingId));
      await createNotification(listing.professionalId, "payment_released", {
        listingId,
        listingTitle: listing.title,
        totalDelivered: totalConfirmed,
        totalEarnedCents: totalConfirmed * listing.rateCents,
      });
      await createNotification(user.id, "payment_released", {
        listingId,
        listingTitle: listing.title,
        totalDelivered: totalConfirmed,
        totalEarnedCents: totalConfirmed * listing.rateCents,
      });
    }

    res.json({
      id: log.id,
      listingId: log.listingId,
      professionalId: log.professionalId,
      hoursLogged: log.hoursLogged,
      note: log.note ?? null,
      loggedAt: log.loggedAt.toISOString(),
      confirmedAt: conf.confirmedAt.toISOString(),
      disputed: false,
    });
  } catch (err) {
    req.log.error({ err }, "confirmDelivery error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /listings/:listingId/dispute — open a dispute
// ---------------------------------------------------------------------------

router.post("/listings/:listingId/dispute", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const listingId = Number(String(req.params.listingId));
  if (!listingId) { res.status(400).json({ error: "Invalid listing id" }); return; }

  const parsed = OpenDisputeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  try {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [listing] = await db.select().from(timeListings).where(eq(timeListings.id, listingId)).limit(1);
    if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }
    if (listing.professionalId !== user.id && listing.buyerId !== user.id) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
    if (listing.status !== "committed") {
      res.status(400).json({ error: "Disputes can only be opened on committed contracts" }); return;
    }

    const existing = await db.select().from(disputes).where(and(eq(disputes.listingId, listingId), inArray(disputes.status, ["open", "under_review"]))).limit(1);
    if (existing.length > 0) { res.status(400).json({ error: "An open dispute already exists for this contract" }); return; }

    const [dispute] = await db
      .insert(disputes)
      .values({ listingId, initiatorId: user.id, reason: parsed.data.reason })
      .returning();

    await db.update(timeListings).set({ status: "in_dispute", updatedAt: new Date() }).where(eq(timeListings.id, listingId));

    const otherPartyId = listing.professionalId === user.id ? listing.buyerId : listing.professionalId;
    if (otherPartyId) {
      await createNotification(otherPartyId, "dispute_opened", {
        listingId,
        listingTitle: listing.title,
        disputeId: dispute.id,
        reason: parsed.data.reason,
      });
    }

    res.status(201).json({
      id: dispute.id,
      listingId: dispute.listingId,
      initiatorId: dispute.initiatorId,
      reason: dispute.reason,
      status: dispute.status,
      createdAt: dispute.createdAt.toISOString(),
      updatedAt: dispute.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "openDispute error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /notifications
// ---------------------------------------------------------------------------

router.get("/notifications", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  try {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [items, countRow] = await Promise.all([
      db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(50),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)))
        .then((r) => r[0]),
    ]);

    const unreadCount = countRow?.count ?? 0;

    res.json({
      items: items.map((n) => ({
        id: n.id,
        userId: n.userId,
        type: n.type,
        payload: n.payload,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    });
  } catch (err) {
    req.log.error({ err }, "getNotifications error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /notifications/read — mark notifications as read
// ---------------------------------------------------------------------------

router.post("/notifications/read", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const parsed = MarkNotificationsReadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  try {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const ids = parsed.data.ids;
    if (ids && ids.length > 0) {
      await db
        .update(notifications)
        .set({ read: true })
        .where(and(eq(notifications.userId, user.id), inArray(notifications.id, ids)));
    } else {
      await db.update(notifications).set({ read: true }).where(eq(notifications.userId, user.id));
    }

    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "markNotificationsRead error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
