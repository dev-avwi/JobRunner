---
name: Custom queryFn bypasses Bearer token
description: Web app is Bearer-token-only; any hook that writes its own fetch silently 401s and degrades to a free-tier/empty fallback.
---

The web app authenticates with a Bearer token only (login sets NO session cookie; token is in localStorage and attached by `buildHeaders()` in `client/src/lib/queryClient.ts`). The default `getQueryFn`/`apiRequest` attach it automatically.

**Rule:** Do NOT give a `useQuery` its own `queryFn` that calls raw `fetch(url, { credentials: 'include' })`. That request carries no `Authorization` header, so it 401s for every logged-in user, and the hook's `?? default` fallback hides the failure as a wrong-but-plausible value.

**Why:** `useSubscriptionUsage` did exactly this — its raw fetch 401'd, `usage` became undefined, and `useFeatureAccess()` fell back to `subscriptionTier: 'free'`, which made `FeatureGate` lock Team features (e.g. the Job Map) for a worker who legitimately inherits the owner's Team tier. Backend tier inheritance and DB data were correct; only the client call was unauthenticated. Symptom looked like a backend/permissions bug but was purely client auth.

**How to apply:** Let queries use the default fetcher (just set `queryKey`, plus option overrides like `staleTime`/`refetchOnWindowFocus`). If a query MUST define its own `queryFn`, build headers with the same token logic as `buildHeaders()`. To debug a "feature wrongly locked / data wrongly empty" report, curl the endpoint with `Authorization: Bearer <token>` vs cookie-only — if Bearer works and cookie-only 401s, a custom queryFn is the culprit.
