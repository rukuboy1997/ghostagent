import { pgTable, serial, integer, varchar, decimal, timestamp, text, boolean, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const trades = pgTable("_trading_trades", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  symbol: varchar("symbol", { length: 50 }).notNull(),
  type: varchar("type", { length: 10 }).notNull(),
  volume: decimal("volume", { precision: 18, scale: 8 }).notNull(),
  openPrice: decimal("open_price", { precision: 18, scale: 8 }),
  closePrice: decimal("close_price", { precision: 18, scale: 8 }),
  profit: decimal("profit", { precision: 18, scale: 8 }),
  userProfit: decimal("user_profit", { precision: 18, scale: 8 }),
  ghostShare: decimal("ghost_share", { precision: 18, scale: 8 }),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  mt5TicketId: varchar("mt5_ticket_id", { length: 100 }),
  aiReasoning: text("ai_reasoning"),
  aiConfidence: decimal("ai_confidence", { precision: 5, scale: 2 }),
  forecastData: jsonb("forecast_data"),
  shareSettled: boolean("share_settled").notNull().default(false),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
