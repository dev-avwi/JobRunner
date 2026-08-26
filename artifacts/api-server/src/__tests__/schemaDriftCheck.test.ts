/**
 * Schema drift check — catches columns that exist in the Drizzle schema but
 * are missing from the live database table.
 *
 * Why this matters:
 *   The receipt_url and sent_at columns were missing from purchase_orders in
 *   production while being present in the schema, causing 500 errors on every
 *   request that touched those columns.  This test catches that class of
 *   problem before deployment.
 *
 * How it works:
 *   1. Extract the expected column names from the Drizzle table definitions
 *      (lib/db/src/schema/schema.ts) using drizzle-orm's getTableColumns().
 *   2. Query information_schema.columns for each key table in the live DB.
 *   3. Fail with a descriptive error for every column that is declared in the
 *      schema but absent from the database.
 *
 * When to run:
 *   This test intentionally does NOT run as part of the regular unit-test
 *   suite (pnpm test) because the dev database may legitimately be behind the
 *   schema while startup migrations are pending.  Run it pre-deployment or in
 *   CI by setting the SCHEMA_DRIFT_CHECK env var:
 *
 *     SCHEMA_DRIFT_CHECK=1 pnpm --filter @workspace/api-server test \
 *       --run src/__tests__/schemaDriftCheck.test.ts
 *
 *   The test is also skipped automatically when neither DATABASE_URL nor
 *   NEON_DATABASE_URL is available.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import pg from "pg";

// ── Schema imports ────────────────────────────────────────────────────────────
// Import from "@workspace/db/schema" (not "@workspace/db") to get the Drizzle
// table definitions WITHOUT triggering the lib/db/src/index.ts boot guard that
// throws when DATABASE_URL is absent.  The "/schema" export path is declared in
// lib/db/package.json and resolves to lib/db/src/schema/index.ts.
import {
  purchaseOrders,
  purchaseOrderItems,
  jobs,
  jobPhases,
  jobPhaseAssignments,
  invoices,
  invoiceLineItems,
  quotes,
  expenses,
  timeEntries,
  teamMembers,
  businessSettings,
  clients,
  users,
  notifications,
} from "@workspace/db/schema";

// ── Tables under test ─────────────────────────────────────────────────────────
// Add new tables here whenever a schema addition lands so that the drift check
// covers them automatically going forward.
const KEY_TABLES = [
  purchaseOrders,
  purchaseOrderItems,
  jobs,
  jobPhases,
  jobPhaseAssignments,
  invoices,
  invoiceLineItems,
  quotes,
  expenses,
  timeEntries,
  teamMembers,
  businessSettings,
  clients,
  users,
  notifications,
] as const;

// ── DB connection ─────────────────────────────────────────────────────────────

// Gate: only run against a live database when SCHEMA_DRIFT_CHECK=1.
// The dev database may legitimately be behind the schema while the server's
// startup migration runner hasn't fired yet; running this check unconditionally
// would break the regular unit-test suite.
const ENABLED = process.env.SCHEMA_DRIFT_CHECK === "1";

const dbUrl =
  process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || "";

/**
 * Returns the SQL table name for a Drizzle table object.
 * Drizzle stores it at table[Symbol.for("drizzle:Name")].
 */
function getTableName(table: (typeof KEY_TABLES)[number]): string {
  // drizzle-orm ≥0.29 stores the table name under this symbol
  return (table as unknown as Record<symbol, string>)[
    Symbol.for("drizzle:Name")
  ] as string;
}

/**
 * Returns the set of SQL column names declared in the Drizzle table definition.
 */
function schemaColumnNames(
  table: (typeof KEY_TABLES)[number],
): Set<string> {
  const cols = getTableColumns(table as Parameters<typeof getTableColumns>[0]);
  return new Set(Object.values(cols).map((c) => c.name));
}

// ── Test suite ────────────────────────────────────────────────────────────────

const { Pool } = pg;

describe("schema drift check", () => {
  let pool: InstanceType<typeof Pool> | null = null;

  beforeAll(async () => {
    if (!dbUrl) {
      return; // tests will be skipped individually below
    }
    pool = new Pool({ connectionString: dbUrl });
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  for (const table of KEY_TABLES) {
    const tableName = getTableName(table);

    it(`${tableName}: all schema columns exist in the database`, async () => {
      if (!ENABLED) {
        // Not a failure — this check is intentionally opt-in.  Set
        // SCHEMA_DRIFT_CHECK=1 to run it pre-deployment.
        return;
      }
      if (!dbUrl) {
        console.warn(
          `[schema-drift] Skipping ${tableName}: no DATABASE_URL / NEON_DATABASE_URL`,
        );
        return;
      }

      const client = await pool!.connect();
      let dbColumns: Set<string>;

      try {
        const result = await client.query<{ column_name: string }>(
          `SELECT column_name
             FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name   = $1`,
          [tableName],
        );

        if (result.rows.length === 0) {
          throw new Error(
            `Table "${tableName}" was not found in the database at all. ` +
              `Run the startup migration to create it.`,
          );
        }

        dbColumns = new Set(result.rows.map((r) => r.column_name));
      } finally {
        client.release();
      }

      const expected = schemaColumnNames(table);
      const missing: string[] = [];

      for (const col of expected) {
        if (!dbColumns.has(col)) {
          missing.push(col);
        }
      }

      if (missing.length > 0) {
        // Surface a clear, actionable error message that names every missing
        // column so the developer knows exactly which ALTER TABLE to write.
        const fixes = missing
          .map((c) => `  ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${c} <type>;`)
          .join("\n");

        throw new Error(
          `Schema drift detected in "${tableName}".\n` +
            `The following column(s) are declared in the Drizzle schema but ` +
            `missing from the live database:\n` +
            missing.map((c) => `  • ${c}`).join("\n") +
            `\n\nAdd them to the migration list in storage.ts, for example:\n` +
            fixes,
        );
      }

      // All declared columns are present — pass.
      expect(missing).toHaveLength(0);
    });
  }
});
