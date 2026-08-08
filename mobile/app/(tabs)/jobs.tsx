import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '@/components/ui/PressableRow';

import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useContentWidth, useIsTablet } from '../../src/lib/device';
import { Feather } from '@expo/vector-icons';
import { useJobsStore, useClientsStore, useAuthStore, type Job } from '../../src/lib/store';
import { useUserRole } from '../../src/hooks/use-user-role';
import { api } from '../../src/lib/api';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { XeroBadge } from '../../src/components/ui/XeroBadge';
import { AnimatedCardPressable } from '../../src/components/ui/AnimatedPressable';
import { useTheme, ThemeColors, colorWithOpacity } from '../../src/lib/theme';
import { fontWeights, spacing, radius, shadows, sizes, pageShell, typography, iconSizes, usePageShell } from '../../src/lib/design-tokens';
import { useScrollToTop } from '../../src/contexts/ScrollContext';
import { usePreserveScrollOnFold } from '../../src/hooks/usePreserveScrollOnFold';
import { getJobUrgency, type JobUrgency } from '../../src/lib/jobUrgency';
import UsageLimitBanner from '../../src/components/UsageLimitBanner';
import { QuickActionSheet, type QuickAction } from '../../src/components/QuickActionSheet';
import { showToast } from '../../src/lib/toast';
import { Button } from '../../src/components/ui/Button';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';

interface AdvancedFilters {
  statuses: string[];
  dateFrom: string;
  dateTo: string;
  assignedTo: string;
  clientId: string;
  suburb: string;
}

const emptyAdvancedFilters: AdvancedFilters = {
  statuses: [],
  dateFrom: '',
  dateTo: '',
  assignedTo: '',
  clientId: '',
  suburb: '',
};

interface SavedFilter {
  id: string;
  name: string;
  filters: AdvancedFilters;
  entityType: string;
  createdAt: string;
}

const navigateToCreateJob = () => {
  router.push('/more/create-job');
};

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

const STATUS_FILTERS: { key: string; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'briefcase' },
  { key: 'recurring', label: 'Recurring', icon: 'repeat' },
  { key: 'pending', label: 'Pending', icon: 'clock' },
  { key: 'scheduled', label: 'Scheduled', icon: 'calendar' },
  { key: 'in_progress', label: 'In Progress', icon: 'play' },
  { key: 'done', label: 'Done', icon: 'check-circle' },
  { key: 'invoiced', label: 'Invoiced', icon: 'file-text' },
];

function JobListRow({ 
  job, 
  onPress,
  onDelete,
  onQuickAction,
  onShowActionSheet,
}: { 
  job: any;
  onPress: () => void;
  onDelete: (jobId: string) => void;
  onQuickAction?: (action: string, jobId: string) => void;
  onShowActionSheet?: (job: any) => void;
}) {
  const { colors } = useTheme();
  const contentWidth = useContentWidth();
  const responsiveShell = usePageShell();
  const styles = useMemo(() => createStyles(colors, contentWidth, responsiveShell.paddingHorizontal), [colors, contentWidth, responsiveShell.paddingHorizontal]);
  const confirm = useConfirmDialog();
  
  const urgency = getJobUrgency(job.scheduledAt, job.status, colors.isDark);
  
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', { 
      day: 'numeric', 
      month: 'short',
    });
  };

  const handleDelete = async () => {
    const ok = await confirm({ title: 'Delete Job', message: `Are you sure you want to delete "${job.title || 'Untitled Job'}"? This action cannot be undone.`, confirmText: 'Delete', cancelText: 'Cancel', destructive: true });
    if (ok) {
      onDelete(job.id);
    }
  };

  const handleMorePress = () => {
    onShowActionSheet?.(job);
  };

  return (
    <AnimatedCardPressable
      onPress={onPress}
      style={styles.jobListRow}
    >
      <View style={styles.jobListRowContent}>
        <View style={styles.jobListRowLeft}>
          <Text style={styles.jobListRowTitle} numberOfLines={1}>{job.title || 'Untitled Job'}</Text>
          <Text style={styles.jobListRowAddress} numberOfLines={1}>{job.address?.split(',')[0] || 'No address'}</Text>
        </View>
        <View style={styles.jobListRowCenter}>
          <StatusBadge status={urgency?.level === 'overdue' ? 'overdue' : job.status} size="sm" />
        </View>
        <Text style={styles.jobListRowDate}>
          {formatDate(job.scheduledAt)}
        </Text>
        <Button
          size="icon"
          variant="ghost"
          onPress={handleMorePress}
          icon={<Feather name="more-vertical" size={iconSizes.md} color={colors.mutedForeground} />}
        >{null}</Button>
      </View>
    </AnimatedCardPressable>
  );
}

