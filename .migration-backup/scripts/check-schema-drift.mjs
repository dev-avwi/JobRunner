#!/usr/bin/env node
/**
 * Schema drift checker.
 *
 * Compares column names declared in shared/schema.ts against the actual columns
 * in the database referenced by DATABASE_URL. Exits non-zero (and prints the
 * delta) when the two diverge — wired up as a guard rail so deploys don't ship
 * server code that references a column the live DB hasn't been migrated to
 * (e.g. the recent `xero_tax_rate_id` outage).
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/check-schema-drift.mjs
 *
 * Exit codes:
 *   0 — schema is in sync
 *   1 — drift detected (missing columns / tables in DB)
 *   2 — could not connect to DB or parse schema
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, '..', 'shared', 'schema.ts');

function fail(code, msg) {
  console.error(`[schema-drift] ${msg}`);
  process.exit(code);
}

if (!process.env.DATABASE_URL) {
  fail(2, 'DATABASE_URL is not set');
}

const schemaSrc = fs.readFileSync(SCHEMA_PATH, 'utf8');

/**
 * Parse `export const xxx = pgTable("table_name", { ... })` blocks. Within
 * each block, identify columns of the form
 *   columnName: <type>("snake_name", ...)
 * Our schema is consistent about always passing the snake_case name as the
 * first argument to the column builder.
 *
 * Uses brace counting so 4-arg pgTable calls (with `(table) => [...]` index
 * blocks) and inline option objects like `{ precision: 6 }` don't trip the
 * parser.
 */
function parseSchema(src) {
  const tables = new Map(); // sqlTableName -> Set<columnName>
  const startRegex = /export const \w+\s*=\s*pgTable\(\s*['"]([\w]+)['"]\s*,\s*\{/g;
  const colRegex = /^\s*\w+\s*:\s*\w+\s*\(\s*['"]([\w]+)['"]/gm;

  let m;
  while ((m = startRegex.exec(src)) !== null) {
    const tableName = m[1];
    const bodyStart = startRegex.lastIndex; // points just past the `{`
    let depth = 1;
    let i = bodyStart;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    if (depth !== 0) continue;
    const body = src.slice(bodyStart, i - 1);
    const cols = new Set();
    let cm;
    colRegex.lastIndex = 0;
    while ((cm = colRegex.exec(body)) !== null) {
      cols.add(cm[1]);
    }
    if (cols.size > 0) {
      const existing = tables.get(tableName);
      if (existing) {
        for (const c of cols) existing.add(c);
      } else {
        tables.set(tableName, cols);
      }
    }
    startRegex.lastIndex = i;
  }
  return tables;
}

const declared = parseSchema(schemaSrc);
if (declared.size === 0) {
  fail(2, 'parsed 0 tables from shared/schema.ts — parser regex is stale');
}

let pg;
try {
  pg = await import('pg');
} catch (err) {
  fail(2, `cannot import pg: ${err.message}`);
}
const { Pool } = pg.default || pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 2,
  connectionTimeoutMillis: 8000,
});

let liveColumns;
try {
  const { rows } = await pool.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `);
  liveColumns = new Map();
  for (const r of rows) {
    if (!liveColumns.has(r.table_name)) liveColumns.set(r.table_name, new Set());
    liveColumns.get(r.table_name).add(r.column_name);
  }
} catch (err) {
  await pool.end().catch(() => {});
  fail(2, `db query failed: ${err.message}`);
}
await pool.end().catch(() => {});

const missingTables = [];
const missingColumns = []; // [{ table, column }]

for (const [table, cols] of declared.entries()) {
  const live = liveColumns.get(table);
  if (!live) {
    missingTables.push(table);
    continue;
  }
  for (const col of cols) {
    if (!live.has(col)) missingColumns.push({ table, column: col });
  }
}

if (missingTables.length === 0 && missingColumns.length === 0) {
  console.log(`[schema-drift] OK — ${declared.size} tables in sync.`);
  process.exit(0);
}

console.error('[schema-drift] DRIFT DETECTED');
if (missingTables.length) {
  console.error(`  Missing tables (${missingTables.length}):`);
  for (const t of missingTables.sort()) console.error(`    - ${t}`);
}
if (missingColumns.length) {
  console.error(`  Missing columns (${missingColumns.length}):`);
  for (const { table, column } of missingColumns.sort((a, b) => a.table.localeCompare(b.table) || a.column.localeCompare(b.column))) {
    console.error(`    - ${table}.${column}`);
  }
  console.error('');
  console.error('  Suggested ALTERs (paste into scripts/post-merge.sh):');
  for (const { table, column } of missingColumns) {
    console.error(`    psql "$DATABASE_URL" -c "ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} text;" 2>/dev/null || true`);
  }
}
process.exit(1);
