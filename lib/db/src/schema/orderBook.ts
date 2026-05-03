import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { skillCategories } from "./skillCategories";

export const orderTypeEnum = ["bid", "ask"] as const;
export type OrderType = (typeof orderTypeEnum)[number];

export const orderStatusEnum = [
  "open",
  "partially_filled",
  "filled",
  "cancelled",
  "expired",
] as const;
export type OrderStatus = (typeof orderStatusEnum)[number];

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderType: text("order_type", { enum: orderTypeEnum }).notNull(),
    skillCategoryId: integer("skill_category_id")
      .notNull()
      .references(() => skillCategories.id),
    rateCents: integer("rate_cents").notNull(),
    quantityHours: integer("quantity_hours").notNull(),
    filledHours: integer("filled_hours").notNull().default(0),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: orderStatusEnum }).notNull().default("open"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    skillCategoryIdx: index("orders_skill_category_idx").on(
      table.skillCategoryId,
    ),
    userIdx: index("orders_user_idx").on(table.userId),
    statusIdx: index("orders_status_idx").on(table.status),
    matchIdx: index("orders_match_idx").on(
      table.skillCategoryId,
      table.orderType,
      table.status,
    ),
  }),
);

export const trades = pgTable(
  "trades",
  {
    id: serial("id").primaryKey(),
    bidOrderId: integer("bid_order_id")
      .notNull()
      .references(() => orders.id),
    askOrderId: integer("ask_order_id")
      .notNull()
      .references(() => orders.id),
    skillCategoryId: integer("skill_category_id")
      .notNull()
      .references(() => skillCategories.id),
    matchedRateCents: integer("matched_rate_cents").notNull(),
    quantityHours: integer("quantity_hours").notNull(),
    matchedAt: timestamp("matched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    skillCategoryIdx: index("trades_skill_category_idx").on(
      table.skillCategoryId,
    ),
    matchedAtIdx: index("trades_matched_at_idx").on(table.matchedAt),
    bidOrderIdx: index("trades_bid_order_idx").on(table.bidOrderId),
    askOrderIdx: index("trades_ask_order_idx").on(table.askOrderId),
  }),
);

export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    id: serial("id").primaryKey(),
    skillCategoryId: integer("skill_category_id")
      .notNull()
      .references(() => skillCategories.id),
    vwapCents: integer("vwap_cents").notNull(),
    volumeHours: integer("volume_hours").notNull(),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    skillCategoryIdx: index("price_snapshots_skill_category_idx").on(
      table.skillCategoryId,
    ),
    snapshotAtIdx: index("price_snapshots_snapshot_at_idx").on(
      table.snapshotAt,
    ),
  }),
);

export type Order = typeof orders.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type PriceSnapshot = typeof priceSnapshots.$inferSelect;
