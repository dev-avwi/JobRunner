---
name: No storage.db property (use storage methods or module-level db)
description: Why `storage.db.*` crashes at runtime and slips past the build; the true root cause of worker locations never persisting.
---

There is **no `storage.db`**. `db` is a module-level export in `server/storage.ts`
(`export const db = drizzle(pool)`). Route handlers that wrote
`storage.db.insert(...)` / `storage.db.update(...)` / `storage.db.query.X.findFirst(...)`
crash at runtime with `TypeError: Cannot read properties of undefined (reading 'insert')`.

**Why it reaches production:** the prod build (`npm run build`, esbuild) does **not**
typecheck, and `npm run check` (tsc) carries a large pre-existing baseline of errors,
so a bogus `storage.db.*` reference is never caught and ships silently. The runtime
TypeError only shows up in `fetchDeploymentLogs()` (production runtime logs), not in
the build/publish log.

**How to apply:** in route handlers, persist via storage methods
(`storage.createLocationTracking(...)`, `storage.upsertTradieStatus(...)`, etc.) or
import the module-level `db` directly from storage — **never** `storage.db`.

**Concrete incident:** this was the true server-side root cause of worker locations
never appearing on the team map. `POST /api/team-locations` returned 500 on every
ping (`location_tracking` stayed empty in prod) because the handler used `storage.db`.
The matching client-side gap (foreground fallback + immediate send) was a separate,
earlier fix — see `mobile-location-foreground-fallback.md`. Both were required: the
phone has to send AND the server has to not crash.

**Deploy note:** this is a server fix — it only takes effect once production
(jobrunner.com.au) is re-published. The phone talks to prod, so an un-deployed fix
changes nothing for a real-device test.
