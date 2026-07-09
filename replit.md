### Overview
JobRunner is a mobile-first web application for Australian tradespeople: job management, quoting, invoicing, and payment collection with full AU GST/AUD support. AI-powered suggestions, compliance (WHS/SWMS), and communication tools centralize a tradie's whole business.

### User Preferences
Preferred communication style: Simple, everyday language. No emojis. Brief replies. "Work basic, don't overthink."
Demo account for testing: `demo@jobrunner.com.au`.

### System Architecture
TypeScript throughout. Frontend: mobile-first React 18 + shadcn/ui + TailwindCSS + Wouter + TanStack Query. Backend: Express REST API with Zod validation, PostgreSQL (Neon) + Drizzle ORM. Mobile: React Native/Expo app (in `mobile/`) using Zustand + SQLite offline-first sync with merge-aware queue and optimistic rollback.

Key decisions:

*   **Auth & access**: Email/password, Google OAuth, Apple Sign-In, Xero OAuth. RBAC with granular permissions; nav and routes gated by role + subscription tier. Server-side onboarding guard (`onboardingCompleted`) for owners. 4-tier pricing via Stripe + Apple IAP with server-side receipt verification; hard server-side team seat enforcement; live Stripe status/tier persisted to DB; founding-member manual full access.
*   **Jobs & workflow**: 5-stage job status workflow, multi-worker time tracking, real-time availability, automated email confirmations. Team Operations Center + Visual Dispatch Board (Schedule/Kanban/Map) with conflict detection and live location tracking.
*   **Financial**: Live quote/invoice editor with real-time preview, catalog, digital signatures, invoice locking, audit trails. Payments via Stripe Connect Express: Payment Links, Tap to Pay (Stripe Terminal SDK, iOS only), QR, AI Smart Payment Chaser. Server-side PDF generation (Puppeteer against Nix chromium) for quotes/invoices/Job Proof Packs with GPS presence verification.
*   **AI**: GPT-4o-mini / GPT-4o vision (Replit AI Integrations) for suggestions, quote generation, transcription, photo categorization, receipt scanning, SWMS hazard detection, schedule optimizer, role-aware assistant. AI Receptionist: Vapi.ai + ElevenLabs voice, SMS follow-ups, call recording, sentiment; number porting (BYOD) with admin workflow.
*   **Communication**: SendGrid email automation, two-way Twilio SMS + unified Chat Hub, Photo MMS, Google Review requests, PWA + WebSocket real-time updates (jobs, timers, documents, payments, notifications, chat, presence) with TanStack Query invalidation. Track My Arrival public portal; real-ETA "On My Way" SMS (OSRM); geofence notifications; running-late detection.
*   **Compliance**: AU WHS-compliant SWMS (templates, risk matrix, worker sign-off, AI Safety Scan) + WHS Safety module.
*   **Teams & multi-business**: Magic-link subcontractor invitations with session validation and upgrade paths; multi-business workspace switching with data isolation.
*   **Accounting integrations**: Xero, QuickBooks Online, MYOB AccountRight — OAuth + refresh, push invoices/quotes, pull payments, mapping UI, signed webhooks (Xero/QBO), real-time payment/void sync, MYOB credit-note void workaround, per-provider live Test Connection.
*   **Performance & hardening**: Aggregate API endpoints for heavy pages; hot-read LRU+TTL cache (`server/cache.ts`); bounded concurrency queues → 429 + Retry-After (`server/concurrency.ts`); per-user rate limits; Neon-friendly pool (max 15); 30s /api timeout; `/api/health` + `/api/metrics` (p50/p95/p99, 429/504 counters); staggered schedulers; graceful shutdown. All inbound webhooks (Stripe, SendGrid, Twilio, Xero, QBO) verify signatures → 401 before side effects.
*   **Mobile polish**: `AppBottomSheet` wraps native RN `<Modal presentationStyle="pageSheet">` (no gorhom); never open a second sheet within ~350ms of closing one (iOS modal collision). `PressableRow`/`PressableCard` for ripple/haptics; `useBottomInset`/`usePageShell` safe-area; edge-to-edge Android, predictive back, ProGuard shrinking; Sentry filters sideloads/emulators/known OS crashes.
*   **Website addon**: Toggleable Click-to-Call, AI Chat Widget, Booking Form (all intake converges on Leads).

### External Dependencies
Neon PostgreSQL; SendGrid (+ user SMTP/Gmail/Outlook); Stripe Connect Express + Stripe Terminal (`@stripe/stripe-terminal-react-native`); Puppeteer; Radix UI/shadcn; TailwindCSS; Inter (Google Fonts); Replit AI Integrations (GPT-4o-mini/vision); Twilio; GCS object storage; Leaflet/react-leaflet; Xero/MYOB/QBO; Google Calendar + Outlook; Open-Meteo; OSRM; Vapi.ai + ElevenLabs; Sentry.

### Runbooks
Full detail in `.local/runbooks.md`. Critical rules that must never be violated:

*   **Deploy config (known-good)**: `build = ["bash","-c","npm run build && rm -rf attached_assets mobile .git docs tests exports artifacts"]`, `run = ["npm","run","start"]`. NEVER add `.cache`, `.local`, `node_modules`, `dist`, `package.json`, `.puppeteerrc.cjs`, or `.npmrc` to the rm list (destroys the runtime nodejs PATH — both `node` and `npm` vanish). NEVER wrap the RUN command in `bash -c`/`sh -c`. Do NOT re-add `PORT=23636` to prod env or a `23636 -> 80` ports mapping.
*   **Schema push is user-gated**: do NOT auto-run `drizzle-kit push --force` in the build — current schema vs live prod DB (57 real users) includes destructive drops. Do NOT "Copy development database to production".
*   **Puppeteer**: keep `.puppeteerrc.cjs` (skipDownload + Nix chromium) and the `.npmrc` `puppeteer_skip_download=true` line — removing them re-breaks deploy builds.
*   **Image size**: 8 GiB autoscale cap; the scoped build-command rm-rf is the fix. Next lever if exceeded again = move `attached_assets` to object storage, NOT deleting `.cache`/`.local`/`node_modules`.
*   **Mobile typecheck guard**: `bash mobile/scripts/typecheck.sh` fails on any error not in `mobile/scripts/typecheck-baseline.txt`; `--update` after intentional fixes; CI: `.github/workflows/mobile-typecheck.yml`.
*   **Routes splitting**: `server/routes.ts` splits by domain into `server/routes/<domain>.ts` via `register<Domain>Routes(app, deps)` — see `.local/runbooks.md` for the extraction recipe.
*   Integrations health states, required env vars per provider, load-test invocation (`scripts/load-test.mjs`), and overload triage (`/api/metrics`): see `.local/runbooks.md`.

### Round History
Dated implementation sub-sections live in `.local/reports/round-history.md`. Mobile Build Readiness 2026-05 audit: `.local/reports/build-readiness-2026-05/SUMMARY.md`.
