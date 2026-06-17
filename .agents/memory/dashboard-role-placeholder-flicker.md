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
