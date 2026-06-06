---
name: RBAC gating audit conventions
description: How to gate requireAuth-only mutation endpoints and the template-permission gotcha; IDOR-by-id storage pattern
---

# Gating ongoing audit — conventions that hold for this app

Owner always passes every permission gate (OWNER role = all PERMISSIONS) and the demo
account (demo@jobrunner.com.au) IS an owner, so adding `createPermissionMiddleware(...)`,
`ownerOnly()`, or `requirePaidTier()` after `requireAuth` NEVER breaks the demo. Verify a
fix by confirming demo returns non-403/402 (400/404/500 from an empty body is fine).

## Template-permission gotcha (got this wrong once)
For template/preset *creation* endpoints (quote-templates, custom-forms, message-templates),
use `createPermissionMiddleware(PERMISSIONS.MANAGE_TEMPLATES)` — NOT `ownerOrManagerOnly()`.
**Why:** `ownerOrManagerOnly()` checks `isOwner || MANAGE_TEAM`, and Managers HAVE
`MANAGE_TEAM` but the role matrix deliberately withholds `MANAGE_TEMPLATES` from them. Using
`ownerOrManagerOnly()` silently grants managers a power the permission model denies.
`MANAGE_TEMPLATES` = Owner + Admin only. (Earlier message-templates round used
ownerOrManagerOnly — that was the same mismatch; prefer the explicit permission.)

## ownerOnly() is safe for onboarding endpoints
`getUserContext().isOwner` is `true` for any user with NO team_membership row, so a
brand-new owner mid-onboarding passes `ownerOnly()`. Workers always have a membership →
isOwner false. So gating `/api/onboarding/complete` + `/clear-demo-data` with `ownerOnly()`
both blocks workers AND prevents a worker from creating a spurious business_settings row
(the owner-self-membership misclassification path).

## Business-shared resources must key on effectiveUserId end-to-end
For resources owned by the business (templates, presets, catalog, etc.) where team
members share the owner's data, list/create/update/delete must ALL resolve identity the
same way: `getUserContext(req.userId).effectiveUserId` (or `req.userContext.effectiveUserId`
if a permission middleware already ran). **Why:** `getUserContext` honors
`users.activeBusinessId` (workspace switching), but `storage.getTeamMembershipByMemberId()`
just returns the FIRST membership. If a GET/list uses raw `req.userId` (which internally
falls back to first-membership) while a mutation's ownership check uses `effectiveUserId`,
a multi-business member can SEE a row in the list but get a false 404 editing it. Fix the
list to pass `effectiveUserId` too. Rows are created under `effectiveUserId`, so members
never own copies under their own raw id — passing effectiveUserId loses nothing.

## IDOR-by-id storage footgun
Several storage methods take only an `id` with no owner predicate (e.g. `getStylePreset(id)`,
`deleteStylePreset(id)`, `getQuoteTemplate(id)`). GET/PATCH/DELETE-by-id handlers that call
them leak/mutate across businesses. **Fix at the route layer** (don't change storage
signatures — other callers): fetch first, then
`if (!row || row.userId !== req.userId) return res.status(404)`. Use 404 (not 403) so you
don't leak existence. Match the existing per-resource scoping field (some handlers use
`req.user.id`, some `req.userId`, some `effectiveUserId` — mirror the sibling list/POST
handler for that resource rather than introducing a new one).
