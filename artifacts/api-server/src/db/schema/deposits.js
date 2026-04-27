import { pgTable, serial, integer, varchar, decimal, timestamp, text } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const deposits = pgTable("deposits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  currency: varchar("currency", { length: 10 }).notNull(),
  amountUsd: decimal("amount_usd", { precision: 18, scale: 8 }),
  type: varchar("type", { length: 30 }).notNull().default("deposit"),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  flutterwaveTxRef: varchar("flutterwave_tx_ref", { length: 255 }),
  flutterwaveTxId: varchar("flutterwave_tx_id", { length: 255 }),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
