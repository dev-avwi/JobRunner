---
name: Sidebar team gate (mobile) uses non-existent hasTeam
description: Why Team Operations / Team Management / Dispatch Board vanished from the mobile sidebar for all accounts
---

`mobile/src/lib/navigation-config.ts` `filterSidebarItems` hides any item with
`requiresTeam` when `FilterOptions.isTeam` is false. `SidebarNav` was computing
`isTeam` from `businessSettings.hasTeam` — **that column does not exist** in
`shared/schema.ts`. The real field is `business_settings.teamSize` (default `'solo'`,
values solo/small/medium/large). So `hasTeam` was always undefined → isTeam always
false → the single "Team Operations" sidebar entry (matchPaths team-operations,
team-management, dispatch-board) was hidden for EVERY account, demo included.

**Fix:** `isTeam: ((businessSettings as any)?.teamSize ?? 'solo') !== 'solo'`.
Demo seed sets teamSize 'medium' + subscriptionTier 'team', so it now shows.

**Why:** schema drift — a gate keyed on a field name that was never added. Fail-closed
(undefined → 'solo' → hidden) is correct, but it silently suppressed a whole feature.

**How to apply:** when a mobile nav/gate references a businessSettings field, grep
`shared/schema.ts` to confirm the column exists. Known related caveat: Team Operations
`allowedRoles` is ['owner','manager'] (NOT solo_owner) — a team-capable solo_owner
still won't see it; expand allowedRoles only if product confirms that intent.
