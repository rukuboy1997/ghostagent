import { pgTable, serial, text, integer, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
const agentsTable = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  personality: text("personality").notNull().default("balanced"),
  status: text("status").notNull().default("idle"),
  agentId: text("agent_id").notNull(),
  reputationScore: real("reputation_score").notNull().default(0),
  totalActions: integer("total_actions").notNull().default(0),
  successRate: real("success_rate").notNull().default(0),
  capabilities: jsonb("capabilities").notNull().default([]),
  isPrivate: boolean("is_private").notNull().default(true),
  teeVerified: boolean("tee_verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
const insertAgentSchema = createInsertSchema(agentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export {
  agentsTable,
  insertAgentSchema
};
