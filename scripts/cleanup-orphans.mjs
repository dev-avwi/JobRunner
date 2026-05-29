// Deletes orphaned rows (children pointing to deleted parents) so that the
// foreign keys declared in shared/schema.ts can be created by drizzle-kit push.
// Safe + idempotent: a no-op once the cascade FKs exist. Runs in the deploy
// build BEFORE `drizzle-kit push --force` so production can adopt the FKs.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "cleanup-orphans.sql"), "utf8");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  console.log("[cleanup-orphans] removing orphaned rows before schema push...");
  await pool.query(sql);
  console.log("[cleanup-orphans] done");
} catch (err) {
  console.error("[cleanup-orphans] failed:", err);
  process.exit(1);
} finally {
  await pool.end();
}
