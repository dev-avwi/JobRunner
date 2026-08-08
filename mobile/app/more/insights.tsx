import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes, componentStyles, fontWeights } from '../../src/lib/design-tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';

interface ProfitSnapshot {
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  labourCostThisMonth: number;
  materialCostThisMonth: number;
  grossProfit: number;
  grossMargin: number;
  cashCollectedToday: number;
}

interface CashflowData {
  thisMonthCollected: number;
  lastMonthCollected: number;
  dueThisWeek: number;
  overdueTotal: number;
  overdueCount: number;
  overdueBreakdown: any[];
  weeklyCollections: any[];
}

interface KPIData {
  jobsToday: number;
  unpaidInvoicesCount: number;
  unpaidInvoicesTotal: number;
  quotesAwaiting: number;
  jobsToInvoice: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
}

type TabId = 'profit' | 'cashflow' | 'efficiency' | 'growth';

const TABS: { key: TabId; label: string; icon: string }[] = [
  { key: 'profit', label: 'Profit', icon: 'dollar-sign' },
  { key: 'cashflow', label: 'Cashflow', icon: 'bar-chart-2' },
  { key: 'efficiency', label: 'Efficiency', icon: 'clock' },
  { key: 'growth', label: 'Growth', icon: 'users' },
];

const fmtAud = (n: number) =>
  `$${(isNaN(n) ? 0 : n).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const getMarginColor = (margin: number): string => {
  if (margin > 30) return '#22c55e';
  if (margin >= 15) return '#f59e0b';
  return '#ef4444';
};

const getMarginLabel = (margin: number): string => {
  if (margin > 30) return 'Healthy margin';
  if (margin >= 15) return 'Room to improve';
  return 'Needs attention';
};

const createStyles = (colors: any, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingTop: pageShell.paddingTop,
    paddingBottom: bottomNavHeight,
  },
  heroSection: {
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  pageTitle: {
    fontSize: typography.sizes['3xl'],
    fontWeight: fontWeights.extrabold,
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    marginTop: 4,
    lineHeight: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    height: sizes.filterChipHeight,
    borderRadius: radius.pill,
    gap: spacing.sm,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabButtonInactive: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tabText: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
  },
  tabTextActive: {
    color: colors.primaryForeground || colors.white,
  },
  tabTextInactive: {
    color: colors.mutedForeground,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  statsGrid: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    ...shadows.md,
  },
  heroStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  heroIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: fontWeights.bold,
    letterSpacing: -1,
    color: colors.foreground,
  },
  heroStatLabel: {
    ...typography.label,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  heroSubValue: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    ...typography.statValue,
    color: colors.foreground,
  },
  statLabel: {
    ...typography.label,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  statSubValue: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  comparisonCard: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  comparisonTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  comparisonCol: {
    flex: 1,
  },
  comparisonLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  comparisonValue: {
    ...typography.statValue,
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  comparisonDiffContainer: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  comparisonDiffText: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  loadingText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.destructive,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  retryButtonText: {
    ...typography.button,
    color: colors.primaryForeground || colors.white,
  },
});

function SimpleBarChart({ 
  data, 
  colors: themeColors 
}: { 
  data: { label: string; value: number; color: string }[];
  colors: any;
}) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <View style={{ backgroundColor: themeColors.card, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: themeColors.cardBorder, ...shadows.sm, marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 120, paddingTop: spacing.sm }}>
        {data.map((item, i) => {
          const barHeight = maxVal > 0 ? (item.value / maxVal) * 90 : 4;
          return (
            <View key={i} style={{ alignItems: 'center', flex: 1, gap: 4 }}>
              <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: themeColors.foreground }}>
                {item.value >= 1000 ? `$${(item.value / 1000).toFixed(1)}k` : `$${item.value}`}
              </Text>
              <View style={{ width: '60%', height: Math.max(barHeight, 4), backgroundColor: item.color, borderRadius: radius.md }} />
              <Text style={{ fontSize: typography.sizes.xs, color: themeColors.mutedForeground, textAlign: 'center' }} numberOfLines={1}>{item.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function DonutIndicator({
  value,
  maxValue,
  label,
  color,
  colors: themeColors,
}: {
  value: number;
  maxValue: number;
  label: string;
  color: string;
  colors: any;
}) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <View style={{ backgroundColor: themeColors.card, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: themeColors.cardBorder, ...shadows.sm, marginBottom: spacing.md, alignItems: 'center' }}>
      <View style={{ width: 100, height: 100, borderRadius: 50, borderWidth: 8, borderColor: themeColors.border, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${pct}%` as any, backgroundColor: color + '30' }} />
        <Text style={{ fontSize: typography.sizes['2xl'], fontWeight: fontWeights.extrabold, color: color }}>{pct.toFixed(0)}%</Text>
      </View>
      <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: themeColors.foreground }}>{label}</Text>
      <Text style={{ fontSize: typography.captionSmall.fontSize, color: themeColors.mutedForeground }}>{fmtAud(value)} of {fmtAud(maxValue)}</Text>
    </View>
  );
}

function HeroCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  subValue,
  trendUp,
  trendColor,
  valueColor,
  styles,
  colors,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  subValue?: string;
  trendUp?: boolean | null;
  trendColor?: string;
  valueColor?: string;
  styles: any;
  colors: any;
}) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroStatHeader}>
        <View style={[styles.heroIconContainer, { backgroundColor: iconBg }]}>
          <Feather name={icon as any} size={20} color={iconColor} />
        </View>
        {trendUp !== null && trendUp !== undefined && (
          <View
            style={[
              styles.trendBadge,
              {
                backgroundColor: trendUp
                  ? (colors.successLight || 'rgba(34,197,94,0.15)')
                  : (colors.destructiveLight || 'rgba(239,68,68,0.15)'),
              },
            ]}
          >
            <Feather
              name={trendUp ? 'trending-up' : 'trending-down'}
              size={12}
              color={trendUp ? (colors.success || '#22c55e') : (colors.destructive || '#ef4444')}
            />
          </View>
        )}
      </View>
      <Text style={[styles.heroStatValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
      {subValue ? <Text style={styles.heroSubValue}>{subValue}</Text> : null}
    </View>
  );
}

function StatCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  subValue,
  trendUp,
  trendColor,
  valueColor,
  styles,
  colors,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  value: string;
  label: string;
  subValue?: string;
  trendUp?: boolean | null;
  trendColor?: string;
  valueColor?: string;
  styles: any;
  colors: any;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={[styles.statIconContainer, { backgroundColor: iconBg }]}>
          <Feather name={icon as any} size={20} color={iconColor} />
        </View>
        {trendUp !== null && trendUp !== undefined && (
          <View
            style={[
              styles.trendBadge,
              {
                backgroundColor: trendUp
                  ? (colors.successLight || 'rgba(34,197,94,0.15)')
                  : (colors.destructiveLight || 'rgba(239,68,68,0.15)'),
              },
            ]}
          >
            <Feather
              name={trendUp ? 'trending-up' : 'trending-down'}
              size={12}
              color={trendUp ? (colors.success || '#22c55e') : (colors.destructive || '#ef4444')}
            />
          </View>
        )}
      </View>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {subValue ? <Text style={styles.statSubValue}>{subValue}</Text> : null}
    </View>
  );
}

