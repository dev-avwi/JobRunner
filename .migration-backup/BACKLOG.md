# JobRunner Engineering Backlog

Last audit: this session. Scope: `server/routes.ts` (51,810 lines, 1,065 routes), `server/storage.ts` (8,533 lines, ~692 methods), `shared/schema.ts` (4,917 lines), `client/src/pages/*`, `client/src/components/*`, `mobile/app/*`, `mobile/src/*`.

---

## Status of previously-known Tier 1 items

| # | Item | Status |
|---|------|--------|
| T1 #1 | Split `server/routes.ts` (51,810 lines, 1,065 routes) | **DEFERRED** — risk/value tradeoff; revisit when extracting a feature module |
| T1 #2 | Aggregate endpoints for Integrations + WHS Hub | **DONE this session** — commits `b7113a32`, `399a07a3`, `6aa9f90d`. `GET /api/integrations/status` and `GET /api/whs/summary` now fan out via `Promise.all` |
| T1 #3 | Today / home dashboard waterfall queries | **DEFERRED (next-up)** — `Dashboard.tsx` + `useDashboardKPIs`/`useTodaysJobs`/`useRecentActivity` still hit 3+ endpoints; KPI endpoint internally calls `getJobs/getInvoices/getQuotes` separately |
| T1 #4 | Reply threading in chat / comments | **DEFERRED** — `jobChat`, `teamChat`, `directMessages` (shared/schema.ts:2961-3024) have no `parentId` / `threadId` / `replyTo` columns |

---

## Tier 1 — Critical / High-impact (1–2 weeks)

### 1. Mobile job detail screen is 13,091 lines in a single file
**Why it matters:** `mobile/app/job/[id].tsx` is unmaintainable, hot-reloads slowly, and any bug touches the entire core job flow. High crash + regression risk on the most-used screen.
**Files:** `mobile/app/job/[id].tsx`
**Effort:** XL  **Risk:** High

### 2. Mobile home tab is 5,286 lines and likely owns most of the dashboard waterfall
**Why it matters:** `mobile/app/(tabs)/index.tsx` is the first screen every tradie sees; size + uses raw `api.*` calls (not React Query) so caching/invalidation is ad-hoc and re-fetches on every focus.
**Files:** `mobile/app/(tabs)/index.tsx`, `mobile/src/lib/api.ts`
**Effort:** L  **Risk:** High

### 3. Web JobDetailView is 4,864 lines with 39+ inline queries
**Why it matters:** `client/src/components/JobDetailView.tsx` triggers a query waterfall on open (jobs/clients/quotes/invoices/checklist/photos/notes/materials/variations/equipment/chat/etc.). Slow first paint, frequent stale-cache bugs.
**Files:** `client/src/components/JobDetailView.tsx`
**Effort:** L  **Risk:** Medium

### 4. Settings.tsx is 4,683 lines — billing + integrations + branding + theme in one tree
**Why it matters:** Bundle bloat on every login, frequent merge conflicts, and high blast radius for billing-tab bugs.
**Files:** `client/src/components/Settings.tsx`
**Effort:** L  **Risk:** Medium

### 5. Today dashboard fan-out (carry-over T1 #3)
**Why it matters:** Three separate endpoints (`/api/dashboard/kpis`, `/api/jobs/today`, `/api/dashboard/activity`) each re-query jobs/invoices/quotes server-side. Web + mobile both pay this cost on every cold start.
**Files:** `server/routes.ts:25556-25928` (dashboard endpoints), `client/src/hooks/use-dashboard-data.ts`, `client/src/components/{Dashboard,TradieDashboard,TeamOwnerDashboard,OwnerManagerDashboard}.tsx`
**Effort:** M  **Risk:** Medium

### 6. Reply threading missing on chat / comments (carry-over T1 #4)
**Why it matters:** `job_chat`, `team_chat`, `direct_messages` lack `parentId` — users can't reply-in-thread, hurting the collab UX advertised in `replit.md`. Adding later requires a backfill migration.
**Files:** `shared/schema.ts:2961-3024`, all chat UIs (`client/src/components/JobChat.tsx`, `client/src/pages/{ChatHub,TeamChat,DirectMessages}.tsx`, `mobile/app/job/chat.tsx`)
**Effort:** M  **Risk:** Medium

### 7. ~2,291 `any`/`as any` usages in `server/routes.ts`
**Why it matters:** Effectively defeats the type system on the API boundary. Real bugs (missing fields, wrong shapes) reach runtime. Most `req: any` handlers also bypass auth/permission typing.
**Files:** `server/routes.ts`
**Effort:** L (incremental)  **Risk:** Medium

