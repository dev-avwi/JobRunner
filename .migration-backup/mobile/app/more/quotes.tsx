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
import { useQuotesStore, useClientsStore, useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { api, API_URL } from '../../src/lib/api';
import { spacing, radius, shadows, typography, sizes, pageShell, iconSizes, fontWeights } from '../../src/lib/design-tokens';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { XeroBadge } from '../../src/components/ui/XeroBadge';
import { EmailComposeModal } from '../../src/components/EmailComposeModal';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';

type FilterKey = 'all' | 'draft' | 'sent' | 'accepted' | 'rejected' | 'archived';

const FILTERS: { key: FilterKey; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'file-text' },
  { key: 'draft', label: 'Draft', icon: 'clock' },
  { key: 'sent', label: 'Sent', icon: 'send' },
  { key: 'accepted', label: 'Accepted', icon: 'check-circle' },
  { key: 'rejected', label: 'Rejected', icon: 'x-circle' },
  { key: 'archived', label: 'Archived', icon: 'archive' },
];

const navigateToCreateQuote = () => {
  router.push('/more/quote/new');
};

function KPICard({ 
  title, 
  value, 
  icon, 
  onPress,
  colors 
}: { 
  title: string;
  value: number;
  icon: string;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <TouchableOpacity activeOpacity={0.7} style={{ flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.cardBorder, minWidth: '45%', }} onPress={onPress} >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <Feather name={icon as any} size={16} color={colors.primary} />
        <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, fontWeight: fontWeights.medium }}>{title}</Text>
      </View>
      <Text style={{ fontSize: typography.sizes.xxl, fontWeight: fontWeights.bold, color: colors.foreground }}>{value}</Text>
    </TouchableOpacity>
  );
}

