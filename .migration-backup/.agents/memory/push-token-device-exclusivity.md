---
name: Push-token device exclusivity on account switch
description: Why a device kept getting the previous account's push notifications after logging into a different account, and the logout-unbind fix.
---

A physical device must deliver pushes for exactly ONE user — the currently signed-in one. Symptom when it doesn't: log in as account A on a device, start a job timer; log out and into account B on the SAME device; B's device then receives A's server-side pushes (e.g. the "Running Over Time" overtime nudge for A's still-running timer).

**Root cause:** server `overtimeNudgeService` (and any push) targets the correct user (`entry.userId`); the misroute is push-token hygiene. `storage.registerPushToken` keys on the token value and reassigns `userId` on login (so login moves the token to the new user), BUT mobile logout only called `notificationService.resetBackendRegistration()` — a LOCAL flag. It never told the server to deactivate the device's token for the logging-out user. So in the logout→next-login window the token stayed `isActive=true` bound to account A, and A's push landed on the device.

**Fix (mobile):** on logout, call `notificationService.deactivateTokenWithBackend()` → `api.request('DELETE','/api/push-tokens',{token})` (server route + `storage.deactivatePushTokenByValue` already existed). Combined with `registerPushToken`'s reassign-on-login, the device becomes exclusively bound to whoever is currently signed in.

**How to apply / gotchas:**
- The unbind MUST run BEFORE `api.logout()` (the DELETE route is `requireAuth`; bearer token must still be set).
- Run it FIRST, in its own try/catch, BEFORE the other logout cleanup awaits — if an earlier cleanup step (offline cache clear, location stop) throws, a shared try/catch skips the unbind and the stale token survives.
- `api.request` resolves with `{ error }` on 401/404/offline (does NOT throw) — inspect `res.error`, don't assume success.
- Also end the lock-screen Live Activity (`LiveActivity.end()`) and clear the in-memory active timer on logout — it lives in `useTimeTrackingStore` (a SEPARATE zustand store from `useAuthStore`), so clear it via `useTimeTrackingStore.setState({ activeTimer: null })`, NOT inside the auth `set()` (auth's `set` is typed to `AuthState` and will reject `activeTimer` at compile time).
- Residual (accepted) gap: if the device is fully offline at logout, the DELETE can't reach the server; the stale token is then cleaned up by reassign-on-next-login. No mobile push-regression test harness exists to assert this automatically.
