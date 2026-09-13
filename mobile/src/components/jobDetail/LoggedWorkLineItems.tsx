/**
 * LoggedWorkLineItems
 *
 * Surfaces all work logged against a job (time, materials, approved expenses)
 * as editable line items, then lets owners draft an invoice or quote from them
 * in one tap.
 *
 * Owner/manager only — workers see none of this.
 */
import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../lib/store';
import { useTheme, ThemeColors } from '../../lib/theme';
import AppBottomSheet from '../ui/AppBottomSheet';
import { spacing, radius, typography, fontWeights } from '../../lib/design-tokens';
import { showToast } from '../../lib/toast';
import {
  DRAFT_LINE_ITEMS_KEY,
  computeLabourItems,
  computeMaterialItems,
  computeExpenseItems,
  type TimeEntryInput,
  type MaterialInput,
  type ExpenseInput,
  type ComputedLineItem,
} from '../../utils/loggedWorkLineItems';

// Re-export so invoice/quote screens can import from one place
export { DRAFT_LINE_ITEMS_KEY };

// ─── Types mirroring the parent's existing interfaces ────────────────────────

interface CompletedTimeEntry {
  id: string;
  userId: string;
  jobId?: string;
  description?: string;
  startTime: string;
  endTime?: string;
  /** Persisted duration in minutes — authoritative, accounts for paused time. */
  duration?: number | null;
  notes?: string;
  userName?: string;
  hourlyRate?: string;
  isBreak?: boolean;
  isPaused?: boolean;
  isBillable?: boolean;
}

interface JobMaterial {
  id: string;
  name: string;
  description?: string;
  /** PostgreSQL decimal — API returns string; accept both for cross-caller compatibility. */
  quantity: number | string | null;
  unitCost: number | string | null;
  totalCost?: number | string | null;
  unitPrice?: number | string | null;
  markupPercent?: number | string | null;
  supplier?: string;
  category?: string;
  status?: string;
}

interface JobExpense {
  id: string;
  jobId?: string | null;
  categoryId: string;
  categoryName?: string;
  amount: string;
  description: string;
  vendor?: string;
  expenseDate: string;
  isBillable: boolean;
  status?: string;
  submittedByUserId?: string | null;
}

interface Invoice {
  id: string;
  number: string;
  title: string;
  total: number;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'partial';
}

interface Quote {
  id: string;
  number: string;
  title: string;
  total: number;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';
}

// ─── Local alias for the shared ComputedLineItem type ────────────────────────

type DraftLineItem = ComputedLineItem;

