import { Router } from "express";
import {
  db,
  users,
  skillCategories,
  timeListings,
  secondaryListings,
  timeOptions,
  timeSwaps,
  bundles,
  bundleItems,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { eq, and, or, desc, count, sql } from "drizzle-orm";
import {
  CreateSecondaryListingBody,
  CreateOptionBody,
  ProposeSwapBody,
  CreateBundleBody,
  ListSecondaryListingsQueryParams,
  ListOptionsQueryParams,
  ListBundlesQueryParams,
} from "@workspace/api-zod";

const router = Router();

async function getDbUser(clerkId: string) {
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  return user ?? null;
}

async function buildSecondaryListingDetail(id: number) {
  const [sl] = await db.select().from(secondaryListings).where(eq(secondaryListings.id, id)).limit(1);
  if (!sl) return null;

  const [listing] = await db.select().from(timeListings).where(eq(timeListings.id, sl.originalListingId)).limit(1);
  const [skillCat] = listing
    ? await db.select().from(skillCategories).where(eq(skillCategories.id, listing.skillCategoryId)).limit(1)
    : [null];
  const [professional] = listing
    ? await db.select().from(users).where(eq(users.id, listing.professionalId)).limit(1)
    : [null];
  const [seller] = await db.select().from(users).where(eq(users.id, sl.sellerId)).limit(1);

  return {
    id: sl.id,
    originalListingId: sl.originalListingId,
    originalListingTitle: listing?.title ?? "",
    skillCategoryId: listing?.skillCategoryId ?? 0,
    skillCategoryName: skillCat?.name ?? "",
    professionalDisplayName: professional?.displayName ?? "",
    hoursPerWeek: listing?.hoursPerWeek ?? 0,
    startDate: listing?.startDate ?? "",
    endDate: listing?.endDate ?? "",
    sellerId: sl.sellerId,
    sellerDisplayName: seller?.displayName ?? "",
    buyerId: sl.buyerId ?? null,
    askPriceCents: sl.askPriceCents,
    status: sl.status,
    listedAt: sl.listedAt.toISOString(),
    soldAt: sl.soldAt?.toISOString() ?? null,
  };
}

async function buildOptionDetail(id: number) {
  const [opt] = await db.select().from(timeOptions).where(eq(timeOptions.id, id)).limit(1);
  if (!opt) return null;

  const [professional] = await db.select().from(users).where(eq(users.id, opt.professionalId)).limit(1);
  const [skillCat] = await db.select().from(skillCategories).where(eq(skillCategories.id, opt.skillCategoryId)).limit(1);
  const [holder] = opt.holderId
    ? await db.select().from(users).where(eq(users.id, opt.holderId)).limit(1)
    : [null];

  return {
    id: opt.id,
    professionalId: opt.professionalId,
    professionalDisplayName: professional?.displayName ?? "",
    skillCategoryId: opt.skillCategoryId,
    skillCategoryName: skillCat?.name ?? "",
    hours: opt.hours,
    windowStart: opt.windowStart,
    windowEnd: opt.windowEnd,
    premiumCents: opt.premiumCents,
    fullRateCents: opt.fullRateCents,
    holderId: opt.holderId ?? null,
    holderDisplayName: holder?.displayName ?? null,
    status: opt.status,
    exercisedAt: opt.exercisedAt?.toISOString() ?? null,
    expiresAt: opt.expiresAt?.toISOString() ?? null,
    createdAt: opt.createdAt.toISOString(),
  };
}

async function buildSwapDetail(id: number) {
  const [swap] = await db.select().from(timeSwaps).where(eq(timeSwaps.id, id)).limit(1);
  if (!swap) return null;

  const [proposer] = await db.select().from(users).where(eq(users.id, swap.proposerId)).limit(1);
  const [counterparty] = await db.select().from(users).where(eq(users.id, swap.counterpartyId)).limit(1);
  const [proposerListing] = await db.select().from(timeListings).where(eq(timeListings.id, swap.proposerListingId)).limit(1);
  const [cpListing] = swap.counterpartyListingId
    ? await db.select().from(timeListings).where(eq(timeListings.id, swap.counterpartyListingId)).limit(1)
    : [null];
  const [proposerSkill] = await db
    .select()
    .from(skillCategories)
    .where(eq(skillCategories.id, swap.proposerSkillCategoryId))
    .limit(1);
  const [cpSkill] = await db
    .select()
    .from(skillCategories)
    .where(eq(skillCategories.id, swap.counterpartySkillCategoryId))
    .limit(1);

  return {
    id: swap.id,
    proposerId: swap.proposerId,
    proposerDisplayName: proposer?.displayName ?? "",
    counterpartyId: swap.counterpartyId,
    counterpartyDisplayName: counterparty?.displayName ?? "",
    proposerListingId: swap.proposerListingId,
    proposerListingTitle: proposerListing?.title ?? "",
    counterpartyListingId: swap.counterpartyListingId ?? null,
    counterpartyListingTitle: cpListing?.title ?? null,
    proposerHours: swap.proposerHours,
    counterpartyHours: swap.counterpartyHours,
    proposerSkillCategoryId: swap.proposerSkillCategoryId,
    proposerSkillCategoryName: proposerSkill?.name ?? "",
    counterpartySkillCategoryId: swap.counterpartySkillCategoryId,
    counterpartySkillCategoryName: cpSkill?.name ?? "",
    note: swap.note ?? null,
    status: swap.status,
    createdAt: swap.createdAt.toISOString(),
    updatedAt: swap.updatedAt.toISOString(),
  };
}

async function buildBundleDetail(id: number) {
  const [bundle] = await db.select().from(bundles).where(eq(bundles.id, id)).limit(1);
  if (!bundle) return null;

  const [creator] = await db.select().from(users).where(eq(users.id, bundle.creatorId)).limit(1);
  const [buyer] = bundle.buyerId
    ? await db.select().from(users).where(eq(users.id, bundle.buyerId)).limit(1)
    : [null];
  const items = await db.select().from(bundleItems).where(eq(bundleItems.bundleId, id));

  const enrichedItems = await Promise.all(
    items.map(async (item) => {
      const [listing] = await db.select().from(timeListings).where(eq(timeListings.id, item.listingId)).limit(1);
      const [professional] = await db.select().from(users).where(eq(users.id, item.professionalId)).limit(1);
      const [skillCat] = listing
        ? await db.select().from(skillCategories).where(eq(skillCategories.id, listing.skillCategoryId)).limit(1)
        : [null];
      return {
        id: item.id,
        listingId: item.listingId,
        listingTitle: listing?.title ?? "",
        professionalId: item.professionalId,
        professionalDisplayName: professional?.displayName ?? "",
        skillCategoryId: listing?.skillCategoryId ?? 0,
        skillCategoryName: skillCat?.name ?? "",
        hours: item.hours,
      };
    }),
  );

  return {
    id: bundle.id,
    creatorId: bundle.creatorId,
    creatorDisplayName: creator?.displayName ?? "",
    buyerId: bundle.buyerId ?? null,
    buyerDisplayName: buyer?.displayName ?? null,
    title: bundle.title,
    description: bundle.description ?? null,
    totalPriceCents: bundle.totalPriceCents,
    status: bundle.status,
    items: enrichedItems,
    createdAt: bundle.createdAt.toISOString(),
  };
}

router.get("/secondary-market", async (req, res) => {
  const parsed = ListSecondaryListingsQueryParams.safeParse(req.query);
  const { skillCategoryId, limit = 20, offset = 0 } = parsed.success ? parsed.data : req.query as { skillCategoryId?: number; limit?: number; offset?: number };
  const lim = Math.min(Number(limit), 100);
  const off = Number(offset);

  try {
    const baseCondition = eq(secondaryListings.status, "open");
    const categoryFilter = skillCategoryId
      ? sql`${secondaryListings.originalListingId} IN (SELECT id FROM time_listings WHERE skill_category_id = ${Number(skillCategoryId)})`
      : undefined;

    const whereClause = categoryFilter ? and(baseCondition, categoryFilter) : baseCondition;

    const [{ total }] = await db.select({ total: count() }).from(secondaryListings).where(whereClause);
    const rows = await db
      .select()
      .from(secondaryListings)
      .where(whereClause)
      .orderBy(desc(secondaryListings.listedAt))
      .limit(lim)
      .offset(off);

    const items = (await Promise.all(rows.map((r) => buildSecondaryListingDetail(r.id)))).filter(Boolean);
    res.json({ items, total, limit: lim, offset: off });
  } catch (err) {
    req.log.error({ err }, "listSecondaryListings error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/secondary-market", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const parsed = CreateSecondaryListingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  try {
    const user = await getDbUser(clerkId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const body = parsed.data;
    const [listing] = await db.select().from(timeListings).where(eq(timeListings.id, body.originalListingId)).limit(1);
    if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }
    if (listing.buyerId !== user.id) { res.status(403).json({ error: "Only the contract buyer can list it for resale" }); return; }
    if (listing.status !== "committed") { res.status(400).json({ error: "Only committed contracts can be listed for resale" }); return; }

    const existing = await db
      .select()
      .from(secondaryListings)
      .where(and(eq(secondaryListings.originalListingId, body.originalListingId), eq(secondaryListings.status, "open")))
      .limit(1);
    if (existing.length > 0) { res.status(400).json({ error: "This contract is already listed for resale" }); return; }

    const [created] = await db
      .insert(secondaryListings)
      .values({ originalListingId: body.originalListingId, sellerId: user.id, askPriceCents: body.askPriceCents })
      .returning();

    const detail = await buildSecondaryListingDetail(created.id);
    res.status(201).json(detail);
  } catch (err) {
    req.log.error({ err }, "createSecondaryListing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/secondary-market/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const detail = await buildSecondaryListingDetail(id);
    if (!detail) { res.status(404).json({ error: "Not found" }); return; }
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "getSecondaryListing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/secondary-market/:id/purchase", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const id = Number(req.params.id);
  try {
    const user = await getDbUser(clerkId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [sl] = await db.select().from(secondaryListings).where(eq(secondaryListings.id, id)).limit(1);
    if (!sl) { res.status(404).json({ error: "Not found" }); return; }
    if (sl.status !== "open") { res.status(400).json({ error: "This secondary listing is no longer available" }); return; }
    if (sl.sellerId === user.id) { res.status(400).json({ error: "Cannot purchase your own secondary listing" }); return; }

    await db
      .update(secondaryListings)
      .set({ status: "sold", buyerId: user.id, soldAt: new Date() })
      .where(eq(secondaryListings.id, id));
    await db
      .update(timeListings)
      .set({ buyerId: user.id, updatedAt: new Date() })
      .where(eq(timeListings.id, sl.originalListingId));

    const detail = await buildSecondaryListingDetail(id);
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "purchaseSecondaryListing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/secondary-market/:id", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const id = Number(req.params.id);
  try {
    const user = await getDbUser(clerkId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [sl] = await db.select().from(secondaryListings).where(eq(secondaryListings.id, id)).limit(1);
    if (!sl) { res.status(404).json({ error: "Not found" }); return; }
    if (sl.sellerId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
    if (sl.status !== "open") { res.status(400).json({ error: "Cannot cancel a non-open secondary listing" }); return; }

    await db.update(secondaryListings).set({ status: "cancelled" }).where(eq(secondaryListings.id, id));
    const detail = await buildSecondaryListingDetail(id);
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "cancelSecondaryListing error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/options", async (req, res) => {
  const parsed = ListOptionsQueryParams.safeParse(req.query);
  const { skillCategoryId, limit = 20, offset = 0 } = parsed.success ? parsed.data : req.query as { skillCategoryId?: number; limit?: number; offset?: number };
  const lim = Math.min(Number(limit), 100);
  const off = Number(offset);

  try {
    const baseCondition = eq(timeOptions.status, "open");
    const whereClause = skillCategoryId
      ? and(baseCondition, eq(timeOptions.skillCategoryId, Number(skillCategoryId)))
      : baseCondition;

    const [{ total }] = await db.select({ total: count() }).from(timeOptions).where(whereClause);
    const rows = await db
      .select()
      .from(timeOptions)
      .where(whereClause)
      .orderBy(desc(timeOptions.createdAt))
      .limit(lim)
      .offset(off);

    const items = (await Promise.all(rows.map((r) => buildOptionDetail(r.id)))).filter(Boolean);
    res.json({ items, total, limit: lim, offset: off });
  } catch (err) {
    req.log.error({ err }, "listOptions error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/options", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const parsed = CreateOptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  try {
    const user = await getDbUser(clerkId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const body = parsed.data;
    const toDateStr = (d: Date) => d.toISOString().split("T")[0];
    const [created] = await db
      .insert(timeOptions)
      .values({
        professionalId: user.id,
        skillCategoryId: body.skillCategoryId,
        hours: body.hours,
        windowStart: toDateStr(body.windowStart),
        windowEnd: toDateStr(body.windowEnd),
        premiumCents: body.premiumCents,
        fullRateCents: body.fullRateCents,
        expiresAt: body.expiresAt ?? undefined,
      })
      .returning();

    const detail = await buildOptionDetail(created.id);
    res.status(201).json(detail);
  } catch (err) {
    req.log.error({ err }, "createOption error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/options/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const detail = await buildOptionDetail(id);
    if (!detail) { res.status(404).json({ error: "Not found" }); return; }
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "getOption error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/options/:id/purchase", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const id = Number(req.params.id);
  try {
    const user = await getDbUser(clerkId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [opt] = await db.select().from(timeOptions).where(eq(timeOptions.id, id)).limit(1);
    if (!opt) { res.status(404).json({ error: "Not found" }); return; }
    if (opt.status !== "open") { res.status(400).json({ error: "Option is not available for purchase" }); return; }
    if (opt.professionalId === user.id) { res.status(400).json({ error: "Cannot purchase your own option" }); return; }

    await db.update(timeOptions).set({ status: "purchased", holderId: user.id, updatedAt: new Date() }).where(eq(timeOptions.id, id));
    const detail = await buildOptionDetail(id);
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "purchaseOption error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/options/:id/exercise", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const id = Number(req.params.id);
  try {
    const user = await getDbUser(clerkId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [opt] = await db.select().from(timeOptions).where(eq(timeOptions.id, id)).limit(1);
    if (!opt) { res.status(404).json({ error: "Not found" }); return; }
    if (opt.status !== "purchased") { res.status(400).json({ error: "Option must be purchased before exercising" }); return; }
    if (opt.holderId !== user.id) { res.status(403).json({ error: "Only the option holder can exercise it" }); return; }
    if (opt.expiresAt && new Date() > opt.expiresAt) {
      await db.update(timeOptions).set({ status: "expired", updatedAt: new Date() }).where(eq(timeOptions.id, id));
      res.status(400).json({ error: "Option has expired" });
      return;
    }

    await db
      .update(timeOptions)
      .set({ status: "exercised", exercisedAt: new Date(), updatedAt: new Date() })
      .where(eq(timeOptions.id, id));
    const detail = await buildOptionDetail(id);
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "exerciseOption error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/swaps", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  try {
    const user = await getDbUser(clerkId);
    if (!user) { res.json([]); return; }

    const rows = await db
      .select()
      .from(timeSwaps)
      .where(or(eq(timeSwaps.proposerId, user.id), eq(timeSwaps.counterpartyId, user.id)))
      .orderBy(desc(timeSwaps.createdAt));

    const items = (await Promise.all(rows.map((r) => buildSwapDetail(r.id)))).filter(Boolean);
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "listSwaps error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/swaps", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const parsed = ProposeSwapBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  try {
    const user = await getDbUser(clerkId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const body = parsed.data;
    if (body.counterpartyId === user.id) { res.status(400).json({ error: "Cannot propose a swap with yourself" }); return; }

    const [proposerListing] = await db.select().from(timeListings).where(eq(timeListings.id, body.proposerListingId)).limit(1);
    if (!proposerListing) { res.status(400).json({ error: "Proposer listing not found" }); return; }
    if (proposerListing.professionalId !== user.id) { res.status(403).json({ error: "You do not own this listing" }); return; }

    const [created] = await db
      .insert(timeSwaps)
      .values({
        proposerId: user.id,
        counterpartyId: body.counterpartyId,
        proposerListingId: body.proposerListingId,
        counterpartyListingId: body.counterpartyListingId ?? null,
        proposerHours: body.proposerHours,
        counterpartyHours: body.counterpartyHours,
        proposerSkillCategoryId: body.proposerSkillCategoryId,
        counterpartySkillCategoryId: body.counterpartySkillCategoryId,
        note: body.note ?? null,
      })
      .returning();

    const detail = await buildSwapDetail(created.id);
    res.status(201).json(detail);
  } catch (err) {
    req.log.error({ err }, "proposeSwap error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/swaps/:id", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const id = Number(req.params.id);
  try {
    const user = await getDbUser(clerkId);
    if (!user) { res.status(403).json({ error: "Forbidden" }); return; }

    const detail = await buildSwapDetail(id);
    if (!detail) { res.status(404).json({ error: "Not found" }); return; }
    if (detail.proposerId !== user.id && detail.counterpartyId !== user.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "getSwap error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/swaps/:id/accept", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const id = Number(req.params.id);
  try {
    const user = await getDbUser(clerkId);
    if (!user) { res.status(403).json({ error: "Forbidden" }); return; }

    const [swap] = await db.select().from(timeSwaps).where(eq(timeSwaps.id, id)).limit(1);
    if (!swap) { res.status(404).json({ error: "Not found" }); return; }
    if (swap.counterpartyId !== user.id) { res.status(403).json({ error: "Only the counterparty can accept a swap" }); return; }
    if (swap.status !== "proposed") { res.status(400).json({ error: "Swap is not in proposed state" }); return; }

    await db.update(timeSwaps).set({ status: "accepted", updatedAt: new Date() }).where(eq(timeSwaps.id, id));
    const detail = await buildSwapDetail(id);
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "acceptSwap error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/swaps/:id/decline", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const id = Number(req.params.id);
  try {
    const user = await getDbUser(clerkId);
    if (!user) { res.status(403).json({ error: "Forbidden" }); return; }

    const [swap] = await db.select().from(timeSwaps).where(eq(timeSwaps.id, id)).limit(1);
    if (!swap) { res.status(404).json({ error: "Not found" }); return; }
    if (swap.counterpartyId !== user.id) { res.status(403).json({ error: "Only the counterparty can decline a swap" }); return; }
    if (swap.status !== "proposed") { res.status(400).json({ error: "Swap is not in proposed state" }); return; }

    await db.update(timeSwaps).set({ status: "declined", updatedAt: new Date() }).where(eq(timeSwaps.id, id));
    const detail = await buildSwapDetail(id);
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "declineSwap error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bundles", async (req, res) => {
  const parsed = ListBundlesQueryParams.safeParse(req.query);
  const { limit = 20, offset = 0 } = parsed.success ? parsed.data : req.query as { limit?: number; offset?: number };
  const lim = Math.min(Number(limit), 100);
  const off = Number(offset);

  try {
    const whereClause = eq(bundles.status, "open");
    const [{ total }] = await db.select({ total: count() }).from(bundles).where(whereClause);
    const rows = await db
      .select()
      .from(bundles)
      .where(whereClause)
      .orderBy(desc(bundles.createdAt))
      .limit(lim)
      .offset(off);

    const items = (await Promise.all(rows.map((r) => buildBundleDetail(r.id)))).filter(Boolean);
    res.json({ items, total, limit: lim, offset: off });
  } catch (err) {
    req.log.error({ err }, "listBundles error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bundles", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const parsed = CreateBundleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  try {
    const user = await getDbUser(clerkId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const body = parsed.data;
    if (!body.items || body.items.length === 0) {
      res.status(400).json({ error: "Bundle must have at least one item" });
      return;
    }

    const [createdBundle] = await db
      .insert(bundles)
      .values({
        creatorId: user.id,
        title: body.title,
        description: body.description ?? null,
        totalPriceCents: body.totalPriceCents,
      })
      .returning();

    const listingIds = body.items.map((i: { listingId: number; hours: number }) => i.listingId);
    const listingRows = await db
      .select()
      .from(timeListings)
      .where(sql`${timeListings.id} = ANY(${listingIds})`);
    const listingMap = new Map(listingRows.map((l) => [l.id, l]));

    await db.insert(bundleItems).values(
      body.items.map((item: { listingId: number; hours: number }) => ({
        bundleId: createdBundle.id,
        listingId: item.listingId,
        professionalId: listingMap.get(item.listingId)?.professionalId ?? user.id,
        hours: item.hours,
      })),
    );

    const detail = await buildBundleDetail(createdBundle.id);
    res.status(201).json(detail);
  } catch (err) {
    req.log.error({ err }, "createBundle error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bundles/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const detail = await buildBundleDetail(id);
    if (!detail) { res.status(404).json({ error: "Not found" }); return; }
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "getBundle error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bundles/:id/purchase", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const id = Number(req.params.id);
  try {
    const user = await getDbUser(clerkId);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [bundle] = await db.select().from(bundles).where(eq(bundles.id, id)).limit(1);
    if (!bundle) { res.status(404).json({ error: "Not found" }); return; }
    if (bundle.status !== "open") { res.status(400).json({ error: "Bundle is not available for purchase" }); return; }
    if (bundle.creatorId === user.id) { res.status(400).json({ error: "Cannot purchase your own bundle" }); return; }

    await db.update(bundles).set({ status: "sold", buyerId: user.id, updatedAt: new Date() }).where(eq(bundles.id, id));
    const detail = await buildBundleDetail(id);
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "purchaseBundle error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/bundles/:id", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const id = Number(req.params.id);
  try {
    const user = await getDbUser(clerkId);
    if (!user) { res.status(403).json({ error: "Forbidden" }); return; }

    const [bundle] = await db.select().from(bundles).where(eq(bundles.id, id)).limit(1);
    if (!bundle) { res.status(404).json({ error: "Not found" }); return; }
    if (bundle.creatorId !== user.id) { res.status(403).json({ error: "Forbidden" }); return; }
    if (bundle.status !== "open") { res.status(400).json({ error: "Cannot cancel a non-open bundle" }); return; }

    await db.update(bundles).set({ status: "cancelled", updatedAt: new Date() }).where(eq(bundles.id, id));
    const detail = await buildBundleDetail(id);
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "cancelBundle error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/derivatives/portfolio", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  try {
    const user = await getDbUser(clerkId);
    if (!user) {
      res.json({ secondaryListings: [], options: [], swaps: [], bundles: [] });
      return;
    }

    const [slRows, optRows, swapRows, bundleRows] = await Promise.all([
      db
        .select()
        .from(secondaryListings)
        .where(or(eq(secondaryListings.sellerId, user.id), eq(secondaryListings.buyerId, user.id)))
        .orderBy(desc(secondaryListings.listedAt)),
      db
        .select()
        .from(timeOptions)
        .where(or(eq(timeOptions.professionalId, user.id), eq(timeOptions.holderId, user.id)))
        .orderBy(desc(timeOptions.createdAt)),
      db
        .select()
        .from(timeSwaps)
        .where(or(eq(timeSwaps.proposerId, user.id), eq(timeSwaps.counterpartyId, user.id)))
        .orderBy(desc(timeSwaps.createdAt)),
      db
        .select()
        .from(bundles)
        .where(or(eq(bundles.creatorId, user.id), eq(bundles.buyerId, user.id)))
        .orderBy(desc(bundles.createdAt)),
    ]);

    const [slDetails, optDetails, swapDetails, bundleDetails] = await Promise.all([
      Promise.all(slRows.map((r) => buildSecondaryListingDetail(r.id))),
      Promise.all(optRows.map((r) => buildOptionDetail(r.id))),
      Promise.all(swapRows.map((r) => buildSwapDetail(r.id))),
      Promise.all(bundleRows.map((r) => buildBundleDetail(r.id))),
    ]);

    res.json({
      secondaryListings: slDetails.filter(Boolean),
      options: optDetails.filter(Boolean),
      swaps: swapDetails.filter(Boolean),
      bundles: bundleDetails.filter(Boolean),
    });
  } catch (err) {
    req.log.error({ err }, "getDerivativesPortfolio error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
