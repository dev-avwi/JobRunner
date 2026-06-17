---
name: Role-gated mobile UI flickers on app foreground
description: Why sections gated on useUserRole flags flash in/out on resume, and how to fix without touching the global role cache.
---

# Role-gated UI flickers on app foreground (mobile)

A section gated directly on a `useUserRole()` flag (e.g. `!isStandaloneSubcontractor`) can appear-then-disappear every time the app is backgrounded and reopened.

**Why:** `useUserRole` revalidates on `AppState` `'active'` by calling `invalidateUserRoleCache(userId)`, which **deletes** the role-cache entry (`roleCache.delete`). During the refetch window `cache` is gone, so the derived `role` falls back to the owner/loading branch (NOT the real role). Flags derived from the real role (`isSubcontractor`, `isStandaloneSubcontractor`, etc.) momentarily read their default, flipping the gate, then snap back when the fetch resolves. The transient is short but visible = flicker.

**How to apply:** Don't gate UI directly on a transient role flag. Latch the decision in the component: keep a `useState` that defaults to the safe-hidden value and update it in an effect ONLY when the role has *definitively* resolved (e.g. `if (isSubcontractor) setShow(!isStandaloneSubcontractor)`). Transient owner/loading states skip the update, so the gate holds its last settled value. Default to hidden so a standalone user never sees a flash-in.

**Don't** fix this by deleting/gating on `data` fields — that re-introduces flicker. The component's own data fetch (`fetchDashboard`) was already flicker-safe (never blanks `data` on refetch); the role hook was the culprit.

**Broader root cause — NOW FIXED app-wide (stale-while-revalidate).** `invalidateUserRoleCache` (hard delete) made EVERY role-gated screen flicker on resume. Fix shipped: added `markUserRoleCacheStale(userId)` in `role-cache.ts` (sets the entry's `timestamp` to 0, keeps it in the map) and the `useUserRole` foreground AppState handler + periodic-refetch interval now call THAT instead of the hard delete. So during refetch `cache` stays populated → `getCurrentRole()` returns the last settled role (no owner/loading fallback) and `isLoading` stays false. The fetch still runs because `isCacheStale` is true (timestamp 0); on success the timestamp resets so the effect short-circuits (no loop). Hard-delete `invalidateUserRoleCache` is retained ONLY for logout/security. Don't revert the two revalidation calls back to the delete.
