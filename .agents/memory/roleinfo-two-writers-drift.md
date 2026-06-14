---
name: roleInfo.isOwner has two racing writers (mobile)
description: useAuthStore.roleInfo.isOwner is written by two places that disagree for a standalone subcontractor; don't gate on it.
---

# Mobile `useAuthStore.roleInfo.isOwner` is unreliable for standalone subcontractors

Two different code paths write `useAuthStore.roleInfo`, and they compute `isOwner` differently:

- `store.ts` `fetchRoleInfo` sets `isOwner` from the server flag first: `data.isOwner === true || role === 'owner' || roleName includes 'owner'` → **true** for a standalone subcontractor (server `/api/team/my-role` returns `isOwner:true`, `roleName:'Subcontractor'`).
- `use-user-role.ts` sets `isOwner: role === 'owner' || role === 'solo_owner'` → **false** for a standalone subcontractor (its `role` stays `'subcontractor'`).

Both call `set/setState({ roleInfo })` on the SAME store, so last-writer-wins. `use-user-role` runs on any screen that mounts a `useUserRole()` consumer (FAB, profile — i.e. almost always), so `roleInfo.isOwner` typically lands on **false** for a standalone subcontractor.

**Rule:** to detect a standalone subcontractor (personal-profile subcontractor with owner powers), use `useUserRole().isStandaloneSubcontractor`, which reads the canonical `cache.teamMemberInfo.isOwner` (the raw server response), NOT `roleInfo.isOwner`. The FAB and the More menu (`profile.tsx`) already use this signal; the Work page (`jobs.tsx`) was the one surface that drifted by deriving from `roleInfo.isOwner`.

**Why:** gating create/visibility on `roleInfo.isOwner` made the Work page (Create Job button, quote/invoice actions) lock a standalone subcontractor out while the FAB/More menu unlocked them — an inconsistency the user reported.

**How to apply:** any new mobile gate that needs "is this a standalone subcontractor" must read `useUserRole().isStandaloneSubcontractor`. Distinguish from a subcontractor switched INTO a joined business (that one has no owner powers and `isStandaloneSubcontractor` is false). If you ever need a real fix for the drift itself, align `use-user-role.ts` to also honor `data.isOwner === true` — but that has wide blast radius (many gates read `roleInfo.isOwner`), so prefer the canonical-signal approach.
