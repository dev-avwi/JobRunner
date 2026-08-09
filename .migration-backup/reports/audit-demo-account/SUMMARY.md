# JobRunner — Demo Account UI/UX Audit (Web)

**Scope:** Full UI/UX review of the JobRunner web application against populated demo data, across all roles. Audit/report only — no production code was changed.
**Date:** 12 June 2026
**Environment:** Dev preview on port 5000 (`/api/health` OK). All routes exercised against the running app, not the mockup sandbox.
**Primary account:** `demo@jobrunner.com.au` / `demo123` — *Mike's Plumbing Services* (ABN 12 345 678 901), populated with real jobs, clients, quotes, invoices, time entries and receipts.

---

## 1. Method & Limitations (read first)

- **Owner pages** were driven live (logged-in) via the Playwright testing subagent in four batches; each page was visited and visually inspected against demo data. Raw outputs in `raw/batch1..batch3b.json`.
- **Public pages** (unauthenticated) were captured directly with the screenshot tool — see `screenshots/`.
- **Role access matrix** (Section 3) is derived from the **authoritative RBAC source** (`client/src/lib/permissions.ts`, mirrored by `server/permissions.ts`), not only from clicking around. This is the source of truth the app itself uses for nav filtering and route guards.
- **Known limitations of this audit:**
  - **Authenticated screenshots could not be saved programmatically.** The app is Bearer-token-only, so the screenshot tool (which drives an unauthenticated preview) can only capture *public* pages. The testing harness only returns screenshots on test *failure*. Owner/role page assessments therefore rest on the subagent's live visual inspection, not saved images. Saved images exist only for public pages and a handful of incidental test-failure frames.
  - **Empirical worker / subcontractor / manager walkthroughs were blocked** by a hard global testing-iteration cap (10 runs) reached during this session. Those three rows of the access matrix are therefore derived from the authoritative permission config rather than live clicks. The owner row *was* exercised live and matches the config, which gives confidence the config reflects reality.
  - **Demo data does not seed public job-portal / tracking / receipt tokens** (`job_portal_tokens`, `sms_tracking_links`, `receipts.view_token` are all empty/null), so `/p/:token`, `/track/:token`, `/receipt/:token` and `/portal/:type/:token` could not be exercised end-to-end. Invoice payment tokens *are* seeded, so `/pay/:token` was fully verified.

---

## 2. Consolidated Gap Log

Severity: **High** = blocks a core demo flow / data loss risk · **Med** = degraded experience or unclear state · **Low** = polish / noise · **Info** = environment-only, not a product bug.

| ID | Area | Sev | Finding | Recommendation |
|----|------|-----|---------|----------------|
| G1 | `/website` (owner) | **Med** | Direct navigation to the Website builder **redirects to the dashboard** — the page is effectively unreachable from a deep link in the demo. | Confirm whether this is intended gating (tier/feature flag). If gated, show a clear upsell/empty state instead of a silent redirect. |
| G2 | `/leads` (owner) | **Med** | Leads / CRM page renders **blank** for the owner against demo data. | Add an empty state ("No leads yet") and/or seed demo leads; verify the data fetch isn't failing silently. |
| G3 | `/subscription` (owner) | **Med** | Rendered **blank on first load**, then displayed correctly on retry — intermittent/slow hydration on a billing-critical page. | Add a loading skeleton and ensure the plan/billing data resolves on first paint. |
| G4 | Demo data completeness | **Med** | No seeded tokens for client job portal (`/p/:token`), SMS tracking (`/track/:token`), or receipts (`/receipt/:token`). These public artefacts can't be demoed. | Seed one each in demo data so the full client-facing experience is demonstrable. |
| G5 | `/ai-receptionist` (owner) | **Med** | Page requires a **dedicated phone number** that the demo account doesn't have; lands in a blocked/empty configuration state. | Seed a demo number or show a guided "Get a number" setup state rather than a dead end. |
| G6 | `/integrations` & `/equipment` | **Low** | `/integrations` was observed **stuck in a loading state**; `/equipment` loads **slowly**. | Add timeouts + error/empty states; investigate the integrations health fetch (see runbook). |
| G7 | Invoice detail (owner) | **Low** | Console **404** on the active business-template endpoint while loading an invoice detail page (page still renders). | Handle missing-template 404 gracefully (fallback template) to remove the console error. |
| G8 | Global UX | **Low** | The **"What You Missed" overlay** reappears intrusively across many routes during navigation. | Make it dismissible-once per session; don't re-trigger on every route change. |
| G9 | Analytics / CSP | **Low** | GA4 is initialised but **blocked by CSP** (`connect-src` refuses `google-analytics.com`), so `net::ERR_FAILED` fires and analytics never sends. | Either add GA to the CSP allowlist or stop initialising GA in this environment to remove the recurring console error. |
| G10 | Dev tooling | **Info** | Recurring `WebSocket handshake 400` to the Vite HMR socket and a `net::ERR_FAILED`. | **Not a product bug** — Vite dev-server HMR noise only; absent in production builds. No action. |

