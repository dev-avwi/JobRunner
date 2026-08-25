import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography, fontWeights, pageShell } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { getBottomNavHeight } from '../../src/components/BottomNav';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MyExpense {
  id: string;
  jobId: string | null;
  jobTitle: string | null;
  categoryId: string;
  categoryName: string | null;
  amount: string;
  gstAmount: string | null;
  description: string;
  vendor: string | null;
  expenseDate: string;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: string | number): string {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `$${(isNaN(n) ? 0 : n).toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending:  { label: 'Pending',  bg: '#fef3c7', text: '#92400e' },
  approved: { label: 'Approved', bg: '#dcfce7', text: '#14532d' },
  rejected: { label: 'Rejected', bg: '#fee2e2', text: '#7f1d1d' },
};

function StatusBadge({ status, colors }: { status: string; colors: ThemeColors }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: colors.muted, text: colors.mutedForeground };
  return (
    <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 }}>
      <Text style={{ fontSize: 11, fontWeight: fontWeights.semibold as any, color: cfg.text }}>
        {cfg.label}
      </Text>
    </View>
  );
}

// ── Expense row ───────────────────────────────────────────────────────────────

function ExpenseRow({ expense, colors, styles }: { expense: MyExpense; colors: ThemeColors; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.card}>
      {/* Header: amount + status */}
      <View style={styles.cardHeader}>
        <Text style={[styles.amount, { color: colors.foreground }]}>{fmt(expense.amount)}</Text>
        <StatusBadge status={expense.status} colors={colors} />
      </View>

      {/* Description */}
      <Text style={[styles.description, { color: colors.foreground }]} numberOfLines={2}>
        {expense.description}
      </Text>

      {/* Meta row */}
      <View style={styles.meta}>
        {expense.jobTitle ? (
          <View style={styles.metaChip}>
            <Feather name="briefcase" size={11} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {expense.jobTitle}
            </Text>
          </View>
        ) : null}
        {expense.categoryName ? (
          <View style={styles.metaChip}>
            <Feather name="tag" size={11} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{expense.categoryName}</Text>
          </View>
        ) : null}
        <View style={styles.metaChip}>
          <Feather name="calendar" size={11} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{fmtDate(expense.expenseDate)}</Text>
        </View>
      </View>

      {/* Rejection reason */}
      {expense.status === 'rejected' && expense.rejectionReason ? (
        <View style={[styles.rejectionBox, { backgroundColor: '#fee2e2' }]}>
          <Feather name="alert-circle" size={13} color="#7f1d1d" style={{ marginTop: 1 }} />
          <Text style={styles.rejectionText}>{expense.rejectionReason}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────

type FilterStatus = 'all' | 'pending' | 'approved' | 'rejected';

const FILTER_TABS: { key: FilterStatus; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'pending',  label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

function FilterTabs({
  active,
  counts,
  colors,
  styles,
  onChange,
}: {
  active: FilterStatus;
  counts: Record<FilterStatus, number>;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  onChange: (f: FilterStatus) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabsScroll}
      contentContainerStyle={styles.tabsContent}
    >
      {FILTER_TABS.map(tab => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.7}
            style={[
              styles.tab,
              isActive
                ? { backgroundColor: colors.primary, borderColor: colors.primary }
                : { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.tabLabel,
                { color: isActive ? '#fff' : colors.mutedForeground },
              ]}
            >
              {tab.label}
            </Text>
            <View
              style={[
                styles.tabCount,
                {
                  backgroundColor: isActive
                    ? 'rgba(255,255,255,0.25)'
                    : colors.muted,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabCountText,
                  { color: isActive ? '#fff' : colors.mutedForeground },
                ]}
              >
                {counts[tab.key]}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MyExpensesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [expenses, setExpenses] = useState<MyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await api.get<MyExpense[]>('/api/expenses/mine');
      if (res.error) throw new Error(res.error);
      setExpenses(res.data ?? []);
    } catch (err: any) {
      setError(err?.message || 'Could not load expenses');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const counts = useMemo<Record<FilterStatus, number>>(() => ({
    all:      expenses.length,
    pending:  expenses.filter(e => e.status === 'pending').length,
    approved: expenses.filter(e => e.status === 'approved').length,
    rejected: expenses.filter(e => e.status === 'rejected').length,
  }), [expenses]);

  const filtered = useMemo(
    () => activeFilter === 'all' ? expenses : expenses.filter(e => e.status === activeFilter),
    [expenses, activeFilter],
  );

  const total = useMemo(
    () => filtered.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0),
    [filtered],
  );

  const bottomNavHeight = getBottomNavHeight(insets.bottom);

  return (
    <>
      <Stack.Screen options={{ title: 'My Expenses', headerShown: false }} />

      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>My Expenses</Text>
          {expenses.length > 0 && (
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
              {filtered.length} {filtered.length === 1 ? 'receipt' : 'receipts'} · {fmt(total)} total
            </Text>
          )}
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Feather name="alert-circle" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Could not load expenses</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>{error}</Text>
            <TouchableOpacity onPress={() => load()} style={[styles.retryBtn, { borderColor: colors.border }]} activeOpacity={0.7}>
              <Text style={[styles.retryBtnText, { color: colors.foreground }]}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : expenses.length === 0 ? (
          <View style={styles.centered}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
              <Feather name="trending-down" size={28} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No expenses yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Expenses you log on jobs will appear here with their approval status.
            </Text>
          </View>
        ) : (
          <>
            <FilterTabs
              active={activeFilter}
              counts={counts}
              colors={colors}
              styles={styles}
              onChange={setActiveFilter}
            />
            {filtered.length === 0 ? (
              <View style={styles.centered}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                  <Feather name="filter" size={28} color={colors.mutedForeground} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  No {activeFilter} expenses
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                  None of your expenses match this filter.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: spacing.md, paddingBottom: bottomNavHeight + spacing.lg }}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => load(true)}
                    tintColor={colors.primary}
                  />
                }
                showsVerticalScrollIndicator={false}
              >
                {filtered.map(expense => (
                  <ExpenseRow key={expense.id} expense={expense} colors={colors} styles={styles} />
                ))}
              </ScrollView>
            )}
          </>
        )}
      </View>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: fontWeights.bold as any,
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 13,
      marginTop: 2,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    emptyTitle: {
      ...typography.bodySemibold,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    emptySubtitle: {
      ...typography.caption,
      textAlign: 'center',
      marginTop: spacing.xs,
      maxWidth: 280,
    },
    retryBtn: {
      marginTop: spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    retryBtnText: {
      fontSize: 14,
      fontWeight: fontWeights.medium as any,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.cardBorder ?? colors.border,
      gap: spacing.xs,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    amount: {
      fontSize: 17,
      fontWeight: fontWeights.bold as any,
    },
    description: {
      ...typography.body,
      flex: 1,
    },
    meta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginTop: 2,
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    metaText: {
      fontSize: 12,
      maxWidth: 180,
    },
    rejectionBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.xs,
      padding: spacing.sm,
      borderRadius: radius.md,
      marginTop: spacing.xs,
    },
    rejectionText: {
      fontSize: 12,
      color: '#7f1d1d',
      flex: 1,
      lineHeight: 16,
    },
    tabsScroll: {
      flexGrow: 0,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    tabsContent: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.xs,
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radius.full ?? 99,
      borderWidth: 1,
    },
    tabLabel: {
      fontSize: 13,
      fontWeight: fontWeights.medium as any,
    },
    tabCount: {
      borderRadius: 99,
      paddingHorizontal: 6,
      paddingVertical: 1,
      minWidth: 20,
      alignItems: 'center',
    },
    tabCountText: {
      fontSize: 11,
      fontWeight: fontWeights.semibold as any,
    },
  });
}
