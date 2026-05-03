import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";
import { skillCategories } from "./skillCategories";

export const listingTypeEnum = ["fixed_rate", "auction", "emergency"] as const;
export type ListingType = (typeof listingTypeEnum)[number];

export const listingStatusEnum = ["open", "in_bidding", "committed", "completed", "cancelled"] as const;
export type ListingStatus = (typeof listingStatusEnum)[number];

export const bidStatusEnum = ["pending", "accepted", "rejected", "withdrawn"] as const;
export type BidStatus = (typeof bidStatusEnum)[number];

export const rfpStatusEnum = ["open", "closed", "fulfilled"] as const;
export type RfpStatus = (typeof rfpStatusEnum)[number];

export const rfpResponseStatusEnum = ["submitted", "accepted", "rejected", "withdrawn"] as const;
export type RfpResponseStatus = (typeof rfpResponseStatusEnum)[number];

export const escrowStatusEnum = ["pending_payment", "held", "released", "refunded"] as const;
export type EscrowStatus = (typeof escrowStatusEnum)[number];

export const timeListings = pgTable(
  "time_listings",
  {
    id: serial("id").primaryKey(),
    professionalId: integer("professional_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skillCategoryId: integer("skill_category_id")
      .notNull()
      .references(() => skillCategories.id),
    title: text("title").notNull(),
    description: text("description"),
    hoursPerWeek: integer("hours_per_week").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    listingType: text("listing_type", { enum: listingTypeEnum }).notNull(),
    rateCents: integer("rate_cents").notNull(),
    status: text("status", { enum: listingStatusEnum }).notNull().default("open"),
    buyerId: integer("buyer_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    professionalIdx: index("time_listings_professional_idx").on(table.professionalId),
    skillCategoryIdx: index("time_listings_skill_category_idx").on(table.skillCategoryId),
    statusIdx: index("time_listings_status_idx").on(table.status),
    startDateIdx: index("time_listings_start_date_idx").on(table.startDate),
  }),
);

export const bids = pgTable(
  "bids",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => timeListings.id, { onDelete: "cascade" }),
    bidderId: integer("bidder_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bidRateCents: integer("bid_rate_cents").notNull(),
    message: text("message"),
    status: text("status", { enum: bidStatusEnum }).notNull().default("pending"),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    listingIdx: index("bids_listing_idx").on(table.listingId),
    bidderIdx: index("bids_bidder_idx").on(table.bidderId),
    bidderListingUnique: uniqueIndex("bids_bidder_listing_unique").on(
      table.bidderId,
      table.listingId,
    ),
  }),
);

export const rfps = pgTable(
  "rfps",
  {
    id: serial("id").primaryKey(),
    buyerId: integer("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skillCategoryId: integer("skill_category_id")
      .notNull()
      .references(() => skillCategories.id),
    title: text("title").notNull(),
    description: text("description").notNull(),
    budgetMinCents: integer("budget_min_cents").notNull(),
    budgetMaxCents: integer("budget_max_cents").notNull(),
    hoursNeeded: integer("hours_needed").notNull(),
    deadline: date("deadline").notNull(),
    status: text("status", { enum: rfpStatusEnum }).notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    buyerIdx: index("rfps_buyer_idx").on(table.buyerId),
    skillCategoryIdx: index("rfps_skill_category_idx").on(table.skillCategoryId),
    statusIdx: index("rfps_status_idx").on(table.status),
  }),
);

export const rfpResponses = pgTable(
  "rfp_responses",
  {
    id: serial("id").primaryKey(),
    rfpId: integer("rfp_id")
      .notNull()
      .references(() => rfps.id, { onDelete: "cascade" }),
    professionalId: integer("professional_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    proposedRateCents: integer("proposed_rate_cents").notNull(),
    message: text("message").notNull(),
    status: text("status", { enum: rfpResponseStatusEnum }).notNull().default("submitted"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    rfpIdx: index("rfp_responses_rfp_idx").on(table.rfpId),
    professionalIdx: index("rfp_responses_professional_idx").on(table.professionalId),
    professionalRfpUnique: uniqueIndex("rfp_responses_professional_rfp_unique").on(
      table.professionalId,
      table.rfpId,
    ),
  }),
);

export const escrowRecords = pgTable(
  "escrow_records",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .unique()
      .references(() => timeListings.id, { onDelete: "cascade" }),
    buyerId: integer("buyer_id")
      .notNull()
      .references(() => users.id),
    professionalId: integer("professional_id")
      .notNull()
      .references(() => users.id),
    amountCents: integer("amount_cents").notNull(),
    status: text("status", { enum: escrowStatusEnum }).notNull().default("pending_payment"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const insertTimeListingSchema = createInsertSchema(timeListings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  buyerId: true,
});
export type InsertTimeListing = z.infer<typeof insertTimeListingSchema>;
export type TimeListing = typeof timeListings.$inferSelect;

export const insertBidSchema = createInsertSchema(bids).omit({
  id: true,
  placedAt: true,
  updatedAt: true,
  status: true,
});
export type InsertBid = z.infer<typeof insertBidSchema>;
export type Bid = typeof bids.$inferSelect;

export const insertRfpSchema = createInsertSchema(rfps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
});
export type InsertRfp = z.infer<typeof insertRfpSchema>;
export type Rfp = typeof rfps.$inferSelect;

export const insertRfpResponseSchema = createInsertSchema(rfpResponses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
});
export type InsertRfpResponse = z.infer<typeof insertRfpResponseSchema>;
export type RfpResponse = typeof rfpResponses.$inferSelect;