---

## 3. Per-Role Access Matrix

Source of truth: `client/src/lib/permissions.ts` (`PAGE_PERMISSIONS` + `getActionPermissions`), mirrored server-side by `server/permissions.ts`. Roles: **Owner/Solo Owner**, **Manager**, **Office Admin**, **Staff Tradie (worker)**. Subcontractors join via magic-link and are treated as staff-tradie-equivalent for page access.

`✓` = full access · `~` = limited/scoped view · `✗` = no access/redirect · `nav` = also shown in sidebar.

### 3a. Page access

| Page | Owner | Manager | Office Admin | Staff Tradie |
|------|:-----:|:-------:|:------------:|:------------:|
| Dashboard `/` | ✓ nav | ✓ nav | ✓ nav | ✓ nav |
| Work `/work` | ✓ nav | ✓ nav | ✓ nav | ✓ nav |
| Jobs `/jobs` | ✓ nav | ✓ nav | ✓ nav | ~ assigned only, nav |
| New / Edit Job | ✓ | ✓ | ✗ | ✗ |
| Clients `/clients` | ✓ nav | ✓ nav | ✓ nav | ✗ (detail only) |
| Quotes `/quotes` | ✓ nav | ✓ nav | ✓ nav | ✗ |
| Invoices `/invoices` | ✓ nav | ✓ nav | ✓ nav | ✗ |
| Documents `/documents` | ✓ nav | ✓ nav | ✓ nav | ✗ |
| Schedule / Calendar | ✓ nav | ✓ nav | ✓ nav | ~ own jobs, nav |
| Dispatch `/dispatch` | ✓ nav | ✓ nav | ✗ | ✗ |
| Time Tracking | ✓ nav | ✓ nav | ✗ | ✓ nav |
| Team Operations `/team-operations` | ✓ nav | ✓ nav | ✗ | ✗ |
| Map `/map` | ✓ nav | ✓ nav | ✗ | ~ own jobs, nav |
| Reports `/reports` | ✓ nav | ✓ nav | ✗ | ✗ |
| Payment Hub / Collect Payment | ✓ nav | ✓ nav | ✓ nav | ✗ |
| Expenses `/expenses` | ✓ nav | ✓ nav | ✓ nav | ✓ nav |
| Leads `/leads` | ✓ nav | ✓ nav | ✓ nav | ✗ |
| Inventory & Equipment | ✓ nav | ✓ nav | ✗ | ✗ |
| Templates `/templates` | ✓ nav | ✓ nav | ✗ | ~ safety forms, nav |
| Files `/files` | ✓ nav | ✓ nav | ✓ nav | ✓ nav (RBAC-filtered) |
| WHS Safety `/whs` | ✓ | ✓ | ✓ | ✓ |
| Communications `/communications` | ✓ nav | ✓ nav | ✓ nav | ✗ |
| Chat `/chat` | ✓ nav | ✓ nav | ✓ nav | ✓ nav |
| Action Centre / Insights | ✓ nav | ✓ nav | ✗ | ✗ |
| Autopilot `/autopilot` | ✓ nav | ✗ | ✗ | ✗ |
| Integrations `/integrations` | ✓ nav | ✗ | ✗ | ✗ |
| Settings `/settings` | ✓ nav | ~ limited, nav | ✗ | ~ profile/appearance, nav |
| Subscription / Billing / Payouts | ✓ | ✗ | ✗ | ✗ |
| Automations `/automations` | ✓ | ✗ | ✗ | ✗ |
| AI Receptionist `/ai-receptionist` | ✓ | ~ partial | ✓ | ~ self-availability |
| Admin `/admin/*` | ✓ (platform admin) | ✗ | ✗ | ✗ |

