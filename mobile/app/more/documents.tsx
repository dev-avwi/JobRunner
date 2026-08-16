import { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, usePageShell, fontWeights } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { format, formatDistanceToNow } from 'date-fns';
import { useContentWidth, useIsTablet } from '../../src/lib/device';
import { OwnerOnlyGuard } from '../../src/components/ui/OwnerOnlyGuard';

const CARD_GAP = spacing.sm;

interface Invoice {
  id: string;
  number?: string;
  title?: string;
  clientId: string;
  total: number;
  status: string;
  dueDate?: string;
  paidAt?: string;
  createdAt?: string;
  quoteId?: string;
  jobId?: string;
}

interface Quote {
  id: string;
  number?: string;
  title?: string;
  clientId: string;
  total: number;
  status: string;
  validUntil?: string;
  createdAt?: string;
  jobId?: string;
}

interface Receipt {
  id: string;
  receiptNumber: string;
  invoiceId: string;
  amount: number;
  paymentMethod: string;
  paidAt: string;
  clientId: string;
}

interface Client {
  id: string;
  name: string;
}

type TabType = 'quotes' | 'invoices' | 'receipts';
type QuoteFilterType = 'all' | 'draft' | 'sent' | 'accepted' | 'rejected';
type InvoiceFilterType = 'all' | 'draft' | 'sent' | 'paid' | 'overdue';
type ReceiptFilterType = 'all' | 'bank_transfer' | 'card' | 'cash';
type ViewMode = 'grid' | 'list';
type SortField = 'client' | 'status' | 'amount';
type SortDirection = 'asc' | 'desc';

const formatCurrency = (amount: number) => {
  const { formatCurrency: fmt } = require('../../src/lib/format');
  return fmt(amount, { compact: true });
};

