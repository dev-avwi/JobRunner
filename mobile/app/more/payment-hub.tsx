import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Modal,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { useActionSheet } from '../../src/components/ui/ActionSheet';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, fontWeights } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { format, isAfter, isBefore, subDays, differenceInDays } from 'date-fns';
import { OwnerOnlyGuard } from '../../src/components/ui/OwnerOnlyGuard';

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
}

interface Client {
  id: string;
  name: string;
}

interface ChaserItem {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  amount: number;
  amountPaid: number;
  outstanding: number;
  dueDate: string | null;
  daysOverdue: number;
  isOverdue: boolean;
  status: string;
  urgency: 'upcoming' | 'friendly' | 'firm' | 'final' | 'critical';
  recommendedAction: string;
  recommendedTone: 'friendly' | 'professional' | 'firm';
  remindersSent: number;
  lastReminderDate: string | null;
  lastReminderType: string | null;
  lastReminderVia: string | null;
  daysSinceLastContact: number | null;
  paymentMethod: string | null;
}

interface ChaserSummary {
  totalOverdueAmount: number;
  totalOverdueCount: number;
  clientsToChase: number;
  avgDaysOverdue: number;
  collectionRate: number;
  totalOutstanding: number;
  totalOutstandingCount: number;
}

interface ChaserResponse {
  summary: ChaserSummary;
  items: ChaserItem[];
}

interface StripeConnectStatus {
  connected: boolean;
  stripeAvailable?: boolean;
  connectEnabled?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  onboardingStatus?: string;
  message?: string;
  error?: string;
}

interface StripeBalance {
  available: number;
  pending: number;
  error?: string;
}

interface StripePayout {
  id: string;
  amount: number;
  status: string;
  arrivalDate: string | null;
  created: string;
  method?: string;
  destination?: string | null;
}

type TabType = 'overview' | 'invoices' | 'quotes' | 'chaser' | 'payments';
type InvoiceFilterType = 'all' | 'outstanding' | 'overdue' | 'paid' | 'draft';
type TimeRangeType = '7d' | '30d' | '90d' | 'all';

// Format currency - uses centralised utility (compact for KPI summaries)
const formatCurrency = (amount: number | string) => {
  const { formatCurrency: fmt } = require('../../src/lib/format');
  return fmt(amount, { compact: true });
};

