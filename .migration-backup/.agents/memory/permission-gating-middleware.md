---
name: Permission gating middleware choice
description: Which gating middleware to use on mutating routes, and the ownerOrManagerOnly footgun
---

When gating a mutating/destructive route, prefer the intent-specific permission via
`createPermissionMiddleware(PERMISSIONS.X)` over the coarse `ownerOrManagerOnly()`.

**Why:** `ownerOrManagerOnly()` (server/permissions.ts) grants on `isOwner || permissions.includes(MANAGE_TEAM)`.
It is NOT a generic "any manager" gate — it is specifically the team-admin permission. Using it for a
feature that has its own permission (e.g. templates → `MANAGE_TEMPLATES`) causes semantic drift: it lets
team-admins through who lack the feature permission, and blocks custom roles that have the feature
permission but not `MANAGE_TEAM`. A code review failed a round for exactly this on `/api/business-templates`.

**How to apply:**
- Feature has a dedicated permission in PERMISSIONS → use `createPermissionMiddleware(PERMISSIONS.<that>)`.
  Owners always pass (hasAnyPermission grants owner). Place AFTER `requireAuth` (both read `req.userId`).
- No granular permission exists (e.g. suppliers, purchase-orders, service-reminders) → `ownerOrManagerOnly()`
  is the acceptable coarse "management only" gate.
- Public payment/view routes that must stay unauthenticated: add `portalIpRateLimiterMiddleware` for
  anti-enumeration, never an auth middleware (would block paying customers).
