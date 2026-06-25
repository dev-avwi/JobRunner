---
name: Feature-permission backfill when server-gating menu-visible features
description: Why gating an existing menu-visible feature's API routes needs a DB role backfill, and how to do it safely.
---

When you newly gate API routes (createPermissionMiddleware) for a feature that
the mobile menu ALREADY shows to certain roles, enforcement can silently REMOVE
access from existing users — violating the "no removal" rule.

**Why:** mobile `navigation-config.ts` shows items via `allowedRoles` keyed by
the NORMALISED role name (`use-user-role.ts`: any name containing
manager/admin/supervisor -> 'manager'; owner -> 'owner'). The menu shows
regardless of whether the role's stored permissions array carries the new key.
So a DB role row created BEFORE the key was added to the preset still shows the
menu but now 403s the gated route.

**How to apply:** add an additive + idempotent backfill (see
`backfillFeaturePermissions()` in `server/routes/middleware.ts`, wired
fire-and-forget in `server/index.ts` next to `backfillSignupDayActivity`).
- Append the GRANULAR keys (view_*), not coarse read_* — presets store granular,
  `expandPermissions()` bridges granular->coarse at request time, and mobile UI
  reads raw granular strings off /api/team/my-role.
- Target rows whose `LOWER(name)` matches the same names the menu exposes
  (manager/admin/supervisor/office). Skip rows with '*' or already-complete.
- Also backfill `team_members.custom_permissions` where
  `use_custom_permissions=true` and the linked role name qualifies (custom-perm
  managers still see the menu by role name).
- permissions/custom_permissions are `json` type — cast to jsonb for the
  array_agg(DISTINCT) merge, cast back to `::json`.
- Leave plain worker/staff/subcontractor rows alone — their 403 is the intended
  enforcement.
