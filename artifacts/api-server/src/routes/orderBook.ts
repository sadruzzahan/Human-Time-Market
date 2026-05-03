import { Router } from "express";
import {
  db,
  users,
  skillCategories,
  orders,
  trades,
  priceSnapshots,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import {
  eq,
  and,
  or,
  gte,
  gt,
  lte,
  desc,
  asc,
  inArray,
  isNull,
  sql,
  not,
  lt,
} from "drizzle-orm";
import * as sse from "../lib/sseManager";
import { PlaceOrderBody } from "@workspace/api-zod";

const router = Router();

// ---------------------------------------------------------------------------
// Matching engine
// ---------------------------------------------------------------------------

type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function runMatchingEngine(
  tx: TxClient,
  orderId: number,
  order: {
    orderType: "bid" | "ask";
    skillCategoryId: number;
    rateCents: number;
    quantityHours: number;
    filledHours: number;
  },
): Promise<{ tradedHours: number; trades: { matchedRateCents: number; quantityHours: number }[] }> {
  const newTrades: { matchedRateCents: number; quantityHours: number }[] = [];
  const { skillCategoryId, orderType, rateCents: newRate } = order;

  let remaining = order.quantityHours - order.filledHours;
  if (remaining <= 0) return { tradedHours: 0, trades: [] };

  const opposingType = orderType === "bid" ? "ask" : "bid";

  const now = new Date();
  const crossingOrders = await tx
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.skillCategoryId, skillCategoryId),
        eq(orders.orderType, opposingType),
        inArray(orders.status, ["open", "partially_filled"]),
        not(eq(orders.id, orderId)),
        orderType === "bid"
          ? lte(orders.rateCents, newRate)
          : gte(orders.rateCents, newRate),
        or(isNull(orders.expiresAt), gt(orders.expiresAt, now)),
      ),
    )
    .orderBy(
      orderType === "bid" ? asc(orders.rateCents) : desc(orders.rateCents),
      asc(orders.createdAt),
    )
    .for("update");

  let totalTradedHours = 0;

  for (const opp of crossingOrders) {
    if (remaining <= 0) break;
    const oppRemaining = opp.quantityHours - opp.filledHours;
    if (oppRemaining <= 0) continue;

    const matched = Math.min(remaining, oppRemaining);
    const matchedRate = opp.rateCents; // resting order sets the price (price-time priority)

    await tx.insert(trades).values({
      bidOrderId: orderType === "bid" ? orderId : opp.id,
      askOrderId: orderType === "ask" ? orderId : opp.id,
      skillCategoryId,
      matchedRateCents: matchedRate,
      quantityHours: matched,
    });

    newTrades.push({ matchedRateCents: matchedRate, quantityHours: matched });

    const oppNewFilled = opp.filledHours + matched;
    await tx
      .update(orders)
      .set({
        filledHours: oppNewFilled,
        status: oppNewFilled >= opp.quantityHours ? "filled" : "partially_filled",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, opp.id));

    await tx.insert(priceSnapshots).values({
      skillCategoryId,
      vwapCents: matchedRate,
      volumeHours: matched,
    });

    totalTradedHours += matched;
    remaining -= matched;
  }

  if (totalTradedHours > 0) {
    const newFilled = order.filledHours + totalTradedHours;
    await tx
      .update(orders)
      .set({
        filledHours: newFilled,
        status: newFilled >= order.quantityHours ? "filled" : "partially_filled",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
  }

  return { tradedHours: totalTradedHours, trades: newTrades };
}

// ---------------------------------------------------------------------------
// Helper to build order book depth for a category
// ---------------------------------------------------------------------------

function notExpired() {
  const now = new Date();
  return or(isNull(orders.expiresAt), gt(orders.expiresAt, now));
}

async function buildOrderBookDepth(skillCategoryId: number) {
  const bidsRaw = await db
    .select({
      rateCents: orders.rateCents,
      totalHours: sql<number>`cast(sum(${orders.quantityHours} - ${orders.filledHours}) as int)`,
      orderCount: sql<number>`cast(count(*) as int)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.skillCategoryId, skillCategoryId),
        eq(orders.orderType, "bid"),
        inArray(orders.status, ["open", "partially_filled"]),
        notExpired(),
      ),
    )
    .groupBy(orders.rateCents)
    .orderBy(desc(orders.rateCents))
    .limit(20);

  const asksRaw = await db
    .select({
      rateCents: orders.rateCents,
      totalHours: sql<number>`cast(sum(${orders.quantityHours} - ${orders.filledHours}) as int)`,
      orderCount: sql<number>`cast(count(*) as int)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.skillCategoryId, skillCategoryId),
        eq(orders.orderType, "ask"),
        inArray(orders.status, ["open", "partially_filled"]),
        notExpired(),
      ),
    )
    .groupBy(orders.rateCents)
    .orderBy(asc(orders.rateCents))
    .limit(20);

  // Cumulative sums
  let cumBid = 0;
  const bids = bidsRaw.map((b) => {
    cumBid += Number(b.totalHours);
    return {
      rateCents: b.rateCents,
      totalHours: Number(b.totalHours),
      orderCount: Number(b.orderCount),
      cumulativeHours: cumBid,
    };
  });

  let cumAsk = 0;
  const asks = asksRaw.map((a) => {
    cumAsk += Number(a.totalHours);
    return {
      rateCents: a.rateCents,
      totalHours: Number(a.totalHours),
      orderCount: Number(a.orderCount),
      cumulativeHours: cumAsk,
    };
  });

  const bestBid = bids[0]?.rateCents ?? null;
  const bestAsk = asks[0]?.rateCents ?? null;
  const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;

  return { skillCategoryId, bids, asks, bestBid, bestAsk, spread };
}

