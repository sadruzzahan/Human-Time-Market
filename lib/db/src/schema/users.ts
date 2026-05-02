import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const experienceLevelEnum = ["junior", "mid", "senior", "principal", "expert"] as const;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  timezone: text("timezone"),
  experienceLevel: text("experience_level", { enum: experienceLevelEnum }).notNull().default("mid"),
  hourlyRateBaselineCents: integer("hourly_rate_baseline_cents"),
  isOnboarded: boolean("is_onboarded").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
