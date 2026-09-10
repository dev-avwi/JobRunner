/**
 * FinancialsSection — per-job profit and margin summary for owners/managers.
 * Shows quoted value, actual costs by category, gross profit, margin, and
 * a collapsible phase-level cost breakdown when phase data is available.
 *
 * Visible only to owner / manager roles — enforced by the caller.
 */
import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemeColors } from '../../lib/theme';
import { spacing, radius, typography, fontWeights, shadows, iconSizes } from '../../lib/design-tokens';
import { formatCurrency } from '../../lib/format';
import { SkeletonSection } from '../Skeleton';
import type { JobPhase } from './PhasesSection';

// ---------------------------------------------------------------------------
// Types (mirrored from the normalised profitabilityData shape in [id].tsx)
// ---------------------------------------------------------------------------

interface PhaseFinancials {
  id: string | null;
  phaseCode: string | null;
  name: string;
  status: string | null;
  budgetedCost?: number | null;
  costs: {
    labour: number;
    subcontractor: number;
    materials: number;
    expenses: number;
    purchaseOrders: number;
    total: number;
  };
  hours: number;
  variations: { approvedTotal: number; pendingTotal: number };
}

interface ProfitabilityData {
  jobId: string;
  jobTitle: string;
  jobStatus: string;
  clientName: string;
  quoted: { amount: number; gst: number; quoteNumber: string } | null;
  revenue: { invoiced: number; pending: number; received: number };
  costs: {
    labour: number;
    subcontractor: number;
    materials: number;
    otherExpenses: number;
    expenses?: number;
    total: number;
  };
  variations: { approvedTotal: number; approvedCount: number; pendingTotal: number; pendingCount: number };
  purchaseOrders: { total: number; count: number };
  profit: { amount: number; margin: number; vsQuote: number | null; isNegative?: boolean };
  hours: { total: number; billable: number; nonBillable: number; estimated?: number };
  labourOverrun?: boolean;
  status: 'profitable' | 'tight' | 'loss';
  materials: Array<{ id: string; name: string; quantity: number; unitCost: number; totalCost: number; supplier: string; status: string }>;
  phases?: PhaseFinancials[];
  retentionSummary?: {
    sumRetentionHeld: number;
    outstandingRetention: number;
    hasReleasePending: boolean;
    retentionStatus: string;
    releaseDate: string | null;
  };
}

