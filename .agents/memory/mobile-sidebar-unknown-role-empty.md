---
name: Worker sidebar empty for unknown roles
description: SidebarNav role normalization must fall back to 'staff' for unrecognized non-owner roles or the whole menu disappears
---

In the mobile `SidebarNav`, `normalizedRole` maps the raw role string to a known
`UserRole`. If a team member has a custom/unrecognized role string, the old code
did `return r as UserRole` — that value matches no item's `allowedRoles`, so
`filterSidebarItems` strips everything and the worker sees a completely empty
sidebar (dashboard still renders, so it looks role-specific, not a load failure).

**Fix / rule:** after the explicit role checks and the owner fallbacks, add
`if (user?.id) return 'staff'` so any authenticated non-owner with an unknown role
gets the worker menu (`'staff'` is present in the worker items' `allowedRoles`).
Keep the order: empty role string → owner (solo default); non-empty unknown → staff.

**Why:** least-privilege + the worker nav items list `team`/`staff`/`staff_tradie`
in allowedRoles, so 'staff' is the safe catch-all for any non-owner.
