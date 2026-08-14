---
name: Dev DB migration pattern
description: Task agents add schema columns but don't migrate the dev DB — causes silent login failures
---

# Dev DB missing-column pattern

## The rule
When task agents merge schema changes, they do NOT run migrations against the dev DATABASE_URL. The dev DB drifts behind the schema file. This manifests as silent login failures.

**Why:** `getUserContext` in `permissions.ts` queries `business_settings` (and `jobs` via permissions checks) on every authenticated request. One missing column throws a 500 on `/api/auth/me`, so login appears to succeed (POST /login returns 200) but every subsequent fetch returns 401/500 and the frontend falls back to the landing page.

## How to apply
When a user reports "login works but I get kicked back to the site/landing page":

1. Check API server logs for: `column "X" does not exist` or `42703`
2. Fix: run `ALTER TABLE <table> ADD COLUMN IF NOT EXISTS <col> <type> DEFAULT <val>;` via Node + `DATABASE_URL`
3. Restart the API server workflow

```bash
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\`ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS travel_rate_per_km decimal(10,4) DEFAULT 0.0000;\`)
  .then(() => { console.log('Done'); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
"
```

## Tables most at risk (queried on every auth check)
- `business_settings` — queried in `getUserContext` → `permissions.ts:271`
- `jobs` — queried in permissions checks → any new job column breaks authenticated job fetches
- `job_phases` — queried by phase endpoints

## Known columns applied manually (not via drizzle push)
- `jobs.practical_completion_date` (date)
- `jobs.defects_liability_months` (integer DEFAULT 12)
- `job_phases.assigned_user_id` (varchar, FK → users ON DELETE SET NULL)
- `business_settings.travel_rate_per_km` (decimal(10,4) DEFAULT 0.0000)

## Why drizzle push doesn't work here
`drizzle-kit push` requires a TTY for interactive column-conflict resolution. It fails in the non-interactive shell with "Interactive prompts require a TTY terminal". Use raw SQL instead.
