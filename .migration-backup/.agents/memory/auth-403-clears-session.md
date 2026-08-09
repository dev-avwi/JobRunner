---
name: 403 must not clear the session token
description: Why non-owner roles (worker/subcontractor) got silently logged out on reload, and the auth boundary to keep.
---

# 403 (forbidden) must NOT clear the auth session

JobRunner web auth is **Bearer-token only** (token in localStorage key `jobrunner_session_token`; in dev there is NO session cookie — `/api/auth/me` only works with the `Authorization: Bearer` header). Login returns the token as top-level `sessionToken`; both login surfaces (`AuthForm`, `AuthFlow`) persist it.

**The bug:** `throwIfResNotOk()` in `client/src/lib/queryClient.ts` was calling `clearSessionToken()` + throwing `session_expired` on ANY 403 that wasn't `isDemo`/`team_plan_required`. Workers and subcontractors legitimately get **403** on owner-only endpoints (verified: `/api/quotes`, `/api/invoices`, `/api/reports/summary`, `/api/team/locations`). So one background request → token wiped → next page reload bounced them to the marketing/landing page. Symptom seen in browser test: role logs in, dashboard renders, but `localStorage` token is `null` right after.

**The rule:** 403 = authenticated-but-not-permitted → throw a plain error, NEVER clear the token. Only **401** (genuinely unauthenticated) clears the token + throws `session_expired`. Keep that boundary.

**Why:** clearing auth state on an authorization (RBAC) denial conflates "you can't do this" with "you're logged out". The `session_expired` string consumers (queryClient retry suppression, `syncManager`, `AuthFlow` registration catch) are all tied to the 401 path, so routing 403 to a `403:` error doesn't affect them.

**How to apply:** if a non-owner role "feels broken / keeps getting logged out", first check whether their app fires an owner-only endpoint that 403s and whether any client error handler clears auth on 403. Related open follow-ups (not yet done): role-gate owner-only queries via `enabled`+permission so those requests aren't fired at all; classify 403 as non-retryable in `syncManager` (currently retried like a transient error).
