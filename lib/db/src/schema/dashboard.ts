import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { timeListings } from "./marketplace";

export const disputeStatusEnum = ["open", "under_review", "resolved_professional", "resolved_buyer", "withdrawn"] as const;
export type DisputeStatus = (typeof disputeStatusEnum)[number];

export const notificationTypeEnum = [
  "new_bid",
  "bid_accepted",
  "delivery_logged",
  "delivery_confirmed",
  "payment_released",
  "contract_expiring",
  "dispute_opened",
  "dispute_resolved",
] as const;
export type NotificationType = (typeof notificationTypeEnum)[number];

export const deliveryLogs = pgTable(
  "delivery_logs",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => timeListings.id, { onDelete: "cascade" }),
    professionalId: integer("professional_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    hoursLogged: integer("hours_logged").notNull(),
    note: text("note"),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    listingIdx: index("delivery_logs_listing_idx").on(table.listingId),
    professionalIdx: index("delivery_logs_professional_idx").on(table.professionalId),
  }),
);

export const deliveryConfirmations = pgTable(
  "delivery_confirmations",
  {
    id: serial("id").primaryKey(),
    deliveryLogId: integer("delivery_log_id")
      .notNull()
      .references(() => deliveryLogs.id, { onDelete: "cascade" }),
    buyerId: integer("buyer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
    disputed: boolean("disputed").notNull().default(false),
  },
  (table) => ({
    deliveryLogIdx: index("delivery_confirmations_log_idx").on(table.deliveryLogId),
    buyerIdx: index("delivery_confirmations_buyer_idx").on(table.buyerId),
  }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: notificationTypeEnum }).notNull(),
    payload: jsonb("payload").notNull().default({}),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("notifications_user_idx").on(table.userId),
    userReadIdx: index("notifications_user_read_idx").on(table.userId, table.read),
    createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
  }),
);

export const disputes = pgTable(
  "disputes",
  {
    id: serial("id").primaryKey(),
    listingId: integer("listing_id")
      .notNull()
      .references(() => timeListings.id, { onDelete: "cascade" }),
    initiatorId: integer("initiator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    status: text("status", { enum: disputeStatusEnum }).notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    listingIdx: index("disputes_listing_idx").on(table.listingId),
    initiatorIdx: index("disputes_initiator_idx").on(table.initiatorId),
    statusIdx: index("disputes_status_idx").on(table.status),
  }),
);

export type DeliveryLog = typeof deliveryLogs.$inferSelect;
export type DeliveryConfirmation = typeof deliveryConfirmations.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Dispute = typeof disputes.$inferSelect;
