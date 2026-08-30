import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useInvoicesStore, useClientsStore, useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { api, API_URL } from '../../src/lib/api';
import { spacing, radius, shadows, typography, sizes, pageShell, iconSizes, fontWeights } from '../../src/lib/design-tokens';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { SkeletonCard } from '../../src/components/Skeleton';
import { XeroBadge } from '../../src/components/ui/XeroBadge';
import { EmailComposeModal } from '../../src/components/EmailComposeModal';
import { Swipeable } from 'react-native-gesture-handler';

type FilterKey = 'all' | 'draft' | 'sent' | 'paid' | 'overdue' | 'recurring' | 'archived';

const FILTERS: { key: FilterKey; label: string; icon?: string }[] = [
  { key: 'all', label: 'All', icon: 'file-text' },
  { key: 'draft', label: 'Draft', icon: 'clock' },
  { key: 'sent', label: 'Sent', icon: 'send' },
  { key: 'paid', label: 'Paid', icon: 'check-circle' },
  { key: 'overdue', label: 'Overdue', icon: 'alert-circle' },
  { key: 'recurring', label: 'Recurring', icon: 'repeat' },
  { key: 'archived', label: 'Archived', icon: 'archive' },
];

const navigateToCreateInvoice = () => {
  router.push('/more/invoice/new');
};