function JobCard({ 
  job, 
  onPress,
  onQuickAction,
  onShowActionSheet,
  canCreateInvoices = true,
}: { 
  job: any;
  onPress: () => void;
  onQuickAction?: (action: string, jobId: string) => void;
  onShowActionSheet?: (job: any) => void;
  canCreateInvoices?: boolean;
}) {
  const { colors } = useTheme();
  const contentWidth = useContentWidth();
  const responsiveShell = usePageShell();
  const styles = useMemo(() => createStyles(colors, contentWidth, responsiveShell.paddingHorizontal), [colors, contentWidth, responsiveShell.paddingHorizontal]);
  
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not scheduled';
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return `Today, ${formatTime(dateStr)}`;
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow, ${formatTime(dateStr)}`;
    }
    return date.toLocaleDateString('en-AU', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short',
    }) + ', ' + formatTime(dateStr);
  };

  const getAccentColor = () => {
    switch (job.status) {
      case 'pending': return colors.pending;
      case 'scheduled': return colors.scheduled;
      case 'in_progress': return colors.inProgress;
      case 'done': return colors.done;
      case 'invoiced': return colors.invoiced;
      default: return colors.primary;
    }
  };

  const urgency = getJobUrgency(job.scheduledAt, job.status, colors.isDark);

  const handleMorePress = () => {
    onShowActionSheet?.(job);
  };

  return (
    <AnimatedCardPressable
      onPress={onPress}
      style={job.isXeroImport ? { ...styles.jobCard, overflow: 'visible' as const } : styles.jobCard}
    >
      {job.isXeroImport && <XeroBadge size="sm" />}
      <View style={styles.jobCardContent}>
        <View style={styles.jobCardStatusRow}>
          <StatusBadge status={urgency?.level === 'overdue' ? 'overdue' : job.status} size="sm" />
          {job.isRecurring && (
            <View style={styles.recurringBadge}>
              <Feather name="repeat" size={10} color={colors.primary} />
              <Text style={styles.recurringBadgeText}>Recurring</Text>
            </View>
          )}
          {urgency && urgency.level !== 'overdue' && (
            <View style={[styles.urgencyBadge, { backgroundColor: urgency.bgColor }]}>
              {urgency.animate && (
                <View style={[styles.urgencyDot, { backgroundColor: urgency.color }]} />
              )}
              <Text style={[styles.urgencyBadgeText, { color: urgency.color }]} numberOfLines={1}>
                {urgency.shortLabel}
              </Text>
            </View>
          )}
          <View style={{ marginLeft: 'auto' }}>
            <Button
              size="icon"
              variant="ghost"
              onPress={handleMorePress}
              icon={<Feather name="more-horizontal" size={16} color={colors.mutedForeground} />}
            >{null}</Button>
          </View>
        </View>

        <Text style={styles.jobTitle} numberOfLines={2}>{job.title || 'Untitled Job'}</Text>
        
        {job.isRecurring && job.nextRecurrenceDate && (
          <Text style={styles.nextRecurrenceText}>
            Next: {new Date(job.nextRecurrenceDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
          </Text>
        )}

        <View style={styles.jobCardDetails}>
          {job.clientName && (
            <View style={styles.jobDetailRow}>
              <Feather name="user" size={iconSizes.sm} color={colors.mutedForeground} />
              <Text style={styles.jobDetailText} numberOfLines={1}>{job.clientName}</Text>
            </View>
          )}
          {job.address && (
            <View style={styles.jobDetailRow}>
              <Feather name="map-pin" size={iconSizes.sm} color={colors.mutedForeground} />
              <Text style={styles.jobDetailText} numberOfLines={1}>{job.address.split(',')[0]}</Text>
            </View>
          )}
          <View style={styles.jobDetailRow}>
            <Feather name="calendar" size={iconSizes.sm} color={colors.mutedForeground} />
            <Text style={styles.jobDetailText} numberOfLines={1}>
              {job.scheduledAt ? formatDate(job.scheduledAt) : 'Not scheduled'}
            </Text>
          </View>
        </View>

        {job.status === 'done' && canCreateInvoices && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={(e) => {
              e.stopPropagation();
              router.push(`/more/invoice/new?jobId=${job.id}`);
            }}
            style={styles.invoiceBtn}
          >
            <Feather name="file-text" size={iconSizes.sm} color={colors.primaryForeground} />
            <Text style={styles.invoiceBtnText}>Invoice</Text>
          </TouchableOpacity>
        )}
      </View>
    </AnimatedCardPressable>
  );
}

export default function JobsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const contentWidth = useContentWidth();
  const isTabletDevice = useIsTablet();
  const responsiveShell = usePageShell();
  const styles = useMemo(() => createStyles(colors, contentWidth, responsiveShell.paddingHorizontal), [colors, contentWidth, responsiveShell.paddingHorizontal]);
  const confirm = useConfirmDialog();
  const scrollRef = useRef<FlatList | null>(null);
  const { scrollToTopTrigger } = useScrollToTop();
  const { onScroll: preserveOnScroll, scrollEventThrottle } = usePreserveScrollOnFold(scrollRef);
  
  useEffect(() => {
    if (scrollToTopTrigger > 0) {
      scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [scrollToTopTrigger]);
  
  const { jobs, fetchJobs, isLoading, updateJobStatus } = useJobsStore();
  const { clients, fetchClients } = useClientsStore();
  const { roleInfo, hasPermission, businessSettings, user } = useAuthStore();
  const params = useLocalSearchParams<{ filter?: string }>();

  const isOwnerOrManager = roleInfo
    ? (roleInfo.isOwner || roleInfo.roleName?.toLowerCase() === 'manager' || roleInfo.roleName?.toLowerCase() === 'admin')
    : false;
  const isSoloOwner = user && businessSettings && (!roleInfo || roleInfo.isOwner);
  const subRole = roleInfo?.roleName?.toLowerCase();
  const isSubcontractor = subRole === 'subcontractor' || subRole === 'sub_contractor';
  // A subcontractor in their OWN Personal profile has full owner powers
  // (server returns isOwner:true) — same flag the Quick Create FAB and More
  // menu use to unlock create, so the Create Job button + quote/invoice
  // actions must appear here too. We read this from useUserRole (which keys
  // off the server's teamMemberInfo.isOwner) rather than roleInfo.isOwner:
  // roleInfo has two racing writers and gets clobbered to false for this
  // role, whereas isStandaloneSubcontractor is the single canonical signal.
  // A subcontractor switched INTO a joined business stays a locked worker.
  const { isStandaloneSubcontractor } = useUserRole();
  const canWriteJobs = isStandaloneSubcontractor || (!isSubcontractor && (isOwnerOrManager || isSoloOwner));
  const canCreateQuotes = isStandaloneSubcontractor || (!isSubcontractor && (isOwnerOrManager || isSoloOwner || (typeof hasPermission === 'function' && hasPermission('create_quotes'))));
  const canCreateInvoices = isStandaloneSubcontractor || (!isSubcontractor && (isOwnerOrManager || isSoloOwner || (typeof hasPermission === 'function' && hasPermission('create_invoices'))));
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState(params.filter || 'all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Sort state matching Documents page pattern
  type SortField = 'title' | 'status' | 'date';
  type SortDirection = 'asc' | 'desc';
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [actionSheetJob, setActionSheetJob] = useState<any>(null);

  const [batchMode, setBatchMode] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [batchConfirmVisible, setBatchConfirmVisible] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(emptyAdvancedFilters);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [savedFiltersLoading, setSavedFiltersLoading] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState('');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savingFilter, setSavingFilter] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  useEffect(() => {
    if (params.filter) {
      setActiveFilter(params.filter);
    }
  }, [params.filter]);

  const hasAdvancedFilters = useMemo(() => {
    return advancedFilters.statuses.length > 0 ||
      advancedFilters.dateFrom !== '' ||
      advancedFilters.dateTo !== '' ||
      advancedFilters.assignedTo !== '' ||
      advancedFilters.clientId !== '' ||
      advancedFilters.suburb !== '';
  }, [advancedFilters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (advancedFilters.statuses.length > 0) count++;
    if (advancedFilters.dateFrom || advancedFilters.dateTo) count++;
    if (advancedFilters.assignedTo) count++;
    if (advancedFilters.clientId) count++;
    if (advancedFilters.suburb) count++;
    return count;
  }, [advancedFilters]);

  const fetchSavedFilters = useCallback(async () => {
    setSavedFiltersLoading(true);
    const response = await api.get<SavedFilter[]>('/api/saved-filters?entityType=jobs');
    if (response.data) {
      setSavedFilters(response.data);
    }
    setSavedFiltersLoading(false);
  }, []);

  const fetchTeamMembers = useCallback(async () => {
    const response = await api.get<any[]>('/api/team/members');
    if (response.data) {
      setTeamMembers(response.data);
    }
  }, []);

  const handleSaveFilter = useCallback(async () => {
    if (!saveFilterName.trim()) return;
    setSavingFilter(true);
    const response = await api.post<SavedFilter>('/api/saved-filters', {
      name: saveFilterName.trim(),
      filters: advancedFilters,
      entityType: 'jobs',
    });
    if (response.data) {
      setSavedFilters(prev => [...prev, response.data!]);
      showToast({ type: 'success', message: `"${saveFilterName}" has been saved.` });
    } else {
      showToast({ type: 'error', message: 'Failed to save filter.' });
    }
    setSavingFilter(false);
    setSaveDialogOpen(false);
    setSaveFilterName('');
  }, [saveFilterName, advancedFilters]);

  const handleDeleteSavedFilter = useCallback(async (id: string, name: string) => {
    const ok = await confirm({ title: 'Delete Filter', message: `Delete "${name}"?`, confirmText: 'Delete', cancelText: 'Cancel', destructive: true });
    if (ok) {
      await api.delete(`/api/saved-filters/${id}`);
      setSavedFilters(prev => prev.filter(f => f.id !== id));
    }
  }, [confirm]);

  const handleLoadSavedFilter = useCallback((sf: SavedFilter) => {
    setAdvancedFilters(sf.filters as AdvancedFilters);
    setActiveFilter('all');
  }, []);

  const handleClearAdvanced = useCallback(() => {
    setAdvancedFilters(emptyAdvancedFilters);
  }, []);

  const toggleStatus = useCallback((status: string) => {
    setAdvancedFilters(prev => ({
      ...prev,
      statuses: prev.statuses.includes(status)
        ? prev.statuses.filter(s => s !== status)
        : [...prev.statuses, status],
    }));
  }, []);

  const handleSortChange = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const completedJobs = useMemo(() => {
    return jobs.filter(j => j.status === 'done');
  }, [jobs]);

  const selectedJobsList = useMemo(() => {
    return completedJobs
      .filter(j => selectedJobIds.has(j.id))
      .map(j => ({
        ...j,
        clientName: j.clientName || (j.clientId ? clients.find(c => c.id === j.clientId)?.name : undefined),
      }));
  }, [completedJobs, selectedJobIds, clients]);

  const toggleJobSelection = useCallback((jobId: string) => {
    setSelectedJobIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }, []);

  const selectAllCompleted = useCallback(() => {
    const visibleCompletedIds = (sortedJobsRef.current || [])
      .filter(j => j.status === 'done')
      .map(j => j.id);
    setSelectedJobIds(new Set(visibleCompletedIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedJobIds(new Set());
  }, []);

  const toggleBatchMode = useCallback(() => {
    if (batchMode) {
      setSelectedJobIds(new Set());
    }
    setBatchMode(prev => !prev);
  }, [batchMode]);

  const handleBatchInvoice = useCallback(async () => {
    if (selectedJobIds.size === 0) return;
    setBatchProcessing(true);
    try {
      const response = await api.post<{ invoices: any[]; created: number; skipped: number; errors: string[] }>(
        '/api/invoices/batch',
        { jobIds: Array.from(selectedJobIds) }
      );
      if (response.error) {
        showToast({ type: 'error', message: response.error });
      } else {
        const data = response.data;
        const msg = data
          ? `${data.created} invoice${data.created !== 1 ? 's' : ''} created${data.skipped ? `, ${data.skipped} skipped` : ''}.`
          : 'Invoices created successfully.';
        showToast({ type: 'info', message: 'Batch Invoicing Complete', description: msg });
        setBatchMode(false);
        setSelectedJobIds(new Set());
        setBatchConfirmVisible(false);
        refreshDataRef.current?.();
      }
    } catch (err) {
      showToast({ type: 'error', message: 'Failed to create batch invoices. Please try again.' });
    } finally {
      setBatchProcessing(false);
    }
  }, [selectedJobIds]);

  // Sort indicator with stacked up/down chevrons (matching Documents page)
  const SortIndicator = ({ field, isActive }: { field: SortField; isActive: boolean }) => (
    <View style={styles.sortIndicator}>
      <Feather 
        name="chevron-up" 
        size={10} 
        color={isActive ? colors.primary : colors.mutedForeground} 
        style={{ marginBottom: -3 }}
      />
      <Feather 
        name="chevron-down" 
        size={10} 
        color={isActive ? colors.primary : colors.mutedForeground} 
        style={{ marginTop: -3 }}
      />
    </View>
  );

  const refreshData = useCallback(async () => {
    await Promise.all([fetchJobs(), fetchClients(), fetchSavedFilters(), fetchTeamMembers()]);
  }, [fetchJobs, fetchClients, fetchSavedFilters, fetchTeamMembers]);

  const refreshDataRef = useRef(refreshData);
  useEffect(() => { refreshDataRef.current = refreshData; }, [refreshData]);

  const handleQuickAction = useCallback(async (action: string, jobId: string) => {
    if (action === 'schedule') {
      router.push(`/job/${jobId}?action=schedule`);
    } else if (action === 'start') {
      Alert.alert(
        'Start Job',
        'Are you sure you want to start this job?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Start', 
            onPress: async () => {
              await updateJobStatus(jobId, 'in_progress');
              refreshData();
            }
          }
        ]
      );
    } else if (action === 'complete') {
      router.push(`/job/${jobId}?action=complete`);
    }
  }, [updateJobStatus, refreshData]);

  const handleDeleteJob = useCallback(async (jobId: string) => {
    try {
      const response = await api.delete(`/api/jobs/${jobId}`);
      if (response.error) {
        showToast({ type: 'error', message: 'Failed to delete job. Please try again.' });
        return;
      }
      refreshData();
    } catch (error) {
      showToast({ type: 'error', message: 'Failed to delete job. Please try again.' });
    }
  }, [refreshData]);

  const buildJobActions = useCallback((job: any): QuickAction[] => {
    const acts: QuickAction[] = [];
    acts.push({ icon: 'eye', label: 'View Details', primary: true, onPress: () => router.push(`/job/${job.id}`) });
    if (job.status === 'pending') {
      acts.push({ icon: 'calendar', label: 'Schedule Job', onPress: () => handleQuickAction('schedule', job.id) });
    }
    if (job.status === 'scheduled') {
      acts.push({ icon: 'play', label: 'Start Job', onPress: () => handleQuickAction('start', job.id) });
    }
    if (job.status === 'in_progress') {
      acts.push({ icon: 'check-circle', label: 'Complete Job', onPress: () => handleQuickAction('complete', job.id) });
    }
    if (canCreateQuotes && job.status !== 'invoiced') {
      acts.push({ icon: 'file-text', label: 'Create Quote', onPress: () => router.push(`/more/quote/new?jobId=${job.id}`) });
    }
    if (canCreateInvoices && job.status === 'done') {
      acts.push({ icon: 'file', label: 'Create Invoice', onPress: () => router.push(`/more/invoice/new?jobId=${job.id}`) });
    }
    if (canWriteJobs) {
      acts.push({
        icon: 'trash-2',
        label: 'Delete Job',
        destructive: true,
        onPress: async () => {
          const ok = await confirm({ title: 'Delete Job', message: `Delete "${job.title || 'Untitled Job'}"? This cannot be undone.`, confirmText: 'Delete', cancelText: 'Cancel', destructive: true });
          if (ok) {
            handleDeleteJob(job.id);
          }
        },
      });
    }
    return acts;
  }, [handleQuickAction, handleDeleteJob, canCreateQuotes, canCreateInvoices, canWriteJobs]);

  useEffect(() => {
    refreshData();
  }, []);

  // Refresh data when screen gains focus (syncs with web app)
  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

  const getClientName = (clientId?: string) => {
    if (!clientId) return undefined;
    const client = clients.find(c => c.id === clientId);
    return client?.name;
  };

  const statusCounts = useMemo(() => {
    const counts = {
      all: jobs.length,
      recurring: 0,
      pending: 0,
      scheduled: 0,
      in_progress: 0,
      done: 0,
      invoiced: 0,
    };
    
    jobs.forEach(job => {
      if (job.isRecurring) counts.recurring++;
      if (job.status === 'pending') counts.pending++;
      else if (job.status === 'scheduled') counts.scheduled++;
      else if (job.status === 'in_progress') counts.in_progress++;
      else if (job.status === 'done') counts.done++;
      else if (job.status === 'invoiced') counts.invoiced++;
    });
    
    return counts;
  }, [jobs]);

  const getFilteredJobs = () => {
    const searchLower = searchQuery.toLowerCase();
    const filterBySearch = (jobList: typeof jobs) => jobList.filter(job => 
      job.title.toLowerCase().includes(searchLower) ||
      (job.address?.toLowerCase().includes(searchLower)) ||
      (getClientName(job.clientId)?.toLowerCase().includes(searchLower))
    );

    let baseJobs = jobs;
    if (activeFilter === 'recurring') {
      baseJobs = jobs.filter(job => job.isRecurring);
    } else if (activeFilter !== 'all') {
      baseJobs = jobs.filter(job => job.status === activeFilter);
    }

    let filtered = filterBySearch(baseJobs);

    if (hasAdvancedFilters) {
      filtered = filtered.filter(job => {
        if (advancedFilters.statuses.length > 0 && !advancedFilters.statuses.includes(job.status)) return false;
        if (advancedFilters.dateFrom) {
          const from = new Date(advancedFilters.dateFrom);
          const d = (job as any).scheduledAt ? new Date((job as any).scheduledAt) : null;
          if (!d || d < from) return false;
        }
        if (advancedFilters.dateTo) {
          const to = new Date(advancedFilters.dateTo);
          to.setHours(23, 59, 59, 999);
          const d = (job as any).scheduledAt ? new Date((job as any).scheduledAt) : null;
          if (!d || d > to) return false;
        }
        if (advancedFilters.assignedTo && (job as any).assignedTo !== advancedFilters.assignedTo) return false;
        if (advancedFilters.clientId && job.clientId !== advancedFilters.clientId) return false;
        if (advancedFilters.suburb) {
          const lower = advancedFilters.suburb.toLowerCase();
          if (!(job.address || '').toLowerCase().includes(lower)) return false;
        }
        return true;
      });
    }

    return filtered;
  };

  const filteredJobs = getFilteredJobs();

  // Get the canonical date for a job (scheduled > completed > created)
  const getJobDate = (job: any): Date | null => {
    const dateStr = job.scheduledAt || job.completedAt || job.createdAt;
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  const sortedJobsRef = useRef<Job[]>([]);
  // Sort jobs based on current sort field and direction
  const sortedJobs = useMemo(() => {
    const jobsCopy = [...filteredJobs];
    
    // For grid view, use the original upcoming/past date-based sorting
    if (viewMode === 'grid') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const upcomingJobs: typeof jobsCopy = [];
      const pastJobs: typeof jobsCopy = [];
      
      jobsCopy.forEach(job => {
        const jobDate = getJobDate(job);
        if (!jobDate || jobDate < today) {
          pastJobs.push(job);
        } else {
          upcomingJobs.push(job);
        }
      });
      
      const sortAscending = (a: any, b: any) => {
        const dateA = getJobDate(a);
        const dateB = getJobDate(b);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.getTime() - dateB.getTime();
      };
      
      upcomingJobs.sort(sortAscending);
      pastJobs.sort(sortAscending);
      
      return [...upcomingJobs, ...pastJobs];
    }
    
    // For list view, use the selected sort field and direction
    return jobsCopy.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'title':
          comparison = (a.title || '').localeCompare(b.title || '');
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'date':
          const dateA = getJobDate(a);
          const dateB = getJobDate(b);
          if (!dateA && !dateB) comparison = 0;
          else if (!dateA) comparison = 1;
          else if (!dateB) comparison = -1;
          else comparison = dateA.getTime() - dateB.getTime();
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredJobs, viewMode, sortField, sortDirection]);

  useEffect(() => { sortedJobsRef.current = sortedJobs; }, [sortedJobs]);

  // Dynamic content container style for iPad-responsive padding
  const responsiveContentStyle = useMemo(() => ({
    paddingHorizontal: responsiveShell.paddingHorizontal,
    paddingTop: responsiveShell.paddingTop,
    paddingBottom: responsiveShell.paddingBottom + insets.bottom,
  }), [responsiveShell, insets.bottom]);

  const listHeaderComponent = useMemo(() => (
    <View>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Work</Text>
        <View style={styles.headerRight}>
          {completedJobs.length > 0 && (
            <TouchableOpacity
              style={[styles.headerIconBtn, batchMode && styles.headerIconBtnActive]}
              onPress={toggleBatchMode}
              activeOpacity={0.7}
            >
              <Feather name="check-square" size={20} color={batchMode ? colors.primaryForeground : colors.foreground} />
            </TouchableOpacity>
          )}
          <View style={styles.headerViewToggle}>
            <TouchableOpacity
              style={[styles.headerViewToggleBtn, viewMode === 'grid' && styles.headerViewToggleBtnActive]}
              onPress={() => setViewMode('grid')}
              activeOpacity={0.7}
            >
              <Feather name="grid" size={18} color={viewMode === 'grid' ? colors.primary : colors.foreground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerViewToggleBtn, viewMode === 'list' && styles.headerViewToggleBtnActive]}
              onPress={() => setViewMode('list')}
              activeOpacity={0.7}
            >
              <Feather name="list" size={18} color={viewMode === 'list' ? colors.primary : colors.foreground} />
            </TouchableOpacity>
          </View>
          {canWriteJobs && (
            <TouchableOpacity style={styles.headerAddIcon} onPress={navigateToCreateJob} activeOpacity={0.85}>
              <Feather name="plus" size={22} color={colors.primaryForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <Text style={styles.pageSubtitleInline}>{sortedJobs.length} {sortedJobs.length === 1 ? 'job' : 'jobs'} total</Text>

      <UsageLimitBanner />

      <View style={styles.searchRow}>
        <View style={[styles.searchBar, { flex: 1, marginBottom: 0 }]}>
          <Feather name="search" size={iconSizes.xl} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search jobs, clients, addresses..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity
          style={[styles.headerIconBtn, (advancedOpen || hasAdvancedFilters) && styles.headerIconBtnActive]}
          onPress={() => setAdvancedOpen(prev => !prev)}
          activeOpacity={0.7}
        >
          <Feather name="sliders" size={20} color={(advancedOpen || hasAdvancedFilters) ? colors.primaryForeground : colors.foreground} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {savedFilters.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: spacing.sm }}
          contentContainerStyle={{ gap: spacing.xs }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginRight: spacing.xs }}>
            <Feather name="bookmark" size={iconSizes.sm} color={colors.mutedForeground} />
            <Text style={{ ...typography.captionSmall, color: colors.mutedForeground }}>Saved:</Text>
          </View>
          {savedFilters.map((sf) => (
            <PressableRow
              key={sf.id}

              style={styles.savedFilterChip}
              onPress={() => handleLoadSavedFilter(sf)}
              onLongPress={() => handleDeleteSavedFilter(sf.id, sf.name)}
            >
              <Text style={styles.savedFilterChipText} numberOfLines={1}>{sf.name}</Text>
            </PressableRow>
          ))}
        </ScrollView>
      )}

      {advancedOpen && (
        <View style={styles.advancedPanel}>
          <View style={styles.advancedPanelHeader}>
            <Text style={styles.advancedPanelTitle}>Advanced Filters</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {hasAdvancedFilters && (
                <TouchableOpacity onPress={() => setSaveDialogOpen(true)} activeOpacity={0.7}>
                  <Feather name="save" size={iconSizes.md} color={colors.primary} />
                </TouchableOpacity>
              )}
              {hasAdvancedFilters && (
                <TouchableOpacity onPress={handleClearAdvanced} activeOpacity={0.7}>
                  <Text style={{ ...typography.captionSmall, color: colors.destructive }}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.advancedLabel}>Status</Text>
          <View style={styles.advancedStatusRow}>
            {(['pending', 'scheduled', 'in_progress', 'done', 'invoiced'] as const).map((s) => {
              const labels: Record<string, string> = { pending: 'Pending', scheduled: 'Scheduled', in_progress: 'In Progress', done: 'Completed', invoiced: 'Invoiced' };
              const isSelected = advancedFilters.statuses.includes(s);
              return (
                <PressableRow
                  key={s}

                  style={[styles.advancedStatusChip, isSelected && styles.advancedStatusChipActive]}
                  onPress={() => toggleStatus(s)}
                >
                  <Text style={[styles.advancedStatusChipText, isSelected && styles.advancedStatusChipTextActive]}>
                    {labels[s]}
                  </Text>
                </PressableRow>
              );
            })}
          </View>

          <Text style={styles.advancedLabel}>Date Range</Text>
          <View style={styles.advancedDateRow}>
            <PressableRow
              style={[styles.advancedDateInput, { flex: 1 }]}

              onPress={() => {
                const today = new Date().toISOString().split('T')[0];
                setAdvancedFilters(prev => ({ ...prev, dateFrom: prev.dateFrom ? '' : today }));
              }}
            >
              <Feather name="calendar" size={12} color={colors.mutedForeground} />
              <Text style={styles.advancedDateText} numberOfLines={1}>
                {advancedFilters.dateFrom || 'From'}
              </Text>
              {advancedFilters.dateFrom ? (
                <TouchableOpacity onPress={() => setAdvancedFilters(prev => ({ ...prev, dateFrom: '' }))}>
                  <Feather name="x" size={12} color={colors.mutedForeground} />
                </TouchableOpacity>
              ) : null}
            </PressableRow>
            <Text style={{ color: colors.mutedForeground }}>-</Text>
            <PressableRow
              style={[styles.advancedDateInput, { flex: 1 }]}

              onPress={() => {
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                setAdvancedFilters(prev => ({ ...prev, dateTo: prev.dateTo ? '' : nextWeek.toISOString().split('T')[0] }));
              }}
            >
              <Feather name="calendar" size={12} color={colors.mutedForeground} />
              <Text style={styles.advancedDateText} numberOfLines={1}>
                {advancedFilters.dateTo || 'To'}
              </Text>
              {advancedFilters.dateTo ? (
                <TouchableOpacity onPress={() => setAdvancedFilters(prev => ({ ...prev, dateTo: '' }))}>
                  <Feather name="x" size={12} color={colors.mutedForeground} />
                </TouchableOpacity>
              ) : null}
            </PressableRow>
          </View>

          <Text style={styles.advancedLabel}>Assigned To</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              <PressableRow
                style={[styles.advancedStatusChip, !advancedFilters.assignedTo && styles.advancedStatusChipActive]}

                onPress={() => setAdvancedFilters(prev => ({ ...prev, assignedTo: '' }))}
              >
                <Text style={[styles.advancedStatusChipText, !advancedFilters.assignedTo && styles.advancedStatusChipTextActive]}>All</Text>
              </PressableRow>
              {teamMembers.map((m: any) => (
                <PressableRow
                  key={m.id}
                  style={[styles.advancedStatusChip, advancedFilters.assignedTo === m.id && styles.advancedStatusChipActive]}

                  onPress={() => setAdvancedFilters(prev => ({ ...prev, assignedTo: prev.assignedTo === m.id ? '' : m.id }))}
                >
                  <Text style={[styles.advancedStatusChipText, advancedFilters.assignedTo === m.id && styles.advancedStatusChipTextActive]} numberOfLines={1}>
                    {m.name || m.email || 'Unnamed'}
                  </Text>
                </PressableRow>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.advancedLabel}>Client</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              <PressableRow
                style={[styles.advancedStatusChip, !advancedFilters.clientId && styles.advancedStatusChipActive]}

                onPress={() => setAdvancedFilters(prev => ({ ...prev, clientId: '' }))}
              >
                <Text style={[styles.advancedStatusChipText, !advancedFilters.clientId && styles.advancedStatusChipTextActive]}>All</Text>
              </PressableRow>
              {clients.map((c: any) => (
                <PressableRow
                  key={c.id}
                  style={[styles.advancedStatusChip, advancedFilters.clientId === c.id && styles.advancedStatusChipActive]}

                  onPress={() => setAdvancedFilters(prev => ({ ...prev, clientId: prev.clientId === c.id ? '' : c.id }))}
                >
                  <Text style={[styles.advancedStatusChipText, advancedFilters.clientId === c.id && styles.advancedStatusChipTextActive]} numberOfLines={1}>
                    {c.name || 'Unnamed'}
                  </Text>
                </PressableRow>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.advancedLabel}>Address / Suburb</Text>
          <View style={styles.advancedSuburbInput}>
            <TextInput
              style={styles.advancedSuburbTextInput}
              placeholder="e.g. Richmond, NSW..."
              placeholderTextColor={colors.mutedForeground}
              value={advancedFilters.suburb}
              onChangeText={(text) => setAdvancedFilters(prev => ({ ...prev, suburb: text }))}
            />
            {advancedFilters.suburb ? (
              <TouchableOpacity onPress={() => setAdvancedFilters(prev => ({ ...prev, suburb: '' }))}>
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : null}
          </View>

          {hasAdvancedFilters && (
            <View style={styles.advancedActiveFilters}>
              {advancedFilters.statuses.map((s) => {
                const labels: Record<string, string> = { pending: 'Pending', scheduled: 'Scheduled', in_progress: 'In Progress', done: 'Completed', invoiced: 'Invoiced' };
                return (
                  <View key={s} style={styles.activeFilterTag}>
                    <Text style={styles.activeFilterTagText}>{labels[s] || s}</Text>
                    <TouchableOpacity onPress={() => toggleStatus(s)}>
                      <Feather name="x" size={10} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                );
              })}
              {advancedFilters.dateFrom ? (
                <View style={styles.activeFilterTag}>
                  <Text style={styles.activeFilterTagText}>From: {advancedFilters.dateFrom}</Text>
                  <TouchableOpacity onPress={() => setAdvancedFilters(prev => ({ ...prev, dateFrom: '' }))}>
                    <Feather name="x" size={10} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ) : null}
              {advancedFilters.dateTo ? (
                <View style={styles.activeFilterTag}>
                  <Text style={styles.activeFilterTagText}>To: {advancedFilters.dateTo}</Text>
                  <TouchableOpacity onPress={() => setAdvancedFilters(prev => ({ ...prev, dateTo: '' }))}>
                    <Feather name="x" size={10} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ) : null}
              {advancedFilters.assignedTo ? (
                <View style={styles.activeFilterTag}>
                  <Text style={styles.activeFilterTagText}>
                    Assigned: {teamMembers.find(m => m.id === advancedFilters.assignedTo)?.name || 'Team member'}
                  </Text>
                  <TouchableOpacity onPress={() => setAdvancedFilters(prev => ({ ...prev, assignedTo: '' }))}>
                    <Feather name="x" size={10} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ) : null}
              {advancedFilters.clientId ? (
                <View style={styles.activeFilterTag}>
                  <Text style={styles.activeFilterTagText}>
                    Client: {clients.find((c: any) => c.id === advancedFilters.clientId)?.name || 'Client'}
                  </Text>
                  <TouchableOpacity onPress={() => setAdvancedFilters(prev => ({ ...prev, clientId: '' }))}>
                    <Feather name="x" size={10} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ) : null}
              {advancedFilters.suburb ? (
                <View style={styles.activeFilterTag}>
                  <Text style={styles.activeFilterTagText}>Suburb: {advancedFilters.suburb}</Text>
                  <TouchableOpacity onPress={() => setAdvancedFilters(prev => ({ ...prev, suburb: '' }))}>
                    <Feather name="x" size={10} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}
        </View>
      )}

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {STATUS_FILTERS.map((filter) => {
          const count = statusCounts[filter.key as keyof typeof statusCounts] || 0;
          const isActive = activeFilter === filter.key;
          
          return (
            <TouchableOpacity
              key={filter.key}
              onPress={() => setActiveFilter(filter.key)}
              activeOpacity={0.7}
              style={[
                styles.filterPill,
                isActive && styles.filterPillActive
              ]}
            >
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
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.kpiGrid}>
        <TouchableOpacity 
          style={styles.kpiCard} 
          onPress={() => setActiveFilter('all')}
          activeOpacity={0.8}
        >
          <View style={[styles.kpiIcon, { backgroundColor: colors.muted }]}>
            <Feather name="briefcase" size={iconSizes.lg} color={colors.primary} />
          </View>
          <View>
            <Text style={styles.kpiValue}>{statusCounts.all}</Text>
            <Text style={styles.kpiLabel}>Total Jobs</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.kpiCard} 
          onPress={() => setActiveFilter('scheduled')}
          activeOpacity={0.8}
        >
          <View style={[styles.kpiIcon, { backgroundColor: colors.muted }]}>
            <Feather name="calendar" size={iconSizes.lg} color={colors.scheduled} />
          </View>
          <View>
            <Text style={styles.kpiValue}>{statusCounts.scheduled}</Text>
            <Text style={styles.kpiLabel}>Scheduled</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.kpiCard} 
          onPress={() => setActiveFilter('in_progress')}
          activeOpacity={0.8}
        >
          <View style={[styles.kpiIcon, { backgroundColor: colors.muted }]}>
            <Feather name="play" size={iconSizes.lg} color={colors.inProgress} />
          </View>
          <View>
            <Text style={styles.kpiValue}>{statusCounts.in_progress}</Text>
            <Text style={styles.kpiLabel}>In Progress</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.kpiCard} 
          onPress={() => setActiveFilter('done')}
          activeOpacity={0.8}
        >
          <View style={[styles.kpiIcon, { backgroundColor: colors.muted }]}>
            <Feather name="check-circle" size={iconSizes.lg} color={colors.done} />
          </View>
          <View>
            <Text style={styles.kpiValue}>{statusCounts.done}</Text>
            <Text style={styles.kpiLabel}>Completed</Text>
          </View>
        </TouchableOpacity>
      </View>

      {batchMode && (
        <View style={styles.batchBar}>
          <View style={styles.batchBarLeft}>
            <TouchableOpacity onPress={selectedJobIds.size > 0 ? clearSelection : selectAllCompleted} activeOpacity={0.7}>
              <Feather
                name={selectedJobIds.size > 0 ? 'check-square' : 'square'}
                size={iconSizes.xl}
                color={selectedJobIds.size > 0 ? colors.primary : colors.mutedForeground}
              />
            </TouchableOpacity>
            <Text style={styles.batchBarText}>
              {selectedJobIds.size > 0
                ? `${selectedJobIds.size} completed job${selectedJobIds.size !== 1 ? 's' : ''} selected`
                : 'Select completed jobs to invoice'}
            </Text>
          </View>
          <View style={styles.batchBarRight}>
            {selectedJobIds.size > 0 && (
              <Button
                size="sm"
                variant="default"
                icon={<Feather name="file-text" size={iconSizes.sm} color={colors.primaryForeground} />}
                onPress={() => setBatchConfirmVisible(true)}
              >
                Create Invoices
              </Button>
            )}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name="briefcase" size={iconSizes.md} color={colors.primary} />
          <Text style={styles.sectionTitle}>ALL JOBS</Text>
        </View>
      </View>

      {viewMode === 'list' && sortedJobs.length > 0 && (
        <View style={styles.listHeader}>
          <TouchableOpacity
            style={styles.sortHeaderTitleColumn}
            onPress={() => handleSortChange('title')}
            activeOpacity={0.7}
          >
            <Text style={[styles.listHeaderCol, sortField === 'title' && styles.listHeaderColActive]}>Job</Text>
            <SortIndicator field="title" isActive={sortField === 'title'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortHeaderStatusColumn, { width: 80 }]}
            onPress={() => handleSortChange('status')}
            activeOpacity={0.7}
          >
            <Text style={[styles.listHeaderCol, styles.listHeaderColStatus, sortField === 'status' && styles.listHeaderColActive]}>Status</Text>
            <SortIndicator field="status" isActive={sortField === 'status'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortHeaderDateColumn, { width: 70 }]}
            onPress={() => handleSortChange('date')}
            activeOpacity={0.7}
          >
            <Text style={[styles.listHeaderCol, styles.listHeaderColDate, sortField === 'date' && styles.listHeaderColActive]}>Date</Text>
            <SortIndicator field="date" isActive={sortField === 'date'} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  ), [jobs.length, viewMode, searchQuery, activeFilter, statusCounts, colors, styles, sortField, sortDirection, sortedJobs.length, advancedOpen, advancedFilters, hasAdvancedFilters, activeFilterCount, savedFilters, teamMembers, clients, saveDialogOpen, batchMode, selectedJobIds.size, completedJobs.length]);

  const listEmptyComponent = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyStateIcon}>
          <Feather name="briefcase" size={iconSizes['4xl']} color={colors.mutedForeground} />
        </View>
        <Text style={styles.emptyStateTitle}>No jobs found</Text>
        <Text style={styles.emptyStateSubtitle}>
          {searchQuery || activeFilter !== 'all' || hasAdvancedFilters
            ? 'Try adjusting your search or filters'
            : 'Create your first job to get started'}
        </Text>
      </View>
    );
  }, [isLoading, searchQuery, activeFilter, hasAdvancedFilters, colors, styles]);

  const renderItem = useCallback(({ item: job }: { item: any }) => {
    const jobWithClient = { ...job, clientName: job.clientName || getClientName(job.clientId) };
    const isCompleted = job.status === 'done';
    const isSelected = selectedJobIds.has(job.id);

    const handlePress = () => {
      if (batchMode && isCompleted) {
        toggleJobSelection(job.id);
      } else {
        router.push(`/job/${job.id}`);
      }
    };

    if (viewMode === 'grid') {
      return (
        <View style={{ position: 'relative' }}>
          {batchMode && isCompleted && (
            <TouchableOpacity
              style={[
                styles.batchCheckbox,
                isSelected && styles.batchCheckboxSelected,
              ]}
              onPress={() => toggleJobSelection(job.id)}
              activeOpacity={0.7}
            >
              {isSelected && <Feather name="check" size={14} color={colors.primaryForeground} />}
            </TouchableOpacity>
          )}
          <JobCard
            job={jobWithClient}
            onPress={handlePress}
            onQuickAction={handleQuickAction}
            onShowActionSheet={setActionSheetJob}
            canCreateInvoices={canCreateInvoices}
          />
        </View>
      );
    }
    return (
      <View style={{ marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {batchMode && isCompleted && (
          <TouchableOpacity
            style={[
              styles.batchCheckboxInline,
              isSelected && styles.batchCheckboxSelected,
            ]}
            onPress={() => toggleJobSelection(job.id)}
            activeOpacity={0.7}
          >
            {isSelected && <Feather name="check" size={14} color={colors.white} />}
          </TouchableOpacity>
        )}
        {batchMode && !isCompleted && (
          <View style={styles.batchCheckboxPlaceholder} />
        )}
        <View style={{ flex: 1 }}>
          <JobListRow
            job={jobWithClient}
            onPress={handlePress}
            onDelete={handleDeleteJob}
            onQuickAction={handleQuickAction}
            onShowActionSheet={setActionSheetJob}
          />
        </View>
      </View>
    );
  }, [viewMode, handleQuickAction, handleDeleteJob, clients, batchMode, selectedJobIds, toggleJobSelection]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <FlatList
        ref={scrollRef}
        key={viewMode}
        data={sortedJobs}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? styles.jobsGrid : undefined}
        ListHeaderComponent={listHeaderComponent}
        ListEmptyComponent={listEmptyComponent}
        style={styles.scrollView}
        contentContainerStyle={responsiveContentStyle}
        showsVerticalScrollIndicator={false}
        onScroll={preserveOnScroll}
        scrollEventThrottle={scrollEventThrottle}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshData}
            tintColor={colors.primary}
          />
        }
      />

      <QuickActionSheet
        visible={actionSheetJob !== null}
        onClose={() => setActionSheetJob(null)}
        title={actionSheetJob?.title || 'Untitled Job'}
        subtitle={actionSheetJob?.address?.split(',')[0]}
        actions={actionSheetJob ? buildJobActions(actionSheetJob) : []}
      />

      <Modal
        visible={saveDialogOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveDialogOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setSaveDialogOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Save Filter</Text>
                <Text style={styles.modalSubtitle}>Name this filter combination to quickly recall it later.</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. This week's scheduled jobs"
                  placeholderTextColor={colors.mutedForeground}
                  value={saveFilterName}
                  onChangeText={setSaveFilterName}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveFilter}
                />
                <View style={styles.modalActions}>
                  <View style={{ flex: 1 }}>
                    <Button variant="outline" onPress={() => setSaveDialogOpen(false)} fullWidth>
                      Cancel
                    </Button>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      variant="default"
                      onPress={handleSaveFilter}
                      disabled={!saveFilterName.trim() || savingFilter}
                      loading={savingFilter}
                      fullWidth
                    >
                      Save Filter
                    </Button>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={batchConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBatchConfirmVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => !batchProcessing && setBatchConfirmVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                  <View style={{ width: 40, height: 40, borderRadius: radius.lg, backgroundColor: colorWithOpacity(colors.primary, 0.12), alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="file-text" size={iconSizes.xl} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>Create Batch Invoices</Text>
                    <Text style={{ ...typography.caption, color: colors.mutedForeground }}>
                      {selectedJobIds.size} completed job{selectedJobIds.size !== 1 ? 's' : ''} selected
                    </Text>
                  </View>
                </View>

                <View style={{ backgroundColor: colors.muted, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, maxHeight: 200 }}>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {selectedJobsList.map((job, idx) => (
                      <View key={job.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs, borderBottomWidth: idx < selectedJobsList.length - 1 ? 1 : 0, borderBottomColor: colors.cardBorder }}>
                        <View style={{ flex: 1, marginRight: spacing.sm }}>
                          <Text style={{ ...typography.body, fontWeight: fontWeights.medium, color: colors.foreground }} numberOfLines={1}>{job.title || 'Untitled Job'}</Text>
                          {job.clientName && <Text style={{ ...typography.captionSmall, color: colors.mutedForeground }} numberOfLines={1}>{job.clientName}</Text>}
                        </View>
                        <StatusBadge status="done" size="sm" />
                      </View>
                    ))}
                  </ScrollView>
                </View>

                <Text style={{ ...typography.caption, color: colors.mutedForeground, marginBottom: spacing.lg }}>
                  An invoice will be created for each selected job. Jobs that already have invoices will be skipped.
                </Text>

                <View style={styles.modalActions}>
                  <View style={{ flex: 1 }}>
                    <Button variant="outline" onPress={() => setBatchConfirmVisible(false)} disabled={batchProcessing} fullWidth>
                      Cancel
                    </Button>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button variant="default" onPress={handleBatchInvoice} disabled={batchProcessing} loading={batchProcessing} fullWidth>
                      {`Create ${selectedJobIds.size} Invoice${selectedJobIds.size !== 1 ? 's' : ''}`}
                    </Button>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors, contentWidth: number, horizontalPadding: number = pageShell.paddingHorizontal) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: horizontalPadding,
    paddingTop: pageShell.paddingTop,
    paddingBottom: pageShell.paddingBottom,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginBottom: 4,
    gap: spacing.sm,
  },
  pageSubtitleInline: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  subHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.muted,
  },
  countDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  countChipText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    padding: 2,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerIconBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  headerViewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    height: 40,
  },
  headerViewToggleBtn: {
    width: 34,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  headerViewToggleBtnActive: {
    backgroundColor: `${colors.primary}15`,
  },
  viewToggleBtn: {
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  viewToggleBtnActive: {
    backgroundColor: colors.card,
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
  headerAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 40,
  },
  headerAddIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAddButtonText: {
    color: colors.white,
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
  },
  newJobButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
    ...shadows.md,
  },
  newJobButtonText: {
    color: colors.primaryForeground,
    ...typography.caption,
    fontWeight: fontWeights.semibold,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
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
    letterSpacing: 0,
    textAlign: 'left',
    padding: 0,
  },
  advancedFilterBtn: {
    width: sizes.searchBarHeight,
    height: sizes.searchBarHeight,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advancedFilterBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.destructive,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.white,
  },
  savedFilterChip: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  savedFilterChipText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.medium,
    color: colors.primary,
  },
  advancedPanel: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  advancedPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  advancedPanelTitle: {
    ...typography.bodySemibold,
    color: colors.foreground,
  },
  advancedLabel: {
    ...typography.captionSmall,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  advancedStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  advancedStatusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.background,
  },
  advancedStatusChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  advancedStatusChipText: {
    ...typography.captionSmall,
    color: colors.foreground,
  },
  advancedStatusChipTextActive: {
    color: colors.primaryForeground,
  },
  advancedDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  advancedDateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  advancedDateText: {
    ...typography.captionSmall,
    color: colors.foreground,
    flex: 1,
  },
  advancedSuburbInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : 0,
    marginBottom: spacing.sm,
  },
  advancedSuburbTextInput: {
    flex: 1,
    ...typography.captionSmall,
    color: colors.foreground,
  },
  advancedActiveFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  activeFilterTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    gap: spacing.xs,
  },
  activeFilterTagText: {
    ...typography.captionSmall,
    color: colors.foreground,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...shadows.lg,
  },
  modalTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.foreground,
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  modalCancelBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  modalCancelText: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  modalSaveBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  modalSaveText: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },

  filtersScroll: {
    marginBottom: spacing.md,
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
    minHeight: sizes.filterChipHeight,
    borderRadius: radius.xl,
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
    ...typography.caption,
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
    ...typography.captionSmall,
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

  jobsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  jobsList: {
    gap: spacing.sm,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  listHeaderCol: {
    flex: 1,
    ...typography.captionSmall,
    color: colors.mutedForeground,
    fontWeight: fontWeights.semibold,
  },
  listHeaderColStatus: {
    textAlign: 'center',
    flex: 0,
    width: 80,
  },
  listHeaderColDate: {
    textAlign: 'right',
    flex: 0,
    width: 70,
  },
  listHeaderColActive: {
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
  sortHeaderDateColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  jobListRow: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  jobListRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  jobListRowLeft: {
    flex: 1,
    minWidth: 0,
  },
  jobListRowCenter: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobListRowTitle: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: 2,
  },
  jobListRowAddress: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  jobListRowDate: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    width: 70,
    textAlign: 'right',
  },
  jobListRowAction: {
    padding: spacing.xs,
  },
  jobCard: {
    width: (contentWidth - horizontalPadding * 2 - spacing.sm) / 2,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.md,
  },
  jobCardAccent: {
    display: 'none',
  },
  jobCardContent: {
    padding: spacing.md,
  },
  jobCardStatusRow: {
    marginBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    gap: 3,
  },
  recurringBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  nextRecurrenceText: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontWeight: fontWeights.medium,
    marginBottom: spacing.xs,
  },
  jobTitle: {
    ...typography.bodySemibold,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  jobCardDetails: {
    gap: spacing.xs,
  },
  jobDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  jobDetailText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    flex: 1,
  },
  invoiceBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
  },
  invoiceBtnText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },

  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    gap: 4,
  },
  urgencyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  urgencyBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
  },
  moreButton: {
    marginLeft: 'auto',
    padding: spacing.xs,
  },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  kpiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
    width: '48%',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.md,
  },
  kpiIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  kpiLabel: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
  },

  batchToggleBtn: {
    width: sizes.searchBarHeight,
    height: sizes.searchBarHeight,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  batchToggleBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  batchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colorWithOpacity(colors.primary, 0.08),
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colorWithOpacity(colors.primary, 0.2),
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  batchBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  batchBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batchBarText: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: fontWeights.medium,
    flex: 1,
  },
  batchInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  batchInvoiceBtnText: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  batchCheckbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    zIndex: 10,
  },
  batchCheckboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  batchCheckboxInline: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  batchCheckboxPlaceholder: {
    width: 24,
    height: 24,
  },
});