interface Props {
  profitabilityData: ProfitabilityData | null;
  isLoading: boolean;
  /** All phases loaded for this job — used to enrich phase names/status when available */
  phases: JobPhase[];
  colors: ThemeColors;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(status: 'profitable' | 'tight' | 'loss' | undefined, colors: ThemeColors): string {
  if (status === 'profitable') return colors.success;
  if (status === 'tight') return colors.warning;
  return colors.destructive;
}

function statusLabel(status: 'profitable' | 'tight' | 'loss' | undefined): string {
  if (status === 'profitable') return 'Profitable';
  if (status === 'tight') return 'Tight margin';
  return 'Running at a loss';
}

function phaseBudgetStatus(actual: number, budget: number | null | undefined): 'green' | 'amber' | 'red' | 'none' {
  if (!budget || budget <= 0) return 'none';
  if (actual > budget * 1.05) return 'red';
  if (actual > budget * 0.9) return 'amber';
  return 'green';
}

function phaseBudgetColor(st: 'green' | 'amber' | 'red' | 'none', colors: ThemeColors): string {
  if (st === 'green') return colors.success;
  if (st === 'amber') return colors.warning;
  if (st === 'red') return colors.destructive;
  return colors.mutedForeground;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Single label → value row */
function Row({
  label,
  value,
  valueColor,
  valueStyle,
  bold,
  sub,
  colors,
}: {
  label: string;
  value: string;
  valueColor?: string;
  valueStyle?: object;
  bold?: boolean;
  sub?: boolean;
  colors: ThemeColors;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{
        fontSize: sub ? typography.captionSmall.fontSize : typography.button.fontSize,
        color: colors.mutedForeground,
        paddingLeft: sub ? spacing.md : 0,
      }}>
        {label}
      </Text>
      <Text style={{
        fontSize: sub ? typography.button.fontSize : typography.body.fontSize,
        fontWeight: bold ? fontWeights.bold : fontWeights.medium,
        color: valueColor ?? colors.foreground,
        ...valueStyle,
      }}>
        {value}
      </Text>
    </View>
  );
}

/** Divider */
function Divider({ colors }: { colors: ThemeColors }) {
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />;
}

// ---------------------------------------------------------------------------
// Phase row
// ---------------------------------------------------------------------------

function PhaseRow({
  phase,
  colors,
}: {
  phase: PhaseFinancials;
  colors: ThemeColors;
}) {
  const [expanded, setExpanded] = useState(false);
  const actual = phase.costs.total;
  const budget = phase.budgetedCost ?? null;
  const bst = phaseBudgetStatus(actual, budget);
  const bColor = phaseBudgetColor(bst, colors);
  const variance = budget !== null ? actual - budget : null;

  return (
    <View style={{
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      backgroundColor: colors.card,
    }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setExpanded(v => !v)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.md,
          gap: spacing.sm,
        }}
      >
        {/* Budget status dot */}
        {bst !== 'none' && (
          <View style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: bColor,
            marginRight: 2,
          }} />
        )}

        {/* Phase name / code */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }} numberOfLines={1}>
            {phase.phaseCode ? `${phase.phaseCode} — ${phase.name}` : phase.name}
          </Text>
          {budget !== null && (
            <Text style={{ fontSize: typography.captionSmall.fontSize, color: bColor, marginTop: 1 }}>
              {bst === 'green' ? 'Within budget' : bst === 'amber' ? 'Near limit' : 'Over budget'}
              {variance !== null ? ` (${variance >= 0 ? '+' : ''}${formatCurrency(variance)})` : ''}
            </Text>
          )}
        </View>

        {/* Actual cost */}
        <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: bst === 'red' ? colors.destructive : colors.foreground }}>
          {formatCurrency(actual)}
        </Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mutedForeground} />
      </TouchableOpacity>

      {expanded && (
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.xs }}>
          <Divider colors={colors} />
          {budget !== null && (
            <Row label="Budget" value={formatCurrency(budget)} colors={colors} />
          )}
          {phase.costs.labour > 0 && (
            <Row label="Labour" value={formatCurrency(phase.costs.labour)} sub colors={colors} />
          )}
          {phase.costs.subcontractor > 0 && (
            <Row label="Subcontractor" value={formatCurrency(phase.costs.subcontractor)} sub colors={colors} />
          )}
          {phase.costs.materials > 0 && (
            <Row label="Materials" value={formatCurrency(phase.costs.materials)} sub colors={colors} />
          )}
          {phase.costs.expenses > 0 && (
            <Row label="Expenses" value={formatCurrency(phase.costs.expenses)} sub colors={colors} />
          )}
          {phase.variations.approvedTotal > 0 && (
            <Row label="Variations (approved)" value={formatCurrency(phase.variations.approvedTotal)} sub colors={colors} />
          )}
          {phase.hours > 0 && (
            <Row label="Hours logged" value={`${phase.hours.toFixed(1)} hrs`} sub colors={colors} />
          )}
          <Divider colors={colors} />
          {/* phase.costs.total = labour + subcontractor + materials + expenses (POs excluded) */}
          <Row label="Total cost" value={formatCurrency(actual)} bold colors={colors} />
          {phase.costs.purchaseOrders > 0 && (
            <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: spacing.xs }}>
              + {formatCurrency(phase.costs.purchaseOrders)} committed (POs, not in total)
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FinancialsSection({ profitabilityData: pd, isLoading, colors }: Props) {
  const sc = statusColor(pd?.status, colors);
  const marginCapped = pd ? Math.min(Math.max(pd.profit.margin, 0), 100) : 0;

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <View style={{
        backgroundColor: colors.card,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        padding: spacing.lg,
        ...shadows.sm,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm }}>
          <View style={{ width: 32, height: 32, borderRadius: radius.md, backgroundColor: colors.muted }} />
          <View style={{ width: 100, height: 16, borderRadius: radius.sm, backgroundColor: colors.muted }} />
        </View>
        <SkeletonSection rows={4} />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------
  if (!pd) {
    return (
      <View style={{
        backgroundColor: colors.card,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        padding: spacing.lg,
        alignItems: 'center',
        gap: spacing.sm,
        ...shadows.sm,
      }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${colors.success}15`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs }}>
          <Feather name="bar-chart-2" size={22} color={colors.success} />
        </View>
        <Text style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>
          No financial data yet
        </Text>
        <Text style={{ fontSize: typography.caption.fontSize, color: colors.mutedForeground, textAlign: 'center', lineHeight: 18 }}>
          Create invoices and track costs to see profitability figures here.
        </Text>
      </View>
    );
  }

  const hasRevenue = pd.revenue.invoiced > 0 || pd.revenue.pending > 0;
  const hasCosts = pd.costs.total > 0;
  const hasData = hasRevenue || hasCosts;

  // ---------------------------------------------------------------------------
  // Summary card
  // ---------------------------------------------------------------------------
  return (
    <View style={{ gap: spacing.md }}>
      {/* ── Summary card ── */}
      <View style={{
        backgroundColor: colors.card,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: pd.profit.isNegative ? `${colors.destructive}50` : colors.cardBorder,
        padding: spacing.lg,
        ...shadows.sm,
      }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm }}>
          <View style={{ width: 34, height: 34, borderRadius: radius.md, backgroundColor: `${sc}15`, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name={pd.profit.isNegative ? 'trending-down' : 'trending-up'} size={iconSizes.md} color={sc} />
          </View>
          <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground, flex: 1 }}>
            Financials
          </Text>
          {hasData && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: `${sc}15`, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: sc }} />
              <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: sc }}>
                {statusLabel(pd.status)}
              </Text>
            </View>
          )}
        </View>

        {/* Metric row — 3 headline numbers */}
        {hasData && (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            {[
              { label: 'Revenue', value: formatCurrency(pd.revenue.invoiced), color: colors.foreground },
              { label: 'Costs', value: formatCurrency(pd.costs.total), color: colors.foreground },
              {
                label: 'Margin',
                value: `${pd.profit.margin.toFixed(1)}%`,
                color: sc,
              },
            ].map(item => (
              <View key={item.label} style={{ flex: 1, backgroundColor: colors.muted, borderRadius: radius.lg, padding: spacing.sm, alignItems: 'center' }}>
                <Text style={{ fontSize: typography.sizes.lg, fontWeight: fontWeights.bold, color: item.color }}>{item.value}</Text>
                <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 }}>{item.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Margin bar */}
        {hasData && (
          <View style={{ height: 6, backgroundColor: colors.muted, borderRadius: 3, overflow: 'hidden', marginBottom: spacing.md }}>
            <View style={{ width: `${marginCapped}%` as any, height: '100%', backgroundColor: sc, borderRadius: 3 }} />
          </View>
        )}

        {/* Quoted / contract value */}
        {pd.quoted?.amount ? (
          <>
            <Row label="Quoted value" value={formatCurrency(pd.quoted.amount)} colors={colors} />
            {pd.variations.approvedTotal > 0 && (
              <Row label="+ Approved variations" value={formatCurrency(pd.variations.approvedTotal)} colors={colors} />
            )}
            {(pd.quoted.amount + pd.variations.approvedTotal) !== pd.quoted.amount && pd.variations.approvedTotal > 0 && (
              <Row
                label="Revised contract"
                value={formatCurrency(pd.quoted.amount + pd.variations.approvedTotal)}
                bold
                colors={colors}
              />
            )}
            <Divider colors={colors} />
          </>
        ) : null}

        {/* Revenue rows */}
        <Row label="Revenue invoiced" value={formatCurrency(pd.revenue.invoiced)} colors={colors} />
        {pd.revenue.pending > 0 && (
          <Row label="Pending invoices" value={formatCurrency(pd.revenue.pending)} colors={colors} />
        )}

        <Divider colors={colors} />

        {/* Cost breakdown — rows must reconcile with costs.total */}
        <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: spacing.sm }}>
          Costs
        </Text>
        <View style={{ gap: spacing.xs }}>
          {pd.costs.labour > 0 && (
            <Row
              label={`Labour${pd.hours.total > 0 ? ` (${pd.hours.total.toFixed(1)} hrs)` : ''}`}
              value={formatCurrency(pd.costs.labour)}
              valueColor={pd.labourOverrun ? colors.warning : undefined}
              sub
              colors={colors}
            />
          )}
          {pd.costs.subcontractor > 0 && (
            <Row label="Subcontractor" value={formatCurrency(pd.costs.subcontractor)} sub colors={colors} />
          )}
          {pd.costs.materials > 0 && (
            <Row label="Materials" value={formatCurrency(pd.costs.materials)} sub colors={colors} />
          )}
          {pd.costs.otherExpenses > 0 && (
            <Row label="Expenses" value={formatCurrency(pd.costs.otherExpenses)} sub colors={colors} />
          )}
        </View>
        <Divider colors={colors} />
        <Row label="Total costs" value={formatCurrency(pd.costs.total)} bold colors={colors} />

        {/* Purchase orders — committed spend, excluded from costs.total to avoid double-counting */}
        {pd.purchaseOrders.total > 0 && (
          <>
            <Divider colors={colors} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground }}>
                  Committed spend (POs)
                </Text>
                <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: 1 }}>
                  {pd.purchaseOrders.count} purchase order{pd.purchaseOrders.count !== 1 ? 's' : ''} — not included in costs above
                </Text>
              </View>
              <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.medium, color: colors.mutedForeground }}>
                {formatCurrency(pd.purchaseOrders.total)}
              </Text>
            </View>
          </>
        )}

        <Divider colors={colors} />

        {/* Profit */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.bold, color: colors.foreground }}>
            Gross Profit
          </Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: typography.sizes.lg, fontWeight: fontWeights.bold, color: sc }}>
              {formatCurrency(pd.profit.amount)}
            </Text>
            <Text style={{ fontSize: typography.caption.fontSize, fontWeight: fontWeights.semibold, color: sc }}>
              {pd.profit.margin.toFixed(1)}% margin
            </Text>
          </View>
        </View>

        {/* Labour overrun callout */}
        {pd.labourOverrun && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            backgroundColor: `${colors.warning}18`,
            borderRadius: radius.md,
            padding: spacing.sm,
            marginTop: spacing.md,
            borderWidth: 1,
            borderColor: `${colors.warning}40`,
          }}>
            <Feather name="alert-triangle" size={13} color={colors.warning} />
            <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.warning, flex: 1, lineHeight: 16 }}>
              Labour hours are tracking over estimate
              {pd.hours.estimated ? ` — ${pd.hours.total.toFixed(1)} of ${pd.hours.estimated.toFixed(1)} hrs estimated` : ''}
            </Text>
          </View>
        )}

        {/* Pending variations callout */}
        {pd.variations.pendingTotal > 0 && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            backgroundColor: `${colors.primary}10`,
            borderRadius: radius.md,
            padding: spacing.sm,
            marginTop: spacing.md,
            borderWidth: 1,
            borderColor: `${colors.primary}30`,
          }}>
            <Feather name="clock" size={13} color={colors.primary} />
            <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.primary, flex: 1, lineHeight: 16 }}>
              {pd.variations.pendingCount} pending variation{pd.variations.pendingCount !== 1 ? 's' : ''} totalling {formatCurrency(pd.variations.pendingTotal)}
            </Text>
          </View>
        )}
      </View>

      {/* ── Phase breakdown ── */}
      {pd.phases && pd.phases.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <Text style={{
            fontSize: typography.sizes.xs,
            fontWeight: fontWeights.bold,
            color: colors.mutedForeground,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            Phase Costs
          </Text>
          {pd.phases.map((phase, idx) => (
            <PhaseRow
              key={phase.id ?? `unallocated-${idx}`}
              phase={phase}
              colors={colors}
            />
          ))}
        </View>
      )}
    </View>
  );
}
