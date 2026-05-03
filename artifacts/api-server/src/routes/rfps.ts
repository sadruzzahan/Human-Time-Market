import { Router } from "express";
import { db, users, skillCategories, rfps, rfpResponses } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { eq, and, inArray, count, desc, SQL } from "drizzle-orm";
import {
  CreateRfpBody,
  RespondToRfpBody,
  ListRfpsQueryParams,
} from "@workspace/api-zod";

function toDateStr(d: Date | string | undefined): string | undefined {
  if (!d) return undefined;
  if (typeof d === "string") return d;
  return d.toISOString().split("T")[0];
}

const router = Router();

async function buildRfpDetail(rfpId: number) {
  const [rfp] = await db.select().from(rfps).where(eq(rfps.id, rfpId)).limit(1);
  if (!rfp) return null;

  const [buyer] = await db.select().from(users).where(eq(users.id, rfp.buyerId)).limit(1);
  const [cat] = await db.select().from(skillCategories).where(eq(skillCategories.id, rfp.skillCategoryId)).limit(1);

  let parentName: string | null = null;
  if (cat?.parentId) {
    const [parent] = await db.select().from(skillCategories).where(eq(skillCategories.id, cat.parentId)).limit(1);
    parentName = parent?.name ?? null;
  }

  const responses = await db
    .select()
    .from(rfpResponses)
    .innerJoin(users, eq(rfpResponses.professionalId, users.id))
    .where(eq(rfpResponses.rfpId, rfpId))
    .orderBy(desc(rfpResponses.createdAt));

  return {
    id: rfp.id,
    title: rfp.title,
    description: rfp.description,
    skillCategoryId: rfp.skillCategoryId,
    skillCategoryName: cat?.name ?? "",
    skillCategoryParentName: parentName,
    budgetMinCents: rfp.budgetMinCents,
    budgetMaxCents: rfp.budgetMaxCents,
    hoursNeeded: rfp.hoursNeeded,
    deadline: rfp.deadline,
    status: rfp.status,
    buyerId: rfp.buyerId,
    buyerClerkId: buyer?.clerkId ?? "",
    buyerDisplayName: buyer?.displayName ?? "",
    responses: responses.map(({ rfp_responses: r, users: u }) => ({
      id: r.id,
      rfpId: r.rfpId,
      professionalId: r.professionalId,
      professionalDisplayName: u.displayName,
      professionalClerkId: u.clerkId,
      proposedRateCents: r.proposedRateCents,
      message: r.message,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    createdAt: rfp.createdAt.toISOString(),
    updatedAt: rfp.updatedAt.toISOString(),
  };
}

// GET /rfps
router.get("/rfps", async (req, res) => {
  try {
    const params = ListRfpsQueryParams.safeParse(req.query);
    if (!params.success) {
      res.status(400).json({ error: "Invalid query parameters" });
      return;
    }
    const { skillCategoryId, status: statusFilter, limit = 20, offset = 0 } = params.data;

    const filters: SQL[] = [eq(rfps.status, statusFilter ?? "open")];
    if (skillCategoryId) {
      // Expand parent category IDs to their children so UI parent-level chips work correctly
      const children = await db
        .select({ id: skillCategories.id })
        .from(skillCategories)
        .where(eq(skillCategories.parentId, skillCategoryId));
      if (children.length > 0) {
        filters.push(inArray(rfps.skillCategoryId, children.map((c) => c.id)));
      } else {
        filters.push(eq(rfps.skillCategoryId, skillCategoryId));
      }
    }

    const where = and(...filters);

    const [{ value: total }] = await db.select({ value: count() }).from(rfps).where(where);

    const rows = await db
      .select()
      .from(rfps)
      .innerJoin(users, eq(rfps.buyerId, users.id))
      .where(where)
      .orderBy(desc(rfps.createdAt))
      .limit(limit)
      .offset(offset);

    const catIds = [...new Set(rows.map((r) => r.rfps.skillCategoryId))];
    const cats = catIds.length > 0 ? await db.select().from(skillCategories).where(inArray(skillCategories.id, catIds)) : [];
    const catMap = Object.fromEntries(cats.map((c) => [c.id, c]));

    const parentIds = [...new Set(cats.map((c) => c.parentId).filter((id): id is number => id !== null))];
    const parents = parentIds.length > 0 ? await db.select().from(skillCategories).where(inArray(skillCategories.id, parentIds)) : [];
    const parentMap = Object.fromEntries(parents.map((p) => [p.id, p.name]));

    const rfpIds = rows.map((r) => r.rfps.id);
    const responseCounts =
      rfpIds.length > 0
        ? await db
            .select({ rfpId: rfpResponses.rfpId, cnt: count() })
            .from(rfpResponses)
            .where(inArray(rfpResponses.rfpId, rfpIds))
            .groupBy(rfpResponses.rfpId)
        : [];
    const responseCountMap = Object.fromEntries(responseCounts.map((r) => [r.rfpId, r.cnt]));

    const items = rows.map(({ rfps: r, users: u }) => {
      const cat = catMap[r.skillCategoryId];
      return {
        id: r.id,
        title: r.title,
        skillCategoryId: r.skillCategoryId,
        skillCategoryName: cat?.name ?? "",
        skillCategoryParentName: cat?.parentId ? (parentMap[cat.parentId] ?? null) : null,
        budgetMinCents: r.budgetMinCents,
        budgetMaxCents: r.budgetMaxCents,
        hoursNeeded: r.hoursNeeded,
        deadline: r.deadline,
        status: r.status,
        buyerId: r.buyerId,
        buyerDisplayName: u.displayName,
        responseCount: responseCountMap[r.id] ?? 0,
        createdAt: r.createdAt.toISOString(),
      };
    });

    res.json({ items, total: Number(total), limit, offset });
  } catch (err) {
    req.log.error({ err }, "listRfps error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /rfps
router.post("/rfps", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const parsed = CreateRfpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  try {
    const [buyer] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!buyer) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const body = parsed.data;
    const [created] = await db
      .insert(rfps)
      .values({
        buyerId: buyer.id,
        skillCategoryId: body.skillCategoryId,
        title: body.title,
        description: body.description,
        budgetMinCents: body.budgetMinCents,
        budgetMaxCents: body.budgetMaxCents,
        hoursNeeded: body.hoursNeeded,
        deadline: toDateStr(body.deadline)!,
      })
      .returning();

    const detail = await buildRfpDetail(created.id);
    res.status(201).json(detail);
  } catch (err) {
    req.log.error({ err }, "createRfp error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /rfps/:rfpId
router.get("/rfps/:rfpId", async (req, res) => {
  const id = Number(req.params.rfpId);
  if (!id) {
    res.status(400).json({ error: "Invalid rfp id" });
    return;
  }
  try {
    const detail = await buildRfpDetail(id);
    if (!detail) {
      res.status(404).json({ error: "RFP not found" });
      return;
    }
    res.json(detail);
  } catch (err) {
    req.log.error({ err }, "getRfp error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /rfps/:rfpId/responses
router.post("/rfps/:rfpId/responses", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const id = Number(req.params.rfpId);
  if (!id) {
    res.status(400).json({ error: "Invalid rfp id" });
    return;
  }
  const parsed = RespondToRfpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  try {
    const [professional] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!professional) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const [rfp] = await db.select().from(rfps).where(eq(rfps.id, id)).limit(1);
    if (!rfp) {
      res.status(404).json({ error: "RFP not found" });
      return;
    }
    if (rfp.status !== "open") {
      res.status(400).json({ error: "RFP is not accepting responses" });
      return;
    }
    if (rfp.buyerId === professional.id) {
      res.status(400).json({ error: "Cannot respond to your own RFP" });
      return;
    }

    const existing = await db.select().from(rfpResponses).where(and(eq(rfpResponses.rfpId, id), eq(rfpResponses.professionalId, professional.id))).limit(1);
    let response;
    if (existing.length > 0) {
      const [updated] = await db
        .update(rfpResponses)
        .set({ proposedRateCents: parsed.data.proposedRateCents, message: parsed.data.message, updatedAt: new Date() })
        .where(eq(rfpResponses.id, existing[0].id))
        .returning();
      response = updated;
    } else {
      const [created] = await db
        .insert(rfpResponses)
        .values({ rfpId: id, professionalId: professional.id, proposedRateCents: parsed.data.proposedRateCents, message: parsed.data.message })
        .returning();
      response = created;
    }

    res.status(201).json({
      id: response.id,
      rfpId: response.rfpId,
      professionalId: response.professionalId,
      professionalDisplayName: professional.displayName,
      professionalClerkId: professional.clerkId,
      proposedRateCents: response.proposedRateCents,
      message: response.message,
      status: response.status,
      createdAt: response.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "respondToRfp error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
