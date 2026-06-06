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

## IDOR-by-id storage footgun
Several storage methods take only an `id` with no owner predicate (e.g. `getStylePreset(id)`,
`deleteStylePreset(id)`, `getQuoteTemplate(id)`). GET/PATCH/DELETE-by-id handlers that call
them leak/mutate across businesses. **Fix at the route layer** (don't change storage
signatures — other callers): fetch first, then
`if (!row || row.userId !== req.userId) return res.status(404)`. Use 404 (not 403) so you
don't leak existence. Match the existing per-resource scoping field (some handlers use
`req.user.id`, some `req.userId`, some `effectiveUserId` — mirror the sibling list/POST
handler for that resource rather than introducing a new one).
