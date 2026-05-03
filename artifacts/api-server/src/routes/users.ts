import { Router } from "express";
import {
  db,
  users,
  professionalProfiles,
  skillCategories,
  professionalSkills,
  type User,
  type ProfessionalProfile,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { eq, inArray } from "drizzle-orm";
import {
  UpsertMyProfileBody,
  GetPublicProfileParams,
  UpdateMySkillsBody,
} from "@workspace/api-zod";

const router = Router();

type ProfileResponse = {
  id: number;
  clerkId: string;
  displayName: string;
  bio: string | null;
  timezone: string | null;
  experienceLevel: ProfessionalProfile["experienceLevel"];
  hourlyRateBaselineCents: number | null;
  isOnboarded: boolean;
  createdAt: string;
  updatedAt: string;
};

function flattenProfile(user: User, profile: ProfessionalProfile | null): ProfileResponse {
  return {
    id: user.id,
    clerkId: user.clerkId,
    displayName: user.displayName,
    bio: profile?.bio ?? null,
    timezone: profile?.timezone ?? null,
    experienceLevel: profile?.experienceLevel ?? "mid",
    hourlyRateBaselineCents: profile?.hourlyRateBaselineCents ?? null,
    isOnboarded: profile?.isOnboarded ?? false,
    createdAt: user.createdAt.toISOString(),
    updatedAt: (profile?.updatedAt ?? user.createdAt).toISOString(),
  };
}

async function loadUserAndProfile(clerkId: string): Promise<{ user: User; profile: ProfessionalProfile | null } | null> {
  const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!user) return null;
  const [profile] = await db
    .select()
    .from(professionalProfiles)
    .where(eq(professionalProfiles.userId, user.id))
    .limit(1);
  return { user, profile: profile ?? null };
}

// GET /users/me — auto-creates a minimal user row on first access so we always return 200
router.get("/users/me", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  try {
    let found = await loadUserAndProfile(clerkId);
    if (!found) {
      const [newUser] = await db
        .insert(users)
        .values({ clerkId, displayName: "" })
        .returning();
      found = { user: newUser, profile: null };
    }
    res.json(flattenProfile(found.user, found.profile));
  } catch (err) {
    req.log.error({ err }, "getMyProfile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /users/me
router.put("/users/me", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  const parsed = UpsertMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const body = parsed.data;
  try {
    const existingUser = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    let user: User;
    if (existingUser.length === 0) {
      const [created] = await db
        .insert(users)
        .values({ clerkId, displayName: body.displayName })
        .returning();
      user = created;
    } else {
      const [updated] = await db
        .update(users)
        .set({ displayName: body.displayName })
        .where(eq(users.clerkId, clerkId))
        .returning();
      user = updated;
    }

    const profileValues = {
      userId: user.id,
      bio: body.bio ?? null,
      timezone: body.timezone ?? null,
      experienceLevel: body.experienceLevel,
      hourlyRateBaselineCents: body.hourlyRateBaselineCents ?? null,
      isOnboarded: true,
      updatedAt: new Date(),
    };

    const [profile] = await db
      .insert(professionalProfiles)
      .values(profileValues)
      .onConflictDoUpdate({
        target: professionalProfiles.userId,
        set: {
          bio: profileValues.bio,
          timezone: profileValues.timezone,
          experienceLevel: profileValues.experienceLevel,
          hourlyRateBaselineCents: profileValues.hourlyRateBaselineCents,
          isOnboarded: profileValues.isOnboarded,
          updatedAt: profileValues.updatedAt,
        },
      })
      .returning();

    res.json(flattenProfile(user, profile));
  } catch (err) {
    req.log.error({ err }, "upsertMyProfile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /users/:userId (public profile) — userId is the Clerk ID
router.get("/users/:userId", async (req, res) => {
  const params = GetPublicProfileParams.safeParse({ userId: req.params.userId });
  if (!params.success) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }
  try {
    const found = await loadUserAndProfile(params.data.userId);
    if (!found) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    const { user, profile } = found;

    // Selected skill categories (children) for this user
    const selected = await db
      .select({
        id: skillCategories.id,
        name: skillCategories.name,
        slug: skillCategories.slug,
        parentId: skillCategories.parentId,
      })
      .from(professionalSkills)
      .innerJoin(skillCategories, eq(professionalSkills.skillCategoryId, skillCategories.id))
      .where(eq(professionalSkills.userId, user.id));

    // Group selected children under their parent categories
    const parentIds = Array.from(
      new Set(selected.map((s) => s.parentId).filter((id): id is number => id !== null)),
    );

    const parents =
      parentIds.length > 0
        ? await db
            .select({
              id: skillCategories.id,
              name: skillCategories.name,
              slug: skillCategories.slug,
              parentId: skillCategories.parentId,
            })
            .from(skillCategories)
            .where(inArray(skillCategories.id, parentIds))
        : [];

    const groupedSkills = parents.map((parent) => ({
      ...parent,
      children: selected.filter((c) => c.parentId === parent.id),
    }));

    // Include any selected top-level (no parent) categories as standalone groups
    for (const s of selected) {
      if (s.parentId === null) {
        groupedSkills.push({ ...s, children: [] });
      }
    }

    const flat = flattenProfile(user, profile);
    res.json({
      id: flat.id,
      clerkId: flat.clerkId,
      displayName: flat.displayName,
      bio: flat.bio,
      timezone: flat.timezone,
      experienceLevel: flat.experienceLevel,
      hourlyRateBaselineCents: flat.hourlyRateBaselineCents,
      skills: groupedSkills,
    });
  } catch (err) {
    req.log.error({ err }, "getPublicProfile error");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function loadUserSkills(userId: number) {
  const skills = await db
    .select({
      skillCategoryId: skillCategories.id,
      skillCategoryName: skillCategories.name,
      parentId: skillCategories.parentId,
    })
    .from(professionalSkills)
    .innerJoin(skillCategories, eq(professionalSkills.skillCategoryId, skillCategories.id))
    .where(eq(professionalSkills.userId, userId));

  const parentIds = skills.map((s) => s.parentId).filter((id): id is number => id !== null);
  let parentMap: Record<number, string> = {};
  if (parentIds.length > 0) {
    const parents = await db
      .select({ id: skillCategories.id, name: skillCategories.name })
      .from(skillCategories)
      .where(inArray(skillCategories.id, parentIds));
    parentMap = Object.fromEntries(parents.map((p) => [p.id, p.name]));
  }

  return skills.map((s) => ({
    skillCategoryId: s.skillCategoryId,
    skillCategoryName: s.skillCategoryName,
    parentName: s.parentId ? (parentMap[s.parentId] ?? null) : null,
  }));
}

// GET /users/me/skills
router.get("/users/me/skills", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
  try {
    const [user] = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (!user) {
      res.json([]);
      return;
    }
    res.json(await loadUserSkills(user.id));
  } catch (err) {
    req.log.error({ err }, "getMySkills error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /users/me/skills
router.put("/users/me/skills", requireAuth, async (req, res) => {
  const clerkId = req.clerkUserId!;
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
    await db.delete(professionalSkills).where(eq(professionalSkills.userId, user.id));
    const uniqueIds = Array.from(new Set(parsed.data.skillCategoryIds));
    if (uniqueIds.length > 0) {
      await db.insert(professionalSkills).values(
        uniqueIds.map((id) => ({
          userId: user.id,
          skillCategoryId: id,
        })),
      );
    }
    res.json(await loadUserSkills(user.id));
  } catch (err) {
    req.log.error({ err }, "updateMySkills error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
