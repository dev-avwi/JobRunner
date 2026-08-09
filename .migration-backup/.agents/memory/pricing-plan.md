---
name: Pricing — live tiers + how to change a price safely
description: Current live AUD subscription prices and the (non-obvious) steps required to change a price so Stripe actually charges the new amount.
---

**Live prices (applied 2026-06-27, to match the Apple IAP products the user set for Android/iOS launch):**
- Pro **$49.99**/mo
- Team **$99.99**/mo (up to 5 workers)
- Business **$199.99**/mo (up to 15 workers)
- AI Receptionist add-on **$60**/mo; Dedicated number **$10**/mo (UNCHANGED — user didn't give new add-on prices; the earlier $79–89 target was never applied).

(History: earlier plan said don't raise until paying users; targets were Pro 49.99 / Team 149.99 / Business 249.99. The user instead set Team 99.99 / Business 199.99 in App Store Connect, which is now authoritative.)

## How to change a subscription price (do ALL of these or the UI and the charge diverge)
1. **Source of truth:** `shared/schema.ts` → `PRICING` (cents AUD). Feeds Stripe `unit_amount`, Settings display, billing-reminder math.
2. **CRITICAL — bump the Stripe `lookup_key` in `server/billingService.ts`** (`jobrunner_pro_monthly_vN`, `jobrunner_team_flat_monthly_vN`, `jobrunner_business_flat_monthly_vN`) at BOTH the `prices.list({lookup_keys})` and the `prices.create({lookup_key})` call for each tier. **Why:** the getOrCreate*Price fns resolve a price by `lookup_key`, not by amount, and a Stripe Price's `unit_amount` is immutable. If you only change `PRICING` cents, Stripe finds the existing same-lookup_key Price and keeps charging the OLD amount while the UI shows the new one. Bumping the version forces a brand-new Price at the new amount. (Bumped v2→v3 on 2026-06-27.)
3. **Hardcoded display literals** live in many files — they are NOT all driven by `PRICING`. Grep the old dollar amounts (e.g. `39\.99`) across `client/src`, `mobile/app`, `server` and replace: TermsOfService, LandingPage, Team, SubscriptionPage (`price:` number), AdminDashboard, ServiceReadinessWidget, UpgradeToTeamCard, FeatureGate, mobile `more/subscription.tsx` (defaultPrices + compare cards), plus comments in routes.ts/billingService/Settings. (Settings.tsx itself uses `formatPrice(PRICING.x.monthly)` — dynamic, only its comments are stale.)
4. **After deploy:** run `/api/admin/init-stripe-products` once per Stripe mode (test + live) to pre-provision the new vN Prices, then do one test-mode checkout per tier to confirm the line-item amount.
5. **Not coupled to price:** TIER_LIMITS seat counts; Apple IAP receipt verification (maps productId→tier, not price); existing Stripe subscribers (stay on old price until they change plans — forced repricing is a separate migration).
