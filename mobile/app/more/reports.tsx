import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Dimensions,
  Share,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack } from 'expo-router';
import { OwnerOnlyGuard } from '../../src/components/ui/OwnerOnlyGuard';
import { Feather } from '@expo/vector-icons';
import Svg, { Rect, Path, Line, Text as SvgText, G } from 'react-native-svg';
import { useReportsStore } from '../../src/lib/store';
import { useTheme } from '../../src/lib/theme';
import { api, API_URL } from '../../src/lib/api';
import { showToast } from '../../src/lib/toast';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import { SheetButton } from '../../src/components/ui/SheetButton';
import { TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes, componentStyles, fontWeights } from '../../src/lib/design-tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ReportPeriod = 'week' | 'month' | 'quarter' | 'year';
type ReportTab = 'overview' | 'revenue' | 'clients' | 'profitability' | 'aged' | 'payroll' | 'utilisation' | 'export';

interface PayrollWorker {
  teamMemberId: string;
  memberId: string;
  firstName: string;
  lastName: string;
  email: string;
  hourlyRate: number;
  isSubcontractor: boolean;
  regularHours: number;
  overtimeHours: number;
  breakHours: number;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  grossPay: number;
  overtimePay: number;
  jobCount: number;
  entryCount: number;
  approved: number;
  unapproved: number;
  paid: boolean;
  paidAt: string | null;
  payrollPaymentId: string | null;
  paidMethod: string | null;
  paidReference: string | null;
  travelAllowance?: number;
  totalDistanceKm?: number;
}

const PAYROLL_PAY_METHODS: { value: string; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'payid', label: 'PayID' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

const PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year', label: 'This Year' },
];

const REPORT_TABS: { key: ReportTab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'bar-chart-2' },
  { key: 'revenue', label: 'Revenue', icon: 'dollar-sign' },
  { key: 'clients', label: 'Clients', icon: 'users' },
  { key: 'profitability', label: 'Profit', icon: 'trending-up' },
  { key: 'aged', label: 'Aged AR', icon: 'clock' },
  { key: 'payroll', label: 'Payroll', icon: 'credit-card' },
  { key: 'utilisation', label: 'Utilisation', icon: 'activity' },
  { key: 'export', label: 'Export', icon: 'share' },
];

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    paddingTop: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    ...typography.largeTitle,
    color: colors.foreground,
  },
  pageSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.sm,
    ...shadows.sm,
  },
  exportButtonText: {
    ...typography.body,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  periodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...shadows.sm,
  },
  periodSelectorText: {
    flex: 1,
    ...typography.body,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  periodPicker: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadows.sm,
  },
  periodOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  periodOptionActive: {
    backgroundColor: colors.primaryLight,
  },
  periodOptionText: {
    ...typography.body,
    color: colors.foreground,
  },
  periodOptionTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.medium,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
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
    marginBottom: spacing.sm,
  },
  heroStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  heroStatValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: fontWeights.bold,
    letterSpacing: -1,
    color: colors.foreground,
  },
  heroStatTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  heroStatSub: {
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
    marginBottom: spacing.sm,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  trendBadgeUp: {
    backgroundColor: colors.successLight,
  },
  trendBadgeDown: {
    backgroundColor: colors.destructiveLight,
  },
  statValue: {
    ...typography.statValue,
    color: colors.foreground,
  },
  statTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  statSubValue: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  chartSection: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chartTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  chartSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginLeft: 'auto',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
  },
  chartBarWrapper: {
    width: 24,
    height: 100,
    backgroundColor: colors.muted,
    borderRadius: radius.xs,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.xs,
  },
  chartBarLabel: {
    ...typography.label,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: typography.sizes.xs,
  },
  chartBarAmount: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
    marginTop: 2,
  },
  chartYearTotal: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartYearLabel: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  chartYearValue: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  topClientsSection: {
    marginBottom: spacing.sm,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  clientRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  clientRankText: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  clientMeta: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  clientRevenue: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.success,
  },
  quickReportsSection: {
    marginBottom: spacing.sm,
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  reportCardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  reportCardContent: {
    flex: 1,
  },
  reportCardTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  reportCardSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  insightsCard: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  insightsIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightsTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginTop: spacing.sm,
  },
  insightsText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
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
    marginBottom: spacing.md,
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
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius['2xl'],
  },
  retryButtonText: {
    ...typography.button,
    color: colors.primaryForeground,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginTop: spacing.sm,
  },
  emptyText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  reportTabContainer: {
    marginBottom: spacing.md,
  },
  reportTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    height: sizes.filterChipHeight,
    marginRight: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.sm,
  },
  reportTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  reportTabText: {
    ...typography.body,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  reportTabTextActive: {
    color: colors.primaryForeground,
  },
  overviewSummarySection: {
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    ...typography.statValue,
    color: colors.foreground,
  },
  revenueBreakdownSection: {
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  breakdownCard: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.sm,
    ...shadows.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  breakdownLabel: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
  },
  breakdownValue: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  bucketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  bucketLabel: {
    flex: 1,
  },
  bucketLabelText: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  bucketCountText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  bucketAmount: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.muted,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  progressBar: {
    height: '100%',
    borderRadius: radius.pill,
  },
  workerCard: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  workerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  workerName: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  workerSubtext: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  workerStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  workerStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
  },
  workerStatValue: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  workerStatLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  utilisationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  utilisationBarTrack: {
    flex: 1,
    height: 12,
    backgroundColor: colors.muted,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  utilisationBarFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  utilisationPercent: {
    ...typography.body,
    fontWeight: fontWeights.bold,
    minWidth: 48,
    textAlign: 'right',
  },
});

interface StripePayment {
  id: string;
  amount: number;
  fee: number;
  net: number;
  status: string;
  paid: boolean;
  description: string;
  customer: string | null;
  paymentMethod: string;
  created: string;
}

interface StripePayout {
  id: string;
  amount: number;
  status: string;
  arrivalDate: string | null;
  created: string;
  method: string;
}

interface StripePaymentsReport {
  available: boolean;
  message?: string;
  balance: { available: number; pending: number; currency: string } | null;
  payments: StripePayment[];
  payouts: StripePayout[];
  totals?: {
    totalRevenue: number;
    totalFees: number;
    totalNet: number;
    paymentCount: number;
  };
}

