import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  date,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { timeListings } from "./marketplace";
import { skillCategories } from "./skillCategories";

export const secondaryListingStatusEnum = ["open", "sold", "cancelled"] as const;
export type SecondaryListingStatus = (typeof secondaryListingStatusEnum)[number];

export const optionStatusEnum = ["open", "purchased", "exercised", "expired", "cancelled"] as const;
export type OptionStatus = (typeof optionStatusEnum)[number];

export const swapStatusEnum = ["proposed", "accepted", "declined", "completed", "cancelled"] as const;
export type SwapStatus = (typeof swapStatusEnum)[number];

export const bundleStatusEnum = ["open", "sold", "cancelled"] as const;
export type BundleStatus = (typeof bundleStatusEnum)[number];

export const secondaryListings = pgTable(
  "secondary_listings",
  {
    id: serial("id").primaryKey(),
    originalListingId: integer("original_listing_id")
      .notNull()
      .references(() => timeListings.id, { onDelete: "cascade" }),
    sellerId: integer("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    buyerId: integer("buyer_id").references(() => users.id),
    askPriceCents: integer("ask_price_cents").notNull(),
    status: text("status", { enum: secondaryListingStatusEnum }).notNull().default("open"),
    listedAt: timestamp("listed_at", { withTimezone: true }).notNull().defaultNow(),
    soldAt: timestamp("sold_at", { withTimezone: true }),
  },
  (table) => ({
    sellerIdx: index("secondary_listings_seller_idx").on(table.sellerId),
    originalIdx: index("secondary_listings_original_idx").on(table.originalListingId),
    statusIdx: index("secondary_listings_status_idx").on(table.status),
  }),
);

export const timeOptions = pgTable(
  "time_options",
  {
    id: serial("id").primaryKey(),
    professionalId: integer("professional_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skillCategoryId: integer("skill_category_id")
      .notNull()
      .references(() => skillCategories.id),
    hours: integer("hours").notNull(),
    windowStart: date("window_start").notNull(),
    windowEnd: date("window_end").notNull(),
    premiumCents: integer("premium_cents").notNull(),
    fullRateCents: integer("full_rate_cents").notNull(),
    holderId: integer("holder_id").references(() => users.id),
    status: text("status", { enum: optionStatusEnum }).notNull().default("open"),
    exercisedAt: timestamp("exercised_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    professionalIdx: index("time_options_professional_idx").on(table.professionalId),
    skillCategoryIdx: index("time_options_skill_category_idx").on(table.skillCategoryId),
    statusIdx: index("time_options_status_idx").on(table.status),
    holderIdx: index("time_options_holder_idx").on(table.holderId),
  }),
);

export const timeSwaps = pgTable(
  "time_swaps",
  {
    id: serial("id").primaryKey(),
    proposerId: integer("proposer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    counterpartyId: integer("counterparty_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    proposerListingId: integer("proposer_listing_id")
      .notNull()
      .references(() => timeListings.id),
    counterpartyListingId: integer("counterparty_listing_id").references(() => timeListings.id),
    proposerHours: integer("proposer_hours").notNull(),
    counterpartyHours: integer("counterparty_hours").notNull(),
    proposerSkillCategoryId: integer("proposer_skill_category_id")
      .notNull()
      .references(() => skillCategories.id),
    counterpartySkillCategoryId: integer("counterparty_skill_category_id")
      .notNull()
      .references(() => skillCategories.id),
    note: text("note"),
    status: text("status", { enum: swapStatusEnum }).notNull().default("proposed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    proposerIdx: index("time_swaps_proposer_idx").on(table.proposerId),
    counterpartyIdx: index("time_swaps_counterparty_idx").on(table.counterpartyId),
    statusIdx: index("time_swaps_status_idx").on(table.status),
  }),
);

export const bundles = pgTable(
  "bundles",
  {
    id: serial("id").primaryKey(),
    creatorId: integer("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    buyerId: integer("buyer_id").references(() => users.id),
    title: text("title").notNull(),
    description: text("description"),
    totalPriceCents: integer("total_price_cents").notNull(),
    status: text("status", { enum: bundleStatusEnum }).notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    creatorIdx: index("bundles_creator_idx").on(table.creatorId),
    statusIdx: index("bundles_status_idx").on(table.status),
  }),
);

export const bundleItems = pgTable(
  "bundle_items",
  {
    id: serial("id").primaryKey(),
    bundleId: integer("bundle_id")
      .notNull()
      .references(() => bundles.id, { onDelete: "cascade" }),
    listingId: integer("listing_id")
      .notNull()
      .references(() => timeListings.id),
    professionalId: integer("professional_id")
      .notNull()
      .references(() => users.id),
    hours: integer("hours").notNull(),
  },
  (table) => ({
    bundleIdx: index("bundle_items_bundle_idx").on(table.bundleId),
    listingIdx: index("bundle_items_listing_idx").on(table.listingId),
  }),
);

export const derivativeTradeTypeEnum = [
  "secondary_purchase",
  "option_purchase",
  "option_exercise",
  "swap_completion",
  "bundle_purchase",
] as const;
export type DerivativeTradeType = (typeof derivativeTradeTypeEnum)[number];

export const derivativeTrades = pgTable(
  "derivative_trades",
  {
    id: serial("id").primaryKey(),
    tradeType: text("trade_type", { enum: derivativeTradeTypeEnum }).notNull(),
    skillCategoryId: integer("skill_category_id")
      .notNull()
      .references(() => skillCategories.id),
    rateCents: integer("rate_cents").notNull(),
    volumeHours: integer("volume_hours").notNull(),
    buyerId: integer("buyer_id").references(() => users.id),
    sellerId: integer("seller_id").references(() => users.id),
    refId: integer("ref_id"),
    tradedAt: timestamp("traded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    skillCategoryIdx: index("derivative_trades_skill_category_idx").on(table.skillCategoryId),
    tradeTypeIdx: index("derivative_trades_type_idx").on(table.tradeType),
    tradedAtIdx: index("derivative_trades_traded_at_idx").on(table.tradedAt),
  }),
);

export type SecondaryListing = typeof secondaryListings.$inferSelect;
export type TimeOption = typeof timeOptions.$inferSelect;
export type TimeSwap = typeof timeSwaps.$inferSelect;
export type Bundle = typeof bundles.$inferSelect;
export type BundleItem = typeof bundleItems.$inferSelect;
export type DerivativeTrade = typeof derivativeTrades.$inferSelect;
