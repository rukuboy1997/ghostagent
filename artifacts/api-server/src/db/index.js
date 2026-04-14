import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
const { Pool } = pg;

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "POSTGRES_URL or DATABASE_URL must be set. Did you forget to configure a database?"
  );
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("neon.tech") ? { rejectUnauthorized: false } : false
});
const db = drizzle(pool, { schema });
export * from "./schema";
export {
  db,
  pool
};
