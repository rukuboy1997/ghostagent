import { pgTable, serial, varchar, decimal, boolean, timestamp, text, integer } from "drizzle-orm/pg-core";

export const users = pgTable("_trading_users", {
  id: serial("id").primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).unique().notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  balance: decimal("balance", { precision: 18, scale: 8 }).notNull().default("0"),
  currency: varchar("currency", { length: 10 }).notNull().default("USD"),
  tradingBalance: decimal("trading_balance", { precision: 18, scale: 2 }).default("50"),
  totalTrades: integer("total_trades").notNull().default(0),
  tradesSinceLastShare: integer("trades_since_last_share").notNull().default(0),
  tpSignalsSinceLastShare: integer("tp_signals_since_last_share").notNull().default(0),
  totalProfit: decimal("total_profit", { precision: 18, scale: 8 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  mt5Login: varchar("mt5_login", { length: 100 }),
  mt5Password: varchar("mt5_password", { length: 255 }),
  mt5Server: varchar("mt5_server", { length: 255 }),
  mt5AccountId: varchar("mt5_account_id", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
