---
name: Mobile auth-error string detection
description: Why mobile auth-failure detection must match multiple wordings case-insensitively, not one exact string
---

# Mobile auth-error detection must be wording-agnostic

The backend returns DIFFERENT strings for an invalid/expired session depending on
which middleware rejects: `/api/auth/me` returns `{"error":"Not authenticated"}`,
other endpoints return `"Authentication required"`, `"Unauthorized"`, etc. (all HTTP 401).

**The bug this caused:** mobile `store.ts` `checkAuth()` only matched
`'Authentication required'` / `'User not found'` / `'401'` / `'Unauthorized'`. A dead
token hitting `/api/auth/me` returned `"Not authenticated"`, which slipped through to
the "network error" branch → app kept the STALE cached session (`isAuthenticated`
stayed true) → every data screen 401-dead-ended ("Failed to load job: Authentication
required") and the user was never prompted to sign in again.

**Fix / rule:** detect auth failures with the shared `isAuthErrorMessage(error)` helper
exported from `mobile/src/lib/api.ts` — case-insensitive, matches `not authenticated`,
`authentication required`, `unauthorized`, `401`, `user not found`. Use it anywhere you
branch on an auth failure (checkAuth, per-screen error UI). On match: clear token +
cached auth, set `isAuthenticated:false`; the global gate in `app/_layout.tsx` then
renders the login stack.

**Why string-matching (not status code):** `ApiResponse` has no `status` field yet, so
matching is by message. If that ever becomes fragile, the cleaner fix is to surface HTTP
status in `ApiResponse` and key off `401`. Residual risk: a 403 mis-worded as
"Unauthorized" would be treated as session-expiry — low, but the reason matching stays
broad rather than exact.

**How to apply:** never add a new exact-string auth check; route it through
`isAuthErrorMessage`. The job-detail screen (`app/job/[id].tsx`) shows a "Session
expired / Sign in" state (calls `logout()`) when the load error is auth-related.
