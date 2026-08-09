---
name: One-trial-per-user enforcement
description: How the 7-day trial is gated to once-per-user across all tiers, and where to add new trial-granting code.
---

# One free trial per user, across ALL tiers

**Rule:** a user gets the 7-day trial ONCE, regardless of tier. They cannot trial Team → cancel → trial Pro for another free week.

**Why:** trial-abuse vector reported by the owner. Each tier's trial was previously hardcoded independently with no prior-use check.

**How it's enforced:** `hasUsedTrial(userId, stripe?, customerId?)` in `server/billingService.ts` is the single gate. It checks DB markers first (fast-path) then Stripe as the authoritative source (can't be cheated by clearing the DB):
- DB fast-path: `users.trialStartedAt`, `users.trialStatus` (!= none), `business_settings.trialStartDate`, `business_settings.trialConverted`.
- Stripe authoritative: auto-paginates `subscriptions.list({customer, status:'all'})`; ANY sub with `trial_start || trial_end` = trial spent. On first match it persists a durable marker (`users.trialStatus='converted'`, `business_settings.trialConverted=true`) so later checks short-circuit on the DB and don't depend on Stripe.
- **Fail-open** on Stripe error (returns false) so a transient Stripe blip doesn't wrongly charge a genuine first-time user. The DB markers catch legit returning users anyway.

**How to apply:** there were FOUR trial-granting paths, ALL must call `hasUsedTrial` and omit the trial when used. If you add a 5th, gate it the same way:
- Checkout sessions (`createSubscriptionCheckout` Pro, `createFlatTierCheckout` Team/Business): only set `subscription_data.trial_period_days` + `trial_settings` when `!trialUsed && trialDays>0`. Card is collected (`payment_method_collection:'always'`) so a repeat subscriber is charged immediately.
- Direct sub create (`createTrialSubscription`): omit `trial_period_days`/`trial_settings` when used; make the `trialStatus/trialStartedAt/trialStartDate` DB writes conditional on the actual returned `trial_end`.
- In-place upgrade (`upgradeProToFlatTierTrial`): omit `trial_end` and switch `proration_behavior` to `'create_prorations'` when used; make trial DB writes conditional on `!trialUsed`.

**Out of scope:** the BETA path (`IS_BETA` in freemiumService) grants free access without Stripe — no real money, intentionally not gated.

**Footgun:** `business_settings` has no `subscriptionTier` *typed* column — pre-existing tsc errors at the downgrade/upgrade-team helpers reference `businessSettings.subscriptionTier` and are unrelated to trial work. Don't chase them when touching billing.