function PaymentHubScreenInner() {
  const { colors } = useTheme();
  const showActionSheet = useActionSheet();
  const bottomInset = useBottomInset(40);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ tab?: string }>();
  
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const validTabs: TabType[] = ['overview', 'invoices', 'quotes', 'chaser', 'payments'];
    if (params.tab && validTabs.includes(params.tab as TabType)) {
      return params.tab as TabType;
    }
    return 'overview';
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accessRestricted, setAccessRestricted] = useState(false);
  
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus | null>(null);
  const [stripeBalance, setStripeBalance] = useState<StripeBalance | null>(null);
  const [stripePayouts, setStripePayouts] = useState<StripePayout[]>([]);
  const [stripeLoading, setStripeLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilterType>('all');
  const [timeRange, setTimeRange] = useState<TimeRangeType>('30d');

  const [chaserData, setChaserData] = useState<ChaserResponse | null>(null);
  const [chaserLoading, setChaserLoading] = useState(false);
  const [chaserFilter, setChaserFilter] = useState<string>('all');
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [toneSelector, setToneSelector] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [previewModal, setPreviewModal] = useState<{ visible: boolean; invoiceId: string; tone: string; clientName: string; invoiceNumber: string; amount: number; preview: string; loading: boolean }>({
    visible: false, invoiceId: '', tone: '', clientName: '', invoiceNumber: '', amount: 0, preview: '', loading: false,
  });

  const clientMap = useMemo(() => {
    return new Map(clients.map(c => [c.id, c]));
  }, [clients]);

  const fetchStripeData = useCallback(async () => {
    try {
      const statusRes = await api.get<StripeConnectStatus>('/api/stripe-connect/status');
      if (statusRes.error) {
        console.warn('Failed to fetch Stripe status:', statusRes.error);
        return;
      }
      setStripeStatus(statusRes.data ?? null);
      
      if (statusRes.data?.connected && statusRes.data?.chargesEnabled) {
        const [balanceRes, payoutsRes] = await Promise.all([
          api.get<StripeBalance>('/api/stripe-connect/balance').catch(() => ({ data: null, error: 'fetch failed' })),
          api.get<{ payouts: StripePayout[] }>('/api/stripe-connect/payouts').catch(() => ({ data: { payouts: [] as StripePayout[] }, error: 'fetch failed' })),
        ]);
        setStripeBalance(('error' in balanceRes && balanceRes.error) ? null : (balanceRes.data ?? null));
        setStripePayouts(('error' in payoutsRes && payoutsRes.error) ? [] : (payoutsRes.data?.payouts || []));
      }
    } catch (error) {
      console.warn('Failed to fetch Stripe data:', error);
    } finally {
      setStripeLoading(false);
    }
  }, []);

  const fetchChaserData = useCallback(async () => {
    setChaserLoading(true);
    try {
      const res = await api.get<ChaserResponse>('/api/payment-chaser/summary');
      if (res.error) {
        console.warn('Failed to fetch chaser data:', res.error);
      } else {
        setChaserData(res.data ?? null);
      }
    } catch (error) {
      console.warn('Failed to fetch chaser data:', error);
    } finally {
      setChaserLoading(false);
    }
  }, []);

  const generatePreviewMessage = (tone: string, clientName: string, invoiceNumber: string, amount: number) => {
    const formattedAmount = `$${amount.toFixed(2)}`;
    const firstName = clientName.split(' ')[0];
    if (tone === 'friendly') {
      return `Hi ${firstName},\n\nJust a friendly reminder that invoice ${invoiceNumber} for ${formattedAmount} is still outstanding. I understand things can get busy — if you've already taken care of it, please disregard this message.\n\nHappy to answer any questions you might have.\n\nCheers!`;
    } else if (tone === 'professional') {
      return `Dear ${firstName},\n\nThis is a reminder regarding invoice ${invoiceNumber} for ${formattedAmount} which remains unpaid. We would appreciate your prompt attention to this matter.\n\nPlease don't hesitate to reach out if you have any queries regarding this invoice.\n\nKind regards`;
    } else {
      return `Dear ${firstName},\n\nThis is a final notice regarding the overdue invoice ${invoiceNumber} for ${formattedAmount}. Despite previous reminders, this amount remains outstanding.\n\nImmediate payment is required to avoid further action. Please settle this invoice within 7 days.\n\nRegards`;
    }
  };

  const handlePreviewReminder = useCallback((invoiceId: string, tone: string, clientName: string, invoiceNumber: string, amount: number) => {
    const preview = generatePreviewMessage(tone, clientName, invoiceNumber, amount);
    setPreviewModal({ visible: true, invoiceId, tone, clientName, invoiceNumber, amount, preview, loading: false });
  }, []);

  const handleConfirmSendReminder = useCallback(async () => {
    const { invoiceId, tone } = previewModal;
    setPreviewModal(prev => ({ ...prev, loading: true }));
    try {
      const response = await api.post(`/api/invoices/${invoiceId}/reminder`, { tone });
      if (response.error) {
        Alert.alert('Failed to Send', response.error);
      } else {
        Alert.alert('Reminder Sent', `${tone.charAt(0).toUpperCase() + tone.slice(1)} reminder sent successfully`);
        setToneSelector(null);
        fetchChaserData();
      }
    } catch (error: any) {
      Alert.alert('Failed to Send', error?.message || 'Could not send reminder');
    } finally {
      setPreviewModal(prev => ({ ...prev, visible: false, loading: false }));
      setSendingReminder(null);
    }
  }, [previewModal, fetchChaserData]);

  const handleSendReminder = useCallback(async (invoiceId: string, tone: string) => {
    setSendingReminder(invoiceId);
    try {
      const response = await api.post(`/api/invoices/${invoiceId}/reminder`, { tone });
      if (response.error) {
        Alert.alert('Failed to Send', response.error);
      } else {
        Alert.alert('Reminder Sent', `${tone.charAt(0).toUpperCase() + tone.slice(1)} reminder sent successfully`);
        setToneSelector(null);
        fetchChaserData();
      }
    } catch (error: any) {
      Alert.alert('Failed to Send', error?.message || 'Could not send reminder');
    } finally {
      setSendingReminder(null);
    }
  }, [fetchChaserData]);

  const handleGetAiInsights = useCallback(async () => {
    setAiLoading(true);
    try {
      const res = await api.post<{ insights: string }>('/api/payment-chaser/ai-insights', {});
      if (res.error) {
        Alert.alert('AI Insights Error', res.error);
      } else {
        setAiInsights(res.data?.insights || null);
      }
    } catch (error) {
      Alert.alert('AI Insights Error', 'Could not generate insights. Check your AI settings.');
    } finally {
      setAiLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [invoicesRes, quotesRes, clientsRes] = await Promise.all([
        api.get<Invoice[]>('/api/invoices'),
        api.get<Quote[]>('/api/quotes'),
        api.get<Client[]>('/api/clients'),
      ]);
      setInvoices(invoicesRes.error ? [] : (Array.isArray(invoicesRes.data) ? invoicesRes.data : []));
      setQuotes(quotesRes.error ? [] : (Array.isArray(quotesRes.data) ? quotesRes.data : []));
      setClients(clientsRes.error ? [] : (Array.isArray(clientsRes.data) ? clientsRes.data : []));

      const isPermissionError = (e?: string) =>
        !!e && /access denied|permission|not authorized|forbidden/i.test(e);
      const restricted =
        isPermissionError(invoicesRes.error) || isPermissionError(quotesRes.error);

      if (restricted) {
        // The current workspace role can't view this business's invoices/quotes
        // (e.g. a subcontractor in a joined business). Show a clean restricted
        // state instead of an alarming "Loading Error" retry prompt.
        setAccessRestricted(true);
      } else {
        setAccessRestricted(false);
        const transientError =
          (invoicesRes.error && !isPermissionError(invoicesRes.error)) ||
          (quotesRes.error && !isPermissionError(quotesRes.error)) ||
          (clientsRes.error && !isPermissionError(clientsRes.error));
        if (transientError) {
          Alert.alert('Loading Error', 'Some payment data could not be loaded. Pull down to retry.');
        }
      }
    } catch (error) {
      console.warn('Failed to fetch money hub data:', error);
      setAccessRestricted(false);
      Alert.alert('Loading Error', 'Could not load payment data. Pull down to retry.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchStripeData();
    fetchChaserData();
  }, [fetchData, fetchStripeData, fetchChaserData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
    fetchStripeData();
    fetchChaserData();
  }, [fetchData, fetchStripeData, fetchChaserData]);

  const handleConnectStripe = useCallback(async () => {
    setIsConnecting(true);
    try {
      const response = await api.post<{ url?: string; onboardingUrl?: string }>('/api/stripe-connect/onboard');
      if (response.error) {
        Alert.alert('Error', response.error);
      } else if (response.data?.url || response.data?.onboardingUrl) {
        const url = response.data.url || response.data.onboardingUrl!;
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
          Alert.alert('Error', 'Unable to open Stripe onboarding. Please check your browser settings.');
          return;
        }
        try {
          await Linking.openURL(url);
        } catch (linkError) {
          console.error('Failed to open Stripe URL:', linkError);
          Alert.alert('Error', 'Failed to open Stripe onboarding page. Please try again.');
        }
      } else {
        Alert.alert('Error', 'Could not start Stripe onboarding');
      }
    } catch (error) {
      console.error('Failed to connect Stripe:', error);
      Alert.alert('Error', 'Failed to connect Stripe. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const [creatingPaymentLink, setCreatingPaymentLink] = useState<string | null>(null);

  const handleCreatePaymentLink = useCallback(async (invoiceId: string) => {
    if (!stripeStatus?.connected || !stripeStatus?.chargesEnabled) {
      Alert.alert('Stripe Not Connected', 'Connect your Stripe account to create payment links.');
      return;
    }
    setCreatingPaymentLink(invoiceId);
    try {
      const response = await api.post<{ paymentUrl?: string; url?: string; error?: string }>(
        `/api/invoices/${invoiceId}/generate-payment-link`
      );
      const paymentUrl = response.data?.paymentUrl || response.data?.url;
      if (paymentUrl) {
        showActionSheet({
          title: 'Payment Link Created',
          message: 'Share this payment link with your client?',
          actions: [
            {
              label: 'Copy Link',
              icon: 'copy',
              onPress: () => {
                import('expo-clipboard').then(({ setStringAsync }) => {
                  setStringAsync(paymentUrl);
                  Alert.alert('Copied', 'Payment link copied to clipboard.');
                }).catch(() => {
                  Alert.alert('Link', paymentUrl);
                });
              },
            },
            {
              label: 'Share',
              icon: 'share-2',
              onPress: async () => {
                try {
                  const { Share: RNShare } = await import('react-native');
                  await RNShare.share({ message: paymentUrl, title: 'Payment Link' });
                } catch (shareError) {
                  console.warn('Failed to share payment link:', shareError);
                }
              },
            },
          ],
        });
      } else {
        Alert.alert('Error', response.error || 'Failed to create payment link.');
      }
    } catch (error: any) {
      const message = error?.message || 'Failed to create payment link.';
      Alert.alert('Error', message);
    } finally {
      setCreatingPaymentLink(null);
    }
  }, [stripeStatus]);

  const handleOpenStripeDashboard = useCallback(async () => {
    try {
      const response = await api.get<{ url?: string }>('/api/stripe-connect/dashboard');
      if (response.error) {
        Alert.alert('Error', response.error);
      } else if (response.data?.url) {
        const url = response.data.url;
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
          Alert.alert('Error', 'Unable to open Stripe dashboard. Please check your browser settings.');
          return;
        }
        try {
          await Linking.openURL(url);
        } catch (linkError) {
          console.warn('Failed to open Stripe dashboard URL:', linkError);
          Alert.alert('Error', 'Failed to open Stripe dashboard page. Please try again.');
        }
      } else {
        Alert.alert('Error', 'Could not open Stripe dashboard');
      }
    } catch (error) {
      console.warn('Failed to open Stripe dashboard:', error);
      Alert.alert('Error', 'Failed to open Stripe dashboard. Please try again.');
    }
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    const outstanding = invoices.filter(
      inv => inv.status !== 'paid' && inv.status !== 'draft'
    );
    const outstandingTotal = outstanding.reduce((sum, inv) => sum + inv.total, 0);

    const overdue = outstanding.filter(
      inv => inv.dueDate && isBefore(new Date(inv.dueDate), now)
    );
    const overdueTotal = overdue.reduce((sum, inv) => sum + inv.total, 0);

    const paid = invoices.filter(inv => inv.status === 'paid');
    const paidTotal = paid.reduce((sum, inv) => sum + inv.total, 0);

    const recentPaid = paid.filter(
      inv => inv.paidAt && isAfter(new Date(inv.paidAt), thirtyDaysAgo)
    );
    const recentPaidTotal = recentPaid.reduce((sum, inv) => sum + inv.total, 0);

    const pendingQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'viewed');
    const pendingQuotesTotal = pendingQuotes.reduce((sum, q) => sum + q.total, 0);

    return {
      outstandingTotal,
      outstandingCount: outstanding.length,
      overdueTotal,
      overdueCount: overdue.length,
      recentPaidTotal,
      recentPaidCount: recentPaid.length,
      pendingQuotesTotal,
      pendingQuotesCount: pendingQuotes.length,
    };
  }, [invoices, quotes]);

  const renderKPICard = (
    title: string, 
    value: string, 
    subtitle: string, 
    iconName: keyof typeof Feather.glyphMap, 
    iconColor: string,
    variant: 'default' | 'success' | 'warning' | 'danger' = 'default'
  ) => {
    const variantStyles = {
      default: { bg: colors.card, border: colors.cardBorder },
      success: { bg: `${colors.success}15`, border: `${colors.success}30` },
      warning: { bg: `${colors.warning}15`, border: `${colors.warning}30` },
      danger: { bg: `${colors.destructive}15`, border: `${colors.destructive}30` },
    };
    const style = variantStyles[variant];

    return (
      <View style={[styles.kpiCard, { backgroundColor: style.bg, borderColor: style.border }]}>
        <View style={styles.kpiHeader}>
          <Text style={styles.kpiTitle}>{title}</Text>
          <View style={[styles.kpiIcon, { backgroundColor: `${iconColor}15` }]}>
            <Feather name={iconName} size={iconSizes.md} color={iconColor} />
          </View>
        </View>
        <Text style={styles.kpiValue}>{value}</Text>
        <Text style={styles.kpiSubtitle}>{subtitle}</Text>
      </View>
    );
  };

  const renderStripeConnectCard = () => {
    if (stripeLoading) {
      return (
        <View style={styles.stripeCard}>
          <View style={styles.stripeCardHeader}>
            <View style={[styles.stripeLoadingIcon, { backgroundColor: colors.muted }]} />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <View style={{ width: 80, height: 14, backgroundColor: colors.muted, borderRadius: radius.sm }} />
              <View style={{ width: 120, height: 18, backgroundColor: colors.muted, borderRadius: radius.sm }} />
            </View>
          </View>
        </View>
      );
    }

    const isConnected = stripeStatus?.connected && stripeStatus?.chargesEnabled;
    const needsSetup = stripeStatus?.connected && !stripeStatus?.chargesEnabled;
    const availableBalance = stripeBalance?.available || 0;
    const pendingBalance = stripeBalance?.pending || 0;

    return (
      <View style={[
        styles.stripeCard,
        isConnected && styles.stripeCardConnected,
        needsSetup && styles.stripeCardWarning,
      ]}>
        <View style={styles.stripeCardHeader}>
          <View style={[
            styles.stripeIconWrapper,
            { backgroundColor: isConnected ? `${colors.success}15` : needsSetup ? `${colors.warning}15` : colors.muted }
          ]}>
            <Feather 
              name={isConnected ? 'credit-card' : needsSetup ? 'alert-circle' : 'link-2'} 
              size={iconSizes.lg} 
              color={isConnected ? colors.success : needsSetup ? colors.warning : colors.mutedForeground} 
            />
          </View>
          <View style={styles.stripeCardContent}>
            <View style={styles.stripeCardTitleRow}>
              <Text style={styles.stripeCardTitle}>Stripe Connect</Text>
              <View style={[
                styles.stripeCardBadge,
                { backgroundColor: isConnected ? `${colors.success}20` : needsSetup ? `${colors.warning}20` : `${colors.mutedForeground}20` }
              ]}>
                <Text style={[
                  styles.stripeCardBadgeText,
                  { color: isConnected ? colors.success : needsSetup ? colors.warning : colors.mutedForeground }
                ]}>
                  {isConnected ? 'Connected' : needsSetup ? 'Setup Required' : 'Not Connected'}
                </Text>
              </View>
            </View>
            {isConnected ? (
              <View style={styles.balanceRow}>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceLabel}>Available</Text>
                  <Text style={[styles.balanceValue, { color: colors.success }]}>
                    ${availableBalance.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceLabel}>Pending</Text>
                  <Text style={styles.balanceValueMuted}>
                    ${pendingBalance.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            ) : needsSetup ? (
              <Text style={styles.stripeCardDescription}>
                Complete your Stripe account setup to start accepting payments
              </Text>
            ) : (
              <Text style={styles.stripeCardDescription}>
                Connect your Stripe account to accept online payments
              </Text>
            )}
          </View>
        </View>
        <View style={styles.stripeCardActions}>
          {isConnected ? (
            <PressableRow style={styles.stripeButton} onPress={handleOpenStripeDashboard} >
              <Feather name="external-link" size={iconSizes.sm} color={colors.primary} />
              <Text style={styles.stripeButtonText}>Dashboard</Text>
            </PressableRow>
          ) : (
            <PressableRow style={[styles.stripeButton, styles.stripeButtonPrimary]} onPress={handleConnectStripe} disabled={isConnecting} >
              {isConnecting ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="link-2" size={iconSizes.sm} color={colors.primaryForeground} />
                  <Text style={styles.stripeButtonTextPrimary}>
                    {needsSetup ? 'Complete Setup' : 'Connect Stripe'}
                  </Text>
                </>
              )}
            </PressableRow>
          )}
        </View>
      </View>
    );
  };

  const renderInvoiceRow = (invoice: Invoice) => {
    const client = clientMap.get(invoice.clientId);
    const isOverdue = invoice.dueDate && isBefore(new Date(invoice.dueDate), new Date()) && invoice.status !== 'paid';
    const daysOverdue = invoice.dueDate ? Math.abs(differenceInDays(new Date(), new Date(invoice.dueDate))) : 0;

    const statusColors: Record<string, string> = {
      draft: colors.warning,
      sent: colors.info,
      viewed: colors.info,
      partial: colors.warning,
      paid: colors.success,
      overdue: colors.destructive,
    };
    const status = isOverdue ? 'overdue' : invoice.status;
    const statusColor = statusColors[status] || colors.mutedForeground;

    return (
      <PressableRow key={invoice.id} style={styles.documentRow} onPress={() => router.push(`/more/invoice/${invoice.id}`)} >
        <View style={[styles.documentIcon, { backgroundColor: `${colors.primary}15` }]}>
          <Feather name="file-text" size={iconSizes.md} color={colors.primary} />
        </View>
        <View style={styles.documentInfo}>
          <View style={styles.documentTitleRow}>
            <Text style={styles.documentTitle} numberOfLines={1}>
              #{invoice.number || invoice.id.slice(0, 8)}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </View>
          </View>
          <Text style={styles.documentSubtitle} numberOfLines={1}>
            {client?.name || 'Unknown Client'}
          </Text>
        </View>
        <View style={styles.documentRight}>
          <Text style={styles.documentAmount}>{formatCurrency(invoice.total)}</Text>
          {invoice.dueDate && (
            <Text style={[styles.documentDue, isOverdue && { color: colors.destructive }]}>
              {isOverdue ? `${daysOverdue}d overdue` : `Due ${format(new Date(invoice.dueDate), 'dd MMM')}`}
            </Text>
          )}
        </View>
        {invoice.status !== 'paid' && invoice.status !== 'draft' && stripeStatus?.connected && stripeStatus?.chargesEnabled && (
          <PressableRow style={[styles.paymentLinkButton, creatingPaymentLink === invoice.id && { opacity: 0.5 }]} onPress={(e) => { e.stopPropagation?.(); handleCreatePaymentLink(invoice.id); }} disabled={creatingPaymentLink === invoice.id} >
            {creatingPaymentLink === invoice.id ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="link" size={iconSizes.sm} color={colors.primary} />
            )}
          </PressableRow>
        )}
        <Feather name="chevron-right" size={iconSizes.md} color={colors.mutedForeground} />
      </PressableRow>
    );
  };

  const renderQuoteRow = (quote: Quote) => {
    const client = clientMap.get(quote.clientId);
    const statusColors: Record<string, string> = {
      draft: colors.warning,
      sent: colors.info,
      viewed: colors.info,
      accepted: colors.success,
      declined: colors.destructive,
      expired: colors.mutedForeground,
    };
    const statusColor = statusColors[quote.status] || colors.mutedForeground;

    return (
      <PressableRow key={quote.id} style={styles.documentRow} onPress={() => router.push(`/more/quote/${quote.id}`)} >
        <View style={[styles.documentIcon, { backgroundColor: `${colors.scheduled}15` }]}>
          <Feather name="file" size={iconSizes.md} color={colors.scheduled} />
        </View>
        <View style={styles.documentInfo}>
          <View style={styles.documentTitleRow}>
            <Text style={styles.documentTitle} numberOfLines={1}>
              #{quote.number || quote.id.slice(0, 8)}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
              </Text>
            </View>
          </View>
          <Text style={styles.documentSubtitle} numberOfLines={1}>
            {client?.name || 'Unknown Client'}
          </Text>
        </View>
        <View style={styles.documentRight}>
          <Text style={styles.documentAmount}>{formatCurrency(quote.total)}</Text>
          {quote.validUntil && (
            <Text style={styles.documentDue}>
              Valid until {format(new Date(quote.validUntil), 'dd MMM')}
            </Text>
          )}
        </View>
        <Feather name="chevron-right" size={iconSizes.md} color={colors.mutedForeground} />
      </PressableRow>
    );
  };

  const renderTab = (tab: TabType, label: string, count?: number) => {
    const isActive = activeTab === tab;
    return (
      <PressableRow style={[styles.tab, isActive && styles.tabActive]} onPress={() => setActiveTab(tab)} >
        <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{label}</Text>
        {count !== undefined && count > 0 && (
          <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
            <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
              {count}
            </Text>
          </View>
        )}
      </PressableRow>
    );
  };

  const renderOverview = () => (
    <View style={styles.overviewContainer}>
      <View style={styles.sectionHeader}>
        <Feather name="alert-triangle" size={iconSizes.md} color={colors.destructive} />
        <Text style={styles.sectionTitle}>Needs Attention</Text>
      </View>
      <View style={styles.sectionContent}>
        {invoices
          .filter(inv => inv.status !== 'paid' && inv.status !== 'draft')
          .slice(0, 5)
          .map(renderInvoiceRow)}
        {invoices.filter(inv => inv.status !== 'paid' && inv.status !== 'draft').length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="check-circle" size={32} color={colors.success} />
            <Text style={styles.emptyText}>All caught up!</Text>
            <Text style={styles.emptySubtext}>No outstanding invoices</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Feather name="file" size={iconSizes.md} color={colors.scheduled} />
        <Text style={styles.sectionTitle}>Pending Quotes</Text>
      </View>
      <View style={styles.sectionContent}>
        {quotes
          .filter(q => q.status === 'sent' || q.status === 'viewed')
          .slice(0, 5)
          .map(renderQuoteRow)}
        {quotes.filter(q => q.status === 'sent' || q.status === 'viewed').length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="file-text" size={32} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No pending quotes</Text>
          </View>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Feather name="trending-up" size={iconSizes.md} color={colors.success} />
        <Text style={styles.sectionTitle}>Recent Payments</Text>
      </View>
      <View style={styles.sectionContent}>
        {invoices
          .filter(inv => inv.status === 'paid')
          .sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime())
          .slice(0, 5)
          .map(renderInvoiceRow)}
        {invoices.filter(inv => inv.status === 'paid').length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="dollar-sign" size={32} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No payments yet</Text>
          </View>
        )}
      </View>
    </View>
  );

  const filteredInvoices = useMemo(() => {
    let filtered = [...invoices];
    const now = new Date();
    
    if (invoiceFilter === 'outstanding') {
      filtered = filtered.filter(inv => inv.status !== 'paid' && inv.status !== 'draft');
    } else if (invoiceFilter === 'overdue') {
      filtered = filtered.filter(inv => 
        inv.dueDate && 
        isBefore(new Date(inv.dueDate), now) && 
        inv.status !== 'paid'
      );
    } else if (invoiceFilter === 'paid') {
      filtered = filtered.filter(inv => inv.status === 'paid');
    } else if (invoiceFilter === 'draft') {
      filtered = filtered.filter(inv => inv.status === 'draft');
    }

    return filtered.sort((a, b) => {
      if (a.status === 'draft' && b.status !== 'draft') return -1;
      if (a.status !== 'draft' && b.status === 'draft') return 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [invoices, invoiceFilter]);

  const filteredPayouts = useMemo(() => {
    const now = new Date();
    return stripePayouts.filter(payout => {
      const createdDate = new Date(payout.created);
      if (timeRange === '7d') return isAfter(createdDate, subDays(now, 7));
      if (timeRange === '30d') return isAfter(createdDate, subDays(now, 30));
      if (timeRange === '90d') return isAfter(createdDate, subDays(now, 90));
      return true;
    });
  }, [stripePayouts, timeRange]);

  const filteredPaidInvoices = useMemo(() => {
    const now = new Date();
    return invoices
      .filter(inv => inv.status === 'paid')
      .filter(inv => {
        if (!inv.paidAt) return true;
        const paidDate = new Date(inv.paidAt);
        if (timeRange === '7d') return isAfter(paidDate, subDays(now, 7));
        if (timeRange === '30d') return isAfter(paidDate, subDays(now, 30));
        if (timeRange === '90d') return isAfter(paidDate, subDays(now, 90));
        return true;
      })
      .sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime());
  }, [invoices, timeRange]);

  const renderFilterChip = (
    label: string, 
    value: string, 
    currentValue: string, 
    onPress: (value: string) => void
  ) => {
    const isActive = currentValue === value;
    return (
      <PressableRow key={value} style={[styles.filterChip, isActive && styles.filterChipActive]} onPress={() => onPress(value)} >
        <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
          {label}
        </Text>
      </PressableRow>
    );
  };

  const renderPayoutRow = (payout: StripePayout) => {
    const statusColors: Record<string, string> = {
      paid: colors.success,
      pending: colors.warning,
      in_transit: colors.scheduled,
      canceled: colors.destructive,
      failed: colors.destructive,
    };
    const statusLabels: Record<string, string> = {
      paid: 'Completed',
      pending: 'Pending',
      in_transit: 'In Transit',
      canceled: 'Cancelled',
      failed: 'Failed',
    };
    const statusColor = statusColors[payout.status] || colors.mutedForeground;
    const statusLabel = statusLabels[payout.status] || payout.status;

    const formatPayoutDate = (dateStr: string | null) => {
      if (!dateStr) return 'Unknown date';
      try {
        return format(new Date(dateStr), 'dd MMM yyyy');
      } catch {
        return 'Unknown date';
      }
    };

    return (
      <View key={payout.id} style={styles.payoutRow}>
        <View style={[styles.payoutIcon, { backgroundColor: `${colors.success}15` }]}>
          <Feather name="dollar-sign" size={iconSizes.md} color={colors.success} />
        </View>
        <View style={styles.payoutInfo}>
          <View style={styles.documentTitleRow}>
            <Text style={styles.documentTitle}>Bank Transfer</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
          </View>
          <Text style={styles.documentSubtitle}>
            {payout.destination ? `To account ${payout.destination}` : `Payout ${payout.id.slice(-8)}`}
          </Text>
        </View>
        <View style={styles.documentRight}>
          <Text style={styles.payoutAmount}>
            +${payout.amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={styles.documentDue}>
            {payout.status === 'paid' 
              ? `Arrived ${formatPayoutDate(payout.arrivalDate)}`
              : `Expected ${formatPayoutDate(payout.arrivalDate)}`
            }
          </Text>
        </View>
      </View>
    );
  };

  const renderInvoices = () => (
    <View style={styles.listContainer}>
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {renderFilterChip('All', 'all', invoiceFilter, (v) => setInvoiceFilter(v as InvoiceFilterType))}
          {renderFilterChip('Outstanding', 'outstanding', invoiceFilter, (v) => setInvoiceFilter(v as InvoiceFilterType))}
          {renderFilterChip('Overdue', 'overdue', invoiceFilter, (v) => setInvoiceFilter(v as InvoiceFilterType))}
          {renderFilterChip('Paid', 'paid', invoiceFilter, (v) => setInvoiceFilter(v as InvoiceFilterType))}
          {renderFilterChip('Drafts', 'draft', invoiceFilter, (v) => setInvoiceFilter(v as InvoiceFilterType))}
        </ScrollView>
      </View>
      <View style={styles.sectionContent}>
        {filteredInvoices.map(renderInvoiceRow)}
        {filteredInvoices.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="file-text" size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No invoices found</Text>
            {invoiceFilter === 'all' && (
              <PressableRow style={styles.createButton} onPress={() => router.push('/more/invoice/new')} >
                <Text style={styles.createButtonText}>Create Invoice</Text>
              </PressableRow>
            )}
          </View>
        )}
      </View>
    </View>
  );

  const renderQuotes = () => (
    <View style={styles.listContainer}>
      {quotes
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .map(renderQuoteRow)}
      {quotes.length === 0 && (
        <View style={styles.emptyState}>
          <Feather name="file" size={48} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No quotes yet</Text>
          <PressableRow style={styles.createButton} onPress={() => router.push('/more/quote/new')} >
            <Text style={styles.createButtonText}>Create Quote</Text>
          </PressableRow>
        </View>
      )}
    </View>
  );

  const filteredChaserItems = useMemo(() => {
    const items = chaserData?.items || [];
    if (chaserFilter === 'all') return items;
    return items.filter(item => item.urgency === chaserFilter);
  }, [chaserData, chaserFilter]);

  const urgencyConfig: Record<string, { label: string; color: string; bg: string }> = {
    critical: { label: 'Critical', color: colors.destructive, bg: `${colors.destructive}20` },
    final: { label: 'Final Notice', color: '#ea580c', bg: '#ea580c20' },
    firm: { label: 'Firm', color: colors.warning, bg: `${colors.warning}20` },
    friendly: { label: 'Friendly', color: colors.info, bg: `${colors.info}20` },
    upcoming: { label: 'Upcoming', color: colors.mutedForeground, bg: `${colors.mutedForeground}20` },
  };

  const renderSmartChaser = () => {
    const summary = chaserData?.summary;

    if (chaserLoading) {
      return (
        <View style={{ gap: spacing.md }}>
          <View style={styles.kpiGrid}>
            {[1, 2, 3, 4].map(i => (
              <View key={i} style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={{ width: 80, height: 12, backgroundColor: colors.muted, borderRadius: radius.sm, marginBottom: spacing.xs }} />
                <View style={{ width: 60, height: 20, backgroundColor: colors.muted, borderRadius: radius.sm }} />
              </View>
            ))}
          </View>
          {[1, 2, 3].map(i => (
            <View key={i} style={{ height: 80, backgroundColor: colors.muted, borderRadius: radius.lg }} />
          ))}
        </View>
      );
    }

    return (
      <View style={{ gap: spacing.md }}>
        <View style={styles.kpiGrid}>
          {renderKPICard(
            'Total Overdue',
            formatCurrency(summary?.totalOverdueAmount || 0),
            `${summary?.totalOverdueCount || 0} invoices`,
            'alert-triangle',
            colors.destructive,
            (summary?.totalOverdueCount || 0) > 0 ? 'danger' : 'default'
          )}
          {renderKPICard(
            'Clients to Chase',
            String(summary?.clientsToChase || 0),
            'need follow-up',
            'users',
            '#ea580c',
            (summary?.clientsToChase || 0) > 0 ? 'warning' : 'default'
          )}
          {renderKPICard(
            'Avg Days Overdue',
            `${summary?.avgDaysOverdue || 0}d`,
            'across overdue invoices',
            'clock',
            colors.warning,
            (summary?.avgDaysOverdue || 0) > 14 ? 'warning' : 'default'
          )}
          {renderKPICard(
            'Collection Rate',
            `${summary?.collectionRate || 0}%`,
            'of sent invoices paid',
            'target',
            colors.success,
            'success'
          )}
        </View>

        <View style={[styles.sectionContent, { padding: spacing.md }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
              <Feather name="zap" size={iconSizes.md} color={colors.primary} />
              <View>
                <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>AI Payment Advisor</Text>
                <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>Smart recommendations for overdue invoices</Text>
              </View>
            </View>
            <PressableRow style={[styles.stripeButton, styles.stripeButtonPrimary, { opacity: aiLoading || (summary?.totalOverdueCount || 0) === 0 ? 0.5 : 1 }]} onPress={handleGetAiInsights} disabled={aiLoading || (summary?.totalOverdueCount || 0) === 0} >
              {aiLoading ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Feather name="zap" size={iconSizes.sm} color={colors.primaryForeground} />
              )}
              <Text style={styles.stripeButtonTextPrimary}>
                {aiLoading ? 'Analysing...' : 'Get AI Advice'}
              </Text>
            </PressableRow>
          </View>
          {aiInsights && (
            <View style={{ marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: `${colors.primary}08`, borderWidth: 1, borderColor: `${colors.primary}15` }}>
              <Text style={{ fontSize: typography.sizes.sm, color: colors.foreground, lineHeight: 20 }}>{aiInsights}</Text>
            </View>
          )}
        </View>

        <View style={styles.sectionContent}>
          <View style={{ padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Feather name="zap" size={iconSizes.sm} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Chase Queue</Text>
                </View>
                <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: 2 }}>
                  {(chaserData?.items || []).length} invoice{(chaserData?.items || []).length !== 1 ? 's' : ''} needing attention
                </Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {renderFilterChip('All', 'all', chaserFilter, setChaserFilter)}
              {renderFilterChip('Critical', 'critical', chaserFilter, setChaserFilter)}
              {renderFilterChip('Final Notice', 'final', chaserFilter, setChaserFilter)}
              {renderFilterChip('Firm', 'firm', chaserFilter, setChaserFilter)}
              {renderFilterChip('Friendly', 'friendly', chaserFilter, setChaserFilter)}
              {renderFilterChip('Upcoming', 'upcoming', chaserFilter, setChaserFilter)}
            </ScrollView>
          </View>

          {filteredChaserItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="check-circle" size={32} color={colors.success} />
              <Text style={styles.emptyText}>All caught up!</Text>
              <Text style={styles.emptySubtext}>No invoices need chasing right now</Text>
            </View>
          ) : (
            filteredChaserItems.map((item) => {
              const uCfg = urgencyConfig[item.urgency] || urgencyConfig.upcoming;
              const isExpanded = toneSelector === item.invoiceId;
              const isSending = sendingReminder === item.invoiceId;

              return (
                <View key={item.invoiceId} style={[styles.documentRow, { flexDirection: 'column', alignItems: 'stretch' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap', marginBottom: spacing.xs }}>
                        <Text style={[styles.documentTitle, { flexShrink: 1 }]} numberOfLines={1}>{item.clientName}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: uCfg.bg }]}>
                          <Text style={[styles.statusText, { color: uCfg.color }]}>{uCfg.label}</Text>
                        </View>
                        {item.remindersSent > 0 && (
                          <View style={[styles.statusBadge, { backgroundColor: colors.muted }]}>
                            <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
                              {item.remindersSent} sent
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                        <Text style={styles.documentSubtitle}>#{item.invoiceNumber}</Text>
                        {item.isOverdue && (
                          <Text style={[styles.documentSubtitle, { color: uCfg.color }]}>
                            {item.daysOverdue}d overdue
                          </Text>
                        )}
                        {!item.isOverdue && item.dueDate && (
                          <Text style={styles.documentSubtitle}>
                            Due {format(new Date(item.dueDate), 'dd MMM')}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.documentAmount, { fontSize: typography.subtitle.fontSize }]}>{formatCurrency(item.outstanding)}</Text>
                      {item.amountPaid > 0 && (
                        <Text style={styles.documentSubtitle}>{formatCurrency(item.amountPaid)} paid</Text>
                      )}
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, flexWrap: 'wrap' }}>
                    {isExpanded ? (
                      <>
                        <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginRight: spacing.xs }}>Tone:</Text>
                        {(['friendly', 'professional', 'firm'] as const).map(tone => (
                          <PressableRow key={tone} style={[ styles.chaserActionBtn, tone === item.recommendedTone ? { backgroundColor: colors.primary, borderColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border }, ]} onPress={() => handlePreviewReminder(item.invoiceId, tone, item.clientName, item.invoiceNumber, item.outstanding)} disabled={isSending} >
                            {isSending ? (
                              <ActivityIndicator size="small" color={tone === item.recommendedTone ? colors.primaryForeground : colors.primary} />
                            ) : (
                              <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.medium, color: tone === item.recommendedTone ? colors.primaryForeground : colors.foreground }}>
                                {tone.charAt(0).toUpperCase() + tone.slice(1)}
                              </Text>
                            )}
                          </PressableRow>
                        ))}
                        <PressableRow style={[styles.chaserActionBtn, { backgroundColor: colors.muted, borderColor: colors.muted }]} onPress={() => setToneSelector(null)} >
                          <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground }}>Cancel</Text>
                        </PressableRow>
                      </>
                    ) : (
                      <>
                        <PressableRow style={[styles.chaserActionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setToneSelector(item.invoiceId)} >
                          <Feather name="send" size={12} color={colors.primaryForeground} />
                          <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.medium, color: colors.primaryForeground }}>Chase</Text>
                        </PressableRow>
                        <PressableRow style={[styles.chaserActionBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push(`/more/invoice/${item.invoiceId}`)} >
                          <Feather name="eye" size={12} color={colors.foreground} />
                        </PressableRow>
                        {item.clientPhone && (
                          <PressableRow style={[styles.chaserActionBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => Linking.openURL(`tel:${item.clientPhone}`)} >
                            <Feather name="phone" size={12} color={colors.foreground} />
                          </PressableRow>
                        )}
                      </>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </View>
    );
  };

  const renderPayments = () => (
    <View style={styles.listContainer}>
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {renderFilterChip('7d', '7d', timeRange, (v) => setTimeRange(v as TimeRangeType))}
          {renderFilterChip('30d', '30d', timeRange, (v) => setTimeRange(v as TimeRangeType))}
          {renderFilterChip('90d', '90d', timeRange, (v) => setTimeRange(v as TimeRangeType))}
          {renderFilterChip('All', 'all', timeRange, (v) => setTimeRange(v as TimeRangeType))}
        </ScrollView>
      </View>

      {stripeStatus?.connected && stripeStatus?.chargesEnabled && (
        <View style={styles.payoutsSection}>
          <View style={styles.sectionHeader}>
            <Feather name="dollar-sign" size={iconSizes.md} color={colors.success} />
            <Text style={styles.sectionTitle}>Bank Payouts</Text>
          </View>
          <View style={styles.sectionContent}>
            {filteredPayouts.length > 0 ? (
              filteredPayouts.map(renderPayoutRow)
            ) : (
              <View style={styles.emptyState}>
                <Feather name="inbox" size={32} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>No payouts in this period</Text>
              </View>
            )}
          </View>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Feather name="check-circle" size={iconSizes.md} color={colors.success} />
        <Text style={styles.sectionTitle}>Paid Invoices</Text>
      </View>
      <View style={styles.sectionContent}>
        {filteredPaidInvoices.map(renderInvoiceRow)}
        {filteredPaidInvoices.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="credit-card" size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No payments in this period</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (accessRestricted) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <PressableRow style={styles.backButton} onPress={() => router.back()} >
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </PressableRow>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Payment Hub</Text>
            <Text style={styles.headerSubtitle}>Track invoices, payments & quotes</Text>
          </View>
        </View>
        <View style={styles.restrictedContainer}>
          <View style={styles.restrictedIcon}>
            <Feather name="lock" size={28} color={colors.mutedForeground} />
          </View>
          <Text style={styles.restrictedTitle}>Payments not available</Text>
          <Text style={styles.restrictedText}>
            Your role in this business doesn{'\u2019'}t include access to invoices and
            payments. Switch to your own workspace, or ask the business owner for
            access.
          </Text>
          <PressableRow style={styles.restrictedButton} onPress={() => router.back()}>
            <Feather name="arrow-left" size={16} color={colors.primaryForeground} />
            <Text style={styles.restrictedButtonText}>Go back</Text>
          </PressableRow>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <PressableRow style={styles.backButton} onPress={() => router.back()} >
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </PressableRow>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Payment Hub</Text>
          <Text style={styles.headerSubtitle}>Track invoices, payments & quotes</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderStripeConnectCard()}
        
        {activeTab !== 'chaser' && (
          <View style={styles.kpiGrid}>
            {renderKPICard(
              'Outstanding',
              formatCurrency(stats.outstandingTotal),
              `${stats.outstandingCount} invoices`,
              'clock',
              colors.warning,
              stats.outstandingCount > 0 ? 'warning' : 'default'
            )}
            {renderKPICard(
              'Overdue',
              formatCurrency(stats.overdueTotal),
              `${stats.overdueCount} invoices`,
              'alert-triangle',
              colors.destructive,
              stats.overdueCount > 0 ? 'danger' : 'default'
            )}
            {renderKPICard(
              'Paid (30d)',
              formatCurrency(stats.recentPaidTotal),
              `${stats.recentPaidCount} invoices`,
              'check-circle',
              colors.success,
              'success'
            )}
            {renderKPICard(
              'Pending Quotes',
              formatCurrency(stats.pendingQuotesTotal),
              `${stats.pendingQuotesCount} awaiting`,
              'file',
              colors.scheduled,
              'default'
            )}
          </View>
        )}

        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {renderTab('overview', 'Overview')}
            {renderTab('invoices', 'Invoices', stats.outstandingCount)}
            {renderTab('quotes', 'Quotes', stats.pendingQuotesCount)}
            {renderTab('chaser', 'Smart Chaser', chaserData?.summary?.totalOverdueCount)}
            {renderTab('payments', 'Payments')}
          </ScrollView>
        </View>

        <View style={styles.tabContent}>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'invoices' && renderInvoices()}
          {activeTab === 'quotes' && renderQuotes()}
          {activeTab === 'chaser' && renderSmartChaser()}
          {activeTab === 'payments' && renderPayments()}
        </View>
      </ScrollView>

      <AppBottomSheet
        visible={previewModal.visible}
        onDismiss={() => setPreviewModal(prev => ({ ...prev, visible: false }))}
        title="Preview Reminder"
        showCloseButton
        snapPoints={['80%']}
      >
        <View>
          <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, marginTop: -spacing.sm, marginBottom: spacing.md }}>
            {previewModal.tone.charAt(0).toUpperCase() + previewModal.tone.slice(1)} tone to {previewModal.clientName}
          </Text>

          <View style={{ backgroundColor: colors.background, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <Feather name="mail" size={16} color={colors.primary} />
              <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground }}>Email to {previewModal.clientName}</Text>
            </View>
            <View style={{ backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: colors.mutedForeground, marginBottom: spacing.xs }}>Subject: Payment Reminder — Invoice {previewModal.invoiceNumber}</Text>
              <View style={{ height: 1, backgroundColor: colors.border, marginBottom: spacing.sm }} />
              <Text style={{ fontSize: typography.button.fontSize, color: colors.foreground, lineHeight: 22 }}>{previewModal.preview}</Text>
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <PressableRow style={{ backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: radius.lg, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, opacity: previewModal.loading ? 0.6 : 1 }} onPress={handleConfirmSendReminder} disabled={previewModal.loading} >
              {previewModal.loading ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="send" size={16} color={colors.primaryForeground} />
                  <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold, color: colors.primaryForeground }}>Send Reminder</Text>
                </>
              )}
            </PressableRow>
            <PressableRow style={{ paddingVertical: spacing.sm, alignItems: 'center' }} onPress={() => setPreviewModal(prev => ({ ...prev, visible: false }))} >
              <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground }}>Cancel</Text>
            </PressableRow>
          </View>
        </View>
      </AppBottomSheet>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.mutedForeground,
    fontSize: typography.button.fontSize,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: spacing.md,
    padding: spacing.xs,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
  },
  restrictedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
  },
  restrictedIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  restrictedTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  restrictedText: {
    fontSize: typography.button.fontSize,
    lineHeight: 21,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  restrictedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  restrictedButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  kpiCard: {
    width: '48%',
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    ...shadows.sm,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  kpiTitle: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  kpiIcon: {
    padding: spacing.xs,
    borderRadius: radius.md,
  },
  kpiValue: {
    fontSize: typography.sizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    marginBottom: 2,
  },
  kpiSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
  },
  tabsContainer: {
    marginBottom: spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.primaryForeground,
  },
  tabBadge: {
    marginLeft: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.mutedForeground,
  },
  tabBadgeActive: {
    backgroundColor: colors.primaryForeground,
  },
  tabBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.background,
  },
  tabBadgeTextActive: {
    color: colors.primary,
  },
  tabContent: {
    minHeight: 200,
  },
  overviewContainer: {
    gap: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  sectionContent: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadows.sm,
  },
  listContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadows.sm,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  documentIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
    minWidth: 0,
  },
  documentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  documentTitle: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  statusBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    textTransform: 'capitalize',
  },
  documentSubtitle: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
  },
  documentRight: {
    alignItems: 'flex-end',
  },
  documentAmount: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  documentDue: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
  },
  emptyState: {
    padding: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  createButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
  },
  createButtonText: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  stripeCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  stripeCardConnected: {
    borderColor: `${colors.success}40`,
  },
  stripeCardWarning: {
    borderColor: `${colors.warning}40`,
  },
  stripeCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  stripeIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripeLoadingIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
  },
  stripeCardContent: {
    flex: 1,
  },
  stripeCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  stripeCardTitle: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  stripeCardBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  stripeCardBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
  },
  stripeCardDescription: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  balanceItem: {
    gap: 2,
  },
  balanceLabel: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
  },
  balanceValue: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.bold,
  },
  balanceValueMuted: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
  },
  stripeCardActions: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  stripeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  stripeButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stripeButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.primary,
  },
  stripeButtonTextPrimary: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.primaryForeground,
  },
  paymentLinkButton: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}15`,
  },
  filterRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  filterChipTextActive: {
    color: colors.primaryForeground,
  },
  payoutsSection: {
    marginBottom: spacing.lg,
  },
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  payoutIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payoutInfo: {
    flex: 1,
    minWidth: 0,
  },
  payoutAmount: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.success,
  },
  chaserActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});

export default function PaymentHubScreen() {
  return (
    <OwnerOnlyGuard>
      <PaymentHubScreenInner />
    </OwnerOnlyGuard>
  );
}