function QuoteCard({ 
  quote, 
  clientName,
  jobTitle,
  onPress,
  onSend,
  onConvertToInvoice,
  onDelete,
}: { 
  quote: any;
  clientName: string;
  jobTitle?: string;
  onPress: () => void;
  onSend?: () => void;
  onConvertToInvoice?: () => void;
  onDelete?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const formatCurrency = (amount: number | string) => {
    const { formatCurrency: fmt } = require('../../src/lib/format');
    return fmt(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
    });
  };

  const getQuickAction = () => {
    switch (quote.status) {
      case 'draft':
        return { label: 'Send', icon: 'send' as const, variant: 'primary' as const, action: onSend };
      case 'sent':
        return { label: 'Resend', icon: 'refresh-cw' as const, variant: 'outline' as const, action: onSend };
      case 'accepted':
        return { label: 'Invoice', icon: 'arrow-right' as const, variant: 'primary' as const, action: onConvertToInvoice };
      default:
        return null;
    }
  };

  const quickAction = getQuickAction();

  return (
    <PressableRow style={[styles.quoteCard, quote.isXeroImport && { overflow: 'visible' }]} onPress={onPress} >
      {quote.isXeroImport && <XeroBadge size="sm" />}
      <View style={styles.quoteCardContent}>
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
                <Text style={styles.cardNumber}>{quote.quoteNumber || 'Draft'}</Text>
                <StatusBadge status={quote.status} size="sm" />
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
            <Text style={styles.cardAmount}>{formatCurrency(quote.total || 0)}</Text>
            
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
              {onDelete && (
                <PressableRow onPress={(e) => { e.stopPropagation(); onDelete(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ padding: 4 }} >
                  <Feather name="trash-2" size={16} color={colors.destructive} />
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
            {quote.expiryDate && (
              <View style={styles.cardDateItem}>
                <Feather name="calendar" size={12} color={colors.mutedForeground} />
                <Text style={styles.cardDateText}>Valid until {formatDate(quote.expiryDate)}</Text>
              </View>
            )}
            {quote.sentAt && (
              <View style={styles.cardDateItem}>
                <Feather name="calendar" size={12} color={colors.mutedForeground} />
                <Text style={styles.cardDateText}>Sent {formatDate(quote.sentAt)}</Text>
              </View>
            )}
            {!quote.expiryDate && !quote.sentAt && quote.createdAt && (
              <View style={styles.cardDateItem}>
                <Feather name="calendar" size={12} color={colors.mutedForeground} />
                <Text style={styles.cardDateText}>Created {formatDate(quote.createdAt)}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </PressableRow>
  );
}

export default function QuotesScreen() {
  const { colors } = useTheme();
  const confirm = useConfirmDialog();
  const bottomInset = useBottomInset(40);
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { quotes, fetchQuotes, isLoading } = useQuotesStore();
  const { clients, fetchClients } = useClientsStore();
  const { user, businessSettings } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  
  // Inline email compose state
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [selectedQuoteForEmail, setSelectedQuoteForEmail] = useState<any>(null);

  const refreshData = useCallback(async () => {
    await Promise.all([fetchQuotes(), fetchClients()]);
  }, [fetchQuotes, fetchClients]);

  useEffect(() => {
    refreshData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Unknown Client';
  };

  const filterCounts = {
    all: quotes.filter(q => q.status !== 'archived').length,
    draft: quotes.filter(q => q.status === 'draft').length,
    sent: quotes.filter(q => q.status === 'sent').length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    rejected: quotes.filter(q => q.status === 'rejected').length,
    archived: quotes.filter(q => q.status === 'archived' || q.archived).length,
  };

  const filteredQuotes = quotes.filter(quote => {
    const searchLower = searchQuery.toLowerCase();
    const clientName = getClientName(quote.clientId);
    const matchesSearch = 
      quote.quoteNumber?.toLowerCase().includes(searchLower) ||
      clientName.toLowerCase().includes(searchLower) ||
      quote.title?.toLowerCase().includes(searchLower);
    
    if (activeFilter === 'archived') {
      return matchesSearch && (quote.status === 'archived' || quote.archived);
    }
    
    const matchesFilter = activeFilter === 'all' 
      ? quote.status !== 'archived' && !quote.archived
      : quote.status === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

  const sortedQuotes = [...filteredQuotes].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const getSectionTitle = () => {
    switch (activeFilter) {
      case 'all': return 'ALL QUOTES';
      case 'draft': return 'DRAFT QUOTES';
      case 'sent': return 'SENT QUOTES';
      case 'accepted': return 'ACCEPTED QUOTES';
      case 'rejected': return 'REJECTED QUOTES';
      case 'archived': return 'ARCHIVED QUOTES';
      default: return 'QUOTES';
    }
  };

  const handleSendQuote = async (quoteId: string) => {
    const quote = quotes.find(q => q.id === quoteId);
    const client = clients.find(c => c.id === quote?.clientId);
    
    if (!client?.email) {
      Alert.alert(
        'No Email Address',
        'This client does not have an email address. Would you like to view the quote and add one?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Quote', onPress: () => router.push(`/more/quote/${quoteId}`) }
        ]
      );
      return;
    }
    
    // Show inline email compose modal
    setSelectedQuoteForEmail({ ...quote, client });
    setShowEmailCompose(true);
  };
  
  const handleSendEmail = async (customSubject: string, customMessage: string) => {
    if (!selectedQuoteForEmail) return;
    
    try {
      const response = await api.post<{ success?: boolean; error?: string }>(
        `/api/quotes/${selectedQuoteForEmail.id}/send`, 
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
      setSelectedQuoteForEmail(null);
      await refreshData();
      Alert.alert('Success', 'Quote sent successfully');
    } catch (error) {
      console.error('Error sending quote:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send quote');
    }
  };

  const handleConvertToInvoice = async (quoteId: string) => {
    const quote = quotes.find(q => q.id === quoteId);
    
    Alert.alert(
      'Create Invoice',
      `Create an invoice from quote ${quote?.quoteNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Create Invoice', 
          onPress: () => {
            router.push({
              pathname: '/more/invoice/new',
              params: { fromQuoteId: quoteId }
            });
          }
        }
      ]
    );
  };

  const handleDeleteQuote = async (quoteId: string) => {
    const quote = quotes.find(q => q.id === quoteId);
    
    const ok = await confirm({
      title: 'Delete Quote',
      message: `Are you sure you want to delete ${quote?.quoteNumber || 'this quote'}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (ok) {
      try {
        await api.delete(`/api/quotes/${quoteId}`);
        await refreshData();
        Alert.alert('Success', 'Quote deleted successfully');
      } catch (error) {
        console.error('Error deleting quote:', error);
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to delete quote');
      }
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <FlatList
          data={sortedQuotes}
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
                  <Text style={styles.pageTitle}>Quotes</Text>
                  <Text style={styles.pageSubtitle}>{quotes.length} total</Text>
                </View>
                <PressableRow style={styles.newButton} onPress={navigateToCreateQuote} >
                  <Feather name="plus" size={iconSizes.lg} color={colors.primaryForeground} />
                  <Text style={styles.newButtonText}>New Quote</Text>
                </PressableRow>
              </View>

              <View style={styles.searchBar}>
                <Feather name="search" size={iconSizes.xl} color={colors.mutedForeground} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search quotes..."
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
                        color={isActive ? colors.primaryForeground : colors.foreground} 
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
                  title="Total Quotes"
                  value={filterCounts.all}
                  icon="file-text"
                  onPress={() => setActiveFilter('all')}
                  colors={colors}
                />
                <KPICard
                  title="Draft"
                  value={filterCounts.draft}
                  icon="clock"
                  onPress={() => setActiveFilter('draft')}
                  colors={colors}
                />
                <KPICard
                  title="Sent"
                  value={filterCounts.sent}
                  icon="send"
                  onPress={() => setActiveFilter('sent')}
                  colors={colors}
                />
                <KPICard
                  title="Accepted"
                  value={filterCounts.accepted}
                  icon="check-circle"
                  onPress={() => setActiveFilter('accepted')}
                  colors={colors}
                />
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Feather name="file-text" size={iconSizes.md} color={colors.primary} />
                  <Text style={styles.sectionTitle}>{getSectionTitle()}</Text>
                </View>
              </View>

              {isLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              )}
            </>
          }
          renderItem={({ item: quote }) => (
            <QuoteCard
              quote={quote}
              clientName={getClientName(quote.clientId)}
              jobTitle={quote.title || quote.description || ''}
              onPress={() => router.push(`/more/quote/${quote.id}`)}
              onSend={() => handleSendQuote(quote.id)}
              onConvertToInvoice={() => handleConvertToInvoice(quote.id)}
              onDelete={() => handleDeleteQuote(quote.id)}
            />
          )}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIcon}>
                  <Feather name="file-text" size={iconSizes['4xl']} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyStateTitle}>No quotes found</Text>
                <Text style={styles.emptyStateSubtitle}>
                  {searchQuery || activeFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Send professional quotes that clients can accept online. GST calculated automatically.'}
                </Text>
                {!searchQuery && activeFilter === 'all' && (
                  <>
                    <PressableRow style={styles.emptyStateButton} onPress={navigateToCreateQuote} >
                      <Feather name="plus" size={16} color={colors.primaryForeground} />
                      <Text style={styles.emptyStateButtonText}>Create Your First Quote</Text>
                    </PressableRow>
                    <Text style={styles.emptyStateTip}>
                      Tip: Accepted quotes can be converted to invoices with one tap
                    </Text>
                  </>
                )}
              </View>
            ) : null
          }
        />
      </View>
      
      {/* Inline Email Compose Modal */}
      {selectedQuoteForEmail && (
        <EmailComposeModal
          visible={showEmailCompose}
          onClose={() => {
            setShowEmailCompose(false);
            setSelectedQuoteForEmail(null);
          }}
          type="quote"
          documentId={selectedQuoteForEmail.id}
          clientName={selectedQuoteForEmail.client?.name || 'Client'}
          clientEmail={selectedQuoteForEmail.client?.email || ''}
          documentNumber={selectedQuoteForEmail.quoteNumber || ''}
          documentTitle={selectedQuoteForEmail.title || 'Services'}
          total={`$${parseFloat(String(selectedQuoteForEmail.total || 0)).toFixed(2)}`}
          businessName={businessSettings?.businessName || user?.businessName || 'Your Business'}
          publicUrl={`${API_URL}/public/quote/${selectedQuoteForEmail.id}`}
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
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  emptyStateButtonText: {
    color: colors.primaryForeground,
    fontWeight: fontWeights.semibold,
    fontSize: typography.button.fontSize,
  },
  emptyStateTip: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  quotesList: {
    gap: spacing.md,
  },
  
  // === WEB-MATCHING CARD STYLES ===
  quoteCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  quoteCardContent: {
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
});
