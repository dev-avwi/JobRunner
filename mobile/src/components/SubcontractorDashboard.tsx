import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '@/components/ui/PressableRow';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_URL } from '../lib/api';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore, useTimeTrackingStore } from '../lib/store';
import { api } from '../lib/api';
import { formatCurrency as formatCurrencyUtil } from '../lib/format';
import { useTheme, ThemeColors, colorWithOpacity } from '../lib/theme';
import { AppBottomSheet } from './ui/AppBottomSheet';
import { OnboardingSetupFailedBanner } from './ui/OnboardingSetupFailedBanner';
import { spacing, radius, shadows, typography, pageShell, usePageShell } from '../lib/design-tokens';
import { useScrollToTop } from '../contexts/ScrollContext';
import { useUserRole } from '../hooks/use-user-role';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

interface SubcontractorJob {
  id: string;
  title: string;
  description?: string;
  address?: string;
  status: string;
  scheduledAt?: string;
  scheduledTime?: string;
  estimatedDuration?: number;
  latitude?: string;
  longitude?: string;
  clientName?: string;
  businessName: string;
  businessColor: string;
  businessOwnerId: string;
  assignmentStatus: string;
  completedAt?: string;
  startedAt?: string;
}

interface DashboardData {
  availabilityStatus: string;
  todaysJobs: SubcontractorJob[];
  weekJobs: SubcontractorJob[];
  pendingRequests: SubcontractorJob[];
  activeJob: SubcontractorJob | null;
  earningsWeek: number;
  earningsMonth: number;
  hoursMonth: number;
  jobsCompletedMonth: number;
  earningsByBusiness: { businessName: string; amount: number; hours: number }[];
  earningsTrend: { period: string; earnings: number; hours: number }[];
  businesses: { id: string; name: string; color: string }[];
}

type ViewMode = 'today' | 'week';
type AvailabilityStatus = 'available' | 'busy' | 'unavailable';

const AVAILABILITY_CONFIG: Record<AvailabilityStatus, { label: string; icon: keyof typeof Feather.glyphMap; colorKey: string }> = {
  available: { label: 'Available', icon: 'check-circle', colorKey: 'success' },
  busy: { label: 'Busy', icon: 'clock', colorKey: 'warning' },
  unavailable: { label: 'Unavailable', icon: 'x-circle', colorKey: 'muted' },
};

