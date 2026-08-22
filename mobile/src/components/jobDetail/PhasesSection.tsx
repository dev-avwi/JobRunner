/**
 * PhasesSection — displays job phases on the mobile job detail screen.
 * Tapping a phase opens a read-only detail sheet; owners/managers can tap
 * "Edit" inside the sheet or cycle the status badge directly.
 */
import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Animated, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemeColors } from '../../lib/theme';
import { spacing, radius, typography, fontWeights } from '../../lib/design-tokens';
import { AppBottomSheet } from '../ui/AppBottomSheet';
import { TeamAvatar } from '../TeamAvatar';

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
  budgetedCost?: string | null;
  actualHours?: number | null;
  status: PhaseStatus;
  sortOrder: number;
  notes?: string | null;
  assignedUserId?: string | null;
  assignedUserIds?: string[];
  assignedUsers?: Array<{ id: string; name: string; isLead?: boolean }>;
  assignedUserName?: string | null;
}

export type PhaseBudgetStatus = 'green' | 'amber' | 'red' | 'none';

export interface PhaseCostBreakdown {
  id: string | null;
  budgetedCost?: number | null;
  costs: {
    total: number;
  };
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

function getPhaseBudgetStatus(actual: number, budget: number | null): PhaseBudgetStatus {
  if (budget === null || budget <= 0) return 'none';
  const percentUsed = actual / budget;
  if (percentUsed > 1.05) return 'red';
  if (percentUsed > 0.9) return 'amber';
  return 'green';
}

function normalizePhaseBudget(budget: number | null | undefined): number | null {
  return budget !== null && budget !== undefined && budget > 0 ? budget : null;
}

function formatCost(amount: number): string {
  return `$${amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function phaseBudgetColor(status: PhaseBudgetStatus, colors: ThemeColors): string {
  if (status === 'green') return colors.success;
  if (status === 'amber') return colors.warning;
  if (status === 'red') return colors.destructive;
  return colors.mutedForeground;
}

function phaseBudgetLabel(status: PhaseBudgetStatus): string {
  if (status === 'green') return 'On track';
  if (status === 'amber') return 'Near limit';
  if (status === 'red') return 'Over budget';
  return 'No budget';
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
        borderRadius: radius.md,
        backgroundColor: '#22c55e',
        opacity: anim,
        zIndex: 10,
      }}
    />
  );
}

export interface PhasesSectionProps {
  colors: ThemeColors;
  phases: JobPhase[];
  isLoading?: boolean;
  isTradie?: boolean;
  onStatusChange?: (phaseId: string, status: PhaseStatus) => Promise<void>;
  onAddPhase?: () => void;
  onEditPhase?: (phase: JobPhase) => void;
  /** Called when a phase is cycled to "complete" status */
  onPhaseCompleted?: (phase: JobPhase) => void;
  /** Set of phase IDs that already have a progress claim line item */
  claimedPhaseIds?: Set<string>;
  /** Profitability costs used to show each phase's budget vs actual state */
  phaseCosts?: PhaseCostBreakdown[];
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
  phaseCosts,
}: PhasesSectionProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [flashingId, setFlashingId] = useState<string | null>(null);
  const [viewingPhase, setViewingPhase] = useState<JobPhase | null>(null);

  const sorted = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleCycleStatus = async (phase: JobPhase) => {
    if (isTradie || !onStatusChange) return;
    const currentIdx = STATUS_ORDER.indexOf(phase.status);
    const nextStatus = STATUS_ORDER[(currentIdx + 1) % STATUS_ORDER.length];
    setUpdatingId(phase.id);
    try {
      await Haptics.impactAsync(
        nextStatus === 'complete'
          ? Haptics.ImpactFeedbackStyle.Heavy
          : Haptics.ImpactFeedbackStyle.Light,
      );
      await onStatusChange(phase.id, nextStatus);
      // Update the viewing phase status live if sheet is open
      if (viewingPhase?.id === phase.id) {
        setViewingPhase({ ...phase, status: nextStatus });
      }
      if (nextStatus === 'complete') {
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

  // Phase detail sheet content
  const renderPhaseDetail = () => {
    if (!viewingPhase) return null;
    const cfg = STATUS_CONFIG[viewingPhase.status] ?? STATUS_CONFIG.not_started;
    const startStr = fmtDate(viewingPhase.scheduledStart);
    const endStr = fmtDate(viewingPhase.scheduledEnd);
    const hoursNum = parseFloat(viewingPhase.bookedHours ?? '0') || 0;
    const budgetNum = parseFloat(viewingPhase.budgetedCost ?? '0') || 0;
    const costBreakdown = phaseCosts?.find((entry) => entry.id === viewingPhase.id);
    const actualCost = costBreakdown?.costs.total;
    const budgetedCost = normalizePhaseBudget(costBreakdown?.budgetedCost ?? (budgetNum > 0 ? budgetNum : null));
    const budgetStatus = actualCost === undefined ? 'none' : getPhaseBudgetStatus(actualCost, budgetedCost);
    const budgetColor = phaseBudgetColor(budgetStatus, colors);
    const variance = budgetedCost === null || actualCost === undefined ? null : actualCost - budgetedCost;
    const isClaimed = claimedPhaseIds?.has(viewingPhase.id);
    const isUpdatingView = updatingId === viewingPhase.id;

    return (
      <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
        {/* Phase code + name */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
          <View style={{ borderWidth: 1, borderColor: `${colors.primary}66`, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: fontWeights.semibold, color: colors.primary }}>
              {viewingPhase.phaseCode}
            </Text>
          </View>
          {isClaimed && (
            <View style={styles.claimedBadge}>
              <Text style={styles.claimedBadgeText}>Claimed</Text>
            </View>
          )}
        </View>

        <Text style={{ fontSize: 20, fontWeight: fontWeights.bold, color: colors.foreground, lineHeight: 26 }}>
          {viewingPhase.name}
        </Text>

        {/* Status row — owners can cycle */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, width: 72 }}>Status</Text>
          <TouchableOpacity
            onPress={() => !isTradie && handleCycleStatus(viewingPhase)}
            disabled={isTradie || isUpdatingView}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: cfg.bg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
            activeOpacity={isTradie ? 1 : 0.7}
          >
            {isUpdatingView ? (
              <ActivityIndicator size="small" color={cfg.text} />
            ) : (
              <>
                <Text style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: cfg.text }}>{cfg.label}</Text>
                {!isTradie && <Feather name="refresh-cw" size={11} color={cfg.text} />}
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Phase team */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, width: 72 }}>Assigned</Text>
          {(viewingPhase.assignedUsers?.length || viewingPhase.assignedUserName) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flexDirection: 'row' }}>
                {(viewingPhase.assignedUsers?.length ? viewingPhase.assignedUsers : [{ id: viewingPhase.assignedUserId || 'lead', name: viewingPhase.assignedUserName || '' }]).slice(0, 3).map((member, index) => (
                  <View key={member.id} style={{ marginLeft: index ? -9 : 0, borderWidth: 2, borderColor: colors.card, borderRadius: 16 }}>
                    <TeamAvatar name={member.name} userId={member.id} size={32} />
                  </View>
                ))}
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: fontWeights.medium, color: colors.foreground }} numberOfLines={1}>
                {(viewingPhase.assignedUsers?.length ? viewingPhase.assignedUsers.map((member) => member.name) : [viewingPhase.assignedUserName]).join(', ')}
              </Text>
            </View>
          ) : (
            <Text style={{ fontSize: 13, color: colors.mutedForeground, fontStyle: 'italic' }}>Not assigned</Text>
          )}
        </View>

        {budgetNum > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, width: 72 }}>Budget</Text>
            <Text style={{ fontSize: 14, fontWeight: fontWeights.semibold, color: colors.foreground }}>
              ${budgetNum.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        )}

        <View style={{ gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.muted, borderWidth: 1, borderColor: `${budgetColor}35` }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Actual cost</Text>
              <Text style={{ fontSize: 12, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                {actualCost === undefined ? 'Unavailable' : formatCost(actualCost)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                {actualCost === undefined ? 'Actual cost unavailable' : variance === null ? 'Budget variance' : `Variance ${variance >= 0 ? '+' : ''}${formatCost(variance)}`}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: budgetColor }} />
                <Text style={{ fontSize: 11, fontWeight: fontWeights.semibold, color: budgetColor }}>
                  {actualCost === undefined ? 'Cost unavailable' : phaseBudgetLabel(budgetStatus)}
                </Text>
              </View>
            </View>
            {budgetedCost === null && (
              <Text style={{ fontSize: 11, color: colors.mutedForeground }}>No phase budget set</Text>
            )}
        </View>

        {/* Date range */}
        {(startStr || endStr) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, width: 72 }}>Dates</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="calendar" size={13} color={colors.mutedForeground} />
              <Text style={{ fontSize: 13, color: colors.foreground }}>
                {startStr ?? '?'} → {endStr ?? '?'}
              </Text>
            </View>
          </View>
        )}

        {/* Hours */}
        {hoursNum > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, width: 72 }}>Hours</Text>
            <View style={{ gap: 3 }}>
              <Text style={{ fontSize: 13, color: colors.foreground }}>{hoursNum.toFixed(1)} hrs booked</Text>
              <HoursComparison booked={hoursNum} actual={viewingPhase.actualHours} colors={colors} />
            </View>
          </View>
        )}

        {/* Description */}
        {viewingPhase.description ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <Text style={{ fontSize: 13, color: colors.mutedForeground, width: 72 }}>Notes</Text>
            <Text style={{ fontSize: 13, color: colors.foreground, flex: 1, lineHeight: 19 }}>
              {viewingPhase.description}
            </Text>
          </View>
        ) : null}

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.xs }} />

        {/* Edit button — owners/managers only */}
        {!isTradie && onEditPhase && (
          <TouchableOpacity
            onPress={() => {
              setViewingPhase(null);
              setTimeout(() => onEditPhase(viewingPhase!), 350);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              backgroundColor: colors.primary,
              paddingVertical: 14,
              borderRadius: radius.lg,
            }}
            activeOpacity={0.8}
          >
            <Feather name="edit-2" size={15} color={colors.primaryForeground} />
            <Text style={{ fontSize: 15, fontWeight: fontWeights.semibold, color: colors.primaryForeground }}>
              Edit Phase
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

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
            const costBreakdown = phaseCosts?.find((entry) => entry.id === phase.id);
            const actualCost = costBreakdown?.costs.total;
            const phaseBudget = normalizePhaseBudget(costBreakdown?.budgetedCost ?? (parseFloat(phase.budgetedCost ?? '0') || null));
            const budgetStatus = actualCost === undefined ? 'none' : getPhaseBudgetStatus(actualCost, phaseBudget);
            const budgetColor = phaseBudgetColor(budgetStatus, colors);
            const variance = phaseBudget === null || actualCost === undefined ? null : actualCost - phaseBudget;

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

                {/* Content — tap to VIEW details */}
                <View style={{ flex: 1, position: 'relative' }}>
                  <SuccessFlash visible={isFlashing} onDone={() => setFlashingId(null)} />
                  <TouchableOpacity
                    style={styles.phaseContent}
                    onPress={() => setViewingPhase(phase)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.phaseTopRow}>
                      {/* Phase code */}
                      <View style={[styles.phaseCodeBadge, { borderColor: colors.primary + '66' }]}>
                        <Text style={[styles.phaseCode, { color: colors.primary }]}>{phase.phaseCode}</Text>
                      </View>
                      <Text style={[styles.phaseName, { color: colors.foreground }]} numberOfLines={1}>
                        {phase.name}
                      </Text>
                      {/* Status badge — tappable for owners to cycle (stops propagation) */}
                      <TouchableOpacity
                        onPress={(e) => { e.stopPropagation?.(); handleCycleStatus(phase); }}
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
                      {/* Assignee avatar badge */}
                      {phase.assignedUserName ? (
                        <TeamAvatar
                          name={phase.assignedUserName}
                          userId={phase.assignedUserId || phase.assignedUserName}
                          size={20}
                        />
                      ) : null}
                      <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
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

                    {/* Hours comparison */}
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

                    {/* Budget/cost row — only shown when there's a budget set or actual spend */}
                    {(phaseBudget !== null || (actualCost !== undefined && actualCost > 0)) && (
                      <View style={{ marginTop: spacing.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.sm, backgroundColor: colors.muted, borderWidth: 1, borderColor: `${budgetColor}35` }}>
                        <View style={{ flex: 1 }}>
                          {phaseBudget !== null ? (
                            <Text style={{ fontSize: 10, color: colors.mutedForeground }}>
                              Budget {formatCost(phaseBudget)}{variance !== null ? `  ·  ${variance >= 0 ? '+' : ''}${formatCost(variance)} variance` : ''}
                            </Text>
                          ) : (
                            <Text style={{ fontSize: 10, color: colors.mutedForeground }}>No budget set</Text>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={{ fontSize: 10, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                            {actualCost !== undefined ? formatCost(actualCost) : '$0.00'}
                          </Text>
                          {budgetStatus !== 'none' && (
                            <>
                              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: budgetColor }} />
                              <Text style={{ fontSize: 10, color: budgetColor, fontWeight: fontWeights.semibold }}>{phaseBudgetLabel(budgetStatus)}</Text>
                            </>
                          )}
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

      {/* Phase detail bottom sheet */}
      <AppBottomSheet
        visible={viewingPhase !== null}
        title={viewingPhase?.name ?? 'Phase Details'}
        showCloseButton
        onDismiss={() => setViewingPhase(null)}
        autoHeight
      >
        {renderPhaseDetail()}
      </AppBottomSheet>
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
});
