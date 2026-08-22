import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { db, pool } from "@workspace/db";

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(artifactDir, "../../../lib/db/drizzle");
// The migration ledger did not exist before phase-team assignments. The two
// later migrations are idempotent ALTERs, so legacy databases safely receive
// both retention and compliance columns on their first tracked migration run.
const legacySchemaBaseline = 1787200000000;

try {
  // This application predates Drizzle's migration ledger. Existing databases
  // already contain the legacy schema, so mark the latest historical migration
  // as the baseline once, then let Drizzle apply every later journaled change.
  await pool.query('CREATE SCHEMA IF NOT EXISTS drizzle');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);
  const [{ count: appliedCount }] = (await pool.query<{ count: string }>(
    'SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations',
  )).rows;
  const [{ usersTable }] = (await pool.query<{ usersTable: string | null }>(
    "SELECT to_regclass('public.users') AS \"usersTable\"",
  )).rows;
  if (appliedCount === '0' && usersTable) {
    const migrations = readMigrationFiles({ migrationsFolder });
    const latestLegacyMigration = migrations.find(
      (migration) => migration.folderMillis === legacySchemaBaseline,
    );
    if (latestLegacyMigration) {
      await pool.query(
        'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
        [latestLegacyMigration.hash, latestLegacyMigration.folderMillis],
      );
      console.log('[Database] Baseline legacy schema recorded for Drizzle migrations');
    }
  }
  await migrate(db, { migrationsFolder });
  console.log("[Database] Drizzle migrations applied");
} finally {
  await pool.end();
}