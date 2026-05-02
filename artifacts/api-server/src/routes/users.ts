import { Router } from "express";
import { db } from "@workspace/db";
import { users, skillCategories, professionalSkills } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { eq, inArray } from "drizzle-orm";
import {
  UpsertMyProfileBody,
  GetPublicProfileParams,
  UpdateMySkillsBody,
} from "@workspace/api-zod";

const router = Router();

// GET /users/me
router.get("/users/me", requireAuth, async (req, res) => {
  const clerkId = (req as any).clerkUserId as string;
  try {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json(user);
  } catch (err) {
    req.log.error({ err }, "getMyProfile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /users/me
router.put("/users/me", requireAuth, async (req, res) => {
  const clerkId = (req as any).clerkUserId as string;
  const parsed = UpsertMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const body = parsed.data;
  try {
    const existing = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (existing.length === 0) {
      const [created] = await db
        .insert(users)
        .values({
          clerkId,
          displayName: body.displayName,
          bio: body.bio ?? null,
          timezone: body.timezone ?? null,
          experienceLevel: body.experienceLevel,
          hourlyRateBaselineCents: body.hourlyRateBaselineCents ?? null,
          isOnboarded: true,
        })
        .returning();
      res.json(created);
    } else {
      const [updated] = await db
        .update(users)
        .set({
          displayName: body.displayName,
          bio: body.bio ?? null,
          timezone: body.timezone ?? null,
          experienceLevel: body.experienceLevel,
          hourlyRateBaselineCents: body.hourlyRateBaselineCents ?? null,
          isOnboarded: true,
          updatedAt: new Date(),
        })
        .where(eq(users.clerkId, clerkId))
        .returning();
      res.json(updated);
    }
  } catch (err) {
    req.log.error({ err }, "upsertMyProfile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /users/:userId (public profile)
router.get("/users/:userId", async (req, res) => {
  const params = GetPublicProfileParams.safeParse({ userId: req.params.userId });
  if (!params.success) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, params.data.userId))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    // Get skills
    const userSkills = await db
      .select({
        id: skillCategories.id,
        name: skillCategories.name,
        slug: skillCategories.slug,
        parentId: skillCategories.parentId,
        children: skillCategories.id, // placeholder, resolved below
      })
      .from(professionalSkills)
      .innerJoin(skillCategories, eq(professionalSkills.skillCategoryId, skillCategories.id))
      .where(eq(professionalSkills.userId, user.id));

    res.json({
      ...user,
      skills: userSkills.map((s) => ({ ...s, children: [] })),
    });
  } catch (err) {
    req.log.error({ err }, "getPublicProfile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /users/me/skills
router.get("/users/me/skills", requireAuth, async (req, res) => {
  const clerkId = (req as any).clerkUserId as string;
  try {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) {
      res.json([]);
      return;
    }
    const skills = await db
      .select({
        skillCategoryId: skillCategories.id,
        skillCategoryName: skillCategories.name,
        parentId: skillCategories.parentId,
      })
      .from(professionalSkills)
      .innerJoin(skillCategories, eq(professionalSkills.skillCategoryId, skillCategories.id))
      .where(eq(professionalSkills.userId, user.id));

    // Resolve parent names
    const parentIds = skills.map((s) => s.parentId).filter((id): id is number => id !== null);
    let parentMap: Record<number, string> = {};
    if (parentIds.length > 0) {
      const parents = await db
        .select({ id: skillCategories.id, name: skillCategories.name })
        .from(skillCategories)
        .where(inArray(skillCategories.id, parentIds));
      parentMap = Object.fromEntries(parents.map((p) => [p.id, p.name]));
    }

    res.json(
      skills.map((s) => ({
        skillCategoryId: s.skillCategoryId,
        skillCategoryName: s.skillCategoryName,
        parentName: s.parentId ? (parentMap[s.parentId] ?? null) : null,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "getMySkills error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /users/me/skills
router.put("/users/me/skills", requireAuth, async (req, res) => {
  const clerkId = (req as any).clerkUserId as string;
  const parsed = UpdateMySkillsBody.safeParse(req.body);
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
    // Delete old skills and insert new
    await db.delete(professionalSkills).where(eq(professionalSkills.userId, user.id));
    if (parsed.data.skillCategoryIds.length > 0) {
      await db.insert(professionalSkills).values(
        parsed.data.skillCategoryIds.map((id) => ({
          userId: user.id,
          skillCategoryId: id,
        }))
      );
    }
    // Return updated skills
    const skills = await db
      .select({
        skillCategoryId: skillCategories.id,
        skillCategoryName: skillCategories.name,
        parentId: skillCategories.parentId,
      })
      .from(professionalSkills)
      .innerJoin(skillCategories, eq(professionalSkills.skillCategoryId, skillCategories.id))
      .where(eq(professionalSkills.userId, user.id));

    const parentIds = skills.map((s) => s.parentId).filter((id): id is number => id !== null);
    let parentMap: Record<number, string> = {};
    if (parentIds.length > 0) {
      const parents = await db
        .select({ id: skillCategories.id, name: skillCategories.name })
        .from(skillCategories)
        .where(inArray(skillCategories.id, parentIds));
      parentMap = Object.fromEntries(parents.map((p) => [p.id, p.name]));
    }

    res.json(
      skills.map((s) => ({
        skillCategoryId: s.skillCategoryId,
        skillCategoryName: s.skillCategoryName,
        parentName: s.parentId ? (parentMap[s.parentId] ?? null) : null,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "updateMySkills error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
