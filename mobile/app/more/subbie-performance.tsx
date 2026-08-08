import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors, colorWithOpacity } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, fontWeights } from '../../src/lib/design-tokens';
import { formatCurrency } from '../../src/lib/format';
import api from '../../src/lib/api';

interface PerformanceData {
  earningsWeek: number;
  earningsMonth: number;
  hoursMonth: number;
  jobsCompletedMonth: number;
  earningsByBusiness: { businessName: string; amount: number; hours: number }[];
  earningsTrend: { period: string; earnings: number; hours: number }[];
}

function shortCurrency(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `$${Math.round(value)}`;
}

export default function SubbiePerformance() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.get<PerformanceData>('/api/subcontractor/dashboard');
      setData(res.data || null);
    } catch {
      // leave data as-is; render handles null
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const maxTrend = useMemo(() => {
    if (!data?.earningsTrend?.length) return 0;
    return Math.max(...data.earningsTrend.map(t => t.earnings ?? 0), 0);
  }, [data]);

  const totalByBusiness = useMemo(() => {
    if (!data?.earningsByBusiness?.length) return 0;
    return data.earningsByBusiness.reduce((sum, b) => sum + (b.amount ?? 0), 0);
  }, [data]);

  const stats = [
    {
      label: 'Earned This Month',
      value: formatCurrency(data?.earningsMonth ?? 0),
      icon: 'dollar-sign' as const,
      tint: colors.success,
      bg: colors.successLight,
    },
    {
      label: 'Earned This Week',
      value: formatCurrency(data?.earningsWeek ?? 0),
      icon: 'trending-up' as const,
      tint: colors.primary,
      bg: colorWithOpacity(colors.primary, 0.12),
    },
    {
      label: 'Hours This Month',
      value: `${(data?.hoursMonth ?? 0).toFixed(1)}h`,
      icon: 'clock' as const,
      tint: colors.info,
      bg: colors.infoLight,
    },
    {
      label: 'Jobs Completed',
      value: `${data?.jobsCompletedMonth ?? 0}`,
      icon: 'check-circle' as const,
      tint: colors.warning,
      bg: colors.warningLight,
    },
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Performance</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing['3xl'] }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Headline stats */}
          <View style={styles.statGrid}>
            {stats.map((s, i) => (
              <View key={i} style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: s.bg }]}>
                  <Feather name={s.icon} size={iconSizes.xl} color={s.tint} />
                </View>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Earnings trend */}
          <Text style={styles.sectionTitle}>Earnings Trend</Text>
          <Text style={styles.sectionSubtitle}>Last 6 months</Text>
          {data?.earningsTrend?.length && maxTrend > 0 ? (
            <View style={styles.card}>
              <View style={styles.chartRow}>
                {data.earningsTrend.map((t, i) => {
                  const e = t.earnings ?? 0;
                  const barHeight = maxTrend > 0 ? Math.max((e / maxTrend) * 96, e > 0 ? 6 : 4) : 4;
                  const isPeak = e === maxTrend && e > 0;
                  return (
                    <View key={i} style={styles.chartCol}>
                      <Text style={styles.chartValue}>{shortCurrency(e)}</Text>
                      <View
                        style={[
                          styles.chartBar,
                          {
                            height: barHeight,
                            backgroundColor: isPeak ? colors.primary : colorWithOpacity(colors.primary, 0.35),
                          },
                        ]}
                      />
                      <Text style={styles.chartLabel} numberOfLines={1}>{t.period}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colorWithOpacity(colors.primary, 0.1) }]}>
                <Feather name="bar-chart-2" size={28} color={colors.primary} />
              </View>
              <Text style={styles.emptyText}>No earnings recorded yet</Text>
              <Text style={styles.emptySubtext}>Completed jobs will show here</Text>
            </View>
          )}

          {/* Earnings by business */}
          <Text style={styles.sectionTitle}>Earnings by Business</Text>
          <Text style={styles.sectionSubtitle}>This month</Text>
          {data?.earningsByBusiness?.length ? (
            <View style={styles.card}>
              {data.earningsByBusiness.map((b, i) => {
                const amount = b.amount ?? 0;
                const pct = totalByBusiness > 0 ? Math.round((amount / totalByBusiness) * 100) : 0;
                const isLast = i === data.earningsByBusiness.length - 1;
                return (
                  <View key={i} style={[styles.bizRow, !isLast && styles.bizRowDivider]}>
                    <View style={[styles.bizIcon, { backgroundColor: colorWithOpacity(colors.primary, 0.12) }]}>
                      <Feather name="briefcase" size={iconSizes.lg} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bizName} numberOfLines={1}>{b.businessName}</Text>
                      <View style={styles.bizMetaRow}>
                        <Text style={styles.bizMeta}>{(b.hours ?? 0).toFixed(1)}h worked</Text>
                        <View style={styles.bizDot} />
                        <Text style={styles.bizMeta}>{pct}%</Text>
                      </View>
                      <View style={styles.bizBarTrack}>
                        <View style={[styles.bizBarFill, { width: `${Math.max(pct, amount > 0 ? 4 : 0)}%`, backgroundColor: colors.primary }]} />
                      </View>
                    </View>
                    <Text style={styles.bizAmount}>{formatCurrency(amount)}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colorWithOpacity(colors.success, 0.12) }]}>
                <Feather name="user" size={28} color={colors.success} />
              </View>
              <Text style={styles.emptyText}>All earnings are from your own solo work</Text>
              <Text style={styles.emptySubtext}>Work for other businesses appears here</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { ...typography.cardTitle, color: colors.foreground },
    headerRight: { width: 36 },

    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    statCard: {
      width: '48%',
      backgroundColor: colors.card,
      borderRadius: radius['2xl'],
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      ...shadows.sm,
    },
    statIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    statValue: { ...typography.statValue, color: colors.foreground, letterSpacing: -0.5 },
    statLabel: { ...typography.label, color: colors.mutedForeground, marginTop: spacing.xs },

    sectionTitle: { ...typography.subtitle, color: colors.foreground, marginTop: spacing.xl },
    sectionSubtitle: { ...typography.caption, color: colors.mutedForeground, marginTop: 2, marginBottom: spacing.sm },

    card: {
      backgroundColor: colors.card,
      borderRadius: radius['2xl'],
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      ...shadows.sm,
    },

    chartRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-around',
      height: 140,
      paddingTop: spacing.sm,
    },
    chartCol: { flex: 1, alignItems: 'center', gap: spacing.xs },
    chartValue: { fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: colors.foreground },
    chartBar: { width: '52%', borderRadius: radius.md, minHeight: 4 },
    chartLabel: { fontSize: typography.sizes.xs, color: colors.mutedForeground, textAlign: 'center' },

    bizRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    bizRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    bizIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bizName: { ...typography.bodySemibold, color: colors.foreground },
    bizMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2, marginBottom: spacing.xs },
    bizMeta: { fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground },
    bizDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.mutedForeground },
    bizBarTrack: {
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: colorWithOpacity(colors.mutedForeground, 0.15),
      overflow: 'hidden',
    },
    bizBarFill: { height: 6, borderRadius: radius.pill },
    bizAmount: { ...typography.bodySemibold, fontWeight: fontWeights.bold, color: colors.foreground },

    emptyCard: {
      backgroundColor: colors.card,
      borderRadius: radius['2xl'],
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingVertical: spacing['2xl'],
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      gap: spacing.xs,
      ...shadows.sm,
    },
    emptyIconWrap: {
      width: 56,
      height: 56,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    emptyText: { ...typography.bodySemibold, color: colors.foreground, textAlign: 'center' },
    emptySubtext: { fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, textAlign: 'center' },
  });
}
