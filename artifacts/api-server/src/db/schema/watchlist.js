import { pgTable, serial, integer, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const watchlist = pgTable("_trading_watchlist", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull().references(() => users.id),
  symbol:    varchar("symbol", { length: 50 }).notNull(),
  isActive:  boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
