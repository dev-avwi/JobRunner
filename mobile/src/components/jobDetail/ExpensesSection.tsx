import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Switch,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SkeletonSection } from '../Skeleton';
import { Feather } from '@expo/vector-icons';
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
  submittedByUserId?: string | null;
  rejectionReason?: string | null;
}

export interface PhaseStub {
  id: string;
  name: string;
  phaseCode?: string | null;
  status: string;
  sortOrder: number;
}

interface ExpenseCategory {
  id: string;
  name: string;
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

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
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
    input: {
      backgroundColor: colors.muted,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: 15,
      color: colors.foreground,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: fontWeights.semibold as any,
      color: colors.mutedForeground,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginBottom: spacing.xs,
    },
  });

  // ── Approval sheet state ─────────────────────────────────────────────────────

  const [reviewingExpense, setReviewingExpense] = useState<SectionExpense | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  const openApprovalSheet = useCallback((expense: SectionExpense) => {
    setReviewingExpense(expense);
    setRejectMode(false);
    setRejectionReason('');
  }, []);

  const closeApprovalSheet = useCallback(() => {
    if (isSubmittingDecision) return;
    setReviewingExpense(null);
    setRejectMode(false);
    setRejectionReason('');
  }, [isSubmittingDecision]);

  const handleApproveExpense = useCallback(async () => {
    if (!reviewingExpense || isSubmittingDecision) return;
    setIsSubmittingDecision(true);
    try {
      const response = await api.patch(`/api/expenses/${reviewingExpense.id}/status`, { status: 'approved' });
      if (response.error) throw new Error(response.error);
      setReviewingExpense(null);
      await onRefresh?.();
      showToast({ type: 'success', message: 'Expense approved', description: 'The expense has been approved.' });
    } catch (error: any) {
      showToast({ type: 'error', message: 'Could not approve expense', description: error?.message || 'Please try again.' });
    } finally {
      setIsSubmittingDecision(false);
    }
  }, [reviewingExpense, isSubmittingDecision, onRefresh]);

  const handleRejectExpense = useCallback(async () => {
    if (!reviewingExpense || isSubmittingDecision) return;
    setIsSubmittingDecision(true);
    try {
      const response = await api.patch(`/api/expenses/${reviewingExpense.id}/status`, {
        status: 'rejected',
        rejectionReason: rejectionReason.trim() || undefined,
      });
      if (response.error) throw new Error(response.error);
      setReviewingExpense(null);
      setRejectMode(false);
      setRejectionReason('');
      await onRefresh?.();
      showToast({ type: 'success', message: 'Expense rejected' });
    } catch (error: any) {
      showToast({ type: 'error', message: 'Could not reject expense', description: error?.message || 'Please try again.' });
    } finally {
      setIsSubmittingDecision(false);
    }
  }, [reviewingExpense, rejectionReason, isSubmittingDecision, onRefresh]);

  // ── Edit expense sheet state ─────────────────────────────────────────────────

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

  // ── Add expense sheet state ──────────────────────────────────────────────────

  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [addPhaseId, setAddPhaseId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    description: '',
    amount: '',
    vendor: '',
    expenseDate: todayIso(),
    isBillable: true,
    categoryId: '',
  });
  const [addCategories, setAddCategories] = useState<ExpenseCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isSavingAdd, setIsSavingAdd] = useState(false);

  // Date picker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState(new Date());

  // Fetch categories whenever the add sheet opens
  useEffect(() => {
    if (!addSheetVisible) return;
    setIsLoadingCategories(true);
    api.get('/api/expense-categories').then((res: any) => {
      const list: ExpenseCategory[] = Array.isArray(res) ? res : [];
      setAddCategories(list);
      // Auto-select first category if none chosen yet
      if (list.length > 0) {
        setAddForm(f => ({ ...f, categoryId: f.categoryId || list[0].id }));
      }
    }).finally(() => setIsLoadingCategories(false));
  }, [addSheetVisible]);

  const openAddSheet = useCallback((phaseId?: string | null) => {
    const today = new Date();
    setAddPhaseId(phaseId ?? null);
    setAddForm({
      description: '',
      amount: '',
      vendor: '',
      expenseDate: todayIso(),
      isBillable: true,
      categoryId: '',
    });
    setDatePickerValue(today);
    setShowDatePicker(false);
    setAddSheetVisible(true);
  }, []);

  const closeAddSheet = useCallback(() => {
    if (isSavingAdd) return;
    setAddSheetVisible(false);
  }, [isSavingAdd]);

  const handleAddExpense = useCallback(async () => {
    if (!addForm.description.trim()) {
      showToast({ type: 'error', message: 'Description required' });
      return;
    }
    if (!addForm.amount || isNaN(parseFloat(addForm.amount))) {
      showToast({ type: 'error', message: 'Enter a valid amount' });
      return;
    }
    if (!addForm.categoryId) {
      showToast({ type: 'error', message: 'Select a category' });
      return;
    }

    setIsSavingAdd(true);
    try {
      const body: Record<string, any> = {
        jobId,
        description: addForm.description.trim(),
        amount: addForm.amount,
        categoryId: addForm.categoryId,
        expenseDate: addForm.expenseDate,
        isBillable: addForm.isBillable,
      };
      if (addPhaseId) body.phaseId = addPhaseId;
      if (addForm.vendor.trim()) body.vendor = addForm.vendor.trim();

      const response = await api.post('/api/expenses', body);
      if (response.error) throw new Error(response.error);

      setAddSheetVisible(false);
      await onRefresh?.();
      showToast({ type: 'success', message: 'Expense added' });
    } catch (error: any) {
      showToast({
        type: 'error',
        message: 'Could not add expense',
        description: error?.message || 'Please try again.',
      });
    } finally {
      setIsSavingAdd(false);
    }
  }, [addForm, addPhaseId, jobId, onRefresh]);

  const onDatePickerChange = useCallback((_event: any, selected?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selected) {
      setDatePickerValue(selected);
      setAddForm(f => ({ ...f, expenseDate: selected.toISOString().split('T')[0] }));
    }
  }, []);

  // ── Shared sorted phases ─────────────────────────────────────────────────────

  const sortedPhases = phases ? [...phases].sort((a, b) => a.sortOrder - b.sortOrder) : [];

  // ── Approval sheet ───────────────────────────────────────────────────────────

  const approvalSheet = (
    <AppBottomSheet
      visible={reviewingExpense !== null}
      onDismiss={closeApprovalSheet}
      title={rejectMode ? 'Reject Expense' : 'Review Expense'}
      showCloseButton
      snapPoints={rejectMode ? ['55%'] : ['45%']}
      footer={
        rejectMode ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => setRejectMode(false)}
              disabled={isSubmittingDecision}
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
                Back
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="expense-confirm-reject"
              onPress={handleRejectExpense}
              disabled={isSubmittingDecision}
              activeOpacity={0.7}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: spacing.md,
                borderRadius: radius.lg,
                backgroundColor: isSubmittingDecision ? colors.muted : colors.destructive,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: fontWeights.semibold as any, color: isSubmittingDecision ? colors.mutedForeground : '#fff' }}>
                {isSubmittingDecision ? 'Rejecting...' : 'Reject'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity
              testID="expense-reject-btn"
              onPress={() => setRejectMode(true)}
              disabled={isSubmittingDecision}
              activeOpacity={0.7}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: spacing.md,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.destructive,
                backgroundColor: `${colors.destructive}10`,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: fontWeights.semibold as any, color: colors.destructive }}>
                Reject
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="expense-approve-btn"
              onPress={handleApproveExpense}
              disabled={isSubmittingDecision}
              activeOpacity={0.7}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: spacing.md,
                borderRadius: radius.lg,
                backgroundColor: isSubmittingDecision ? colors.muted : '#16a34a',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: fontWeights.semibold as any, color: isSubmittingDecision ? colors.mutedForeground : '#fff' }}>
                {isSubmittingDecision ? 'Approving...' : 'Approve'}
              </Text>
            </TouchableOpacity>
          </View>
        )
      }
    >
      {reviewingExpense && (
        <View style={{ gap: spacing.md }}>
          {/* Expense summary */}
          <View style={{
            padding: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: colors.muted,
          }}>
            <Text style={{ ...typography.bodySemibold, color: colors.foreground }} numberOfLines={2}>
              {reviewingExpense.description}
            </Text>
            <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.xs }}>
              {fmt(reviewingExpense.amount)}
              {reviewingExpense.vendor ? `  ·  ${reviewingExpense.vendor}` : ''}
              {`  ·  ${fmtDate(reviewingExpense.expenseDate)}`}
            </Text>
          </View>

          {rejectMode ? (
            <View>
              <Text style={styles.fieldLabel}>Reason (optional)</Text>
              <TextInput
                style={[styles.input, { minHeight: 80, textAlignVertical: 'top', paddingTop: spacing.sm }]}
                placeholder="Why is this expense being rejected?"
                placeholderTextColor={colors.mutedForeground}
                value={rejectionReason}
                onChangeText={setRejectionReason}
                multiline
                autoCapitalize="sentences"
                returnKeyType="done"
              />
            </View>
          ) : (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              padding: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: '#fef3c7',
              borderWidth: 1,
              borderColor: '#fde68a',
            }}>
              <Feather name="clock" size={16} color="#92400e" />
              <Text style={{ fontSize: 13, color: '#92400e', flex: 1 }}>
                This expense is pending your approval.
              </Text>
            </View>
          )}
        </View>
      )}
    </AppBottomSheet>
  );

  // ── Edit sheet ───────────────────────────────────────────────────────────────

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

  // ── Add sheet ────────────────────────────────────────────────────────────────

  const selectedCategoryName = addCategories.find(c => c.id === addForm.categoryId)?.name ?? '';
  const selectedAddPhaseName = addPhaseId
    ? sortedPhases.find(p => p.id === addPhaseId)?.name ?? 'Unassigned'
    : 'Unassigned';

  const addSheet = (
    <AppBottomSheet
      visible={addSheetVisible}
      onDismiss={closeAddSheet}
      title="Add Expense"
      showCloseButton
      snapPoints={['85%']}
      footer={(
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TouchableOpacity
            onPress={closeAddSheet}
            disabled={isSavingAdd}
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
            onPress={handleAddExpense}
            disabled={isSavingAdd}
            activeOpacity={0.7}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: spacing.md,
              borderRadius: radius.lg,
              backgroundColor: isSavingAdd ? colors.muted : colors.primary,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: fontWeights.semibold as any, color: isSavingAdd ? colors.mutedForeground : colors.primaryForeground }}>
              {isSavingAdd ? 'Adding...' : 'Add Expense'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ gap: spacing.lg }}>

            {/* Description */}
            <View>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={styles.input}
                placeholder="What was this expense for?"
                placeholderTextColor={colors.mutedForeground}
                value={addForm.description}
                onChangeText={t => setAddForm(f => ({ ...f, description: t }))}
                returnKeyType="next"
                autoCapitalize="sentences"
              />
            </View>

            {/* Amount */}
            <View>
              <Text style={styles.fieldLabel}>Amount</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  backgroundColor: colors.muted,
                  borderWidth: 1,
                  borderRightWidth: 0,
                  borderColor: colors.cardBorder,
                  borderTopLeftRadius: radius.lg,
                  borderBottomLeftRadius: radius.lg,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm + 2,
                }}>
                  <Text style={{ fontSize: 15, color: colors.mutedForeground, fontWeight: fontWeights.medium as any }}>$</Text>
                </View>
                <TextInput
                  style={[styles.input, { flex: 1, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  value={addForm.amount}
                  onChangeText={t => setAddForm(f => ({ ...f, amount: t.replace(/[^0-9.]/g, '') }))}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
            </View>

            {/* Category */}
            <View>
              <Text style={styles.fieldLabel}>Category</Text>
              {isLoadingCategories ? (
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  {[80, 100, 70].map(w => (
                    <View key={w} style={{ width: w, height: 34, borderRadius: radius.md, backgroundColor: colors.muted }} />
                  ))}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                    {addCategories.map(cat => {
                      const isSelected = addForm.categoryId === cat.id;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          onPress={() => setAddForm(f => ({ ...f, categoryId: cat.id }))}
                          activeOpacity={0.7}
                          style={{
                            paddingHorizontal: spacing.md,
                            paddingVertical: spacing.sm,
                            borderRadius: radius.full ?? 999,
                            borderWidth: 1,
                            borderColor: isSelected ? colors.primary : colors.cardBorder,
                            backgroundColor: isSelected ? colors.primaryLight : colors.muted,
                          }}
                        >
                          <Text style={{
                            fontSize: 13,
                            fontWeight: (isSelected ? fontWeights.semibold : fontWeights.medium) as any,
                            color: isSelected ? colors.primary : colors.mutedForeground,
                          }}>
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </View>

            {/* Date */}
            <View>
              <Text style={styles.fieldLabel}>Date</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
                style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              >
                <Text style={{ fontSize: 15, color: colors.foreground }}>
                  {fmtDate(addForm.expenseDate)}
                </Text>
                <Feather name="calendar" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              {showDatePicker && (
                <View style={{
                  marginTop: spacing.xs,
                  backgroundColor: colors.card,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  overflow: 'hidden',
                }}>
                  <DateTimePicker
                    value={datePickerValue}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDatePickerChange}
                    maximumDate={new Date()}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      onPress={() => setShowDatePicker(false)}
                      style={{
                        alignItems: 'center',
                        paddingVertical: spacing.sm,
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 15, fontWeight: fontWeights.semibold as any, color: colors.primary }}>
                        Done
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Vendor (optional) */}
            <View>
              <Text style={styles.fieldLabel}>Vendor (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Supplier or vendor name"
                placeholderTextColor={colors.mutedForeground}
                value={addForm.vendor}
                onChangeText={t => setAddForm(f => ({ ...f, vendor: t }))}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>

            {/* Phase — only shown on projects with phases */}
            {sortedPhases.length > 0 && (
              <View>
                <Text style={styles.fieldLabel}>Phase</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                    {/* Unassigned pill */}
                    <TouchableOpacity
                      onPress={() => setAddPhaseId(null)}
                      activeOpacity={0.7}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.full ?? 999,
                        borderWidth: 1,
                        borderColor: addPhaseId === null ? colors.primary : colors.cardBorder,
                        backgroundColor: addPhaseId === null ? colors.primaryLight : colors.muted,
                      }}
                    >
                      <Text style={{
                        fontSize: 13,
                        fontWeight: (addPhaseId === null ? fontWeights.semibold : fontWeights.medium) as any,
                        color: addPhaseId === null ? colors.primary : colors.mutedForeground,
                      }}>
                        Unassigned
                      </Text>
                    </TouchableOpacity>

                    {sortedPhases.map(phase => {
                      const isSelected = addPhaseId === phase.id;
                      return (
                        <TouchableOpacity
                          key={phase.id}
                          onPress={() => setAddPhaseId(phase.id)}
                          activeOpacity={0.7}
                          style={{
                            paddingHorizontal: spacing.md,
                            paddingVertical: spacing.sm,
                            borderRadius: radius.full ?? 999,
                            borderWidth: 1,
                            borderColor: isSelected ? colors.primary : colors.cardBorder,
                            backgroundColor: isSelected ? colors.primaryLight : colors.muted,
                          }}
                        >
                          <Text style={{
                            fontSize: 13,
                            fontWeight: (isSelected ? fontWeights.semibold : fontWeights.medium) as any,
                            color: isSelected ? colors.primary : colors.mutedForeground,
                          }} numberOfLines={1}>
                            {phase.phaseCode ? `${phase.phaseCode} · ` : ''}{phase.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Billable toggle */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: colors.muted,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm + 2,
            }}>
              <View>
                <Text style={{ fontSize: 15, color: colors.foreground, fontWeight: fontWeights.medium as any }}>
                  Billable to client
                </Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 1 }}>
                  Include in client invoice
                </Text>
              </View>
              <Switch
                value={addForm.isBillable}
                onValueChange={v => setAddForm(f => ({ ...f, isBillable: v }))}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={Platform.OS === 'android' ? (addForm.isBillable ? colors.primaryForeground : colors.mutedForeground) : undefined}
              />
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBottomSheet>
  );

  // Exclude rejected expenses from totals — they are struck through and not counted
  const total = expenses.reduce((s, e) => e.status === 'rejected' ? s : s + (parseFloat(e.amount) || 0), 0);

  // ── Expense row ─────────────────────────────────────────────────────────────
  const renderRow = useCallback((expense: SectionExpense) => {
    const isPending = expense.status === 'pending';
    const isRejected = expense.status === 'rejected';
    // Worker-submitted: either the new submittedByUserId field OR the legacy "[Logged by …]" prefix
    const isWorkerSubmitted = !!expense.submittedByUserId || /^\[Logged by /i.test(expense.description ?? '');
    // Owners/managers can only approve/reject pending worker-submitted expenses
    const canReview = isOwnerOrManager && isPending && isWorkerSubmitted;

    return (
      <TouchableOpacity
        key={expense.id}
        testID={`expense-row-${expense.id}`}
        activeOpacity={canReview || (isOwnerOrManager && !isPending) ? 0.7 : 1}
        onPress={() => {
          if (canReview) {
            openApprovalSheet(expense);
          } else if (isOwnerOrManager && !isPending) {
            openEditExpense(expense);
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
          opacity: isRejected ? 0.5 : 1,
          backgroundColor: isPending ? `#f59e0b08` : undefined,
        }}
      >
        {/* Category badge + description */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3, flexWrap: 'wrap' }}>
            {expense.categoryName ? (
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
            ) : null}
            {isPending && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 3,
                backgroundColor: '#fef3c7', paddingHorizontal: 6,
                paddingVertical: 2, borderRadius: 8,
              }}>
                <Feather name="clock" size={9} color="#92400e" />
                <Text style={{ fontSize: 10, fontWeight: fontWeights.semibold as any, color: '#92400e' }}>
                  {isWorkerSubmitted ? 'Worker submitted' : 'Pending approval'}
                </Text>
              </View>
            )}
            {isRejected && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 3,
                backgroundColor: `${colors.destructive}15`, paddingHorizontal: 6,
                paddingVertical: 2, borderRadius: 8,
              }}>
                <Feather name="x-circle" size={9} color={colors.destructive} />
                <Text style={{ fontSize: 10, fontWeight: fontWeights.semibold as any, color: colors.destructive }}>
                  Rejected
                </Text>
              </View>
            )}
            {canReview && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 3,
                backgroundColor: colors.primaryLight, paddingHorizontal: 6,
                paddingVertical: 2, borderRadius: 8,
              }}>
                <Feather name="check-circle" size={9} color={colors.primary} />
                <Text style={{ fontSize: 10, fontWeight: fontWeights.semibold as any, color: colors.primary }}>
                  Tap to review
                </Text>
              </View>
            )}
          </View>
          <Text style={{
            fontSize: 13,
            fontWeight: fontWeights.medium as any,
            color: isRejected ? colors.mutedForeground : colors.foreground,
            textDecorationLine: isRejected ? 'line-through' : 'none',
          }} numberOfLines={1}>
            {expense.description}
          </Text>
          <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: 1 }} numberOfLines={1}>
            {[expense.vendor, fmtDate(expense.expenseDate)].filter(Boolean).join('  ·  ')}
          </Text>
          {isRejected && expense.rejectionReason ? (
            <Text style={{ fontSize: 11, color: colors.destructive, marginTop: 2 }} numberOfLines={1}>
              Reason: {expense.rejectionReason}
            </Text>
          ) : null}
        </View>

        {/* Amount */}
        <Text style={{
          fontSize: 13,
          fontWeight: fontWeights.semibold as any,
          color: isRejected ? colors.mutedForeground : colors.destructive,
          marginTop: 1,
          textDecorationLine: isRejected ? 'line-through' : 'none',
        }}>
          -{fmt(expense.amount)}
        </Text>
      </TouchableOpacity>
    );
  }, [colors, isOwnerOrManager, openApprovalSheet, openEditExpense]);

  // ── Card-style header — matches Claims / Variations section header pattern
  const cardHeader = (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    }}>
      <Feather name="credit-card" size={14} color={colors.mutedForeground} />
      <Text style={{ fontSize: 14, fontWeight: fontWeights.semibold as any, color: colors.foreground, flex: 1 }}>
        Expenses
      </Text>
      {expenses.length > 0 && (
        <View style={{ borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: colors.muted }}>
          <Text style={{ fontSize: 10, fontWeight: fontWeights.semibold as any, color: colors.mutedForeground }}>
            {expenses.length}
          </Text>
        </View>
      )}
      {expenses.length > 0 && (
        <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
          {fmt(total)}
        </Text>
      )}
      {isOwnerOrManager && (
        <TouchableOpacity onPress={() => openAddSheet(activePhaseId)} activeOpacity={0.7} style={{ marginLeft: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8 }}>
            <Feather name="plus" size={13} color={colors.primary} />
            <Text style={{ fontSize: 12, fontWeight: fontWeights.semibold as any, color: colors.primary }}>Add</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={{
        backgroundColor: colors.card,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        marginBottom: spacing.md,
        overflow: 'hidden',
        ...shadows.sm,
      }}>
        {cardHeader}
        {approvalSheet}
        {editSheet}
        {addSheet}
        <View style={{ padding: spacing.sm }}>
          <SkeletonSection rows={3} />
        </View>
      </View>
    );
  }

  // ── Phase-grouped view (projects) ────────────────────────────────────────────
  if (phases && phases.length > 0) {
    const sortedPhasesLocal = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);

    const byPhase = new Map<string | null, SectionExpense[]>();
    byPhase.set(null, []);
    for (const ph of sortedPhasesLocal) byPhase.set(ph.id, []);
    for (const e of expenses) {
      const key = e.phaseId ?? null;
      (byPhase.get(byPhase.has(key) ? key : null)!).push(e);
    }

    const unassigned = byPhase.get(null) ?? [];

    const activePh = sortedPhasesLocal.find(p => p.id === activePhaseId)
      ?? sortedPhasesLocal.find(p => p.status === 'in_progress')
      ?? sortedPhasesLocal.find(p => p.status === 'not_started');
    const phasesToShow = sortedPhasesLocal.filter(ph => {
      const hasExpenses = (byPhase.get(ph.id) ?? []).length > 0;
      return hasExpenses || ph.id === activePh?.id;
    });

    return (
      <>
        {approvalSheet}
        {editSheet}
        {addSheet}
        {/* One unified card — header + phase rows all connected, matching Claims/POs pattern */}
        <View style={{
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          marginBottom: spacing.md,
          overflow: 'hidden',
          ...shadows.sm,
        }}>
          {cardHeader}

          {expenses.length === 0 ? (
            /* Empty state inside the card */
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
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
          ) : (
            <>
              {phasesToShow.map(phase => {
                const phaseExpenses = byPhase.get(phase.id) ?? [];
                const phaseCost = phaseExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
                const sc = PHASE_STATUS_COLORS[phase.status] ?? PHASE_STATUS_COLORS.not_started;
                const label = PHASE_STATUS_LABELS[phase.status] ?? phase.status;

                return (
                  <View key={phase.id} style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
                    {/* Phase header row */}
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
                        <TouchableOpacity onPress={() => openAddSheet(phase.id)} activeOpacity={0.7} style={{ padding: 4 }}>
                          <Feather name="plus" size={14} color={colors.primary} />
                        </TouchableOpacity>
                      )}
                    </View>
                    {phaseExpenses.map(renderRow)}
                  </View>
                );
              })}

              {/* Unassigned bucket */}
              {unassigned.length > 0 && (
                <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
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
            </>
          )}
        </View>
      </>
    );
  }

  // ── Flat view (service calls) ─────────────────────────────────────────────────
  return (
    <>
      {approvalSheet}
      {editSheet}
      {addSheet}
      <View style={{
        backgroundColor: colors.card,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        marginBottom: spacing.md,
        overflow: 'hidden',
        ...shadows.sm,
      }}>
        {cardHeader}
        {expenses.length === 0 ? (
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${colors.primary}10`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
              <Feather name="file-text" size={24} color={colors.mutedForeground} />
            </View>
            <Text style={{ ...typography.body, color: colors.mutedForeground, textAlign: 'center' }}>No expenses recorded</Text>
            <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.xs, textAlign: 'center' }}>
              Track receipts and site costs here
            </Text>
            {isOwnerOrManager && (
              <TouchableOpacity
                onPress={() => openAddSheet(null)}
                activeOpacity={0.7}
                style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${colors.primary}12`, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: `${colors.primary}25` }}
              >
                <Feather name="plus" size={14} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>Add Expense</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          expenses.map(renderRow)
        )}
      </View>
    </>
  );
}
