/**
 * Schema drift check — catches columns that exist in the Drizzle schema but
 * are missing from the live database table, AND columns that exist in the live
 * database but are absent from the Drizzle schema definition.
 *
 * Why this matters:
 *   Forward drift (schema → DB): The receipt_url and sent_at columns were
 *   missing from purchase_orders in production while being present in the
 *   schema, causing 500 errors on every request that touched those columns.
 *
 *   Reverse drift (DB → schema): Columns orphaned in the DB after a schema
 *   rename or removal silently waste storage space and confuse future
 *   developers who see undocumented columns in production.
 *
 * How it works:
 *   1. Extract the expected column names from the Drizzle table definitions
 *      (lib/db/src/schema/schema.ts) using drizzle-orm's getTableColumns().
 *   2. Query information_schema.columns for each key table in the live DB.
 *   3. Fail with a descriptive error for every column that is declared in the
 *      schema but absent from the database (forward drift).
 *   4. Warn (but do not fail) for every column that exists in the database
 *      but is absent from the Drizzle schema (reverse drift).  These show up
 *      as console warnings so they don't block deploys caused by safe legacy
 *      columns.  Known intentional extras can be suppressed per-table via
 *      KNOWN_EXTRA_DB_COLUMNS below.
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
import https from "node:https";
import http from "node:http";

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

// ── Known intentional extra DB columns ───────────────────────────────────────
// If a table has columns that deliberately live in the DB but are not (yet)
// reflected in the Drizzle schema — e.g. added directly via a migration for a
// feature not yet merged — list them here to suppress the reverse-drift warning
// for that specific column.  Remove entries once the schema catches up.
//
// Format:  tableName → Set of column names to ignore
const KNOWN_EXTRA_DB_COLUMNS: Record<string, Set<string>> = {
  // Example (uncomment and adapt as needed):
  // purchase_orders: new Set(["legacy_ref_code"]),
};

// ── Slack notification helper ─────────────────────────────────────────────────
/**
 * Posts a plain-text message to the SLACK_AI_LOGS_WEBHOOK URL (if set).
 * Uses only Node built-ins so there is no extra dependency.
 */
function postToSlack(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_AI_LOGS_WEBHOOK;
  if (!webhookUrl) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ text });
    const parsed = new URL(webhookUrl);
    const transport = parsed.protocol === "https:" ? https : http;
    const req = transport.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        res.resume(); // drain the response
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`Slack webhook returned HTTP ${res.statusCode}`));
        }
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Reverse-drift accumulator ─────────────────────────────────────────────────
// Populated during the test run; flushed to Slack in afterAll.
const reverseDriftFindings: Array<{
  table: string;
  orphaned: string[];
}> = [];

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
    // ── Post reverse-drift summary to Slack ──────────────────────────────────
    if (ENABLED && reverseDriftFindings.length > 0) {
      const totalCols = reverseDriftFindings.reduce(
        (n, f) => n + f.orphaned.length,
        0,
      );

      const tableLines = reverseDriftFindings
        .map((f) => {
          const drops = f.orphaned
            .map(
              (c) =>
                `  \`ALTER TABLE ${f.table} DROP COLUMN IF EXISTS ${c};\``,
            )
            .join("\n");
          return (
            `*${f.table}* — ${f.orphaned.length} orphaned column(s): ` +
            f.orphaned.map((c) => `\`${c}\``).join(", ") +
            `\n${drops}`
          );
        })
        .join("\n\n");

      const message =
        `:warning: *Schema reverse-drift detected* (${reverseDriftFindings.length} table(s), ${totalCols} orphaned column(s))\n\n` +
        `These columns exist in the live database but are *not* declared in the Drizzle schema. ` +
        `Drop them via a migration or add them to \`KNOWN_EXTRA_DB_COLUMNS\` to suppress.\n\n` +
        tableLines;

      try {
        await postToSlack(message);
        console.log(
          `[schema-drift] Reverse-drift summary posted to Slack (${reverseDriftFindings.length} table(s) affected).`,
        );
      } catch (err) {
        console.warn(
          `[schema-drift] Failed to post reverse-drift summary to Slack:`,
          err,
        );
      }
    }

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

    it(`${tableName}: database has no unexpected columns beyond the schema definition`, async () => {
      if (!ENABLED) {
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
          // Forward-drift test already handles the missing-table case with an
          // error; silently skip the reverse check to avoid a duplicate report.
          return;
        }

        dbColumns = new Set(result.rows.map((r) => r.column_name));
      } finally {
        client.release();
      }

      const expected = schemaColumnNames(table);
      const allowlist = KNOWN_EXTRA_DB_COLUMNS[tableName] ?? new Set<string>();

      const orphaned: string[] = [];
      for (const col of dbColumns) {
        if (!expected.has(col) && !allowlist.has(col)) {
          orphaned.push(col);
        }
      }

      if (orphaned.length > 0) {
        // Accumulate findings for the Slack summary posted in afterAll.
        reverseDriftFindings.push({ table: tableName, orphaned });

        // Also surface as a console warning so it's visible in CI/local logs
        // without waiting for the afterAll flush.
        console.warn(
          `[schema-drift] Reverse drift detected in "${tableName}".\n` +
            `The following column(s) exist in the live database but are NOT ` +
            `declared in the Drizzle schema:\n` +
            orphaned.map((c) => `  • ${c}`).join("\n") +
            `\n\nIf intentional, add them to KNOWN_EXTRA_DB_COLUMNS in ` +
            `schemaDriftCheck.test.ts to suppress this warning.\n` +
            `If the column was renamed or removed, drop it from the DB:\n` +
            orphaned
              .map((c) => `  ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${c};`)
              .join("\n"),
        );
      }

      // Reverse drift is a warning only — always pass.
      expect(true).toBe(true);
    });
  }
});
