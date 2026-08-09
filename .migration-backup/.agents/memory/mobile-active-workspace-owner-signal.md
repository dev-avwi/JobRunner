---
name: Mobile active-workspace-owner signal
description: Where to read the currently-active business owner id on mobile to detect cross-workspace context
---

To tell which business workspace a mobile user is *currently acting in*, read
`user.businessOwnerId` (the `User` object from `/api/auth/me`), NOT
`roleInfo.businessOwnerId`.

**Why:** mobile `RoleInfo` (built in store.ts from `/api/team/my-role`) does NOT
carry `businessOwnerId` — only roleId/roleName/permissions/isOwner/teamMemberId.
Only the `User` type has `businessOwnerId` (+ `ownerBusinessName`), and the
server resolves it from the active business membership (joined worker → the
business owner's id; owner / personal profile → the user's own id).

**How to apply:** cross-workspace checks (e.g. "is this job from a different
workspace than the one I'm in?") compare `job.userId` against
`user.businessOwnerId ?? user.id`. Fail open when `user` isn't loaded so you
don't briefly lock out a legitimate worker during auth hydration. After a
WorkspaceSwitcher switch, refresh auth + reload the record.

Related: `stopTimer()` (useTimeTrackingStore) returns `false` on failure rather
than throwing — when gating an action on a successful stop, check the boolean,
don't rely on try/catch.
