import { Router } from "express";
import { db, users, professionalProfiles, skillCategories, timeListings, bids, escrowRecords, priceSnapshots } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { eq, and, gte, lte, count, desc, SQL, inArray, sql } from "drizzle-orm";
import { createNotification } from "./dashboard";
import {
  CreateListingBody,
  UpdateListingBody,
  PlaceBidBody,
  ListListingsQueryParams,
} from "@workspace/api-zod";

function toDateStr(d: Date | string | undefined): string | undefined {
  if (!d) return undefined;
  if (typeof d === "string") return d;
  return d.toISOString().split("T")[0];
}

const router = Router();

async function buildListingDetail(listingId: number) {
  const [listing] = await db.select().from(timeListings).where(eq(timeListings.id, listingId)).limit(1);
  if (!listing) return null;

  const [professional] = await db.select().from(users).where(eq(users.id, listing.professionalId)).limit(1);
  const [profProfile] = await db.select().from(professionalProfiles).where(eq(professionalProfiles.userId, listing.professionalId)).limit(1);
  const [skillCat] = await db.select().from(skillCategories).where(eq(skillCategories.id, listing.skillCategoryId)).limit(1);

  let parentName: string | null = null;
  if (skillCat?.parentId) {
    const [parent] = await db.select().from(skillCategories).where(eq(skillCategories.id, skillCat.parentId)).limit(1);
    parentName = parent?.name ?? null;
  }

  const listingBids = await db
    .select()
    .from(bids)
    .innerJoin(users, eq(bids.bidderId, users.id))
    .where(eq(bids.listingId, listingId))
    .orderBy(desc(bids.placedAt));

  const [escrow] = await db.select().from(escrowRecords).where(eq(escrowRecords.listingId, listingId)).limit(1);

  // Fetch market rate (VWAP) from price_snapshots for this skill category
  let marketRateCents: number | null = null;
  const [vwap] = await db
    .select({
      vwapCents: sql<number>`
        sum(cast(${priceSnapshots.vwapCents} as bigint) * cast(${priceSnapshots.volumeHours} as bigint))::float
        / nullif(sum(cast(${priceSnapshots.volumeHours} as bigint)), 0)
      `,
    })
    .from(priceSnapshots)
    .where(
      and(
        eq(priceSnapshots.skillCategoryId, listing.skillCategoryId),
        gte(priceSnapshots.snapshotAt, sql`now() - interval '30 days'`),
      ),
    );
  if (vwap?.vwapCents != null) {
    marketRateCents = Math.round(Number(vwap.vwapCents));
  }

  return {
    id: listing.id,
    title: listing.title,
    description: listing.description ?? null,
    skillCategoryId: listing.skillCategoryId,
    skillCategoryName: skillCat?.name ?? "",
    skillCategoryParentName: parentName,
    hoursPerWeek: listing.hoursPerWeek,
    startDate: listing.startDate,
    endDate: listing.endDate,
    listingType: listing.listingType,
    rateCents: listing.rateCents,
    marketRateCents,
    status: listing.status,
    professionalId: listing.professionalId,
    professionalClerkId: professional?.clerkId ?? "",
    professionalDisplayName: professional?.displayName ?? "",
    professionalExperienceLevel: profProfile?.experienceLevel ?? "mid",
    professionalTimezone: profProfile?.timezone ?? null,
    professionalBio: profProfile?.bio ?? null,
    bids: listingBids.map(({ bids: b, users: u }) => ({
      id: b.id,
      listingId: b.listingId,
      bidderId: b.bidderId,
      bidderDisplayName: u.displayName,
      bidderClerkId: u.clerkId,
      bidRateCents: b.bidRateCents,
      message: b.message ?? null,
      status: b.status,
      placedAt: b.placedAt.toISOString(),
    })),
    escrow: escrow
      ? {
          id: escrow.id,
          listingId: escrow.listingId,
          buyerId: escrow.buyerId,
          professionalId: escrow.professionalId,
          amountCents: escrow.amountCents,
          status: escrow.status,
          createdAt: escrow.createdAt.toISOString(),
        }
      : null,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

// GET /listings — browse with filters
router.get("/listings", async (req, res) => {
  try {
    const params = ListListingsQueryParams.safeParse(req.query);
    if (!params.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }
    const {
      skillCategoryId,
      listingType,
      status: statusFilter,
      minRateCents,
      maxRateCents,
      startDateAfter,
      experienceLevel,
      timezone,
      professionalId,
      limit = 20,
      offset = 0,
    } = params.data;

    // All filters pushed into SQL so that pagination totals are always accurate
    const filters: SQL[] = [eq(timeListings.status, statusFilter ?? "open")];
    if (skillCategoryId) {
      // If the caller passes a parent category ID, expand to all its children so that
      // the UI category chips (which show parent-level labels) correctly match rows
      // that were stored with child-level category IDs.
      const children = await db
        .select({ id: skillCategories.id })
        .from(skillCategories)
        .where(eq(skillCategories.parentId, skillCategoryId));
      if (children.length > 0) {
        filters.push(inArray(timeListings.skillCategoryId, children.map((c) => c.id)));
      } else {
        filters.push(eq(timeListings.skillCategoryId, skillCategoryId));
      }
    }
    if (listingType) filters.push(eq(timeListings.listingType, listingType));
    if (minRateCents) filters.push(gte(timeListings.rateCents, minRateCents));
    if (maxRateCents) filters.push(lte(timeListings.rateCents, maxRateCents));
    if (startDateAfter) filters.push(gte(timeListings.startDate, toDateStr(startDateAfter)!));
    if (professionalId) filters.push(eq(timeListings.professionalId, professionalId));
    // experienceLevel and timezone filter via joined professionalProfiles table
    if (experienceLevel) filters.push(eq(professionalProfiles.experienceLevel, experienceLevel));
    if (timezone) filters.push(eq(professionalProfiles.timezone, timezone));

    const where = and(...filters);

    // Count and data queries both use the same JOIN so totals match paginated rows
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(timeListings)
      .innerJoin(users, eq(timeListings.professionalId, users.id))
      .leftJoin(professionalProfiles, eq(timeListings.professionalId, professionalProfiles.userId))
      .where(where);

    const rows = await db
      .select()
      .from(timeListings)
      .innerJoin(users, eq(timeListings.professionalId, users.id))
      .leftJoin(professionalProfiles, eq(timeListings.professionalId, professionalProfiles.userId))
      .where(where)
      .orderBy(desc(timeListings.createdAt))
      .limit(limit)
      .offset(offset);

    const catIds = [...new Set(rows.map((r) => r.time_listings.skillCategoryId))];
    const cats = catIds.length > 0 ? await db.select().from(skillCategories).where(inArray(skillCategories.id, catIds)) : [];
    const catMap = Object.fromEntries(cats.map((c) => [c.id, c]));

    const parentIds = [...new Set(cats.map((c) => c.parentId).filter((id): id is number => id !== null))];
    const parents = parentIds.length > 0 ? await db.select().from(skillCategories).where(inArray(skillCategories.id, parentIds)) : [];
    const parentMap = Object.fromEntries(parents.map((p) => [p.id, p.name]));

    const listingIds = rows.map((r) => r.time_listings.id);
    const bidCounts =
      listingIds.length > 0
        ? await db
            .select({ listingId: bids.listingId, cnt: count() })
            .from(bids)
            .where(inArray(bids.listingId, listingIds))
            .groupBy(bids.listingId)
        : [];
    const bidCountMap = Object.fromEntries(bidCounts.map((b) => [b.listingId, b.cnt]));

    // Batch-fetch latest VWAP per skillCategoryId for market rate indicator
    const uniqueCatIds = [...new Set(rows.map((r) => r.time_listings.skillCategoryId))];
    const marketRates: Record<number, number | null> = {};
    if (uniqueCatIds.length > 0) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const vwapRows = await db
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
            inArray(priceSnapshots.skillCategoryId, uniqueCatIds),
            gte(priceSnapshots.snapshotAt, thirtyDaysAgo),
          ),
        )
        .groupBy(priceSnapshots.skillCategoryId);
      for (const v of vwapRows) {
        marketRates[v.skillCategoryId] = v.vwapCents != null ? Number(v.vwapCents) : null;
      }
    }

    const items = rows.map(({ time_listings: l, users: u, professional_profiles: pp }) => {
      const cat = catMap[l.skillCategoryId];
      return {
        id: l.id,
        title: l.title,
        skillCategoryId: l.skillCategoryId,
        skillCategoryName: cat?.name ?? "",
        skillCategoryParentName: cat?.parentId ? (parentMap[cat.parentId] ?? null) : null,
        hoursPerWeek: l.hoursPerWeek,
        startDate: l.startDate,
        endDate: l.endDate,
        listingType: l.listingType,
        rateCents: l.rateCents,
        marketRateCents: marketRates[l.skillCategoryId] ?? null,
        status: l.status,
        professionalId: l.professionalId,
        professionalDisplayName: u.displayName,
        professionalExperienceLevel: pp?.experienceLevel ?? "mid",
        professionalTimezone: pp?.timezone ?? null,
        bidCount: bidCountMap[l.id] ?? 0,
        createdAt: l.createdAt.toISOString(),
      };
    });

    res.json({ items, total: Number(total), limit, offset });
  } catch (err) {
    req.log.error({ err }, "listListings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /listings — create a listing (auth required)
router.post("/listings", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const parsed = CreateListingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  try {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const body = parsed.data;
    const [inserted] = await db
      .insert(timeListings)
      .values({
        professionalId: user.id,
        skillCategoryId: body.skillCategoryId,
        title: body.title,
        description: body.description ?? null,
        hoursPerWeek: body.hoursPerWeek,
        startDate: toDateStr(body.startDate)!,
        endDate: toDateStr(body.endDate)!,
        listingType: body.listingType,
        rateCents: body.rateCents,
        status: "open",
      })
      .returning({ id: timeListings.id });

    const detail = await buildListingDetail(inserted.id);
    res.status(201).json(detail);
  } catch (err) {
    req.log.error({ err }, "createListing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /listings/me — own listings
router.get("/listings/me", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  try {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) {
      res.json([]);
      return;
    }
    const myListings = await db
      .select()
      .from(timeListings)
      .where(eq(timeListings.professionalId, user.id))
      .orderBy(desc(timeListings.createdAt));

    const details = await Promise.all(myListings.map((l) => buildListingDetail(l.id)));
    res.json(details.filter(Boolean));
  } catch (err) {
    req.log.error({ err }, "getMyListings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /listings/:listingId
router.get("/listings/:listingId", async (req, res) => {
  const id = Number(req.params.listingId);
  if (!id) {
    res.status(400).json({ error: "Invalid listing id" });
    return;
  }
  try {
    const detail = await buildListingDetail(id);
    if (!detail) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "getListing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /listings/:listingId
router.patch("/listings/:listingId", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const id = Number(req.params.listingId);
  if (!id) {
    res.status(400).json({ error: "Invalid listing id" });
    return;
  }
  const parsed = UpdateListingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  try {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const [listing] = await db.select().from(timeListings).where(eq(timeListings.id, id)).limit(1);
    if (!listing) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    if (listing.professionalId !== user.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const body = parsed.data;
    const updateValues: Partial<typeof timeListings.$inferInsert> = { updatedAt: new Date() };
    if (body.title !== undefined) updateValues.title = body.title;
    if (body.description !== undefined) updateValues.description = body.description ?? null;
    if (body.hoursPerWeek !== undefined) updateValues.hoursPerWeek = body.hoursPerWeek;
    if (body.startDate !== undefined) updateValues.startDate = toDateStr(body.startDate);
    if (body.endDate !== undefined) updateValues.endDate = toDateStr(body.endDate);
    if (body.rateCents !== undefined) updateValues.rateCents = body.rateCents;

    await db.update(timeListings).set(updateValues).where(eq(timeListings.id, id));
    const detail = await buildListingDetail(id);
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "updateListing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /listings/:listingId
router.delete("/listings/:listingId", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const id = Number(req.params.listingId);
  if (!id) {
    res.status(400).json({ error: "Invalid listing id" });
    return;
  }
  try {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const [listing] = await db.select().from(timeListings).where(eq(timeListings.id, id)).limit(1);
    if (!listing) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    if (listing.professionalId !== user.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (!["open", "in_bidding"].includes(listing.status)) {
      res.status(400).json({ error: "Cannot cancel a committed or completed listing" });
      return;
    }
    await db.update(timeListings).set({ status: "cancelled", updatedAt: new Date() }).where(eq(timeListings.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "deleteListing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /listings/:listingId/book — book a fixed-rate listing
router.post("/listings/:listingId/book", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const id = Number(req.params.listingId);
  if (!id) {
    res.status(400).json({ error: "Invalid listing id" });
    return;
  }
  try {
    const [buyer] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!buyer) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const [listing] = await db.select().from(timeListings).where(eq(timeListings.id, id)).limit(1);
    if (!listing) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    if (listing.listingType !== "fixed_rate" && listing.listingType !== "emergency") {
      res.status(400).json({ error: "Only fixed-rate or emergency listings can be booked directly" });
      return;
    }
    if (listing.status !== "open") {
      res.status(400).json({ error: "Listing is not available for booking" });
      return;
    }
    if (listing.professionalId === buyer.id) {
      res.status(400).json({ error: "Cannot book your own listing" });
      return;
    }

    const { detail, escrow } = await db.transaction(async (tx) => {
      await tx
        .update(timeListings)
        .set({ status: "committed", buyerId: buyer.id, updatedAt: new Date() })
        .where(eq(timeListings.id, id));
      const [escrowRow] = await tx
        .insert(escrowRecords)
        .values({
          listingId: id,
          buyerId: buyer.id,
          professionalId: listing.professionalId,
          amountCents: listing.rateCents * listing.hoursPerWeek,
          status: "pending_payment",
        })
        .returning();
      return { detail: await buildListingDetail(id), escrow: escrowRow };
    });

    await createNotification(
      listing.professionalId,
      "listing_booked",
      { listingId: id, listingTitle: listing.title, buyerId: buyer.id, buyerDisplayName: buyer.displayName },
      {
        emailHeading: `Your listing "${listing.title}" was booked`,
        emailBody: `${buyer.displayName} just booked your listing. Funds are pending in escrow.`,
        emailCtaLabel: "View dashboard",
        emailCtaPath: "/dashboard",
      },
    );

    res.json({ listing: detail, escrow: { ...escrow, createdAt: escrow.createdAt.toISOString(), updatedAt: escrow.updatedAt.toISOString() } });
  } catch (err) {
    req.log.error({ err }, "bookListing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /listings/:listingId/bids
router.get("/listings/:listingId/bids", async (req, res) => {
  const id = Number(req.params.listingId);
  if (!id) {
    res.status(400).json({ error: "Invalid listing id" });
    return;
  }
  try {
    const rows = await db
      .select()
      .from(bids)
      .innerJoin(users, eq(bids.bidderId, users.id))
      .where(eq(bids.listingId, id))
      .orderBy(desc(bids.placedAt));

    res.json(
      rows.map(({ bids: b, users: u }) => ({
        id: b.id,
        listingId: b.listingId,
        bidderId: b.bidderId,
        bidderDisplayName: u.displayName,
        bidderClerkId: u.clerkId,
        bidRateCents: b.bidRateCents,
        message: b.message ?? null,
        status: b.status,
        placedAt: b.placedAt.toISOString(),
      })),
    );
  } catch (err) {
    req.log.error({ err }, "listBids error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /listings/:listingId/bids — place a bid
router.post("/listings/:listingId/bids", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const id = Number(req.params.listingId);
  if (!id) {
    res.status(400).json({ error: "Invalid listing id" });
    return;
  }
  const parsed = PlaceBidBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  try {
    const [bidder] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!bidder) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const [listing] = await db.select().from(timeListings).where(eq(timeListings.id, id)).limit(1);
    if (!listing) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    if (listing.listingType !== "auction") {
      res.status(400).json({ error: "Only auction listings accept bids" });
      return;
    }
    if (!["open", "in_bidding"].includes(listing.status)) {
      res.status(400).json({ error: "Listing is not accepting bids" });
      return;
    }
    if (listing.professionalId === bidder.id) {
      res.status(400).json({ error: "Cannot bid on your own listing" });
      return;
    }

    const existing = await db.select().from(bids).where(and(eq(bids.listingId, id), eq(bids.bidderId, bidder.id))).limit(1);
    let bidRow;
    if (existing.length > 0) {
      const [updated] = await db
        .update(bids)
        .set({ bidRateCents: parsed.data.bidRateCents, message: parsed.data.message ?? null, updatedAt: new Date() })
        .where(eq(bids.id, existing[0].id))
        .returning();
      bidRow = updated;
    } else {
      const [created] = await db
        .insert(bids)
        .values({ listingId: id, bidderId: bidder.id, bidRateCents: parsed.data.bidRateCents, message: parsed.data.message ?? null })
        .returning();
      bidRow = created;
    }

    if (listing.status === "open") {
      await db.update(timeListings).set({ status: "in_bidding", updatedAt: new Date() }).where(eq(timeListings.id, id));
    }

    await createNotification(
      listing.professionalId,
      "new_bid",
      {
        listingId: id,
        listingTitle: listing.title,
        bidderId: bidder.id,
        bidderDisplayName: bidder.displayName,
        bidRateCents: parsed.data.bidRateCents,
      },
      {
        emailHeading: `New bid on "${listing.title}"`,
        emailBody: `${bidder.displayName} placed a bid of $${(parsed.data.bidRateCents / 100).toFixed(2)}/hr.`,
        emailCtaLabel: "Review bid",
        emailCtaPath: "/dashboard",
      },
    );

    res.status(201).json({
      id: bidRow.id,
      listingId: bidRow.listingId,
      bidderId: bidRow.bidderId,
      bidderDisplayName: bidder.displayName,
      bidderClerkId: bidder.clerkId,
      bidRateCents: bidRow.bidRateCents,
      message: bidRow.message ?? null,
      status: bidRow.status,
      placedAt: bidRow.placedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "placeBid error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /listings/:listingId/bids/:bidId/accept — accept a bid
router.post("/listings/:listingId/bids/:bidId/accept", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const listingId = Number(req.params.listingId);
  const bidId = Number(req.params.bidId);
  if (!listingId || !bidId) {
    res.status(400).json({ error: "Invalid ids" });
    return;
  }
  try {
    const [owner] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!owner) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const [listing] = await db.select().from(timeListings).where(eq(timeListings.id, listingId)).limit(1);
    if (!listing) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    if (listing.professionalId !== owner.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    // Guard: only auction listings can have bids accepted
    if (listing.listingType !== "auction") {
      res.status(400).json({ error: "Only auction listings support bid acceptance" });
      return;
    }
    // Guard: listing must be in a biddable state
    if (!["open", "in_bidding"].includes(listing.status)) {
      res.status(400).json({ error: "Listing is not in a state where bids can be accepted" });
      return;
    }

    const [bid] = await db.select().from(bids).where(and(eq(bids.id, bidId), eq(bids.listingId, listingId))).limit(1);
    if (!bid) {
      res.status(404).json({ error: "Bid not found" });
      return;
    }
    // Guard: only pending bids can be accepted
    if (bid.status !== "pending") {
      res.status(400).json({ error: "Bid is no longer pending" });
      return;
    }

    const { detail, escrow } = await db.transaction(async (tx) => {
      await tx.update(bids).set({ status: "accepted", updatedAt: new Date() }).where(eq(bids.id, bidId));
      // Reject all other pending bids on this listing
      await tx
        .update(bids)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(and(eq(bids.listingId, listingId), eq(bids.status, "pending")));
      await tx
        .update(timeListings)
        .set({ status: "committed", buyerId: bid.bidderId, updatedAt: new Date() })
        .where(eq(timeListings.id, listingId));
      const [escrowRow] = await tx
        .insert(escrowRecords)
        .values({
          listingId,
          buyerId: bid.bidderId,
          professionalId: listing.professionalId,
          amountCents: bid.bidRateCents * listing.hoursPerWeek,
          status: "pending_payment",
        })
        .returning();
      return { detail: await buildListingDetail(listingId), escrow: escrowRow };
    });

    await createNotification(
      bid.bidderId,
      "bid_accepted",
      {
        listingId,
        listingTitle: listing.title,
        bidRateCents: bid.bidRateCents,
      },
      {
        emailHeading: `Your bid was accepted on "${listing.title}"`,
        emailBody: `Congrats — your bid of $${(bid.bidRateCents / 100).toFixed(2)}/hr was accepted. Funds will be requested into escrow.`,
        emailCtaLabel: "View commitment",
        emailCtaPath: "/dashboard",
      },
    );

    res.json({ listing: detail, escrow: { ...escrow, createdAt: escrow.createdAt.toISOString(), updatedAt: escrow.updatedAt.toISOString() } });
  } catch (err) {
    req.log.error({ err }, "acceptBid error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
