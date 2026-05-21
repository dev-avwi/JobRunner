### Overview
JobRunner is a mobile-first web application designed for Australian tradespeople. Its primary purpose is to streamline job management, quoting, invoicing, and payment collection, ensuring accurate documentation to minimize disputes and boost efficiency. The platform aims to enhance communication, provide AI-powered business suggestions, manage compliance, and optimize financial operations, all while fully supporting Australian GST and AUD. The project's ambition is to centralize and simplify all aspects of a tradesperson's business.

### User Preferences
Preferred communication style: Simple, everyday language. No emojis. Brief replies. "Work basic, don't overthink."
Demo account for testing: `demo@jobrunner.com.au`.

### System Architecture
JobRunner uses an event-driven architecture with TypeScript. The frontend is a mobile-first React 18 application with shadcn/ui, TailwindCSS, Wouter, and TanStack Query. The backend is an Express.js and TypeScript REST API, using Zod for validation, PostgreSQL, and Drizzle ORM. A dedicated React Native/Expo mobile application integrates with the API, employing Zustand and SQLite for offline capabilities.

Core architectural and design decisions include:

*   **UI/UX**: Mobile-first design with card-based layouts, touch-optimized components, customizable theming, and dynamic layouts. Features like "Today's Schedule" and Smart Address Auto-fill enhance mobile usability.
*   **Authentication**: Supports Email/password, Google OAuth, Apple Sign-In, and Xero OAuth.
*   **Onboarding**: A multi-step wizard for business setup, including Stripe integration and team invitations.
*   **AI Integration**: Utilizes GPT-4o-mini and GPT-4o vision for business suggestions, quote generation, voice note transcription, photo auto-categorization, receipt scanning, SWMS hazard detection, AI Photo Analysis, AI Schedule Optimizer, and a Role-Aware AI Assistant.
*   **AI Receptionist**: A voice-based assistant (Vapi.ai + ElevenLabs) for automated SMS follow-ups, push notifications, call recording, and caller sentiment analysis.
*   **PDF Generation**: Server-side generation of customizable quotes, invoices, and Job Proof Packs, including GPS Worker Presence Verification and photo GPS location stamps.
*   **Subscription & Billing**: A four-tier pricing model with Apple In-App Purchase and Stripe integration, including server-side receipt verification.
*   **Job Workflow**: A 5-stage job status workflow with visual indicators, automated email confirmations, multi-worker time tracking, and real-time availability.
*   **Financial System**: A live quote/invoice editor with real-time preview, catalog integration, digital signatures, invoice locking, and audit trails. Supports various payment methods including Stripe Payment Links, "Tap to Pay Request Flow," and an AI-powered Smart Payment Chaser.
*   **Number Porting (BYOD)**: Allows porting existing phone numbers to the platform with admin-managed workflow and automated AI receptionist activation.
*   **Communication**: Features customizable email automation via SendGrid, PWA support, real-time WebSocket communication, two-way Twilio SMS integration with a unified Chat Hub, and Google Review request automation.
*   **Real-time Updates**: Implemented for job status, timer events, document status, payments, notifications, chat messages, and team presence, with TanStack Query cache invalidation.
*   **Compliance**: Australian WHS-compliant SWMS system with templates, risk matrix, worker sign-off, AI Safety Scan, and a comprehensive WHS Safety module.
*   **Operations & Dispatch**: Features a Team Operations Center, Visual Dispatch Board (Schedule, Kanban, Map views) with conflict detection and live location tracking, and a Smart Operational Action Center.
*   **Multi-Business Workspace Switching**: Enables subcontractors to switch between different business workspaces with data isolation.
*   **Unified Team & Magic-Link Subcontractor Flow**: Centralized team management with magic-link invitations, secure session validation, and account upgrade paths for subcontractors.
*   **Access Control**: Role-Based Access Control (RBAC) with granular permissions, client data sanitization, and navigation elements gated by user roles and subscription levels.
*   **Sentry Filtering**: Mobile Sentry init filters events from sideloaded builds, emulators, and known Android OS-level crashes.
*   **Offline Mode & Media Sync**: Comprehensive offline-first support with intelligent synchronization, merge-aware sync queue, and optimistic UI rollback.
*   **Smart GPS Features**: Provides real ETA in "On My Way" SMS, a Smart Job Dashboard with distance and drive time, and Photo MMS via Twilio. Includes background tracking, geofence notifications, and running late detection.
*   **Track My Arrival**: Public job portal displaying assigned workers with profile images and polished SMS templates for status updates.
*   **Website Addon Interactive Features**: Toggleable features for business websites including Click-to-Call, an AI Chat Widget, and a Booking Form.
*   **Aggregate API Endpoints**: Heavy pages use single aggregate endpoints to avoid request waterfalls, fetching multiple related data sets in parallel with per-section resilience.
*   **Team Seat Enforcement**: Hard server-side seat count enforcement for team member additions based on subscription tier and purchased extra seats.
*   **Founding Member System**: Manual assignment of founding member status provides full business-tier access.
*   **Server-Side Onboarding Guard**: Middleware enforces `onboardingCompleted` for business owners before accessing most API routes.
*   **Stripe Sync Persistence**: Persists live Stripe subscription status and tier to the database to prevent stale data.
*   **Verified Webhook Surfaces**: All inbound webhooks (Stripe, SendGrid, Twilio, Xero, QBO) reject unsigned or wrong-signature requests with HTTP 401 before any side effect, and emit structured JSON logs.
*   **Production Hardening**: Neon-friendly DB pool (max 15, statement_timeout), 30s `/api` request timeout (504), staggered scheduler startup, `/api/health` + `/api/metrics` (per-route p50/p95/p99 + 429/504 counters), graceful pool shutdown on SIGTERM/SIGINT.
*   **Scaling backbone (~100 concurrent users)**: Hot-read LRU+TTL cache (`server/cache.ts`), bounded concurrency queues with backpressure → HTTP 429 + `Retry-After` (`server/concurrency.ts`), per-user rate limiters for heavy endpoints, mobile graceful 429 handling with retry-after, load-test harness in `scripts/load-test.mjs`.
*   **Accounting Integrations**: Xero, QuickBooks Online, MYOB AccountRight — OAuth + token refresh, push invoices/quotes, pull payments, account/tax/item mapping UI, signed webhooks (Xero + QBO), real-time payment/void sync, structured void semantics with credit-note workaround for MYOB. Live Test Connection endpoint per provider returns the upstream tenant/company name.
*   **Mobile Premium Polish**: `AppBottomSheet` is a thin wrapper around the native React Native `<Modal animationType="slide" presentationStyle="pageSheet">` (gorhom dependency removed); typography restored to the May-2 baseline (no fontFamily pinning, weight-driven hierarchy) for premium feel. `PressableRow`/`PressableCard` primitives give Android Material ripple + iOS scale/haptic feedback; `useBottomInset`/`usePageShell` handle safe-area + tablet padding. Edge-to-edge Android with predictive back, monochrome adaptive icon, ProGuard + resource shrinking on release.

