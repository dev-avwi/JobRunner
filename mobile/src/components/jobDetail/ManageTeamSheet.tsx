/**
 * ManageTeamSheet — mobile "Manage Team" bottom sheet for project jobs.
 *
 * Two sections:
 *  1. Job Workers — list of currently assigned workers with remove buttons,
 *     plus an "Add Worker" button that opens an inline picker.
 *  2. Phase Assignment — each phase as a row showing assigned avatars with
 *     tap-to-remove, and a "+" button to add any eligible team member to that
 *     phase (auto-adding them to the job first if they are not yet on it).
 *
 * Design decisions:
 *  - onRefresh is typed as () => Promise<void> and is always awaited before
 *    busy is cleared, so sequential actions cannot submit stale replacement sets.
 *  - The phase "+" button is shown whenever any eligible team member is not yet
 *    assigned to that phase — not just when existing job workers are absent.
 */
import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppBottomSheet } from '../ui/AppBottomSheet';
import { TeamAvatar } from '../TeamAvatar';
import { api } from '../../lib/api';
import { showToast } from '../../lib/toast';
import { useTheme } from '../../lib/theme';
import { spacing, radius, typography, fontWeights } from '../../lib/design-tokens';
import type { JobPhase } from './PhasesSection';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamMember {
  id?: string;
  memberId?: string;
  userId?: string;
  name?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  themeColor?: string;
  roleName?: string;
  isActive?: boolean;
}

interface JobAssignment {
  id: string;
  userId: string;
  isPrimary?: boolean;
  isActive?: boolean;
  workerDisplayNameSnapshot?: string | null;
  displayName?: string | null;
}

