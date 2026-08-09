---
name: Mobile logout redirect race
description: Why a logout button can leave the user on the dashboard, and the required logout pattern
---

A logout handler that fires the async store `logout()` WITHOUT awaiting and then navigates to
`/` will race `mobile/app/index.tsx`. The store `logout()` only flips `isAuthenticated=false`
at the END (after clearing caches, stopping location tracking, `api.logout()`), so `index.tsx`'s
redirect effect still sees `isAuthenticated=true` and bounces to `/(tabs)` → the user stays on the
dashboard and appears not logged out.

**Why:** `index.tsx` branches on auth state at navigation time; navigating before state clears
reads stale `true`. The wide / foldable-unfolded layout uses `SidebarNav` (its own logout button),
which had this bug while the phone `profile.tsx` logout was already correct.

**How to apply:** every logout entry point must `await useAuthStore.getState().logout()` THEN
`router.replace('/(auth)/login')` — go straight to the login route, not `/`, to skip the index
auth-branching during the transition. Also keep store `logout()` cleanup in a `try/finally` so the
signed-out `set()` (and `isLoading=false`) ALWAYS runs even if a cleanup step throws; otherwise a
failed cleanup leaves the user stuck signed-in.
