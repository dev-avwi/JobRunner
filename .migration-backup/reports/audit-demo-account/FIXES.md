# Web App E2E Audit — Fix Report (Task #240)

Demo account: `demo@jobrunner.com.au` (tier: team, onboarding complete). Dev app on port 5000.
`npm run check`: 0 errors. App health: 200.

## Gaps fixed (real code defects)

### G1 — `/website` redirected to dashboard
**Root cause:** `/website` was missing from `PAGE_PERMISSIONS` (`client/src/lib/permissions.ts`).
`canAccessPath` denies any path not listed and not in the public allowlist, so `RouteGuard`
bounced owners back to the dashboard before the page could render its own upsell/locked state.
**Fix:** Added `/website` entry (owner + solo_owner, `showInNav: false`). The page now loads and
shows its own locked/unlocked addon states.

### G7 — Invoice detail console 404s
**Root cause:** `InvoiceDetailView` queried `/api/business-templates/active/terms_conditions` and
`/warranty` with the default fetcher, which throws on the route's `404 No active template`.
**Fix:** Gave both queries a 404-tolerant `queryFn` (returns `null`), matching the existing
payment-schedule pattern in the same file. Render guards already handle null templates.

### G8 — "What You Missed" popup re-triggered on navigation
**Root cause:** Shown notification ids were only in component state; a full reload within a session
re-showed the same batch.
**Fix:** Persist shown ids to `sessionStorage` so the popup appears once per session per
notification set, surviving route changes and reloads.

### G9 — GA4 blocked by CSP
**Root cause:** `connect-src` in `server/index.ts` did not allow Google Analytics endpoints, so the
gtag beacon in `index.html` was blocked.
**Fix:** Added `https://*.google-analytics.com`, `https://*.analytics.google.com`,
`https://*.googletagmanager.com` to `connect-src`. Verified the domains now appear in the response
CSP header.

## Gaps already resolved in current code (stale in prior report-only audit)

- **G2 `/leads`** — has a loading skeleton and a proper `EmptyState` ("No leads yet"). Demo has 0
  leads, so the empty state is correct, not a blank page.
- **G3 `/subscription`** — renders a loading spinner while `/api/subscription/status` is fetching.
- **G5 `/ai-receptionist`** — shows a "Dedicated Number Required" empty state with a clear CTA to
  Settings when no number is provisioned; also has loading and error states.
- **G6 `/integrations`** — health query has `isLoading`/`isError` states with `retry: false`; per-
  provider account/tax queries also use `retry: false`. No stuck-loading defect in current code.

## Not a defect

- **G4** — public portal tokens (`/p`, `/track`, `/receipt`) are seeded by `server/demoData.ts`;
  inability to reach them in the prior pass was a Bearer-token test limitation, not an app bug.
- **G10** — Vite HMR console noise is dev-only, not a runtime defect.