export interface ManageTeamSheetProps {
  visible: boolean;
  onDismiss: () => void;
  jobId: string;
  phases: JobPhase[];
  teamMembers: TeamMember[];
  jobAssignments: JobAssignment[];
  /** Called after any assignment change; must be awaited before busy clears */
  onRefresh: () => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMemberName(member: TeamMember): string {
  if (member.displayName) return member.displayName;
  if (member.name) return member.name;
  const first = member.firstName ?? '';
  const last = member.lastName ?? '';
  return [first, last].filter(Boolean).join(' ') || 'Worker';
}

function getMemberId(member: TeamMember): string {
  return member.memberId ?? member.userId ?? member.id ?? '';
}

// ─── Worker picker for adding to job or phase ─────────────────────────────────

interface WorkerPickerSheetProps {
  visible: boolean;
  onDismiss: () => void;
  /** Workers already excluded (already on job / already on phase) */
  excludedIds: Set<string>;
  eligibleMembers: TeamMember[];
  title: string;
  confirmLabel: string;
  onConfirm: (selectedIds: string[]) => Promise<void>;
  colors: ReturnType<typeof useTheme>['colors'];
}

function WorkerPickerSheet({
  visible,
  onDismiss,
  excludedIds,
  eligibleMembers,
  title,
  confirmLabel,
  onConfirm,
  colors,
}: WorkerPickerSheetProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const available = eligibleMembers.filter((m) => !excludedIds.has(getMemberId(m)));

  const handleConfirm = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      await onConfirm(Array.from(selected));
      setSelected(new Set());
      onDismiss();
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  return (
    <AppBottomSheet
      visible={visible}
      onDismiss={() => { setSelected(new Set()); onDismiss(); }}
      title={title}
      scrollable={false}
      contentPadding={0}
      snapPoints={['60%']}
      footer={
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.sm }}>
          <TouchableOpacity
            style={{
              backgroundColor: selected.size > 0 ? colors.primary : colors.muted,
              borderRadius: radius.md,
              paddingVertical: spacing.md,
              alignItems: 'center',
            }}
            onPress={handleConfirm}
            disabled={selected.size === 0 || busy}
            activeOpacity={0.8}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text
                style={{
                  fontSize: typography.button.fontSize,
                  fontWeight: fontWeights.semibold,
                  color: selected.size > 0 ? colors.primaryForeground : colors.mutedForeground,
                }}
              >
                {selected.size > 0 ? `${confirmLabel} (${selected.size})` : confirmLabel}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      }
    >
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.md }}>
        {available.length === 0 ? (
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <Text style={{ color: colors.mutedForeground, fontSize: typography.sizes.sm }}>
              No workers available to add.
            </Text>
          </View>
        ) : (
          available.map((member) => {
            const memberId = getMemberId(member);
            const name = getMemberName(member);
            const isSelected = selected.has(memberId);
            return (
              <TouchableOpacity
                key={memberId}
                style={[pickerRowStyle, isSelected && { backgroundColor: `${colors.primary}12` }]}
                onPress={() => toggle(memberId)}
                activeOpacity={0.7}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
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
                  <Text
                    style={{
                      fontSize: typography.sizes.sm,
                      fontWeight: fontWeights.medium,
                      color: colors.foreground,
                    }}
                  >
                    {name}
                  </Text>
                  {member.email ? (
                    <Text style={{ fontSize: 11, color: colors.mutedForeground }} numberOfLines={1}>
                      {member.email}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </AppBottomSheet>
  );
}

const pickerRowStyle: any = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: spacing.sm,
  paddingHorizontal: spacing.lg,
  paddingVertical: 10,
};

// ─── Main component ───────────────────────────────────────────────────────────

export function ManageTeamSheet({
  visible,
  onDismiss,
  jobId,
  phases,
  teamMembers,
  jobAssignments,
  onRefresh,
}: ManageTeamSheetProps) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const [pickerMode, setPickerMode] = useState<'main' | 'add-worker' | 'add-to-phase'>('main');
  const [addToPhase, setAddToPhase] = useState<JobPhase | null>(null);
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());

  // Active assignments only
  const activeAssignments = useMemo(
    () => jobAssignments.filter((a) => a.isActive !== false),
    [jobAssignments],
  );

  const assignedJobUserIds = useMemo(
    () => new Set(activeAssignments.map((a) => a.userId)),
    [activeAssignments],
  );

  // Eligible team members: active, not administrator-only accounts, have an id
  const eligibleMembers = useMemo(
    () =>
      teamMembers.filter(
        (m) =>
          m.isActive !== false &&
          m.roleName?.toLowerCase() !== 'administrator' &&
          getMemberId(m),
      ),
    [teamMembers],
  );

  const sorted = useMemo(
    () => [...phases].sort((a, b) => a.sortOrder - b.sortOrder),
    [phases],
  );

  // Phase membership map built from props: phaseId → Set<userId>
  const phaseAssignedIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const phase of phases) {
      const members =
        phase.assignedUsers?.length
          ? phase.assignedUsers
          : phase.assignedUserId
          ? [{ id: phase.assignedUserId, name: phase.assignedUserName ?? '', isLead: true }]
          : [];
      map.set(phase.id, new Set(members.map((m) => m.id)));
    }
    return map;
  }, [phases]);

  // Resolve display name for an assignment record
  const assignmentName = useCallback(
    (assignment: JobAssignment): string => {
      if (assignment.workerDisplayNameSnapshot) return assignment.workerDisplayNameSnapshot;
      if (assignment.displayName) return assignment.displayName;
      const member = teamMembers.find((m) => getMemberId(m) === assignment.userId);
      return member ? getMemberName(member) : 'Worker';
    },
    [teamMembers],
  );

  // ── API helpers ───────────────────────────────────────────────────────────

  const addWorkersToJob = useCallback(
    async (userIds: string[]) => {
      const res = await api.post(`/api/jobs/${jobId}/multi-assign`, { workerIds: userIds });
      if (res.error) throw new Error(String(res.error));
    },
    [jobId],
  );

  const removeWorkerFromJob = useCallback(
    async (userId: string) => {
      const res = await api.delete(`/api/jobs/${jobId}/assignments/${userId}/remove`);
      if (res.error) throw new Error(String(res.error));
    },
    [jobId],
  );

  const updatePhaseAssignment = useCallback(
    async (phase: JobPhase, newUserIds: string[]) => {
      const currentMembers =
        phase.assignedUsers?.length
          ? phase.assignedUsers
          : phase.assignedUserId
          ? [{ id: phase.assignedUserId, name: '', isLead: true }]
          : [];
      const currentLead =
        currentMembers.find((m) => m.isLead)?.id ?? currentMembers[0]?.id ?? null;
      const newLead =
        newUserIds.includes(currentLead ?? '') ? currentLead : (newUserIds[0] ?? null);
      const res = await api.patch(`/api/jobs/${jobId}/phases/${phase.id}`, {
        assignedUserIds: newUserIds,
        assignedUserId: newLead,
      });
      if (res.error) throw new Error(String(res.error));
    },
    [jobId],
  );

  // ── Handlers — always await onRefresh before clearing busy ───────────────

  const handleAddWorkersToJob = useCallback(
    async (ids: string[]) => {
      setBusy('add-job');
      try {
        await addWorkersToJob(ids);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await onRefresh();
      } catch {
        showToast({ type: 'error', message: 'Failed to add worker to job' });
      } finally {
        setBusy(null);
      }
    },
    [addWorkersToJob, onRefresh],
  );

  const handleRemoveWorkerFromJob = useCallback(
    async (assignment: JobAssignment) => {
      const name = assignmentName(assignment);
      setBusy(`remove-${assignment.userId}`);
      try {
        // Remove from all phases first to keep data consistent
        for (const phase of sorted) {
          const currentSet = phaseAssignedIds.get(phase.id) ?? new Set<string>();
          if (currentSet.has(assignment.userId)) {
            const newIds = [...currentSet].filter((id) => id !== assignment.userId);
            await updatePhaseAssignment(phase, newIds);
          }
        }
        await removeWorkerFromJob(assignment.userId);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast({ type: 'success', message: `${name} removed from job` });
        await onRefresh();
      } catch {
        showToast({ type: 'error', message: 'Failed to remove worker' });
      } finally {
        setBusy(null);
      }
    },
    [sorted, phaseAssignedIds, assignmentName, removeWorkerFromJob, updatePhaseAssignment, onRefresh],
  );

  const handleRemoveWorkerFromPhase = useCallback(
    async (phase: JobPhase, userId: string) => {
      const currentSet = phaseAssignedIds.get(phase.id) ?? new Set<string>();
      const newIds = [...currentSet].filter((id) => id !== userId);
      setBusy(`phase-${phase.id}-${userId}`);
      try {
        await updatePhaseAssignment(phase, newIds);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await onRefresh();
      } catch {
        showToast({ type: 'error', message: 'Failed to update phase team' });
      } finally {
        setBusy(null);
      }
    },
    [phaseAssignedIds, updatePhaseAssignment, onRefresh],
  );

  /**
   * Add one or more eligible members to a phase.
   * If any of them are not yet on the job, they are auto-added first.
   */
  const handleAddWorkersToPhase = useCallback(
    async (phase: JobPhase, newIds: string[]) => {
      const currentSet = phaseAssignedIds.get(phase.id) ?? new Set<string>();
      const combined = [...new Set([...currentSet, ...newIds])];
      setBusy(`phase-add-${phase.id}`);
      try {
        // Auto-add to job any worker not yet assigned
        const notOnJob = newIds.filter((uid) => !assignedJobUserIds.has(uid));
        if (notOnJob.length > 0) {
          await addWorkersToJob(notOnJob);
        }
        await updatePhaseAssignment(phase, combined);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await onRefresh();
      } catch {
        showToast({ type: 'error', message: 'Failed to assign to phase' });
      } finally {
        setBusy(null);
        setAddToPhase(null);
      }
    },
    [phaseAssignedIds, assignedJobUserIds, addWorkersToJob, updatePhaseAssignment, onRefresh],
  );

  const isBusy = busy !== null;

  // ── Inline picker (avoids stacked-Modal touch interception issues) ───────

  const enterPicker = (mode: 'add-worker' | 'add-to-phase', phase?: JobPhase) => {
    setPickerSelected(new Set());
    if (mode === 'add-to-phase' && phase) setAddToPhase(phase);
    setPickerMode(mode);
  };

  const exitPicker = () => {
    setPickerMode('main');
    setAddToPhase(null);
    setPickerSelected(new Set());
  };

  const pickerExcludedIds =
    pickerMode === 'add-to-phase' && addToPhase
      ? phaseAssignedIds.get(addToPhase.id) ?? new Set<string>()
      : assignedJobUserIds;

  const pickerAvailable = eligibleMembers.filter(
    (m) => !pickerExcludedIds.has(getMemberId(m)),
  );

  const pickerTitle =
    pickerMode === 'add-worker'
      ? 'Add Worker to Job'
      : pickerMode === 'add-to-phase' && addToPhase
      ? `Add to ${addToPhase.name}`
      : 'Manage Team';

  const handlePickerConfirm = async () => {
    if (pickerSelected.size === 0) return;
    const ids = Array.from(pickerSelected);
    setBusy('picker');
    try {
      if (pickerMode === 'add-worker') {
        await addWorkersToJob(ids);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast({ type: 'success', message: `${ids.length} worker${ids.length !== 1 ? 's' : ''} added to job` });
        await onRefresh();
      } else if (pickerMode === 'add-to-phase' && addToPhase) {
        const currentSet = phaseAssignedIds.get(addToPhase.id) ?? new Set<string>();
        const combined = [...new Set([...currentSet, ...ids])];
        const notOnJob = ids.filter((uid) => !assignedJobUserIds.has(uid));
        if (notOnJob.length > 0) await addWorkersToJob(notOnJob);
        await updatePhaseAssignment(addToPhase, combined);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await onRefresh();
      }
      exitPicker();
    } catch {
      showToast({ type: 'error', message: 'Failed to add worker' });
    } finally {
      setBusy(null);
    }
  };

  const sheetTitle = pickerMode === 'main' ? 'Manage Team' : pickerTitle;

  const sheetFooter =
    pickerMode !== 'main' ? (
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.sm, gap: spacing.sm }}>
        <TouchableOpacity
          style={{
            backgroundColor: pickerSelected.size > 0 ? colors.primary : colors.muted,
            borderRadius: radius.md,
            paddingVertical: spacing.md,
            alignItems: 'center',
          }}
          onPress={handlePickerConfirm}
          disabled={pickerSelected.size === 0 || isBusy}
          activeOpacity={0.8}
        >
          {busy === 'picker' ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: pickerSelected.size > 0 ? colors.primaryForeground : colors.mutedForeground }}>
              {pickerSelected.size > 0
                ? `${pickerMode === 'add-worker' ? 'Add to Job' : 'Assign to Phase'} (${pickerSelected.size})`
                : pickerMode === 'add-worker' ? 'Add to Job' : 'Assign to Phase'}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={{ alignItems: 'center', paddingVertical: spacing.sm }}
          onPress={exitPicker}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.sm }}>
        <TouchableOpacity
          style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' }}
          onPress={onDismiss}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.primaryForeground }}>Done</Text>
        </TouchableOpacity>
      </View>
    );

  return (
    <AppBottomSheet
      visible={visible}
      onDismiss={pickerMode !== 'main' ? exitPicker : onDismiss}
      title={sheetTitle}
      scrollable={false}
      contentPadding={0}
      snapPoints={['85%']}
      footer={sheetFooter}
    >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Inline picker (add-worker or add-to-phase mode) ────── */}
          {pickerMode !== 'main' && (
            pickerAvailable.length === 0 ? (
              <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                <Feather name="users" size={32} color={colors.mutedForeground} style={{ marginBottom: spacing.md }} />
                <Text style={{ color: colors.mutedForeground, fontSize: typography.sizes.sm, textAlign: 'center' }}>
                  No team members available to add.{'\n'}Add team members in Settings first.
                </Text>
              </View>
            ) : (
              pickerAvailable.map((member) => {
                const memberId = getMemberId(member);
                const name = getMemberName(member);
                const isSelected = pickerSelected.has(memberId);
                return (
                  <TouchableOpacity
                    key={memberId}
                    style={[pickerRowStyle, isSelected && { backgroundColor: `${colors.primary}12` }]}
                    onPress={() => {
                      const next = new Set(pickerSelected);
                      next.has(memberId) ? next.delete(memberId) : next.add(memberId);
                      setPickerSelected(next);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {isSelected && <Feather name="check" size={13} color={colors.primaryForeground} />}
                    </View>
                    <TeamAvatar name={name} email={member.email} userId={memberId} themeColor={member.themeColor} size={36} />
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
            )
          )}

          {/* ── Section 1: Job Workers ─────────────────────────────── */}
          {pickerMode === 'main' && <>
          {/* ── Section 1: Job Workers ─────────────────────────────── */}
          <View style={styles.sectionHeader}>
            <Feather name="users" size={14} color={colors.mutedForeground} />
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>JOB WORKERS</Text>
          </View>

          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {activeAssignments.length === 0 && (
              <Text
                style={{
                  fontSize: typography.sizes.sm,
                  color: colors.mutedForeground,
                  fontStyle: 'italic',
                  paddingVertical: spacing.sm,
                }}
              >
                No workers assigned to this job yet.
              </Text>
            )}

            {activeAssignments.map((assignment) => {
              const name = assignmentName(assignment);
              const member = teamMembers.find((m) => getMemberId(m) === assignment.userId);
              const phasesCount = sorted.filter((p) =>
                phaseAssignedIds.get(p.id)?.has(assignment.userId),
              ).length;
              const isRemoving = busy === `remove-${assignment.userId}`;

              return (
                <View
                  key={assignment.id}
                  style={[styles.workerRow, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                >
                  <TeamAvatar
                    name={name}
                    email={member?.email}
                    userId={assignment.userId}
                    themeColor={member?.themeColor}
                    size={36}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        fontSize: typography.sizes.sm,
                        fontWeight: fontWeights.medium,
                        color: colors.foreground,
                      }}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                      {assignment.isPrimary
                        ? 'Lead worker'
                        : phasesCount > 0
                        ? `${phasesCount} phase${phasesCount !== 1 ? 's' : ''}`
                        : 'No phases'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveWorkerFromJob(assignment)}
                    disabled={isBusy}
                    style={[styles.removeBtn, { borderColor: colors.border }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {isRemoving ? (
                      <ActivityIndicator size="small" color={colors.destructive} />
                    ) : (
                      <Feather name="x" size={14} color={colors.destructive} />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Add Worker button */}
            <TouchableOpacity
              style={[styles.addWorkerBtn, { borderColor: colors.border }]}
              onPress={() => enterPicker('add-worker')}
              disabled={isBusy}
              activeOpacity={0.7}
            >
              <Feather name="user-plus" size={15} color={colors.primary} />
              <Text
                style={{
                  fontSize: typography.sizes.sm,
                  fontWeight: fontWeights.medium,
                  color: colors.primary,
                }}
              >
                Add Worker
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Section 2: Phase Assignment ────────────────────────── */}
          {sorted.length > 0 && (
            <>
              <View style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
                <Feather name="layers" size={14} color={colors.mutedForeground} />
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  PHASE ASSIGNMENT
                </Text>
              </View>

              <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
                {eligibleMembers.length === 0 && (
                  <Text
                    style={{
                      fontSize: typography.sizes.sm,
                      color: colors.mutedForeground,
                      fontStyle: 'italic',
                      paddingVertical: spacing.sm,
                    }}
                  >
                    Add team members to assign them to phases.
                  </Text>
                )}

                {sorted.map((phase) => {
                  const phaseSet = phaseAssignedIds.get(phase.id) ?? new Set<string>();
                  // Workers assigned to this phase — sourced from phase.assignedUsers so that
                  // members assigned at the phase level but not in job_assignments are still shown.
                  const assignedWorkers: Array<{ id: string; name: string; isLead?: boolean }> =
                    phase.assignedUsers?.length
                      ? phase.assignedUsers
                      : phase.assignedUserId
                      ? [{ id: phase.assignedUserId, name: phase.assignedUserName ?? '', isLead: true }]
                      : [];
                  const isAddingToPhase = busy === `phase-add-${phase.id}`;

                  // Show "+" whenever any eligible member is not yet on this phase
                  const canAddMore = eligibleMembers.some((m) => !phaseSet.has(getMemberId(m)));

                  return (
                    <View
                      key={phase.id}
                      style={[
                        styles.phaseRow,
                        { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      ]}
                    >
                      {/* Phase label */}
                      <View style={{ gap: 2, marginBottom: spacing.sm }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                          <View
                            style={{
                              borderWidth: 1,
                              borderColor: `${colors.primary}66`,
                              borderRadius: 4,
                              paddingHorizontal: 5,
                              paddingVertical: 1,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontFamily: 'monospace',
                                fontWeight: fontWeights.semibold,
                                color: colors.primary,
                              }}
                            >
                              {phase.phaseCode}
                            </Text>
                          </View>
                          <Text
                            style={{
                              fontSize: typography.sizes.sm,
                              fontWeight: fontWeights.semibold,
                              color: colors.foreground,
                              flex: 1,
                            }}
                            numberOfLines={1}
                          >
                            {phase.name}
                          </Text>
                        </View>
                      </View>

                      {/* Assigned workers row */}
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: spacing.sm,
                          alignItems: 'center',
                        }}
                      >
                        {assignedWorkers.length === 0 && (
                          <Text
                            style={{
                              fontSize: 12,
                              color: colors.mutedForeground,
                              fontStyle: 'italic',
                            }}
                          >
                            Unassigned
                          </Text>
                        )}

                        {assignedWorkers.map((phaseUser) => {
                          // Resolve name/avatar from teamMembers; fall back to what the phase stored
                          const member = teamMembers.find((m) => getMemberId(m) === phaseUser.id);
                          const name = member ? getMemberName(member) : phaseUser.name || 'Worker';
                          const isRemovingFromPhase =
                            busy === `phase-${phase.id}-${phaseUser.id}`;

                          return (
                            <View
                              key={phaseUser.id}
                              style={[
                                styles.workerChip,
                                { backgroundColor: colors.muted, borderColor: colors.border },
                              ]}
                            >
                              <TeamAvatar
                                name={name}
                                userId={phaseUser.id}
                                themeColor={member?.themeColor}
                                size={20}
                              />
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: fontWeights.medium,
                                  color: colors.foreground,
                                  maxWidth: 80,
                                }}
                                numberOfLines={1}
                              >
                                {name.split(' ')[0]}
                              </Text>
                              <TouchableOpacity
                                onPress={() =>
                                  handleRemoveWorkerFromPhase(phase, phaseUser.id)
                                }
                                disabled={isBusy}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              >
                                {isRemovingFromPhase ? (
                                  <ActivityIndicator
                                    size="small"
                                    color={colors.mutedForeground}
                                    style={{ width: 12, height: 12 }}
                                  />
                                ) : (
                                  <Feather name="x" size={11} color={colors.mutedForeground} />
                                )}
                              </TouchableOpacity>
                            </View>
                          );
                        })}

                        {/* Add to phase — shown whenever any eligible member isn't on this phase */}
                        {canAddMore && (
                          <TouchableOpacity
                            style={[styles.addToPhaseBtn, { borderColor: colors.primary }]}
                            onPress={() => enterPicker('add-to-phase', phase)}
                            disabled={isBusy}
                            activeOpacity={0.7}
                          >
                            {isAddingToPhase ? (
                              <ActivityIndicator
                                size="small"
                                color={colors.primary}
                                style={{ width: 14, height: 14 }}
                              />
                            ) : (
                              <Feather name="plus" size={13} color={colors.primary} />
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}
          </>}
        </ScrollView>
      </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.6,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addWorkerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  phaseRow: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  workerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  addToPhaseBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
});
