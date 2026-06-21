---
name: Invite-code subcontractor role fallback
description: Why a "Subcontractor" invite code can land the joiner on the Worker role, and how accountType ties in.
---

# Subcontractor invite code → Worker role bug

`invite_codes` rows carry `roleType` ('worker'|'manager'|'subcontractor') but the
create route (`POST /api/team/invite-codes`) sets **only `roleType`, never `roleId`**.

On redeem (`POST /api/team/invite-code/redeem`), role resolution is:
`roleId = inviteCode.roleId` → else find a `userRole` whose name matches `roleType`
→ else **silently fall back to the Worker role**.

`user_roles` is a **global** table (no `businessOwnerId` scope, no unique constraint
on `name`). A "Subcontractor" role only exists if something created it (demoData
creates it; `POST /api/team/invite-codes` does NOT). So in a fresh real business a
subcontractor code redeem found no Subcontractor role and downgraded the member to
**Worker** — owner's Team page then shows "Worker / Field worker".

**Fix:** in redeem, if `roleType==='subcontractor'` and no match, **create** the
Subcontractor role (use `ROLE_PRESETS.subcontractor` permissions/description, matching
the existing precedent in the invite-by-email route) instead of falling back to Worker.

**Also:** `business_settings.accountType` (default `'business'`) is the flag that makes
`my-role` return the "Subcontractor" label in the joiner's Personal workspace. Mobile
onboarding posts `accountType:'subcontractor'` via `/api/business-settings`, but the
redeem flow historically never set it. Redeem now sets it **only when the joiner has no
real own-business** (placeholder/empty `businessName`) so it never clobbers an
established owner who joins another business as a sub.

**Two caveats that remain:**
- Code fixes only **future** redeems. Members already wrongly assigned Worker need a
  one-time data repair (set their `team_members.roleId` to a Subcontractor role).
- Owner's Team-page "Role" picker only offers Subcontractor if that global role exists.
