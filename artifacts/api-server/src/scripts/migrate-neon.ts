/**
 * One-shot migration runner: applies all storage.ts startup DDL against
 * NEON_DATABASE_URL (the database the schema-drift-check validates).
 *
 * Run with:
 *   cd artifacts/api-server
 *   NEON_DATABASE_URL=<url> npx tsx src/scripts/migrate-neon.ts
 *
 * In the Replit workspace the env var is already set, so just:
 *   cd artifacts/api-server && npx tsx src/scripts/migrate-neon.ts
 */

import "dotenv/config";

const neonUrl = process.env.NEON_DATABASE_URL;
if (!neonUrl) {
  console.error("NEON_DATABASE_URL is not set — nothing to migrate.");
  process.exit(1);
}

// Redirect DATABASE_URL → NEON before importing storage.ts so every pool.query
// call in that module runs against the NEON database.
process.env.DATABASE_URL = neonUrl;

console.log("[migrate-neon] Connecting to NEON database …");
console.log("[migrate-neon] Running all storage.ts startup migrations …");

// Dynamic import so the DATABASE_URL override above takes effect first.
const { pool, guidedProjectSetupSchemaReady } = await import("../storage.js");

// Wait for the synchronous guided-setup promise (the only awaitable export).
await guidedProjectSetupSchemaReady;
console.log("[migrate-neon] guidedProjectSetupSchemaReady — done.");

// Fire-and-forget migrations run in parallel at module load.  Give them
// generous time to settle before we close the pool.
console.log("[migrate-neon] Waiting 8s for fire-and-forget migrations …");
await new Promise((resolve) => setTimeout(resolve, 8000));

await pool.end();
console.log("[migrate-neon] All migrations applied. Pool closed.");