interface Override {
  quantity?: string;
  unitPrice?: string;
  description?: string;
  deleted?: boolean;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  jobId: string;
  jobTitle?: string;
  isOwnerOrManager: boolean;
  invoice: Invoice | null;
  quote: Quote | null;
  clientId?: string;
  timeEntries: CompletedTimeEntry[];
  materials: JobMaterial[];
  jobExpenses: JobExpense[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  return `$${n.toFixed(2)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LoggedWorkLineItems({
  jobId,
  isOwnerOrManager,
  invoice,
  quote,
  clientId,
  timeEntries,
  materials,
  jobExpenses,
}: Props) {
  const { colors } = useTheme();
  const { businessSettings } = useAuthStore();
  const billBreaks = !!(businessSettings as any)?.billBreaks;

  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);

  // Use the business-configured material markup when available, matching the
  // invoice-prefill logic in invoice/new.tsx. The field is defaultMaterialMarkupPct
  // on the BusinessSettings contract (store.ts line 124). Falls back to the
  // utility default (20 %) when not set.
  const fallbackMarkupPercent = useMemo(() => {
    const raw = (businessSettings as any)?.defaultMaterialMarkupPct;
    const n = parseFloat(raw ?? '');
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }, [businessSettings]);

  const rawItems = useMemo<DraftLineItem[]>(() => [
    ...computeLabourItems(timeEntries, billBreaks),
    ...computeMaterialItems(materials, fallbackMarkupPercent),
    ...computeExpenseItems(jobExpenses),
  ], [timeEntries, materials, jobExpenses, billBreaks, fallbackMarkupPercent]);

  const activeItems = useMemo<DraftLineItem[]>(() => {
    return rawItems
      .filter((item) => !overrides[item.key]?.deleted)
      .map((item) => {
        const ov = overrides[item.key];
        if (!ov) return item;
        return {
          ...item,
          description: ov.description ?? item.description,
          quantity: ov.quantity !== undefined ? (Number.isFinite(parseFloat(ov.quantity)) ? parseFloat(ov.quantity) : item.quantity) : item.quantity,
          unitPrice: ov.unitPrice !== undefined ? (Number.isFinite(parseFloat(ov.unitPrice)) ? parseFloat(ov.unitPrice) : item.unitPrice) : item.unitPrice,
        };
      });
  }, [rawItems, overrides]);

  const labourItems = useMemo(() => activeItems.filter((i) => i.section === 'labour'), [activeItems]);
  const materialItems = useMemo(() => activeItems.filter((i) => i.section === 'materials'), [activeItems]);
  const expenseItems = useMemo(() => activeItems.filter((i) => i.section === 'expenses'), [activeItems]);

  const labourTotal = useMemo(() => labourItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0), [labourItems]);
  const materialsTotal = useMemo(() => materialItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0), [materialItems]);
  const expensesTotal = useMemo(() => expenseItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0), [expenseItems]);
  const grandTotal = labourTotal + materialsTotal + expensesTotal;

  const openEdit = useCallback((item: DraftLineItem) => {
    setEditingKey(item.key);
    setEditQty(String(item.quantity));
    setEditPrice(String(item.unitPrice));
    setEditDesc(item.description);
  }, []);

  const closeEdit = useCallback(() => setEditingKey(null), []);

  const saveEdit = useCallback(() => {
    if (!editingKey) return;
    setOverrides((prev) => ({
      ...prev,
      [editingKey]: {
        ...prev[editingKey],
        quantity: editQty.trim(),
        unitPrice: editPrice.trim(),
        description: editDesc.trim(),
      },
    }));
    setEditingKey(null);
  }, [editingKey, editQty, editPrice, editDesc]);

  const deleteItem = useCallback((key: string) => {
    setOverrides((prev) => ({ ...prev, [key]: { ...prev[key], deleted: true } }));
  }, []);

  const buildExportItems = useCallback(() =>
    activeItems.map((item) => ({
      id: item.key,
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
    })), [activeItems]);

  const handleDraft = useCallback(async (target: 'invoice' | 'quote') => {
    if (activeItems.length === 0) {
      showToast({ type: 'info', message: 'No line items', description: 'Log some time, materials, or expenses first.' });
      return;
    }
    try {
      setIsDrafting(true);
      await AsyncStorage.setItem(DRAFT_LINE_ITEMS_KEY(jobId), JSON.stringify(buildExportItems()));
      const clientParam = clientId ? `&clientId=${clientId}` : '';
      const path = target === 'invoice'
        ? `/more/invoice/new?jobId=${jobId}${clientParam}`
        : `/more/quote/new?jobId=${jobId}${clientParam}`;
      router.push(path as any);
    } catch {
      showToast({ type: 'error', message: 'Could not prepare draft' });
    } finally {
      setIsDrafting(false);
    }
  }, [activeItems, buildExportItems, jobId, clientId]);

  if (!isOwnerOrManager) return null;

  const styles = createStyles(colors);
  const editingItem = editingKey ? rawItems.find((i) => i.key === editingKey) ?? null : null;
  const isQuotable = !quote || ['draft', 'declined', 'expired'].includes(quote.status);
  const hasAnyDeleted = Object.values(overrides).some((o) => o.deleted);

  if (rawItems.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Feather name="file-text" size={20} color={colors.mutedForeground} />
        <Text style={styles.emptyText}>
          No work logged yet. Time entries, materials, and approved expenses will appear here.
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Line Items</Text>
          <Text style={styles.cardSubtitle}>Review before drafting an invoice or quote</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {invoice ? (
            // Any invoice (draft, sent, paid, etc.) — show View Invoice.
            // We never create a second invoice here; the owner opens the existing one.
            <TouchableOpacity
              testID="btn-view-invoice"
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
              onPress={() => router.push(`/more/invoice/${invoice.id}` as any)}
            >
              <Feather name="file-text" size={14} color={colors.primaryForeground} />
              <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>View Invoice</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="btn-draft-invoice"
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
              onPress={() => handleDraft('invoice')}
              disabled={isDrafting}
            >
              {isDrafting
                ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                : <Feather name="file-text" size={14} color={colors.primaryForeground} />}
              <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Draft Invoice</Text>
            </TouchableOpacity>
          )}
          {isQuotable && (
            <TouchableOpacity
              testID="btn-draft-quote"
              style={[styles.actionBtn, styles.actionBtnOutline, { borderColor: colors.buttonOutline }]}
              activeOpacity={0.8}
              onPress={() => handleDraft('quote')}
              disabled={isDrafting}
            >
              <Feather name="clipboard" size={14} color={colors.foreground} />
              <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Draft Quote</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Labour */}
        {labourItems.length > 0 && (
          <LineItemSection
            title="Labour"
            icon="clock"
            items={labourItems}
            total={labourTotal}
            colors={colors}
            styles={styles}
            onEdit={openEdit}
            onDelete={deleteItem}
          />
        )}

        {/* Materials */}
        {materialItems.length > 0 && (
          <LineItemSection
            title="Materials"
            icon="package"
            items={materialItems}
            total={materialsTotal}
            colors={colors}
            styles={styles}
            onEdit={openEdit}
            onDelete={deleteItem}
          />
        )}

        {/* Expenses (approved only) */}
        {expenseItems.length > 0 && (
          <LineItemSection
            title="Expenses (approved)"
            icon="dollar-sign"
            items={expenseItems}
            total={expensesTotal}
            colors={colors}
            styles={styles}
            onEdit={openEdit}
            onDelete={deleteItem}
          />
        )}

        {/* Totals footer */}
        <View style={styles.totalsContainer}>
          {labourItems.length > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Labour</Text>
              <Text style={[styles.totalValue, { color: colors.foreground }]}>{formatCurrency(labourTotal)}</Text>
            </View>
          )}
          {materialItems.length > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Materials</Text>
              <Text style={[styles.totalValue, { color: colors.foreground }]}>{formatCurrency(materialsTotal)}</Text>
            </View>
          )}
          {expenseItems.length > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Expenses</Text>
              <Text style={[styles.totalValue, { color: colors.foreground }]}>{formatCurrency(expensesTotal)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(grandTotal)}</Text>
          </View>
        </View>

        {/* Restore hint when items have been deleted */}
        {hasAnyDeleted && (
          <TouchableOpacity
            style={styles.restoreHint}
            onPress={() => setOverrides({})}
            activeOpacity={0.7}
          >
            <Feather name="rotate-ccw" size={12} color={colors.mutedForeground} />
            <Text style={[styles.restoreText, { color: colors.mutedForeground }]}>Restore removed items</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Edit bottom sheet */}
      <AppBottomSheet
        visible={!!editingKey}
        onDismiss={closeEdit}
        title={editingItem ? `Edit: ${editingItem.description}` : 'Edit Line Item'}
        snapPoints={['55%']}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Description</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
            value={editDesc}
            onChangeText={setEditDesc}
            placeholder="Description"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={[styles.inputLabel, { color: colors.mutedForeground, marginTop: spacing.md }]}>
            Quantity / Hours
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
            value={editQty}
            onChangeText={setEditQty}
            keyboardType="decimal-pad"
            placeholder="1"
            placeholderTextColor={colors.mutedForeground}
          />

          <Text style={[styles.inputLabel, { color: colors.mutedForeground, marginTop: spacing.md }]}>Unit Price</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
            value={editPrice}
            onChangeText={setEditPrice}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.mutedForeground}
          />

          {!!editQty && !!editPrice && (
            <Text style={[styles.editSubtotal, { color: colors.mutedForeground }]}>
              Subtotal: {formatCurrency((parseFloat(editQty) || 0) * (parseFloat(editPrice) || 0))}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.saveEditBtn, { backgroundColor: colors.primary }]}
            onPress={saveEdit}
            activeOpacity={0.8}
          >
            <Text style={[styles.saveEditBtnText, { color: colors.primaryForeground }]}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelEditBtn} onPress={closeEdit} activeOpacity={0.7}>
            <Text style={[styles.cancelEditBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </AppBottomSheet>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  icon: string;
  items: DraftLineItem[];
  total: number;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  onEdit: (item: DraftLineItem) => void;
  onDelete: (key: string) => void;
}

function LineItemSection({ title, icon, items, colors, styles, onEdit, onDelete }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Feather name={icon as any} size={12} color={colors.mutedForeground} />
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      </View>
      {items.map((item) => (
        <LineItemRow key={item.key} item={item} colors={colors} styles={styles} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </View>
  );
}

interface RowProps {
  item: DraftLineItem;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  onEdit: (item: DraftLineItem) => void;
  onDelete: (key: string) => void;
}

function LineItemRow({ item, colors, styles, onEdit, onDelete }: RowProps) {
  const subtotal = item.quantity * item.unitPrice;
  const hasRate = item.unitPrice > 0;
  const unitLabel = item.section === 'labour' ? 'hrs' : item.section === 'materials' ? ' units' : '';
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={[styles.rowDesc, { color: colors.foreground }]} numberOfLines={2}>
          {item.description}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
          {item.quantity}{unitLabel}
          {hasRate ? ` \u00d7 ${formatCurrency(item.unitPrice)}` : ' (rate not set)'}
        </Text>
      </View>
      <View style={styles.rowActions}>
        <Text style={[styles.rowSubtotal, { color: hasRate ? colors.foreground : colors.mutedForeground }]}>
          {hasRate ? formatCurrency(subtotal) : '\u2014'}
        </Text>
        <TouchableOpacity
          onPress={() => onEdit(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
          activeOpacity={0.7}
        >
          <Feather name="edit-2" size={14} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDelete(item.key)}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
          activeOpacity={0.7}
        >
          <Feather name="x" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    cardHeader: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    cardTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    cardSubtitle: {
      fontSize: typography.sizes.xs,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    actionRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: 10,
      borderRadius: radius.md,
    },
    actionBtnOutline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
    },
    actionBtnText: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.semibold,
    },
    section: {
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.xs,
    },
    sectionTitle: {
      fontSize: typography.sizes.xs,
      fontWeight: fontWeights.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    rowMain: {
      flex: 1,
      marginRight: spacing.sm,
    },
    rowDesc: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.medium,
    },
    rowMeta: {
      fontSize: typography.sizes.xs,
      marginTop: 2,
    },
    rowActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    rowSubtotal: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.semibold,
      minWidth: 56,
      textAlign: 'right',
    },
    totalsContainer: {
      padding: spacing.md,
      gap: spacing.xs,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    totalLabel: {
      fontSize: typography.sizes.sm,
    },
    totalValue: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.semibold,
    },
    grandTotalRow: {
      marginTop: spacing.xs,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    grandTotalLabel: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.bold,
      color: colors.foreground,
    },
    grandTotalValue: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.bold,
      color: colors.foreground,
    },
    restoreHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    restoreText: {
      fontSize: typography.sizes.xs,
      textDecorationLine: 'underline',
    },
    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: spacing.md,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    emptyText: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.mutedForeground,
    },
    // Edit sheet
    inputLabel: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.medium,
      marginBottom: spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      fontSize: typography.sizes.sm,
    },
    editSubtotal: {
      fontSize: typography.sizes.sm,
      textAlign: 'right',
      marginTop: spacing.sm,
    },
    saveEditBtn: {
      marginTop: spacing.lg,
      paddingVertical: 12,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    saveEditBtnText: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.semibold,
    },
    cancelEditBtn: {
      marginTop: spacing.sm,
      paddingVertical: 10,
      alignItems: 'center',
    },
    cancelEditBtnText: {
      fontSize: typography.sizes.sm,
    },
  });
}
