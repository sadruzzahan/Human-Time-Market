import { Router } from "express";
import { db } from "@workspace/db";
import { skillCategories } from "@workspace/db";
import { GetSkillCategoryParams } from "@workspace/api-zod";
import { eq, isNull } from "drizzle-orm";

const router = Router();

// GET /skill-categories
router.get("/skill-categories", async (req, res) => {
  try {
    const all = await db.select().from(skillCategories);
    const parentCategories = all.filter((c) => c.parentId === null);
    const childCategories = all.filter((c) => c.parentId !== null);

    const result = parentCategories.map((parent) => ({
      ...parent,
      children: childCategories.filter((c) => c.parentId === parent.id),
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "listSkillCategories error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /skill-categories/:id
router.get("/skill-categories/:id", async (req, res) => {
  const params = GetSkillCategoryParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const [category] = await db
      .select()
      .from(skillCategories)
      .where(eq(skillCategories.id, params.data.id))
      .limit(1);
    if (!category) {
      res.status(404).json({ error: "Skill category not found" });
      return;
    }
    const children = await db
      .select()
      .from(skillCategories)
      .where(eq(skillCategories.parentId, category.id));
    res.json({ ...category, children });
  } catch (err) {
    req.log.error({ err }, "getSkillCategory error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
