---
name: Routes reading req.userId without requireAuth break on mobile
description: A route that reads req.userId||req.session?.userId but has no requireAuth middleware works on web (cookie) but always 401s on mobile (Bearer-only).
---

`req.userId` is ONLY populated by the `requireAuth` middleware (`server/routes/middleware.ts`), which is what resolves a Bearer **session token** (looked up in the `session` table) into `req.userId`/`req.user`. There is NO global middleware that sets `req.userId` from a Bearer header.

So a route written as `app.get(path, async (req,res) => { const uid = req.userId || req.session?.userId; if(!uid) return 401; ... })` **with no `requireAuth`**:
- Works for **web** clients (cookie session → `req.session.userId` is set by express-session).
- Always returns 401 for **mobile** clients (Bearer-only, no cookie → `req.userId` never set).

**Symptom:** a mobile screen silently shows its empty/fallback state (e.g. the Workspaces switcher showed "No connected workspaces yet" even for owners) because the fetch 401s and the client only fills state on success.

**Fix:** add `requireAuth` as the route middleware. requireAuth checks `req.session.userId` first (web unaffected) then the Bearer token, and maps demo sessions to `demoDataUserId` — so the existing `req.userId || req.session?.userId` line still works and demo semantics improve.

**How to find them:** `rg 'app\.(get|post|...)\("/api/...".*async' ` then grep the handler body for `req.userId || req.session?.userId` with no `requireAuth` in the route args. The `/api/auth/*` family is the usual offender (my-businesses, switch-business, pending-invites, job-conflicts, accept-invite, dismiss-invite-banner were all missing it).

Related: custom-queryfn-bypasses-bearer.md (client-side mirror — a hook's own fetch using credentials:include instead of the Bearer header silently 401s).