### External Dependencies
*   **Database**: PostgreSQL (Neon serverless)
*   **Email Service**: SendGrid Platform, User SMTP, Gmail Connector, Outlook/Microsoft 365
*   **Payment Processing**: Stripe (Stripe Connect Express)
*   **PDF Generation**: Puppeteer
*   **UI Components**: Radix UI (via shadcn/ui)
*   **Styling**: TailwindCSS
*   **Fonts**: Google Fonts (Inter)
*   **AI Integration**: Replit AI Integrations (GPT-4o-mini, GPT-4o vision)
*   **SMS Notifications**: Twilio
*   **Object Storage**: Google Cloud Storage (GCS)
*   **Maps**: Leaflet with react-leaflet
*   **Accounting Integration**: Xero, MYOB AccountRight, QuickBooks Online
*   **Calendar Integration**: Google Calendar, Outlook/Microsoft 365
*   **Weather API**: Open-Meteo
*   **Routing/ETA**: OSRM (Open Source Routing Machine)
*   **Tap to Pay (Stripe Terminal)**: `@stripe/stripe-terminal-react-native` SDK
*   **AI Receptionist (Voice)**: Vapi.ai (enhanced with ElevenLabs)
*   **Error Tracking**: Sentry

### Active Runbooks

**Integrations health debugging.** Use the **Test Connection** button on each provider card in `client/src/pages/Integrations.tsx` (calls `POST /api/integrations/<provider>/test`). It performs a real upstream read and the toast shows the verbatim provider error or the connected tenant/company name. Health states returned by `/api/integrations/health`:
*   `configured: false` → server missing env vars; OAuth flow can't even start. Fix env, redeploy.
*   `configured: true, connected: false` → env present, no user token. User clicks Connect.
*   `connected: true, needsReconnect: true` → token expired/revoked upstream. User clicks Reconnect.
*   `connected: true, needsReconnect: false` + Test failing → upstream API outage or scopes changed.

