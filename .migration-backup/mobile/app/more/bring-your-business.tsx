import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography, iconSizes, pageShell, fontWeights } from '../../src/lib/design-tokens';
import api, { API_URL } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';

// Trade ids must match shared/tradeCatalog.ts — POST /api/onboarding/quick-setup
// rejects unknown ids with "Unknown trade type". (The onboarding wizard's own
// shorter list writes to /api/business-settings which is more lenient, so do
// NOT copy that list here.)
const TRADES: Array<{ value: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'electrical', label: 'Electrical', icon: 'flash' },
  { value: 'plumbing', label: 'Plumbing', icon: 'water' },
  { value: 'building', label: 'Building', icon: 'home' },
  { value: 'landscaping', label: 'Landscaping', icon: 'leaf' },
  { value: 'painting', label: 'Painting', icon: 'brush' },
  { value: 'hvac', label: 'HVAC', icon: 'snow' },
  { value: 'roofing', label: 'Roofing', icon: 'trail-sign' },
  { value: 'tiling', label: 'Tiling', icon: 'grid' },
  { value: 'concreting', label: 'Concreting', icon: 'cube' },
  { value: 'fencing', label: 'Fencing', icon: 'remove' },
  { value: 'cleaning', label: 'Cleaning', icon: 'sparkles' },
  { value: 'handyman', label: 'Handyman', icon: 'hammer' },
  { value: 'grounds_maintenance', label: 'Grounds', icon: 'flower' },
  { value: 'general', label: 'General/Other', icon: 'construct' },
];

interface BringBusinessStatus {
  data: { completedImports: number; clientCount: number };
  documents: { count: number };
  forms: { count: number };
  accounting: { xeroConnected: boolean; quickbooksConnected: boolean };
  quickSetup: {
    tradeType: string | null;
    teamSize: string | null;
    defaultHourlyRate: string | null;
    calloutFee: string | null;
  };
}

