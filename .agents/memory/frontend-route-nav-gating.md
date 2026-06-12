---
name: Frontend route + nav gating is role-only by default
description: Worker custom permissions don't unlock pages unless route guard AND nav are both patched
---

The web app's frontend access control has TWO separate role-based gates that ignore
per-member worker permissions (WORKER_PERMISSIONS.VIEW_CLIENTS etc.) unless explicitly wired:

1. Route guard: RouteGuard -> useAppMode.canAccessRoute -> permissions.canAccessPath (role-only).
2. Nav visibility: navigation-config.filterNavItems (role-only: allowedRoles + hideForStaff),
   consumed by THREE places — AppSidebar, BottomNav, More.

The owner UI (TeamOperations.tsx at /team-operations) lets owners toggle worker permissions,
but toggling them did nothing because neither gate read those permissions.

**Rule:** To make a worker permission actually unlock a page you must patch BOTH gates, additively
(never remove existing access): add a hasPermission->path match in canAccessRoute, AND expose
permissionNavUrls from useAppMode + honor an extraAllowedUrls option in filterNavItems + pass it
from all three nav consumers. Keep route-path mappings and nav-url mappings consistent.

**Why:** additive-only respects the IDOR/gating cautions in memory; backend /api/clients already
scopes non-view_all members to assigned-job clients, so frontend was the sole blocker.

**Also:** /team renders Team.tsx (a lighter view); the real editor is /team-operations
(TeamOperations.tsx). Team.tsx's "Roles & permissions"/"Activity log" buttons and member rows
must navigate to /team-operations (they were dead affordances).
