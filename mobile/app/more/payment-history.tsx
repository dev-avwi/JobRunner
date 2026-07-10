import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography, pageShell, iconSizes } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { format } from 'date-fns';

interface TerminalPayment {
  id: string;
  stripePaymentIntentId: string | null;
  amount: number | string;
  currency: string | null;
  status: string;
  description: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  invoiceId: string | null;
  jobId: string | null;
  createdAt: string | null;
  completedAt: string | null;
  fee: number | null;
  net: number | null;
  settlementStatus: string | null;
}

const formatCurrency = (amount: number | string | null) => {
  const { formatCurrency: fmt } = require('../../src/lib/format');
  return fmt(amount ?? 0, { compact: false });
};

const cardLabel = (p: TerminalPayment) => {
  const brand = p.cardBrand ? p.cardBrand.charAt(0).toUpperCase() + p.cardBrand.slice(1) : 'Card';
  return p.cardLast4 ? `${brand} •••• ${p.cardLast4}` : brand;
};

type StatusMeta = { label: string; icon: string; tone: 'success' | 'pending' | 'error' | 'muted' };

const statusMeta = (p: TerminalPayment): StatusMeta => {
  if (p.status === 'succeeded') {
    if (p.settlementStatus === 'available') {
      return { label: 'Paid out', icon: 'check-circle', tone: 'success' };
    }
    if (p.settlementStatus === 'pending') {
      return { label: 'Pending payout', icon: 'clock', tone: 'pending' };
    }
    return { label: 'Paid', icon: 'check-circle', tone: 'success' };
  }
  if (p.status === 'failed') return { label: 'Failed', icon: 'x-circle', tone: 'error' };
  if (p.status === 'cancelled') return { label: 'Cancelled', icon: 'slash', tone: 'muted' };
  return { label: 'Processing', icon: 'loader', tone: 'pending' };
};

export default function PaymentHistoryScreen() {
  const { colors } = useTheme();
  const [payments, setPayments] = useState<TerminalPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const bottomInset = useBottomInset(40);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const toneColor = useCallback((tone: StatusMeta['tone']) => {
    switch (tone) {
      case 'success': return colors.success;
      case 'pending': return colors.warning;
      case 'error': return colors.destructive;
      default: return colors.mutedForeground;
    }
  }, [colors]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<TerminalPayment[]>('/api/terminal/payments');
      if (!res.error && Array.isArray(res.data)) {
        setPayments(res.data);
      }
    } catch (e) {
      console.error('Failed to load payment history', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const succeeded = payments.filter((p) => p.status === 'succeeded');
  const totalCollected = succeeded.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalNet = succeeded.reduce((sum, p) => sum + (p.net != null ? Number(p.net) : Number(p.amount || 0)), 0);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomInset }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={fetchData} tintColor={colors.primary} />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Payment History</Text>
              <Text style={styles.pageSubtitle}>{payments.length} Tap to Pay charge{payments.length === 1 ? '' : 's'}</Text>
            </View>
            <PressableRow style={styles.backButton} onPress={() => router.back()}>
              <Feather name="arrow-left" size={iconSizes.lg} color={colors.foreground} />
            </PressableRow>
          </View>

          {succeeded.length > 0 && (
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Collected</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalCollected)}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Net after fees</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalNet)}</Text>
              </View>
            </View>
          )}

          {isLoading && payments.length === 0 ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : payments.length === 0 ? (
            <View style={styles.centered}>
              <Feather name="credit-card" size={40} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>No Tap to Pay charges yet</Text>
              <Text style={styles.emptyText}>Charges you take with Tap to Pay will appear here with their fees and net amounts.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {payments.map((p) => {
                const meta = statusMeta(p);
                const dateStr = p.completedAt || p.createdAt;
                const gross = Number(p.amount || 0);
                return (
                  <View key={p.id} style={styles.paymentCard}>
                    <View style={styles.cardTop}>
                      <View style={styles.cardTopLeft}>
                        <Text style={styles.amount}>{formatCurrency(gross)}</Text>
                        <Text style={styles.cardMeta}>{cardLabel(p)}</Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: toneColor(meta.tone) + '22' }]}>
                        <Feather name={meta.icon as any} size={12} color={toneColor(meta.tone)} />
                        <Text style={[styles.statusText, { color: toneColor(meta.tone) }]}>{meta.label}</Text>
                      </View>
                    </View>

                    {(p.description) ? (
                      <Text style={styles.description} numberOfLines={1}>{p.description}</Text>
                    ) : null}

                    {p.status === 'succeeded' && (
                      <View style={styles.breakdown}>
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Fee</Text>
                          <Text style={styles.breakdownValue}>{p.fee != null ? `- ${formatCurrency(p.fee)}` : '—'}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Net</Text>
                          <Text style={[styles.breakdownValue, styles.netValue]}>{p.net != null ? formatCurrency(p.net) : '—'}</Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.cardBottom}>
                      <Feather name="calendar" size={12} color={colors.mutedForeground} />
                      <Text style={styles.dateText}>
                        {dateStr ? format(new Date(dateStr), 'd MMM yyyy, h:mm a') : '—'}
                      </Text>
                      {p.invoiceId ? (
                        <View style={styles.linkTag}>
                          <Feather name="file-text" size={11} color={colors.mutedForeground} />
                          <Text style={styles.linkTagText}>Invoice</Text>
                        </View>
                      ) : (
                        <View style={styles.linkTag}>
                          <Feather name="zap" size={11} color={colors.mutedForeground} />
                          <Text style={styles.linkTagText}>Direct</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    paddingBottom: pageShell.paddingBottom,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    ...typography.pageTitle,
    color: colors.foreground,
  },
  pageSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  backButton: {
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginTop: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  list: {
    gap: spacing.md,
  },
  paymentCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardTopLeft: {
    flex: 1,
  },
  amount: {
    ...typography.pageTitle,
    color: colors.foreground,
  },
  cardMeta: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600' as const,
  },
  description: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  breakdown: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  breakdownLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  breakdownValue: {
    ...typography.bodySemibold,
    color: colors.foreground,
  },
  netValue: {
    color: colors.success,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  dateText: {
    ...typography.caption,
    color: colors.mutedForeground,
    flex: 1,
  },
  linkTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
  },
  linkTagText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
});
