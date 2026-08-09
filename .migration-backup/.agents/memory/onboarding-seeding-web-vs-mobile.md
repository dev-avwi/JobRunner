---
name: Onboarding sample/demo seeding — web vs mobile split
description: Two parallel first-run seeding systems exist; the "legacy" one is still live on mobile, so don't delete it as dead web code.
---

# Onboarding seeding: web and mobile use DIFFERENT endpoints

There are two separate first-run data-seeding paths. They look redundant but are NOT — each owns one client surface.

- **Web** live onboarding wizard = `client/src/components/SimpleOnboarding.tsx`. On the owner "done" step it calls `POST /api/onboarding/seed-sample-data { tradeType }` (newer system: `server/sampleData.ts`, records flagged `isSample`, route is `requireAuth + ownerOnly`). Removable via `DELETE /api/onboarding/sample-data` (wired in TradieDashboard.tsx + SettingsImportCards.tsx). The web client never calls the legacy demo endpoint.
- **Mobile** onboarding = `mobile/app/(onboarding)/setup.tsx` calls `POST /api/onboarding/seed-demo-data` (legacy system: `server/demoData.ts` `seedUserDemoData`, route is `requireAuth` only — NOT ownerOnly). Cleared via `POST /api/onboarding/clear-demo-data` (called from mobile + web SettingsImportCards/TradieDashboard).

**Why this matters:** when cleaning up "dead" web onboarding code, `seed-demo-data` LOOKS orphaned from the web side (no web caller) but mobile still depends on it. Do NOT delete the `seed-demo-data` route or `seedUserDemoData` as dead code — you'll break mobile onboarding. grep the `mobile/` tree before removing any onboarding server route.

**Known open item (user not yet asked to fix):** `seed-demo-data` is `requireAuth` only, weaker than the web `seed-sample-data` (`ownerOnly`). Tightening it to `ownerOnly` is a mobile-affecting change — gate behind user approval, don't do it as part of a web-scoped cleanup.

**Genuinely dead (deleted) web onboarding/walkthrough components:** the whole `client/src/components/onboarding/` step folder, `SetupChecklist.tsx`, `ImmersiveOnboarding.tsx`, `AppWalkthrough.tsx` (+ its `useAppWalkthrough`), `FirstTimeWalkthrough.tsx`, and `hooks/useCompleteOnboarding.ts` (the old `handleOnboardingComplete` path in App.tsx). Live walkthrough that survives = `GuidedTour.tsx` (`useGuidedTour`); live checklist = `GettingStartedChecklist.tsx`.
