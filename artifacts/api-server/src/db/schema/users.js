import { pgTable, serial, varchar, decimal, boolean, timestamp, integer } from "drizzle-orm/pg-core";

export const users = pgTable("_trading_users", {
  id:                      serial("id").primaryKey(),
  clerkId:                 varchar("clerk_id", { length: 255 }).unique().notNull(),
  email:                   varchar("email", { length: 255 }).notNull(),
  name:                    varchar("name", { length: 255 }),
  balance:                 decimal("balance", { precision: 18, scale: 8 }).notNull().default("0"),
  currency:                varchar("currency", { length: 10 }).notNull().default("USD"),
  tradingBalance:          decimal("trading_balance", { precision: 18, scale: 2 }).default("50"),
  totalTrades:             integer("total_trades").notNull().default(0),
  tradesSinceLastShare:    integer("trades_since_last_share").notNull().default(0),
  tpSignalsSinceLastShare: integer("tp_signals_since_last_share").notNull().default(0),
  totalProfit:             decimal("total_profit", { precision: 18, scale: 8 }).notNull().default("0"),
  isActive:                boolean("is_active").notNull().default(true),
  alpacaAccountId:         varchar("alpaca_account_id", { length: 255 }),
  alpacaAccountNumber:     varchar("alpaca_account_number", { length: 100 }),
  alpacaOptionsLevel:      integer("alpaca_options_level"),
  autoTradeEnabled:        boolean("auto_trade_enabled").notNull().default(false),
  // ── Auto-scan settings ──────────────────────────────────────────────────
  scanEnabled:             boolean("scan_enabled").notNull().default(false),
  scanIntervalMinutes:     integer("scan_interval_minutes").notNull().default(15),
  scanSessionFilter:       varchar("scan_session_filter", { length: 30 }).notNull().default("us_market"),
  lastScannedAt:           timestamp("last_scanned_at"),
  // ────────────────────────────────────────────────────────────────────────
  createdAt:               timestamp("created_at").notNull().defaultNow(),
  updatedAt:               timestamp("updated_at").notNull().defaultNow(),
});
