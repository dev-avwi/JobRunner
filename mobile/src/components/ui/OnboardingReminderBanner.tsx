import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/store';
import { useTheme } from '../../lib/theme';

const DISMISS_KEY_PREFIX = 'jobrunner.onboarding-reminder.dismissed.v1';
const dismissKeyFor = (userId: string | undefined | null) =>
  `${DISMISS_KEY_PREFIX}.${userId ?? 'anon'}`;

export function OnboardingReminderBanner() {
  const { colors } = useTheme();
  const businessSettings = useAuthStore((s) => s.businessSettings);
  const userId = useAuthStore((s) => s.user?.id);
  const isOwner = useAuthStore((s) => s.isOwner)();
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(dismissKeyFor(userId))
      .then((v) => { if (mounted) setDismissed(v === '1'); })
      .catch(() => { if (mounted) setDismissed(false); });
    return () => { mounted = false; };
  }, [userId]);

  if (!isOwner) return null;
  if (!businessSettings?.onboardingCompleted) return null;
  const incomplete = !businessSettings?.businessName?.trim() || !businessSettings?.tradeType;
  if (!incomplete) return null;
  if (dismissed) return null;

  const onDismiss = async () => {
    setDismissed(true);
    try { await AsyncStorage.setItem(dismissKeyFor(userId), '1'); } catch {}
  };

  const onFinish = () => {
    // `?resume=1` tells the global guard in _layout.tsx to allow this
    // intentional re-entry into the wizard even though onboarding is
    // already marked complete (the banner only ever shows when the
    // owner skipped with empty business profile).
    router.push('/(onboarding)/setup?resume=1');
  };

  return (
    <View style={[styles.wrap, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '33' }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.primary + '22' }]}>
        <Ionicons name="construct-outline" size={18} color={colors.primary} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: colors.foreground }]}>Finish setting up your business</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={2}>
          Add your business name and trade so quotes, invoices and SMS look professional.
        </Text>
      </View>
      <TouchableOpacity onPress={onFinish} style={[styles.cta, { backgroundColor: colors.primary }]} testID="banner-finish-setup">
        <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>Finish</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} testID="banner-dismiss-setup">
        <Ionicons name="close" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  subtitle: { fontSize: 12, lineHeight: 16 },
  cta: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  ctaText: { fontSize: 13, fontWeight: '600' },
});
