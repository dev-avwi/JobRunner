import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack, router } from 'expo-router';
import { asHref } from '../../src/lib/nav';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useAuthStore } from '../../src/lib/store';
import { useUserRole } from '../../src/hooks/use-user-role';
import { api } from '../../src/lib/api';
import { spacing, radius, shadows, typography, fontWeights } from '../../src/lib/design-tokens';
import {
  fetchSubscriptions,
  purchaseSubscription,
  restorePurchases,
  isIAPAvailable,
  IAP_PRODUCT_IDS,
  productIdToTier,
} from '../../src/lib/iap';
import { initGlobalIAP } from '../../src/lib/iap-global';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';

interface SubscriptionStatus {
  tier: 'free' | 'pro' | 'team' | 'business' | 'trial';
  status: string;
  isTrial?: boolean;
  daysRemaining?: number | null;
  trialEndsAt?: string | null;
  nextBillingDate?: string | null;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionSource?: 'apple' | 'stripe' | 'manual' | null;
  seats?: number;
  teamMemberCount?: number;
  totalBillableUsers?: number;
  isBeta?: boolean;
  betaUser?: boolean;
  paymentMethod?: {
    last4: string;
    brand: string;
  } | null;
}

interface UsageData {
  jobs: { used: number; limit: number | null };
  invoices: { used: number; limit: number | null };
  clients: { used: number; limit: number | null };
}

const PLAN_DETAILS: Record<string, { name: string; icon: string; color: string; features: string[] }> = {
  free: {
    name: 'Starter',
    icon: 'zap',
    color: '#6B7280',
    features: ['25 jobs/month', '25 invoices/month', '50 clients', 'Unlimited quotes'],
  },
  pro: {
    name: 'Pro',
    icon: 'award',
    color: '#2563EB',
    features: ['Unlimited jobs & invoices', 'AI-powered features', 'Custom templates', 'Email integration', 'Priority support'],
  },
  team: {
    name: 'Team',
    icon: 'users',
    color: '#7C3AED',
    features: ['Everything in Pro', 'Up to 5 workers', 'Team management', 'GPS & live tracking', 'Time tracking', 'Team chat'],
  },
  business: {
    name: 'Business',
    icon: 'briefcase',
    color: '#059669',
    features: ['Everything in Team', 'Up to 15 workers', 'Role-based permissions', 'Advanced reporting', 'Priority support'],
  },
  trial: {
    name: 'Trial',
    icon: 'clock',
    color: '#F59E0B',
    features: ['Full access to all features', 'Try before you commit'],
  },
};

const createStyles = (colors: ThemeColors, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: bottomNavHeight,
  },
  planCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    ...shadows.md,
  },
  planIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  planIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: {
    ...typography.title,
    color: colors.foreground,
  },
  planStatus: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: fontWeights.semibold,
    marginTop: 2,
  },
  planFeatures: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  planFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  planFeatureText: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  infoSection: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  infoSectionTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoLabel: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  infoValue: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: fontWeights.semibold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  usageBar: {
    height: 6,
    backgroundColor: colors.muted,
    borderRadius: 3,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  usageFill: {
    height: '100%',
    borderRadius: 3,
  },
  usageRow: {
    paddingVertical: spacing.sm,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  manageButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  manageButtonText: {
    ...typography.body,
    color: colors.primaryForeground,
    fontWeight: fontWeights.bold,
  },
  manageDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  trialBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  trialBannerDark: {
    backgroundColor: '#78350F20',
  },
  trialBannerText: {
    flex: 1,
  },
  trialBannerTitle: {
    ...typography.subtitle,
    color: '#92400E',
    marginBottom: 4,
  },
  trialBannerSubtitle: {
    ...typography.caption,
    color: '#A16207',
  },
  betaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98120',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  betaBadgeText: {
    ...typography.caption,
    color: '#10B981',
    fontWeight: fontWeights.bold,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  addOnSection: {
    marginTop: spacing.md,
  },
  addOnCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addOnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  addOnIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addOnName: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  addOnPrice: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: fontWeights.semibold,
    marginTop: 2,
  },
  addOnDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  webNote: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    lineHeight: 18,
  },
  comparePlansSection: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  comparePlansTitle: {
    ...typography.title,
    color: colors.foreground,
    marginBottom: 4,
  },
  comparePlansSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  comparePlanCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  comparePlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  comparePlanIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comparePlanName: {
    ...typography.body,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  comparePlanDesc: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  comparePlanFeatures: {
    gap: spacing.sm,
  },
  comparePlanFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  comparePlanFeatureText: {
    ...typography.caption,
    color: colors.foreground,
  },
  comparePlanPrice: {
    fontSize: typography.sizes['2xl'],
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  comparePlanPriceUnit: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.regular,
    color: colors.mutedForeground,
  },
  upgradePlanButton: {
    marginTop: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  upgradePlanButtonText: {
    color: colors.white,
    fontWeight: fontWeights.semibold,
    fontSize: typography.sizes.md,
  },
  restoreButton: {
    alignItems: 'center' as const,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  restoreButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: fontWeights.medium,
  },
  subscriptionLegalSection: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  subscriptionLegalText: {
    ...typography.caption,
    color: colors.mutedForeground,
    lineHeight: 18,
    textAlign: 'center' as const,
    marginBottom: spacing.sm,
  },
  legalLinksRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  },
  legalLink: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: fontWeights.medium,
  },
  legalSeparator: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  webNoteCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.md,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
  },
  webNoteTitle: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: 4,
  },
  webNoteText: {
    ...typography.caption,
    color: colors.mutedForeground,
    lineHeight: 18,
  },
  webNoteSupport: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 6,
  },
});

