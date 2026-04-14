import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
const agentActionsTable = pgTable("agent_actions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  result: text("result"),
  txHash: text("tx_hash"),
  gasUsed: text("gas_used"),
  teeProof: text("tee_proof"),
  isPrivate: boolean("is_private").notNull().default(true),
  value: text("value"),
  storageRoot: text("storage_root"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at")
});
const insertAgentActionSchema = createInsertSchema(agentActionsTable).omit({ id: true, createdAt: true });
export {
  agentActionsTable,
  insertAgentActionSchema
};
