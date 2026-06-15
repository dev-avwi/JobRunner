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
import { spacing, radius } from '../../src/lib/design-tokens';
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
    return Math.max(...data.earningsTrend.map(t => t.earnings), 0);
  }, [data]);

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
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Headline stats */}
          <View style={styles.statGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Earned This Month</Text>
              <Text style={styles.statValue}>{formatCurrency(data?.earningsMonth ?? 0)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Earned This Week</Text>
              <Text style={styles.statValue}>{formatCurrency(data?.earningsWeek ?? 0)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Hours This Month</Text>
              <Text style={styles.statValue}>{(data?.hoursMonth ?? 0).toFixed(1)}h</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Jobs Completed</Text>
              <Text style={styles.statValue}>{data?.jobsCompletedMonth ?? 0}</Text>
            </View>
          </View>

          {/* Earnings trend */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Earnings Trend</Text>
            <Text style={styles.sectionSubtitle}>Last 6 months</Text>
            {data?.earningsTrend?.length && maxTrend > 0 ? (
              <View style={styles.card}>
                {data.earningsTrend.map((t, i) => {
                  const pct = maxTrend > 0 ? Math.round((t.earnings / maxTrend) * 100) : 0;
                  return (
                    <View key={i} style={styles.trendRow}>
                      <Text style={styles.trendPeriod}>{t.period}</Text>
                      <View style={styles.trendBarTrack}>
                        <View
                          style={[
                            styles.trendBarFill,
                            { width: `${Math.max(pct, t.earnings > 0 ? 4 : 0)}%`, backgroundColor: colors.primary },
                          ]}
                        />
                      </View>
                      <Text style={styles.trendValue}>{formatCurrency(t.earnings)}</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <Feather name="bar-chart-2" size={36} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>No earnings recorded yet</Text>
              </View>
            )}
          </View>

          {/* Earnings by business */}
          {data?.earningsByBusiness?.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Earnings by Business</Text>
              <Text style={styles.sectionSubtitle}>This month</Text>
              <View style={styles.card}>
                {data.earningsByBusiness.map((b, i) => (
                  <View key={i} style={styles.bizRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bizName}>{b.businessName}</Text>
                      <Text style={styles.bizMeta}>{(b.hours ?? 0).toFixed(1)}h worked</Text>
                    </View>
                    <Text style={styles.bizAmount}>{formatCurrency(b.amount)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Earnings by Business</Text>
              <View style={[styles.card, { alignItems: 'center', paddingVertical: spacing.lg }]}>
                <Text style={styles.emptyText}>All earnings are from your own solo work</Text>
              </View>
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
    headerTitle: { fontSize: 18, fontWeight: '600', color: colors.foreground },
    headerRight: { width: 36 },
    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    statCard: {
      width: '48%',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    statLabel: { fontSize: 12, color: colors.mutedForeground, marginBottom: spacing.xs },
    statValue: { fontSize: 20, fontWeight: '700', color: colors.foreground },
    section: { marginTop: spacing.lg },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },
    sectionSubtitle: { fontSize: 12, color: colors.mutedForeground, marginTop: 2, marginBottom: spacing.sm },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    trendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    trendPeriod: { width: 40, fontSize: 13, color: colors.mutedForeground },
    trendBarTrack: {
      flex: 1,
      height: 10,
      borderRadius: radius.pill,
      backgroundColor: colorWithOpacity(colors.mutedForeground, 0.15),
      overflow: 'hidden',
    },
    trendBarFill: { height: 10, borderRadius: radius.pill },
    trendValue: { width: 84, textAlign: 'right', fontSize: 13, fontWeight: '600', color: colors.foreground },
    bizRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    bizName: { fontSize: 14, fontWeight: '600', color: colors.foreground },
    bizMeta: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    bizAmount: { fontSize: 15, fontWeight: '700', color: colors.foreground },
    emptyWrap: { alignItems: 'center', paddingVertical: spacing['2xl'], gap: spacing.sm },
    emptyText: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center' },
  });
}