const getQuoteStatusConfig = (status: string) => {
  switch (status) {
    case 'draft':
      return { label: 'Draft', icon: 'clock' as const, color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)' };
    case 'sent':
      return { label: 'Sent', icon: 'send' as const, color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' };
    case 'accepted':
      return { label: 'Accepted', icon: 'check-circle' as const, color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' };
    case 'rejected':
      return { label: 'Rejected', icon: 'x-circle' as const, color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' };
    default:
      return { label: status, icon: 'clock' as const, color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)' };
  }
};

const getInvoiceStatusConfig = (status: string) => {
  switch (status) {
    case 'draft':
      return { label: 'Draft', icon: 'clock' as const, color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)' };
    case 'sent':
      return { label: 'Sent', icon: 'send' as const, color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' };
    case 'paid':
      return { label: 'Paid', icon: 'check-circle' as const, color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' };
    case 'overdue':
      return { label: 'Overdue', icon: 'alert-circle' as const, color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' };
    default:
      return { label: status, icon: 'clock' as const, color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)' };
  }
};

const getInvoiceDisplayStatus = (invoice: Invoice): string => {
  if (invoice.status === 'sent' && invoice.dueDate) {
    const dueDate = new Date(invoice.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    if (dueDate < today) {
      return 'overdue';
    }
  }
  return invoice.status;
};

const getPaymentMethodLabel = (method: string) => {
  switch (method) {
    case 'bank_transfer': return 'Bank Transfer';
    case 'card': return 'Card';
    case 'cash': return 'Cash';
    case 'tap_to_pay': return 'Tap to Pay';
    case 'payment_link': return 'Payment Link';
    case 'qr_code': return 'QR Code';
    default: return method;
  }
};

function DocumentsScreenInner() {
  const { colors } = useTheme();
  const contentWidth = useContentWidth();
  const isTabletDevice = useIsTablet();
  const responsiveShell = usePageShell();
  const bottomInset = useBottomInset(40);
  const styles = useMemo(() => createStyles(colors, contentWidth, responsiveShell.paddingHorizontal), [colors, contentWidth, responsiveShell.paddingHorizontal]);
  
  const params = useLocalSearchParams<{ tab?: string; filter?: string }>();
  const initialTab = (params.tab as TabType) || 'quotes';
  const initialFilter = params.filter || 'all';
  
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [quoteFilter, setQuoteFilter] = useState<QuoteFilterType>(
    initialTab === 'quotes' ? (initialFilter as QuoteFilterType) : 'all'
  );
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilterType>(
    initialTab === 'invoices' ? (initialFilter as InvoiceFilterType) : 'all'
  );
  const [receiptFilter, setReceiptFilter] = useState<ReceiptFilterType>(
    initialTab === 'receipts' ? (initialFilter as ReceiptFilterType) : 'all'
  );
  const [sortField, setSortField] = useState<SortField>('client');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const clientMap = useMemo(() => {
    return new Map(clients.map(c => [c.id, c]));
  }, [clients]);

  const fetchData = useCallback(async () => {
    try {
      const [quotesRes, invoicesRes, receiptsRes, clientsRes] = await Promise.all([
        api.get<Quote[]>('/api/quotes'),
        api.get<Invoice[]>('/api/invoices'),
        api.get<Receipt[]>('/api/receipts').catch(() => ({ data: [] as Receipt[] })),
        api.get<Client[]>('/api/clients'),
      ]);
      
      setQuotes(quotesRes.data || []);
      setInvoices(invoicesRes.data || []);
      setReceipts(receiptsRes.data || []);
      setClients(clientsRes.data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Grid view is supported for quotes and invoices; receipts are list-only.
  // Also reset sort state to prevent stale data combinations
  useEffect(() => {
    if (activeTab === 'receipts') {
      setViewMode('list');
    }
    // Reset to default sort when switching tabs
    setSortField('status');
    setSortDirection('desc');
  }, [activeTab]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const getClientName = (clientId: string) => {
    return clientMap.get(clientId)?.name || 'Unknown Client';
  };

  const sortItems = useCallback(<T extends { status?: string; clientId?: string; total?: number; amount?: number }>(items: T[]): T[] => {
    return [...items].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'client':
          const clientNameA = getClientName(a.clientId || '');
          const clientNameB = getClientName(b.clientId || '');
          comparison = clientNameA.localeCompare(clientNameB);
          break;
        case 'amount':
          const amountA = a.total ?? a.amount ?? 0;
          const amountB = b.total ?? b.amount ?? 0;
          comparison = amountA - amountB;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [sortField, sortDirection, clientMap]);

  const filteredQuotes = useMemo(() => {
    let filtered = quotes;
    if (quoteFilter !== 'all') {
      filtered = filtered.filter(q => q.status === quoteFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(q => 
        (q.number || '').toLowerCase().includes(query) ||
        (q.title || '').toLowerCase().includes(query) ||
        getClientName(q.clientId).toLowerCase().includes(query)
      );
    }
    return viewMode === 'list' ? sortItems(filtered) : filtered;
  }, [quotes, quoteFilter, searchQuery, clientMap, viewMode, sortItems]);

  const filteredInvoices = useMemo(() => {
    let filtered = invoices;
    if (invoiceFilter !== 'all') {
      filtered = filtered.filter(inv => inv.status === invoiceFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(inv => 
        (inv.number || '').toLowerCase().includes(query) ||
        (inv.title || '').toLowerCase().includes(query) ||
        getClientName(inv.clientId).toLowerCase().includes(query)
      );
    }
    return viewMode === 'list' ? sortItems(filtered) : filtered;
  }, [invoices, invoiceFilter, searchQuery, clientMap, viewMode, sortItems]);

  const filteredReceipts = useMemo(() => {
    let filtered = receipts;
    if (receiptFilter !== 'all') {
      filtered = filtered.filter(r => r.paymentMethod === receiptFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        (r.receiptNumber || '').toLowerCase().includes(query) ||
        getClientName(r.clientId).toLowerCase().includes(query)
      );
    }
    return viewMode === 'list' ? sortItems(filtered) : filtered;
  }, [receipts, receiptFilter, searchQuery, clientMap, viewMode, sortItems]);

  const stats = useMemo(() => {
    const parseAmount = (val: any): number => {
      if (val === null || val === undefined) return 0;
      const num = typeof val === 'string' ? parseFloat(val) : (typeof val === 'number' ? val : 0);
      return isNaN(num) ? 0 : num;
    };
    const totalQuotes = quotes.reduce((sum, q) => sum + parseAmount(q.total), 0);
    const pendingQuotes = quotes.filter(q => q.status === 'sent').length;
    const wonQuotes = quotes.filter(q => q.status === 'accepted').reduce((sum, q) => sum + parseAmount(q.total), 0);
    const outstandingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
    const outstandingAmount = outstandingInvoices.reduce((sum, i) => sum + parseAmount(i.total), 0);
    const totalReceived = receipts.reduce((sum, r) => sum + parseAmount(r.amount), 0);
    
    return {
      totalQuotes,
      pendingQuotes,
      wonQuotes,
      outstandingCount: outstandingInvoices.length,
      outstandingAmount,
      totalReceived,
    };
  }, [quotes, invoices, receipts]);

  const renderHeader = () => (
    <View style={styles.headerRow}>
      <View>
        <Text style={styles.pageTitle}>Documents</Text>
        <Text style={styles.pageSubtitle}>Quotes, invoices, and receipts</Text>
      </View>
      <View style={styles.headerActions}>
        <View style={styles.viewToggle}>
          <PressableRow style={[styles.viewToggleButton, viewMode === 'grid' && styles.viewToggleButtonActive]} onPress={() => setViewMode('grid')} >
            <Feather name="grid" size={18} color={viewMode === 'grid' ? colors.primary : colors.mutedForeground} />
          </PressableRow>
          <PressableRow style={[styles.viewToggleButton, viewMode === 'list' && styles.viewToggleButtonActive]} onPress={() => setViewMode('list')} >
            <Feather name="list" size={18} color={viewMode === 'list' ? colors.primary : colors.mutedForeground} />
          </PressableRow>
        </View>
        <PressableRow style={styles.addButton} onPress={() => { if (activeTab === 'quotes') router.push('/more/quote/new'); else if (activeTab === 'invoices') router.push('/more/invoice/new'); }} >
          <Feather name="plus" size={18} color={colors.primaryForeground} />
          <Text style={styles.addButtonText}>New</Text>
        </PressableRow>
      </View>
    </View>
  );

  const renderKPICards = () => (
    <View style={styles.kpiRow}>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>TOTAL</Text>
        <Text style={[styles.kpiValue, { color: '#3b82f6' }]}>
          {formatCurrency(stats.totalQuotes)}
        </Text>
      </View>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>PENDING</Text>
        <Text style={[styles.kpiValue, { color: '#f59e0b' }]}>
          {stats.pendingQuotes}
        </Text>
      </View>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>WON</Text>
        <Text style={[styles.kpiValue, { color: '#22c55e' }]}>
          {formatCurrency(stats.wonQuotes)}
        </Text>
      </View>
    </View>
  );

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <Feather name="search" size={18} color={colors.mutedForeground} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search by title, client, or number..."
        placeholderTextColor={colors.mutedForeground}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      {searchQuery.length > 0 && (
        <PressableRow onPress={() => setSearchQuery('')}>
          <Feather name="x" size={18} color={colors.mutedForeground} />
        </PressableRow>
      )}
    </View>
  );

  const handleViewAll = () => {
    switch (activeTab) {
      case 'quotes':
        router.push('/more/quotes');
        break;
      case 'invoices':
        router.push('/more/invoices');
        break;
      case 'receipts':
        router.push('/more/receipts');
        break;
    }
  };

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <PressableRow style={[styles.tab, activeTab === 'quotes' && styles.activeTab]} onPress={() => setActiveTab('quotes')} >
        <Feather 
          name="file-text" 
          size={iconSizes.md} 
          color={activeTab === 'quotes' ? colors.primary : colors.mutedForeground} 
        />
        <Text style={[styles.tabText, activeTab === 'quotes' && styles.activeTabText]}>
          Quotes
        </Text>
        <View style={[styles.tabBadge, { backgroundColor: '#3b82f6' }]}>
          <Text style={styles.tabBadgeText}>{quotes.length}</Text>
        </View>
      </PressableRow>
      
      <PressableRow style={[styles.tab, activeTab === 'invoices' && styles.activeTab]} onPress={() => setActiveTab('invoices')} >
        <Feather 
          name="file" 
          size={iconSizes.md} 
          color={activeTab === 'invoices' ? colors.primary : colors.mutedForeground} 
        />
        <Text style={[styles.tabText, activeTab === 'invoices' && styles.activeTabText]}>
          Invoices
        </Text>
        <View style={[styles.tabBadge, { backgroundColor: '#f59e0b' }]}>
          <Text style={styles.tabBadgeText}>{invoices.length}</Text>
        </View>
      </PressableRow>
      
      <PressableRow style={[styles.tab, activeTab === 'receipts' && styles.activeTab]} onPress={() => setActiveTab('receipts')} >
        <Feather 
          name="credit-card" 
          size={iconSizes.md} 
          color={activeTab === 'receipts' ? colors.primary : colors.mutedForeground} 
        />
        <Text style={[styles.tabText, activeTab === 'receipts' && styles.activeTabText]}>
          Receipts
        </Text>
        <View style={[styles.tabBadge, { backgroundColor: '#22c55e' }]}>
          <Text style={styles.tabBadgeText}>{receipts.length}</Text>
        </View>
      </PressableRow>
    </View>
  );

  const renderViewAllButton = () => (
    <PressableRow style={styles.viewAllButton} onPress={handleViewAll} >
      <Feather name="maximize-2" size={16} color={colors.primary} />
      <Text style={styles.viewAllText}>
        View All {activeTab === 'quotes' ? 'Quotes' : activeTab === 'invoices' ? 'Invoices' : 'Receipts'}
      </Text>
      <Feather name="chevron-right" size={16} color={colors.primary} />
    </PressableRow>
  );

  const renderQuoteFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
      <View style={styles.filterContainer}>
        {(['all', 'draft', 'sent', 'accepted', 'rejected'] as QuoteFilterType[]).map((filter) => {
          const config = filter === 'all' ? null : getQuoteStatusConfig(filter);
          const count = filter === 'all' ? quotes.length : quotes.filter(q => q.status === filter).length;
          return (
            <PressableRow key={filter} style={[styles.filterChip, quoteFilter === filter && styles.activeFilterChip]} onPress={() => setQuoteFilter(filter)} >
              {config && <Feather name={config.icon} size={14} color={quoteFilter === filter ? colors.primaryForeground : config.color} />}
              <Text style={[styles.filterText, quoteFilter === filter && styles.activeFilterText]}>
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
              <View style={[styles.filterBadge, quoteFilter === filter && styles.activeFilterBadge]}>
                <Text style={[styles.filterBadgeText, quoteFilter === filter && styles.activeFilterBadgeText]}>
                  {count}
                </Text>
              </View>
            </PressableRow>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderInvoiceFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
      <View style={styles.filterContainer}>
        {(['all', 'draft', 'sent', 'paid', 'overdue'] as InvoiceFilterType[]).map((filter) => {
          const config = filter === 'all' ? null : getInvoiceStatusConfig(filter);
          const count = filter === 'all' ? invoices.length : invoices.filter(i => i.status === filter).length;
          return (
            <PressableRow key={filter} style={[styles.filterChip, invoiceFilter === filter && styles.activeFilterChip]} onPress={() => setInvoiceFilter(filter)} >
              {config && <Feather name={config.icon} size={14} color={invoiceFilter === filter ? colors.primaryForeground : config.color} />}
              <Text style={[styles.filterText, invoiceFilter === filter && styles.activeFilterText]}>
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
              <View style={[styles.filterBadge, invoiceFilter === filter && styles.activeFilterBadge]}>
                <Text style={[styles.filterBadgeText, invoiceFilter === filter && styles.activeFilterBadgeText]}>
                  {count}
                </Text>
              </View>
            </PressableRow>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderReceiptFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
      <View style={styles.filterContainer}>
        {(['all', 'bank_transfer', 'card', 'cash'] as ReceiptFilterType[]).map((filter) => {
          const count = filter === 'all' ? receipts.length : receipts.filter(r => r.paymentMethod === filter).length;
          return (
            <PressableRow key={filter} style={[styles.filterChip, receiptFilter === filter && styles.activeFilterChip]} onPress={() => setReceiptFilter(filter)} >
              <Text style={[styles.filterText, receiptFilter === filter && styles.activeFilterText]}>
                {getPaymentMethodLabel(filter === 'all' ? 'All' : filter)}
              </Text>
              <View style={[styles.filterBadge, receiptFilter === filter && styles.activeFilterBadge]}>
                <Text style={[styles.filterBadgeText, receiptFilter === filter && styles.activeFilterBadgeText]}>
                  {count}
                </Text>
              </View>
            </PressableRow>
          );
        })}
      </View>
    </ScrollView>
  );

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const renderSortableHeaderColumn = (
    field: SortField,
    label: string,
    flex: number = 1,
    align: 'flex-start' | 'flex-end' | 'center' = 'flex-start'
  ) => {
    const isActive = sortField === field;
    return (
      <PressableRow style={[styles.sortableColumn, { flex, justifyContent: 'center', alignItems: align }]} onPress={() => handleSortChange(field)} >
        <View style={styles.sortableColumnContent}>
          <Text style={[
            styles.sortableColumnText,
            isActive && styles.sortableColumnTextActive
          ]}>
            {label}
          </Text>
          <Text style={[
            styles.sortArrow,
            isActive && styles.sortArrowActive
          ]}>↕</Text>
        </View>
      </PressableRow>
    );
  };

  // Fixed column widths for proper alignment
  const COLUMN_WIDTHS = {
    status: 90,
    amount: 100,
    menu: 36,
  };

  // Sort indicator with stacked up/down chevrons
  const SortIndicator = ({ field, isActive }: { field: SortField; isActive: boolean }) => (
    <View style={styles.sortIndicator}>
      <Feather 
        name="chevron-up" 
        size={10} 
        color={isActive && sortField === field ? colors.primary : colors.mutedForeground} 
        style={{ marginBottom: -3 }}
      />
      <Feather 
        name="chevron-down" 
        size={10} 
        color={isActive && sortField === field ? colors.primary : colors.mutedForeground} 
        style={{ marginTop: -3 }}
      />
    </View>
  );

  // Quote-specific header (2 columns: Quote | Status)
  const renderQuoteSortHeader = () => (
    <View style={styles.sortHeaderRow}>
      <PressableRow style={styles.sortHeaderTitleColumn} onPress={() => handleSortChange('client')} >
        <Text style={[styles.sortableColumnText, sortField === 'client' && styles.sortableColumnTextActive]}>Quote</Text>
        <SortIndicator field="client" isActive={sortField === 'client'} />
      </PressableRow>
      <PressableRow style={[styles.sortHeaderStatusColumn, { width: COLUMN_WIDTHS.status }]} onPress={() => handleSortChange('status')} >
        <Text style={[styles.sortableColumnText, sortField === 'status' && styles.sortableColumnTextActive]}>
          Status
        </Text>
        <SortIndicator field="status" isActive={sortField === 'status'} />
      </PressableRow>
    </View>
  );

  // Invoice/Receipt header (4 columns: Client | Status | Amount | Menu)
  const renderInvoiceSortHeader = () => (
    <View style={styles.sortHeaderRow}>
      <PressableRow style={styles.sortHeaderTitleColumn} onPress={() => handleSortChange('client')} >
        <Text style={[styles.sortableColumnText, sortField === 'client' && styles.sortableColumnTextActive]}>
          {activeTab === 'invoices' ? 'Invoice' : 'Receipt'}
        </Text>
        <SortIndicator field="client" isActive={sortField === 'client'} />
      </PressableRow>
      <PressableRow style={[styles.sortHeaderStatusColumn, { width: COLUMN_WIDTHS.status }]} onPress={() => handleSortChange('status')} >
        <Text style={[styles.sortableColumnText, sortField === 'status' && styles.sortableColumnTextActive]}>
          Status
        </Text>
        <SortIndicator field="status" isActive={sortField === 'status'} />
      </PressableRow>
      <PressableRow style={[styles.sortHeaderAmountColumn, { width: COLUMN_WIDTHS.amount }]} onPress={() => handleSortChange('amount')} >
        <Text style={[styles.sortableColumnText, sortField === 'amount' && styles.sortableColumnTextActive]}>
          Amount
        </Text>
        <SortIndicator field="amount" isActive={sortField === 'amount'} />
      </PressableRow>
      <View style={{ width: COLUMN_WIDTHS.menu }} />
    </View>
  );

  // Dynamic header based on active tab
  const renderSortHeader = () => {
    if (activeTab === 'quotes') {
      return renderQuoteSortHeader();
    }
    return renderInvoiceSortHeader();
  };

  const renderQuoteGridCard = (quote: Quote) => {
    const statusConfig = getQuoteStatusConfig(quote.status);
    const client = clientMap.get(quote.clientId);
    
    return (
      <TouchableOpacity activeOpacity={0.7} key={quote.id} style={[styles.gridCard, { borderLeftColor: statusConfig.color }]} onPress={() => router.push(`/more/quote/${quote.id}`)} >
        <View style={styles.gridCardHeader}>
          <Text style={styles.gridCardTitle} numberOfLines={1}>
            {quote.title || quote.number || `Q-${quote.id.slice(0, 6)}`}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>
        <Text style={styles.gridCardClient} numberOfLines={1}>{client?.name || 'Unknown Client'}</Text>
        <View style={styles.gridCardFooter}>
          <Text style={styles.gridCardAmount}>{formatCurrency(quote.total)}</Text>
          <Text style={styles.gridCardDate}>
            {quote.createdAt ? formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true }) : ''}
          </Text>
        </View>
        {quote.jobId && quote.status === 'accepted' && (
          <TouchableOpacity
            style={styles.viewJobLink}
            onPress={(e: any) => { e?.stopPropagation?.(); router.push(`/job/${quote.jobId}`); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            data-testid={`quote-job-link-${quote.id}`}
          >
            <Feather name="briefcase" size={12} color={colors.primary} />
            <Text style={[styles.viewJobLinkText, { color: colors.primary }]}>View Job</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const renderQuoteListRow = (quote: Quote, isLast: boolean = false) => {
    const statusConfig = getQuoteStatusConfig(quote.status);
    const client = clientMap.get(quote.clientId);
    
    return (
      <PressableRow key={quote.id} style={[styles.listRow, !isLast && styles.listRowWithDivider]} onPress={() => router.push(`/more/quote/${quote.id}`)} data-testid={`row-quote-${quote.id}`} >
        <View style={styles.listRowContent}>
          <View style={styles.listRowTitleColumn}>
            <Text style={styles.listRowTitle} numberOfLines={1}>
              {quote.title || quote.number || `Q-${quote.id.slice(0, 6)}`}
            </Text>
            <Text style={styles.listRowClient} numberOfLines={1}>
              {client?.name || 'Unknown'}
            </Text>
          </View>
          <View style={{ width: COLUMN_WIDTHS.status, alignItems: 'flex-end' }}>
            <View style={[styles.listRowStatusBadge, { backgroundColor: statusConfig.bgColor }]}>
              <Text style={[styles.listRowStatusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
            {quote.jobId && quote.status === 'accepted' && (
              <TouchableOpacity
                style={styles.viewJobLink}
                onPress={(e: any) => { e?.stopPropagation?.(); router.push(`/job/${quote.jobId}`); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                data-testid={`row-quote-job-link-${quote.id}`}
              >
                <Feather name="briefcase" size={11} color={colors.primary} />
                <Text style={[styles.viewJobLinkText, { color: colors.primary }]}>View Job</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </PressableRow>
    );
  };

  const renderInvoiceGridCard = (invoice: Invoice) => {
    const displayStatus = getInvoiceDisplayStatus(invoice);
    const statusConfig = getInvoiceStatusConfig(displayStatus);
    const client = clientMap.get(invoice.clientId);
    const linkedReceipt = receipts.find(r => r.invoiceId === invoice.id);
    
    return (
      <TouchableOpacity activeOpacity={0.7} key={invoice.id} style={[styles.gridCard, { borderLeftColor: statusConfig.color }]} onPress={() => router.push(`/more/invoice/${invoice.id}`)} >
        <View style={styles.gridCardHeader}>
          <Text style={styles.gridCardTitle} numberOfLines={1}>
            {invoice.title || invoice.number || `INV-${invoice.id.slice(0, 6)}`}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>
        <Text style={styles.gridCardClient} numberOfLines={1}>{client?.name || 'Unknown Client'}</Text>
        <View style={styles.gridCardFooter}>
          <Text style={styles.gridCardAmount}>{formatCurrency(invoice.total)}</Text>
          <Text style={styles.gridCardDate}>
            {invoice.createdAt ? formatDistanceToNow(new Date(invoice.createdAt), { addSuffix: true }) : ''}
          </Text>
        </View>
        {linkedReceipt && (
          <View style={styles.linkedBadge}>
            <Feather name="link-2" size={10} color="#22c55e" />
            <Text style={styles.linkedBadgeText}>Receipt</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderInvoiceListRow = (invoice: Invoice, isLast: boolean = false) => {
    const displayStatus = getInvoiceDisplayStatus(invoice);
    const statusConfig = getInvoiceStatusConfig(displayStatus);
    const client = clientMap.get(invoice.clientId);
    
    return (
      <PressableRow key={invoice.id} style={[styles.listRow, !isLast && styles.listRowWithDivider]} onPress={() => router.push(`/more/invoice/${invoice.id}`)} data-testid={`row-invoice-${invoice.id}`} >
        <View style={styles.listRowContent}>
          <View style={styles.listRowTitleColumn}>
            <Text style={styles.listRowTitle} numberOfLines={1}>
              {invoice.title || invoice.number || `INV-${invoice.id.slice(0, 6)}`}
            </Text>
            <Text style={styles.listRowClient} numberOfLines={1}>
              {client?.name || 'Unknown'}
            </Text>
          </View>
          <View style={{ width: COLUMN_WIDTHS.status, alignItems: 'center' }}>
            <View style={[styles.listRowStatusBadge, { backgroundColor: statusConfig.bgColor }]}>
              <Text style={[styles.listRowStatusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>
          <View style={{ width: COLUMN_WIDTHS.amount, alignItems: 'flex-end' }}>
            <Text style={styles.listRowAmount}>{formatCurrency(invoice.total)}</Text>
          </View>
          <View style={{ width: COLUMN_WIDTHS.menu, alignItems: 'center' }}>
            <PressableRow onPress={() => router.push(`/more/invoice/${invoice.id}`)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} >
              <Feather name="more-vertical" size={18} color={colors.mutedForeground} />
            </PressableRow>
          </View>
        </View>
      </PressableRow>
    );
  };

  const renderReceiptGridCard = (receipt: Receipt) => {
    const client = clientMap.get(receipt.clientId);
    
    return (
      <TouchableOpacity activeOpacity={0.7} key={receipt.id} style={[styles.gridCard, { borderLeftColor: '#22c55e' }]} onPress={() => router.push(`/more/receipt/${receipt.id}`)} >
        <View style={styles.gridCardHeader}>
          <Text style={styles.gridCardTitle} numberOfLines={1}>
            {receipt.receiptNumber}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
            <Text style={[styles.statusText, { color: '#22c55e' }]}>Paid</Text>
          </View>
        </View>
        <Text style={styles.gridCardClient} numberOfLines={1}>{client?.name || 'Unknown Client'}</Text>
        <View style={styles.gridCardFooter}>
          <Text style={styles.gridCardAmount}>{formatCurrency(receipt.amount)}</Text>
          <Text style={styles.gridCardDate}>
            {format(new Date(receipt.paidAt), 'dd MMM')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderReceiptListRow = (receipt: Receipt, isLast: boolean = false) => {
    const client = clientMap.get(receipt.clientId);
    
    return (
      <PressableRow key={receipt.id} style={[styles.listRow, !isLast && styles.listRowWithDivider]} onPress={() => router.push(`/more/receipt/${receipt.id}`)} data-testid={`row-receipt-${receipt.id}`} >
        <View style={styles.listRowContent}>
          <View style={styles.listRowTitleColumn}>
            <Text style={styles.listRowTitle} numberOfLines={1}>
              {receipt.receiptNumber}
            </Text>
            <Text style={styles.listRowClient} numberOfLines={1}>
              {client?.name || 'Unknown'}
            </Text>
          </View>
          <View style={{ width: COLUMN_WIDTHS.status, alignItems: 'center' }}>
            <View style={[styles.listRowStatusBadge, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
              <Text style={[styles.listRowStatusText, { color: '#22c55e' }]}>
                {getPaymentMethodLabel(receipt.paymentMethod)}
              </Text>
            </View>
          </View>
          <View style={{ width: COLUMN_WIDTHS.amount, alignItems: 'flex-end' }}>
            <Text style={styles.listRowAmount}>{formatCurrency(receipt.amount)}</Text>
          </View>
          <View style={{ width: COLUMN_WIDTHS.menu, alignItems: 'center' }}>
            <PressableRow onPress={() => router.push(`/more/receipt/${receipt.id}`)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} >
              <Feather name="more-vertical" size={18} color={colors.mutedForeground} />
            </PressableRow>
          </View>
        </View>
      </PressableRow>
    );
  };

  const renderEmptyState = (type: TabType) => {
    const config = {
      quotes: { icon: 'file-text' as const, title: 'No quotes found', subtitle: 'Create your first quote to get started', action: () => router.push('/more/quote/new'), actionText: 'Create Quote' },
      invoices: { icon: 'file' as const, title: 'No invoices found', subtitle: 'Create your first invoice to get started', action: () => router.push('/more/invoice/new'), actionText: 'Create Invoice' },
      receipts: { icon: 'credit-card' as const, title: 'No receipts found', subtitle: 'Receipts are created when payments are collected', action: undefined, actionText: '' },
    };
    const { icon, title, subtitle, action, actionText } = config[type];
    
    return (
      <View style={styles.emptyState}>
        <Feather name={icon} size={48} color={colors.mutedForeground} />
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptySubtitle}>{subtitle}</Text>
        {action && (
          <PressableRow style={styles.emptyButton} onPress={action}>
            <Feather name="plus" size={16} color={colors.primary} />
            <Text style={styles.emptyButtonText}>{actionText}</Text>
          </PressableRow>
        )}
      </View>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading documents...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'quotes':
        return (
          <>
            {renderQuoteFilters()}
            {filteredQuotes.length === 0 ? renderEmptyState('quotes') : (
              <>
                {viewMode === 'list' && renderSortHeader()}
                <View style={viewMode === 'grid' ? styles.gridContainer : styles.listContainer}>
                  {filteredQuotes.map((quote, index) => 
                    viewMode === 'grid' 
                      ? renderQuoteGridCard(quote) 
                      : renderQuoteListRow(quote, index === filteredQuotes.length - 1)
                  )}
                </View>
              </>
            )}
          </>
        );

      case 'invoices':
        return (
          <>
            {renderInvoiceFilters()}
            {filteredInvoices.length === 0 ? renderEmptyState('invoices') : (
              <>
                {viewMode === 'list' && renderSortHeader()}
                <View style={viewMode === 'grid' ? styles.gridContainer : styles.listContainer}>
                  {filteredInvoices.map((invoice, index) => 
                    viewMode === 'grid' 
                      ? renderInvoiceGridCard(invoice) 
                      : renderInvoiceListRow(invoice, index === filteredInvoices.length - 1)
                  )}
                </View>
              </>
            )}
          </>
        );

      case 'receipts':
        return (
          <>
            {renderReceiptFilters()}
            {filteredReceipts.length === 0 ? renderEmptyState('receipts') : (
              <>
                {viewMode === 'list' && renderSortHeader()}
                <View style={viewMode === 'grid' ? styles.gridContainer : styles.listContainer}>
                  {filteredReceipts.map((receipt, index) => 
                    viewMode === 'grid' 
                      ? renderReceiptGridCard(receipt) 
                      : renderReceiptListRow(receipt, index === filteredReceipts.length - 1)
                  )}
                </View>
              </>
            )}
          </>
        );
    }
  };

  // Dynamic content container style for iPad-responsive padding
  const responsiveContentStyle = useMemo(() => ({
    paddingHorizontal: responsiveShell.paddingHorizontal,
    paddingTop: responsiveShell.paddingTop,
    paddingBottom: responsiveShell.paddingBottom,
  }), [responsiveShell]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[responsiveContentStyle, { paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {renderHeader()}
        {renderKPICards()}
        {renderSearchBar()}
        {renderTabs()}
        {renderViewAllButton()}
        {renderContent()}
        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>
    </>
  );
}

const createStyles = (colors: ThemeColors, contentWidth: number, responsivePadding: number = spacing.lg) => {
  const GRID_CARD_WIDTH = '48%' as const;
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  pageTitle: {
    fontSize: typography.sizes['3xl'],
    fontWeight: fontWeights.extrabold,
    color: colors.foreground,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  pageSubtitle: {
    fontSize: typography.button.fontSize,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  viewToggleButton: {
    padding: spacing.sm,
  },
  viewToggleButtonActive: {
    backgroundColor: colors.primaryLight,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
  },
  addButtonText: {
    color: colors.primaryForeground,
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  kpiLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    fontWeight: fontWeights.semibold,
    marginBottom: spacing.xs,
  },
  kpiValue: {
    ...typography.subtitle,
    fontWeight: fontWeights.bold,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
    paddingVertical: 0,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xs,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    gap: 4,
  },
  activeTab: {
    backgroundColor: colors.primaryLight,
  },
  tabText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  activeTabText: {
    color: colors.primary,
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.semibold,
    color: colors.white,
    fontSize: typography.sizes.xs,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  viewAllText: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
    flex: 1,
    textAlign: 'center',
  },
  filterScroll: {
    marginBottom: spacing.md,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterChip: {
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
  activeFilterChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    ...typography.caption,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  activeFilterText: {
    color: colors.primaryForeground,
  },
  filterBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    minWidth: 20,
    alignItems: 'center',
  },
  activeFilterBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filterBadgeText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    fontSize: typography.sizes.xs,
  },
  activeFilterBadgeText: {
    color: colors.white,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  listContainer: {
  },
  gridCard: {
    width: GRID_CARD_WIDTH,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderLeftWidth: 3,
    ...shadows.sm,
  },
  gridCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  gridCardTitle: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    flex: 1,
    fontSize: typography.sizes.sm,
  },
  gridCardClient: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  gridCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewJobLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  viewJobLinkText: {
    ...typography.caption,
    fontWeight: fontWeights.medium,
    fontSize: 11,
  },
  gridCardAmount: {
    ...typography.body,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  gridCardDate: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    fontSize: typography.sizes.xs,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderLeftWidth: 3,
    ...shadows.sm,
  },
  listCardContent: {
    flex: 1,
  },
  listCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  listCardTitle: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    flex: 1,
    marginRight: spacing.sm,
  },
  listCardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  listCardAmount: {
    ...typography.body,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  listCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listCardDate: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  statusText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.semibold,
    fontSize: typography.sizes.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  metaTextSmall: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(34,197,94,0.1)',
    alignSelf: 'flex-start',
  },
  linkedBadgeText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.medium,
    color: '#22c55e',
    fontSize: typography.sizes.xs,
  },
  linkedBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(34,197,94,0.1)',
  },
  linkedBadgeTextInline: {
    ...typography.captionSmall,
    fontWeight: fontWeights.medium,
    color: '#22c55e',
    fontSize: typography.sizes.xs,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
  },
  loadingText: {
    ...typography.body,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
  },
  emptyTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    marginTop: spacing.lg,
  },
  emptyButtonText: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  sortHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  sortHeaderSpacer: {
    flex: 1,
    minWidth: 0,
  },
  sortHeaderMenuSpacer: {
    width: 34,
  },
  sortableColumn: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xs,
    minHeight: 28,
  },
  sortableColumnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sortableColumnText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    fontWeight: fontWeights.medium,
    fontSize: typography.sizes.xs,
  },
  sortableColumnTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
  sortArrow: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
    marginLeft: 2,
  },
  sortArrowActive: {
    color: colors.primary,
  },
  sortIndicator: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  sortHeaderTitleColumn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  sortHeaderStatusColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortHeaderAmountColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sortHeaderDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.cardBorder,
  },
  listRow: {
    minHeight: 56,
  },
  listRowWithDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  listRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  listRowLeft: {
    flex: 1,
    minWidth: 0,
  },
  listRowTitleColumn: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.sm,
  },
  listRowTitle: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    fontSize: typography.sizes.sm,
  },
  listRowClient: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    fontSize: typography.sizes.xs,
  },
  listRowAmount: {
    ...typography.body,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    fontSize: typography.button.fontSize,
    minWidth: 70,
    textAlign: 'right',
  },
  listRowMenuButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  listRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listRowStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  listRowStatusText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.semibold,
    fontSize: typography.sizes.xs,
  },
  listRowDate: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    fontSize: typography.sizes.xs,
  },
  listRowLinkedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(34,197,94,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
};

export default function DocumentsScreen() {
  return (
    <OwnerOnlyGuard>
      <DocumentsScreenInner />
    </OwnerOnlyGuard>
  );
}