### 3b. Key action permissions (`getActionPermissions`)

| Action | Owner | Manager | Office Admin | Staff Tradie |
|--------|:-----:|:-------:|:------------:|:------------:|
| Create / Edit jobs | ✓ | ✓ | ✗ | ✗ |
| Delete jobs | ✓ | ✗ | ✗ | ✗ |
| Assign jobs | ✓ | ✓ | ✗ | ✗ |
| Create/Edit clients | ✓ | ✓ | ✓ | ✗ |
| Create/Edit/Send quotes | ✓ | ✓ | ✓ | ✗ |
| Create/Edit/Send invoices | ✓ | ✓ | ✓ | ✗ |
| Delete quotes/invoices/clients | ✓ | ✗ | ✗ | ✗ |
| Manage team | ✓ | ✓ (no remove) | ✗ | ✗ |
| Manage settings / billing | ✓ | ✗ | ✗ | ✗ |
| Manage templates / automations / integrations | ✓ | ✗ | ✗ | ✗ |
| View all jobs | ✓ | ✓ | ✓ | ✗ (own only) |
| View reports | ✓ | ✓ | ✗ | ✗ |
| View map | ✓ | ✓ | ✗ | ✓ |
| Use dispatch | ✓ | ✓ | ✗ | ✗ |

**RBAC observations:** the model is coherent and well layered — Office Admin is a "back-office, no field work" role (full quotes/invoices/clients, no jobs/dispatch/map), Manager is "owner minus billing/settings/destructive deletes", Staff Tradie is correctly scoped to *assigned* jobs with map for their own work. Client contact details are sanitised for non-privileged roles server-side (see `business-settings-worker-sanitization` / client-data-sanitization in the architecture notes). No obvious privilege-escalation gaps in the config.

---

## 4. Per-Page Audit (Owner, against demo data)

Ratings reflect rendering, data richness, and UX from live inspection. 10 = excellent, demo-ready; 5 = works but rough; <5 = broken/blocked.

### 4.1 Core (batch1 — all render with real data)

