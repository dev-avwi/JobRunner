/**
 * PhasesSection — displays job phases on the mobile job detail screen.
 * Read-only for workers (isTradie), status-editable for owners/managers.
 *
 * Polish additions:
 *  - Haptic feedback when cycling phase status
 *  - Success micro-animation (flash) when last phase is marked Complete
 *  - Estimated vs actual hours comparison per phase (when timeEntries exist)
 */
import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemeColors } from '../../lib/theme';
import { spacing, radius, typography, fontWeights } from '../../lib/design-tokens';

export type PhaseStatus = 'not_started' | 'in_progress' | 'complete' | 'invoiced';

export interface JobPhase {
  id: string;
  jobId: string;
  phaseCode: string;
  name: string;
  description?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  bookedHours?: string | null;
  actualHours?: number | null;
  status: PhaseStatus;
  sortOrder: number;
  notes?: string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
}

function getInitials(name?: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] ?? '').toUpperCase();
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

const STATUS_CONFIG: Record<PhaseStatus, { label: string; bg: string; text: string }> = {
  not_started: { label: 'Not Started', bg: '#F3F4F6', text: '#374151' },
  in_progress:  { label: 'In Progress',  bg: '#DBEAFE', text: '#1E40AF' },
  complete:     { label: 'Complete',     bg: '#D1FAE5', text: '#065F46' },
  invoiced:     { label: 'Invoiced',     bg: '#EDE9FE', text: '#6D28D9' },
};

const STATUS_ORDER: PhaseStatus[] = ['not_started', 'in_progress', 'complete', 'invoiced'];

function fmtDate(d?: string | null): string | null {
  if (!d) return null;
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' });
  } catch {
    return null;
  }
}

function HoursComparison({ booked, actual, colors }: { booked: number; actual: number | null | undefined; colors: ThemeColors }) {
  if (!actual || actual <= 0) return null;
  const diff = actual - booked;
  const isOver = diff > 0.1;
  const isUnder = diff < -0.1;
  const color = isOver ? '#DC2626' : isUnder ? '#059669' : colors.mutedForeground;
  const icon = isOver ? 'trending-up' : isUnder ? 'trending-down' : 'minus';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Feather name={icon as any} size={10} color={color} />
      <Text style={{ fontSize: 10, color, fontWeight: fontWeights.medium }}>
        {actual.toFixed(1)} actual / {booked.toFixed(1)} est hrs
      </Text>
    </View>
  );
}

// Success flash animation for last-phase completion
function SuccessFlash({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.delay(400),
        Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => onDone());
    }
  }, [visible]);

  if (!visible) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#10B981',
        borderRadius: radius.md,
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }),
        zIndex: 20,
      }}
    />
  );
}

export interface PhasesSectionProps {
  colors: ThemeColors;
  phases: JobPhase[];
  isLoading: boolean;
  isTradie?: boolean;
  onStatusChange?: (phaseId: string, status: PhaseStatus) => Promise<void>;
  onAddPhase?: () => void;
  onEditPhase?: (phase: JobPhase) => void;
  /** Called when a phase is cycled to "complete" status */
  onPhaseCompleted?: (phase: JobPhase) => void;
  /** Set of phase IDs that already have a progress claim line item */
  claimedPhaseIds?: Set<string>;
}

