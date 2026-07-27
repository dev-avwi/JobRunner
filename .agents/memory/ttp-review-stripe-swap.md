---
name: TTP App Review Stripe swap
description: Temporary prod state — demo account linked to the live Stripe Connect account for Apple Tap to Pay review
---
On 2026-07-26, for the 1.1.5 Tap to Pay App Review, prod business_settings was changed so demo@jobrunner.com.au (user ecbdffcb-668c-41a1-aadb-d7c44c822e6c) holds the live Stripe Connect account acct_1Tu14VIyKteHtdmt (Ayden's Plumbing), and vogler.ayden@gmail.com (user f1a857f3-5b45-44a8-9590-cdc70f76f26b) was set to NULL. Demo's previous account acct_1SuXmCI6HxV2NQy9 is dead (platform access revoked — caused "No such account" 500s on Integrations page).

**Why:** Tap to Pay enrollment needs a fully KYC-onboarded live Stripe account; the demo account had none usable, and Apple reviewers sign in with demo creds.

**Update 2026-07-26:** 1.1.5 approved (Ready for Distribution). User explicitly chose to KEEP the live Stripe account on the demo account permanently — do NOT reverse the swap unless the user asks.

**How to apply:** If the user ever asks to reverse: set vogler's row back to acct_1Tu14VIyKteHtdmt and demo's to NULL. Prod data writes require a temporary token-gated maintenance endpoint (executeSql prod is read-only; NEON_DATABASE_URL is NOT prod). Pattern: add route, user publishes, curl with token, verify via prod read replica, remove route.