**Dashboard `/` — 9/10**
- *Works:* Loads with real "Today" context (greeting, attention-needed alerts, unassigned-job nudges, un-invoiced jobs, today's schedule). Strong information hierarchy; the headline value prop of the product is visible immediately.
- *Gaps:* The "What You Missed" overlay (G8) competes with the dashboard's own alerts.

**Jobs `/jobs` + detail — 9/10**
- *Works:* List renders populated jobs with status; detail pages open with client, scheduling and line-item context.
- *Gaps:* None functional.

**Clients `/clients` + detail — 9/10**
- *Works:* Populated client list, detail view with history.
- *Gaps:* None functional.

**Quotes `/quotes` + detail — 8/10**
- *Works:* Real quotes render; detail/editor reachable.
- *Gaps:* No seeded quote acceptance tokens, so the public quote-acceptance flow isn't demoable from this data.

**Invoices `/invoices` + detail — 8/10**
- *Works:* Real invoices (e.g. TT-2026-003, $148.50 AUD with GST) render; payment tokens seeded so the public pay page works.
- *Gaps:* Console 404 on the active business-template endpoint during detail load (G7) — cosmetic.

### 4.2 Back-office (batch2 — all render)

**Schedule / Calendar — 8/10**, **Dispatch Board — 8/10**, **Documents Hub — 8/10**, **Templates — 8/10**, **Reports — 8/10**, **Time Tracking — 8/10**, **Team — 8/10**.
- *Works:* All render with the demo dataset; dispatch board, schedule and reports show populated content. These are among the app's strongest, most differentiated screens.
- *Gaps:* General navigation noise from the "What You Missed" overlay (G8); dev-only WS/ERR_FAILED console noise (G10).

### 4.3 Admin & Comms (batch3a — render)

**Settings — 8/10**, **My Account — 8/10**, **Chat — 8/10**, **Messages — 8/10** (redirects to Chat), **Map — 8/10**, **Action Centre — 8/10**, **Insights — 8/10**, **Autopilot — 8/10**.
- *Works:* All render; map and business-intelligence pages populate.
- *Gaps:*
  - **Integrations — 5/10:** observed stuck in a loading state (G6). Use the per-provider "Test Connection" button (see runbook) to confirm health.
  - **Subscription — 5/10:** blank on first load, fine on retry (G3) — billing-critical, needs a first-paint fix.

### 4.4 Tools & Modules (batch3b)

**Expenses — 8/10**, **Automations — 8/10**, **Inventory — 8/10**, **WHS — 8/10**, **Files — 8/10**, **Rebates — 8/10**, **Calculators — 8/10**, **Payment Hub — 8/10** — all render.
- **Equipment — 6/10:** renders but slow to load (G6).
- **Website `/website` — 3/10:** redirects to dashboard (G1) — unreachable in demo.
- **Leads `/leads` — 3/10:** blank (G2).
- **AI Receptionist `/ai-receptionist` — 4/10:** blocked on a dedicated phone number (G5).

---

## 5. Public / Client-Facing Pages

**Marketing home `/` — 9/10** (`screenshots/public-marketing-home.jpg`)
- Strong, on-brand hero ("Built for how jobs actually run"), clear CTAs, device mockup, "Free plan — no credit card" reassurance. Clean nav (Features / How It Works / Pricing / Download / Client Portal).

**Login `/login` — 9/10** (`screenshots/public-login.jpg`)
- Renders the marketing shell with Log In / Get Started entry points; clean.

**Pay page `/pay/:token` — 10/10** (`screenshots/public-pay-page.jpg`)
- Excellent. Branded ("Mike's Plumbing Services", ABN shown), invoice TT-2026-003 with bill-to, due date, line item, **GST (10%)** breakdown, **Total Due $148.50 AUD**, Download PDF, and "payment is encrypted and secure" trust line. This is the standout public artefact.

**Client Portal hub `/portal` — 8/10** (`screenshots/public-portal-hub.jpg`)
- Clean "Verify Your Identity" mobile-number gate ("We'll send a 6-digit code"), branded, "Back to JobRunner" link. Couldn't proceed past verification without a seeded code/token (G4).

**Not demoable (G4):** `/p/:token` (job portal), `/track/:token` (SMS tracking), `/receipt/:token` — no seeded demo tokens.

---

## 6. Screenshots Index

Saved in `screenshots/` (all public pages at 1280px):
- `public-marketing-home.jpg` — marketing landing
- `public-login.jpg` — login entry
- `public-pay-page.jpg` — public invoice payment page (token-verified, real invoice)
- `public-portal-hub.jpg` — client portal identity verification
- `AYpMLBO.jpeg`, `E4frh2e.jpeg`, `FOUdKDr.jpeg`, `Qe4m1un.jpeg` — incidental frames returned by the testing harness on test-run failures (unlabelled; retained for reference).

*Authenticated owner/role pages have no saved screenshots — see the screenshot limitation in Section 1. Mobile 400px captures of authenticated pages are likewise not capturable for the same Bearer-only reason; the marketing/login/pay/portal public pages are responsive and render correctly at narrow widths.*

---

## 7. Overall Assessment

JobRunner's demo account is **strong and demo-ready for the core owner journey** — dashboard, jobs, clients, quotes, invoices, scheduling, dispatch, reports and the public pay page all render with rich, realistic Australian-tradie data (GST, AUD, ABN). The RBAC model is coherent and correctly layered across four roles.

The headline gaps are a small number of **blocked/blank owner pages** (`/website` redirect, `/leads` blank, `/subscription` first-load blank, `/ai-receptionist` needs a number) and **demo-data completeness for client-facing public tokens** (portal/tracking/receipt). None are data-loss risks; most are empty-state / seeding / first-paint issues. The recurring console noise is overwhelmingly dev-only (Vite HMR) plus a CSP-blocked GA4 call — neither affects the product.

**Top 5 fixes for a flawless demo:** G1 (`/website` redirect), G2 (`/leads` blank), G3 (`/subscription` first paint), G4 (seed public tokens), G5 (`/ai-receptionist` demo number).
