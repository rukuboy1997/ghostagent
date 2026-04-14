import { pgTable, serial, integer, text, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
const memoryEntriesTable = pgTable("memory_entries", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  category: text("category").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  confidence: real("confidence").notNull().default(1),
  isEncrypted: boolean("is_encrypted").notNull().default(false),
  storageRoot: text("storage_root"),
  storageTx: text("storage_tx"),
  createdAt: timestamp("created_at").notNull().defaultNow()
});
const insertMemorySchema = createInsertSchema(memoryEntriesTable).omit({ id: true, createdAt: true });
export {
  insertMemorySchema,
  memoryEntriesTable
};