### 8. Webhook attack surface — verify signatures everywhere
**Why it matters:** Stripe is verified (`server/webhooks.ts:13`), Twilio is verified (`twilioClient.ts:710`), Vapi has secret check (`vapiService.ts:62-79`), but SendGrid (`server/sendgridWebhook.ts`), Apple IAP server notifications, and Xero webhook handlers need an explicit audit. Unverified webhooks → forged billing/payment state.
**Files:** `server/sendgridWebhook.ts`, `server/webhookHandlers.ts`, `server/stripeClient.ts`, `server/xeroService.ts`
**Effort:** M  **Risk:** High

### 9. Mobile API base URL hard-codes a Replit dev domain
**Why it matters:** `mobile/src/lib/api.ts:22` returns a `*.worf.replit.dev` URL for non-prod builds. If it ever ships in a TestFlight/Play build, every device hits a sandbox host. App-store-submission risk.
**Files:** `mobile/src/lib/api.ts`, `mobile/app.config.ts`, `mobile/eas.json`
**Effort:** S  **Risk:** High

### 10. `setInterval` cleanup of rate-limit table runs forever in-process
**Why it matters:** `server/routes.ts:408-430` registers an interval that imports `idempotencyKeys` lazily on every tick and silently swallows DB errors. On multi-instance deploys this causes thundering-herd deletes; on shutdown it leaks a timer.
**Files:** `server/routes.ts:408-430`, plus the `setInterval` patterns sprinkled across services
**Effort:** S  **Risk:** Medium

### 11. ~225 places handle subcontractor portal/session tokens — needs a single helper
**Why it matters:** Token verification is duplicated across many routes; one wrong copy = broken tenant isolation on the public job/portal flow. High security blast radius.
**Files:** `server/routes.ts` (search `subcontractor.*token|portal.*token`), `server/services/assignmentWorkflowService.ts`
**Effort:** M  **Risk:** High

### 12. No test coverage on core flows
**Why it matters:** Only `tests/guided-tour.test.ts` exists. Quote → invoice → payment, Stripe webhooks, Apple IAP receipts, and subcontractor token gates ship untested. Regressions ship to billing every release.
**Files:** `tests/`, plus add Vitest/Playwright + supertest harness
**Effort:** L  **Risk:** High

### 13. Mobile money/IAP screens lack store-review prompts and required UI guards
**Why it matters:** No `expo-store-review` usage anywhere in `mobile/`. Apple guideline 1.1.6 + 3.1.1 expect restore-purchase + EULA/manage-subscription links visible from IAP screens. Submission rejection risk.
**Files:** `mobile/app/(tabs)/money.tsx`, `mobile/app/more/subscription.tsx`, `mobile/src/lib/iap.ts`
**Effort:** S  **Risk:** High

---

## Tier 2 — Important / Medium-impact (1–3 months)

### 1. Split the giant pages (web)
**Why it matters:** `TeamOperations.tsx` (4,275), `AdminDashboard.tsx` (3,589), `TemplatesHub.tsx` (3,475), `DispatchBoard.tsx` (3,426), `ChatHub.tsx` (3,277), `InventoryPage.tsx` (2,761), `WhsHub.tsx` (2,703) — bundle bloat, slow tab cold-start, frequent merge conflicts.
**Files:** `client/src/pages/{TeamOperations,AdminDashboard,TemplatesHub,DispatchBoard,ChatHub,InventoryPage,WhsHub}.tsx`
**Effort:** XL  **Risk:** Medium

### 2. Split the giant mobile screens
**Why it matters:** `mobile/app/more/{collect-payment,team-management,settings,templates,time-tracking,team-operations,inventory,ai-receptionist,calculators,reports,dispatch-board,payment-hub}.tsx` are all 1.8k–3.8k lines. Slow Metro reloads, RN render-thread jank.
**Files:** `mobile/app/more/*.tsx` (12 files)
**Effort:** XL  **Risk:** Medium

### 3. Split `mobile/src/lib/offline-storage.ts` (4,348 lines)
**Why it matters:** Core SQLite + sync-queue + conflict resolution in one file → impossible to unit-test, and offline regressions erode the headline mobile value prop.
**Files:** `mobile/src/lib/offline-storage.ts`, `mobile/src/lib/store.ts` (2,655)
**Effort:** L  **Risk:** Medium

