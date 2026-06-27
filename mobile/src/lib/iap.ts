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

export async function initIAP(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
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
}

export async function fetchSubscriptions(): Promise<Subscription[]> {
  try {
    if (!isInitialized) await initIAP();
    const subscriptions = await getSubscriptions({ skus: ALL_PRODUCT_IDS });
    console.log('[IAP] Subscriptions fetched:', subscriptions.length);
    return subscriptions;
  } catch (error) {
    console.error('[IAP] Failed to fetch subscriptions:', error);
    return [];
  }
}

export async function purchaseSubscription(productId: string): Promise<void> {
  try {
    if (!isInitialized) await initIAP();

    if (Platform.OS === 'ios') {
      await requestSubscription({ sku: productId });
    } else if (Platform.OS === 'android') {
      await requestSubscription({
        sku: productId,
        subscriptionOffers: [{ sku: productId, offerToken: '' }],
      });
    }
  } catch (error: any) {
    if (error?.code === 'E_USER_CANCELLED') {
      console.log('[IAP] User cancelled purchase');
      return;
    }
    console.error('[IAP] Purchase error:', error);
    throw error;
  }
}

export async function restorePurchases(): Promise<(ProductPurchase | SubscriptionPurchase)[]> {
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
  if (purchaseUpdateSubscription) purchaseUpdateSubscription.remove();
  if (purchaseErrorSubscription) purchaseErrorSubscription.remove();

  purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase) => {
    console.log('[IAP] Purchase updated:', purchase.productId);
    if (purchase.transactionReceipt) {
      await finishTransaction({ purchase, isConsumable: false });
      onPurchaseSuccess(purchase);
    }
  });

  purchaseErrorSubscription = purchaseErrorListener((error) => {
    // A user cancelling the purchase sheet is a normal action, not an error.
    if (error.code === 'E_USER_CANCELLED') {
      return;
    }
    console.error('[IAP] Purchase error listener:', error);
    onPurchaseError(error);
  });
}

export function isIAPAvailable(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}
