---
name: Apple IAP paid add-ons
description: How the AI Receptionist / Dedicated Number add-ons are sold via Apple IAP on iOS while Stripe stays for web+Android, and the guards that keep it safe.
---

# Apple IAP add-ons (AI Receptionist, Dedicated Number)

Add-ons are auto-renewable IAP products, tracked in the `addon_subscriptions` table (one row per user+addon), which is the single billing-state source of truth read by every platform. Apple Server Notifications keep that row in sync (renew/lapse/refund/revoke → de-provision the feature).

**Apple product IDs (must match App Store Connect exactly):**
- `com.jobrunner.dedicatednumber.monthly`
- `com.jobrunner.aireceptionist.monthly`

**Each add-on must live in its OWN App Store Connect subscription group** so a tradie can stack both add-ons on top of any tier (products in the same group are mutually exclusive).

## Server receipt-verify guards (POST /api/subscription/verify-apple-addon)
A valid Apple receipt is NOT enough on its own. The endpoint must:
1. Require a `latest_receipt_info` entry whose `product_id` === the requested add-on product; reject if none (otherwise any valid receipt — e.g. a tier sub — could activate an add-on).
2. Bind the add-on row to the matching transaction's `original_transaction_id` — never fall back to `latest_receipt_info[0]` (wrong txn binds the webhook to the wrong product).
3. Cross-account replay guard: if that `original_transaction_id` is already linked to a DIFFERENT user, reject. Enforced in code AND by a partial unique index `addon_subscriptions_apple_txn_unique` on `apple_original_transaction_id WHERE NOT NULL`.

**Why:** without these, a shared/leaked receipt grants a second account the entitlement (receipt replay / cross-account fraud).

## iOS must NEVER open Stripe checkout for add-ons
On `Platform.OS === 'ios'`, the buy handlers handle the whole path and `return` regardless of outcome — including when `isIAPAvailable()` is false (show a "Purchase Unavailable" alert, do NOT fall through to the `/api/sms/purchase-number` Stripe branch or the `ai-receptionist-checkout` URL). Apple policy. Web/Android keep Stripe.
**How to apply:** the dedicated-number screen stashes the picked number via `setPendingDedicatedNumber()` before `purchaseSubscription()`; the global IAP listener reads it when POSTing verify-apple-addon. AI receptionist requires a dedicated number first (pre-check before purchase).

## Paid-tier gating (Pro+ only)
Both add-ons require a Pro plan or higher — a free user must not buy OR provision either one. `requirePaidTier()` (server/routes/middleware.ts; resolves to the OWNER's effective tier, treats lapsed/canceled/past_due/unpaid/paused as free, 402 otherwise, bypassed only when `IS_BETA` which is currently false) must sit on EVERY provision/checkout entrypoint, not just one:
- `POST /api/subscription/verify-apple-addon` (iOS Apple receipt verify+provision)
- `POST /api/sms/purchase-number` (Stripe/Twilio number purchase — web+Android)
- `POST /api/subscription/ai-receptionist-checkout` (Stripe checkout — web+Android)
The AI Receptionist enable/config/resync routes were already gated; the purchase paths were the gap.
**Why:** without a gate on the purchase path, a free user completes the Apple charge then gets blocked at the (gated) enable route → paid for nothing → refund mess.
**How to apply:** also gate the mobile UI BEFORE `purchaseSubscription()` so free users never reach Apple's sheet — `isFreePlan = user.subscriptionTier==='free' && !betaLifetimeAccess && !isBeta`, show an upgrade prompt and return. Both phone-numbers.tsx handlers (purchase + reacquire) and ai-receptionist.tsx do this. Server stays the source of truth.

## Deploy reminder
Prod DB needs the `addon_subscriptions` table + indexes created via raw SQL on deploy (this DB rejects db:push — see db-add-table-no-push). Includes the unique txn index above.

## "Invalid product ID" is an App Store Connect issue, not code
The `Invalid product ID` toast comes from StoreKit (react-native-iap surfaces it; the string is NOT in our codebase). It means the store didn't return the SKU. Causes: the IAP product wasn't created in App Store Connect for the matching bundle id, it's not yet in at least "Ready to Submit", it's not in a subscription group, the Paid Applications agreement isn't active, or it just hasn't propagated (can take hours). The code's product-id strings (`com.jobrunner.dedicatednumber.monthly`, `com.jobrunner.aireceptionist.monthly`, tier `.monthly`) are correct — don't chase it in code. Fix is in ASC.