// ---------------------------------------------------------------------------
// POST /orders — place a new order
// ---------------------------------------------------------------------------

router.post("/orders", requireAuth, async (req, res) => {
  try {
    const parsed = PlaceOrderBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const { orderType, skillCategoryId, rateCents, quantityHours, expiresAt } =
      parsed.data;

    if (
      !Number.isInteger(rateCents) || rateCents < 1 ||
      !Number.isInteger(quantityHours) || quantityHours < 1 ||
      !Number.isInteger(skillCategoryId) || skillCategoryId < 1
    ) {
      res.status(400).json({ error: "rateCents, quantityHours and skillCategoryId must be positive integers" });
      return;
    }

    const clerkUserId = req.clerkUserId!;
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [cat] = await db
      .select()
      .from(skillCategories)
      .where(eq(skillCategories.id, skillCategoryId))
      .limit(1);
    if (!cat) {
      res.status(400).json({ error: "Skill category not found" });
      return;
    }

    let insertedOrder: typeof orders.$inferSelect;
    let matchResult: Awaited<ReturnType<typeof runMatchingEngine>>;

    await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(orders)
        .values({
          orderType,
          skillCategoryId,
          rateCents,
          quantityHours,
          userId: user.id,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        })
        .returning();

      insertedOrder = inserted;
      matchResult = await runMatchingEngine(tx, inserted.id, {
        orderType,
        skillCategoryId,
        rateCents,
        quantityHours,
        filledHours: 0,
      });
    });

    // Re-fetch after transaction to get final status
    const [finalOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, insertedOrder!.id))
      .limit(1);

    const orderResponse = {
      id: finalOrder.id,
      orderType: finalOrder.orderType,
      skillCategoryId: finalOrder.skillCategoryId,
      rateCents: finalOrder.rateCents,
      quantityHours: finalOrder.quantityHours,
      filledHours: finalOrder.filledHours,
      status: finalOrder.status,
      expiresAt: finalOrder.expiresAt?.toISOString() ?? null,
      createdAt: finalOrder.createdAt.toISOString(),
      updatedAt: finalOrder.updatedAt.toISOString(),
    };

    const depth = await buildOrderBookDepth(skillCategoryId);
    sse.broadcastCategory(skillCategoryId, "order-book", depth);

    if (matchResult!.tradedHours > 0) {
      const idx = await buildPriceIndex();
      sse.broadcastGlobal("price-index", idx);
    }

    res.status(201).json(orderResponse);
  } catch (err) {
    console.error("POST /orders error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /orders/:orderId — cancel an order
// ---------------------------------------------------------------------------

router.delete("/orders/:orderId", requireAuth, async (req, res) => {
  try {
    const orderId = parseInt(String(req.params.orderId), 10);
    if (isNaN(orderId)) {
      res.status(400).json({ error: "Invalid order ID" });
      return;
    }

    const clerkUserId = req.clerkUserId!;
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (order.userId !== user.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    if (!["open", "partially_filled"].includes(order.status)) {
      res.status(400).json({ error: "Order cannot be cancelled in its current state" });
      return;
    }

    await db
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    const depth = await buildOrderBookDepth(order.skillCategoryId);
    sse.broadcastCategory(order.skillCategoryId, "order-book", depth);

    res.status(204).send();
  } catch (err) {
    console.error("DELETE /orders/:orderId error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /order-book/:skillCategoryId — current order book depth
// ---------------------------------------------------------------------------

router.get("/order-book/:skillCategoryId", async (req, res) => {
  try {
    const skillCategoryId = parseInt(req.params.skillCategoryId, 10);
    if (isNaN(skillCategoryId)) {
      res.status(400).json({ error: "Invalid skill category ID" });
      return;
    }

    const [cat] = await db
      .select()
      .from(skillCategories)
      .where(eq(skillCategories.id, skillCategoryId))
      .limit(1);
    if (!cat) {
      res.status(404).json({ error: "Skill category not found" });
      return;
    }

    const depth = await buildOrderBookDepth(skillCategoryId);
    res.json(depth);
  } catch (err) {
    console.error("GET /order-book/:skillCategoryId error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /order-book/:skillCategoryId/events — SSE stream
// ---------------------------------------------------------------------------

router.get("/order-book/:skillCategoryId/events", async (req, res) => {
  const skillCategoryId = parseInt(req.params.skillCategoryId, 10);
  if (isNaN(skillCategoryId)) {
    res.status(400).json({ error: "Invalid skill category ID" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  sse.subscribeCategory(skillCategoryId, res);

  buildOrderBookDepth(skillCategoryId)
    .then((depth) => {
      res.write(`event: order-book\ndata: ${JSON.stringify(depth)}\n\n`);
    })
    .catch(() => {});

  // Keep-alive ping every 25 seconds
  const ping = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(ping);
    }
  }, 25_000);

  req.on("close", () => {
    clearInterval(ping);
    sse.unsubscribeCategory(skillCategoryId, res);
  });
});

// ---------------------------------------------------------------------------
// Helper — build full PriceIndexEntry[] (reused by route and SSE broadcast)
// ---------------------------------------------------------------------------

async function buildPriceIndex() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const allCats = await db.select().from(skillCategories);

  const vwap24h = await db
    .select({
      skillCategoryId: priceSnapshots.skillCategoryId,
      vwapCents: sql<number>`
        cast(
          sum(cast(${priceSnapshots.vwapCents} as bigint) * cast(${priceSnapshots.volumeHours} as bigint))::float
          / nullif(sum(${priceSnapshots.volumeHours}), 0)
        as int)`,
      volumeHours: sql<number>`cast(sum(${priceSnapshots.volumeHours}) as int)`,
      lastTradedAt: sql<string>`max(${priceSnapshots.snapshotAt})`,
    })
    .from(priceSnapshots)
    .where(gte(priceSnapshots.snapshotAt, oneDayAgo))
    .groupBy(priceSnapshots.skillCategoryId);

  const vwapPrev24h = await db
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
        gte(priceSnapshots.snapshotAt, twoDaysAgo),
        lt(priceSnapshots.snapshotAt, oneDayAgo),
      ),
    )
    .groupBy(priceSnapshots.skillCategoryId);

  const vwapMap = Object.fromEntries(vwap24h.map((v) => [v.skillCategoryId, v]));
  const prevMap = Object.fromEntries(vwapPrev24h.map((v) => [v.skillCategoryId, v]));

  return allCats
    .filter((c) => c.parentId !== null)
    .map((cat) => {
      const parent = allCats.find((p) => p.id === cat.parentId);
      const data = vwapMap[cat.id];
      const prev = prevMap[cat.id];
      const change24hCents =
        data?.vwapCents != null && prev?.vwapCents != null
          ? Number(data.vwapCents) - Number(prev.vwapCents)
          : null;
      return {
        skillCategoryId: cat.id,
        skillCategoryName: cat.name,
        skillCategorySlug: cat.slug,
        parentId: cat.parentId,
        parentName: parent?.name ?? null,
        vwapCents: data?.vwapCents != null ? Number(data.vwapCents) : null,
        volumeHours24h: data?.volumeHours != null ? Number(data.volumeHours) : 0,
        change24hCents,
        lastTradedAt: data?.lastTradedAt ?? null,
      };
    });
}

// ---------------------------------------------------------------------------
// GET /price-index — current VWAP per skill category (public)
// ---------------------------------------------------------------------------

router.get("/price-index", async (_req, res) => {
  try {
    res.json(await buildPriceIndex());
  } catch (err) {
    console.error("GET /price-index error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /price-history/:skillCategoryId — last 30 days of daily VWAP
// ---------------------------------------------------------------------------

router.get("/price-history/:skillCategoryId", async (req, res) => {
  try {
    const skillCategoryId = parseInt(req.params.skillCategoryId, 10);
    if (isNaN(skillCategoryId)) {
      res.status(400).json({ error: "Invalid skill category ID" });
      return;
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        day: sql<string>`date_trunc('day', ${priceSnapshots.snapshotAt})::date::text`,
        vwapCents: sql<number>`
          cast(
            sum(cast(${priceSnapshots.vwapCents} as bigint) * cast(${priceSnapshots.volumeHours} as bigint))::float
            / nullif(sum(${priceSnapshots.volumeHours}), 0)
          as int)`,
        volumeHours: sql<number>`cast(sum(${priceSnapshots.volumeHours}) as int)`,
      })
      .from(priceSnapshots)
      .where(
        and(
          eq(priceSnapshots.skillCategoryId, skillCategoryId),
          gte(priceSnapshots.snapshotAt, thirtyDaysAgo),
        ),
      )
      .groupBy(sql`date_trunc('day', ${priceSnapshots.snapshotAt})`)
      .orderBy(sql`date_trunc('day', ${priceSnapshots.snapshotAt})`);

    const history = rows.map((r) => ({
      date: r.day,
      vwapCents: Number(r.vwapCents),
      volumeHours: Number(r.volumeHours),
    }));

    res.json(history);
  } catch (err) {
    console.error("GET /price-history/:skillCategoryId error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /price-index/events — global SSE stream for all categories
// ---------------------------------------------------------------------------

router.get("/price-index/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  sse.subscribeGlobal(res);

  buildPriceIndex()
    .then((idx) => {
      res.write(`event: price-index\ndata: ${JSON.stringify(idx)}\n\n`);
    })
    .catch(() => {});

  const ping = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(ping);
    }
  }, 25_000);

  req.on("close", () => {
    clearInterval(ping);
    sse.unsubscribeGlobal(res);
  });
});

export default router;