export default function InsightsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);

  const [activeTab, setActiveTab] = useState<TabId>('profit');
  const [profit, setProfit] = useState<ProfitSnapshot | null>(null);
  const [cashflow, setCashflow] = useState<CashflowData | null>(null);
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [profitRes, cashflowRes, kpisRes] = await Promise.all([
        api.get<ProfitSnapshot>('/api/dashboard/profit-snapshot'),
        api.get<CashflowData>('/api/dashboard/cashflow'),
        api.get<KPIData>('/api/dashboard/kpis'),
      ]);

      if (profitRes.error && cashflowRes.error && kpisRes.error) {
        setError(profitRes.error || 'Failed to load insights data');
        return;
      }

      setProfit(profitRes.data || null);
      setCashflow(cashflowRes.data || null);
      setKpis(kpisRes.data || null);
    } catch (err) {
      setError('Failed to load insights data. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const collectionDiff = (cashflow?.thisMonthCollected ?? 0) - (cashflow?.lastMonthCollected ?? 0);
  const collectionUp = collectionDiff >= 0;

  const renderProfitTab = () => (
    <View style={styles.statsGrid}>
      <HeroCard
        icon="dollar-sign"
        iconBg={colors.successLight || 'rgba(34,197,94,0.15)'}
        iconColor={colors.success || '#22c55e'}
        value={fmtAud(profit?.revenueThisMonth ?? 0)}
        label="Revenue This Month"
        trendUp={(profit?.revenueThisMonth ?? 0) > 0 ? true : null}
        styles={styles}
        colors={colors}
      />

      <Text style={[styles.sectionTitle, { marginTop: spacing.sm }]}>Revenue Breakdown</Text>
      <SimpleBarChart
        data={[
          { label: 'Today', value: profit?.revenueToday ?? 0, color: colors.success || '#22c55e' },
          { label: 'This Week', value: profit?.revenueThisWeek ?? 0, color: colors.primary || '#3b82f6' },
          { label: 'This Month', value: profit?.revenueThisMonth ?? 0, color: '#8b5cf6' },
        ]}
        colors={colors}
      />
      <View style={styles.statsRow}>
        <StatCard
          icon="dollar-sign"
          iconBg={colors.successLight || 'rgba(34,197,94,0.15)'}
          iconColor={colors.success || '#22c55e'}
          value={fmtAud(profit?.revenueToday ?? 0)}
          label="Revenue Today"
          styles={styles}
          colors={colors}
        />
        <StatCard
          icon="trending-up"
          iconBg={colors.primaryLight || 'rgba(59,130,246,0.15)'}
          iconColor={colors.primary || '#3b82f6'}
          value={fmtAud(profit?.revenueThisWeek ?? 0)}
          label="This Week"
          styles={styles}
          colors={colors}
        />
      </View>

      <Text style={[styles.sectionTitle, { marginTop: spacing.sm }]}>Margins & Costs</Text>
      <DonutIndicator
        value={profit?.grossProfit ?? 0}
        maxValue={profit?.revenueThisMonth ?? 1}
        label="Gross Margin"
        color={getMarginColor(profit?.grossMargin ?? 0)}
        colors={colors}
      />
      <SimpleBarChart
        data={[
          { label: 'Revenue', value: profit?.revenueThisMonth ?? 0, color: colors.success || '#22c55e' },
          { label: 'Labour', value: profit?.labourCostThisMonth ?? 0, color: colors.warning || '#f59e0b' },
          { label: 'Materials', value: profit?.materialCostThisMonth ?? 0, color: '#8b5cf6' },
          { label: 'Profit', value: profit?.grossProfit ?? 0, color: colors.primary || '#3b82f6' },
        ]}
        colors={colors}
      />
      <View style={styles.statsRow}>
        <StatCard
          icon="percent"
          iconBg={
            (profit?.grossMargin ?? 0) > 30
              ? 'rgba(34,197,94,0.15)'
              : (profit?.grossMargin ?? 0) >= 15
                ? 'rgba(245,158,11,0.15)'
                : 'rgba(239,68,68,0.15)'
          }
          iconColor={getMarginColor(profit?.grossMargin ?? 0)}
          value={`${(profit?.grossMargin ?? 0).toFixed(1)}%`}
          label="Gross Margin"
          subValue={getMarginLabel(profit?.grossMargin ?? 0)}
          valueColor={getMarginColor(profit?.grossMargin ?? 0)}
          styles={styles}
          colors={colors}
        />
        <StatCard
          icon="dollar-sign"
          iconBg={colors.successLight || 'rgba(34,197,94,0.15)'}
          iconColor={colors.success || '#22c55e'}
          value={fmtAud(profit?.grossProfit ?? 0)}
          label="Gross Profit"
          styles={styles}
          colors={colors}
        />
      </View>
      <View style={styles.statsRow}>
        <StatCard
          icon="clock"
          iconBg={colors.warningLight || 'rgba(245,158,11,0.15)'}
          iconColor={colors.warning || '#f59e0b'}
          value={fmtAud(profit?.labourCostThisMonth ?? 0)}
          label="Labour Cost"
          subValue="This month"
          styles={styles}
          colors={colors}
        />
        <StatCard
          icon="package"
          iconBg="rgba(139,92,246,0.15)"
          iconColor="#8b5cf6"
          value={fmtAud(profit?.materialCostThisMonth ?? 0)}
          label="Material Cost"
          subValue="This month"
          styles={styles}
          colors={colors}
        />
      </View>
    </View>
  );

  const renderCashflowTab = () => (
    <View style={styles.statsGrid}>
      <HeroCard
        icon="dollar-sign"
        iconBg={colors.successLight || 'rgba(34,197,94,0.15)'}
        iconColor={colors.success || '#22c55e'}
        value={fmtAud(cashflow?.thisMonthCollected ?? 0)}
        label="Collected This Month"
        trendUp={collectionUp ? true : false}
        styles={styles}
        colors={colors}
      />

      <Text style={[styles.sectionTitle, { marginTop: spacing.sm }]}>Collections</Text>
      <SimpleBarChart
        data={[
          { label: 'Today', value: profit?.cashCollectedToday ?? 0, color: colors.success || '#22c55e' },
          { label: 'Due', value: cashflow?.dueThisWeek ?? 0, color: colors.warning || '#f59e0b' },
          { label: 'This Month', value: cashflow?.thisMonthCollected ?? 0, color: colors.primary || '#3b82f6' },
          { label: 'Overdue', value: cashflow?.overdueTotal ?? 0, color: colors.destructive || '#ef4444' },
        ]}
        colors={colors}
      />
      <View style={styles.statsRow}>
        <StatCard
          icon="dollar-sign"
          iconBg={colors.successLight || 'rgba(34,197,94,0.15)'}
          iconColor={colors.success || '#22c55e'}
          value={fmtAud(profit?.cashCollectedToday ?? 0)}
          label="Collected Today"
          styles={styles}
          colors={colors}
        />
        <StatCard
          icon="clock"
          iconBg={colors.warningLight || 'rgba(245,158,11,0.15)'}
          iconColor={colors.warning || '#f59e0b'}
          value={fmtAud(cashflow?.dueThisWeek ?? 0)}
          label="Due This Week"
          styles={styles}
          colors={colors}
        />
      </View>
      <View style={styles.statsRow}>
        <StatCard
          icon="alert-circle"
          iconBg={colors.destructiveLight || 'rgba(239,68,68,0.15)'}
          iconColor={colors.destructive || '#ef4444'}
          value={fmtAud(cashflow?.overdueTotal ?? 0)}
          label="Overdue Total"
          subValue={(cashflow?.overdueCount ?? 0) > 0 ? `${cashflow?.overdueCount} invoice${(cashflow?.overdueCount ?? 0) !== 1 ? 's' : ''} overdue` : 'No overdue'}
          valueColor={(cashflow?.overdueTotal ?? 0) > 0 ? (colors.destructive || '#ef4444') : undefined}
          trendUp={(cashflow?.overdueTotal ?? 0) > 0 ? false : null}
          styles={styles}
          colors={colors}
        />
        <View style={{ flex: 1 }} />
      </View>

      <Text style={[styles.sectionTitle, { marginTop: spacing.sm }]}>Trend</Text>
      <View style={styles.comparisonCard}>
        <Text style={styles.comparisonTitle}>This Month vs Last Month</Text>
        <View style={styles.comparisonRow}>
          <View style={styles.comparisonCol}>
            <Text style={styles.comparisonLabel}>This month</Text>
            <Text style={styles.comparisonValue}>{fmtAud(cashflow?.thisMonthCollected ?? 0)}</Text>
          </View>
          <View style={styles.comparisonDiffContainer}>
            <Feather
              name={collectionUp ? 'arrow-up-right' : 'arrow-down-right'}
              size={20}
              color={collectionUp ? '#22c55e' : '#ef4444'}
            />
            <Text style={[styles.comparisonDiffText, { color: collectionUp ? '#22c55e' : '#ef4444' }]}>
              {fmtAud(Math.abs(collectionDiff))}
            </Text>
          </View>
          <View style={[styles.comparisonCol, { alignItems: 'flex-end' as const }]}>
            <Text style={styles.comparisonLabel}>Last month</Text>
            <Text style={styles.comparisonValue}>{fmtAud(cashflow?.lastMonthCollected ?? 0)}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderEfficiencyTab = () => (
    <View style={styles.statsGrid}>
      <HeroCard
        icon="briefcase"
        iconBg={colors.primaryLight || 'rgba(59,130,246,0.15)'}
        iconColor={colors.primary || '#3b82f6'}
        value={String(kpis?.jobsToday ?? 0)}
        label="Jobs Today"
        styles={styles}
        colors={colors}
      />

      <Text style={[styles.sectionTitle, { marginTop: spacing.sm }]}>Activity</Text>
      <View style={styles.statsRow}>
        <StatCard
          icon="file-text"
          iconBg={colors.warningLight || 'rgba(245,158,11,0.15)'}
          iconColor={colors.warning || '#f59e0b'}
          value={String(kpis?.jobsToInvoice ?? 0)}
          label="Jobs to Invoice"
          subValue={(kpis?.jobsToInvoice ?? 0) > 0 ? 'Completed, not invoiced' : 'All caught up'}
          valueColor={(kpis?.jobsToInvoice ?? 0) > 0 ? (colors.warning || '#f59e0b') : undefined}
          styles={styles}
          colors={colors}
        />
        <StatCard
          icon="send"
          iconBg="rgba(139,92,246,0.15)"
          iconColor="#8b5cf6"
          value={String(kpis?.quotesAwaiting ?? 0)}
          label="Quotes Awaiting"
          subValue="Sent, awaiting response"
          styles={styles}
          colors={colors}
        />
      </View>

      <Text style={[styles.sectionTitle, { marginTop: spacing.sm }]}>Earnings</Text>
      <View style={styles.statsRow}>
        <StatCard
          icon="trending-up"
          iconBg={colors.successLight || 'rgba(34,197,94,0.15)'}
          iconColor={colors.success || '#22c55e'}
          value={fmtAud(kpis?.weeklyEarnings ?? 0)}
          label="Weekly Earnings"
          styles={styles}
          colors={colors}
        />
        <StatCard
          icon="dollar-sign"
          iconBg={colors.successLight || 'rgba(34,197,94,0.15)'}
          iconColor={colors.success || '#22c55e'}
          value={fmtAud(kpis?.monthlyEarnings ?? 0)}
          label="Monthly Earnings"
          styles={styles}
          colors={colors}
        />
      </View>
    </View>
  );

  const renderGrowthTab = () => (
    <View style={styles.statsGrid}>
      <HeroCard
        icon="dollar-sign"
        iconBg={colors.successLight || 'rgba(34,197,94,0.15)'}
        iconColor={colors.success || '#22c55e'}
        value={fmtAud(profit?.revenueThisMonth ?? 0)}
        label="Revenue This Month"
        trendUp={(profit?.revenueThisMonth ?? 0) > 0 ? true : null}
        styles={styles}
        colors={colors}
      />

      <Text style={[styles.sectionTitle, { marginTop: spacing.sm }]}>Outstanding</Text>
      <View style={styles.statsRow}>
        <StatCard
          icon="file-minus"
          iconBg={colors.destructiveLight || 'rgba(239,68,68,0.15)'}
          iconColor={colors.destructive || '#ef4444'}
          value={String(kpis?.unpaidInvoicesCount ?? 0)}
          label="Unpaid Invoices"
          subValue={`${fmtAud(kpis?.unpaidInvoicesTotal ?? 0)} total`}
          valueColor={(kpis?.unpaidInvoicesCount ?? 0) > 0 ? (colors.destructive || '#ef4444') : undefined}
          styles={styles}
          colors={colors}
        />
        <StatCard
          icon="alert-triangle"
          iconBg={colors.warningLight || 'rgba(245,158,11,0.15)'}
          iconColor={colors.warning || '#f59e0b'}
          value={fmtAud(cashflow?.overdueTotal ?? 0)}
          label="Overdue Amount"
          subValue={`${cashflow?.overdueCount ?? 0} overdue invoices`}
          styles={styles}
          colors={colors}
        />
      </View>

      <Text style={[styles.sectionTitle, { marginTop: spacing.sm }]}>Quick Stats</Text>
      <View style={styles.statsRow}>
        <StatCard
          icon="trending-up"
          iconBg={colors.primaryLight || 'rgba(59,130,246,0.15)'}
          iconColor={colors.primary || '#3b82f6'}
          value={fmtAud(profit?.revenueThisWeek ?? 0)}
          label="Revenue This Week"
          styles={styles}
          colors={colors}
        />
        <StatCard
          icon="send"
          iconBg="rgba(139,92,246,0.15)"
          iconColor="#8b5cf6"
          value={String(kpis?.quotesAwaiting ?? 0)}
          label="Quotes Pending"
          styles={styles}
          colors={colors}
        />
      </View>
      <View style={styles.statsRow}>
        <StatCard
          icon="briefcase"
          iconBg={colors.primaryLight || 'rgba(59,130,246,0.15)'}
          iconColor={colors.primary || '#3b82f6'}
          value={String(kpis?.jobsToday ?? 0)}
          label="Jobs Today"
          styles={styles}
          colors={colors}
        />
        <View style={{ flex: 1 }} />
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.heroSection}>
            <Text style={styles.pageTitle}>Insights</Text>
            <Text style={styles.pageSubtitle}>Business analytics and performance tracking</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: spacing.md }}
            contentContainerStyle={styles.tabContainer}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <PressableRow key={tab.key} style={[ styles.tabButton, isActive ? styles.tabButtonActive : styles.tabButtonInactive, ]} onPress={() => setActiveTab(tab.key)} >
                  <Feather
                    name={tab.icon as any}
                    size={iconSizes.sm}
                    color={isActive ? (colors.primaryForeground || colors.white) : colors.mutedForeground}
                  />
                  <Text style={[styles.tabText, isActive ? styles.tabTextActive : styles.tabTextInactive]}>
                    {tab.label}
                  </Text>
                </PressableRow>
              );
            })}
          </ScrollView>

          {error && (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={40} color={colors.destructive} />
              <Text style={styles.errorText}>{error}</Text>
              <PressableRow style={styles.retryButton} onPress={() => { setIsLoading(true); setError(null); fetchData(); }} >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </PressableRow>
            </View>
          )}

          {isLoading && !profit && !cashflow && !kpis && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading insights...</Text>
            </View>
          )}

          {!isLoading && !error && (
            <>
              {activeTab === 'profit' && renderProfitTab()}
              {activeTab === 'cashflow' && renderCashflowTab()}
              {activeTab === 'efficiency' && renderEfficiencyTab()}
              {activeTab === 'growth' && renderGrowthTab()}
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}
