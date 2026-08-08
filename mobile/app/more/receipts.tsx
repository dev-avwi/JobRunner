import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, sizes, pageShell, iconSizes, fontWeights } from '../../src/lib/design-tokens';
import { AnimatedCardPressable } from '../../src/components/ui/AnimatedPressable';
import { api } from '../../src/lib/api';
import { format, formatDistanceToNow } from 'date-fns';

interface Receipt {
  id: string;
  receiptNumber: string;
  invoiceId: string | null;
  amount: number;
  gstAmount: number | null;
  paymentMethod: string;
  paymentReference: string | null;
  paidAt: string | null;
  clientId: string | null;
  notes: string | null;
  createdAt: string;
}

interface Client {
  id: string;
  name: string;
}

type FilterKey = 'all' | 'card' | 'bank_transfer' | 'cash' | 'tap_to_pay' | 'other';

const FILTERS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'credit-card' },
  { key: 'card', label: 'Card', icon: 'credit-card' },
  { key: 'bank_transfer', label: 'Bank Transfer', icon: 'building' },
  { key: 'cash', label: 'Cash', icon: 'dollar-sign' },
  { key: 'tap_to_pay', label: 'Tap to Pay', icon: 'smartphone' },
  { key: 'other', label: 'Other', icon: 'more-horizontal' },
];

const KNOWN_METHODS = ['card', 'bank_transfer', 'cash', 'tap_to_pay'];

const formatCurrency = (amount: number | string) => {
  const { formatCurrency: fmt } = require('../../src/lib/format');
  return fmt(amount, { compact: true });
};

const formatPaymentMethod = (method: string) => {
  const methods: Record<string, string> = {
    'card': 'Card',
    'tap_to_pay': 'Tap to Pay',
    'bank_transfer': 'Bank Transfer',
    'cash': 'Cash',
    'cheque': 'Cheque',
    'stripe': 'Online',
    'payment_link': 'Payment Link',
  };
  return methods[method] || method;
};

function KPICard({ 
  title, 
  value, 
  icon, 
  onPress,
  isAmount = false,
  colors 
}: { 
  title: string;
  value: number;
  icon: string;
  onPress: () => void;
  isAmount?: boolean;
  colors: ThemeColors;
}) {
  return (
    <TouchableOpacity activeOpacity={0.7} style={{ flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.cardBorder, minWidth: '45%', }} onPress={onPress} >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <Feather name={icon as any} size={16} color={colors.success} />
        <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, fontWeight: fontWeights.medium }}>{title}</Text>
      </View>
      <Text style={{ fontSize: isAmount ? 20 : 24, fontWeight: fontWeights.bold, color: colors.success }}>
        {isAmount ? formatCurrency(value) : value}
      </Text>
    </TouchableOpacity>
  );
}

function ReceiptCard({ 
  receipt, 
  clientName,
  onPress 
}: { 
  receipt: Receipt;
  clientName: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const getMethodIcon = () => {
    switch (receipt.paymentMethod) {
      case 'card': return 'credit-card';
      case 'tap_to_pay': return 'smartphone';
      case 'bank_transfer': return 'building';
      case 'cash': return 'dollar-sign';
      default: return 'check-circle';
    }
  };

  return (
    <AnimatedCardPressable
      onPress={onPress}
      style={styles.receiptCard}
    >
      <View style={[styles.receiptCardAccent, { backgroundColor: colors.success }]} />
      <View style={styles.receiptCardContent}>
        <View style={styles.receiptCardHeader}>
          <View style={styles.receiptHeaderLeft}>
            <Text style={styles.receiptNumber} numberOfLines={1}>{receipt.receiptNumber || 'Receipt'}</Text>
            <View style={[styles.methodBadge, { backgroundColor: colors.successLight }]}>
              <Feather name={getMethodIcon() as any} size={10} color={colors.success} />
              <Text style={[styles.methodText, { color: colors.success }]}>
                {formatPaymentMethod(receipt.paymentMethod)}
              </Text>
            </View>
          </View>
          <Text style={[styles.receiptTotal, { color: colors.success }]}>+{formatCurrency(receipt.amount)}</Text>
        </View>

        <View style={styles.receiptDetails}>
          {clientName && (
            <View style={styles.receiptDetailRow}>
              <Feather name="user" size={12} color={colors.mutedForeground} />
              <Text style={styles.receiptDetailText} numberOfLines={1}>{clientName}</Text>
            </View>
          )}
          <View style={styles.receiptDetailRow}>
            <Feather name="calendar" size={12} color={colors.mutedForeground} />
            <Text style={styles.receiptDetailText} numberOfLines={1}>
              {receipt.paidAt 
                ? format(new Date(receipt.paidAt), 'dd MMM yyyy')
                : receipt.createdAt 
                  ? format(new Date(receipt.createdAt), 'dd MMM yyyy')
                  : 'No date'}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.receiptCardChevron}>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </View>
    </AnimatedCardPressable>
  );
}

