import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  getAvailablePurchases,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type ProductPurchase,
  type SubscriptionPurchase,
  type Subscription,
} from 'react-native-iap';

export const IAP_PRODUCT_IDS = {
  pro: 'com.jobrunner.pro.monthly',
  team: 'com.jobrunner.team.monthly',
  business: 'com.jobrunner.business.monthly',
};

// Paid add-ons (auto-renewable). Live in separate App Store Connect subscription
// groups from the tiers so a tradie can stack both add-ons on top of any plan.
export const IAP_ADDON_PRODUCT_IDS = {
  dedicatedNumber: 'com.jobrunner.dedicatednumber.monthly',
  aiReceptionist: 'com.jobrunner.aireceptionist.monthly',
};

const ALL_PRODUCT_IDS = [
  IAP_PRODUCT_IDS.pro,
  IAP_PRODUCT_IDS.team,
  IAP_PRODUCT_IDS.business,
  IAP_ADDON_PRODUCT_IDS.dedicatedNumber,
  IAP_ADDON_PRODUCT_IDS.aiReceptionist,
];

export type IAPTier = 'pro' | 'team' | 'business';
export type IAPAddon = 'dedicated_number' | 'ai_receptionist';

export function productIdToTier(productId: string): IAPTier | null {
  switch (productId) {
    case IAP_PRODUCT_IDS.pro: return 'pro';
    case IAP_PRODUCT_IDS.team: return 'team';
    case IAP_PRODUCT_IDS.business: return 'business';
    default: return null;
  }
}

export function productIdToAddon(productId: string): IAPAddon | null {
  switch (productId) {
    case IAP_ADDON_PRODUCT_IDS.dedicatedNumber: return 'dedicated_number';
    case IAP_ADDON_PRODUCT_IDS.aiReceptionist: return 'ai_receptionist';
    default: return null;
  }
}

// The dedicated-number purchase needs to know WHICH number the user picked. The global
// purchase listener fires without that context, so the Phone Numbers screen stashes the
// selected number here right before calling purchaseSubscription(). The listener reads it
// when verifying the add-on receipt, then clears it.
let pendingDedicatedNumber: string | null = null;
export function setPendingDedicatedNumber(phoneNumber: string | null): void {
  pendingDedicatedNumber = phoneNumber;
}
export function getPendingDedicatedNumber(): string | null {
  return pendingDedicatedNumber;
}

let isInitialized = false;
let purchaseUpdateSubscription: any = null;
let purchaseErrorSubscription: any = null;

// On iOS, requestSubscription() does NOT reliably reject when the user cancels the
// Apple sheet — the outcome (success OR cancel/error) arrives asynchronously through
// the global purchase listeners. We bridge that back to the caller's awaited promise
// here so a cancel rejects (with E_USER_CANCELLED) and only a real, receipt-bearing
// transaction resolves. Without this, screens treat "sheet opened" as "purchase done".
let activePurchaseDeferred: { resolve: () => void; reject: (e: any) => void } | null = null;
let activePurchaseTimeout: ReturnType<typeof setTimeout> | null = null;
// The productId the caller is currently awaiting, so a stale/unrelated purchase update
// (e.g. a queued or restored transaction) can't falsely resolve the active deferred.
let activePurchaseProductId: string | null = null;

function clearActivePurchaseTimeout(): void {
  if (activePurchaseTimeout) {
    clearTimeout(activePurchaseTimeout);
    activePurchaseTimeout = null;
  }
}

function settlePurchaseSuccess(): void {
  clearActivePurchaseTimeout();
  const deferred = activePurchaseDeferred;
  activePurchaseDeferred = null;
  activePurchaseProductId = null;
  if (deferred) deferred.resolve();
}

function settlePurchaseError(error: any): void {
  clearActivePurchaseTimeout();
  const deferred = activePurchaseDeferred;
  activePurchaseDeferred = null;
  activePurchaseProductId = null;
  if (deferred) deferred.reject(error);
}

export async function initIAP(): Promise<boolean> {
  // IAP is iOS-only (Apple IAP). Android payments go through Stripe web links,
  // and the react-native-iap native module is excluded from the Android build
  // (see mobile/react-native.config.js) to satisfy Google Play's Billing
  // Library 8+ requirement.
  if (Platform.OS !== 'ios') return false;
  if (isInitialized) return true;

  try {
    const result = await initConnection();
    isInitialized = true;
    console.log('[IAP] Connection initialized:', result);
    return true;
  } catch (error) {
    if (__DEV__) console.warn('[IAP] Billing unavailable (expected on emulator / no Play Store):', error);
    return false;
  }
}

export async function cleanupIAP(): Promise<void> {
  if (purchaseUpdateSubscription) {
    purchaseUpdateSubscription.remove();
    purchaseUpdateSubscription = null;
  }
  if (purchaseErrorSubscription) {
    purchaseErrorSubscription.remove();
    purchaseErrorSubscription = null;
  }
  if (isInitialized) {
    await endConnection();
    isInitialized = false;
  }
  loadedProductIds.clear();
}