export default function BringYourBusinessScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomInset = useBottomInset();
  const params = useLocalSearchParams<{ from?: string }>();
  const fromOnboarding = params?.from === 'onboarding';

  const [status, setStatus] = useState<BringBusinessStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [tradeType, setTradeType] = useState('');
  const [teamSize, setTeamSize] = useState<'solo' | 'team'>('solo');
  const [hourlyRate, setHourlyRate] = useState('');
  const [calloutFee, setCalloutFee] = useState('');
  const [seedSamples, setSeedSamples] = useState(true);
  const [saving, setSaving] = useState(false);
  const [setupResult, setSetupResult] = useState<{ templatesSeeded: number; sampleDataSeeded: boolean } | null>(null);

  const fetchStatus = useCallback(async () => {
    const res = await api.get<BringBusinessStatus>('/api/onboarding/bring-business/status');
    if (!res.error && res.data && typeof res.data === 'object' && (res.data as any).quickSetup) {
      const s = res.data as BringBusinessStatus;
      setStatus(s);
      // Prefill from what the owner has already set up.
      setTradeType(prev => prev || s.quickSetup.tradeType || '');
      setTeamSize(s.quickSetup.teamSize && s.quickSetup.teamSize !== 'solo' ? 'team' : 'solo');
      // If they already have real clients, don't push sample data at them.
      if ((s.data?.clientCount ?? 0) > 0) setSeedSamples(false);
    }
    setLoadingStatus(false);
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleQuickSetup = async () => {
    if (!tradeType) {
      Alert.alert('Pick your trade', 'Choose your trade so we can apply the right defaults.');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { tradeType, teamSize, seedSampleData: seedSamples };
      if (hourlyRate.trim() !== '' && !Number.isNaN(Number(hourlyRate))) body.defaultHourlyRate = Number(hourlyRate);
      if (calloutFee.trim() !== '' && !Number.isNaN(Number(calloutFee))) body.calloutFee = Number(calloutFee);
      const res = await api.post<{ success: boolean; templatesSeeded: number; sampleDataSeeded: boolean }>(
        '/api/onboarding/quick-setup',
        body,
      );
      if (res.error || !res.data) {
        Alert.alert('Setup failed', res.error || 'Please check your connection and try again.');
        return;
      }
      setSetupResult({
        templatesSeeded: res.data.templatesSeeded ?? 0,
        sampleDataSeeded: !!res.data.sampleDataSeeded,
      });
      fetchStatus();
    } catch (e: any) {
      Alert.alert('Setup failed', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const [openingWizard, setOpeningWizard] = useState(false);

  const openWebWizard = async () => {
    if (openingWizard) return;
    setOpeningWizard(true);
    const fallbackUrl = `${API_URL}/bring-your-business`;
    let url = fallbackUrl;
    try {
      // Mint a short-lived, single-use handoff token so the browser opens
      // already signed in. If minting fails (offline, demo account, older
      // server), fall back to the plain URL — the owner just signs in.
      const res = await api.post<{ handoffToken: string }>('/api/auth/web-handoff', {});
      if (!res.error && res.data?.handoffToken) {
        url = `${API_URL}/auth/handoff?token=${encodeURIComponent(res.data.handoffToken)}&next=${encodeURIComponent('/bring-your-business')}`;
      }
    } catch {
      // fall through to plain URL
    }
    setOpeningWizard(false);
    Linking.openURL(url).catch(() => {
      Alert.alert('Could not open browser', `Visit ${API_URL}/bring-your-business on any computer.`);
    });
  };

  const handleDone = () => {
    if (fromOnboarding) {
      // Re-suppress the onboarding guard: landing on this (/more) screen
      // cleared onboardingFinishing, so navigating back into the (onboarding)
      // stack with onboardingCompleted=true would otherwise get immediately
      // redirected to /(tabs), skipping the notifications-permission step.
      useAuthStore.getState().setOnboardingFinishing(true);
      router.replace('/(onboarding)/notifications-permission');
    } else {
      router.back();
    }
  };

  const dataDone = (status?.data?.completedImports ?? 0) > 0 || (status?.data?.clientCount ?? 0) > 0;
  const docsDone = (status?.documents?.count ?? 0) > 0;
  const formsDone = (status?.forms?.count ?? 0) > 0;
  const accountingConnected = !!status?.accounting?.xeroConnected || !!status?.accounting?.quickbooksConnected;

  const lanes = [
    {
      key: 'data',
      icon: 'upload' as const,
      title: 'Your data',
      done: dataDone,
      detail: dataDone
        ? `${status?.data.clientCount ?? 0} client${(status?.data.clientCount ?? 0) === 1 ? '' : 's'} in so far`
        : accountingConnected
          ? 'Accounting connected — import your clients from the web wizard'
          : 'Clients, jobs, quotes & invoices from spreadsheets, Xero or QuickBooks',
    },
    {
      key: 'documents',
      icon: 'shield' as const,
      title: 'Your documents',
      done: docsDone,
      detail: docsDone
        ? `${status?.documents.count} uploaded`
        : 'Licences, insurance & safety docs for expiry reminders',
    },
    {
      key: 'forms',
      icon: 'clipboard' as const,
      title: 'Your forms',
      done: formsDone,
      detail: formsDone ? `${status?.forms.count} form${status?.forms.count === 1 ? '' : 's'} set up` : 'Checklists & paperwork rebuilt as digital forms',
    },
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.pageHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.pageTitle}>Bring your business across</Text>
          <Text style={styles.pageSubtitle}>Everything here is optional, in any order</Text>
        </View>
        <PressableRow
          style={styles.backButton}
          onPress={handleDone}
          data-testid="button-byb-back"
        >
          <Feather name={fromOnboarding ? 'x' : 'arrow-left'} size={iconSizes.lg} color={colors.foreground} />
        </PressableRow>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: pageShell.paddingHorizontal, paddingBottom: spacing['2xl'] + bottomInset }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loadingStatus ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={styles.lanesCard}>
            {lanes.map((lane, i) => (
              <View key={lane.key} style={[styles.laneRow, i > 0 && styles.laneRowBorder]}>
                <View style={[styles.laneIcon, lane.done && { backgroundColor: colors.success + '18' }]}>
                  <Feather name={lane.icon} size={16} color={lane.done ? colors.success : colors.mutedForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.laneTitleRow}>
                    <Text style={styles.laneTitle}>{lane.title}</Text>
                    {lane.done && <Feather name="check-circle" size={14} color={colors.success} />}
                  </View>
                  <Text style={styles.laneDetail}>{lane.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ---- Quick setup (paper-only fast path) ---- */}
        <Text style={styles.sectionLabel}>QUICK SETUP</Text>
        {setupResult ? (
          <View style={styles.successCard} data-testid="byb-setup-success">
            <Feather name="check-circle" size={18} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.successTitle}>Trade defaults applied</Text>
              <Text style={styles.successText}>
                {setupResult.templatesSeeded > 0 ? `${setupResult.templatesSeeded} quote templates ready to use. ` : ''}
                {setupResult.sampleDataSeeded ? 'Sample records added so you can look around — remove them anytime from Settings. ' : ''}
                Rates and terminology are tuned for your trade.
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardHint}>
              Running your business off paper or a notebook? Pick your trade and we'll set up rates, terminology and quote templates for you.
            </Text>

            <Text style={styles.fieldLabel}>What's your trade?</Text>
            <View style={styles.tradeGrid}>
              {TRADES.map((trade) => {
                const selected = tradeType === trade.value;
                return (
                  <TouchableOpacity
                    key={trade.value}
                    style={[styles.tradePill, selected && styles.tradePillSelected]}
                    onPress={() => setTradeType(trade.value)}
                    activeOpacity={0.7}
                    testID={`byb-trade-${trade.value}`}
                  >
                    <Ionicons name={trade.icon} size={15} color={selected ? colors.primary : colors.mutedForeground} />
                    <Text style={[styles.tradePillLabel, selected && { color: colors.primary, fontWeight: fontWeights.semibold }]}>
                      {trade.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Just you, or a team?</Text>
            <View style={styles.segmentRow}>
              {(['solo', 'team'] as const).map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.segmentButton, teamSize === v && styles.segmentButtonSelected]}
                  onPress={() => setTeamSize(v)}
                  activeOpacity={0.7}
                  testID={`byb-team-${v}`}
                >
                  <Text style={[styles.segmentLabel, teamSize === v && { color: colors.primary, fontWeight: fontWeights.semibold }]}>
                    {v === 'solo' ? 'Just me' : 'I have a team'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.rateRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Hourly rate ($/hr)</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. 100"
                  placeholderTextColor={colors.mutedForeground + '80'}
                  value={hourlyRate}
                  onChangeText={setHourlyRate}
                  keyboardType="decimal-pad"
                  
                  testID="byb-hourly-rate"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Callout fee ($)</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. 80"
                  placeholderTextColor={colors.mutedForeground + '80'}
                  value={calloutFee}
                  onChangeText={setCalloutFee}
                  keyboardType="decimal-pad"
                  
                  testID="byb-callout-fee"
                />
              </View>
            </View>
            <Text style={styles.mutedNote}>Leave rates blank to use typical rates for your trade.</Text>

            <View style={styles.sampleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sampleTitle}>Add a few sample records</Text>
                <Text style={styles.mutedNote}>Example clients, jobs and invoices so nothing feels empty.</Text>
              </View>
              <Switch
                value={seedSamples}
                onValueChange={setSeedSamples}
                trackColor={{ false: colors.muted, true: colors.primary }}
                testID="byb-samples-switch"
              />
            </View>

            <PressableRow
              style={[styles.primaryButton, (!tradeType || saving) && { opacity: 0.5 }]}
              onPress={handleQuickSetup}
              disabled={!tradeType || saving}
              data-testid="button-byb-quick-setup"
            >
              {saving ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Set me up</Text>
                  <Feather name="arrow-right" size={16} color={colors.primaryForeground} />
                </>
              )}
            </PressableRow>
          </View>
        )}

        {/* ---- Full wizard on the web ---- */}
        <Text style={styles.sectionLabel}>FULL IMPORT WIZARD</Text>
        <View style={styles.card}>
          <Text style={styles.cardHint}>
            Importing spreadsheets, connecting Xero or QuickBooks, and bulk-uploading documents is easiest on a bigger screen. Open the full wizard in your browser and sign in with the same email.
          </Text>
          <PressableRow
            style={[styles.outlineButton, openingWizard && { opacity: 0.6 }]}
            onPress={openWebWizard}
            disabled={openingWizard}
            data-testid="button-byb-open-web"
          >
            {openingWizard ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="external-link" size={16} color={colors.primary} />
            )}
            <Text style={styles.outlineButtonText}>Open the web wizard</Text>
          </PressableRow>
          <Text style={styles.mutedNote}>{API_URL.replace(/^https?:\/\//, '')}/bring-your-business</Text>
        </View>

        {fromOnboarding && (
          <PressableRow style={[styles.primaryButton, { marginTop: spacing.xl }]} onPress={handleDone} data-testid="button-byb-done">
            <Text style={styles.primaryButtonText}>Continue</Text>
            <Feather name="arrow-right" size={16} color={colors.primaryForeground} />
          </PressableRow>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: pageShell.paddingTop,
    },
    pageHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: pageShell.paddingHorizontal,
      paddingTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    headerLeft: { flex: 1, paddingRight: spacing.md },
    pageTitle: {
      ...typography.pageTitle,
      color: colors.foreground,
    },
    pageSubtitle: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    backButton: {
      padding: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    loadingBox: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },

    lanesCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginTop: spacing.sm,
    },
    laneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
    },
    laneRowBorder: {
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    laneIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    laneTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    laneTitle: {
      ...typography.subtitle,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    laneDetail: {
      ...typography.captionSmall,
      color: colors.mutedForeground,
      marginTop: 1,
    },

    sectionLabel: {
      ...typography.captionSmall,
      fontWeight: fontWeights.semibold,
      color: colors.mutedForeground,
      letterSpacing: 0.6,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.lg,
    },
    cardHint: {
      ...typography.caption,
      color: colors.mutedForeground,
      lineHeight: 19,
      marginBottom: spacing.md,
    },
    fieldLabel: {
      ...typography.caption,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
      marginBottom: spacing.sm,
    },
    tradeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    tradePill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      backgroundColor: colors.background,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      gap: 6,
    },
    tradePillSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '0A',
    },
    tradePillLabel: {
      ...typography.captionSmall,
      color: colors.foreground,
    },
    segmentRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    segmentButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      backgroundColor: colors.background,
      alignItems: 'center',
    },
    segmentButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '0A',
    },
    segmentLabel: {
      ...typography.caption,
      color: colors.foreground,
    },
    rateRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    fieldInput: {
      height: 44,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: radius.md,
      color: colors.foreground,
      ...typography.body,
    },
    mutedNote: {
      ...typography.captionSmall,
      color: colors.mutedForeground,
      marginTop: spacing.xs,
    },
    sampleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.lg,
      marginBottom: spacing.lg,
    },
    sampleTitle: {
      ...typography.caption,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      paddingVertical: 13,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.lg,
    },
    primaryButtonText: {
      ...typography.button,
      fontWeight: fontWeights.semibold,
      color: colors.primaryForeground,
    },
    outlineButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderWidth: 1.5,
      borderColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.lg,
    },
    outlineButtonText: {
      ...typography.button,
      fontWeight: fontWeights.semibold,
      color: colors.primary,
    },
    successCard: {
      flexDirection: 'row',
      gap: spacing.md,
      backgroundColor: colors.success + '0C',
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.success + '40',
      padding: spacing.lg,
    },
    successTitle: {
      ...typography.caption,
      fontWeight: fontWeights.semibold,
      color: colors.success,
    },
    successText: {
      ...typography.captionSmall,
      color: colors.foreground,
      marginTop: 2,
      lineHeight: 17,
    },
  });