export function PhasesSection({
  colors,
  phases,
  isLoading,
  isTradie = false,
  onStatusChange,
  onAddPhase,
  onEditPhase,
  onPhaseCompleted,
  claimedPhaseIds,
}: PhasesSectionProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [flashingId, setFlashingId] = useState<string | null>(null);

  const sorted = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleCycleStatus = async (phase: JobPhase) => {
    if (isTradie || !onStatusChange) return;
    const currentIdx = STATUS_ORDER.indexOf(phase.status);
    const nextStatus = STATUS_ORDER[(currentIdx + 1) % STATUS_ORDER.length];
    setUpdatingId(phase.id);
    try {
      // Haptic feedback
      await Haptics.impactAsync(
        nextStatus === 'complete'
          ? Haptics.ImpactFeedbackStyle.Heavy
          : Haptics.ImpactFeedbackStyle.Light,
      );
      await onStatusChange(phase.id, nextStatus);
      if (nextStatus === 'complete') {
        // Check if this is the last phase to complete
        const allOthersDone = sorted
          .filter((p) => p.id !== phase.id)
          .every((p) => p.status === 'complete' || p.status === 'invoiced');
        if (allOthersDone) {
          setFlashingId(phase.id);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        if (onPhaseCompleted) onPhaseCompleted(phase);
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const totalBookedHours = phases.reduce(
    (sum, p) => sum + (parseFloat(p.bookedHours ?? '0') || 0),
    0,
  );
  const completedCount = phases.filter((p) => p.status === 'complete' || p.status === 'invoiced').length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="layers" size={16} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Job Phases</Text>
          {phases.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.muted }]}>
              <Text style={[styles.countBadgeText, { color: colors.mutedForeground }]}>
                {completedCount}/{phases.length}
              </Text>
            </View>
          )}
        </View>
        {!isTradie && onAddPhase && (
          <TouchableOpacity onPress={onAddPhase} style={styles.addButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="plus" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Loading phases…</Text>
        </View>
      ) : sorted.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          No project phases yet. Add phases to break this project into billable milestones.
        </Text>
      ) : (
        <>
          {/* Progress summary */}
          {phases.length > 0 && (
            <View style={styles.summaryRow}>
              <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: colors.primary, width: `${Math.round((completedCount / phases.length) * 100)}%` as any },
                  ]}
                />
              </View>
              <Text style={[styles.summaryText, { color: colors.mutedForeground }]}>
                {Math.round((completedCount / phases.length) * 100)}% done
                {totalBookedHours > 0 ? ` · ${totalBookedHours.toFixed(1)} hrs booked` : ''}
              </Text>
            </View>
          )}

          {/* Phase rows */}
          {sorted.map((phase, idx) => {
            const cfg = STATUS_CONFIG[phase.status] ?? STATUS_CONFIG.not_started;
            const isUpdating = updatingId === phase.id;
            const isFlashing = flashingId === phase.id;
            const isLast = idx === sorted.length - 1;
            const startStr = fmtDate(phase.scheduledStart);
            const endStr = fmtDate(phase.scheduledEnd);
            const hoursNum = parseFloat(phase.bookedHours ?? '0') || 0;

            return (
              <View key={phase.id} style={[styles.phaseRow, isLast && styles.phaseRowLast]}>
                {/* Timeline connector */}
                <View style={styles.timelineCol}>
                  <View style={[
                    styles.timelineDot,
                    {
                      backgroundColor: phase.status === 'complete' || phase.status === 'invoiced'
                        ? colors.primary
                        : phase.status === 'in_progress'
                          ? colors.primary
                          : colors.border,
                      borderColor: phase.status === 'in_progress' ? colors.primary : 'transparent',
                    },
                  ]} />
                  {!isLast && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
                </View>

                {/* Content */}
                <View style={{ flex: 1, position: 'relative' }}>
                  <SuccessFlash visible={isFlashing} onDone={() => setFlashingId(null)} />
                  <TouchableOpacity
                    style={styles.phaseContent}
                    onPress={() => !isTradie && onEditPhase && onEditPhase(phase)}
                    disabled={isTradie || !onEditPhase}
                    activeOpacity={onEditPhase && !isTradie ? 0.7 : 1}
                  >
                    <View style={styles.phaseTopRow}>
                      {/* Phase code */}
                      <View style={[styles.phaseCodeBadge, { borderColor: colors.primary + '66' }]}>
                        <Text style={[styles.phaseCode, { color: colors.primary }]}>{phase.phaseCode}</Text>
                      </View>
                      <Text style={[styles.phaseName, { color: colors.foreground }]} numberOfLines={1}>
                        {phase.name}
                      </Text>
                      {/* Status badge — tappable for owners to cycle */}
                      <TouchableOpacity
                        onPress={() => handleCycleStatus(phase)}
                        disabled={isTradie || isUpdating}
                        style={[styles.statusBadge, { backgroundColor: cfg.bg }]}
                      >
                        {isUpdating ? (
                          <ActivityIndicator size="small" color={cfg.text} style={{ width: 40 }} />
                        ) : (
                          <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
                        )}
                      </TouchableOpacity>
                      {/* Claimed badge */}
                      {claimedPhaseIds?.has(phase.id) && (
                        <View style={styles.claimedBadge}>
                          <Text style={styles.claimedBadgeText}>Claimed</Text>
                        </View>
                      )}
                      {/* Assignee initials badge */}
                      {phase.assignedUserName ? (
                        <View style={[styles.assigneeBadge, { backgroundColor: colors.primary }]}>
                          <Text style={styles.assigneeBadgeText}>
                            {getInitials(phase.assignedUserName)}
                          </Text>
                        </View>
                      ) : null}
                      {!isTradie && onEditPhase && (
                        <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                      )}
                    </View>

                    {/* Date range pill */}
                    {(startStr || endStr) && (
                      <View style={[styles.dateRangePill, { backgroundColor: colors.muted }]}>
                        <Feather name="calendar" size={9} color={colors.mutedForeground} />
                        <Text style={[styles.dateRangeText, { color: colors.mutedForeground }]}>
                          {startStr ?? '?'} → {endStr ?? '?'}
                        </Text>
                      </View>
                    )}

                    {/* Estimated hours */}
                    {hoursNum > 0 && (
                      <View style={styles.phaseMeta}>
                        <View style={styles.metaItem}>
                          <Feather name="clock" size={10} color={colors.mutedForeground} />
                          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                            {hoursNum.toFixed(1)} hrs est.
                          </Text>
                        </View>
                      </View>
                    )}

                    {phase.description ? (
                      <Text style={[styles.phaseDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {phase.description}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: fontWeights.semibold,
    marginLeft: spacing.xs,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 2,
  },
  countBadgeText: {
    fontSize: 10,
    fontWeight: fontWeights.medium,
  },
  addButton: {
    padding: spacing.xs,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  emptyText: {
    fontSize: typography.caption.fontSize,
    paddingVertical: spacing.xs,
  },
  summaryRow: {
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  summaryText: {
    fontSize: 11,
  },
  phaseRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  phaseRowLast: {
    paddingBottom: 0,
  },
  timelineCol: {
    alignItems: 'center',
    width: 16,
    paddingTop: 4,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 2,
  },
  phaseContent: {
    flex: 1,
    gap: 4,
  },
  phaseTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  phaseCodeBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  phaseCode: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: fontWeights.semibold,
  },
  phaseName: {
    fontSize: typography.body.fontSize,
    fontWeight: fontWeights.medium,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: fontWeights.medium,
  },
  dateRangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dateRangeText: {
    fontSize: 10,
  },
  phaseMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 11,
  },
  phaseDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  claimedBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  claimedBadgeText: {
    fontSize: 10,
    fontWeight: fontWeights.medium,
    color: '#1E40AF',
  },
  assigneeBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assigneeBadgeText: {
    fontSize: 8,
    fontWeight: '700' as any,
    color: '#fff',
    lineHeight: 10,
  },
});
