import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from './ui/PressableRow';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, typography, shadows } from '../lib/design-tokens';
import { api } from '../lib/api';
import { useAuthStore, useTimeTrackingStore } from '../lib/store';
import { useNotificationsStore } from '../lib/notifications-store';
import { clearRoleCache } from '../lib/role-cache';
import offlineStorage from '../lib/offline-storage';
import locationTracking from '../lib/location-tracking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from './BottomNav';

interface Business {
  businessOwnerId: string;
  businessName: string | null;
  roleName: string;
  teamMemberId: string | null;
  logoUrl?: string;
  pendingJobCount?: number;
  isOwnBusiness?: boolean;
}

interface PendingInvite {
  id: string;
  businessName: string;
  roleName: string;
  inviterName: string;
}

interface JobConflict {
  job1: { id: string; title: string; businessName: string; scheduledAt: string; estimatedDuration: number };
  job2: { id: string; title: string; businessName: string; scheduledAt: string; estimatedDuration: number };
  overlapMinutes: number;
}

interface WorkspaceSwitcherProps {
  visible: boolean;
  onClose: () => void;
  onSwitch?: () => void;
}

export function WorkspaceSwitcher({ visible, onClose, onSwitch }: WorkspaceSwitcherProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  // On Android a pageSheet falls back to a full-screen Modal, so the header
  // collides with the status bar unless we pad for it. insets.top can read 0
  // inside an Android Modal window, so fall back to the native status-bar height.
  // iOS pageSheet is already presented below the status bar, so no extra pad.
  const topInset =
    Platform.OS === 'android'
      ? Math.max(insets.top, StatusBar.currentHeight ?? 0)
      : 0;
  const styles = useMemo(() => createStyles(colors, bottomNavHeight, topInset), [colors, bottomNavHeight, topInset]);
  const { forceRefreshAuth } = useAuthStore();
  const fetchNotifications = useNotificationsStore(s => s.fetchNotifications);

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [conflicts, setConflicts] = useState<JobConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [acceptingInvite, setAcceptingInvite] = useState<string | null>(null);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [bizRes, invRes, conflictRes] = await Promise.all([
        api.getMyBusinesses(),
        api.getPendingInvites(),
        api.getJobConflicts(),
      ]);

      if (bizRes.data) {
        setBusinesses(bizRes.data.businesses || []);
        setActiveBusinessId(bizRes.data.activeBusinessId);
      }
      if (invRes.data) {
        setPendingInvites(invRes.data.invites || []);
      }
      if (conflictRes.data) {
        setConflicts(conflictRes.data.conflicts || []);
      }
    } catch (e) {
      if (__DEV__) console.error('[WorkspaceSwitcher] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchData();
    }
  }, [visible, fetchData]);

  const handleSwitch = async (businessId: string) => {
    if (businessId === activeBusinessId) return;

    // If a timer is running, it belongs to a job in the workspace we're leaving.
    // Ask what to do before switching so the worker doesn't accidentally keep or
    // lose tracked time. (Location tracking is already stopped below.)
    const runningTimer = useTimeTrackingStore.getState().activeTimer;
    if (runningTimer) {
      const choice = await new Promise<'keep' | 'stop' | 'cancel'>((resolve) => {
        Alert.alert(
          'Timer running',
          `You have a timer running${runningTimer.jobTitle ? ` on "${runningTimer.jobTitle}"` : ''}. What do you want to do before switching workspace?`,
          [
            { text: 'Keep running', onPress: () => resolve('keep') },
            { text: 'Stop timer', style: 'destructive', onPress: () => resolve('stop') },
            { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
          ],
          { cancelable: true, onDismiss: () => resolve('cancel') },
        );
      });
      if (choice === 'cancel') return;
      if (choice === 'stop') {
        let stopped = false;
        try {
          stopped = await useTimeTrackingStore.getState().stopTimer();
        } catch (e) {
          if (__DEV__) console.error('[WorkspaceSwitcher] stopTimer error:', e);
          stopped = false;
        }
        // stopTimer() returns false (rather than throwing) on most failures, so
        // don't switch on a failed stop — that would leave a timer running in the
        // workspace we're leaving, the exact thing the user chose to avoid.
        if (!stopped) {
          Alert.alert(
            "Couldn't stop timer",
            'Your timer is still running, so the workspace was not switched. Please try again.',
          );
          return;
        }
      }
    }

    setSwitching(businessId);
    try {
      const res = await api.switchBusiness(businessId);
      if (res.data?.success) {
        clearRoleCache();
        // Drop the previous workspace's resolved role so the dashboard shows a
        // brief loading state (not the old workspace's role) while checkAuth +
        // my-role re-resolve for the newly active business.
        useAuthStore.setState({ roleInfo: null });
        await offlineStorage.clearCache();
        await locationTracking.stopTracking();
        await forceRefreshAuth();
        useNotificationsStore.setState({ notifications: [], unreadCount: 0, lastFetchTime: 0 });
        fetchNotifications();
        setActiveBusinessId(businessId);
        onClose();
        onSwitch?.();
      } else {
        Alert.alert('Error', res.error || 'Failed to switch workspace');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to switch workspace');
    } finally {
      setSwitching(null);
    }
  };

  const handleAcceptInvite = async (invite: PendingInvite) => {
    Alert.alert(
      'Accept Invitation',
      `${invite.businessName} wants to add you as a ${invite.roleName}. Accept?`,
      [
        { text: 'Decline', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setAcceptingInvite(invite.id);
            try {
              const res = await api.acceptInviteById(invite.id);
              if (res.data?.success) {
                Alert.alert('Joined', `You've joined ${invite.businessName}.`);
                await fetchData();
                await forceRefreshAuth();
                onSwitch?.();
              } else {
                Alert.alert('Error', res.error || 'Failed to accept invite');
              }
            } catch (e) {
              Alert.alert('Error', 'Failed to accept invite');
            } finally {
              setAcceptingInvite(null);
            }
          },
        },
      ],
    );
  };

  const handleJoinByCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      Alert.alert('Enter a code', 'Paste the invite code from the business owner.');
      return;
    }
    setJoining(true);
    try {
      const res = await api.post<{ success?: boolean; businessName?: string; error?: string }>(
        '/api/team/invite-code/redeem',
        { code },
      );
      if (res.data?.success) {
        Alert.alert('Joined', `You've joined ${res.data.businessName || 'the business'}.`);
        setJoinCode('');
        setShowJoinForm(false);
        await fetchData();
        await forceRefreshAuth();
        onSwitch?.();
      } else {
        Alert.alert('Error', res.error || res.data?.error || 'Invalid or expired invite code');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not join with that code');
    } finally {
      setJoining(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-AU', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short', 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  const personalBusinesses = businesses.filter((b) => b.isOwnBusiness);
  const joinedBusinesses = businesses.filter((b) => !b.isOwnBusiness);

  const renderBusinessCard = (biz: Business) => {
    const isActive = biz.businessOwnerId === activeBusinessId;
    const isSwitching = switching === biz.businessOwnerId;
    return (
      <PressableRow key={biz.businessOwnerId} style={[styles.businessCard, isActive && styles.businessCardActive]} onPress={() => handleSwitch(biz.businessOwnerId)} disabled={isSwitching || isActive} >
        <View style={[styles.businessLogo, isActive && styles.businessLogoActive]}>
          {biz.logoUrl ? (
            <Image source={{ uri: biz.logoUrl }} style={styles.logoImage} />
          ) : (
            <Feather
              name={biz.isOwnBusiness ? "home" : "briefcase"}
              size={20}
              color={isActive ? colors.primaryForeground : colors.primary}
            />
          )}
        </View>
        <View style={styles.businessInfo}>
          <Text style={[styles.businessName, isActive && styles.businessNameActive]}>
            {biz.isOwnBusiness ? 'Personal profile' : biz.businessName}
          </Text>
          <Text style={styles.businessRole}>
            {biz.isOwnBusiness ? (biz.businessName || 'Your own workspace') : biz.roleName}
          </Text>
        </View>
        <View style={styles.businessRight}>
          {(biz.pendingJobCount ?? 0) > 0 && (
            <View style={styles.jobCountBadge}>
              <Text style={styles.jobCountText}>{biz.pendingJobCount}</Text>
            </View>
          )}
          {isSwitching ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : isActive ? (
            <View style={styles.activeIndicator}>
              <Feather name="check" size={14} color={colors.primaryForeground} />
            </View>
          ) : (
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          )}
        </View>
      </PressableRow>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Workspaces</Text>
          <PressableRow onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={22} color={colors.foreground} />
          </PressableRow>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading workspaces...</Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {pendingInvites.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>PENDING INVITATIONS</Text>
                {pendingInvites.map((invite) => (
                  <View key={invite.id} style={styles.inviteCard}>
                    <View style={styles.inviteIcon}>
                      <Feather name="mail" size={20} color={colors.warning} />
                    </View>
                    <View style={styles.inviteInfo}>
                      <Text style={styles.inviteBusinessName}>{invite.businessName}</Text>
                      <Text style={styles.inviteDetail}>
                        {invite.inviterName} invited you as {invite.roleName}
                      </Text>
                    </View>
                    <PressableRow style={styles.acceptButton} onPress={() => handleAcceptInvite(invite)} disabled={acceptingInvite === invite.id} >
                      {acceptingInvite === invite.id ? (
                        <ActivityIndicator size="small" color={colors.primaryForeground} />
                      ) : (
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      )}
                    </PressableRow>
                  </View>
                ))}
              </View>
            )}

            {conflicts.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.destructive }]}>
                  JOB CONFLICTS
                </Text>
                {conflicts.map((conflict, idx) => (
                  <View key={idx} style={styles.conflictCard}>
                    <View style={styles.conflictIconContainer}>
                      <Feather name="alert-triangle" size={18} color={colors.destructive} />
                    </View>
                    <View style={styles.conflictInfo}>
                      <Text style={styles.conflictTitle}>
                        {conflict.overlapMinutes}min overlap
                      </Text>
                      <Text style={styles.conflictDetail}>
                        {conflict.job1.title} ({conflict.job1.businessName})
                      </Text>
                      <Text style={styles.conflictDetail}>
                        {formatDate(conflict.job1.scheduledAt)}
                      </Text>
                      <Text style={[styles.conflictDetail, { marginTop: 4 }]}>
                        {conflict.job2.title} ({conflict.job2.businessName})
                      </Text>
                      <Text style={styles.conflictDetail}>
                        {formatDate(conflict.job2.scheduledAt)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {personalBusinesses.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>PERSONAL</Text>
                {personalBusinesses.map(renderBusinessCard)}
              </View>
            )}

            {joinedBusinesses.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>JOINED BUSINESSES</Text>
                {joinedBusinesses.map(renderBusinessCard)}
              </View>
            )}

            {businesses.length === 0 && (
              <View style={styles.emptyState}>
                <Feather name="briefcase" size={40} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>No connected workspaces yet</Text>
                <Text style={styles.emptySubtext}>
                  When a business adds you to their team, it will appear here.
                </Text>
              </View>
            )}

            <View style={styles.section}>
              {showJoinForm ? (
                <View style={styles.joinForm}>
                  <Text style={styles.joinFormLabel}>Enter invite code</Text>
                  <TextInput
                    style={styles.joinInput}
                    value={joinCode}
                    onChangeText={setJoinCode}
                    placeholder="e.g. ABC123"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={!joining}
                  />
                  <View style={styles.joinFormActions}>
                    <PressableRow style={styles.joinCancelButton} onPress={() => { setShowJoinForm(false); setJoinCode(''); }} disabled={joining}>
                      <Text style={styles.joinCancelText}>Cancel</Text>
                    </PressableRow>
                    <PressableRow style={styles.joinSubmitButton} onPress={handleJoinByCode} disabled={joining}>
                      {joining ? (
                        <ActivityIndicator size="small" color={colors.primaryForeground} />
                      ) : (
                        <Text style={styles.joinSubmitText}>Join</Text>
                      )}
                    </PressableRow>
                  </View>
                </View>
              ) : (
                <PressableRow style={styles.joinAnotherButton} onPress={() => setShowJoinForm(true)}>
                  <Feather name="plus-circle" size={18} color={colors.primary} />
                  <Text style={styles.joinAnotherText}>Join another business</Text>
                </PressableRow>
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

export function WorkspaceBadge({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const { businessSettings } = useAuthStore();
  const [businessCount, setBusinessCount] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.getMyBusinesses();
        if (res.data) {
          setBusinessCount(res.data.businesses?.length || 0);
        }
      } catch (e) {}
    };
    fetch();
  }, []);

  if (businessCount <= 1) return null;

  return (
    <PressableRow onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full, }} >
      <Feather name="repeat" size={12} color={colors.primary} />
      <Text style={{ ...typography.captionSmall, fontWeight: '600', color: colors.primary }}>
        {businessSettings?.businessName || 'Switch'}
      </Text>
    </PressableRow>
  );
}

const createStyles = (colors: ThemeColors, bottomNavHeight: number = 0, topInset: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: topInset + spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: bottomNavHeight,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.warning,
    gap: spacing.md,
  },
  inviteIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteInfo: {
    flex: 1,
  },
  inviteBusinessName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  inviteDetail: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  acceptButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    minWidth: 72,
    alignItems: 'center',
  },
  acceptButtonText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  conflictCard: {
    flexDirection: 'row',
    backgroundColor: colors.destructiveLight,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.destructive,
    gap: spacing.md,
  },
  conflictIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conflictInfo: {
    flex: 1,
  },
  conflictTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.destructive,
    marginBottom: 4,
  },
  conflictDetail: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  businessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  businessCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  businessLogo: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  businessLogoActive: {
    backgroundColor: colors.primary,
  },
  logoImage: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  businessNameActive: {
    color: colors.primary,
  },
  businessRole: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  businessRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  jobCountBadge: {
    backgroundColor: colors.primary,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  jobCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryForeground,
  },
  activeIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  joinAnotherText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primary,
  },
  joinForm: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  joinFormLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.foreground,
  },
  joinInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.foreground,
    letterSpacing: 1,
  },
  joinFormActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  joinCancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  joinCancelText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  joinSubmitButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  joinSubmitText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.md,
  },
  emptyText: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: spacing['2xl'],
  },
});
