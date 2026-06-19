import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/store';
import { useTheme } from '../../lib/theme';
import { api } from '../../lib/api';
import { showToast } from '../../lib/toast';
import {
  getOnboardingSetupFailure,
  clearOnboardingSetupFailure,
  markOnboardingSetupFailed,
  OnboardingSetupFailure,
} from '../../lib/onboardingSetupStatus';

// Surfaces a non-blocking, retryable message when a user's background onboarding
// step failed. For owners this is the magic setup screen's seed/complete step;
// for joiners (workers/subcontractors) it's the inline onboarding-complete call.
// The user is already in the app by the time this shows, so it must never
// block — just offer a one-tap retry.
export function OnboardingSetupFailedBanner() {
  const { colors } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const fetchBusinessSettings = useAuthStore((s) => s.fetchBusinessSettings);
  const onboardingCompleted = useAuthStore((s) => (s.businessSettings as any)?.onboardingCompleted === true);
  const [failure, setFailure] = useState<OnboardingSetupFailure | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let mounted = true;
    getOnboardingSetupFailure(userId)
      .then(async (f) => {
        if (!mounted) return;
        // Self-heal: if onboarding is genuinely complete, the "complete" step
        // succeeded — drop any stale completeFailed flag so we don't nag a user
        // whose setup is actually done (e.g. the failure was a transient error
        // that has since resolved). Only the seed step (demo data) can
        // legitimately still be outstanding.
        if (f && onboardingCompleted && f.completeFailed) {
          const remaining = { seedFailed: f.seedFailed, completeFailed: false };
          if (!remaining.seedFailed) {
            await clearOnboardingSetupFailure(userId);
            if (mounted) setFailure(null);
            return;
          }
          await markOnboardingSetupFailed(userId, remaining);
          if (mounted) setFailure(remaining);
          return;
        }
        setFailure(f);
      })
      .catch(() => { if (mounted) setFailure(null); });
    return () => { mounted = false; };
  }, [userId, onboardingCompleted]);

  const onRetry = useCallback(async () => {
    if (!failure || retrying) return;
    setRetrying(true);
    let seedFailed = failure.seedFailed;
    let completeFailed = failure.completeFailed;

    if (seedFailed) {
      const seedRes = await api.post('/api/onboarding/seed-demo-data', {});
      seedFailed = !!seedRes?.error;
    }
    if (completeFailed) {
      const completeRes = await api.post('/api/onboarding/complete', {});
      completeFailed = !!completeRes?.error;
      if (!completeFailed) {
        try { await fetchBusinessSettings(); } catch {}
      }
    }

    setRetrying(false);

    if (!seedFailed && !completeFailed) {
      await clearOnboardingSetupFailure(userId);
      setFailure(null);
      showToast({ type: 'success', message: 'Setup finished', description: 'Your account is fully set up.' });
    } else {
      await markOnboardingSetupFailed(userId, { seedFailed, completeFailed });
      setFailure({ seedFailed, completeFailed });
      showToast({
        type: 'error',
        message: "Still couldn't finish setup",
        description: 'Please check your connection and try again.',
      });
    }
  }, [failure, retrying, userId, fetchBusinessSettings]);

  const onDismiss = useCallback(async () => {
    setFailure(null);
    await clearOnboardingSetupFailure(userId);
  }, [userId]);

  if (!failure) return null;

  const subtitle = failure.seedFailed
    ? "Some of your starter setup couldn't be saved. Tap retry to finish it."
    : "We couldn't finish saving your setup. Tap retry to finish it.";

  return (
    <View style={[styles.wrap, { backgroundColor: colors.destructive + '12', borderColor: colors.destructive + '33' }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.destructive + '22' }]}>
        <Ionicons name="alert-circle-outline" size={18} color={colors.destructive} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: colors.foreground }]}>Setup didn't finish</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onRetry}
        disabled={retrying}
        style={[styles.cta, { backgroundColor: colors.destructive }]}
        testID="banner-retry-setup"
      >
        {retrying ? (
          <ActivityIndicator size="small" color={colors.destructiveForeground} />
        ) : (
          <Text style={[styles.ctaText, { color: colors.destructiveForeground }]}>Retry</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} testID="banner-dismiss-setup-failed">
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
    minWidth: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 13, fontWeight: '600' },
});
