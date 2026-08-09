---
name: Logout owner-menu flash (mobile More page)
description: Why the full owner menu briefly flashes while signing out, and how to suppress it.
---
On the mobile More page (profile.tsx), tapping Sign Out briefly flashes the FULL owner menu before the redirect.

**Why:** `logout()` clears the per-user role cache (`roleCache`) before the screen unmounts, but `userId` and `businessSettings` linger for one render. `useUserRole`'s `getCurrentRole()` then hits the `!cache → isBusinessOwner(businessSettings, userId)` branch and returns `'owner'`/`'solo_owner'` (NOT 'loading'), so `isLoading` is false and `isStandaloneSubcontractor` is false → the menu renders the full owner kit (including items normally hidden for a standalone subbie).

**How to apply:** the `isRoleLoading` skeleton gate does NOT catch this (role isn't 'loading'). Add the local `signingOut` state into the gate: `const showSkeleton = isRoleLoading || signingOut;` and use `showSkeleton` for every menu/quick-action/category render branch. handleLogout sets `signingOut=true` before `await logout()`, so the skeleton stays up through the transition.
---
name: Dashboard owner→staff signup flicker
description: Why a fresh owner briefly sees the worker dashboard, and how the dashboard must gate staff vs owner UI.
---

# Owner signup briefly renders the worker/staff dashboard

On signing up as an owner, the mobile dashboard (`mobile/app/(tabs)/index.tsx`)
could render the FULL worker layout ("Your Status" widget, MY JOBS/IN PROGRESS,
"Team member" badge) for ~3s, then flip to the owner layout.

**Root cause (client-side, not server):** `GET /api/team/my-role` ALWAYS returns
`isOwner:true` for a fresh owner (no accepted membership) — so the server never
produces staff. The transient staff state comes from the role hook
(`mobile/src/hooks/use-user-role.ts`): its **404 catch** writes a *placeholder*
role to the auth store with the exact shape `roleId:'staff'`, `roleName:'STAFF'`
(uppercase) and **`isWorker:true`** before the real role resolves. The dashboard
trusted `store.isStaff()` (`roleInfo!==null && !roleInfo.isOwner`) and rendered
the worker UI from that placeholder. `isStaffUser` also gates worker-only data
fetches, so it wasn't purely cosmetic.

**Fix / rule for role-gated dashboard UI:**
- Lean on the AUTHORITATIVE owner signal `user.isOwner` (from `/api/auth/me`,
  stored on the `user` object). The role hook never overwrites `user`, so it is
  not polluted by the transient (the hook DOES pollute store `isWorker`, so do
  NOT trust `isWorker` alone to detect owners).
- Suppress the placeholder by its EXACT shape: `roleId==='staff' && roleName==='STAFF'`.
  Do **not** blanket-exclude `roleName==='STAFF'` case-insensitively —
  `STAFF` is a real role whose DB `name` is `'Staff'` (mixed case). The badge's
  real-staff label relies on the case-sensitive `roleName !== 'STAFF'` check.
- Net gate: `isStaffUser = !serverSaysOwner && !isPlaceholderRole && isStaff()`.
  Badge is owner-biased: subcontractor → 'Subcontractor', isStaffUser → role
  name or 'Team member', else 'Owner'.

**Why:** the server is owner-authoritative for fresh owners; the only staff
source is a client placeholder. Biasing the dashboard to owner (unless a real
worker role or `isWorker`-confirmed) is safe because this app's default account
is owner and real workers carry a real role name. This is a DIFFERENT code path
from the app-resume foreground flicker (see role-gated-ui-foreground-flicker.md).

Mobile JS change → Ayden must `git pull` + rebuild on his Mac; no server deploy.
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