export function SubcontractorDashboard() {
  const { colors } = useTheme();
  const responsiveShell = usePageShell();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView | null>(null);
  const { scrollToTopTrigger } = useScrollToTop();

  const { user, setDashboardReady } = useAuthStore();
  const activeTimer = useTimeTrackingStore((s) => s.activeTimer);
  const fetchActiveTimer = useTimeTrackingStore((s) => s.fetchActiveTimer);
  const { isSubcontractor, isStandaloneSubcontractor } = useUserRole();
  // Latched invoicing visibility. The role cache is deleted on every app
  // foreground (useUserRole revalidates on AppState 'active'), so during the
  // brief refetch window the derived role falls back to owner/loading and
  // isStandaloneSubcontractor momentarily reads false — which would flash the
  // invoicing section in and then hide it again. We only update the decision
  // once the role has DEFINITIVELY resolved to subcontractor, ignoring the
  // transient states, so the section no longer flickers on resume.
  const [showInvoicing, setShowInvoicing] = useState(false);
  useEffect(() => {
    if (isSubcontractor) {
      setShowInvoicing(!isStandaloneSubcontractor);
    }
  }, [isSubcontractor, isStandaloneSubcontractor]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);
  const [decliningJobId, setDecliningJobId] = useState<string | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [declineJobId, setDeclineJobId] = useState<string | null>(null);
  const [showEarningsBreakdown, setShowEarningsBreakdown] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  interface UnbilledWorkItem {
    jobId: string;
    jobTitle: string;
    jobStatus: string;
    businessOwnerId: string;
    businessName: string;
    completedAt: string | null;
    totalHours: number;
    hourlyRate: number;
    materialsCost: number;
    totalAmount: number;
    timeEntries: { id: string; startTime: string; endTime: string; hours: number; rate: number; amount: number }[];
  }
  interface SubInvoiceSummary {
    id: string;
    invoiceNumber: string;
    status: string;
    subtotalAmount: string;
    gstAmount: string;
    totalAmount: string;
    dueDate: string | null;
    createdAt: string | null;
    subcontractorName: string;
    businessName: string;
  }
  interface SubInvoiceItem {
    id: string;
    description: string;
    hours: string | null;
    rate: string | null;
    quantity: string | null;
    unitPrice: string | null;
    amount: string;
  }
  interface SubInvoiceDetail extends SubInvoiceSummary {
    items: SubInvoiceItem[];
    notes?: string | null;
    rejectionReason?: string | null;
    businessAbn?: string | null;
  }
  const [showInvoiceCreate, setShowInvoiceCreate] = useState(false);
  const [unbilledWork, setUnbilledWork] = useState<UnbilledWorkItem[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<Record<string, boolean>>({});
  const [lineItemEdits, setLineItemEdits] = useState<Record<string, { description: string; expanded: boolean; includeTimeEntryIds: string[] }>>({});
  const [isLoadingUnbilled, setIsLoadingUnbilled] = useState(false);
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [invoices, setInvoices] = useState<SubInvoiceSummary[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<SubInvoiceDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    if (scrollToTopTrigger > 0) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [scrollToTopTrigger]);

  // Signal dashboard ready once initial load settles, so deferred UI
  // (e.g. the "What you missed" popup) waits for content to appear.
  useEffect(() => {
    if (!isLoading) {
      setDashboardReady(true);
    }
  }, [isLoading, setDashboardReady]);

  const fetchDashboard = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    setFetchError(false);
    try {
      const response = await api.get<DashboardData>('/api/subcontractor/dashboard');
      if (response.data) {
        // Normalise every array field so render code can call .map/.length
        // safely even if the server returns a partial payload.
        const raw = response.data as any;
        const normalized: DashboardData = {
          ...raw,
          todaysJobs:        Array.isArray(raw.todaysJobs)        ? raw.todaysJobs        : [],
          weekJobs:          Array.isArray(raw.weekJobs)          ? raw.weekJobs          : [],
          pendingRequests:   Array.isArray(raw.pendingRequests)   ? raw.pendingRequests   : [],
          earningsByBusiness:Array.isArray(raw.earningsByBusiness)? raw.earningsByBusiness: [],
          earningsTrend:     Array.isArray(raw.earningsTrend)     ? raw.earningsTrend     : [],
          businesses:        Array.isArray(raw.businesses)        ? raw.businesses        : [],
        };
        setData(normalized);
      } else if (response.error) {
        setFetchError(true);
      }
    } catch (error) {
      if (__DEV__) console.log('Error fetching subcontractor dashboard:', error);
      setFetchError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Keep the active timer (and its break state) authoritative so the active-job
  // card can reflect On Break in orange. The store is otherwise only synced by
  // the owner Time Tracking widget, which doesn't mount on this route.
  useFocusEffect(
    useCallback(() => {
      fetchActiveTimer();
      // Track which workspace is currently active so the active-job card can lock
      // when the running job belongs to a business the user isn't currently in
      // (e.g. viewing from their Personal profile). Refetched on focus because
      // switching workspaces changes this.
      api.getMyBusinesses()
        .then((res) => {
          if (res.data) setActiveBusinessId(res.data.activeBusinessId);
        })
        .catch(() => {});
    }, [fetchActiveTimer])
  );

  // Timer for active job
  useEffect(() => {
    const startMs = data?.activeJob?.startedAt ? new Date(data.activeJob.startedAt).getTime() : NaN;
    if (data?.activeJob?.startedAt && !isNaN(startMs)) {
      const updateTimer = () => {
        const start = startMs;
        const now = Date.now();
        const diff = Math.max(0, now - start);
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setElapsedTime(
          `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        );
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [data?.activeJob?.startedAt]);

  const toggleAvailability = useCallback(async (newStatus: AvailabilityStatus) => {
    if (isUpdatingAvailability || !data) return;
    setIsUpdatingAvailability(true);
    try {
      await api.patch('/api/subcontractor/availability-status', { status: newStatus });
      setData(prev => prev ? { ...prev, availabilityStatus: newStatus } : prev);
    } catch (error) {
      Alert.alert('Error', 'Failed to update availability status');
    } finally {
      setIsUpdatingAvailability(false);
    }
  }, [isUpdatingAvailability, data]);

  const acceptJob = useCallback(async (jobId: string) => {
    setAcceptingJobId(jobId);
    try {
      const response = await api.post(`/api/subcontractor/jobs/${jobId}/accept`);
      if (response.error) {
        Alert.alert('Error', response.error || 'Failed to accept job');
      } else {
        fetchDashboard();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to accept job');
    } finally {
      setAcceptingJobId(null);
    }
  }, [fetchDashboard]);

  const startDeclineJob = useCallback((jobId: string) => {
    setDeclineJobId(jobId);
    setDeclineReason('');
    setShowDeclineModal(true);
  }, []);

  const confirmDeclineJob = useCallback(async () => {
    if (!declineJobId) return;
    setDecliningJobId(declineJobId);
    setShowDeclineModal(false);
    try {
      const response = await api.post(`/api/subcontractor/jobs/${declineJobId}/decline`, {
        reason: declineReason || undefined,
      });
      if (response.error) {
        Alert.alert('Error', response.error || 'Failed to decline job');
      } else {
        fetchDashboard();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to decline job');
    } finally {
      setDecliningJobId(null);
      setDeclineJobId(null);
      setDeclineReason('');
    }
  }, [declineJobId, declineReason, fetchDashboard]);

  const openDirections = useCallback((address?: string, lat?: string, lon?: string) => {
    if (lat && lon) {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`);
    } else if (address) {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`);
    }
  }, []);

  const formatTime = useCallback((dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  }, []);

  const formatDate = useCallback((dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
  }, []);

  const getAvailabilityColor = useCallback((status: string): string => {
    switch (status) {
      case 'available': return colors.success;
      case 'busy': return colors.warning;
      case 'unavailable': return colors.mutedForeground;
      default: return colors.success;
    }
  }, [colors]);

  const toggleDay = useCallback((day: string) => {
    setExpandedDays(prev => ({ ...prev, [day]: !prev[day] }));
  }, []);

  const loadUnbilledWork = useCallback(async () => {
    setIsLoadingUnbilled(true);
    try {
      const response = await api.get<UnbilledWorkItem[]>('/api/subcontractor/unbilled-work');
      setUnbilledWork(response.data || []);
      const selected: Record<string, boolean> = {};
      const edits: Record<string, { description: string; expanded: boolean; includeTimeEntryIds: string[] }> = {};
      (response.data || []).forEach((item: UnbilledWorkItem) => {
        selected[item.jobId] = true;
        edits[item.jobId] = { description: item.jobTitle, expanded: false, includeTimeEntryIds: item.timeEntries.map(te => te.id) };
      });
      setSelectedJobs(selected);
      setLineItemEdits(edits);
    } catch (error) {
      Alert.alert('Error', 'Failed to load unbilled work');
    } finally {
      setIsLoadingUnbilled(false);
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    setIsLoadingInvoices(true);
    try {
      const response = await api.get<SubInvoiceSummary[]>('/api/subcontractor/invoices');
      setInvoices(response.data || []);
    } catch (error) {
      if (__DEV__) console.log('Error loading invoices:', error);
    } finally {
      setIsLoadingInvoices(false);
    }
  }, []);

  const openCreateInvoice = useCallback(() => {
    setShowInvoiceCreate(true);
    setInvoiceNotes('');
    loadUnbilledWork();
  }, [loadUnbilledWork]);

  const toggleJobSelection = useCallback((jobId: string) => {
    setSelectedJobs(prev => ({ ...prev, [jobId]: !prev[jobId] }));
  }, []);

  const submitInvoice = useCallback(async () => {
    const selectedItems = unbilledWork.filter(item => selectedJobs[item.jobId]);
    if (selectedItems.length === 0) {
      Alert.alert('No items selected', 'Please select at least one job to invoice.');
      return;
    }

    const businessOwnerId = selectedItems[0].businessOwnerId;
    const allSameBusiness = selectedItems.every(item => item.businessOwnerId === businessOwnerId);
    if (!allSameBusiness) {
      Alert.alert('Multiple businesses', 'Please select jobs from only one business per invoice.');
      return;
    }

    setIsSubmittingInvoice(true);
    try {
      const items = selectedItems.map(item => {
        const includedIds = lineItemEdits[item.jobId]?.includeTimeEntryIds || item.timeEntries.map(te => te.id);
        const includedEntries = item.timeEntries.filter(te => includedIds.includes(te.id));
        const hours = includedEntries.reduce((sum, te) => sum + te.hours, 0);
        return {
          jobId: item.jobId,
          description: lineItemEdits[item.jobId]?.description || item.jobTitle,
          hours: String(hours),
          rate: String(item.hourlyRate),
          amount: String(Math.round(hours * item.hourlyRate * 100) / 100),
          timeEntryIds: includedIds,
        };
      });

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      const response = await api.post('/api/subcontractor/invoices', {
        businessOwnerId,
        items,
        notes: invoiceNotes || undefined,
        dueDate: dueDate.toISOString(),
      });

      if (response.error) {
        Alert.alert('Could not submit invoice', response.error);
        return;
      }

      Alert.alert('Invoice Submitted', 'Your invoice has been sent to the business owner for review.');
      setShowInvoiceCreate(false);
      loadInvoices();
      fetchDashboard();
    } catch (error: unknown) {
      const errMsg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create invoice';
      Alert.alert('Error', errMsg);
    } finally {
      setIsSubmittingInvoice(false);
    }
  }, [unbilledWork, selectedJobs, lineItemEdits, invoiceNotes, loadInvoices, fetchDashboard]);

  const openInvoicesList = useCallback(() => {
    setShowInvoices(true);
    loadInvoices();
  }, [loadInvoices]);

  const handleDeleteInvoice = useCallback((inv: SubInvoiceSummary) => {
    Alert.alert(
      'Delete Invoice',
      `Delete invoice ${inv.invoiceNumber}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const response = await api.delete(`/api/subcontractor/invoices/${inv.id}`);
            if (response.error) {
              Alert.alert('Could not delete invoice', response.error);
              return;
            }
            loadInvoices();
            fetchDashboard();
          },
        },
      ],
    );
  }, [loadInvoices, fetchDashboard]);

  const detailRequestId = useRef(0);
  const openInvoiceDetail = useCallback(async (inv: SubInvoiceSummary) => {
    const requestId = ++detailRequestId.current;
    setIsLoadingDetail(true);
    setDetailInvoice({ ...inv, items: [] } as SubInvoiceDetail);
    try {
      const response = await api.get<SubInvoiceDetail>(`/api/subcontractor/invoices/${inv.id}`);
      if (requestId !== detailRequestId.current) return;
      if (response.error || !response.data) {
        Alert.alert('Could not open invoice', response.error || 'Please try again.');
        setDetailInvoice(null);
        return;
      }
      setDetailInvoice(response.data);
    } catch {
      if (requestId !== detailRequestId.current) return;
      Alert.alert('Could not open invoice', 'Please try again.');
      setDetailInvoice(null);
    } finally {
      if (requestId === detailRequestId.current) setIsLoadingDetail(false);
    }
  }, []);

  const closeInvoiceDetail = useCallback(() => {
    detailRequestId.current++;
    setIsLoadingDetail(false);
    setDetailInvoice(null);
  }, []);

  const downloadInvoicePdf = useCallback(async (inv: { id: string; invoiceNumber: string }) => {
    setIsDownloadingPdf(true);
    try {
      const token = await api.getToken();
      if (!token) {
        Alert.alert('Could not open PDF', 'Please sign in again.');
        return;
      }
      const fileUri = `${FileSystem.cacheDirectory}${inv.invoiceNumber || 'invoice'}_${Date.now()}.pdf`;
      const result = await FileSystem.createDownloadResumable(
        `${API_URL}/api/subcontractor/invoices/${inv.id}/pdf`,
        fileUri,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' } },
      ).downloadAsync();
      if (!result?.uri || result.status !== 200) {
        Alert.alert('Could not open PDF', 'Please try again.');
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
          dialogTitle: `Invoice ${inv.invoiceNumber}`,
        });
      } else {
        Alert.alert('Could not open PDF', 'Sharing is not available on this device.');
      }
    } catch {
      Alert.alert('Could not open PDF', 'Please try again.');
    } finally {
      setIsDownloadingPdf(false);
    }
  }, []);

  const getInvoiceStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'submitted': return colors.warning;
      case 'approved': return colors.info;
      case 'paid': return colors.success;
      case 'draft': return colors.mutedForeground;
      default: return colors.mutedForeground;
    }
  }, [colors]);

  const userName = user?.firstName || user?.email?.split('@')[0] || 'there';

  const displayJobs = viewMode === 'today' ? (data?.todaysJobs ?? []) : (data?.weekJobs ?? []);
  const currentAvailability = ((data?.availabilityStatus) || 'available') as AvailabilityStatus;

  const jobsByDay = useMemo(() => {
    if (viewMode !== 'week') return {};
    const grouped: Record<string, SubcontractorJob[]> = {};
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = 0; i < 7; i++) {
      const day = new Date(todayStart.getTime() + i * 24 * 60 * 60 * 1000);
      const dateKey = day.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
      grouped[dateKey] = [];
    }
    if (data) {
      for (const job of data.weekJobs) {
        if (job.scheduledAt) {
          const d = new Date(job.scheduledAt);
          const dateKey = d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
          if (grouped[dateKey]) {
            grouped[dateKey].push(job);
          }
        }
      }
    }
    return grouped;
  }, [viewMode, data]);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (fetchError && !data) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl }]}>
        <Feather name="wifi-off" size={40} color={colors.mutedForeground} style={{ marginBottom: spacing.lg }} />
        <Text style={{ fontSize: 17, fontWeight: '600', color: colors.foreground, textAlign: 'center', marginBottom: spacing.sm }}>
          Could not load dashboard
        </Text>
        <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: 'center', marginBottom: spacing.xl }}>
          Check your connection and try again.
        </Text>
        <TouchableOpacity
          onPress={() => fetchDashboard()}
          activeOpacity={0.7}
          style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}
        >
          <Text style={{ color: colors.primaryForeground, fontWeight: '600', fontSize: 15 }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={{
          paddingHorizontal: responsiveShell.paddingHorizontal,
          paddingTop: responsiveShell.paddingTop,
          paddingBottom: responsiveShell.paddingBottom + 40,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchDashboard(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={styles.headerTitle}>
                G'day, {userName}
              </Text>
              <View style={[styles.roleBadge, { backgroundColor: colorWithOpacity(colors.primary, 0.1) }]}>
                <Text style={[styles.roleBadgeText, { color: colors.primary }]}>
                  Subcontractor
                </Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>
              {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}
              {data.todaysJobs.length > 0
                ? ` \u00b7 ${data.todaysJobs.length} job${data.todaysJobs.length > 1 ? 's' : ''} today`
                : ''}
            </Text>
          </View>
        </View>

        {/* Background setup failure - retryable if the onboarding-complete call failed */}
        <OnboardingSetupFailedBanner />

        {/* Availability Toggle */}
        <View style={styles.availabilityCard}>
          <Text style={styles.availabilitySectionLabel}>Your Status</Text>
          <View style={styles.availabilityRow}>
            {(['available', 'busy', 'unavailable'] as AvailabilityStatus[]).map((status) => {
              const config = AVAILABILITY_CONFIG[status];
              const isActive = currentAvailability === status;
              const statusColor = getAvailabilityColor(status);
              return (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.availabilityButton,
                    {
                      backgroundColor: isActive ? colorWithOpacity(statusColor, 0.12) : colors.muted,
                      borderColor: isActive ? statusColor : colors.border,
                    },
                  ]}
                  onPress={() => toggleAvailability(status)}
                  activeOpacity={0.7}
                  disabled={isUpdatingAvailability}
                >
                  {isUpdatingAvailability && isActive ? (
                    <ActivityIndicator size="small" color={statusColor} />
                  ) : (
                    <Feather name={config.icon} size={16} color={isActive ? statusColor : colors.mutedForeground} />
                  )}
                  <Text style={[
                    styles.availabilityButtonText,
                    { color: isActive ? statusColor : colors.mutedForeground, fontWeight: isActive ? '700' : '500' },
                  ]}>
                    {config.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Active Job Card */}
        {data.activeJob && (() => {
          const activeJob = data.activeJob;
          const onBreak = activeTimer?.isBreak === true && activeTimer?.jobId === activeJob.id;
          // In Personal profile (or any other workspace), the running job still
          // shows so the user knows it's live — but it's "locked": they must
          // switch into that business's workspace to actually open/manage it.
          const currentWorkspaceOwnerId = activeBusinessId ?? user?.id ?? null;
          const lockedToOtherWorkspace =
            !!activeJob.businessOwnerId && currentWorkspaceOwnerId !== activeJob.businessOwnerId;
          return (
          <View style={[styles.activeJobCard, { borderColor: onBreak ? colors.warning : activeJob.businessColor }]}>
            <View style={styles.activeJobHeader}>
              {onBreak ? (
                <Feather name="coffee" size={13} color={colors.warning} />
              ) : (
                <View style={[styles.activeJobPulse, { backgroundColor: colors.success }]} />
              )}
              <Text style={[styles.activeJobLabel, onBreak && { color: colors.warning }]}>{onBreak ? 'On Break' : 'In Progress'}</Text>
              <Text style={[styles.activeJobTimer, onBreak && { color: colors.warning }]}>{elapsedTime}</Text>
            </View>
            <View style={styles.activeJobContent}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                <View style={[styles.businessDot, { backgroundColor: data.activeJob.businessColor }]} />
                <Text style={styles.activeJobBusiness}>{data.activeJob.businessName}</Text>
              </View>
              <Text style={styles.activeJobTitle}>{data.activeJob.title}</Text>
              {data.activeJob.address && (
                <TouchableOpacity
                  style={styles.activeJobAddressRow}
                  onPress={() => openDirections(data.activeJob!.address, data.activeJob!.latitude, data.activeJob!.longitude)}
                  activeOpacity={0.7}
                >
                  <Feather name="map-pin" size={14} color={colors.primary} />
                  <Text style={[styles.activeJobAddress, { color: colors.primary }]} numberOfLines={1}>
                    {data.activeJob.address}
                  </Text>
                  <Feather name="navigation" size={12} color={colors.primary} />
                </TouchableOpacity>
              )}
              {data.activeJob.clientName && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                  <Feather name="user" size={13} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 13, color: colors.mutedForeground }}>{data.activeJob.clientName}</Text>
                </View>
              )}
            </View>
            {lockedToOtherWorkspace ? (
              <View style={styles.activeJobLockedBanner}>
                <Feather name="lock" size={12} color={colors.warning} />
                <Text style={[styles.activeJobLocationText, { color: colors.warning }]}>
                  You're in a different workspace. Switch to {data.activeJob.businessName} to open this job.
                </Text>
              </View>
            ) : data.activeJob.businessOwnerId !== user?.id ? (
              <View style={styles.activeJobLocationBanner}>
                <Feather name="radio" size={12} color={colors.info} />
                <Text style={[styles.activeJobLocationText, { color: colors.info }]}>
                  Your location is visible to {data.activeJob.businessName}
                </Text>
              </View>
            ) : null}
            {lockedToOtherWorkspace ? (
              <TouchableOpacity
                style={[styles.completeButton, styles.switchButton]}
                onPress={() => setShowSwitcher(true)}
                activeOpacity={0.7}
              >
                <Feather name="repeat" size={18} color={colors.primary} />
                <Text style={[styles.completeButtonText, { color: colors.primary }]}>
                  Switch to {data.activeJob.businessName}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.completeButton, { backgroundColor: colors.success }]}
                onPress={() => router.push(`/job/${data.activeJob!.id}`)}
                activeOpacity={0.7}
              >
                <Feather name="check-circle" size={18} color={colors.white} />
                <Text style={styles.completeButtonText}>View / Complete Job</Text>
              </TouchableOpacity>
            )}
          </View>
          );
        })()}

        {/* Incoming Job Requests */}
        {data.pendingRequests.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: colorWithOpacity(colors.warning, 0.12) }]}>
                <Feather name="inbox" size={18} color={colors.warning} />
              </View>
              <Text style={styles.sectionTitle}>
                Incoming Requests ({data.pendingRequests.length})
              </Text>
            </View>
            {data.pendingRequests.map((job) => (
              <View key={job.id} style={styles.requestCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <View style={[styles.businessDot, { backgroundColor: job.businessColor }]} />
                  <Text style={styles.requestBusiness}>{job.businessName}</Text>
                </View>
                <Text style={styles.requestTitle}>{job.title}</Text>
                {job.address && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                    <Feather name="map-pin" size={13} color={colors.mutedForeground} />
                    <Text style={styles.requestMeta} numberOfLines={1}>{job.address}</Text>
                  </View>
                )}
                {job.scheduledAt && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                    <Feather name="calendar" size={13} color={colors.mutedForeground} />
                    <Text style={styles.requestMeta}>{formatDate(job.scheduledAt)} {formatTime(job.scheduledAt)}</Text>
                  </View>
                )}
                {job.description && (
                  <Text style={[styles.requestMeta, { marginTop: spacing.xs }]} numberOfLines={2}>
                    {job.description}
                  </Text>
                )}
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.requestButton, styles.declineButton]}
                    onPress={() => startDeclineJob(job.id)}
                    activeOpacity={0.7}
                    disabled={decliningJobId === job.id}
                  >
                    {decliningJobId === job.id ? (
                      <ActivityIndicator size="small" color={colors.destructive} />
                    ) : (
                      <>
                        <Feather name="x" size={16} color={colors.destructive} />
                        <Text style={[styles.requestButtonText, { color: colors.destructive }]}>Decline</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.requestButton, styles.acceptButton, { backgroundColor: colors.success }]}
                    onPress={() => acceptJob(job.id)}
                    activeOpacity={0.7}
                    disabled={acceptingJobId === job.id}
                  >
                    {acceptingJobId === job.id ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <>
                        <Feather name="check" size={16} color={colors.white} />
                        <Text style={[styles.requestButtonText, { color: colors.white }]}>Accept</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* View Toggle */}
        <View style={styles.viewToggleRow}>
          <TouchableOpacity
            style={[
              styles.viewToggleButton,
              viewMode === 'today' && { backgroundColor: colors.primary },
            ]}
            onPress={() => setViewMode('today')}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.viewToggleText,
              viewMode === 'today' && { color: colors.primaryForeground, fontWeight: '700' },
            ]}>
              Today
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewToggleButton,
              viewMode === 'week' && { backgroundColor: colors.primary },
            ]}
            onPress={() => setViewMode('week')}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.viewToggleText,
              viewMode === 'week' && { color: colors.primaryForeground, fontWeight: '700' },
            ]}>
              This Week
            </Text>
          </TouchableOpacity>
        </View>

        {/* Jobs List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: colorWithOpacity(colors.primary, 0.12) }]}>
              <Feather name="briefcase" size={18} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>
              {viewMode === 'today' ? "Today's Schedule" : "This Week"}
            </Text>
          </View>

          {viewMode === 'today' ? (
            displayJobs.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="calendar" size={36} color={colors.mutedForeground} />
                <Text style={styles.emptyTitle}>No jobs scheduled for today</Text>
                <Text style={styles.emptySubtitle}>Your scheduled jobs will appear here</Text>
              </View>
            ) : (
              displayJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  colors={colors}
                  styles={styles}
                  onPress={() => router.push(`/job/${job.id}`)}
                  onNavigate={() => openDirections(job.address, job.latitude, job.longitude)}
                  formatTime={formatTime}
                />
              ))
            )
          ) : (
            Object.entries(jobsByDay).map(([day, dayJobs]) => {
              const isExpanded = expandedDays[day] !== false;
              const hasJobs = dayJobs.length > 0;
              return (
                <View key={day} style={styles.dayGroup}>
                  <TouchableOpacity
                    style={styles.dayGroupHeader}
                    onPress={() => hasJobs && toggleDay(day)}
                    activeOpacity={hasJobs ? 0.7 : 1}
                  >
                    <Text style={[styles.dayGroupTitle, !hasJobs && { color: colors.mutedForeground }]}>{day}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      {hasJobs ? (
                        <>
                          <Text style={styles.dayGroupCount}>{dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}</Text>
                          <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
                        </>
                      ) : (
                        <Text style={[styles.dayGroupCount, { fontStyle: 'italic' }]}>No jobs</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  {hasJobs && isExpanded && dayJobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      colors={colors}
                      styles={styles}
                      onPress={() => router.push(`/job/${job.id}`)}
                      onNavigate={() => openDirections(job.address, job.latitude, job.longitude)}
                      formatTime={formatTime}
                    />
                  ))}
                </View>
              );
            })
          )}
        </View>

        {/* Earnings & Performance */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: colorWithOpacity(colors.success, 0.12) }]}>
              <Feather name="dollar-sign" size={18} color={colors.success} />
            </View>
            <Text style={styles.sectionTitle}>Earnings & Performance</Text>
          </View>
          <View style={styles.earningsCard}>
            <View style={styles.earningsRow}>
              <View style={styles.earningsStat}>
                <Text style={styles.earningsLabel}>This Week</Text>
                <Text style={styles.earningsAmount}>{formatCurrencyUtil(data.earningsWeek)}</Text>
              </View>
              <View style={[styles.earningsDivider, { backgroundColor: colors.border }]} />
              <View style={styles.earningsStat}>
                <Text style={styles.earningsLabel}>This Month</Text>
                <Text style={styles.earningsAmount}>{formatCurrencyUtil(data.earningsMonth)}</Text>
              </View>
            </View>

            {/* Performance stats */}
            <View style={[styles.earningsBreakdownDivider, { backgroundColor: colors.border, marginVertical: spacing.md }]} />
            <View style={styles.earningsRow}>
              <View style={styles.earningsStat}>
                <Text style={styles.earningsLabel}>Hours This Month</Text>
                <Text style={styles.perfStatValue}>{(data.hoursMonth ?? 0).toFixed(1)}h</Text>
              </View>
              <View style={[styles.earningsDivider, { backgroundColor: colors.border }]} />
              <View style={styles.earningsStat}>
                <Text style={styles.earningsLabel}>Jobs Completed</Text>
                <Text style={styles.perfStatValue}>{data.jobsCompletedMonth ?? 0}</Text>
              </View>
            </View>

            {/* By-business breakdown (only when subcontracting for others) */}
            {data.earningsByBusiness.length > 0 ? (
              <>
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md }}
                  onPress={() => setShowEarningsBreakdown(!showEarningsBreakdown)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    {showEarningsBreakdown ? 'Hide breakdown' : 'Earnings by business'}
                  </Text>
                  <Feather name={showEarningsBreakdown ? 'chevron-up' : 'chevron-down'} size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
                {showEarningsBreakdown && (
                  <View style={styles.earningsBreakdown}>
                    <View style={[styles.earningsBreakdownDivider, { backgroundColor: colors.border }]} />
                    <Text style={styles.earningsBreakdownTitle}>By Business (this month)</Text>
                    {data.earningsByBusiness.map((biz, i) => (
                      <View key={i} style={styles.earningsBreakdownRow}>
                        <Text style={styles.earningsBreakdownName}>{biz.businessName}</Text>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.earningsBreakdownAmount}>{formatCurrencyUtil(biz.amount)}</Text>
                          <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{(biz.hours ?? 0).toFixed(1)}h</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <Text style={{ fontSize: 12, color: colors.mutedForeground, textAlign: 'center', marginTop: spacing.md }}>
                Earnings from your own solo work
              </Text>
            )}
          </View>

          {/* Quick links */}
          <TouchableOpacity
            style={[styles.earningsCard, { marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
            onPress={() => router.push('/more/subbie-performance' as any)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={[styles.sectionIconContainer, { backgroundColor: colorWithOpacity(colors.info, 0.12) }]}>
                <Feather name="bar-chart-2" size={18} color={colors.info} />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>View Performance</Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Hours, jobs and earnings trend</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Invoicing Section — bill-a-business only; hidden on the free personal profile */}
        {showInvoicing && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: colorWithOpacity(colors.primary, 0.12) }]}>
              <Feather name="file-text" size={18} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Invoicing</Text>
          </View>
          <View style={{ gap: spacing.sm }}>
            <TouchableOpacity
              style={[styles.earningsCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={() => router.push('/more/subbie-bill' as any)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={[styles.sectionIconContainer, { backgroundColor: colorWithOpacity(colors.primary, 0.12) }]}>
                  <Feather name="edit-3" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>Build Quote or Invoice</Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Bill a business for completed jobs</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.earningsCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={() => router.push('/more/subbie-earnings' as any)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={[styles.sectionIconContainer, { backgroundColor: colorWithOpacity(colors.info, 0.12) }]}>
                  <Feather name="file-text" size={18} color={colors.info} />
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>Quotes & Invoices</Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>View documents and status</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.earningsCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={openCreateInvoice}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={[styles.sectionIconContainer, { backgroundColor: colorWithOpacity(colors.success, 0.12) }]}>
                  <Feather name="plus-circle" size={18} color={colors.success} />
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>Quick Invoice</Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Invoice tracked time fast</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.earningsCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={openInvoicesList}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={[styles.sectionIconContainer, { backgroundColor: colorWithOpacity(colors.info, 0.12) }]}>
                  <Feather name="list" size={18} color={colors.info} />
                </View>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>My Invoices</Text>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>View submitted invoices</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>
        )}

        {/* Connected Businesses */}
        {data.businesses.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconContainer, { backgroundColor: colorWithOpacity(colors.info, 0.12) }]}>
                <Feather name="briefcase" size={18} color={colors.info} />
              </View>
              <Text style={styles.sectionTitle}>Connected Businesses</Text>
            </View>
            <View style={styles.businessesList}>
              {data.businesses.map((biz) => (
                <View key={biz.id} style={styles.businessItem}>
                  <View style={[styles.businessDot, { backgroundColor: biz.color }]} />
                  <Text style={styles.businessItemName}>{biz.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Decline Modal */}
      <AppBottomSheet
        visible={showDeclineModal}
        onDismiss={() => setShowDeclineModal(false)}
        snapPoints={['60%']}
        scrollable={false}
        contentPadding={0}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ paddingHorizontal: spacing.lg }}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Decline Job</Text>
            <TouchableOpacity onPress={() => setShowDeclineModal(false)} style={{ padding: spacing.xs }}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSubtitle}>
            Add an optional reason for declining this job. The business will be notified.
          </Text>
          <TextInput
            style={[styles.modalInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]}
            placeholder="Reason (optional)..."
            placeholderTextColor={colors.mutedForeground}
            value={declineReason}
            onChangeText={setDeclineReason}
            multiline
            numberOfLines={3}
            autoFocus
          />
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.muted }]}
              onPress={() => setShowDeclineModal(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalButtonText, { color: colors.foreground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.destructive }]}
              onPress={confirmDeclineJob}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalButtonText, { color: colors.white }]}>Decline Job</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </AppBottomSheet>

      {/* Create Invoice Modal */}
      <AppBottomSheet
        visible={showInvoiceCreate}
        onDismiss={() => setShowInvoiceCreate(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={{ paddingHorizontal: spacing.lg }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Tax Invoice</Text>
              <TouchableOpacity onPress={() => setShowInvoiceCreate(false)} style={{ padding: spacing.xs }}>
                <Feather name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Select completed jobs to include in your invoice. GST (10%) will be calculated automatically.
            </Text>

            <View style={{ padding: spacing.sm, backgroundColor: colorWithOpacity(colors.muted, 0.2), borderRadius: radius.md, marginBottom: spacing.sm }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.mutedForeground, marginBottom: 2 }}>FROM</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>
                {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || 'You'}
              </Text>
              {user?.email && <Text style={{ fontSize: 11, color: colors.mutedForeground }}>{user.email}</Text>}
              <Text style={{ fontSize: 10, color: colors.mutedForeground, marginTop: 2 }}>ABN and contact details from your profile will appear on the invoice PDF</Text>
            </View>

            {isLoadingUnbilled ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.lg }} />
            ) : unbilledWork.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                <Feather name="check-circle" size={32} color={colors.mutedForeground} />
                <Text style={{ fontSize: 14, color: colors.mutedForeground, marginTop: spacing.sm, textAlign: 'center' }}>
                  No unbilled work found. Complete some jobs first!
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                {unbilledWork.map((item) => (
                  <View key={item.jobId} style={{ marginBottom: spacing.sm }}>
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: spacing.md,
                        borderWidth: 1,
                        borderColor: selectedJobs[item.jobId] ? colors.primary : colors.border,
                        borderTopLeftRadius: radius.lg,
                        borderTopRightRadius: radius.lg,
                        borderBottomLeftRadius: (selectedJobs[item.jobId] && lineItemEdits[item.jobId]?.expanded) ? 0 : radius.lg,
                        borderBottomRightRadius: (selectedJobs[item.jobId] && lineItemEdits[item.jobId]?.expanded) ? 0 : radius.lg,
                        backgroundColor: selectedJobs[item.jobId] ? colorWithOpacity(colors.primary, 0.06) : 'transparent',
                      }}
                      onPress={() => toggleJobSelection(item.jobId)}
                      activeOpacity={0.7}
                    >
                      <View style={{
                        width: 22, height: 22, borderRadius: 4,
                        borderWidth: 2,
                        borderColor: selectedJobs[item.jobId] ? colors.primary : colors.border,
                        backgroundColor: selectedJobs[item.jobId] ? colors.primary : 'transparent',
                        alignItems: 'center', justifyContent: 'center',
                        marginRight: spacing.sm,
                      }}>
                        {selectedJobs[item.jobId] && <Feather name="check" size={14} color={colors.primaryForeground} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }} numberOfLines={1}>
                          {lineItemEdits[item.jobId]?.description || item.jobTitle}
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                          {item.businessName} | {item.totalHours?.toFixed(1)}h @ {formatCurrencyUtil(item.hourlyRate)}/hr
                          {item.materialsCost > 0 ? ` + ${formatCurrencyUtil(item.materialsCost)} materials` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.foreground }}>
                          {(() => {
                            const ids = lineItemEdits[item.jobId]?.includeTimeEntryIds || item.timeEntries.map(te => te.id);
                            const h = item.timeEntries.filter(te => ids.includes(te.id)).reduce((s, te) => s + te.hours, 0);
                            return formatCurrencyUtil(Math.round(h * item.hourlyRate * 100) / 100 + (item.materialsCost || 0));
                          })()}
                        </Text>
                        {selectedJobs[item.jobId] && (
                          <TouchableOpacity
                            onPress={() => setLineItemEdits(prev => ({
                              ...prev,
                              [item.jobId]: { ...prev[item.jobId], expanded: !prev[item.jobId]?.expanded }
                            }))}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={{ fontSize: 11, color: colors.primary, marginTop: 2 }}>
                              {lineItemEdits[item.jobId]?.expanded ? 'Hide details' : 'Edit details'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>

                    {selectedJobs[item.jobId] && lineItemEdits[item.jobId]?.expanded && (
                      <View style={{
                        borderWidth: 1,
                        borderTopWidth: 0,
                        borderColor: colors.primary,
                        borderBottomLeftRadius: radius.lg,
                        borderBottomRightRadius: radius.lg,
                        padding: spacing.md,
                        backgroundColor: colorWithOpacity(colors.primary, 0.03),
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.mutedForeground, marginBottom: 4 }}>Description</Text>
                        <TextInput
                          style={{
                            fontSize: 13,
                            color: colors.foreground,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: radius.md,
                            padding: spacing.sm,
                            backgroundColor: colors.background,
                            marginBottom: spacing.sm,
                          }}
                          value={lineItemEdits[item.jobId]?.description || ''}
                          onChangeText={(text) => setLineItemEdits(prev => ({
                            ...prev,
                            [item.jobId]: { ...prev[item.jobId], description: text }
                          }))}
                          placeholder="Line item description"
                          placeholderTextColor={colors.mutedForeground}
                        />
                        {(() => {
                          const includedIds = lineItemEdits[item.jobId]?.includeTimeEntryIds || [];
                          const includedEntries = item.timeEntries.filter(te => includedIds.includes(te.id));
                          const editedHours = includedEntries.reduce((s, te) => s + te.hours, 0);
                          return (
                            <>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Hours</Text>
                                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>{editedHours.toFixed(1)}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Rate</Text>
                                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>{formatCurrencyUtil(item.hourlyRate)}/hr</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Labour</Text>
                                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>{formatCurrencyUtil(editedHours * item.hourlyRate)}</Text>
                                </View>
                                {item.materialsCost > 0 && (
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Materials</Text>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>{formatCurrencyUtil(item.materialsCost)}</Text>
                                  </View>
                                )}
                              </View>
                              {item.timeEntries.length > 0 && (
                                <View style={{ marginTop: spacing.sm }}>
                                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.mutedForeground, marginBottom: 4 }}>
                                    Time entries ({includedIds.length}/{item.timeEntries.length} selected)
                                  </Text>
                                  {item.timeEntries.map(te => {
                                    const isIncluded = includedIds.includes(te.id);
                                    return (
                                      <TouchableOpacity
                                        key={te.id}
                                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 3 }}
                                        onPress={() => {
                                          setLineItemEdits(prev => {
                                            const cur = prev[item.jobId]?.includeTimeEntryIds || [];
                                            const next = isIncluded ? cur.filter(id => id !== te.id) : [...cur, te.id];
                                            return { ...prev, [item.jobId]: { ...prev[item.jobId], includeTimeEntryIds: next } };
                                          });
                                        }}
                                      >
                                        <View style={{
                                          width: 16, height: 16, borderRadius: 3,
                                          borderWidth: 1.5,
                                          borderColor: isIncluded ? colors.primary : colors.border,
                                          backgroundColor: isIncluded ? colors.primary : 'transparent',
                                          alignItems: 'center', justifyContent: 'center',
                                          marginRight: 6,
                                        }}>
                                          {isIncluded && <Feather name="check" size={10} color={colors.primaryForeground} />}
                                        </View>
                                        <Text style={{ fontSize: 11, color: colors.foreground, flex: 1 }}>
                                          {new Date(te.startTime).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} — {te.hours.toFixed(1)}h ({formatCurrencyUtil(te.amount)})
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              )}
                            </>
                          );
                        })()}
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            )}

            {unbilledWork.length > 0 && (
              <>
                <View style={{ marginTop: spacing.md, padding: spacing.md, backgroundColor: colorWithOpacity(colors.muted, 0.3), borderRadius: radius.lg }}>
                  {(() => {
                    const selectedItems = unbilledWork.filter(i => selectedJobs[i.jobId]);
                    const subtotal = selectedItems.reduce((sum, i) => {
                      const includedIds = lineItemEdits[i.jobId]?.includeTimeEntryIds || i.timeEntries.map(te => te.id);
                      const includedEntries = i.timeEntries.filter(te => includedIds.includes(te.id));
                      const hours = includedEntries.reduce((s, te) => s + te.hours, 0);
                      return sum + Math.round(hours * i.hourlyRate * 100) / 100 + (i.materialsCost || 0);
                    }, 0);
                    const gst = subtotal * 0.1;
                    const total = subtotal + gst;
                    return (
                      <>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>Subtotal</Text>
                          <Text style={{ fontSize: 12, color: colors.foreground }}>{formatCurrencyUtil(subtotal)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontSize: 12, color: colors.mutedForeground }}>GST (10%)</Text>
                          <Text style={{ fontSize: 12, color: colors.foreground }}>{formatCurrencyUtil(gst)}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6, marginTop: 4 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.foreground }}>Total (inc. GST)</Text>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>{formatCurrencyUtil(total)}</Text>
                        </View>
                      </>
                    );
                  })()}
                </View>

                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border, marginTop: spacing.md }]}
                  placeholder="Notes (optional)..."
                  placeholderTextColor={colors.mutedForeground}
                  value={invoiceNotes}
                  onChangeText={setInvoiceNotes}
                  multiline
                  numberOfLines={2}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.muted }]}
                    onPress={() => setShowInvoiceCreate(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalButtonText, { color: colors.foreground }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, { backgroundColor: colors.primary, opacity: isSubmittingInvoice ? 0.6 : 1 }]}
                    onPress={submitInvoice}
                    disabled={isSubmittingInvoice}
                    activeOpacity={0.7}
                  >
                    {isSubmittingInvoice ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : (
                      <Text style={[styles.modalButtonText, { color: colors.primaryForeground }]}>Submit Invoice</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
        </View>
      </AppBottomSheet>

      {/* Invoice List Modal */}
      <AppBottomSheet
        visible={showInvoices}
        onDismiss={() => setShowInvoices(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={{ paddingHorizontal: spacing.lg }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>My Invoices</Text>
              <TouchableOpacity onPress={() => setShowInvoices(false)} style={{ padding: spacing.xs }}>
                <Feather name="x" size={22} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {isLoadingInvoices ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.lg }} />
            ) : invoices.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                <Feather name="file-text" size={32} color={colors.mutedForeground} />
                <Text style={{ fontSize: 14, color: colors.mutedForeground, marginTop: spacing.sm, textAlign: 'center' }}>
                  No invoices yet. Create your first invoice from completed work.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                {(() => {
                  const grouped: Record<string, SubInvoiceSummary[]> = {};
                  invoices.forEach(inv => {
                    const biz = inv.businessName || 'Business';
                    if (!grouped[biz]) grouped[biz] = [];
                    grouped[biz].push(inv);
                  });
                  return Object.entries(grouped).map(([bizName, bizInvoices]) => (
                    <View key={bizName} style={{ marginBottom: spacing.md }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mutedForeground, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {bizName}
                      </Text>
                      {bizInvoices.map((inv) => (
                        <TouchableOpacity
                          key={inv.id}
                          activeOpacity={0.7}
                          onPress={() => openInvoiceDetail(inv)}
                          style={{
                            padding: spacing.md,
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: radius.lg,
                            marginBottom: spacing.sm,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.foreground }}>
                              {inv.invoiceNumber}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                              <View style={{
                                paddingHorizontal: spacing.sm,
                                paddingVertical: 2,
                                borderRadius: radius.pill,
                                backgroundColor: colorWithOpacity(getInvoiceStatusColor(inv.status), 0.12),
                              }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: getInvoiceStatusColor(inv.status), textTransform: 'capitalize' }}>
                                  {inv.status}
                                </Text>
                              </View>
                              {inv.status !== 'paid' && (
                                <TouchableOpacity
                                  onPress={() => handleDeleteInvoice(inv)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  accessibilityLabel={`Delete invoice ${inv.invoiceNumber}`}
                                >
                                  <Feather name="trash-2" size={16} color={colors.destructive} />
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                              {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.foreground }}>
                                {formatCurrencyUtil(parseFloat(inv.totalAmount || '0'))}
                              </Text>
                              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ));
                })()}
              </ScrollView>
            )}
        </View>
      </AppBottomSheet>

      <AppBottomSheet
        visible={!!detailInvoice}
        onDismiss={closeInvoiceDetail}
        snapPoints={['85%']}
        scrollable
        contentPadding={spacing.lg}>
        {detailInvoice && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground }}>
                  {detailInvoice.invoiceNumber}
                </Text>
                <Text style={{ fontSize: 13, color: colors.mutedForeground, marginTop: 2 }}>
                  {detailInvoice.businessName}
                </Text>
              </View>
              <View style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                borderRadius: radius.pill,
                backgroundColor: colorWithOpacity(getInvoiceStatusColor(detailInvoice.status), 0.12),
              }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: getInvoiceStatusColor(detailInvoice.status), textTransform: 'capitalize' }}>
                  {detailInvoice.status}
                </Text>
              </View>
            </View>

            {detailInvoice.status === 'rejected' && detailInvoice.rejectionReason ? (
              <View style={{
                backgroundColor: colorWithOpacity(colors.destructive, 0.1),
                borderRadius: radius.md,
                padding: spacing.md,
                marginBottom: spacing.md,
              }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.destructive, marginBottom: 2 }}>Rejected</Text>
                <Text style={{ fontSize: 13, color: colors.foreground }}>{detailInvoice.rejectionReason}</Text>
              </View>
            ) : null}

            {isLoadingDetail ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.lg }} />
            ) : (
              <>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm }}>
                  Line items
                </Text>
                {(detailInvoice.items || []).length === 0 ? (
                  <Text style={{ fontSize: 13, color: colors.mutedForeground, marginBottom: spacing.md }}>
                    No line items.
                  </Text>
                ) : (
                  detailInvoice.items.map((item) => (
                    <View
                      key={item.id}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        paddingVertical: spacing.sm,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.border,
                        gap: spacing.md,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, color: colors.foreground }}>{item.description}</Text>
                        {item.hours && item.rate ? (
                          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                            {parseFloat(item.hours)} hrs @ {formatCurrencyUtil(parseFloat(item.rate))}/hr
                          </Text>
                        ) : item.quantity && item.unitPrice ? (
                          <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                            {parseFloat(item.quantity)} × {formatCurrencyUtil(parseFloat(item.unitPrice))}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
                        {formatCurrencyUtil(parseFloat(item.amount || '0'))}
                      </Text>
                    </View>
                  ))
                )}

                <View style={{ marginTop: spacing.md, gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Subtotal</Text>
                    <Text style={{ fontSize: 13, color: colors.foreground }}>{formatCurrencyUtil(parseFloat(detailInvoice.subtotalAmount || '0'))}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: colors.mutedForeground }}>GST</Text>
                    <Text style={{ fontSize: 13, color: colors.foreground }}>{formatCurrencyUtil(parseFloat(detailInvoice.gstAmount || '0'))}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.foreground }}>Total</Text>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.foreground }}>{formatCurrencyUtil(parseFloat(detailInvoice.totalAmount || '0'))}</Text>
                  </View>
                </View>

                {detailInvoice.notes ? (
                  <View style={{ marginTop: spacing.md }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Notes</Text>
                    <Text style={{ fontSize: 13, color: colors.foreground }}>{detailInvoice.notes}</Text>
                  </View>
                ) : null}
              </>
            )}

            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isDownloadingPdf}
                onPress={() => downloadInvoicePdf(detailInvoice)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: colors.primary,
                  opacity: isDownloadingPdf ? 0.6 : 1,
                }}
              >
                {isDownloadingPdf ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Feather name="download" size={16} color={colors.primaryForeground} />
                )}
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primaryForeground }}>
                  View PDF
                </Text>
              </TouchableOpacity>

              {detailInvoice.status !== 'paid' && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    const inv = detailInvoice;
                    closeInvoiceDetail();
                    handleDeleteInvoice(inv);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.sm,
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.destructive }}>
                    Delete invoice
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </AppBottomSheet>

      <WorkspaceSwitcher
        visible={showSwitcher}
        onClose={() => setShowSwitcher(false)}
        onSwitch={() => {
          setShowSwitcher(false);
          // The screen stays focused while the modal opens/closes, so the focus
          // effect won't re-run — refresh the active workspace id here so the
          // card unlocks immediately after switching into the matching business.
          api.getMyBusinesses()
            .then((res) => {
              if (res.data) setActiveBusinessId(res.data.activeBusinessId);
            })
            .catch(() => {});
          fetchDashboard();
        }}
      />
    </>
  );
}

