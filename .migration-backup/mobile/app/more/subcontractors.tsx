import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import api from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { TeamAvatar } from '../../src/components/TeamAvatar';
import { spacing, typography, fontWeights } from '../../src/lib/design-tokens';

interface Subcontractor {
  id: string;
  kind: 'magic_link';
  name: string;
  contactPhone: string | null;
  contactEmail: string | null;
  status: 'pending' | 'active' | 'revoked' | string;
  lastActivity: string | null;
  jobsCount: number;
  trade: string | null;
  businessName: string | null;
}

const formatLastActivity = (iso: string | null): string => {
  if (!iso) return 'No activity';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return 'No activity';
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

export default function SubcontractorsScreen() {
  const { colors } = useTheme();
  const bottomInset = useBottomInset(40);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();

  const [subs, setSubs] = useState<Subcontractor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  const [serverTier, setServerTier] = useState<string>('');
  const [serverTrialActive, setServerTrialActive] = useState(false);

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<Subcontractor | null>(null);
  const [upgradeFirstName, setUpgradeFirstName] = useState('');
  const [upgradeLastName, setUpgradeLastName] = useState('');
  const [upgradeEmail, setUpgradeEmail] = useState('');
  const [upgradeRate, setUpgradeRate] = useState('');
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Server status takes priority — local user.subscriptionTier can be stale.
  // Mirrors server/permissions.ts ownerHasTeamCapability(): team/business/beta
  // tier OR an active trial OR beta unlock all qualify.
  const effectiveTier = serverTier || user?.subscriptionTier || 'free';
  const hasTeamPlan =
    effectiveTier === 'team' ||
    effectiveTier === 'business' ||
    effectiveTier === 'beta' ||
    serverTrialActive;

  const fetchSubs = useCallback(async () => {
    try {
      const res = await api.get<Subcontractor[]>('/api/subcontractors');
      if (res.isOffline) {
        setIsOffline(true);
        setFetchError(null);
      } else if (res.error) {
        setFetchError(res.error);
        setIsOffline(false);
      } else if (Array.isArray(res.data)) {
        setSubs(res.data);
        setFetchError(null);
        setIsOffline(false);
      }
    } catch (e) {
      if (__DEV__) console.warn('fetchSubs error:', e);
      setFetchError('Could not load subcontractors. Pull to retry.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchTier = useCallback(async () => {
    const res = await api.getSubscriptionStatus();
    if (res.data?.tier) setServerTier(res.data.tier);
    const trialEnds = res.data?.trialEndsAt;
    const status = res.data?.status;
    setServerTrialActive(
      (status === 'trialing' || status === 'trial') &&
        !!trialEnds &&
        new Date(trialEnds).getTime() > Date.now(),
    );
  }, []);

  useEffect(() => {
    fetchSubs();
    fetchTier();
  }, [fetchSubs, fetchTier]);

  useFocusEffect(
    useCallback(() => {
      fetchSubs();
    }, [fetchSubs]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSubs();
  }, [fetchSubs]);

  const filteredSubs = useMemo(() => {
    if (!search.trim()) return subs;
    const q = search.toLowerCase();
    return subs.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.contactPhone || '').toLowerCase().includes(q) ||
        (s.contactEmail || '').toLowerCase().includes(q),
    );
  }, [subs, search]);

  const counts = useMemo(() => {
    let active = 0;
    let pending = 0;
    let revoked = 0;
    for (const s of subs) {
      if (s.status === 'active') active++;
      else if (s.status === 'revoked') revoked++;
      else pending++;
    }
    return { total: subs.length, active, pending, revoked };
  }, [subs]);

  const openUpgrade = (sub: Subcontractor) => {
    if (sub.status === 'revoked') {
      Alert.alert(
        'Sub revoked',
        'This subcontractor was revoked. Send them a fresh magic-link invite first.',
      );
      return;
    }
    if (!hasTeamPlan) {
      Alert.alert(
        'Team Plan needed',
        'Upgrading subcontractors to full accounts requires a Team plan.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Plans', onPress: () => router.push('/more/subscription') },
        ],
      );
      return;
    }
    setUpgradeTarget(sub);
    const parts = (sub.name || '').trim().split(/\s+/);
    setUpgradeFirstName(parts[0] || '');
    setUpgradeLastName(parts.slice(1).join(' ') || '');
    setUpgradeEmail(sub.contactEmail || '');
    setUpgradeRate('');
    setUpgradeOpen(true);
  };

  const handleUpgrade = async () => {
    if (!upgradeTarget) return;
    const email = upgradeEmail.trim();
    if (!email) {
      Alert.alert('Email required', 'Please enter an email for the account login.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    setIsUpgrading(true);
    const body: any = {
      tokenId: upgradeTarget.id,
      email,
    };
    if (upgradeFirstName.trim()) body.firstName = upgradeFirstName.trim();
    if (upgradeLastName.trim()) body.lastName = upgradeLastName.trim();
    const rate = parseFloat(upgradeRate);
    if (!isNaN(rate) && rate > 0) body.hourlyRate = String(rate);

    const res = await api.post<any>('/api/subcontractors/upgrade-to-account', body);
    setIsUpgrading(false);

    if (res.isOffline) {
      Alert.alert(
        "You're offline",
        "We can't send the invite right now. Try again when you're back on Wi-Fi or data.",
      );
      return;
    }
    if (res.error) {
      let msg = res.error;
      if (typeof msg === 'string' && msg.startsWith('team_plan_required:')) {
        msg = msg.replace(/^team_plan_required:\s*/, '');
      }
      Alert.alert('Could not upgrade', msg || 'Please check the details and try again.');
      return;
    }

    const alreadyExisted = res.data?.alreadyExisted;
    const smsSent = res.data?.smsSent;
    Alert.alert(
      alreadyExisted ? 'Already an account sub' : 'Upgrade invite sent',
      alreadyExisted
        ? 'This person is already a team member — re-using their existing record.'
        : `${email} has been invited to create a JobRunner account.${
            smsSent ? ' SMS also sent.' : ''
          }`,
    );
    setUpgradeOpen(false);
    fetchSubs();
  };

  const renderStatusBadge = (status: string) => {
    let color = colors.warning ?? '#f59e0b';
    let label = 'Pending';
    if (status === 'active') {
      color = colors.success ?? '#16a34a';
      label = 'Active';
    } else if (status === 'revoked') {
      color = colors.destructive ?? '#dc2626';
      label = 'Revoked';
    }
    return (
      <View style={[styles.statusBadge, { backgroundColor: color + '22' }]}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={[styles.statusText, { color }]}>{label}</Text>
      </View>
    );
  };

  const renderSub = (sub: Subcontractor) => (
    <View key={sub.id} style={styles.subCard}>
      <View style={styles.subRow}>
        <TeamAvatar name={sub.name} email={sub.contactEmail || undefined} size={44} />
        <View style={styles.subInfo}>
          <Text style={styles.subName} numberOfLines={1}>
            {sub.name || 'Unnamed sub'}
          </Text>
          <Text style={styles.subContact} numberOfLines={1}>
            {sub.contactPhone || sub.contactEmail || 'No contact details'}
          </Text>
          <View style={styles.subMetaRow}>
            {renderStatusBadge(sub.status)}
            <Text style={styles.subMetaText}>
              {sub.jobsCount} {sub.jobsCount === 1 ? 'job' : 'jobs'}
            </Text>
            <Text style={styles.subMetaText}>•</Text>
            <Text style={styles.subMetaText}>{formatLastActivity(sub.lastActivity)}</Text>
          </View>
        </View>
      </View>
      <View style={styles.subActions}>
        {sub.contactPhone && (
          <PressableRow style={styles.iconAction} onPress={async () => { const tel = `tel:${(sub.contactPhone || '').replace(/[^\d+]/g, '')}`; try { const ok = await Linking.canOpenURL(tel); if (ok) { Linking.openURL(tel); } else { Alert.alert('Can\'t make calls', sub.contactPhone || ''); } } catch { Alert.alert('Can\'t make calls', sub.contactPhone || ''); } }} accessibilityLabel={`Call ${sub.name}`} accessibilityRole="button" testID={`button-call-sub-${sub.id}`} >
            <Feather name="phone" size={16} color={colors.mutedForeground} />
          </PressableRow>
        )}
        {sub.kind === 'magic_link' && (
          <PressableRow style={[styles.upgradeButton, !hasTeamPlan && styles.upgradeButtonDisabled]} onPress={() => openUpgrade(sub)} accessibilityLabel={`Upgrade ${sub.name} to a full account`} accessibilityRole="button" accessibilityHint={ hasTeamPlan ? 'Sends them an invite to create their own login.' : 'Requires a Team plan.' } testID={`button-upgrade-sub-${sub.id}`} >
            <Feather name="arrow-up-circle" size={14} color={colors.primaryForeground} />
            <Text style={styles.upgradeButtonText}>Upgrade</Text>
          </PressableRow>
        )}
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <PressableRow onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Go back" accessibilityRole="button" testID="button-subs-back" >
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </PressableRow>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Subcontractors</Text>
            <Text style={styles.headerSubtitle}>
              {counts.total} {counts.total === 1 ? 'sub' : 'subs'}
              {counts.active > 0 ? ` • ${counts.active} active` : ''}
            </Text>
          </View>
        </View>

        {!hasTeamPlan && counts.total > 0 && (
          <View style={styles.gateBanner}>
            <Feather name="lock" size={16} color={colors.warning ?? '#f59e0b'} />
            <Text style={styles.gateBannerText}>
              Team plan required to upgrade subs to full accounts.
            </Text>
            <PressableRow onPress={() => router.push('/more/subscription')}>
              <Text style={styles.gateBannerCta}>View plans</Text>
            </PressableRow>
          </View>
        )}

        <View style={styles.searchWrap}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, phone, or email"
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
            testID="input-search-subs"
          />
          {search.length > 0 && (
            <PressableRow onPress={() => setSearch('')}>
              <Feather name="x-circle" size={16} color={colors.mutedForeground} />
            </PressableRow>
          )}
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading subcontractors…</Text>
            </View>
          ) : isOffline ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Feather name="wifi-off" size={36} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>You're offline</Text>
              <Text style={styles.emptyDesc}>
                We can't load your subs right now. Pull down to retry once you're back on.
              </Text>
            </View>
          ) : fetchError ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Feather name="alert-triangle" size={36} color={colors.destructive} />
              </View>
              <Text style={styles.emptyTitle}>Couldn't load subs</Text>
              <Text style={styles.emptyDesc}>{fetchError}</Text>
              <PressableRow style={styles.retryButton} onPress={() => { setIsLoading(true); fetchSubs(); }} accessibilityLabel="Retry loading subcontractors" accessibilityRole="button" testID="button-subs-retry" >
                <Feather name="refresh-cw" size={14} color={colors.primaryForeground} />
                <Text style={styles.retryButtonText}>Retry</Text>
              </PressableRow>
            </View>
          ) : filteredSubs.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Feather name="users" size={36} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>
                {search ? 'No subs match your search' : 'No subcontractors yet'}
              </Text>
              <Text style={styles.emptyDesc}>
                {search
                  ? 'Try a different name, phone, or email.'
                  : 'Open any job and tap Add Sub to send a magic-link invite. They\'ll show up here once they accept.'}
              </Text>
              {!search && (
                <PressableRow style={styles.retryButton} onPress={() => router.push('/(tabs)/jobs' as any)} accessibilityLabel="Go to jobs" accessibilityRole="button" testID="button-go-to-jobs" >
                  <Feather name="briefcase" size={14} color={colors.primaryForeground} />
                  <Text style={styles.retryButtonText}>Open Jobs</Text>
                </PressableRow>
              )}
            </View>
          ) : (
            <View style={styles.list}>{filteredSubs.map(renderSub)}</View>
          )}
        </ScrollView>

        <AppBottomSheet
          visible={upgradeOpen}
          onDismiss={() => setUpgradeOpen(false)}
          title="Upgrade to full account"
          showCloseButton
          snapPoints={['90%']}
        >
            <View>
              <Text style={styles.modalDesc}>
                Convert this magic-link sub into a full team member with their own login,
                dashboard and invoicing. We'll re-use their existing details.
              </Text>

              {upgradeTarget && (
                <View style={styles.targetCard}>
                  <TeamAvatar
                    name={upgradeTarget.name}
                    email={upgradeTarget.contactEmail || undefined}
                    size={36}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.targetName}>{upgradeTarget.name}</Text>
                    <Text style={styles.targetContact}>
                      {upgradeTarget.contactPhone ||
                        upgradeTarget.contactEmail ||
                        '—'}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.formContent}>
                <View style={styles.formRow}>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>First name</Text>
                    <TextInput
                      style={styles.formInput}
                      value={upgradeFirstName}
                      onChangeText={setUpgradeFirstName}
                      autoCapitalize="words"
                      placeholder="First"
                      placeholderTextColor={colors.mutedForeground}
                      testID="input-upgrade-firstname"
                    />
                  </View>
                  <View style={styles.formCol}>
                    <Text style={styles.formLabel}>Last name</Text>
                    <TextInput
                      style={styles.formInput}
                      value={upgradeLastName}
                      onChangeText={setUpgradeLastName}
                      autoCapitalize="words"
                      placeholder="Last"
                      placeholderTextColor={colors.mutedForeground}
                      testID="input-upgrade-lastname"
                    />
                  </View>
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>
                    Email <Text style={{ color: colors.destructive ?? '#dc2626' }}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.formInput}
                    value={upgradeEmail}
                    onChangeText={setUpgradeEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    placeholder="name@example.com"
                    placeholderTextColor={colors.mutedForeground}
                    testID="input-upgrade-email"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.formLabel}>Hourly rate (optional)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={upgradeRate}
                    onChangeText={setUpgradeRate}
                    keyboardType="decimal-pad"
                    placeholder="e.g. 65"
                    placeholderTextColor={colors.mutedForeground}
                    testID="input-upgrade-rate"
                  />
                </View>

                <Text style={styles.helperText}>
                  We'll email an account-setup link
                  {upgradeTarget?.contactPhone ? ' and SMS them too' : ''}.
                </Text>
              </View>

              <View style={styles.modalActions}>
                <PressableRow style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => setUpgradeOpen(false)} testID="button-upgrade-cancel" >
                  <Text style={styles.modalBtnGhostText}>Cancel</Text>
                </PressableRow>
                <PressableRow style={[ styles.modalBtn, styles.modalBtnPrimary, isUpgrading && styles.modalBtnDisabled, ]} disabled={isUpgrading} onPress={handleUpgrade} testID="button-upgrade-submit" >
                  {isUpgrading ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <>
                      <Feather name="arrow-up-circle" size={16} color={colors.primaryForeground} />
                      <Text style={styles.modalBtnPrimaryText}>Send invite</Text>
                    </>
                  )}
                </PressableRow>
              </View>
            </View>
        </AppBottomSheet>
      </View>
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      gap: spacing.md,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
    },
    headerContent: { flex: 1 },
    headerTitle: { fontSize: typography.sizes['2xl'], fontWeight: fontWeights.bold, color: colors.foreground },
    headerSubtitle: { fontSize: typography.sizes.sm, color: colors.mutedForeground, marginTop: 2 },

    gateBanner: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      padding: spacing.md,
      borderRadius: 10,
      backgroundColor: (colors.warning ?? '#f59e0b') + '15',
      borderWidth: 1,
      borderColor: (colors.warning ?? '#f59e0b') + '40',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    gateBannerText: { flex: 1, fontSize: typography.sizes.sm, color: colors.foreground },
    gateBannerCta: { fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.primary },

    searchWrap: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    searchInput: {
      flex: 1,
      fontSize: typography.sizes.md,
      color: colors.foreground,
      padding: 0,
    },

    scrollView: { flex: 1 },
    scrollContent: { paddingBottom: spacing['3xl'] },

    loadingWrap: { paddingVertical: 60, alignItems: 'center', gap: spacing.md },
    loadingText: { color: colors.mutedForeground, fontSize: typography.sizes.sm },

    emptyWrap: { paddingHorizontal: spacing['3xl'], paddingVertical: 60, alignItems: 'center' },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    emptyTitle: {
      fontSize: typography.subtitle.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
      marginBottom: 6,
      textAlign: 'center',
    },
    emptyDesc: {
      fontSize: typography.sizes.sm,
      color: colors.mutedForeground,
      textAlign: 'center',
      lineHeight: 18,
    },
    retryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      borderRadius: 8,
      marginTop: spacing.lg,
    },
    retryButtonText: { color: colors.primaryForeground, fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold },

    list: { paddingHorizontal: spacing.lg, gap: 10 },
    subCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: spacing.md,
    },
    subRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    subInfo: { flex: 1, gap: 3 },
    subName: { fontSize: typography.sizes.md, fontWeight: fontWeights.semibold, color: colors.foreground },
    subContact: { fontSize: typography.sizes.sm, color: colors.mutedForeground },
    subMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 2,
    },
    subMetaText: { fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground },

    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: 999,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold },

    subActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'flex-end' },
    iconAction: {
      width: 36,
      height: 36,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    upgradeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: spacing.sm,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    upgradeButtonDisabled: { opacity: 0.55 },
    upgradeButtonText: { color: colors.primaryForeground, fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold },

    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing['2xl'],
      maxHeight: '88%',
    },
    modalHandle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.cardBorder,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    modalTitle: { fontSize: typography.sizes.lg, fontWeight: fontWeights.bold, color: colors.foreground },
    modalDesc: { fontSize: typography.sizes.sm, color: colors.mutedForeground, marginBottom: spacing.lg, lineHeight: 18 },

    targetCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.card,
      borderRadius: 10,
      marginBottom: spacing.lg,
    },
    targetName: { fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground },
    targetContact: { fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: 2 },

    formScroll: { maxHeight: 360 },
    formContent: { gap: 14, paddingBottom: spacing.xs },
    formRow: { flexDirection: 'row', gap: spacing.md },
    formCol: { flex: 1, gap: 6 },
    formField: { gap: 6 },
    formLabel: { fontSize: typography.sizes.sm, fontWeight: fontWeights.medium, color: colors.foreground },
    formInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 8,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: typography.sizes.md,
      color: colors.foreground,
    },
    helperText: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
      lineHeight: 16,
      marginTop: spacing.xs,
    },

    modalActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 18,
    },
    modalBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 13,
      borderRadius: 10,
    },
    modalBtnGhost: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    modalBtnGhostText: { color: colors.foreground, fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold },
    modalBtnPrimary: { backgroundColor: colors.primary },
    modalBtnDisabled: { opacity: 0.6 },
    modalBtnPrimaryText: { color: colors.primaryForeground, fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold },
  });
