import { pgTable, serial, integer, text, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
const marketplaceListingsTable = pgTable("marketplace_listings", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  agentName: text("agent_name").notNull(),
  description: text("description"),
  strategy: text("strategy").notNull(),
  price: text("price").notNull(),
  reputationScore: real("reputation_score").notNull().default(0),
  successRate: real("success_rate").notNull().default(0),
  category: text("category").notNull().default("all_in_one"),
  isVerified: boolean("is_verified").notNull().default(false),
  rentals: integer("rentals").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
const insertMarketplaceSchema = createInsertSchema(marketplaceListingsTable).omit({ id: true, createdAt: true });
export {
  insertMarketplaceSchema,
  marketplaceListingsTable
};
