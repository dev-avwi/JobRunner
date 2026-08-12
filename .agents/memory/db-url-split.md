---
name: Database URL split — heliumdb vs neondb
description: The API server uses DATABASE_URL (heliumdb), NOT NEON_DATABASE_URL (neondb). Always migrate DATABASE_URL.
---

# Database URL split

## The rule
All schema migrations must target `DATABASE_URL` — this is the `heliumdb` database that the API server (`artifacts/api-server`) connects to via `lib/db/src/index.ts`. `NEON_DATABASE_URL` is a separate `neondb` database that the API server does NOT use.

**Why:** Running `node -e "..."` in the Replit shell defaults to `NEON_DATABASE_URL`, but the compiled API server reads `DATABASE_URL`. Migrations applied only to `NEON_DATABASE_URL` have no effect on the running app.

**How to apply:** Always run migration scripts like:
```js
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
```

Not `NEON_DATABASE_URL`.

## Puppeteer/Chrome
Chrome for Puppeteer PDF generation must be installed with:
```bash
npx puppeteer browsers install chrome
```
It installs to `/home/runner/.cache/puppeteer`. Needs to be re-run if the cache is cleared.
