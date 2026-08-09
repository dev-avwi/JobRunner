---
name: iOS IAP product must be fetched before purchase
description: StoreKit "Invalid product ID." even when the product is Approved in ASC — react-native-iap requires getSubscriptions() before requestSubscription().
---

Rule: on iOS, `requestSubscription({ sku })` only works for a product previously loaded via `getSubscriptions()` in the same session. If a screen starts a purchase without a prior product fetch, StoreKit throws "Invalid product ID." even for approved, live products.

**Why:** The dedicated-number add-on purchase failed in production with "Invalid product ID" while both add-on subscriptions were Approved in App Store Connect. The Phone Numbers screen called purchaseSubscription() directly; only the subscription screen ever fetched products.

**How to apply:** purchaseSubscription() in mobile/src/lib/iap.ts now tracks loadedProductIds and lazily calls fetchSubscriptions() before requesting; keep that guard for any new purchase entry point. When debugging "Invalid product ID", check the fetch-before-buy path FIRST, then ASC product status / Paid Apps agreement.
