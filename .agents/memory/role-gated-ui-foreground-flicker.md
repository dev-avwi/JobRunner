---
name: Role-gated mobile UI flickers on app foreground
description: Why sections gated on useUserRole flags flash in/out on resume, and how to fix without touching the global role cache.
---

# Role-gated UI flickers on app foreground (mobile)

A section gated directly on a `useUserRole()` flag (e.g. `!isStandaloneSubcontractor`) can appear-then-disappear every time the app is backgrounded and reopened.

**Why:** `useUserRole` revalidates on `AppState` `'active'` by calling `invalidateUserRoleCache(userId)`, which **deletes** the role-cache entry (`roleCache.delete`). During the refetch window `cache` is gone, so the derived `role` falls back to the owner/loading branch (NOT the real role). Flags derived from the real role (`isSubcontractor`, `isStandaloneSubcontractor`, etc.) momentarily read their default, flipping the gate, then snap back when the fetch resolves. The transient is short but visible = flicker.

**How to apply:** Don't gate UI directly on a transient role flag. Latch the decision in the component: keep a `useState` that defaults to the safe-hidden value and update it in an effect ONLY when the role has *definitively* resolved (e.g. `if (isSubcontractor) setShow(!isStandaloneSubcontractor)`). Transient owner/loading states skip the update, so the gate holds its last settled value. Default to hidden so a standalone user never sees a flash-in.

**Don't** fix this by deleting/gating on `data` fields — that re-introduces flicker. The component's own data fetch (`fetchDashboard`) was already flicker-safe (never blanks `data` on refetch); the role hook was the culprit.

**Broader (deferred) root cause:** `invalidateUserRoleCache` deleting the cache makes EVERY role-gated screen flicker on resume. A stale-while-revalidate approach (mark stale instead of delete, so `cache` stays populated during refetch) would fix it app-wide — but that touches a shared hook used everywhere, so it's higher-risk than a per-section latch. Only do it if flicker shows up in many places.
