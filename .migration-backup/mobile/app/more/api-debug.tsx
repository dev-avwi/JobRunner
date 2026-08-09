import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack, router } from 'expo-router';
import Constants from 'expo-constants';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography, shadows, fontWeights } from '../../src/lib/design-tokens';
import { API_URL } from '../../src/lib/api';
import {
  isIAPAvailable,
  fetchSubscriptions,
  IAP_PRODUCT_IDS,
} from '../../src/lib/iap';
import { isGlobalIAPActive } from '../../src/lib/iap-global';
import {
  hasShownReviewThisVersion,
  resetReviewPromptForTesting,
  maybeRequestReview,
} from '../../src/lib/store-review';
import { useAuthStore } from '../../src/lib/store';
import { getExpoExtras } from '../../src/lib/expo-extra';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';

const createStyles = (colors: ThemeColors, bottomNavHeight: number = 0) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: bottomNavHeight },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  cardTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  label: {
    ...typography.body,
    color: colors.mutedForeground,
    flexShrink: 0,
  },
  value: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: fontWeights.semibold,
    flex: 1,
    textAlign: 'right',
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButtonText: {
    ...typography.body,
    color: colors.primaryForeground,
    fontWeight: fontWeights.bold,
  },
  warningBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  warningText: {
    ...typography.caption,
    color: '#92400E',
  },
});

export default function ApiDebugScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const user = useAuthStore((s) => s.user);
  const isAuthorized = Boolean(user?.isPlatformAdmin);

  const [iapProductCount, setIapProductCount] = useState<number | null>(null);
  const [iapError, setIapError] = useState<string | null>(null);
  const [reviewShown, setReviewShown] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAuthorized && !__DEV__) {
      router.replace('/');
    }
  }, [isAuthorized]);

  const extras = getExpoExtras();
  const easProfile = extras.easProfile || 'unknown';
  const apiFromExtra = extras.apiUrl || '(unset)';
  const apiFromEnv = process.env.EXPO_PUBLIC_API_URL || '(unset)';
  const appVersion = Constants.expoConfig?.version || 'unknown';
  const buildNumber =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode?.toString();
  const isProdHost = API_URL.startsWith('https://jobrunner.com.au');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const shown = await hasShownReviewThisVersion();
        if (!cancelled) setReviewShown(shown);
      } catch {
        /* noop */
      }

      if (!isIAPAvailable()) {
        if (!cancelled) setIapProductCount(0);
        return;
      }
      try {
        const subs = await fetchSubscriptions();
        if (!cancelled) setIapProductCount(subs.length);
      } catch (err) {
        if (!cancelled) {
          setIapError(err instanceof Error ? err.message : String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const copy = async (label: string, value: string) => {
    try {
      await Clipboard.setStringAsync(value);
      Alert.alert('Copied', `${label} copied to clipboard.`);
    } catch {
      /* noop */
    }
  };

  if (!isAuthorized && !__DEV__) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'API & IAP Debug' }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'API & IAP Debug', headerBackTitle: 'Back' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {!isProdHost && !__DEV__ && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              This build is NOT pointed at the production host. If you are
              running App Review, please file this with the developer.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>API host</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Resolved</Text>
            <Text style={styles.value} numberOfLines={2}>
              {API_URL}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>From extras</Text>
            <Text style={styles.value} numberOfLines={2}>{apiFromExtra}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>From env</Text>
            <Text style={styles.value} numberOfLines={2}>{apiFromEnv}</Text>
          </View>
          <PressableRow style={styles.actionButton} onPress={() => copy('API host', API_URL)} >
            <Feather name="copy" size={16} color={colors.primaryForeground} />
            <Text style={styles.actionButtonText}>Copy API host</Text>
          </PressableRow>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Build</Text>
          <View style={styles.row}>
            <Text style={styles.label}>EAS profile</Text>
            <Text style={styles.value}>{easProfile}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>__DEV__</Text>
            <Text style={styles.value}>{String(__DEV__)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Version</Text>
            <Text style={styles.value}>{appVersion} ({buildNumber || '-'})</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Platform</Text>
            <Text style={styles.value}>{Platform.OS} {Platform.Version}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>In-App Purchase</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Available</Text>
            <Text style={styles.value}>{String(isIAPAvailable())}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Listener active</Text>
            <Text style={styles.value}>{String(isGlobalIAPActive())}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Products fetched</Text>
            <Text style={styles.value}>
              {iapProductCount === null ? 'loading…' : iapProductCount}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Product IDs</Text>
            <Text style={styles.value} numberOfLines={3}>
              {Object.values(IAP_PRODUCT_IDS).join('\n')}
            </Text>
          </View>
          {iapError && (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.label}>Error</Text>
                <Text style={styles.value} numberOfLines={4}>{iapError}</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Store review</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Prompted this version</Text>
            <Text style={styles.value}>
              {reviewShown === null ? 'loading…' : String(reviewShown)}
            </Text>
          </View>
          {__DEV__ && (
            <>
              <PressableRow style={styles.actionButton} onPress={async () => { await resetReviewPromptForTesting(); setReviewShown(false); Alert.alert('Reset', 'Review prompt unlocked for this version.'); }} >
                <Feather name="rotate-ccw" size={16} color={colors.primaryForeground} />
                <Text style={styles.actionButtonText}>Reset review lock (dev)</Text>
              </PressableRow>
              <PressableRow style={[styles.actionButton, { backgroundColor: colors.muted }]} onPress={async () => { await maybeRequestReview('debug-trigger'); const shown = await hasShownReviewThisVersion(); setReviewShown(shown); }} >
                <Feather name="star" size={16} color={colors.foreground} />
                <Text style={[styles.actionButtonText, { color: colors.foreground }]}>
                  Trigger review prompt (dev)
                </Text>
              </PressableRow>
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>User</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Authenticated</Text>
            <Text style={styles.value}>{String(Boolean(user))}</Text>
          </View>
          {user?.email && (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value} numberOfLines={1}>{user.email}</Text>
              </View>
            </>
          )}
          {user?.subscriptionTier && (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.label}>Tier</Text>
                <Text style={styles.value}>{user.subscriptionTier}</Text>
              </View>
            </>
          )}
        </View>

        <PressableRow style={[styles.actionButton, { backgroundColor: colors.muted }]} onPress={() => router.back()} >
          <Text style={[styles.actionButtonText, { color: colors.foreground }]}>
            Done
          </Text>
        </PressableRow>
      </ScrollView>
    </View>
  );
}
