import { Platform } from 'react-native';
import { initIAP, setupPurchaseListeners, productIdToTier, productIdToAddon, getPendingDedicatedNumber, setPendingDedicatedNumber } from './iap';
import api from './api';
import { useAuthStore } from './store';

let globalListenerActive = false;
let pendingVerifyPromise: Promise<void> | null = null;

export async function initGlobalIAP(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (globalListenerActive) return;

  try {
    const ok = await initIAP();
    if (!ok) return;

    setupPurchaseListeners(
      async (purchase) => {
        if (!purchase.transactionReceipt) {
          console.log('[GlobalIAP] Purchase missing receipt, skipping');
          return;
        }

        const tier = productIdToTier(purchase.productId);
        const addon = tier ? null : productIdToAddon(purchase.productId);
        if (!tier && !addon) {
          console.log('[GlobalIAP] Purchase is not a known tier/add-on, skipping');
          return;
        }

        console.log('[GlobalIAP] Processing purchase for', tier || addon);

        const verifyPromise = (async () => {
          try {
            if (addon) {
              // For the dedicated number, pass along the number the user selected (if any).
              const phoneNumber = addon === 'dedicated_number' ? getPendingDedicatedNumber() : undefined;
              await api.post('/api/subscription/verify-apple-addon', {
                receiptData: purchase.transactionReceipt,
                productId: purchase.productId,
                ...(phoneNumber ? { phoneNumber } : {}),
              });
              setPendingDedicatedNumber(null);
              console.log('[GlobalIAP] Add-on receipt verified, refreshing user');
            } else {
              await api.post('/api/subscription/verify-apple-receipt', {
                receiptData: purchase.transactionReceipt,
                productId: purchase.productId,
              });
              console.log('[GlobalIAP] Receipt verified, refreshing user');
            }
            await useAuthStore.getState().refreshUser();
          } catch (error) {
            console.error('[GlobalIAP] Failed to verify receipt:', error);
          }
        })();

        pendingVerifyPromise = verifyPromise;
        await verifyPromise;
        if (pendingVerifyPromise === verifyPromise) {
          pendingVerifyPromise = null;
        }
      },
      (error) => {
        if (error?.code !== 'E_USER_CANCELLED') {
          console.error('[GlobalIAP] Purchase error:', error?.code || error?.message);
        }
      }
    );

    globalListenerActive = true;
    console.log('[GlobalIAP] Global IAP listener active');
  } catch (error) {
    console.error('[GlobalIAP] Failed to initialize global IAP:', error);
  }
}

export function isGlobalIAPActive(): boolean {
  return globalListenerActive;
}

export async function waitForPendingVerify(): Promise<void> {
  if (pendingVerifyPromise) {
    await pendingVerifyPromise;
  }
}
