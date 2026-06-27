import { storage } from './storage';

const TIER_MAP: Record<string, string> = {
  'com.jobrunner.pro.monthly': 'pro',
  'com.jobrunner.team.monthly': 'team',
  'com.jobrunner.business.monthly': 'business',
};

const ADDON_MAP: Record<string, 'dedicated_number' | 'ai_receptionist'> = {
  'com.jobrunner.dedicatednumber.monthly': 'dedicated_number',
  'com.jobrunner.aireceptionist.monthly': 'ai_receptionist',
};

/**
 * Handle Apple Server Notifications for add-on subscriptions (AI Receptionist, Dedicated
 * Number). Keeps addon_subscriptions (the billing source of truth read by every platform)
 * in sync and de-provisions the feature when the add-on lapses, refunds or is revoked.
 */
async function applyAddonNotification(
  addon: 'dedicated_number' | 'ai_receptionist',
  notificationType: string,
  originalTransactionId: string,
  productId: string,
): Promise<void> {
  const sub = await storage.getAddonSubscriptionByAppleTxn(originalTransactionId);
  if (!sub) {
    console.warn(`[AppleWebhook] No add-on subscription for txn ${originalTransactionId} (${addon}, ${notificationType})`);
    return;
  }
  const userId = sub.userId;

  switch (notificationType) {
    case 'SUBSCRIBED':
    case 'DID_RENEW':
    case 'DID_CHANGE_RENEWAL_PREF': {
      await storage.upsertAddonSubscription(userId, addon, {
        source: 'apple',
        status: 'active',
        appleProductId: productId,
        appleOriginalTransactionId: originalTransactionId,
      });
      console.log(`[AppleWebhook] User ${userId} add-on ${addon} active`);
      break;
    }
    case 'DID_FAIL_TO_RENEW': {
      await storage.updateAddonSubscriptionStatus(sub.id, 'past_due');
      console.log(`[AppleWebhook] User ${userId} add-on ${addon} renewal failed — past_due`);
      break;
    }
    case 'EXPIRED':
    case 'GRACE_PERIOD_EXPIRED':
    case 'REFUND':
    case 'REVOKE': {
      const ended = notificationType === 'REFUND' || notificationType === 'REVOKE' ? 'canceled' : 'expired';
      await storage.updateAddonSubscriptionStatus(sub.id, ended);
      await deprovisionAddon(userId, addon);
      console.log(`[AppleWebhook] User ${userId} add-on ${addon} ${ended} — feature turned off`);
      break;
    }
    default: {
      console.log(`[AppleWebhook] Add-on notification ${notificationType} acknowledged for ${addon} (no action)`);
      break;
    }
  }
}

/** Turn off the feature an add-on pays for once its subscription ends. */
async function deprovisionAddon(userId: string, addon: 'dedicated_number' | 'ai_receptionist'): Promise<void> {
  try {
    if (addon === 'ai_receptionist') {
      await storage.updateBusinessSettings(userId, { aiReceptionistEnabled: false });
      const config = await storage.getAiReceptionistConfig(userId);
      if (config) {
        await storage.updateAiReceptionistConfig(userId, { enabled: false, mode: 'off' });
      }
    } else if (addon === 'dedicated_number') {
      // Number provisioning is a separate billable resource; flag SMS back to standard.
      // The number itself is released through the existing admin release flow to avoid
      // accidental Twilio releases on transient lapses.
      await storage.updateBusinessSettings(userId, { aiReceptionistEnabled: false, smsMode: 'standard' });
    }
  } catch (e) {
    console.error(`[AppleWebhook] Failed to de-provision ${addon} for user ${userId}:`, e);
  }
}

/**
 * Apply a verified Apple App Store Server Notification V2 to subscription state.
 * Called only after the outer JWS + nested JWS payloads have been
 * cryptographically verified by appleIapVerify.ts.
 */
export async function applyAppleNotification(args: {
  notification: any;
  transactionInfo: any | null;
  renewalInfo: any | null;
}): Promise<void> {
  const { notification, transactionInfo, renewalInfo } = args;
  const { notificationType, subtype, data } = notification;
  const environment = data?.environment;

  const originalTransactionId =
    transactionInfo?.originalTransactionId || renewalInfo?.originalTransactionId;
  const productId =
    transactionInfo?.productId ||
    renewalInfo?.productId ||
    renewalInfo?.autoRenewProductId;

  console.log(
    `[AppleWebhook] type=${notificationType} subtype=${subtype || '-'} env=${environment} txn=${originalTransactionId} product=${productId}`,
  );

  if (!originalTransactionId) {
    console.warn('[AppleWebhook] No originalTransactionId — cannot route notification');
    return;
  }

  // Add-on subscriptions (AI Receptionist, Dedicated Number) are tracked separately from
  // the main tier on the user record, so route them before the tier-user lookup.
  const addon = ADDON_MAP[productId];
  if (addon) {
    await applyAddonNotification(addon, notificationType, originalTransactionId, productId);
    return;
  }

  const user = await storage.getUserByAppleOriginalTransactionId(originalTransactionId);
  if (!user) {
    console.warn(
      `[AppleWebhook] No user found for txn ${originalTransactionId} (notification: ${notificationType})`,
    );
    return;
  }

  switch (notificationType) {
    case 'SUBSCRIBED':
    case 'DID_RENEW':
    case 'DID_CHANGE_RENEWAL_PREF': {
      const newTier = TIER_MAP[productId] || user.subscriptionTier;
      await storage.updateUser(user.id, {
        subscriptionTier: newTier,
        subscriptionStatus: 'active',
        subscriptionSource: 'apple',
        appleProductId: productId,
      } as any);
      if (newTier === 'team' || newTier === 'business') {
        const bs = await storage.getBusinessSettings(user.id);
        if (bs && (!bs.teamSize || bs.teamSize === 'solo')) {
          await storage.updateBusinessSettings(user.id, { teamSize: 'small' });
        }
      }
      console.log(`[AppleWebhook] User ${user.id} subscription active: ${newTier}`);
      break;
    }
    case 'EXPIRED':
    case 'GRACE_PERIOD_EXPIRED': {
      await storage.updateUser(user.id, {
        subscriptionTier: 'free',
        subscriptionStatus: 'expired',
      } as any);
      console.log(`[AppleWebhook] User ${user.id} subscription expired — downgraded to free`);
      break;
    }
    case 'DID_FAIL_TO_RENEW': {
      await storage.updateUser(user.id, {
        subscriptionStatus: 'past_due',
      } as any);
      console.log(`[AppleWebhook] User ${user.id} renewal failed — marked past_due`);
      break;
    }
    case 'DID_CHANGE_RENEWAL_STATUS': {
      const willAutoRenew = renewalInfo?.autoRenewStatus === 1;
      console.log(`[AppleWebhook] User ${user.id} auto-renew set to ${willAutoRenew}`);
      break;
    }
    case 'REFUND':
    case 'REVOKE': {
      await storage.updateUser(user.id, {
        subscriptionTier: 'free',
        subscriptionStatus: 'canceled',
      } as any);
      console.log(`[AppleWebhook] User ${user.id} subscription refunded/revoked — downgraded to free`);
      break;
    }
    case 'PRICE_INCREASE':
    case 'OFFER_REDEEMED':
    case 'TEST':
    default: {
      console.log(`[AppleWebhook] Notification type ${notificationType} acknowledged (no action)`);
      break;
    }
  }
}
