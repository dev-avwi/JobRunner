import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, colorWithOpacity } from '../../src/lib/theme';
import { fontWeights, spacing, radius, typography, iconSizes, pageShell } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import { TeamAvatar } from '../../src/components/TeamAvatar';
import { showToast } from '../../src/lib/toast';
import { Button } from '../../src/components/ui/Button';
import * as Haptics from 'expo-haptics';

interface UnassignedPhase {
  id: string;
  jobId: string;
  phaseCode: string | null;
  name: string;
  description: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  status: string;
  sortOrder: number;
  assignedUserId: string | null;
  jobTitle: string;
}

interface TeamMember {
  id: string;
  memberId?: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  themeColor?: string;
  roleName?: string;
  isActive?: boolean;
  inviteStatus?: string;
}

function getMemberId(m: TeamMember): string {
  return m.memberId ?? m.userId ?? m.id ?? '';
}

function getMemberName(m: TeamMember): string {
  const first = m.firstName ?? '';
  const last = m.lastName ?? '';
  return [first, last].filter(Boolean).join(' ') || m.email?.split('@')[0] || 'Team Member';
}

function formatPhaseDate(dateStr?: string | null): string {
  if (!dateStr) return 'No date set';
  const d = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatPhaseStatus(status: string): string {
  switch (status) {
    case 'not_started': return 'Not started';
    case 'in_progress': return 'In progress';
    default: return status.replace(/_/g, ' ');
  }
}

export default function UnassignedPhasesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [phases, setPhases] = useState<UnassignedPhase[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Assign sheet state
  const [assignPhase, setAssignPhase] = useState<UnassignedPhase | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      // Single request returns both phases and the business roster scoped to
      // effectiveUserId — so managers see the owner's workers, not their own.
      const res = await api.get<{ phases: UnassignedPhase[]; teamMembers: TeamMember[] }>(
        '/api/phases/unassigned'
      );
      if (res.data) {
        if (Array.isArray(res.data.phases)) setPhases(res.data.phases);
        if (Array.isArray(res.data.teamMembers)) {
          // Only show members who have accepted their invite; pending invitees
          // cannot be assigned (the assignment API validates inviteStatus).
          setTeamMembers(
            res.data.teamMembers.filter(
              (m) => m.isActive !== false && m.inviteStatus === 'accepted' && getMemberId(m),
            )
          );
        }
      }
    } catch {
      // keep existing data
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAssignSheet = (phase: UnassignedPhase) => {
    setSelectedMemberIds(new Set());
    setAssignPhase(phase);
  };

  const handleAssign = async () => {
    if (!assignPhase || selectedMemberIds.size === 0) return;
    setIsSaving(true);
    const ids = Array.from(selectedMemberIds);
    try {
      // Ensure all selected workers are on the job first
      const addRes = await api.post(`/api/jobs/${assignPhase.jobId}/multi-assign`, { workerIds: ids });
      if (addRes.error) throw new Error(String(addRes.error));

      // Assign them to the phase
      const patchRes = await api.patch(`/api/jobs/${assignPhase.jobId}/phases/${assignPhase.id}`, {
        assignedUserIds: ids,
        assignedUserId: ids[0],
      });
      if (patchRes.error) throw new Error(String(patchRes.error));

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast({ type: 'success', message: `${ids.length} worker${ids.length !== 1 ? 's' : ''} assigned to ${assignPhase.name}` });
      setAssignPhase(null);
      await load();
    } catch (err: any) {
      showToast({ type: 'error', message: err?.message || 'Failed to assign workers' });
    } finally {
      setIsSaving(false);
    }
  };

  // Eligible members for assignment (exclude administrators)
  const eligibleMembers = useMemo(
    () => teamMembers.filter(m => m.roleName?.toLowerCase() !== 'administrator'),
    [teamMembers]
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colorWithOpacity(colors.success, 0.1) }]}>
        <Feather name="check-circle" size={32} color={colors.success} />
      </View>
      <Text style={styles.emptyTitle}>All phases covered</Text>
      <Text style={styles.emptySubtitle}>Every active phase has at least one worker assigned.</Text>
    </View>
  );

  const assignSheetFooter = (
    <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.sm, gap: spacing.sm }}>
      <TouchableOpacity
        style={{
          backgroundColor: selectedMemberIds.size > 0 ? colors.primary : colors.muted,
          borderRadius: radius.md,
          paddingVertical: spacing.md,
          alignItems: 'center',
        }}
        onPress={handleAssign}
        disabled={selectedMemberIds.size === 0 || isSaving}
        activeOpacity={0.8}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: selectedMemberIds.size > 0 ? colors.primaryForeground : colors.mutedForeground }}>
            {selectedMemberIds.size > 0
              ? `Assign ${selectedMemberIds.size} Worker${selectedMemberIds.size !== 1 ? 's' : ''}`
              : 'Select a worker'}
          </Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={{ alignItems: 'center', paddingVertical: spacing.sm }}
        onPress={() => setAssignPhase(null)}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={iconSizes.md} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Unassigned Phases</Text>
          {!isLoading && phases.length > 0 && (
            <Text style={styles.headerSubtitle}>{phases.length} phase{phases.length !== 1 ? 's' : ''} need workers</Text>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.warning} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, phases.length === 0 && { flex: 1 }]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => load(true)}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {phases.length === 0 ? (
            renderEmptyState()
          ) : (
            phases.map((phase) => {
              const isUrgent = phase.scheduledStart
                ? new Date(phase.scheduledStart) >= now && new Date(phase.scheduledStart) <= in48h
                : false;
              return (
                <TouchableOpacity
                  key={phase.id}
                  style={[
                    styles.phaseCard,
                    isUrgent && { borderColor: colorWithOpacity(colors.warning, 0.4) },
                  ]}
                  activeOpacity={0.75}
                  onPress={() => openAssignSheet(phase)}
                >
                  {/* Urgency indicator */}
                  {isUrgent && (
                    <View style={[styles.urgencyBar, { backgroundColor: colors.warning }]} />
                  )}

                  <View style={styles.phaseCardContent}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      {/* Phase name + status */}
                      <View style={styles.phaseNameRow}>
                        <Text style={styles.phaseName} numberOfLines={1}>{phase.name}</Text>
                        <View style={[styles.statusChip, { backgroundColor: colorWithOpacity(colors.mutedForeground, 0.1) }]}>
                          <Text style={[styles.statusChipText, { color: colors.mutedForeground }]}>
                            {formatPhaseStatus(phase.status)}
                          </Text>
                        </View>
                      </View>

                      {/* Job name */}
                      <View style={styles.phaseMetaRow}>
                        <Feather name="briefcase" size={11} color={colors.mutedForeground} />
                        <Text style={styles.phaseMetaText} numberOfLines={1}>{phase.jobTitle}</Text>
                      </View>

                      {/* Scheduled date */}
                      <View style={styles.phaseMetaRow}>
                        <Feather name="calendar" size={11} color={isUrgent ? colors.warning : colors.mutedForeground} />
                        <Text style={[styles.phaseMetaText, isUrgent && { color: colors.warning, fontWeight: fontWeights.semibold }]}>
                          {formatPhaseDate(phase.scheduledStart)}
                          {phase.scheduledEnd && phase.scheduledEnd !== phase.scheduledStart
                            ? ` to ${formatPhaseDate(phase.scheduledEnd)}`
                            : ''}
                        </Text>
                      </View>
                    </View>

                    {/* Quick assign button */}
                    <TouchableOpacity
                      style={styles.assignButton}
                      onPress={() => openAssignSheet(phase)}
                      activeOpacity={0.8}
                    >
                      <Feather name="user-plus" size={14} color={colors.primaryForeground} />
                      <Text style={styles.assignButtonText}>Assign</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Assign bottom sheet */}
      <AppBottomSheet
        visible={assignPhase !== null}
        onDismiss={() => setAssignPhase(null)}
        title={assignPhase ? `Assign: ${assignPhase.name}` : 'Assign Workers'}
        scrollable={false}
        contentPadding={0}
        snapPoints={['75%']}
        footer={assignSheetFooter}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: spacing.lg }}
          showsVerticalScrollIndicator={false}
        >
          {assignPhase && (
            <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Feather name="briefcase" size={13} color={colors.mutedForeground} />
                <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }} numberOfLines={1}>
                  {assignPhase.jobTitle}
                </Text>
              </View>
              {assignPhase.scheduledStart && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 }}>
                  <Feather name="calendar" size={13} color={colors.mutedForeground} />
                  <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>
                    {formatPhaseDate(assignPhase.scheduledStart)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {eligibleMembers.length === 0 ? (
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <Feather name="users" size={32} color={colors.mutedForeground} style={{ marginBottom: spacing.md }} />
              <Text style={{ color: colors.mutedForeground, fontSize: typography.sizes.sm, textAlign: 'center' }}>
                No team members available.{'\n'}Add team members in Settings first.
              </Text>
            </View>
          ) : (
            eligibleMembers.map((member) => {
              const memberId = getMemberId(member);
              const name = getMemberName(member);
              const isSelected = selectedMemberIds.has(memberId);
              return (
                <TouchableOpacity
                  key={memberId}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingHorizontal: spacing.lg,
                    paddingVertical: 10,
                    backgroundColor: isSelected ? colorWithOpacity(colors.primary, 0.07) : 'transparent',
                  }}
                  onPress={() => {
                    const next = new Set(selectedMemberIds);
                    next.has(memberId) ? next.delete(memberId) : next.add(memberId);
                    setSelectedMemberIds(next);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{
                    width: 22, height: 22, borderRadius: 4, borderWidth: 2,
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSelected && <Feather name="check" size={13} color={colors.primaryForeground} />}
                  </View>
                  <TeamAvatar
                    name={name}
                    email={member.email}
                    userId={memberId}
                    themeColor={member.themeColor}
                    size={36}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.medium, color: colors.foreground }}>
                      {name}
                    </Text>
                    {member.email ? (
                      <Text style={{ fontSize: 11, color: colors.mutedForeground }} numberOfLines={1}>{member.email}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </AppBottomSheet>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: pageShell.paddingHorizontal,
    gap: spacing.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
  },
  phaseCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  urgencyBar: {
    height: 3,
    width: '100%',
  },
  phaseCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  phaseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  phaseName: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    flexShrink: 1,
  },
  statusChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  statusChipText: {
    fontSize: 10,
    fontWeight: fontWeights.medium,
    textTransform: 'capitalize' as const,
  },
  phaseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  phaseMetaText: {
    fontSize: 12,
    color: colors.mutedForeground,
    flex: 1,
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minWidth: 80,
    justifyContent: 'center',
  },
  assignButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
});
