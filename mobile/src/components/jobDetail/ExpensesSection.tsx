import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SkeletonSection } from '../Skeleton';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ThemeColors } from '../../lib/theme';
import { spacing, radius, typography, fontWeights, shadows } from '../../lib/design-tokens';
import { api } from '../../lib/api';
import { showToast } from '../../lib/toast';
import AppBottomSheet from '../ui/AppBottomSheet';
import PressableRow from '../ui/PressableRow';

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
  onRefresh?: () => void | Promise<void>;
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

  const [editingExpense, setEditingExpense] = useState<SectionExpense | null>(null);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [isSavingExpense, setIsSavingExpense] = useState(false);

  const openEditExpense = useCallback((expense: SectionExpense) => {
    setEditingExpense(expense);
    setEditingPhaseId(expense.phaseId ?? null);
  }, []);

  const closeEditExpense = useCallback(() => {
    if (isSavingExpense) return;
    setEditingExpense(null);
    setEditingPhaseId(null);
  }, [isSavingExpense]);

  const handleSaveExpense = useCallback(async () => {
    if (!editingExpense || isSavingExpense) return;

    setIsSavingExpense(true);
    try {
      const response = await api.put(`/api/expenses/${editingExpense.id}`, {
        phaseId: editingPhaseId,
      });
      if (response.error) {
        throw new Error(response.error);
      }

      setEditingExpense(null);
      setEditingPhaseId(null);
      await onRefresh?.();
      showToast({ type: 'success', message: 'Expense updated', description: 'The expense phase was updated.' });
    } catch (error: any) {
      showToast({
        type: 'error',
        message: 'Could not update expense',
        description: error?.message || 'Please try again.',
      });
    } finally {
      setIsSavingExpense(false);
    }
  }, [editingExpense, editingPhaseId, isSavingExpense, onRefresh]);

  const sortedPhases = phases ? [...phases].sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const selectedPhaseName = editingPhaseId
    ? sortedPhases.find((phase) => phase.id === editingPhaseId)?.name ?? 'Unassigned'
    : 'Unassigned';
  const editSheet = (
    <AppBottomSheet
      visible={editingExpense !== null}
      onDismiss={closeEditExpense}
      title="Edit Expense"
      showCloseButton
      snapPoints={['62%']}
      footer={(
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TouchableOpacity
            onPress={closeEditExpense}
            disabled={isSavingExpense}
            activeOpacity={0.7}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: spacing.md,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: fontWeights.semibold as any, color: colors.foreground }}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="expense-edit-save"
            onPress={handleSaveExpense}
            disabled={isSavingExpense}
            activeOpacity={0.7}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: isSavingExpense ? colors.muted : colors.primary,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: fontWeights.semibold as any, color: isSavingExpense ? colors.mutedForeground : colors.primaryForeground }}>
              {isSavingExpense ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    >
      {editingExpense && (
        <View style={{ gap: spacing.md }}>
          <View style={{
            padding: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: colors.muted,
          }}>
            <Text style={{ ...typography.bodySemibold, color: colors.foreground }} numberOfLines={2}>
              {editingExpense.description}
            </Text>
            <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.xs }}>
              -{fmt(editingExpense.amount)}
              {editingExpense.vendor ? `  ·  ${editingExpense.vendor}` : ''}
            </Text>
          </View>

          <Text style={{ ...typography.caption, color: colors.foreground, fontWeight: fontWeights.semibold }}>
            PHASE
          </Text>
          <View style={{ gap: spacing.xs }}>
            <PressableRow
              testID="expense-phase-option-unassigned"
              onPress={() => setEditingPhaseId(null)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: spacing.md,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: editingPhaseId === null ? colors.primary : colors.cardBorder,
                backgroundColor: editingPhaseId === null ? colors.primaryLight : colors.card,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Feather name="minus-circle" size={17} color={editingPhaseId === null ? colors.primary : colors.mutedForeground} />
                <Text style={{ ...typography.body, color: colors.foreground }}>Unassigned</Text>
              </View>
              {editingPhaseId === null && <Feather name="check" size={18} color={colors.primary} />}
            </PressableRow>

            {sortedPhases.map((phase) => {
              const isSelected = editingPhaseId === phase.id;
              return (
                <PressableRow
                  key={phase.id}
                  testID={`expense-phase-option-${phase.id}`}
                  onPress={() => setEditingPhaseId(phase.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: spacing.md,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.primary : colors.cardBorder,
                    backgroundColor: isSelected ? colors.primaryLight : colors.card,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isSelected ? colors.primary : colors.mutedForeground }} />
                    <Text style={{ ...typography.body, color: colors.foreground, flex: 1 }} numberOfLines={1}>
                      {phase.phaseCode ? `${phase.phaseCode} · ` : ''}{phase.name}
                    </Text>
                  </View>
                  {isSelected && <Feather name="check" size={18} color={colors.primary} />}
                </PressableRow>
              );
            })}
          </View>
          <Text style={{ ...typography.caption, color: colors.mutedForeground }}>
            Current phase: {selectedPhaseName}
          </Text>
        </View>
      )}
    </AppBottomSheet>
  );

  const total = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  // ── Expense row ─────────────────────────────────────────────────────────────
  const renderRow = useCallback((expense: SectionExpense) => (
    <TouchableOpacity
      key={expense.id}
      testID={`expense-row-${expense.id}`}
      activeOpacity={0.7}
      onPress={() => {
        if (isOwnerOrManager) {
          openEditExpense(expense);
        } else {
          router.push(`/more/expenses?jobId=${jobId}` as any);
        }
      }}
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
  ), [colors, isOwnerOrManager, jobId, openEditExpense]);

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
        {editSheet}
        <SkeletonSection rows={3} />
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
        {editSheet}

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
      {editSheet}
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
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${colors.primary}10`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
            <Feather name="file-text" size={24} color={colors.mutedForeground} />
          </View>
          <Text style={{ ...typography.body, color: colors.mutedForeground, textAlign: 'center' }}>No expenses recorded</Text>
          <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.xs, textAlign: 'center' }}>
            Track receipts and site costs here
          </Text>
          {isOwnerOrManager && (
            <TouchableOpacity
              onPress={() => navigateToAdd(null)}
              activeOpacity={0.7}
              style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${colors.primary}12`, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: `${colors.primary}25` }}
            >
              <Feather name="plus" size={14} color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>Add Expense</Text>
            </TouchableOpacity>
          )}
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