export default function SubscriptionPage() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const user = useAuthStore(state => state.user);
  const { isSubcontractor, isStandaloneSubcontractor } = useUserRole();

  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [managingSubscription, setManagingSubscription] = useState(false);
  const [purchasingTier, setPurchasingTier] = useState<'pro' | 'team' | 'business' | null>(null);
  const [restoring, setRestoring] = useState(false);
  const purchaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPurchaseTimeout = useCallback(() => {
    if (purchaseTimeoutRef.current) {
      clearTimeout(purchaseTimeoutRef.current);
      purchaseTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearPurchaseTimeout();
  }, [clearPurchaseTimeout]);

  const [applePrices, setApplePrices] = useState<Record<string, string>>({});

  const fetchSubscriptionStatus = useCallback(async () => {
    try {
      const [subResponse, usageResponse] = await Promise.all([
        api.get<SubscriptionStatus>('/api/subscription/status'),
        api.get<UsageData>('/api/subscription/usage').catch(() => ({ data: null, error: null })),
      ]);

      if (subResponse.data) {
        setSubscriptionStatus(subResponse.data);
      }
      if (usageResponse.data) {
        setUsage(usageResponse.data);
      }
    } catch (error) {
      console.error('Failed to fetch subscription status:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptionStatus();
  }, [fetchSubscriptionStatus]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSubscriptionStatus();
  }, [fetchSubscriptionStatus]);

  useEffect(() => {
    if (!isIAPAvailable()) return;

    let cancelled = false;
    initGlobalIAP().then(async () => {
      try {
        const subs = await fetchSubscriptions();
        if (cancelled) return;
        const prices: Record<string, string> = {};
        subs.forEach((sub) => {
          const tier = productIdToTier(sub.productId);
          const localizedPrice = 'localizedPrice' in sub ? (sub as { localizedPrice?: string }).localizedPrice : undefined;
          if (tier && localizedPrice) {
            prices[tier] = localizedPrice;
          }
        });
        if (Object.keys(prices).length > 0) {
          setApplePrices(prices);
        }
      } catch (err) {
        console.log('[IAP] Could not fetch store prices, using defaults');
      }
    });

    return () => { cancelled = true; };
  }, []);

  const tierFromAuth = useAuthStore((state) => state.user?.subscriptionTier);
  const previousTierRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const previous = previousTierRef.current;
    previousTierRef.current = tierFromAuth;
    if (previous === undefined) return;
    if (previous === tierFromAuth) return;

    fetchSubscriptionStatus();

    const upgraded = tierFromAuth && tierFromAuth !== 'free' && tierFromAuth !== 'trial';
    if (upgraded && purchasingTier) {
      const tierLabel = (tierFromAuth || '').toString();
      Alert.alert('Upgrade Successful', `You're now on the ${tierLabel.charAt(0).toUpperCase() + tierLabel.slice(1)} plan.`);
    }
    clearPurchaseTimeout();
    setPurchasingTier(null);
  }, [tierFromAuth]);

  const handleUpgrade = async (tier: 'pro' | 'team' | 'business') => {
    const tierNames = { pro: 'Pro', team: 'Team', business: 'Business' };
    const defaultPrices = { pro: '$49.99', team: '$99.99', business: '$199.99' };
    const productIds = {
      pro: IAP_PRODUCT_IDS.pro,
      team: IAP_PRODUCT_IDS.team,
      business: IAP_PRODUCT_IDS.business,
    };

    if (Platform.OS === 'ios') {
      const storePrice = applePrices[tier];
      if (!storePrice) {
        Alert.alert(
          'Coming Soon',
          `In-app subscriptions for the ${tierNames[tier]} plan are being set up. Visit jobrunner.com.au/pricing to subscribe now, or check back shortly.`,
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Open Website', onPress: () => Linking.openURL('https://jobrunner.com.au/pricing') },
          ]
        );
        return;
      }
      setPurchasingTier(tier);

      clearPurchaseTimeout();
      purchaseTimeoutRef.current = setTimeout(async () => {
        purchaseTimeoutRef.current = null;
        try { await useAuthStore.getState().refreshUser(); } catch {}
        await fetchSubscriptionStatus();
        setPurchasingTier(null);
        Alert.alert(
          'Still Processing',
          'The App Store is taking longer than usual. If you completed the purchase, tap "Restore Purchases" below to activate your plan, or check back in a moment.',
          [{ text: 'OK' }]
        );
      }, 90000);

      try {
        await purchaseSubscription(productIds[tier]);
      } catch (error: any) {
        console.error('[IAP] Purchase error details:', JSON.stringify(error, null, 2));
        clearPurchaseTimeout();
        setPurchasingTier(null);
        if (error?.code !== 'E_USER_CANCELLED') {
          const errorMsg = error?.message || error?.code || 'Unknown error';
          if (errorMsg.toLowerCase().includes('invalid') || errorMsg.includes('E_DEVELOPER_ERROR')) {
            Alert.alert(
              'Not Available Yet',
              `This subscription is being finalised in the App Store. Visit jobrunner.com.au/pricing to subscribe now.`,
              [
                { text: 'OK', style: 'cancel' },
                { text: 'Open Website', onPress: () => Linking.openURL('https://jobrunner.com.au/pricing') },
              ]
            );
          } else {
            Alert.alert('Purchase Failed', `${errorMsg}\n\nPlease try again.`);
          }
        }
      }
    } else if (Platform.OS === 'android') {
      const price = applePrices[tier] || defaultPrices[tier];
      Alert.alert(
        `Upgrade to ${tierNames[tier]}`,
        `${price}/month. Pay securely on the web — we'll email you a link or open it now.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Email Me a Link',
            onPress: async () => {
              setPurchasingTier(tier);
              try {
                const response = await api.post<{ success?: boolean; message?: string; error?: string; betaAccess?: boolean }>(
                  '/api/subscription/email-payment-link',
                  { tier }
                );
                if (response.data?.betaAccess) {
                  await useAuthStore.getState().refreshUser();
                  await fetchSubscriptionStatus();
                  Alert.alert('Activated', response.data.message || 'Plan activated.');
                } else if (response.data?.success) {
                  Alert.alert(
                    'Check Your Email',
                    response.data.message || `We've emailed you a secure link to finish your upgrade.`
                  );
                } else {
                  Alert.alert('Couldn\'t Send Link', response.error || response.data?.error || 'Please try again or open the website.');
                }
              } catch (err: any) {
                Alert.alert('Error', err?.message || 'Failed to email payment link.');
              } finally {
                setPurchasingTier(null);
              }
            },
          },
          { text: 'Open Website', onPress: () => Linking.openURL('https://jobrunner.com.au/pricing') },
        ]
      );
    }
  };

  const handleRestorePurchases = async () => {
    setRestoring(true);
    try {
      const purchases = await restorePurchases();
      if (purchases.length > 0) {
        const latestPurchase = purchases[purchases.length - 1];
        const tier = productIdToTier(latestPurchase.productId);
        if (tier) {
          await api.post('/api/subscription/restore-apple', {
            receiptData: (latestPurchase as any).transactionReceipt,
            productId: latestPurchase.productId,
          });
          await useAuthStore.getState().refreshUser();
          await fetchSubscriptionStatus();
          Alert.alert('Purchases Restored', `Your ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan has been restored.`);
        }
      } else {
        Alert.alert('No Purchases Found', 'No previous subscriptions were found for this Apple ID.');
      }
    } catch (error) {
      console.error('[IAP] Restore failed:', error);
      Alert.alert('Restore Failed', 'Could not restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const openPlatformManageSubscription = async () => {
    if (Platform.OS === 'ios') {
      await Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else if (Platform.OS === 'android') {
      // Generic Play Store subscription management — works whether or not the
      // user has an active sub for this app.
      await Linking.openURL('https://play.google.com/store/account/subscriptions');
    }
  };

  const handleManageBilling = async () => {
    const source = subscriptionStatus?.subscriptionSource;
    if (source === 'apple') {
      await openPlatformManageSubscription();
      return;
    }
    if (subscriptionStatus?.isBeta || subscriptionStatus?.betaUser) {
      Alert.alert(
        'Founding Member',
        'As a Founding Member, your plan is managed directly by the JobRunner team. No action needed!\n\nFor any questions, contact admin@avwebinnovation.com'
      );
      return;
    }
    if (source === 'stripe' || subscriptionStatus?.stripeSubscriptionId) {
      setManagingSubscription(true);
      try {
        const response = await api.post<{ url: string }>('/api/subscription/manage');
        if (response.data?.url) {
          await Linking.openURL(response.data.url);
        }
      } catch {
        Alert.alert('Unable to open billing', 'Please contact admin@avwebinnovation.com for billing assistance.');
      } finally {
        setManagingSubscription(false);
      }
      return;
    }
    Alert.alert('Manage Subscription', 'Contact admin@avwebinnovation.com for billing assistance.');
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const currentTier = subscriptionStatus?.tier || 'free';
  const isOnTrial = subscriptionStatus?.isTrial === true || subscriptionStatus?.status === 'trialing' || currentTier === 'trial';
  const planInfo = PLAN_DETAILS[currentTier] || PLAN_DETAILS.free;
  const hasActiveSubscription = currentTier === 'pro' || currentTier === 'team' || currentTier === 'business' || isOnTrial;
  const isBeta = subscriptionStatus?.isBeta || subscriptionStatus?.betaUser;

  const getUsagePercent = (used: number, limit: number | null) => {
    if (!limit) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return '#EF4444';
    if (percent >= 70) return '#F59E0B';
    return colors.primary;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Business Plan', headerBackTitle: 'Back' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Business Plan', headerBackTitle: 'Back' }} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {isBeta && (
          <View style={styles.betaBadge}>
            <Feather name="star" size={14} color="#10B981" />
            <Text style={styles.betaBadgeText}>Founding Member</Text>
          </View>
        )}

        {isOnTrial && subscriptionStatus?.trialEndsAt && (
          <View style={[styles.trialBanner, isDark && styles.trialBannerDark]}>
            <Feather name="clock" size={20} color="#92400E" />
            <View style={styles.trialBannerText}>
              <Text style={styles.trialBannerTitle}>Trial Active</Text>
              <Text style={styles.trialBannerSubtitle}>
                {typeof subscriptionStatus.daysRemaining === 'number'
                  ? `${subscriptionStatus.daysRemaining} day${subscriptionStatus.daysRemaining === 1 ? '' : 's'} left — trial ends ${formatDate(subscriptionStatus.trialEndsAt)}.`
                  : `Your trial ends ${formatDate(subscriptionStatus.trialEndsAt)}.`}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.planCard}>
          <View style={styles.planIconRow}>
            <View style={styles.planIconCircle}>
              <Feather name={planInfo.icon as any} size={22} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.planName}>{planInfo.name} Plan</Text>
              <Text style={styles.planStatus}>
                {isBeta ? 'Lifetime Access' : 
                 subscriptionStatus?.cancelAtPeriodEnd ? 'Cancels at period end' : 
                 'Active'}
              </Text>
            </View>
          </View>
          <View style={styles.planFeatures}>
            {planInfo.features.map((feature, i) => (
              <View key={i} style={styles.planFeatureItem}>
                <Feather name="check" size={16} color={colors.primary} />
                <Text style={styles.planFeatureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>

        {hasActiveSubscription && (
          <View style={styles.infoSection}>
            <Text style={styles.infoSectionTitle}>Billing Details</Text>
            {subscriptionStatus?.nextBillingDate && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Next billing date</Text>
                  <Text style={styles.infoValue}>{formatDate(subscriptionStatus.nextBillingDate)}</Text>
                </View>
                <View style={styles.divider} />
              </>
            )}
            {subscriptionStatus?.currentPeriodEnd && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Current period ends</Text>
                  <Text style={styles.infoValue}>{formatDate(subscriptionStatus.currentPeriodEnd)}</Text>
                </View>
                <View style={styles.divider} />
              </>
            )}
            {subscriptionStatus?.paymentMethod && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Payment method</Text>
                <Text style={styles.infoValue}>
                  {subscriptionStatus.paymentMethod.brand} ****{subscriptionStatus.paymentMethod.last4}
                </Text>
              </View>
            )}
            {currentTier === 'team' && subscriptionStatus?.teamMemberCount != null && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Team members</Text>
                  <Text style={styles.infoValue}>{subscriptionStatus.teamMemberCount} seats</Text>
                </View>
              </>
            )}
          </View>
        )}

        {usage && currentTier === 'free' && (
          <View style={styles.infoSection}>
            <Text style={styles.infoSectionTitle}>Usage This Month</Text>
            {[
              { label: 'Jobs', data: usage.jobs },
              { label: 'Invoices', data: usage.invoices },
              { label: 'Clients', data: usage.clients },
            ].map((item, i) => {
              const percent = getUsagePercent(item.data.used, item.data.limit);
              const usageColor = getUsageColor(percent);
              return (
                <View key={i} style={styles.usageRow}>
                  <View style={styles.usageHeader}>
                    <Text style={styles.infoLabel}>{item.label}</Text>
                    <Text style={styles.infoValue}>
                      {item.data.used}{item.data.limit ? ` / ${item.data.limit}` : ''}
                    </Text>
                  </View>
                  {item.data.limit && (
                    <View style={styles.usageBar}>
                      <View style={[styles.usageFill, { width: `${percent}%`, backgroundColor: usageColor }]} />
                    </View>
                  )}
                  {i < 2 && <View style={[styles.divider, { marginTop: spacing.sm }]} />}
                </View>
              );
            })}
          </View>
        )}

        {hasActiveSubscription && (
          <PressableRow style={styles.manageButton} onPress={handleManageBilling} disabled={managingSubscription} >
            {managingSubscription ? (
              <ActivityIndicator color={colors.primaryForeground} size="small" />
            ) : (
              <>
                <Feather name="settings" size={18} color={colors.primaryForeground} />
                <Text style={styles.manageButtonText}>
                  {subscriptionStatus?.subscriptionSource === 'apple' ? 'Manage in App Store' : 'Manage Billing'}
                </Text>
              </>
            )}
          </PressableRow>
        )}

        {hasActiveSubscription && (
          <Text style={styles.manageDescription}>
            {subscriptionStatus?.subscriptionSource === 'apple'
              ? 'Manage, upgrade, or cancel your subscription through the App Store.'
              : 'View invoices and update payment details for your business subscription.'}
          </Text>
        )}

        {!isBeta && (currentTier === 'free' || currentTier === 'pro' || currentTier === 'team') && !(isSubcontractor && currentTier !== 'free') && !(isSubcontractor && !isStandaloneSubcontractor) && (
          <View style={styles.comparePlansSection}>
            <Text style={styles.comparePlansTitle}>
              {currentTier === 'free' ? 'Upgrade Your Plan' : 'Available Upgrades'}
            </Text>
            <Text style={styles.comparePlansSubtitle}>
              {currentTier === 'free' ? 'Unlock more features for your business' : 'Take your business to the next level'}
            </Text>

            {currentTier === 'free' && (
              <View style={[styles.comparePlanCard, { borderColor: '#2563EB', borderWidth: 2 }]}>
                <View style={styles.comparePlanHeader}>
                  <View style={[styles.comparePlanIcon, { backgroundColor: '#2563EB15' }]}>  
                    <Feather name="award" size={20} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.comparePlanName}>Pro</Text>
                    <Text style={styles.comparePlanDesc}>For solo tradies ready to grow</Text>
                  </View>
                  <Text style={styles.comparePlanPrice}>$49.99<Text style={styles.comparePlanPriceUnit}>/mo</Text></Text>
                </View>
                <View style={styles.comparePlanFeatures}>
                  {['Unlimited jobs & invoices', 'AI-powered features', 'Custom templates', 'Email integration', 'Priority support'].map((f, i) => (
                    <View key={i} style={styles.comparePlanFeatureRow}>
                      <Feather name="check" size={14} color="#2563EB" />
                      <Text style={styles.comparePlanFeatureText}>{f}</Text>
                    </View>
                  ))}
                </View>
                <PressableRow style={[styles.upgradePlanButton, { backgroundColor: '#2563EB' }, purchasingTier !== null && { opacity: 0.6 }]} onPress={() => handleUpgrade('pro')} disabled={purchasingTier !== null} >
                  {purchasingTier === 'pro' ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.upgradePlanButtonText}>Upgrade to Pro</Text>}
                </PressableRow>
              </View>
            )}

            {!isSubcontractor && (currentTier === 'free' || currentTier === 'pro') && (
              <View style={[styles.comparePlanCard, currentTier === 'pro' ? { borderColor: '#7C3AED', borderWidth: 2 } : {}]}>
                <View style={styles.comparePlanHeader}>
                  <View style={[styles.comparePlanIcon, { backgroundColor: '#7C3AED15' }]}>
                    <Feather name="users" size={20} color="#7C3AED" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.comparePlanName}>Team</Text>
                    <Text style={styles.comparePlanDesc}>For businesses with workers</Text>
                  </View>
                  <Text style={styles.comparePlanPrice}>$99.99<Text style={styles.comparePlanPriceUnit}>/mo</Text></Text>
                </View>
                <View style={styles.comparePlanFeatures}>
                  {['Everything in Pro', 'Up to 5 workers', 'GPS & live tracking', 'Time tracking & timesheets', 'Team chat'].map((f, i) => (
                    <View key={i} style={styles.comparePlanFeatureRow}>
                      <Feather name="check" size={14} color="#7C3AED" />
                      <Text style={styles.comparePlanFeatureText}>{f}</Text>
                    </View>
                  ))}
                </View>
                <PressableRow style={[styles.upgradePlanButton, { backgroundColor: '#7C3AED' }, purchasingTier !== null && { opacity: 0.6 }]} onPress={() => handleUpgrade('team')} disabled={purchasingTier !== null} >
                  {purchasingTier === 'team' ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.upgradePlanButtonText}>Upgrade to Team</Text>}
                </PressableRow>
              </View>
            )}

            {!isSubcontractor && (currentTier === 'free' || currentTier === 'pro' || currentTier === 'team') && (
              <View style={[styles.comparePlanCard, currentTier === 'team' ? { borderColor: '#059669', borderWidth: 2 } : {}]}>
                <View style={styles.comparePlanHeader}>
                  <View style={[styles.comparePlanIcon, { backgroundColor: '#05966915' }]}>
                    <Feather name="briefcase" size={20} color="#059669" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.comparePlanName}>Business</Text>
                    <Text style={styles.comparePlanDesc}>For larger crews</Text>
                  </View>
                  <Text style={styles.comparePlanPrice}>$199.99<Text style={styles.comparePlanPriceUnit}>/mo</Text></Text>
                </View>
                <View style={styles.comparePlanFeatures}>
                  {['Everything in Team', 'Up to 15 workers', 'Role-based permissions', 'Advanced reporting', 'Priority support'].map((f, i) => (
                    <View key={i} style={styles.comparePlanFeatureRow}>
                      <Feather name="check" size={14} color="#059669" />
                      <Text style={styles.comparePlanFeatureText}>{f}</Text>
                    </View>
                  ))}
                </View>
                <PressableRow style={[styles.upgradePlanButton, { backgroundColor: '#059669' }, purchasingTier !== null && { opacity: 0.6 }]} onPress={() => handleUpgrade('business')} disabled={purchasingTier !== null} >
                  {purchasingTier === 'business' ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.upgradePlanButtonText}>Upgrade to Business</Text>}
                </PressableRow>
              </View>
            )}
          </View>
        )}

        <View style={styles.addOnSection}>
          <Text style={[styles.infoSectionTitle, { marginBottom: spacing.md }]}>Available Add-Ons</Text>
          
          <PressableRow style={styles.addOnCard} onPress={() => router.push(asHref('/more/ai-receptionist'))} >
            <View style={styles.addOnHeader}>
              <View style={styles.addOnIconCircle}>
                <Feather name="phone" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addOnName}>AI Receptionist</Text>
                <Text style={styles.addOnPrice}>$60/mo</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </View>
            <Text style={styles.addOnDescription}>
              AI-powered phone answering with a dedicated Australian number. Captures leads and transfers calls.
            </Text>
          </PressableRow>

          <PressableRow style={styles.addOnCard} onPress={() => router.push(asHref('/more/phone-numbers'))} >
            <View style={styles.addOnHeader}>
              <View style={styles.addOnIconCircle}>
                <Feather name="smartphone" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addOnName}>Dedicated Number</Text>
                <Text style={styles.addOnPrice}>$10/mo</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </View>
            <Text style={styles.addOnDescription}>
              Your own Australian mobile number for sending SMS and receiving calls. A real telecommunications service.
            </Text>
          </PressableRow>
        </View>

        {/* Restore Purchases — required by Apple guideline 3.1.1.
            Surfaced on Android too so subscribers who reinstall can recover. */}
        {Platform.OS !== 'web' && (
          <PressableRow style={styles.restoreButton} onPress={handleRestorePurchases} disabled={restoring} testID="button-restore-purchases" >
            {restoring ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={styles.restoreButtonText}>Restore Purchases</Text>
            )}
          </PressableRow>
        )}

        {/* Manage Subscription deep-link — required by Apple guideline 3.1.2.
            Always visible (not just for active subs) so reviewers can verify
            the link works on a fresh account. */}
        {Platform.OS !== 'web' && (
          <PressableRow style={styles.restoreButton} onPress={openPlatformManageSubscription} testID="button-manage-subscription" >
            <Text style={styles.restoreButtonText}>
              {Platform.OS === 'ios' ? 'Manage Subscription in App Store' : 'Manage Subscription in Play Store'}
            </Text>
          </PressableRow>
        )}

        {/* Auto-renewal disclosure + Terms / Privacy / EULA links — required by
            Apple guideline 3.1.2 and Play subscription content policy. */}
        {Platform.OS !== 'web' && (
          <View style={styles.subscriptionLegalSection}>
            <Text style={styles.subscriptionLegalText}>
              Subscriptions automatically renew monthly unless cancelled at least 24 hours before the end of the current period. Your {Platform.OS === 'ios' ? 'Apple ID' : 'Google'} account will be charged for renewal within 24 hours prior to the end of the current period. You can manage and cancel your subscriptions in your {Platform.OS === 'ios' ? 'App Store' : 'Play Store'} account settings.
            </Text>
            <View style={styles.legalLinksRow}>
              <PressableRow onPress={() => Linking.openURL('https://jobrunner.com.au/terms-of-service')} testID="link-terms">
                <Text style={styles.legalLink}>Terms of Use (EULA)</Text>
              </PressableRow>
              <Text style={styles.legalSeparator}>|</Text>
              <PressableRow onPress={() => Linking.openURL('https://jobrunner.com.au/privacy-policy')} testID="link-privacy">
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </PressableRow>
            </View>
          </View>
        )}

        <View style={styles.webNoteCard}>
          <Feather name="message-circle" size={18} color={colors.mutedForeground} />
          <View style={{ flex: 1 }}>
            <Text style={styles.webNoteTitle}>Need Help?</Text>
            <Text style={styles.webNoteText}>
              Have questions about your business account or need support?
            </Text>
            <Text style={styles.webNoteSupport}>
              admin@avwebinnovation.com
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
