---
name: RouteGuard deny-by-omission
description: Client route silently redirects to dashboard when it has no PAGE_PERMISSIONS entry
---

Every authenticated client route is wrapped by `RouteGuard` (client/src/components/RouteGuard.tsx), which calls `canAccessRoute(location)` → `canAccessPath(role, path)` in `client/src/lib/permissions.ts`. `canAccessPath` looks the path up in the `PAGE_PERMISSIONS` array (exact match or `:param`→regex). If no entry matches AND the path isn't in the hardcoded public-prefix allowlist, it returns **false** → RouteGuard redirects to `/` (or `/jobs` for staff_tradie).

**Why:** deny-by-default. A brand-new route that renders fine on its own will still bounce to the dashboard on mount if you forget to register it in `PAGE_PERMISSIONS`. The redirect is synchronous on mount, so the page's own data query (e.g. GET /api/.../:id) never even fires — looks like a server/query bug but isn't.

**How to apply:** whenever you add a route in `client/src/App.tsx`, add a matching `PAGE_PERMISSIONS` entry (path + allowedRoles + `showInNav`). Use `:id`-style params (regex-matched). Form/job-card builder pages (`/forms/new`, `/forms/:id/edit`) use the same allowedRoles as `/templates` and `/custom-forms`: `['owner','solo_owner','manager','staff_tradie']`.

To debug a mysterious "lands on dashboard" redirect: hook `history.pushState` in a Puppeteer repro and print `new Error().stack` — the stack names the exact component (RouteGuard) doing the `setLocation('/')`.