function JobCard({
  job,
  colors,
  styles,
  onPress,
  onNavigate,
  formatTime,
}: {
  job: SubcontractorJob;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  onPress: () => void;
  onNavigate: () => void;
  formatTime: (dateStr?: string) => string;
}) {
  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pending', color: colors.warning },
    scheduled: { label: 'Scheduled', color: colors.info },
    in_progress: { label: 'In Progress', color: colors.success },
    done: { label: 'Completed', color: colors.mutedForeground },
    invoiced: { label: 'Invoiced', color: colors.mutedForeground },
  };
  const status = statusConfig[job.status] || { label: job.status, color: colors.mutedForeground };

  return (
    <PressableRow style={styles.jobCard} onPress={onPress}>
      <View style={[styles.jobCardBorder, { backgroundColor: job.businessColor }]} />
      <View style={styles.jobCardContent}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1 }}>
            <View style={[styles.businessDotSmall, { backgroundColor: job.businessColor }]} />
            <Text style={styles.jobCardBusiness} numberOfLines={1}>{job.businessName}</Text>
          </View>
          <View style={[styles.jobStatusBadge, { backgroundColor: colorWithOpacity(status.color, 0.12) }]}>
            <Text style={[styles.jobStatusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.jobCardTitle} numberOfLines={1}>{job.title}</Text>
        <View style={styles.jobCardMeta}>
          {job.scheduledAt && (
            <View style={styles.jobCardMetaItem}>
              <Feather name="clock" size={13} color={colors.mutedForeground} />
              <Text style={styles.jobCardMetaText}>{formatTime(job.scheduledAt)}</Text>
              {job.estimatedDuration && (
                <Text style={styles.jobCardMetaText}>({job.estimatedDuration}min)</Text>
              )}
            </View>
          )}
          {job.address && (
            <TouchableOpacity
              style={styles.jobCardMetaItem}
              onPress={(e) => { e.stopPropagation?.(); onNavigate(); }}
              activeOpacity={0.7}
            >
              <Feather name="map-pin" size={13} color={colors.primary} />
              <Text style={[styles.jobCardMetaText, { color: colors.primary }]} numberOfLines={1}>{job.address}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </PressableRow>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Availability Toggle
  availabilityCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  availabilitySectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  availabilityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  availabilityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  availabilityButtonText: {
    fontSize: 13,
  },

  // Active Job Card
  activeJobCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    ...shadows.md,
  },
  activeJobHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  activeJobPulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activeJobLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.success,
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeJobTimer: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  activeJobContent: {
    marginBottom: spacing.md,
  },
  activeJobBusiness: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  activeJobTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  activeJobAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  activeJobAddress: {
    fontSize: 14,
    flex: 1,
  },
  activeJobLocationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colorWithOpacity(colors.info, 0.08),
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  activeJobLocationText: {
    fontSize: 12,
    flex: 1,
  },
  activeJobLockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colorWithOpacity(colors.warning, 0.1),
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  switchButton: {
    backgroundColor: colorWithOpacity(colors.primary, 0.1),
    borderWidth: 1,
    borderColor: colors.primary,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  completeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },

  // Section
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },

  // View Toggle
  viewToggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: 3,
    marginBottom: spacing.lg,
  },
  viewToggleButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedForeground,
  },

  // Job Card
  jobCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  jobCardBorder: {
    width: 4,
  },
  jobCardContent: {
    flex: 1,
    padding: spacing.md,
  },
  jobCardBusiness: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    flex: 1,
  },
  jobCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  jobCardMeta: {
    gap: spacing.xs,
  },
  jobCardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  jobCardMetaText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  jobStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  jobStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Business dot
  businessDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  businessDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Day Group
  dayGroup: {
    marginBottom: spacing.md,
  },
  dayGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  dayGroupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
  },
  dayGroupCount: {
    fontSize: 12,
    color: colors.mutedForeground,
  },

  // Request Card
  requestCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colorWithOpacity(colors.warning, 0.3),
    ...shadows.sm,
  },
  requestBusiness: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.foreground,
  },
  requestMeta: {
    fontSize: 13,
    color: colors.mutedForeground,
    flex: 1,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  requestButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  declineButton: {
    backgroundColor: colorWithOpacity(colors.destructive, 0.08),
    borderWidth: 1,
    borderColor: colorWithOpacity(colors.destructive, 0.2),
  },
  acceptButton: {},
  requestButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
  },

  // Earnings
  earningsCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  earningsStat: {
    flex: 1,
    alignItems: 'center',
  },
  earningsLabel: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  earningsAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
  },
  perfStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  earningsDivider: {
    width: 1,
    height: 40,
  },
  earningsBreakdown: {
    marginTop: spacing.md,
  },
  earningsBreakdownDivider: {
    height: 1,
    marginBottom: spacing.md,
  },
  earningsBreakdownTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  earningsBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  earningsBreakdownName: {
    fontSize: 14,
    color: colors.foreground,
  },
  earningsBreakdownAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },

  // Businesses List
  businessesList: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
    gap: spacing.md,
  },
  businessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  businessItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
  },
  modalInput: {
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 15,
    borderWidth: 1,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Card border - reused from index for reference
  cardBorder: {
    borderColor: colors.cardBorder,
  },
});
