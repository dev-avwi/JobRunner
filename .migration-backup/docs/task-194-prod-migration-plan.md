# Task #194 — Subbie Billing Builder: Production Rollout Plan

Migration file: `migrations/0019_subbie_billing_builder.sql` (additive, idempotent).

## What changes (additive only — no drops, no rewrites)
`subcontractor_invoices` += `doc_type` (default `'invoice'`), `title`, `gst_enabled`
(default `true`), `valid_until`.
`subcontractor_invoice_items` += `quantity`, `unit_price`.

Existing rows get safe defaults. Legacy items keep `hours`/`rate`; new builder items
use `quantity`/`unit_price`. Read paths and PDF fall back `quantity/unit_price -> hours/rate`,
so pre-migration rows render unchanged.

## Status of DEV
Applied to the DEV database via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (same SQL as
`0019`). No `drizzle-kit push` was run.

## Production rollout (user-gated)

**Do NOT** run `npx drizzle-kit push --force` against prod — the wider schema vs the live
prod DB still contains unrelated *destructive* drops (see the Deployment runbook in
`replit.md`). **Do NOT** use "Copy development database to production" (wipes live users).

### Prechecks
1. Confirm a recent prod DB backup/snapshot exists.
2. Confirm app code being deployed is this change set (reads tolerate NULL `quantity`/
   `unit_price` and default `doc_type`/`gst_enabled`).

### Apply (choose one)
- **Preferred:** Replit Publish flow — review the schema diff; every change is additive,
  so approve.
- **Manual (independent of a full push):** run `migrations/0019_subbie_billing_builder.sql`
  against prod. It is idempotent and additive (no data loss).

### Verification
1. `DATABASE_URL=<prod> node scripts/check-schema-drift.mjs` reports in sync for these
   columns.
2. A subbie can build + submit a quote and an invoice to a business they joined.
3. Owner sees the doc and can approve / reject / mark paid; quotes cannot be marked paid.
4. PDF renders for both doc types with qty/unit-price columns and GST gated by `gst_enabled`.
5. A legacy (pre-migration) subcontractor invoice still renders and lists correctly.

### Rollback
Additive columns are inert if unused — leaving them in place is harmless even if app code
is rolled back. No data migration to reverse. No orphan cleanup
(`scripts/cleanup-orphans.sql`) is needed for this change.
