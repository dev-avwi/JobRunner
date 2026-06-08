---
name: OAuth onboarding routing via isNewUser
description: Why mobile Google/Apple OAuth handlers must route brand-new users by the server isNewUser flag, not onboardingCompleted
---

Mobile OAuth (Google + Apple) handlers must route brand-new users to the onboarding wizard based on the server-provided `isNewUser` flag, NOT on `businessSettings.onboardingCompleted`.

**Why:** All OAuth handlers historically called `resolvePostAuthRedirect()`, which decides solely on `onboardingCompleted`. The server's `createGoogleUser`/`createAppleUser` create NO business_settings and NO team membership, so GET /api/business-settings auto-heals a missing row to `onboardingCompleted = isStaffOnOtherTeam`. A genuinely new account that gets misclassified as staff (e.g. `/api/team/my-role` resolves an accepted membership) ends up `onboardingCompleted=true` and silently skips the wizard, landing on the dashboard. The auto-heal read-back is also racy.

**How to apply:** Server already emits `isNewUser` — Google via deep-link query param (`jobrunner://?auth=google_success&token=...&isNewUser=...`, server/googleAuth.ts), Apple via JSON response field (server/routes.ts /api/auth/apple). In the mobile handlers (`mobile/app/(auth)/login.tsx` + `register.tsx`: Google deep-link useEffect, handleGoogleSignIn token + no-token branches, Apple handler), when `isNewUser` is true → `router.replace('/(onboarding)/setup')`; else fall back to `resolvePostAuthRedirect()`. Safe because `isNewUser=true` only when a fresh users row was created (existing/linked accounts, including genuine invited workers, return `isNewUser=false`).

**Related:** the two dashboard spinner cards (TimeTrackingWidget `/api/time-tracking/dashboard`, WeatherWidget `/api/weather`) are NOT a perpetual-spinner bug — both have `finally{setIsLoading(false)}`, the 12s refresh never re-sets isLoading=true, and the api client aborts after 15s. Stuck cards = slow/stale backend latency (PROD_FALLBACK), not a frontend defect.