export default function ReceiptsScreen() {
  const { colors } = useTheme();
  const bottomInset = useBottomInset(40);
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [receiptsRes, clientsRes] = await Promise.all([
        api.get<Receipt[]>('/api/receipts'),
        api.get<Client[]>('/api/clients'),
      ]);
      setReceipts(receiptsRes.data || []);
      setClients(clientsRes.data || []);
    } catch (error) {
      console.error('Error fetching receipts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const clientMap = useMemo(() => {
    return new Map(clients.map(c => [c.id, c]));
  }, [clients]);

  const getClientName = (clientId: string | null) => {
    if (!clientId) return 'Unknown Client';
    return clientMap.get(clientId)?.name || 'Unknown Client';
  };

  const filterCounts = useMemo(() => ({
    all: receipts.length,
    card: receipts.filter(r => r.paymentMethod === 'card').length,
    bank_transfer: receipts.filter(r => r.paymentMethod === 'bank_transfer').length,
    cash: receipts.filter(r => r.paymentMethod === 'cash').length,
    tap_to_pay: receipts.filter(r => r.paymentMethod === 'tap_to_pay').length,
    other: receipts.filter(r => !KNOWN_METHODS.includes(r.paymentMethod)).length,
  }), [receipts]);

  const stats = useMemo(() => {
    const total = receipts.reduce((sum, r) => sum + r.amount, 0);
    const cardTotal = receipts.filter(r => r.paymentMethod === 'card').reduce((sum, r) => sum + r.amount, 0);
    const cashTotal = receipts.filter(r => r.paymentMethod === 'cash').reduce((sum, r) => sum + r.amount, 0);
    const bankTotal = receipts.filter(r => r.paymentMethod === 'bank_transfer').reduce((sum, r) => sum + r.amount, 0);
    return { total, cardTotal, cashTotal, bankTotal };
  }, [receipts]);

  const filteredReceipts = useMemo(() => {
    return receipts.filter(receipt => {
      const searchLower = searchQuery.toLowerCase();
      const clientName = getClientName(receipt.clientId);
      const matchesSearch = 
        receipt.receiptNumber?.toLowerCase().includes(searchLower) ||
        clientName.toLowerCase().includes(searchLower) ||
        (receipt.notes || '').toLowerCase().includes(searchLower);
      
      const matchesFilter = 
        activeFilter === 'all' || 
        (activeFilter === 'other' && !KNOWN_METHODS.includes(receipt.paymentMethod)) ||
        receipt.paymentMethod === activeFilter;
      
      return matchesSearch && matchesFilter;
    });
  }, [receipts, activeFilter, searchQuery, clientMap]);

  const sortedReceipts = [...filteredReceipts].sort((a, b) => {
    const dateA = new Date(a.paidAt || a.createdAt).getTime();
    const dateB = new Date(b.paidAt || b.createdAt).getTime();
    return dateB - dateA;
  });

  const getSectionTitle = () => {
    switch (activeFilter) {
      case 'all': return 'ALL RECEIPTS';
      case 'card': return 'CARD PAYMENTS';
      case 'bank_transfer': return 'BANK TRANSFERS';
      case 'cash': return 'CASH PAYMENTS';
      case 'tap_to_pay': return 'TAP TO PAY';
      case 'other': return 'OTHER PAYMENTS';
      default: return 'RECEIPTS';
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomInset }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={fetchData}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Receipts</Text>
              <Text style={styles.pageSubtitle}>{receipts.length} total</Text>
            </View>
            <PressableRow style={styles.backButton} onPress={() => router.push('/more/documents')} >
              <Feather name="arrow-left" size={iconSizes.lg} color={colors.foreground} />
            </PressableRow>
          </View>

          <View style={styles.searchBar}>
            <Feather name="search" size={iconSizes.xl} color={colors.mutedForeground} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search receipts..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <PressableRow onPress={() => setSearchQuery('')}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </PressableRow>
            )}
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
            contentContainerStyle={styles.filtersContent}
          >
            {FILTERS.map((filter) => {
              const count = filterCounts[filter.key];
              const isActive = activeFilter === filter.key;
              
              return (
                <PressableRow key={filter.key} onPress={() => setActiveFilter(filter.key)} style={[ styles.filterPill, isActive && styles.filterPillActive ]} >
                  <Feather 
                    name={filter.icon as any} 
                    size={12} 
                    color={isActive ? colors.white : colors.foreground} 
                  />
                  <Text style={[
                    styles.filterPillText,
                    isActive && styles.filterPillTextActive
                  ]}>
                    {filter.label}
                  </Text>
                  <View style={[
                    styles.filterCount,
                    isActive && styles.filterCountActive
                  ]}>
                    <Text style={[
                      styles.filterCountText,
                      isActive && styles.filterCountTextActive
                    ]}>
                      {count}
                    </Text>
                  </View>
                </PressableRow>
              );
            })}
          </ScrollView>

          <View style={styles.kpiGrid}>
            <KPICard
              title="Total Received"
              value={stats.total}
              icon="check-circle"
              onPress={() => setActiveFilter('all')}
              isAmount={true}
              colors={colors}
            />
            <KPICard
              title="Card Payments"
              value={filterCounts.card}
              icon="credit-card"
              onPress={() => setActiveFilter('card')}
              colors={colors}
            />
            <KPICard
              title="Bank Transfers"
              value={filterCounts.bank_transfer}
              icon="building"
              onPress={() => setActiveFilter('bank_transfer')}
              colors={colors}
            />
            <KPICard
              title="Cash Payments"
              value={filterCounts.cash}
              icon="dollar-sign"
              onPress={() => setActiveFilter('cash')}
              colors={colors}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="check-circle" size={iconSizes.md} color={colors.success} />
              <Text style={styles.sectionTitle}>{getSectionTitle()}</Text>
            </View>
            
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : sortedReceipts.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                  <Feather name="credit-card" size={iconSizes['4xl']} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyStateTitle}>No receipts found</Text>
                <Text style={styles.emptyStateSubtitle}>
                  {searchQuery || activeFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Receipts appear when payments are received against invoices.'}
                </Text>
                {!searchQuery && activeFilter === 'all' && (
                  <Text style={styles.emptyStateTip}>
                    Tip: Use Tap to Pay or send payment links to collect payments faster
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.receiptsList}>
                {sortedReceipts.map((receipt) => (
                  <ReceiptCard
                    key={receipt.id}
                    receipt={receipt}
                    clientName={getClientName(receipt.clientId)}
                    onPress={() => router.push(`/more/receipt/${receipt.id}`)}
                  />
                ))}
              </View>
            )}
          </View>
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

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    height: sizes.searchBarHeight,
    marginBottom: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
  },

  filtersScroll: {
    marginBottom: spacing.lg,
    marginHorizontal: -pageShell.paddingHorizontal,
  },
  filtersContent: {
    paddingHorizontal: pageShell.paddingHorizontal,
    gap: spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.xs,
  },
  filterPillActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  filterPillText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  filterPillTextActive: {
    color: colors.white,
  },
  filterCount: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    minWidth: sizes.filterCountMin,
    alignItems: 'center',
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterCountText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  filterCountTextActive: {
    color: colors.white,
  },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },

  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.foreground,
    letterSpacing: 0.5,
  },

  loadingContainer: {
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyStateIcon: {
    marginBottom: spacing.lg,
  },
  emptyStateTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  emptyStateSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  emptyStateTip: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  receiptsList: {
    gap: spacing.md,
  },
  receiptCard: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  receiptCardAccent: {
    width: 4,
  },
  receiptCardContent: {
    flex: 1,
    padding: spacing.md,
  },
  receiptCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  receiptNumber: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    flex: 1,
  },
  receiptHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  receiptTotal: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.bold,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    gap: 4,
  },
  methodText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
  },
  receiptDetails: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  receiptDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  receiptDetailText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    flex: 1,
  },
  receiptCardChevron: {
    justifyContent: 'center',
    paddingRight: spacing.md,
  },
});
