---
name: Adding a DB table without db:push
description: Why new tables must be created with raw SQL on this repl, not drizzle-kit push
---

Adding a brand-new table to `shared/schema.ts` and running `npm run db:push`
triggers an INTERACTIVE drizzle-kit prompt that ALSO wants to drop pre-existing
columns the live schema still has (`users.role`, `users.password_reset_expires`,
`jobs.assigned_team_member_id`). Confirming the push would cause data loss.

**Rule:** to add a new table, define it in `shared/schema.ts` (for the types +
ORM) AND create it directly with `psql "$DATABASE_URL" -c "CREATE TABLE IF NOT
EXISTS ..."` (mirror the column types/constraints). Do NOT run `db:push`.

**Why:** the dev DB schema has drifted from `shared/schema.ts`; push reconciles
the WHOLE schema, not just your additions, so it proposes destructive drops.
This is the same drift the deploy runbook flags against `drizzle-kit push
--force` in the build command.

Also applies to new COLUMNS on existing tables: add them via `ALTER TABLE ...
ADD COLUMN IF NOT EXISTS ...`, and add EVERY column the Drizzle entity defines —
a single missing column breaks all Drizzle SELECTs on that table with 500s.

**How to apply:** new-table work = schema edit + manual CREATE TABLE. Verify
with a quick `psql ... SELECT count(*)`.
