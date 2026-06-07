---
name: Subscription/trial status contract
description: How trial state is represented across server getSubscriptionStatus + /api/subscription/status and which clients consume it.
---

# Trial is `status:'trialing'` + `isTrial`, NOT `tier:'trial'`

`getSubscriptionStatus()` (server/billingService.ts) returns the REAL paid tier
(`pro`/`team`/`business`) during a trial, with `status:'trialing'`, `isTrial:true`,
`trialEndsAt`, `daysRemaining`, `cancelAtPeriodEnd`. It prefers live Stripe when a
`stripeSubscriptionId` exists, then falls back to local trial markers (still real tier
+ `trialing`), then stored tier. It must NOT early-return the literal `tier:'trial'`.

**Why:** an old early-return returned `tier:'trial'` whenever local trial markers were
set, before consulting Stripe. The web billing UI only treats pro/team/business as paid,
so trial users (and cancel-during-trial users) showed "Free Plan / Limited features", and
the early-return also discarded the real tier + cancelAtPeriodEnd + days-remaining.

**How to apply:** detect trial in clients via `isTrial === true || status === 'trialing'`
(keep a legacy `tier === 'trial'` OR-branch as harmless defensive code). Endpoints that
expose this: `/api/subscription/status` and `/api/billing/status`.

## DB `subscriptionTier` is ALSO the real tier during a trial
`startTrial()` (server/subscriptionService.ts) sets `subscriptionTier` to the trial's real
tier (pro/team), never `'trial'`. So anything reading `user.subscriptionTier` (e.g.
`mobile/app/more/settings.tsx`) already sees the real tier — its `=== 'trial'` branches are
pre-existing dead code, not affected by the getSubscriptionStatus contract.

## Consumer that DOES break if you change the API contract
`mobile/app/more/subscription.tsx` reads `/api/subscription/status.tier` and previously
keyed the trial banner / plan card off `tier === 'trial'`. After moving trial to
`isTrial`/`trialing`, it must derive `isOnTrial` the same way. Web `client/src/components/Settings.tsx`
and `client/src/pages/SubscriptionPage.tsx` were updated to the `isOnTrial` pattern too.
`use-subscription.ts` and `routes.ts` canUpgrade have leftover dead `=== 'trial'` checks (harmless).