**Required env vars per integration** (see also `server/config/stripe.ts` for tunables):
*   **Xero**: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI`, `XERO_WEBHOOK_KEY`.
*   **QuickBooks Online**: `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI`, `QBO_ENVIRONMENT` (`sandbox`/`production`), `QBO_WEBHOOK_VERIFIER_TOKEN`.
*   **MYOB AccountRight**: `MYOB_CLIENT_ID`, `MYOB_CLIENT_SECRET`. Per-user company-file creds stored encrypted in `myob_connections.cf_username/cf_password`.
*   **Google Calendar**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
*   **Stripe**: via Replit Stripe connector (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`). Tunable: `STRIPE_PLATFORM_FEE_PERCENT`, `STRIPE_PLATFORM_FEE_MIN_CENTS`, `STRIPE_MINIMUM_AMOUNT_CENTS`, `STRIPE_CONNECT_COUNTRY`, `STRIPE_CURRENCY`, `STRIPE_CONNECT_MCC`.

**Per-business overrides** (in `business_settings`):
*   `timezone` — IANA tz string (default `Australia/Sydney`) used for Google Calendar event start/end zones.
*   `quickbooksDefaultItemRef` — `{value, name}` JSON for the QBO line item used on invoice/quote push (legacy fallback `{value:"1", name:"Services"}` with a warn).

**Load testing the ~100-concurrent-user envelope.** `scripts/load-test.mjs` runs a weighted, signed-in scenario mix (dashboard aggregate, jobs/quotes/invoices/rate-cards reads, AI suggestions + chat, and quote/invoice PDFs) against a target deployment. Recommended invocation:

```
BASE_URL=https://<host> \
LOAD_TEST_EMAIL=loadtest@example.com LOAD_TEST_PASSWORD='...' \
CONCURRENCY=100 DURATION_SEC=60 \
node scripts/load-test.mjs
```

The script signs in via `/api/auth/login`, reuses the returned `sessionToken` across all workers as a Bearer token, and auto-discovers a recent quote/invoice id for the PDF scenarios (override with `LOAD_TEST_QUOTE_ID` / `LOAD_TEST_INVOICE_ID`, or bypass login with `LOAD_TEST_TOKEN`). Pass/fail criteria enforced by the script (exit code 1 on breach): **0 × 5xx, 0 × 504, 0 × unexpected non-429 4xx (catches auth/path regressions), 0 network errors, < 1% 429, and hot-read p95 ≤ 500ms** (`/api/health`, `/api/dashboard/unified`, `/api/jobs`, `/api/quotes`, `/api/invoices`, `/api/rate-cards`; tune via `HOT_READ_P95_MS`). PDF/AI p95 is reported but not enforced — those endpoints are bounded queues whose latency is dominated by queue wait under burst.

**Production overload triage.** `GET /api/metrics` is the source of truth — watch `queues[].queued/totalRejected`, `pool.waiting`, `routes[].p99`, `totals.status429`. If `pdf` queue rejects spike, lower per-user PDF limit before raising queue size. If `ai`/`vision` reject, OpenAI is the bottleneck. DB pool is hard-capped at 15 (Neon serverless limit) — sustained `pool.waiting > 5` means a slow query, not a missing connection.

**Mobile typecheck regression guard.** `bash mobile/scripts/typecheck.sh` runs `tsc --noEmit` and fails if any new error appears that is not in `mobile/scripts/typecheck-baseline.txt` (currently 305 catalogued type-only errors). Run with `--update` after intentionally fixing baseline errors, then commit the updated baseline. Wired into CI via `.github/workflows/mobile-typecheck.yml`, which runs on every push/PR that touches `mobile/**` and prints the diff of new errors on failure.

### Round History
Dated implementation sub-sections (Subscription pricing, AI Receptionist tuning, Mobile Bottom Sheet Migration, Mobile Polish Audit, Round 10 Android Hardening, Integrations Health Pass, Production Hardening, Mobile TypeScript Check) live in `.local/reports/round-history.md`.

**Mobile Build Readiness 2026-05** — Static config + per-screen audit pass: iOS/Android `app.json` and `eas.json` GREEN (permissions, Privacy Manifest, Android edge-to-edge, ProGuard rules, deep-link intent filters all verified); 100% safe-area coverage across 92 real screens; remaining premium-feel gaps (native `Alert`, slide `Modal`, hardcoded colors) all map to existing follow-up tasks. Live `eas build --profile production` runs and per-screen device walkthroughs require a real macOS/Android workstation and are tracked separately. Full report: `.local/reports/build-readiness-2026-05/SUMMARY.md`.