// Product IDs successfully loaded from the App Store this session. On iOS,
// requestSubscription() only works for products that were previously fetched via
// getSubscriptions() — otherwise StoreKit throws "Invalid product ID." even when
// the product exists and is Approved in App Store Connect.
const loadedProductIds = new Set<string>();

export async function fetchSubscriptions(): Promise<Subscription[]> {
  if (Platform.OS !== 'ios') return [];
  try {
    if (!isInitialized) await initIAP();
    const subscriptions = await getSubscriptions({ skus: ALL_PRODUCT_IDS });
    for (const sub of subscriptions) {
      if (sub?.productId) loadedProductIds.add(sub.productId);
    }
    console.log('[IAP] Subscriptions fetched:', subscriptions.length);
    return subscriptions;
  } catch (error) {
    console.error('[IAP] Failed to fetch subscriptions:', error);
    return [];
  }
}

// Resolves ONLY when a real, receipt-bearing transaction completes. Rejects with the
// underlying error on failure — notably { code: 'E_USER_CANCELLED' } when the user
// dismisses the Apple sheet. Callers must therefore treat a resolve as a genuine
// purchase, and silently ignore E_USER_CANCELLED in their catch.
export async function purchaseSubscription(productId: string): Promise<void> {
  if (Platform.OS !== 'ios') throw { code: 'E_IAP_NOT_AVAILABLE' };
  if (!isInitialized) await initIAP();

  // StoreKit requires the product to be loaded before it can be purchased. Screens
  // like Phone Numbers call this directly without ever visiting the subscription
  // screen, so make sure the product is fetched first or Apple throws
  // "Invalid product ID." even for approved, live products.
  if (!loadedProductIds.has(productId)) {
    await fetchSubscriptions();
    if (!loadedProductIds.has(productId)) {
      throw { code: 'E_PRODUCT_NOT_LOADED', message: 'This product is not available from the App Store right now. Please try again in a moment.' };
    }
  }

  // Abandon any prior in-flight purchase deferred so its promise can't leak.
  if (activePurchaseDeferred) {
    settlePurchaseError({ code: 'E_PURCHASE_SUPERSEDED' });
  }

  const outcome = new Promise<void>((resolve, reject) => {
    activePurchaseDeferred = { resolve, reject };
    activePurchaseProductId = productId;
    // Safety net: if neither listener fires (e.g. the sheet never appears), don't
    // leave the caller's spinner hanging forever.
    activePurchaseTimeout = setTimeout(() => {
      activePurchaseTimeout = null;
      settlePurchaseError({ code: 'E_PURCHASE_TIMEOUT' });
    }, 120000);
  });

  try {
    await requestSubscription({ sku: productId });
  } catch (error: any) {
    // Some platform/library versions DO reject requestSubscription directly (incl.
    // cancel). Surface that through the same deferred so we never double-settle.
    if (error?.code === 'E_USER_CANCELLED') {
      console.log('[IAP] User cancelled purchase');
    } else {
      console.error('[IAP] Purchase error:', error);
    }
    settlePurchaseError(error);
  }

  return outcome;
}

export async function restorePurchases(): Promise<(ProductPurchase | SubscriptionPurchase)[]> {
  if (Platform.OS !== 'ios') return [];
  try {
    if (!isInitialized) await initIAP();
    const purchases = await getAvailablePurchases();
    console.log('[IAP] Restored purchases:', purchases.length);
    return purchases;
  } catch (error) {
    console.error('[IAP] Failed to restore purchases:', error);
    return [];
  }
}

export function setupPurchaseListeners(
  onPurchaseSuccess: (purchase: ProductPurchase | SubscriptionPurchase) => void,
  onPurchaseError: (error: any) => void,
) {
  if (Platform.OS !== 'ios') return;
  if (purchaseUpdateSubscription) purchaseUpdateSubscription.remove();
  if (purchaseErrorSubscription) purchaseErrorSubscription.remove();

  purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase) => {
    console.log('[IAP] Purchase updated:', purchase.productId);
    if (!purchase.transactionReceipt) return;
    // Only the purchase the caller is actually awaiting may settle the deferred — a
    // stale/queued/restored transaction for another product must not resolve it.
    const matchesActive = purchase.productId === activePurchaseProductId;
    try {
      await finishTransaction({ purchase, isConsumable: false });
    } catch (err) {
      console.error('[IAP] finishTransaction failed:', err);
      if (matchesActive) settlePurchaseError(err);
      return;
    }
    onPurchaseSuccess(purchase);
    // Let the awaiting caller know their real purchase landed.
    if (matchesActive) settlePurchaseSuccess();
  });

  purchaseErrorSubscription = purchaseErrorListener((error) => {
    // Resolve the caller's awaited promise as a rejection for EVERY error — including
    // a user cancel — so the screen can reset its loading state and never show success.
    settlePurchaseError(error);
    // A user cancelling the purchase sheet is a normal action, not an error to log/report.
    if (error.code === 'E_USER_CANCELLED') {
      console.log('[IAP] User cancelled purchase');
      return;
    }
    console.error('[IAP] Purchase error listener:', error);
    onPurchaseError(error);
  });
}

export function isIAPAvailable(): boolean {
  return Platform.OS === 'ios';
}