### 4. Split `server/storage.ts` (8,533 lines / ~692 methods) by domain
**Why it matters:** Single `IStorage` god-interface; `routes.ts` calls `storage.*` 2,179 times. Splitting into `JobStore`, `BillingStore`, `ChatStore` etc. unlocks per-domain refactor + tests.
**Files:** `server/storage.ts`
**Effort:** XL  **Risk:** Medium

### 5. Split `shared/schema.ts` (4,917 lines)
**Why it matters:** Every server file pulls one mega-module → slow TS compile, slow IDE jump-to-def. Drizzle supports per-domain barrel re-exports.
**Files:** `shared/schema.ts`
**Effort:** L  **Risk:** Low

### 6. Add error boundaries around mobile tab roots and key web hubs
**Why it matters:** Mobile only wraps `_layout.tsx` and `(tabs)/map.tsx`. Web only wraps `App.tsx` root. A crash in one tab/screen blanks the entire app.
**Files:** `mobile/app/(tabs)/{index,jobs,money,profile}.tsx`, `mobile/app/job/[id].tsx`, `client/src/pages/{TeamOperations,DispatchBoard,WhsHub,ChatHub,InventoryPage}.tsx`
**Effort:** M  **Risk:** Low

### 7. React Query for the mobile app
**Why it matters:** Mobile uses raw `api.*` calls + Zustand caches. `mobile/app/job/[id].tsx` makes 111 API calls; no de-dup, no background refetch, no retry. Adopt `@tanstack/react-query` for parity with web.
**Files:** `mobile/src/lib/api.ts`, `mobile/app/(tabs)/*`, `mobile/app/job/[id].tsx`, hooks under `mobile/src/hooks/`
**Effort:** XL  **Risk:** Medium

### 8. Telemetry: client-side analytics + Sentry sourcemaps
**Why it matters:** `client/src/lib/analytics.ts` is empty/no-op. No funnel data on onboarding, quote→accept, invoice→paid. Sentry is wired but sourcemap upload + RN release tagging not verified.
**Files:** `client/src/lib/analytics.ts`, `mobile/src/lib/sentry.ts`, `server/instrument.ts`
**Effort:** M  **Risk:** Low

### 9. Code-split web routes
**Why it matters:** `client/src/App.tsx` (1,782 lines) imports 85 page components eagerly; first paint pays for AdminDashboard + LandingPage + every Hub. Use `React.lazy` per route + Suspense skeletons.
**Files:** `client/src/App.tsx`, `client/src/lib/routePrefetch.ts`
**Effort:** M  **Risk:** Low

### 10. Polling-based realtime: 23 `refetchInterval`/`setInterval` sites
**Why it matters:** Many pages (`AIReceptionist`, `JobMap`, `ActionCenter`, `Autopilot`, `CommunicationsHub`, `Integrations`) poll every few seconds. Combined with the dashboard fan-out this saturates the API in busy crews. WebSocket already exists — migrate the heaviest pollers.
**Files:** `client/src/pages/*` (search `setInterval|refetchInterval`), `server/websocket.ts`
**Effort:** L  **Risk:** Medium

### 11. Accessibility audit (web + mobile)
**Why it matters:** Only 4 `aria-*`/`role=` matches in `client/src` and ~7 `accessibilityLabel` matches in mobile. Buttons/icons missing labels; mobile fails iOS VoiceOver and screen-reader review.
**Files:** `client/src/components/*`, `mobile/src/components/*`
**Effort:** L  **Risk:** Medium

### 12. Index review on hot tables
**Why it matters:** `shared/schema.ts` defines only 36 `index()` calls across ~120 tables. Hot read paths (jobs by user/status/date, invoices by user/status, location_pings, sms_messages, activity_feed, time_entries) likely table-scan.
**Files:** `shared/schema.ts`, `migrations/`
**Effort:** M  **Risk:** Medium

### 13. ~1,107 raw `throw new Error` / 5xx sites with inconsistent shapes
**Why it matters:** API consumers (web, mobile, integrations) get strings vs `{error}` vs `{message}`. Mobile retry/offline-queue can't reliably classify failures.
**Files:** `server/routes.ts` (whole file), `client/src/lib/queryClient.ts`, `mobile/src/lib/api.ts`
**Effort:** M  **Risk:** Low

### 14. Ad-hoc fallback `Map`s in routes (rate-limit + idempotency + en-route)
**Why it matters:** Three in-process maps (`fallbackChatMap`, `fallbackPortalMap`, `fallbackEnRouteMap`, `idempotencyMemCache`) bypass DB on errors and don't sync across instances. Race conditions on multi-instance deploy.
**Files:** `server/routes.ts:258-430`
**Effort:** M  **Risk:** Medium

