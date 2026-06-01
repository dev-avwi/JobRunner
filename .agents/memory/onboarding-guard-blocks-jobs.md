---
name: onboarding guard 403s owner routes; demo seed must mark onboarding complete
description: Why an owner (esp. the demo account) sees "Job Not Found"/failed on job detail even though jobs exist.
---

# Onboarding guard blocks job routes when business_settings.onboardingCompleted is false

The server-side onboarding guard (`server/permissions.ts`, `requireOnboarding`) returns **HTTP 403 `{code:'onboarding_required'}`** on most `/api` routes — including `/api/jobs` and `/api/jobs/:id` — for any business owner whose `business_settings.onboardingCompleted` is falsey. The **dashboard aggregate endpoint is exempt**, so jobs still appear on the dashboard while clicking into a job 403s → the web `JobDetailView` renders "Job Not Found". (Before the 403-no-longer-clears-session fix, this same 403 logged the user out instead.)

**Root cause seen:** the demo seed (`server/demoData.ts`) created the demo `business_settings` WITHOUT `onboardingCompleted`, so it defaulted false. Fix = set `onboardingCompleted: true` in both demo `createBusinessSettings` calls AND add an idempotent repair (`if (!businessSettings.onboardingCompleted) updateBusinessSettings(... true)`) so existing demo rows self-heal on restart.

**Two non-obvious gotchas when fixing this live:**
1. **Business settings are served from an in-memory hot-read cache** (`server/cache.ts`). A direct `UPDATE business_settings SET onboarding_completed=true` is NOT reflected until the cache TTL expires or the server is **restarted**. After a DB patch, restart the `Start application` workflow before re-testing.
2. The demo refresh scheduler re-runs seeding periodically, so the seed itself (not just a one-off DB patch) must set the flag, or it can regress.

**Why:** owners must finish the onboarding wizard before using the app; the guard enforces it. Auto-bootstrapped accounts (demo owner, visitor, invited workers/subs) must be seeded as onboarding-complete or they hit the guard. Visitor + invite/worker paths in `server/routes.ts` already set `onboardingCompleted: true`; demo owner was the gap.

**How to apply:** if an owner reports jobs list works but opening a job "fails"/"Job Not Found", curl `/api/jobs/:id` with their Bearer token — a 403 `onboarding_required` means check `business_settings.onboarding_completed`, not the job data.
