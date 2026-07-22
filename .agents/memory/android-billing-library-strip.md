---
name: Android Play Billing library stripped
description: Why the Android build excludes react-native-iap and what to do if Google flags billing again
---

**Rule:** Android never uses Google Play Billing — all Android payments are Stripe web payment links; IAP (react-native-iap 12.x) is iOS-only for Apple IAP. The Android build excludes the module via `mobile/react-native.config.js` (`react-native-iap.platforms.android = null`), and the Android-only plugins `withIAPStoreFlavor`/`withIAPKotlinFix` were removed from app.json. `iap.ts` is hard-gated to iOS (init returns false, purchase throws, fetch/restore return []).

**Why:** Google Play requires Billing Library 8+ (deadline 2026-08-31) for any app that *ships* the library. react-native-iap 12/13 bundle billing 7 and their Kotlin uses APIs removed in billing 8 (no-arg enablePendingPurchases, queryPurchaseHistoryAsync), so a version override won't compile. Since Android never calls it, stripping the library satisfies the check without migrating to expo-iap / rn-iap v14 (Nitro).

**How to apply:**
- Don't re-add the store-flavor plugin or un-exclude the Android platform unless actually implementing Play Billing — then migrate to expo-iap (OpenIAP, billing 8) or react-native-iap 14+.
- react-native-iap JS touches native modules at call time only, so the JS import is safe on Android with the module unlinked.
- After any change here: rebuild Android natives (prebuild) + verify the AAB has no com.android.billingclient classes; the Play warning clears only after publishing a new release.
- Known residual risk: Play payments policy may still flag external Stripe checkout for digital goods regardless of library version.