---

## Tier 3 — Nice-to-have / Strategic

### 1. Domain-driven server module layout
**Why it matters:** Move from `routes.ts` + `storage.ts` god-files to `server/modules/{jobs,billing,chat,whs,team,integrations}/{routes,store,service}.ts`. Long-term scalability.
**Files:** server tree
**Effort:** XL  **Risk:** High

### 2. Generate API types end-to-end
**Why it matters:** Client + mobile maintain their own response shapes. Add `zod-to-openapi` or trpc-style inference so a route change breaks the client compile.
**Files:** `server/routes.ts`, `client/src/lib/queryClient.ts`, `mobile/src/lib/api.ts`
**Effort:** L  **Risk:** Medium

### 3. Storybook / component sandbox for `client/src/components`
**Why it matters:** 200+ components with no isolated harness; designers/devs can't iterate without booting the full app.
**Files:** `client/src/components/*`
**Effort:** M  **Risk:** Low

### 4. Replace polling with full WebSocket subscriptions
**Why it matters:** Extend the realtime layer to cover dashboard counts, AI-receptionist call list, and dispatch board, not just notifications.
**Files:** `server/websocket.ts`, polling sites in Tier 2 #10
**Effort:** L  **Risk:** Medium

### 5. Background jobs in a real queue
**Why it matters:** `setInterval` schedulers (`reminderScheduler`, `staleTimerService`, `overtimeNudgeService`, `billingReminderService`) run in-process and don't survive multi-instance scaling. Move to BullMQ / pg-boss.
**Files:** `server/{reminderScheduler,staleTimerService,overtimeNudgeService,billingReminderService,retryScheduler}.ts`
**Effort:** L  **Risk:** Medium

### 6. Feature-flag system
**Why it matters:** Rolling out things like reply threading, new dashboard, new dispatch UX needs cohort/percentage rollout. Currently every push is to 100% of users.
**Files:** new `server/featureFlags.ts`, integrate with existing `useUserRole`/subscription
**Effort:** M  **Risk:** Low

### 7. Documentation site / runbooks
**Why it matters:** `replit.md` and many `*_REPORT.md`/`*_PLAN.md` docs at repo root are scattered. Consolidate `/docs` with onboarding, deploy, on-call runbooks.
**Files:** `docs/`, root `*.md`
**Effort:** M  **Risk:** Low

### 8. Admin observability dashboard
**Why it matters:** No internal page surfaces queue depth, scheduler last-run, webhook failures, Stripe Connect onboarding stalls, or AI receptionist call success rate.
**Files:** `client/src/pages/AdminDashboard.tsx`, new `/api/admin/observability`
**Effort:** L  **Risk:** Low

### 9. Mobile theming overlap
**Why it matters:** `mobile/src/lib/{theme.tsx,theme-store.ts,advanced-theme-store.ts,colors.ts,design-tokens.ts}` plus `mobile/global.css` and `mobile/tailwind.config.js` (NativeWind) all describe colors. Pick one source of truth.
**Files:** `mobile/src/lib/*theme*`, `mobile/tailwind.config.js`
**Effort:** M  **Risk:** Medium

### 10. Soft-delete + audit standardization
**Why it matters:** Only one `deletedAt` reference across `shared/schema.ts`. Hard deletes for jobs/clients/invoices break analytics + accounting integrations. Add `deletedAt` + restoration.
**Files:** `shared/schema.ts`, `server/storage.ts` getters
**Effort:** L  **Risk:** Medium

### 11. Calendar/scheduling micro-service split
**Why it matters:** Google Calendar + Outlook + recurring + dispatch + WHS site dates all live in `routes.ts`. Extracting a scheduling service unblocks future ETA/route-optimisation work.
**Files:** `server/{googleCalendarClient,outlookClient,recurringService}.ts`, scheduling routes
**Effort:** XL  **Risk:** High

### 12. Visual regression testing on key web pages
**Why it matters:** Heavy UI (DispatchBoard, ChatHub, JobDetail) regresses silently. Add Playwright + screenshot diffs for top 10 routes.
**Files:** `tests/`, CI config
**Effort:** M  **Risk:** Low

### 13. Move generated PDF rendering off the request thread
**Why it matters:** Puppeteer in-process blocks the Node loop on PDF render; under load this stalls all API calls. Move to a worker pool or external renderer.
**Files:** `server/pdfService.ts`
**Effort:** M  **Risk:** Medium