function SVGBarChart({ data, colors, width }: { data: { label: string; value: number; amount: string }[]; colors: any; width: number }) {
  if (data.length === 0) return null;
  const chartWidth = width - 40;
  const chartHeight = 160;
  const barWidth = Math.min(28, (chartWidth - 20) / data.length - 8);
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const padding = { top: 10, bottom: 40, left: 10, right: 10 };
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const plotWidth = chartWidth - padding.left - padding.right;
  const barSpacing = plotWidth / data.length;

  return (
    <Svg width={chartWidth} height={chartHeight}>
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
        <Line
          key={i}
          x1={padding.left}
          y1={padding.top + plotHeight * (1 - pct)}
          x2={chartWidth - padding.right}
          y2={padding.top + plotHeight * (1 - pct)}
          stroke={colors.border}
          strokeWidth={0.5}
          strokeDasharray="4,4"
        />
      ))}
      {data.map((d, i) => {
        const barHeight = maxVal > 0 ? (d.value / maxVal) * plotHeight : 0;
        const x = padding.left + barSpacing * i + (barSpacing - barWidth) / 2;
        const y = padding.top + plotHeight - barHeight;
        return (
          <G key={i}>
            <Rect
              x={x}
              y={padding.top}
              width={barWidth}
              height={plotHeight}
              rx={4}
              fill={colors.muted}
              opacity={0.3}
            />
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, 2)}
              rx={4}
              fill={colors.primary}
            />
            <SvgText
              x={x + barWidth / 2}
              y={chartHeight - padding.bottom + 14}
              textAnchor="middle"
              fontSize={10}
              fill={colors.mutedForeground}
            >
              {d.label}
            </SvgText>
            <SvgText
              x={x + barWidth / 2}
              y={chartHeight - padding.bottom + 26}
              textAnchor="middle"
              fontSize={9}
              fontWeight="500"
              fill={colors.foreground}
            >
              {d.amount}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

function SVGDonutChart({ segments, colors, size }: { segments: { label: string; value: number; color: string }[]; colors: any; size: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.6;
  let startAngle = -90;

  const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const arcs = segments.map((seg) => {
    const pct = seg.value / total;
    const sweepAngle = pct * 360;
    const endAngle = startAngle + sweepAngle;
    const largeArc = sweepAngle > 180 ? 1 : 0;
    const s1 = polarToCartesian(cx, cy, outerR, startAngle);
    const e1 = polarToCartesian(cx, cy, outerR, endAngle);
    const s2 = polarToCartesian(cx, cy, innerR, endAngle);
    const e2 = polarToCartesian(cx, cy, innerR, startAngle);
    const d = [
      `M ${s1.x} ${s1.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${e1.x} ${e1.y}`,
      `L ${s2.x} ${s2.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${e2.x} ${e2.y}`,
      'Z',
    ].join(' ');
    startAngle = endAngle;
    return { d, color: seg.color, label: seg.label, pct };
  });

  return (
    <Svg width={size} height={size}>
      {arcs.map((arc, i) => (
        <Path key={i} d={arc.d} fill={arc.color} />
      ))}
      <SvgText
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fontSize={16}
        fontWeight="700"
        fill={colors.foreground}
      >
        {total}
      </SvgText>
      <SvgText
        x={cx}
        y={cy + 12}
        textAnchor="middle"
        fontSize={10}
        fill={colors.mutedForeground}
      >
        total
      </SvgText>
    </Svg>
  );
}

function ReportsScreenInner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  
  const { 
    summary: summaryRaw, 
    revenueReport, 
    clientReport,
    profitabilityReport,
    agedReceivablesReport,
    payrollReport,
    utilisationReport,
    period, 
    setPeriod,
    fetchAllReports, 
    fetchPayroll,
    isLoading,
    error 
  } = useReportsStore();

  // The API can return a partial summary (missing nested sections). Normalise
  // once so every `summary.x.y` access below is crash-safe, while keeping the
  // null state intact for the `!summary` loading/empty gates.
  const summary = useMemo(() => {
    if (!summaryRaw) return summaryRaw;
    return {
      ...summaryRaw,
      revenue: {
        total: summaryRaw.revenue?.total ?? 0,
        pending: summaryRaw.revenue?.pending ?? 0,
        overdue: summaryRaw.revenue?.overdue ?? 0,
        gstCollected: summaryRaw.revenue?.gstCollected ?? 0,
      },
      jobs: {
        total: summaryRaw.jobs?.total ?? 0,
        completed: summaryRaw.jobs?.completed ?? 0,
        inProgress: summaryRaw.jobs?.inProgress ?? 0,
      },
      quotes: {
        total: summaryRaw.quotes?.total ?? 0,
        accepted: summaryRaw.quotes?.accepted ?? 0,
        pending: summaryRaw.quotes?.pending ?? 0,
        conversionRate: summaryRaw.quotes?.conversionRate ?? 0,
      },
      invoices: {
        total: summaryRaw.invoices?.total ?? 0,
        paid: summaryRaw.invoices?.paid ?? 0,
        unpaid: summaryRaw.invoices?.unpaid ?? 0,
        overdue: summaryRaw.invoices?.overdue ?? 0,
      },
    };
  }, [summaryRaw]);
  
  const [showPeriodPicker, setShowPeriodPicker] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>('overview');
  const [stripeData, setStripeData] = useState<StripePaymentsReport | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);

  // Payroll pay-run state
  const [payWorker, setPayWorker] = useState<PayrollWorker | null>(null);
  const [payMethod, setPayMethod] = useState('bank_transfer');
  const [payReference, setPayReference] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payslipBusyId, setPayslipBusyId] = useState<string | null>(null);

  const openPayrollPay = useCallback((worker: PayrollWorker) => {
    setPayWorker(worker);
    setPayMethod('bank_transfer');
    setPayReference('');
    setPayNotes('');
  }, []);

  const submitPayrollPay = useCallback(async () => {
    if (!payWorker || !payrollReport) return;
    setPaySubmitting(true);
    try {
      const res = await api.post('/api/payroll/pay', {
        workerUserId: payWorker.memberId,
        periodStart: payrollReport.period.start,
        periodEnd: payrollReport.period.end,
        method: payMethod,
        reference: payReference.trim() || undefined,
        notes: payNotes.trim() || undefined,
        paidAt: new Date().toISOString(),
        sendPayslip: true,
      });
      if (res.error) {
        showToast({ type: 'error', message: res.error });
      } else {
        showToast({ type: 'success', message: 'Worker paid. Payslip sent.' });
        setPayWorker(null);
        fetchPayroll();
      }
    } catch (error: unknown) {
      const errMsg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to record payment';
      showToast({ type: 'error', message: errMsg });
    } finally {
      setPaySubmitting(false);
    }
  }, [payWorker, payrollReport, payMethod, payReference, payNotes, fetchPayroll]);

  const downloadPayslip = useCallback(async (paymentId: string) => {
    setPayslipBusyId(paymentId);
    try {
      const token = await api.getToken();
      const url = `${API_URL}/api/payroll/payslip/${paymentId}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'x-mobile-app': 'true' },
      });
      if (!response.ok) throw new Error('Failed to download payslip');
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const fileUri = `${FileSystem.cacheDirectory}payslip_${paymentId}.pdf`;
          await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Payslip', UTI: 'com.adobe.pdf' });
          } else {
            showToast({ type: 'success', message: 'Payslip saved to device' });
          }
        } catch {
          showToast({ type: 'error', message: 'Failed to save payslip' });
        }
      };
      reader.readAsDataURL(blob);
    } catch {
      showToast({ type: 'error', message: 'Could not download payslip' });
    } finally {
      setPayslipBusyId(null);
    }
  }, []);

  const fetchStripeData = useCallback(async () => {
    setStripeLoading(true);
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const response = await api.get<StripePaymentsReport>(
        `/api/reports/stripe-payments?startDate=${start.toISOString()}&endDate=${now.toISOString()}`
      );
      if (response.data) {
        setStripeData(response.data);
      }
    } catch (e) {
      // Stripe not connected or error - ignore
    } finally {
      setStripeLoading(false);
    }
  }, []);

  const refreshData = useCallback(async () => {
    await Promise.all([fetchAllReports(), fetchStripeData()]);
  }, [fetchAllReports, fetchStripeData]);

  useEffect(() => {
    refreshData();
  }, []);

  const formatCurrency = (amount: number) => {
    const { formatCurrency: fmt } = require('../../src/lib/format');
    return fmt(amount, { compact: true });
  };

  const formatCurrencyShort = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`;
    }
    return `$${amount.toFixed(0)}`;
  };

  const handlePeriodChange = (newPeriod: ReportPeriod) => {
    setPeriod(newPeriod);
    setShowPeriodPicker(false);
  };

  const handleExport = async () => {
    if (!summary) {
      Alert.alert('No Data', 'Please wait for the report to load');
      return;
    }

    const reportText = `JobRunner Report - ${PERIODS.find(p => p.key === period)?.label}

REVENUE
Total Revenue: ${formatCurrency(summary.revenue.total)}
Pending Revenue: ${formatCurrency(summary.revenue.pending)}
Overdue: ${formatCurrency(summary.revenue.overdue)}
GST Collected: ${formatCurrency(summary.revenue.gstCollected)}

JOBS
Total Jobs: ${summary.jobs.total}
Completed: ${summary.jobs.completed}
In Progress: ${summary.jobs.inProgress}

QUOTES
Total Quotes: ${summary.quotes.total}
Accepted: ${summary.quotes.accepted}
Pending: ${summary.quotes.pending}
Conversion Rate: ${summary.quotes.conversionRate.toFixed(1)}%

INVOICES
Total Invoices: ${summary.invoices.total}
Paid: ${summary.invoices.paid}
Unpaid: ${summary.invoices.unpaid}
Overdue: ${summary.invoices.overdue}

Generated: ${new Date().toLocaleDateString('en-AU')}`;

    try {
      await Share.share({
        message: reportText,
        title: 'JobRunner Report'
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share report');
    }
  };

  const handleReportDownload = (reportType: string) => {
    if (!summary) {
      Alert.alert('No Data', 'Please wait for the report to load');
      return;
    }
    
    Alert.alert(
      'Export Format',
      'Choose export format for your report',
      [
        {
          text: 'Spreadsheet (CSV)',
          onPress: () => shareReportAsCSV(reportType),
        },
        {
          text: 'Text Report',
          onPress: () => shareReportAsText(reportType),
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };
  
  const shareReportAsCSV = (reportType: string) => {
    if (!summary) return;
    
    let csvData = '';
    const periodLabel = PERIODS.find(p => p.key === period)?.label;
    
    switch (reportType) {
      case 'income':
        csvData = `JobRunner Income Report - ${periodLabel}\n\n`;
        csvData += `Metric,Amount\n`;
        csvData += `Total Revenue,$${summary.revenue.total.toFixed(2)}\n`;
        csvData += `Pending Revenue,$${summary.revenue.pending.toFixed(2)}\n`;
        csvData += `Overdue Revenue,$${summary.revenue.overdue.toFixed(2)}\n`;
        csvData += `GST Collected,$${summary.revenue.gstCollected.toFixed(2)}\n`;
        csvData += `Invoices Paid,${summary.invoices.paid}\n`;
        csvData += `Invoices Outstanding,${summary.invoices.unpaid + summary.invoices.overdue}\n`;
        csvData += `\nGenerated,${new Date().toLocaleDateString('en-AU')}`;
        break;
      case 'jobs':
        csvData = `JobRunner Jobs Report - ${periodLabel}\n\n`;
        csvData += `Metric,Value\n`;
        csvData += `Total Jobs,${summary.jobs.total}\n`;
        csvData += `Completed,${summary.jobs.completed}\n`;
        csvData += `In Progress,${summary.jobs.inProgress}\n`;
        csvData += `Completion Rate,${summary.jobs.total > 0 ? ((summary.jobs.completed / summary.jobs.total) * 100).toFixed(1) : 0}%\n`;
        csvData += `\nGenerated,${new Date().toLocaleDateString('en-AU')}`;
        break;
      case 'quotes':
        csvData = `JobRunner Quotes Report - ${periodLabel}\n\n`;
        csvData += `Metric,Value\n`;
        csvData += `Total Quotes,${summary.quotes.total}\n`;
        csvData += `Accepted,${summary.quotes.accepted}\n`;
        csvData += `Pending,${summary.quotes.pending}\n`;
        csvData += `Conversion Rate,${summary.quotes.conversionRate.toFixed(1)}%\n`;
        csvData += `\nGenerated,${new Date().toLocaleDateString('en-AU')}`;
        break;
      case 'tax':
        csvData = `JobRunner Tax Summary - ${periodLabel}\n\n`;
        csvData += `Metric,Amount\n`;
        csvData += `GST Collected,$${summary.revenue.gstCollected.toFixed(2)}\n`;
        csvData += `Total Revenue (incl GST),$${summary.revenue.total.toFixed(2)}\n`;
        csvData += `\nNote: GST calculations are estimates based on 10% GST.\n`;
        csvData += `Generated,${new Date().toLocaleDateString('en-AU')}`;
        break;
    }
    
    Share.share({
      message: csvData,
      title: `${reportType}_report_${period}.csv`
    }).catch(() => Alert.alert('Error', 'Failed to export CSV'));
  };
  
  const shareReportAsText = (reportType: string) => {
    if (!summary) return;
    
    let reportData = '';
    const periodLabel = PERIODS.find(p => p.key === period)?.label;
    
    switch (reportType) {
      case 'income':
        reportData = `Income Report - ${periodLabel}\n\nTotal Revenue: ${formatCurrency(summary.revenue.total)}\nPending Revenue: ${formatCurrency(summary.revenue.pending)}\nOverdue Revenue: ${formatCurrency(summary.revenue.overdue)}\n\nInvoices Paid: ${summary.invoices.paid}\nInvoices Outstanding: ${summary.invoices.unpaid + summary.invoices.overdue}\n\nGenerated: ${new Date().toLocaleDateString('en-AU')}`;
        break;
      case 'jobs':
        reportData = `Jobs Report - ${periodLabel}\n\nTotal Jobs: ${summary.jobs.total}\nCompleted: ${summary.jobs.completed}\nIn Progress: ${summary.jobs.inProgress}\nCompletion Rate: ${summary.jobs.total > 0 ? ((summary.jobs.completed / summary.jobs.total) * 100).toFixed(1) : 0}%\n\nGenerated: ${new Date().toLocaleDateString('en-AU')}`;
        break;
      case 'quotes':
        reportData = `Quotes Report - ${periodLabel}\n\nTotal Quotes: ${summary.quotes.total}\nAccepted: ${summary.quotes.accepted}\nPending: ${summary.quotes.pending}\nConversion Rate: ${summary.quotes.conversionRate.toFixed(1)}%\n\nGenerated: ${new Date().toLocaleDateString('en-AU')}`;
        break;
      case 'tax':
        reportData = `Tax Summary - ${periodLabel}\n\nGST Collected: ${formatCurrency(summary.revenue.gstCollected)}\nTotal Revenue (incl GST): ${formatCurrency(summary.revenue.total)}\n\nNote: GST calculations are estimates based on 10% GST.\nConsult your accountant for accurate tax reporting.\n\nGenerated: ${new Date().toLocaleDateString('en-AU')}`;
        break;
    }

    Share.share({
      message: reportData,
      title: `JobRunner ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`
    }).catch(() => Alert.alert('Error', 'Failed to share report'));
  };

  const monthlyData = useMemo(() => {
    if (!revenueReport?.months) return [];
    return revenueReport.months.slice(0, 6).map(m => ({
      label: m.month.substring(0, 3),
      value: m.revenue,
      amount: formatCurrencyShort(m.revenue)
    }));
  }, [revenueReport]);

  const maxChartValue = useMemo(() => {
    return Math.max(...monthlyData.map(d => d.value), 1);
  }, [monthlyData]);

  const conversionRate = summary?.quotes?.conversionRate || 0;

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
              refreshing={isLoading}
              onRefresh={refreshData}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Reports</Text>
              <Text style={styles.pageSubtitle}>Business analytics & insights</Text>
            </View>
            <PressableRow style={styles.exportButton} onPress={handleExport} disabled={!summary} >
              <Feather name="share" size={iconSizes.lg} color={summary ? colors.foreground : colors.mutedForeground} />
              <Text style={[styles.exportButtonText, !summary && { color: colors.mutedForeground }]}>Share</Text>
            </PressableRow>
          </View>

          <PressableRow style={styles.periodSelector} onPress={() => setShowPeriodPicker(!showPeriodPicker)} >
            <Feather name="calendar" size={iconSizes.lg} color={colors.primary} />
            <Text style={styles.periodSelectorText}>
              {PERIODS.find(p => p.key === period)?.label}
            </Text>
            <Feather name={showPeriodPicker ? "chevron-up" : "chevron-down"} size={iconSizes.lg} color={colors.mutedForeground} />
          </PressableRow>

          {showPeriodPicker && (
            <View style={styles.periodPicker}>
              {PERIODS.map((p, index) => (
                <PressableRow key={p.key} style={[ styles.periodOption, period === p.key && styles.periodOptionActive, index === PERIODS.length - 1 && { borderBottomWidth: 0 } ]} onPress={() => handlePeriodChange(p.key)} >
                  <Text style={[
                    styles.periodOptionText,
                    period === p.key && styles.periodOptionTextActive
                  ]}>
                    {p.label}
                  </Text>
                </PressableRow>
              ))}
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={40} color={colors.destructive} />
              <Text style={styles.errorText}>{error}</Text>
              <PressableRow style={styles.retryButton} onPress={refreshData} >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </PressableRow>
            </View>
          )}

          <View style={styles.reportTabContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {REPORT_TABS.map((tab) => {
                const isActive = activeReportTab === tab.key;
                return (
                  <PressableRow key={tab.key} style={[styles.reportTab, isActive && styles.reportTabActive]} onPress={() => setActiveReportTab(tab.key)} >
                    <Feather
                      name={tab.icon as any}
                      size={iconSizes.md}
                      color={isActive ? colors.primaryForeground : colors.mutedForeground}
                    />
                    <Text style={[styles.reportTabText, isActive && styles.reportTabTextActive]}>
                      {tab.label}
                    </Text>
                  </PressableRow>
                );
              })}
            </ScrollView>
          </View>

          {isLoading && !summary && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading reports...</Text>
            </View>
          )}

          {activeReportTab === 'overview' && !summary && !isLoading && (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconContainer}>
                <Feather name="bar-chart" size={40} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>No Report Data</Text>
              <Text style={styles.emptyText}>
                Create jobs, quotes, and invoices to generate business reports and insights.
              </Text>
            </View>
          )}

          {activeReportTab === 'overview' && summary && (
            <>
              <Text style={styles.sectionTitle}>KEY METRICS</Text>
              <View style={styles.statsGrid}>
                <View style={styles.heroCard}>
                  <View style={styles.heroStatHeader}>
                    <View style={[styles.statIconContainer, { backgroundColor: colors.successLight }]}>
                      <Feather name="dollar-sign" size={20} color={colors.success} />
                    </View>
                    {summary.revenue.total > 0 && (
                      <View style={[styles.trendBadge, styles.trendBadgeUp]}>
                        <Feather name="trending-up" size={12} color={colors.success} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.heroStatValue}>{formatCurrency(summary.revenue.total)}</Text>
                  <Text style={styles.heroStatTitle}>TOTAL REVENUE</Text>
                  {summary.revenue.gstCollected > 0 && (
                    <Text style={styles.heroStatSub}>GST: {formatCurrency(summary.revenue.gstCollected)}</Text>
                  )}
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <View style={styles.statHeader}>
                      <View style={[styles.statIconContainer, { backgroundColor: colors.warningLight }]}>
                        <Feather name="clock" size={20} color={colors.warning} />
                      </View>
                      {summary.revenue.overdue > 0 && (
                        <View style={[styles.trendBadge, styles.trendBadgeDown]}>
                          <Feather name="alert-circle" size={12} color={colors.destructive} />
                        </View>
                      )}
                    </View>
                    <Text style={styles.statValue}>{formatCurrency(summary.revenue.pending + summary.revenue.overdue)}</Text>
                    <Text style={styles.statTitle}>OUTSTANDING</Text>
                    {summary.invoices.overdue > 0 && (
                      <Text style={styles.statSubValue}>{summary.invoices.overdue} overdue</Text>
                    )}
                  </View>
                  <View style={styles.statCard}>
                    <View style={styles.statHeader}>
                      <View style={styles.statIconContainer}>
                        <Feather name="briefcase" size={20} color={colors.primary} />
                      </View>
                      <View style={[styles.trendBadge, summary.jobs.completed > 0 ? styles.trendBadgeUp : {}]}>
                        <Feather name="check" size={12} color={summary.jobs.completed > 0 ? colors.success : colors.mutedForeground} />
                      </View>
                    </View>
                    <Text style={styles.statValue}>{summary.jobs.completed}</Text>
                    <Text style={styles.statTitle}>JOBS COMPLETED</Text>
                    <Text style={styles.statSubValue}>{summary.jobs.inProgress} in progress</Text>
                  </View>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statCard}>
                    <View style={styles.statHeader}>
                      <View style={[styles.statIconContainer, { backgroundColor: colors.infoLight }]}>
                        <Feather name="file-text" size={20} color={colors.info} />
                      </View>
                      <View style={[styles.trendBadge, conversionRate >= 50 ? styles.trendBadgeUp : conversionRate > 0 ? styles.trendBadgeDown : {}]}>
                        <Feather 
                          name={conversionRate >= 50 ? "trending-up" : "trending-down"} 
                          size={12} 
                          color={conversionRate >= 50 ? colors.success : conversionRate > 0 ? colors.destructive : colors.mutedForeground}
                        />
                      </View>
                    </View>
                    <Text style={styles.statValue}>{conversionRate.toFixed(0)}%</Text>
                    <Text style={styles.statTitle}>QUOTE CONVERSION</Text>
                    <Text style={styles.statSubValue}>{summary.quotes.accepted} of {summary.quotes.total}</Text>
                  </View>
                </View>
              </View>

              {summary.jobs.total > 0 && (
                <View style={styles.chartSection}>
                  <View style={styles.chartHeader}>
                    <Feather name="pie-chart" size={16} color={colors.foreground} />
                    <Text style={styles.chartTitle}>Job Completion Rate</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <SVGDonutChart
                      size={120}
                      colors={colors}
                      segments={[
                        { label: 'Completed', value: summary.jobs.completed, color: colors.success },
                        { label: 'In Progress', value: summary.jobs.inProgress, color: colors.info },
                        { label: 'Other', value: Math.max(0, summary.jobs.total - summary.jobs.completed - summary.jobs.inProgress), color: colors.muted },
                      ].filter(s => s.value > 0)}
                    />
                    <View style={{ flex: 1, gap: spacing.sm }}>
                      {[
                        { label: 'Completed', value: summary.jobs.completed, color: colors.success },
                        { label: 'In Progress', value: summary.jobs.inProgress, color: colors.info },
                        { label: 'Other', value: Math.max(0, summary.jobs.total - summary.jobs.completed - summary.jobs.inProgress), color: colors.muted },
                      ].filter(s => s.value > 0).map((seg, i) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: seg.color }} />
                          <Text style={{ flex: 1, fontSize: typography.sizes.sm, color: colors.foreground }}>{seg.label}</Text>
                          <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground }}>{seg.value}</Text>
                          <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>
                            ({summary.jobs.total > 0 ? ((seg.value / summary.jobs.total) * 100).toFixed(0) : 0}%)
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {monthlyData.length > 0 && (
                <View style={styles.chartSection}>
                  <View style={styles.chartHeader}>
                    <Feather name="bar-chart-2" size={16} color={colors.foreground} />
                    <Text style={styles.chartTitle}>Revenue Trend</Text>
                  </View>
                  <SVGBarChart data={monthlyData} colors={colors} width={SCREEN_WIDTH - pageShell.paddingHorizontal * 2} />
                </View>
              )}

              {summary.jobs.total === 0 && summary.quotes.total === 0 && summary.invoices.total === 0 && (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIconContainer}>
                    <Feather name="bar-chart" size={40} color={colors.mutedForeground} />
                  </View>
                  <Text style={styles.emptyTitle}>No Data Available</Text>
                  <Text style={styles.emptyText}>
                    Create jobs, quotes, and invoices to see your business insights.
                  </Text>
                </View>
              )}

              <View style={styles.overviewSummarySection}>
                <Text style={styles.sectionTitle}>SUMMARY</Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Invoices Paid</Text>
                    <Text style={styles.summaryValue}>{summary.invoices.paid}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Invoices Unpaid</Text>
                    <Text style={styles.summaryValue}>{summary.invoices.unpaid}</Text>
                  </View>
                </View>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total Jobs</Text>
                    <Text style={styles.summaryValue}>{summary.jobs.total}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Total Quotes</Text>
                    <Text style={styles.summaryValue}>{summary.quotes.total}</Text>
                  </View>
                </View>
              </View>

              {stripeData?.available && stripeData.payouts.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>STRIPE PAYOUTS</Text>
                  {stripeData.balance && (
                    <View style={styles.statsRow}>
                      <View style={styles.statCard}>
                        <Text style={styles.statTitle}>AVAILABLE</Text>
                        <Text style={[styles.statValue, { color: colors.success }]}>{formatCurrency(stripeData.balance.available)}</Text>
                      </View>
                      <View style={styles.statCard}>
                        <Text style={styles.statTitle}>PENDING</Text>
                        <Text style={[styles.statValue, { color: colors.warning }]}>{formatCurrency(stripeData.balance.pending)}</Text>
                      </View>
                    </View>
                  )}
                  {stripeData.payouts.slice(0, 5).map((payout) => (
                    <View key={payout.id} style={styles.clientCard}>
                      <View style={[styles.clientRank, { 
                        backgroundColor: payout.status === 'paid' ? colors.successLight : colors.warningLight 
                      }]}>
                        <Feather 
                          name={payout.status === 'paid' ? 'check' : 'clock'} 
                          size={14} 
                          color={payout.status === 'paid' ? colors.success : colors.warning} 
                        />
                      </View>
                      <View style={styles.clientInfo}>
                        <Text style={styles.clientName}>{formatCurrency(payout.amount)}</Text>
                        <Text style={styles.clientMeta}>
                          {payout.arrivalDate 
                            ? new Date(payout.arrivalDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                            : new Date(payout.created).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                          }
                        </Text>
                      </View>
                      <View style={{ 
                        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                        backgroundColor: payout.status === 'paid' ? colors.successLight : colors.warningLight,
                      }}>
                        <Text style={{ 
                          fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, 
                          color: payout.status === 'paid' ? colors.success : colors.warning,
                          textTransform: 'capitalize',
                        }}>
                          {payout.status}
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              )}

              <View style={styles.insightsCard}>
                <View style={styles.insightsIconContainer}>
                  <Feather name="zap" size={40} color={colors.primary} />
                </View>
                <Text style={styles.insightsTitle}>AI Business Insights</Text>
                <Text style={styles.insightsText}>
                  Smart analytics powered by AI will analyze your business trends and provide actionable recommendations.
                </Text>
              </View>
            </>
          )}

          {activeReportTab === 'revenue' && (
            <>
              {revenueReport && monthlyData.length > 0 ? (
                <View style={styles.chartSection}>
                  <View style={styles.chartHeader}>
                    <Feather name="bar-chart-2" size={16} color={colors.foreground} />
                    <Text style={styles.chartTitle}>Revenue Overview</Text>
                    <Text style={styles.chartSubtitle}>{revenueReport.year}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <SVGBarChart data={monthlyData} colors={colors} width={SCREEN_WIDTH - pageShell.paddingHorizontal * 2} />
                  </View>
                  <View style={styles.chartYearTotal}>
                    <Text style={styles.chartYearLabel}>Year Total</Text>
                    <Text style={styles.chartYearValue}>{formatCurrency(revenueReport.yearTotal)}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIconContainer}>
                    <Feather name="bar-chart" size={40} color={colors.mutedForeground} />
                  </View>
                  <Text style={styles.emptyTitle}>No Revenue Data</Text>
                  <Text style={styles.emptyText}>No revenue data available yet</Text>
                </View>
              )}

              {summary && (
                <View style={styles.revenueBreakdownSection}>
                  <Text style={styles.sectionTitle}>REVENUE BREAKDOWN</Text>
                  <View style={styles.breakdownCard}>
                    <View style={styles.breakdownRow}>
                      <View style={styles.breakdownDot} />
                      <Text style={styles.breakdownLabel}>Collected Revenue</Text>
                      <Text style={[styles.breakdownValue, { color: colors.success }]}>{formatCurrency(summary.revenue.total)}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <View style={[styles.breakdownDot, { backgroundColor: colors.warning }]} />
                      <Text style={styles.breakdownLabel}>Pending Revenue</Text>
                      <Text style={[styles.breakdownValue, { color: colors.warning }]}>{formatCurrency(summary.revenue.pending)}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                      <View style={[styles.breakdownDot, { backgroundColor: colors.destructive }]} />
                      <Text style={styles.breakdownLabel}>Overdue Revenue</Text>
                      <Text style={[styles.breakdownValue, { color: colors.destructive }]}>{formatCurrency(summary.revenue.overdue)}</Text>
                    </View>
                    {summary.revenue.gstCollected > 0 && (
                      <View style={[styles.breakdownRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, marginTop: spacing.xs }]}>
                        <View style={[styles.breakdownDot, { backgroundColor: colors.info }]} />
                        <Text style={styles.breakdownLabel}>GST Collected</Text>
                        <Text style={styles.breakdownValue}>{formatCurrency(summary.revenue.gstCollected)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </>
          )}

          {activeReportTab === 'clients' && (
            <>
              {clientReport && clientReport.clients.length > 0 ? (
                <View style={styles.topClientsSection}>
                  <Text style={styles.sectionTitle}>TOP CLIENTS BY REVENUE</Text>
                  {clientReport.clients.slice(0, 10).map((client, index) => (
                    <View key={client.id} style={styles.clientCard}>
                      <View style={styles.clientRank}>
                        <Text style={styles.clientRankText}>{index + 1}</Text>
                      </View>
                      <View style={styles.clientInfo}>
                        <Text style={styles.clientName} numberOfLines={1}>{client.name}</Text>
                        <Text style={styles.clientMeta}>
                          {client.jobsCompleted} jobs  {client.invoicesPaid} invoices paid
                        </Text>
                      </View>
                      <Text style={styles.clientRevenue}>{formatCurrency(client.totalRevenue)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIconContainer}>
                    <Feather name="users" size={40} color={colors.mutedForeground} />
                  </View>
                  <Text style={styles.emptyTitle}>No Client Data</Text>
                  <Text style={styles.emptyText}>No client data available yet</Text>
                </View>
              )}
            </>
          )}

          {activeReportTab === 'profitability' && (
            <>
              {profitabilityReport && profitabilityReport.jobTypes.length > 0 ? (
                <>
                  {(profitabilityReport.best || profitabilityReport.worst) && (
                    <View style={styles.statsRow}>
                      {profitabilityReport.best && (
                        <View style={[styles.statCard, { borderColor: colors.success, borderWidth: 1 }]}>
                          <View style={styles.statHeader}>
                            <View style={[styles.statIconContainer, { backgroundColor: colors.successLight }]}>
                              <Feather name="trending-up" size={20} color={colors.success} />
                            </View>
                          </View>
                          <Text style={[styles.statValue, { color: colors.success }]}>{profitabilityReport.best.avgMargin.toFixed(1)}%</Text>
                          <Text style={styles.statTitle}>BEST PERFORMER</Text>
                          <Text style={styles.statSubValue} numberOfLines={1}>{profitabilityReport.best.jobType}</Text>
                        </View>
                      )}
                      {profitabilityReport.worst && (
                        <View style={[styles.statCard, { borderColor: colors.destructive, borderWidth: 1 }]}>
                          <View style={styles.statHeader}>
                            <View style={[styles.statIconContainer, { backgroundColor: colors.destructiveLight }]}>
                              <Feather name="trending-down" size={20} color={colors.destructive} />
                            </View>
                          </View>
                          <Text style={[styles.statValue, { color: colors.destructive }]}>{profitabilityReport.worst.avgMargin.toFixed(1)}%</Text>
                          <Text style={styles.statTitle}>WORST PERFORMER</Text>
                          <Text style={styles.statSubValue} numberOfLines={1}>{profitabilityReport.worst.jobType}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  <Text style={styles.sectionTitle}>PROFITABILITY BY JOB TYPE</Text>
                  {profitabilityReport.jobTypes.map((jt, index) => {
                    const marginColor = jt.avgMargin > 15 ? colors.success : jt.avgMargin > 5 ? colors.warning : colors.destructive;
                    const marginBg = jt.avgMargin > 15 ? colors.successLight : jt.avgMargin > 5 ? colors.warningLight : colors.destructiveLight;
                    return (
                      <View key={jt.jobType + index} style={styles.clientCard}>
                        <View style={[styles.clientRank, { backgroundColor: marginBg }]}>
                          <Text style={[styles.clientRankText, { color: marginColor }]}>{index + 1}</Text>
                        </View>
                        <View style={styles.clientInfo}>
                          <Text style={styles.clientName} numberOfLines={1}>{jt.jobType}</Text>
                          <Text style={styles.clientMeta}>
                            {jt.jobCount} job{jt.jobCount !== 1 ? 's' : ''}  {jt.totalHours > 0 ? `${jt.totalHours}h` : ''}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
                            <Text style={[styles.clientMeta, { color: colors.foreground, fontWeight: fontWeights.medium }]}>
                              Rev: {formatCurrency(jt.totalRevenue)}
                            </Text>
                            <Text style={[styles.clientMeta, { color: colors.mutedForeground }]}>
                              Cost: {formatCurrency(jt.totalCosts)}
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.clientRevenue, { color: marginColor, fontWeight: fontWeights.bold }]}>{jt.avgMargin.toFixed(1)}%</Text>
                          <Text style={[styles.clientMeta, { color: jt.totalProfit >= 0 ? colors.success : colors.destructive }]}>
                            {formatCurrency(jt.totalProfit)}
                          </Text>
                          {jt.marginChange !== null && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                              <Feather 
                                name={jt.marginChange >= 0 ? 'arrow-up' : 'arrow-down'} 
                                size={10} 
                                color={jt.marginChange >= 0 ? colors.success : colors.destructive} 
                              />
                              <Text style={{ fontSize: typography.sizes.xs, color: jt.marginChange >= 0 ? colors.success : colors.destructive }}>
                                {Math.abs(jt.marginChange).toFixed(1)}%
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </>
              ) : profitabilityReport && profitabilityReport.jobTypes.length === 0 ? (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIconContainer}>
                    <Feather name="trending-up" size={40} color={colors.mutedForeground} />
                  </View>
                  <Text style={styles.emptyTitle}>No Profitability Data</Text>
                  <Text style={styles.emptyText}>
                    Complete jobs with invoices and time tracking to see profitability by job type.
                  </Text>
                </View>
              ) : (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Loading profitability data...</Text>
                </View>
              )}
            </>
          )}

          {activeReportTab === 'aged' && (
            <>
              {agedReceivablesReport ? (
                <>
                  <View style={styles.heroCard}>
                    <View style={styles.heroStatHeader}>
                      <View style={[styles.statIconContainer, { backgroundColor: colors.destructiveLight }]}>
                        <Feather name="alert-circle" size={20} color={colors.destructive} />
                      </View>
                    </View>
                    <Text style={styles.heroStatValue}>{formatCurrency(agedReceivablesReport.grandTotal)}</Text>
                    <Text style={styles.heroStatTitle}>TOTAL OUTSTANDING</Text>
                    <Text style={styles.heroStatSub}>{agedReceivablesReport.invoiceCount} invoice{agedReceivablesReport.invoiceCount !== 1 ? 's' : ''}</Text>
                  </View>

                  <Text style={styles.sectionTitle}>AGING BUCKETS</Text>
                  {([
                    { key: 'current' as const, label: 'Current', color: colors.success },
                    { key: '1-30' as const, label: '1-30 Days', color: colors.info },
                    { key: '31-60' as const, label: '31-60 Days', color: colors.warning },
                    { key: '61-90' as const, label: '61-90 Days', color: colors.destructive },
                    { key: '90+' as const, label: '90+ Days', color: colors.destructive },
                  ]).map((bucket) => {
                    const data = agedReceivablesReport.buckets[bucket.key];
                    const pct = agedReceivablesReport.grandTotal > 0 ? (data.total / agedReceivablesReport.grandTotal) * 100 : 0;
                    return (
                      <View key={bucket.key} style={styles.workerCard}>
                        <View style={styles.workerHeader}>
                          <View>
                            <Text style={styles.workerName}>{bucket.label}</Text>
                            <Text style={styles.workerSubtext}>{data.count} invoice{data.count !== 1 ? 's' : ''}</Text>
                          </View>
                          <Text style={[styles.bucketAmount, { color: bucket.color }]}>{formatCurrency(data.total)}</Text>
                        </View>
                        <View style={styles.progressBarContainer}>
                          <View style={[styles.progressBar, { width: `${Math.min(pct, 100)}%`, backgroundColor: bucket.color }]} />
                        </View>
                      </View>
                    );
                  })}

                  {agedReceivablesReport.clientBreakdown.length > 0 && (
                    <>
                      <Text style={styles.sectionTitle}>CLIENT BREAKDOWN</Text>
                      {agedReceivablesReport.clientBreakdown.slice(0, 10).map((client, index) => (
                        <View key={client.clientId} style={styles.clientCard}>
                          <View style={styles.clientRank}>
                            <Text style={styles.clientRankText}>{index + 1}</Text>
                          </View>
                          <View style={styles.clientInfo}>
                            <Text style={styles.clientName} numberOfLines={1}>{client.clientName}</Text>
                            <Text style={styles.clientMeta}>{client.count} invoice{client.count !== 1 ? 's' : ''}</Text>
                          </View>
                          <Text style={[styles.clientRevenue, { color: colors.destructive }]}>{formatCurrency(client.total)}</Text>
                        </View>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIconContainer}>
                    <Feather name="clock" size={40} color={colors.mutedForeground} />
                  </View>
                  <Text style={styles.emptyTitle}>No Receivables Data</Text>
                  <Text style={styles.emptyText}>No outstanding invoices to display.</Text>
                </View>
              )}
            </>
          )}

          {activeReportTab === 'payroll' && (
            <>
              {payrollReport && payrollReport.workers.length > 0 ? (
                <>
                  <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                      <View style={styles.statHeader}>
                        <View style={[styles.statIconContainer, { backgroundColor: colors.successLight }]}>
                          <Feather name="dollar-sign" size={20} color={colors.success} />
                        </View>
                      </View>
                      <Text style={styles.statValue}>{formatCurrency(payrollReport.totals.totalPay)}</Text>
                      <Text style={styles.statTitle}>TOTAL PAY</Text>
                    </View>
                    <View style={styles.statCard}>
                      <View style={styles.statHeader}>
                        <View style={styles.statIconContainer}>
                          <Feather name="clock" size={20} color={colors.primary} />
                        </View>
                      </View>
                      <Text style={styles.statValue}>{payrollReport.totals.totalHours.toFixed(1)}h</Text>
                      <Text style={styles.statTitle}>TOTAL HOURS</Text>
                    </View>
                  </View>
                  <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                      <View style={styles.statHeader}>
                        <View style={[styles.statIconContainer, { backgroundColor: colors.infoLight }]}>
                          <Feather name="users" size={20} color={colors.info} />
                        </View>
                      </View>
                      <Text style={styles.statValue}>{payrollReport.totals.workerCount}</Text>
                      <Text style={styles.statTitle}>WORKERS</Text>
                      {payrollReport.totals.subcontractorCount > 0 && (
                        <Text style={styles.statSubValue}>{payrollReport.totals.subcontractorCount} subcontractor{payrollReport.totals.subcontractorCount !== 1 ? 's' : ''}</Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                      <View style={styles.statHeader}>
                        <View style={[styles.statIconContainer, { backgroundColor: colors.successLight }]}>
                          <Feather name="check-circle" size={20} color={colors.success} />
                        </View>
                      </View>
                      <Text style={styles.statValue}>{formatCurrency(payrollReport.totals.totalPaid)}</Text>
                      <Text style={styles.statTitle}>PAID</Text>
                      <Text style={styles.statSubValue}>{payrollReport.totals.paidCount} worker{payrollReport.totals.paidCount !== 1 ? 's' : ''}</Text>
                    </View>
                    <View style={styles.statCard}>
                      <View style={styles.statHeader}>
                        <View style={[styles.statIconContainer, { backgroundColor: colors.warningLight }]}>
                          <Feather name="alert-circle" size={20} color={colors.warning} />
                        </View>
                      </View>
                      <Text style={styles.statValue}>{formatCurrency(payrollReport.totals.totalOutstanding)}</Text>
                      <Text style={styles.statTitle}>OUTSTANDING</Text>
                      <Text style={styles.statSubValue}>{payrollReport.totals.outstandingCount} worker{payrollReport.totals.outstandingCount !== 1 ? 's' : ''}</Text>
                    </View>
                  </View>

                  <Text style={styles.sectionTitle}>WORKER BREAKDOWN</Text>
                  {payrollReport.workers.map((worker) => {
                    const billablePct = worker.totalHours > 0 ? (worker.billableHours / worker.totalHours) * 100 : 0;
                    const payslipBusy = payslipBusyId === worker.payrollPaymentId;
                    return (
                      <View key={worker.teamMemberId} style={styles.workerCard}>
                        <View style={styles.workerHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.workerName}>{worker.firstName} {worker.lastName}</Text>
                            <Text style={styles.workerSubtext}>
                              ${worker.hourlyRate}/hr{worker.isSubcontractor ? ' (Sub)' : ''}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.bucketAmount, { color: colors.success }]}>{formatCurrency(worker.grossPay)}</Text>
                            {worker.paid && (
                              <View style={{
                                flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2,
                                paddingHorizontal: spacing.sm, paddingVertical: 2,
                                borderRadius: radius.pill, backgroundColor: colors.success + '20',
                              }}>
                                <Feather name="check" size={11} color={colors.success} />
                                <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: colors.success }}>Paid</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={styles.workerStatsRow}>
                          <View style={styles.workerStat}>
                            <Text style={styles.workerStatValue}>{worker.regularHours.toFixed(1)}h</Text>
                            <Text style={styles.workerStatLabel}>Regular</Text>
                          </View>
                          <View style={styles.workerStat}>
                            <Text style={styles.workerStatValue}>{worker.overtimeHours.toFixed(1)}h</Text>
                            <Text style={styles.workerStatLabel}>Overtime</Text>
                          </View>
                          <View style={styles.workerStat}>
                            <Text style={styles.workerStatValue}>{billablePct.toFixed(0)}%</Text>
                            <Text style={styles.workerStatLabel}>Billable</Text>
                          </View>
                        </View>
                        <View style={[styles.progressBarContainer, { marginTop: spacing.sm }]}>
                          <View style={[styles.progressBar, { width: `${Math.min(billablePct, 100)}%`, backgroundColor: billablePct >= 70 ? colors.success : billablePct >= 40 ? colors.warning : colors.destructive }]} />
                        </View>
                        {!!worker.travelAllowance && worker.travelAllowance > 0 && (
                          <View style={{
                            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                            marginTop: spacing.sm, paddingTop: spacing.sm,
                            borderTopWidth: 1, borderTopColor: colors.border,
                          }}>
                            <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>
                              Travel Allowance{worker.totalDistanceKm ? ` (${(Math.round((worker.totalDistanceKm) * 10) / 10).toFixed(1)} km)` : ''}
                            </Text>
                            <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                              {formatCurrency(worker.travelAllowance)}
                            </Text>
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                          {worker.paid ? (
                            <TouchableOpacity
                              style={{
                                flex: 1, backgroundColor: colors.muted, borderRadius: radius.md,
                                paddingVertical: spacing.sm, alignItems: 'center',
                              }}
                              onPress={() => worker.payrollPaymentId && downloadPayslip(worker.payrollPaymentId)}
                              disabled={payslipBusy || !worker.payrollPaymentId}
                              activeOpacity={0.7}
                            >
                              <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                                {payslipBusy ? '...' : 'Payslip'}
                              </Text>
                            </TouchableOpacity>
                          ) : worker.grossPay > 0 ? (
                            <TouchableOpacity
                              style={{
                                flex: 1, backgroundColor: colors.success + '15', borderRadius: radius.md,
                                paddingVertical: spacing.sm, alignItems: 'center',
                              }}
                              onPress={() => openPayrollPay(worker)}
                              activeOpacity={0.7}
                            >
                              <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.success }}>Pay</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}

                  <AppBottomSheet
                    visible={!!payWorker}
                    onDismiss={() => setPayWorker(null)}
                    snapPoints={['75%']}
                    scrollable
                  >
                    <KeyboardAvoidingView style={{ width: '100%' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                      <Text style={{ fontSize: typography.sizes.lg, fontWeight: fontWeights.bold, color: colors.foreground, marginBottom: spacing.xs }}>
                        Pay Worker
                      </Text>
                      {payWorker && (
                        <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, marginBottom: spacing.md }}>
                          {payWorker.firstName} {payWorker.lastName} · {formatCurrency(payWorker.grossPay)}
                        </Text>
                      )}

                      <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: spacing.xs }}>Method</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
                        {PAYROLL_PAY_METHODS.map((m) => (
                          <TouchableOpacity
                            key={m.value}
                            onPress={() => setPayMethod(m.value)}
                            activeOpacity={0.7}
                            style={{
                              paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
                              borderRadius: radius.pill, borderWidth: 1,
                              borderColor: payMethod === m.value ? colors.primary : colors.border,
                              backgroundColor: payMethod === m.value ? colors.primary + '15' : 'transparent',
                            }}
                          >
                            <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: payMethod === m.value ? colors.primary : colors.mutedForeground }}>
                              {m.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: spacing.xs }}>Reference</Text>
                      <TextInput
                        style={{
                          borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
                          paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.foreground,
                          marginBottom: spacing.md, backgroundColor: colors.background,
                        }}
                        value={payReference}
                        onChangeText={setPayReference}
                        placeholder="e.g. bank transfer ref"
                        placeholderTextColor={colors.mutedForeground}
                      />

                      <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: spacing.xs }}>Notes</Text>
                      <TextInput
                        style={{
                          borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
                          paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.foreground,
                          marginBottom: spacing.lg, backgroundColor: colors.background, minHeight: 70, textAlignVertical: 'top',
                        }}
                        value={payNotes}
                        onChangeText={setPayNotes}
                        placeholder="Optional notes"
                        placeholderTextColor={colors.mutedForeground}
                        multiline
                      />

                      <SheetButton
                        label="Pay & Send Payslip"
                        onPress={submitPayrollPay}
                        loading={paySubmitting}
                        fullWidth
                      />
                      <View style={{ height: spacing.md }} />
                      <SheetButton label="Cancel" variant="outline" onPress={() => setPayWorker(null)} fullWidth />
                    </KeyboardAvoidingView>
                  </AppBottomSheet>
                </>
              ) : payrollReport && payrollReport.workers.length === 0 ? (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIconContainer}>
                    <Feather name="credit-card" size={40} color={colors.mutedForeground} />
                  </View>
                  <Text style={styles.emptyTitle}>No Payroll Data</Text>
                  <Text style={styles.emptyText}>Add team members and track time to see payroll data.</Text>
                </View>
              ) : (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Loading payroll data...</Text>
                </View>
              )}
            </>
          )}

          {activeReportTab === 'utilisation' && (
            <>
              {utilisationReport && utilisationReport.workers.length > 0 ? (
                <>
                  <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                      <View style={styles.statHeader}>
                        <View style={[styles.statIconContainer, { backgroundColor: utilisationReport.averageUtilisation >= 60 ? colors.successLight : colors.warningLight }]}>
                          <Feather name="activity" size={20} color={utilisationReport.averageUtilisation >= 60 ? colors.success : colors.warning} />
                        </View>
                      </View>
                      <Text style={styles.statValue}>{utilisationReport.averageUtilisation.toFixed(1)}%</Text>
                      <Text style={styles.statTitle}>AVG UTILISATION</Text>
                    </View>
                    <View style={styles.statCard}>
                      <View style={styles.statHeader}>
                        <View style={[styles.statIconContainer, { backgroundColor: colors.successLight }]}>
                          <Feather name="dollar-sign" size={20} color={colors.success} />
                        </View>
                      </View>
                      <Text style={styles.statValue}>{formatCurrency(utilisationReport.totalRevenue)}</Text>
                      <Text style={styles.statTitle}>TOTAL REVENUE</Text>
                    </View>
                  </View>
                  <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                      <View style={styles.statHeader}>
                        <View style={[styles.statIconContainer, { backgroundColor: colors.destructiveLight }]}>
                          <Feather name="minus-circle" size={20} color={colors.destructive} />
                        </View>
                      </View>
                      <Text style={styles.statValue}>{utilisationReport.totalIdleHours.toFixed(1)}h</Text>
                      <Text style={styles.statTitle}>IDLE HOURS</Text>
                    </View>
                    <View style={styles.statCard}>
                      <View style={styles.statHeader}>
                        <View style={[styles.statIconContainer, { backgroundColor: colors.warningLight }]}>
                          <Feather name="briefcase" size={20} color={colors.warning} />
                        </View>
                      </View>
                      <Text style={styles.statValue}>{formatCurrency(utilisationReport.totalLabourCost)}</Text>
                      <Text style={styles.statTitle}>LABOUR COST</Text>
                    </View>
                  </View>

                  <Text style={styles.sectionTitle}>TEAM UTILISATION</Text>
                  {utilisationReport.workers.map((worker) => {
                    const utilColor = worker.utilisation >= 75 ? colors.success : worker.utilisation >= 50 ? colors.warning : colors.destructive;
                    return (
                      <View key={worker.teamMemberId} style={styles.workerCard}>
                        <View style={styles.workerHeader}>
                          <View>
                            <Text style={styles.workerName}>{worker.firstName} {worker.lastName}</Text>
                            <Text style={styles.workerSubtext}>{worker.jobsCompleted} job{worker.jobsCompleted !== 1 ? 's' : ''} completed</Text>
                          </View>
                          <Text style={[styles.utilisationPercent, { color: utilColor }]}>{worker.utilisation.toFixed(1)}%</Text>
                        </View>
                        <View style={styles.utilisationBar}>
                          <View style={styles.utilisationBarTrack}>
                            <View style={[styles.utilisationBarFill, { width: `${Math.min(worker.utilisation, 100)}%`, backgroundColor: utilColor }]} />
                          </View>
                        </View>
                        <View style={styles.workerStatsRow}>
                          <View style={styles.workerStat}>
                            <Text style={styles.workerStatValue}>{worker.hoursWorked.toFixed(1)}h</Text>
                            <Text style={styles.workerStatLabel}>Worked</Text>
                          </View>
                          <View style={styles.workerStat}>
                            <Text style={styles.workerStatValue}>{worker.billableHours.toFixed(1)}h</Text>
                            <Text style={styles.workerStatLabel}>Billable</Text>
                          </View>
                          <View style={styles.workerStat}>
                            <Text style={styles.workerStatValue}>{worker.revenuePerHour > 0 ? `$${worker.revenuePerHour.toFixed(0)}` : '-'}</Text>
                            <Text style={styles.workerStatLabel}>$/hr</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </>
              ) : utilisationReport && utilisationReport.workers.length === 0 ? (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIconContainer}>
                    <Feather name="activity" size={40} color={colors.mutedForeground} />
                  </View>
                  <Text style={styles.emptyTitle}>No Utilisation Data</Text>
                  <Text style={styles.emptyText}>Add team members and track time to see utilisation metrics.</Text>
                </View>
              ) : (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Loading utilisation data...</Text>
                </View>
              )}
            </>
          )}

          {activeReportTab === 'export' && (
            <View style={styles.quickReportsSection}>
              <Text style={styles.sectionTitle}>EXPORT REPORTS</Text>
              <Text style={[styles.emptyText, { marginBottom: spacing.md, textAlign: 'left' }]}>
                Choose a report to share or export as CSV or text.
              </Text>
              
              <PressableRow style={styles.reportCard} onPress={() => handleReportDownload('income')} >
                <View style={[styles.reportCardIcon, { backgroundColor: colors.successLight }]}>
                  <Feather name="dollar-sign" size={20} color={colors.success} />
                </View>
                <View style={styles.reportCardContent}>
                  <Text style={styles.reportCardTitle}>Income Report</Text>
                  <Text style={styles.reportCardSubtitle}>Detailed breakdown of all income</Text>
                </View>
                <Feather name="share" size={iconSizes.lg} color={colors.mutedForeground} />
              </PressableRow>

              <PressableRow style={styles.reportCard} onPress={() => handleReportDownload('jobs')} >
                <View style={styles.reportCardIcon}>
                  <Feather name="briefcase" size={20} color={colors.primary} />
                </View>
                <View style={styles.reportCardContent}>
                  <Text style={styles.reportCardTitle}>Jobs Report</Text>
                  <Text style={styles.reportCardSubtitle}>Jobs by status and completion rate</Text>
                </View>
                <Feather name="share" size={iconSizes.lg} color={colors.mutedForeground} />
              </PressableRow>

              <PressableRow style={styles.reportCard} onPress={() => handleReportDownload('quotes')} >
                <View style={[styles.reportCardIcon, { backgroundColor: colors.infoLight }]}>
                  <Feather name="file-text" size={20} color={colors.info} />
                </View>
                <View style={styles.reportCardContent}>
                  <Text style={styles.reportCardTitle}>Quotes Report</Text>
                  <Text style={styles.reportCardSubtitle}>Quote conversion and acceptance rates</Text>
                </View>
                <Feather name="share" size={iconSizes.lg} color={colors.mutedForeground} />
              </PressableRow>

              <PressableRow style={styles.reportCard} onPress={() => handleReportDownload('tax')} >
                <View style={[styles.reportCardIcon, { backgroundColor: colors.warningLight }]}>
                  <Feather name="percent" size={20} color={colors.warning} />
                </View>
                <View style={styles.reportCardContent}>
                  <Text style={styles.reportCardTitle}>Tax Summary</Text>
                  <Text style={styles.reportCardSubtitle}>GST collected and payable</Text>
                </View>
                <Feather name="share" size={iconSizes.lg} color={colors.mutedForeground} />
              </PressableRow>

              <PressableRow style={[styles.reportCard, { marginTop: spacing.sm }]} onPress={handleExport} >
                <View style={[styles.reportCardIcon, { backgroundColor: colors.primaryLight }]}>
                  <Feather name="share-2" size={20} color={colors.primary} />
                </View>
                <View style={styles.reportCardContent}>
                  <Text style={styles.reportCardTitle}>Full Summary</Text>
                  <Text style={styles.reportCardSubtitle}>Share complete business summary</Text>
                </View>
                <Feather name="share" size={iconSizes.lg} color={colors.mutedForeground} />
              </PressableRow>
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}

export default function ReportsScreen() {
  return (
    <OwnerOnlyGuard requiredPermission={['view_reports', 'read_reports']}>
      <ReportsScreenInner />
    </OwnerOnlyGuard>
  );
}
