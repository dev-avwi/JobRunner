import { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ThemeColors } from '../../lib/theme';
import { spacing, radius, typography, fontWeights, shadows } from '../../lib/design-tokens';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SectionExpense {
  id: string;
  jobId?: string | null;
  categoryId: string;
  categoryName?: string;
  amount: string;
  gstAmount?: string | null;
  description: string;
  vendor?: string | null;
  expenseDate: string;
  isBillable: boolean;
  status?: string;
  phaseId?: string | null;
}

export interface PhaseStub {
  id: string;
  name: string;
  phaseCode?: string | null;
  status: string;
  sortOrder: number;
}

interface Props {
  colors: ThemeColors;
  expenses: SectionExpense[];
  isLoading: boolean;
  jobId: string;
  isOwnerOrManager: boolean;
  phases?: PhaseStub[];
  activePhaseId?: string | null;
  onRefresh?: () => void;
}

// ── Phase status colours ───────────────────────────────────────────────────────

const PHASE_STATUS_COLORS: Record<string, { dot: string; badge: string; text: string }> = {
  not_started: { dot: '#94a3b8', badge: '#f1f5f9', text: '#64748b' },
  in_progress:  { dot: '#3b82f6', badge: '#eff6ff', text: '#1d4ed8' },
  complete:     { dot: '#22c55e', badge: '#f0fdf4', text: '#15803d' },
  invoiced:     { dot: '#a855f7', badge: '#faf5ff', text: '#7e22ce' },
};
const PHASE_STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  complete: 'Complete',
  invoiced: 'Invoiced',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: string | number): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `$${(isNaN(n) ? 0 : n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' });
  } catch {
    return iso;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExpensesSection({
  colors,
  expenses,
  isLoading,
  jobId,
  isOwnerOrManager,
  phases,
  activePhaseId,
  onRefresh,
}: Props) {
  const styles = StyleSheet.create({
    sectionTitle: {
      fontSize: 11,
      fontWeight: fontWeights.bold as any,
      letterSpacing: 0.8,
      color: colors.mutedForeground,
      textTransform: 'uppercase',
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    addButtonLabel: {
      fontSize: 12,
      fontWeight: fontWeights.semibold as any,
      color: colors.primary,
    },
  });

  const navigateToAdd = useCallback((phaseId?: string | null) => {
    const params = new URLSearchParams({ jobId });
    if (phaseId) params.append('phaseId', phaseId);
    router.push(`/more/expenses?${params.toString()}` as any);
  }, [jobId]);

  const total = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  // ── Expense row ─────────────────────────────────────────────────────────────
  const renderRow = useCallback((expense: SectionExpense) => (
    <TouchableOpacity
      key={expense.id}
      activeOpacity={0.7}
      onPress={() => router.push(`/more/expenses?jobId=${jobId}` as any)}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
        gap: spacing.sm,
      }}
    >
      {/* Category badge + description */}
      <View style={{ flex: 1, minWidth: 0 }}>
        {expense.categoryName ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 3,
              backgroundColor: colors.primaryLight, paddingHorizontal: 6,
              paddingVertical: 2, borderRadius: 8,
            }}>
              <Feather name="tag" size={9} color={colors.primary} />
              <Text style={{ fontSize: 10, fontWeight: fontWeights.semibold as any, color: colors.primary }}>
                {expense.categoryName}
              </Text>
            </View>
          </View>
        ) : null}
        <Text style={{ fontSize: 13, fontWeight: fontWeights.medium as any, color: colors.foreground }} numberOfLines={1}>
          {expense.description}
        </Text>
        <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1 }} numberOfLines={1}>
          {[expense.vendor, fmtDate(expense.expenseDate)].filter(Boolean).join('  ·  ')}
        </Text>
      </View>

      {/* Amount */}
      <Text style={{ fontSize: 13, fontWeight: fontWeights.semibold as any, color: colors.destructive, marginTop: 1 }}>
        -{fmt(expense.amount)}
      </Text>
    </TouchableOpacity>
  ), [colors, jobId]);

  // ── Section header row ──────────────────────────────────────────────────────
  const sectionHeader = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, paddingHorizontal: spacing.md }}>
      <View>
        <Text style={styles.sectionTitle}>EXPENSES</Text>
        {expenses.length > 0 && (
          <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 2 }}>
            {expenses.length} item{expenses.length !== 1 ? 's' : ''}  ·  {fmt(total)}
          </Text>
        )}
      </View>
      {isOwnerOrManager && (
        <TouchableOpacity onPress={() => navigateToAdd(activePhaseId)} activeOpacity={0.7} style={styles.addButton}>
          <Feather name="plus" size={12} color={colors.primary} />
          <Text style={styles.addButtonLabel}>Add</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <>
        {sectionHeader}
        <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </>
    );
  }

  // ── Phase-grouped view (projects) ────────────────────────────────────────────
  if (phases && phases.length > 0) {
    const sortedPhases = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);

    const byPhase = new Map<string | null, SectionExpense[]>();
    byPhase.set(null, []);
    for (const ph of sortedPhases) byPhase.set(ph.id, []);
    for (const e of expenses) {
      const key = e.phaseId ?? null;
      (byPhase.get(byPhase.has(key) ? key : null)!).push(e);
    }

    const unassigned = byPhase.get(null) ?? [];

    // Only render a phase card if it has expenses OR is the active/in-progress phase
    const activePh = sortedPhases.find(p => p.id === activePhaseId)
      ?? sortedPhases.find(p => p.status === 'in_progress')
      ?? sortedPhases.find(p => p.status === 'not_started');
    const phasesToShow = sortedPhases.filter(ph => {
      const hasExpenses = (byPhase.get(ph.id) ?? []).length > 0;
      return hasExpenses || ph.id === activePh?.id;
    });

    return (
      <>
        {sectionHeader}

        {phasesToShow.map(phase => {
          const phaseExpenses = byPhase.get(phase.id) ?? [];
          const phaseCost = phaseExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
          const sc = PHASE_STATUS_COLORS[phase.status] ?? PHASE_STATUS_COLORS.not_started;
          const label = PHASE_STATUS_LABELS[phase.status] ?? phase.status;

          return (
            <View key={phase.id} style={{
              backgroundColor: colors.card,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              marginBottom: spacing.md,
              overflow: 'hidden',
              ...shadows.sm,
            }}>
              {/* Phase header */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm + 2,
                backgroundColor: `${sc.dot}10`,
                borderBottomWidth: phaseExpenses.length > 0 ? StyleSheet.hairlineWidth : 0,
                borderBottomColor: colors.border,
              }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sc.dot }} />
                <Text style={{ fontSize: 13, fontWeight: fontWeights.semibold as any, color: colors.foreground, flex: 1 }} numberOfLines={1}>
                  {phase.phaseCode ? `${phase.phaseCode} · ` : ''}{phase.name}
                </Text>
                {phaseCost > 0 && (
                  <Text style={{ fontSize: 12, fontWeight: fontWeights.semibold as any, color: colors.destructive }}>
                    -{fmt(phaseCost)}
                  </Text>
                )}
                <View style={{ backgroundColor: sc.badge, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                  <Text style={{ fontSize: 10, fontWeight: fontWeights.semibold as any, color: sc.text }}>{label}</Text>
                </View>
                {isOwnerOrManager && (
                  <TouchableOpacity onPress={() => navigateToAdd(phase.id)} activeOpacity={0.7} style={{ padding: 4 }}>
                    <Feather name="plus" size={14} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Expenses for this phase */}
              {phaseExpenses.map(renderRow)}
            </View>
          );
        })}

        {/* Unassigned */}
        {unassigned.length > 0 && (
          <View style={{
            backgroundColor: colors.card,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            marginBottom: spacing.md,
            overflow: 'hidden',
            ...shadows.sm,
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm + 2,
              backgroundColor: colors.muted,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
            }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border }} />
              <Text style={{ fontSize: 13, fontWeight: fontWeights.semibold as any, color: colors.mutedForeground, flex: 1 }}>
                Unassigned
              </Text>
              <Text style={{ fontSize: 12, fontWeight: fontWeights.semibold as any, color: colors.destructive }}>
                -{fmt(unassigned.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0))}
              </Text>
            </View>
            {unassigned.map(renderRow)}
          </View>
        )}

        {/* Empty state */}
        {expenses.length === 0 && (
          <View style={{
            backgroundColor: colors.card,
            borderRadius: radius.xl,
            padding: spacing.xl,
            marginBottom: spacing.xl,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.cardBorder,
            ...shadows.sm,
          }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${colors.primary}10`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
              <Feather name="file-text" size={24} color={colors.mutedForeground} />
            </View>
            <Text style={{ ...typography.body, color: colors.mutedForeground, textAlign: 'center' }}>
              No expenses recorded
            </Text>
            <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.md }}>
              Track receipts and site costs against each phase
            </Text>
          </View>
        )}
      </>
    );
  }

  // ── Flat view (service calls) ────────────────────────────────────────────────
  return (
    <>
      {sectionHeader}
      {expenses.length === 0 ? (
        <View style={{
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          padding: spacing.xl,
          marginBottom: spacing.xl,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}>
          <Feather name="file-text" size={24} color={colors.mutedForeground} style={{ marginBottom: spacing.sm }} />
          <Text style={{ ...typography.body, color: colors.mutedForeground }}>No expenses recorded</Text>
        </View>
      ) : (
        <View style={{
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          marginBottom: spacing.md,
          overflow: 'hidden',
          ...shadows.sm,
        }}>
          {expenses.map(renderRow)}
        </View>
      )}
    </>
  );
}