function InvoiceCard({ 
  invoice, 
  clientName,
  jobTitle,
  onPress,
  onSend,
  onMarkPaid,
  onArchive,
}: { 
  invoice: any;
  clientName: string;
  jobTitle?: string;
  onPress: () => void;
  onSend?: () => void;
  onMarkPaid?: () => void;
  onArchive?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const formatCurrency = (amount: number | string) => {
    const { formatCurrency: fmt } = require('../../src/lib/format');
    return fmt(amount);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    // For past-due and sent dates, show relative label for recent entries
    const now = new Date();
    const daysDiff = Math.round((now.getTime() - d.getTime()) / 86400000);
    if (daysDiff === 0) return 'today';
    if (daysDiff === 1) return 'yesterday';
    if (daysDiff >= 2 && daysDiff <= 6) return d.toLocaleDateString('en-AU', { weekday: 'short' });
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  };

  const getQuickAction = () => {
    switch (invoice.status) {
      case 'draft':
        return { label: 'Send', icon: 'send' as const, variant: 'primary' as const, action: onSend };
      case 'sent':
      case 'overdue':
        return { label: 'Paid', icon: 'check-circle' as const, variant: 'outline' as const, action: onMarkPaid };
      default:
        return null;
    }
  };

  const quickAction = getQuickAction();

  return (
    <Swipeable
      renderRightActions={() => (
        <View style={styles.swipeActions}>
          {onArchive && !(invoice as any).archived && (
            <PressableRow
              testID={`swipe-archive-invoice-${invoice.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Archive invoice ${invoice.number || ''}`}
              style={[styles.swipeAction, styles.swipeArchiveAction]}
              onPress={onArchive}
            >
              <Feather name="archive" size={18} color={colors.primaryForeground} />
              <Text style={styles.swipeActionText}>Archive</Text>
            </PressableRow>
          )}
        </View>
      )}
      overshootRight={false}
      rightThreshold={40}
    >
      <PressableRow style={[styles.invoiceCard, invoice.isXeroImport && { overflow: 'visible' }]} onPress={onPress} >
        {invoice.isXeroImport && <XeroBadge size="sm" />}
        <View style={styles.invoiceCardContent}>
        {/* Main row: Left info + Right amount/actions */}
        <View style={styles.cardMainRow}>
          {/* Left side: Icon + Info */}
          <View style={styles.cardLeftSection}>
            {/* Icon circle - always primary/trade color */}
            <View style={styles.iconCircle}>
              <Feather name="file-text" size={20} color={colors.primary} />
            </View>
            
            {/* Info section */}
            <View style={styles.cardInfoSection}>
              {/* Number + Status badge */}
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardNumber}>{invoice.number || 'Draft'}</Text>
                <StatusBadge status={invoice.status || 'draft'} size="sm" />
              </View>
              
              {/* Client name */}
              <View style={styles.cardClientRow}>
                <Feather name="user" size={12} color={colors.mutedForeground} />
                <Text style={styles.cardClientText} numberOfLines={1}>{clientName || 'No client'}</Text>
              </View>
            </View>
          </View>
          
          {/* Right side: Amount + Action + Chevron */}
          <View style={styles.cardRightSection}>
            <Text style={styles.cardAmount}>{formatCurrency(invoice.total || 0)}</Text>
            
            <View style={styles.cardActionsRow}>
              {quickAction && (
                <PressableRow style={[ styles.actionButton, quickAction.variant === 'primary' ? styles.actionButtonPrimary : styles.actionButtonOutline ]} onPress={(e) => { e.stopPropagation(); quickAction.action?.(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} >
                  <Feather 
                    name={quickAction.icon} 
                    size={14} 
                    color={quickAction.variant === 'primary' ? colors.primaryForeground : colors.foreground} 
                  />
                  <Text style={[
                    styles.actionButtonText,
                    quickAction.variant === 'outline' && { color: colors.foreground }
                  ]}>{quickAction.label}</Text>
                </PressableRow>
              )}
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            </View>
          </View>
        </View>
        
        {/* Job title + dates - indented to align with text */}
        <View style={styles.cardDetailsSection}>
          {jobTitle && (
            <Text style={styles.cardJobTitle} numberOfLines={1}>{jobTitle}</Text>
          )}
          
          <View style={styles.cardDatesRow}>
            {invoice.sentAt && (
              <View style={styles.cardDateItem}>
                <Feather name="calendar" size={12} color={colors.mutedForeground} />
                <Text style={styles.cardDateText}>Sent {formatDate(invoice.sentAt)}</Text>
              </View>
            )}
            {invoice.paidAt && (
              <View style={styles.cardDateItem}>
                <Feather name="credit-card" size={12} color={colors.mutedForeground} />
                <Text style={styles.cardDateText}>Paid {formatDate(invoice.paidAt)}</Text>
              </View>
            )}
            {invoice.dueDate && invoice.status !== 'paid' && (
              <View style={styles.cardDateItem}>
                <Feather name="calendar" size={12} color={colors.mutedForeground} />
                <Text style={[
                  styles.cardDateText,
                  invoice.status === 'overdue' && { color: colors.destructive }
                ]}>Due {formatDate(invoice.dueDate)}</Text>
              </View>
            )}
            {invoice.isRecurring && (
              <View style={styles.recurringBadge}>
                <Feather name="repeat" size={10} color={colors.info} />
                <Text style={styles.recurringBadgeText}>Recurring</Text>
              </View>
            )}
          </View>
        </View>
        </View>
      </PressableRow>
    </Swipeable>
  );
}

export default function InvoicesScreen() {
  const { colors } = useTheme();
  const confirm = useConfirmDialog();
  const bottomInset = useBottomInset(40);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { invoices, fetchInvoices, isLoading } = useInvoicesStore();
  const { clients, fetchClients } = useClientsStore();
  const { user, businessSettings } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  // Debounce search so filtering doesn't fire on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Inline email compose state
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [selectedInvoiceForEmail, setSelectedInvoiceForEmail] = useState<any>(null);

  const refreshData = useCallback(async () => {
    await Promise.all([fetchInvoices(), fetchClients()]);
  }, [fetchInvoices, fetchClients]);

  // Refresh data when screen gains focus (syncs with web app)
  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Unknown Client';
  };

  const formatCurrency = (amount: number | string, showDecimals = true) => {
    const { formatCurrency: fmt } = require('../../src/lib/format');
    return fmt(amount, { compact: !showDecimals });
  };

  const totalOutstanding = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((sum, i) => sum + parseFloat(String(i.total || 0)), 0);

  const totalPaid = invoices
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + parseFloat(String(i.total || 0)), 0);

  const totalOverdue = invoices
    .filter(i => i.status === 'overdue')
    .reduce((sum, i) => sum + parseFloat(String(i.total || 0)), 0);

  const totalAll = invoices
    .filter(i => !(i as any).archived)
    .reduce((sum, i) => sum + parseFloat(String(i.total || 0)), 0);

  const filterCounts = {
    all: invoices.filter(i => !(i as any).archived).length,
    draft: invoices.filter(i => i.status === 'draft' && !(i as any).archived).length,
    sent: invoices.filter(i => i.status === 'sent' && !(i as any).archived).length,
    paid: invoices.filter(i => i.status === 'paid' && !(i as any).archived).length,
    overdue: invoices.filter(i => i.status === 'overdue' && !(i as any).archived).length,
    recurring: invoices.filter(i => (i as any).isRecurring && !(i as any).archived).length,
    archived: invoices.filter(i => (i as any).archived).length,
  };

  const filteredInvoices = invoices.filter(invoice => {
    const searchLower = debouncedSearch.toLowerCase();
    const clientName = getClientName(invoice.clientId);
    const matchesSearch = 
      invoice.number?.toLowerCase().includes(searchLower) ||
      clientName.toLowerCase().includes(searchLower);
    
    let matchesFilter = false;
    if (activeFilter === 'all') {
      matchesFilter = !(invoice as any).archived;
    } else if (activeFilter === 'archived') {
      matchesFilter = !!(invoice as any).archived;
    } else if (activeFilter === 'recurring') {
      matchesFilter = (invoice as any).isRecurring === true && !(invoice as any).archived;
    } else {
      matchesFilter = invoice.status === activeFilter && !(invoice as any).archived;
    }
    
    return matchesSearch && matchesFilter;
  });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const handleSendInvoice = async (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    const client = clients.find(c => c.id === invoice?.clientId);
    
    if (!client?.email) {
      Alert.alert(
        'No Email Address',
        'This client does not have an email address. Would you like to view the invoice and add one?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Invoice', onPress: () => router.push(`/more/invoice/${invoiceId}`) }
        ]
      );
      return;
    }
    
    // Show inline email compose modal
    setSelectedInvoiceForEmail({ ...invoice, client });
    setShowEmailCompose(true);
  };
  
  const handleSendEmail = async (customSubject: string, customMessage: string) => {
    if (!selectedInvoiceForEmail) return;
    
    try {
      const response = await api.post<{ success?: boolean; error?: string }>(
        `/api/invoices/${selectedInvoiceForEmail.id}/send`, 
        { customSubject, customMessage }
      );
      
      // Check for API error response
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Check for backend-returned error in data
      if (response.data?.error) {
        throw new Error(response.data.error);
      }
      
      setShowEmailCompose(false);
      setSelectedInvoiceForEmail(null);
      await refreshData();
      Alert.alert('Success', 'Invoice sent successfully');
    } catch (error) {
      console.error('Error sending invoice:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send invoice');
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    
    Alert.alert(
      'Mark as Paid',
      `Record payment of ${formatCurrency(invoice?.total || 0)} received?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Mark Paid', 
          onPress: async () => {
            try {
              const response = await api.patch<{ error?: string }>(`/api/invoices/${invoiceId}`, {
                status: 'paid',
                paidAt: new Date().toISOString(),
                amountPaid: invoice?.total?.toString(),
                paymentMethod: 'on_site',
              });
              
              // Check for API error response
              if (response.error) {
                throw new Error(response.error);
              }
              
              // Check for backend-returned error in data
              if (response.data?.error) {
                throw new Error(response.data.error);
              }
              
              await refreshData();
              Alert.alert('Success', 'Payment recorded successfully');
            } catch (error) {
              console.error('Error marking paid:', error);
              Alert.alert('Error', error instanceof Error ? error.message : 'Failed to record payment');
            }
          }
        }
      ]
    );
  };

  const handleArchiveInvoice = async (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    
    const ok = await confirm({
      title: 'Archive Invoice',
      message: `Are you sure you want to archive ${invoice?.number || 'this invoice'}?`,
      confirmText: 'Archive',
      cancelText: 'Cancel',
    });
    if (!ok) return;

    try {
      const response = await api.post(`/api/invoices/${invoiceId}/archive`);
      if (response.error) throw new Error(response.error);
      await refreshData();
      Alert.alert('Success', 'Invoice archived successfully');
    } catch (error) {
      console.error('Error archiving invoice:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to archive invoice');
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <FlatList
          data={sortedInvoices}
          keyExtractor={(item) => item.id.toString()}
          style={styles.scrollView}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomInset }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refreshData}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <>
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Text style={styles.pageTitle}>Invoices</Text>
                  <Text style={styles.pageSubtitle}>{invoices.length} total</Text>
                </View>
                <PressableRow style={styles.newButton} onPress={navigateToCreateInvoice} >
                  <Feather name="plus" size={iconSizes.lg} color={colors.primaryForeground} />
                  <Text style={styles.newButtonText}>New Invoice</Text>
                </PressableRow>
              </View>

              <View style={styles.kpiGrid}>
                <View style={styles.kpiRow}>
                  <PressableRow style={styles.kpiCard} onPress={() => setActiveFilter('all')} >
                    <View style={[styles.kpiIconContainer, { backgroundColor: colors.primaryLight }]}>
                      <Feather name="dollar-sign" size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.kpiLabel} numberOfLines={1}>Total Value</Text>
                    <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatCurrency(totalAll, false)}</Text>
                  </PressableRow>

                  <PressableRow style={styles.kpiCard} onPress={() => setActiveFilter('sent')} >
                    <View style={[styles.kpiIconContainer, { backgroundColor: colors.warningLight }]}>
                      <Feather name="alert-circle" size={16} color={colors.warning} />
                    </View>
                    <Text style={styles.kpiLabel} numberOfLines={1}>Unpaid</Text>
                    <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatCurrency(totalOutstanding, false)}</Text>
                  </PressableRow>
                </View>

                <View style={styles.kpiRow}>
                  <PressableRow style={styles.kpiCard} onPress={() => setActiveFilter('paid')} >
                    <View style={[styles.kpiIconContainer, { backgroundColor: colors.successLight }]}>
                      <Feather name="check-circle" size={16} color={colors.success} />
                    </View>
                    <Text style={styles.kpiLabel} numberOfLines={1}>Paid</Text>
                    <Text style={[styles.kpiValue, { color: colors.success }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatCurrency(totalPaid, false)}</Text>
                  </PressableRow>

                  <PressableRow style={styles.kpiCard} onPress={() => setActiveFilter('overdue')} >
                    <View style={[styles.kpiIconContainer, { backgroundColor: colors.destructiveLight }]}>
                      <Feather name="clock" size={16} color={colors.destructive} />
                    </View>
                    <Text style={styles.kpiLabel} numberOfLines={1}>Overdue</Text>
                    <Text style={[styles.kpiValue, { color: colors.destructive }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatCurrency(totalOverdue, false)}</Text>
                  </PressableRow>
                </View>
              </View>

              <View style={styles.searchBar}>
                <Feather name="search" size={iconSizes.xl} color={colors.mutedForeground} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search invoices..."
                  placeholderTextColor={colors.mutedForeground}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
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

              <View style={styles.sectionHeader}>
                <Feather name="file-text" size={iconSizes.md} color={colors.primary} />
                <Text style={styles.sectionTitle}>ALL INVOICES</Text>
              </View>

              {isLoading && (
                <View style={{ paddingHorizontal: spacing.md }}>
                  {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
                </View>
              )}
            </>
          }
          renderItem={({ item: invoice }) => (
            <View style={styles.invoiceItemWrapper}>
              <InvoiceCard
                invoice={invoice}
                clientName={getClientName(invoice.clientId)}
                jobTitle={(invoice as any).description || (invoice as any).title || ''}
                onPress={() => router.push(`/more/invoice/${invoice.id}`)}
                onSend={() => handleSendInvoice(invoice.id)}
                onMarkPaid={() => handleMarkPaid(invoice.id)}
                onArchive={() => handleArchiveInvoice(invoice.id)}
              />
            </View>
          )}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                  <Feather name="file-text" size={iconSizes['4xl']} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyStateTitle}>No invoices found</Text>
                <Text style={styles.emptyStateSubtitle}>
                  {searchQuery || activeFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Create your first invoice to get started'}
                </Text>
              </View>
            ) : null
          }
        />
      </View>
      
      {/* Inline Email Compose Modal */}
      {selectedInvoiceForEmail && (
        <EmailComposeModal
          visible={showEmailCompose}
          onClose={() => {
            setShowEmailCompose(false);
            setSelectedInvoiceForEmail(null);
          }}
          type="invoice"
          documentId={selectedInvoiceForEmail.id}
          clientName={selectedInvoiceForEmail.client?.name || 'Client'}
          clientEmail={selectedInvoiceForEmail.client?.email || ''}
          documentNumber={selectedInvoiceForEmail.number || ''}
          documentTitle={selectedInvoiceForEmail.description || 'Services'}
          total={`$${parseFloat(String(selectedInvoiceForEmail.total || 0)).toFixed(2)}`}
          businessName={businessSettings?.businessName || user?.businessName || 'Your Business'}
          publicUrl={`${API_URL}/public/invoice/${selectedInvoiceForEmail.id}`}
          onSend={handleSendEmail}
        />
      )}
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
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
    ...shadows.sm,
  },
  newButtonText: {
    color: colors.primaryForeground,
    ...typography.caption,
    fontWeight: fontWeights.semibold,
  },

  kpiGrid: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  kpiCard: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  kpiIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  kpiLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  kpiValue: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.xs,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  filterPillTextActive: {
    color: colors.primaryForeground,
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
    paddingHorizontal: spacing.xl,
  },

  invoicesList: {
    gap: spacing.md,
  },
  invoiceItemWrapper: {
    marginBottom: spacing.md,
  },
  
  // === WEB-MATCHING CARD STYLES ===
  invoiceCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  swipeActions: {
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  swipeAction: {
    width: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  swipeArchiveAction: {
    backgroundColor: colors.primary,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  swipeActionText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  invoiceCardContent: {
    padding: 16, // p-4 equivalent
  },
  
  // Main horizontal row: left info + right amount/actions
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12, // gap-3
  },
  
  // Left section: icon circle + info
  cardLeftSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10, // gap-2.5
    flex: 1,
    minWidth: 0,
  },
  
  // Icon circle (40x40, primary color background at 10% opacity)
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}15`, // hsl(var(--trade) / 0.1)
  },
  
  // Info section next to icon
  cardInfoSection: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  
  // Number + status badge row
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // gap-2
    flexWrap: 'wrap',
  },
  
  // Quote/Invoice number - 15px semibold
  cardNumber: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  
  // Client row with user icon
  cardClientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // gap-1
  },
  cardClientText: {
    fontSize: typography.button.fontSize, // text-sm
    color: colors.mutedForeground,
    flex: 1,
  },
  
  // Right section: amount + actions
  cardRightSection: {
    alignItems: 'flex-end',
    gap: 8, // gap-2
    flexShrink: 0,
  },
  
  // Amount - 18px bold, primary/trade color
  cardAmount: {
    fontSize: typography.sizes.lg, // text-lg
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  
  // Actions row: button + chevron
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // gap-2
  },
  
  // Action button - matches web Button size="xl"
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 40, // size="xl" height
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  actionButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  
  // Details section - indented to align with text (pl-12 = 48px, approx icon width + gap)
  cardDetailsSection: {
    marginTop: 8, // space-y-2
    paddingLeft: 50, // pl-12 equivalent (40px icon + 10px gap)
    gap: 6, // space-y-1.5
  },
  
  // Job title
  cardJobTitle: {
    fontSize: typography.button.fontSize, // text-sm
    fontWeight: fontWeights.medium, // font-medium
    color: colors.foreground,
  },
  
  // Dates row
  cardDatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16, // gap-4
    flexWrap: 'wrap',
  },
  cardDateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // gap-1
  },
  cardDateText: {
    fontSize: typography.captionSmall.fontSize, // text-xs
    color: colors.mutedForeground,
  },
  
  // Recurring badge
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.infoLight || colors.muted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recurringBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.info,
  },
});
