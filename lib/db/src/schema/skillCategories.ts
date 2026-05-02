import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const skillCategories = pgTable("skill_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  parentId: integer("parent_id"),
});

export const professionalSkills = pgTable("professional_skills", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  skillCategoryId: integer("skill_category_id").notNull().references(() => skillCategories.id, { onDelete: "cascade" }),
});

export const insertSkillCategorySchema = createInsertSchema(skillCategories).omit({ id: true });
export type InsertSkillCategory = z.infer<typeof insertSkillCategorySchema>;
export type SkillCategory = typeof skillCategories.$inferSelect;

export const insertProfessionalSkillSchema = createInsertSchema(professionalSkills).omit({ id: true });
export type InsertProfessionalSkill = z.infer<typeof insertProfessionalSkillSchema>;
export type ProfessionalSkill = typeof professionalSkills.$inferSelect;
