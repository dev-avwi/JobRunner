import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Modal,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes, fontWeights } from '../../src/lib/design-tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';

type RecurrencePattern = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';
type RecurringJobStatus = 'active' | 'paused' | 'completed' | 'cancelled';
type FilterType = 'all' | 'active' | 'paused' | 'completed';

interface RecurringJob {
  id: string;
  title: string;
  description?: string;
  clientId?: string;
  clientName?: string;
  address?: string;
  status: string;
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  recurrenceInterval?: number;
  recurrenceStatus?: RecurringJobStatus;
  nextRecurrenceDate?: string;
  recurrenceEndDate?: string;
  lastGeneratedAt?: string;
  scheduledAt?: string;
  createdAt?: string;
}

interface JobListItem {
  id: string;
  title: string;
  clientName?: string;
  status: string;
  isRecurring?: boolean;
}

const RECURRENCE_OPTIONS: { value: RecurrencePattern; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'Not set';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatRelativeDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return `In ${diffDays} days`;
  return formatDate(dateStr);
};

const getPatternLabel = (pattern?: RecurrencePattern): string => {
  switch (pattern) {
    case 'weekly': return 'Weekly';
    case 'fortnightly': return 'Fortnightly';
    case 'monthly': return 'Monthly';
    case 'quarterly': return 'Quarterly';
    case 'yearly': return 'Yearly';
    default: return 'Unknown';
  }
};

const getPatternIcon = (pattern?: RecurrencePattern): keyof typeof Feather.glyphMap => {
  switch (pattern) {
    case 'weekly': return 'calendar';
    case 'fortnightly': return 'calendar';
    case 'monthly': return 'calendar';
    case 'quarterly': return 'calendar';
    case 'yearly': return 'calendar';
    default: return 'repeat';
  }
};

const getStatusConfig = (status?: RecurringJobStatus, colors?: ThemeColors) => {
  const c = colors;
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        color: c?.success || '#22c55e',
        bgColor: c?.successLight || 'rgba(34,197,94,0.1)',
        icon: 'play-circle' as const,
      };
    case 'paused':
      return {
        label: 'Paused',
        color: c?.warning || '#f59e0b',
        bgColor: c?.warningLight || 'rgba(245,158,11,0.1)',
        icon: 'pause-circle' as const,
      };
    case 'completed':
      return {
        label: 'Completed',
        color: c?.mutedForeground || '#6b7280',
        bgColor: 'rgba(107,114,128,0.1)',
        icon: 'check-circle' as const,
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        color: c?.destructive || '#ef4444',
        bgColor: c?.destructiveLight || 'rgba(239,68,68,0.1)',
        icon: 'x-circle' as const,
      };
    default:
      return {
        label: 'Active',
        color: c?.success || '#22c55e',
        bgColor: c?.successLight || 'rgba(34,197,94,0.1)',
        icon: 'play-circle' as const,
      };
  }
};

function createStyles(colors: ThemeColors, bottomNavHeight: number = 0) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
    },
    scrollContent: {
      paddingHorizontal: pageShell.paddingHorizontal,
      paddingTop: pageShell.paddingTop,
      paddingBottom: bottomNavHeight,
    },
    statsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.xs,
    },
    statIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    statValue: {
      ...typography.cardTitle,
      color: colors.foreground,
    },
    statLabel: {
      ...typography.label,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    filterScroll: {
      marginBottom: spacing.lg,
    },
    filterContainer: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      height: sizes.filterChipHeight,
      borderRadius: radius.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
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
      minWidth: sizes.filterCountMin,
      height: sizes.filterCountMin,
      borderRadius: sizes.filterCountMin / 2,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    activeFilterBadge: {
      backgroundColor: 'rgba(255,255,255,0.25)',
    },
    filterBadgeText: {
      ...typography.badge,
      color: colors.mutedForeground,
    },
    activeFilterBadgeText: {
      color: colors.primaryForeground,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.xs,
    },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    cardTitleRow: {
      flex: 1,
      gap: 2,
    },
    cardTitle: {
      ...typography.bodySemibold,
      color: colors.foreground,
    },
    cardClient: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    statusBadgeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusBadgeText: {
      ...typography.badge,
    },
    cardInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: 4,
    },
    cardInfoText: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    cardInfoHighlight: {
      ...typography.caption,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    cardDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.sm,
    },
    cardActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
      flexWrap: 'wrap',
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.muted,
      minWidth: 70,
    },
    actionButtonPrimary: {
      backgroundColor: colors.primaryLight,
    },
    actionButtonDestructive: {
      backgroundColor: colors.destructiveLight || 'rgba(239,68,68,0.1)',
    },
    actionButtonText: {
      ...typography.caption,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    actionButtonTextPrimary: {
      color: colors.primary,
    },
    actionButtonTextDestructive: {
      color: colors.destructive,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing['3xl'],
      paddingHorizontal: spacing.xl,
    },
    emptyIcon: {
      width: sizes.emptyIcon,
      height: sizes.emptyIcon,
      borderRadius: sizes.emptyIcon / 2,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    emptyTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
      marginBottom: spacing.sm,
    },
    emptySubtitle: {
      ...typography.caption,
      color: colors.mutedForeground,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    emptyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      marginBottom: spacing.sm,
    },
    emptyButtonText: {
      ...typography.button,
      color: colors.primaryForeground,
    },
    emptyButtonSecondary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.muted,
    },
    emptyButtonSecondaryText: {
      ...typography.button,
      color: colors.foreground,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing['4xl'],
    },
    loadingText: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: spacing.sm,
    },
    errorContainer: {
      alignItems: 'center',
      paddingVertical: spacing['3xl'],
      paddingHorizontal: spacing.xl,
    },
    errorText: {
      ...typography.body,
      color: colors.destructive,
      textAlign: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    retryButton: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
    },
    retryButtonText: {
      ...typography.button,
      color: colors.primaryForeground,
    },
    nextRunCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primaryLight,
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      marginTop: spacing.xs,
    },
    nextRunText: {
      ...typography.caption,
      fontWeight: fontWeights.semibold,
      color: colors.primary,
    },
    overdueCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.destructiveLight || 'rgba(239,68,68,0.1)',
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      marginTop: spacing.xs,
    },
    overdueText: {
      ...typography.caption,
      fontWeight: fontWeights.semibold,
      color: colors.destructive,
    },
    fab: {
      position: 'absolute',
      bottom: spacing.xl,
      right: spacing.xl,
      width: sizes.fabSize,
      height: sizes.fabSize,
      borderRadius: sizes.fabSize / 2,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.md,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radius['2xl'],
      borderTopRightRadius: radius['2xl'],
      paddingTop: spacing.lg,
      paddingBottom: Platform.OS === 'ios' ? 40 : spacing.xl,
      maxHeight: '80%',
    },
    modalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    modalTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
      flex: 1,
    },
    modalBody: {
      paddingHorizontal: spacing.lg,
    },
    modalLabel: {
      ...typography.caption,
      fontWeight: fontWeights.semibold,
      color: colors.mutedForeground,
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },
    modalOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.background,
      marginBottom: spacing.xs,
      gap: spacing.sm,
    },
    modalOptionRowSelected: {
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    modalOptionText: {
      ...typography.body,
      color: colors.foreground,
      flex: 1,
    },
    modalOptionTextSelected: {
      color: colors.primary,
      fontWeight: fontWeights.semibold,
    },
    modalInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      ...typography.body,
      color: colors.foreground,
    },
    modalSaveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      marginTop: spacing.xl,
    },
    modalSaveButtonText: {
      ...typography.button,
      color: colors.primaryForeground,
    },
    modalCancelButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.muted,
      marginTop: spacing.sm,
    },
    modalCancelButtonText: {
      ...typography.button,
      color: colors.foreground,
    },
    searchInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      ...typography.body,
      color: colors.foreground,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    jobPickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    jobPickerItemInfo: {
      flex: 1,
    },
    jobPickerItemTitle: {
      ...typography.bodySemibold,
      color: colors.foreground,
    },
    jobPickerItemSub: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    jobPickerEmptyText: {
      ...typography.body,
      color: colors.mutedForeground,
      textAlign: 'center',
      paddingVertical: spacing['3xl'],
    },
    intervalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    intervalInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      ...typography.body,
      color: colors.foreground,
      width: 70,
      textAlign: 'center',
    },
    intervalLabel: {
      ...typography.body,
      color: colors.mutedForeground,
    },
    pauseToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.background,
      gap: spacing.sm,
    },
    pauseToggleLabel: {
      ...typography.body,
      color: colors.foreground,
      flex: 1,
    },
    pauseToggleDescription: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    toggleTrack: {
      width: 48,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      paddingHorizontal: 2,
    },
    toggleTrackActive: {
      backgroundColor: colors.warning,
    },
    toggleTrackInactive: {
      backgroundColor: colors.muted,
    },
    toggleThumb: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.white,
      ...shadows.sm,
    },
    fabMenuOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.3)',
    },
    fabMenuContainer: {
      position: 'absolute',
      bottom: spacing.xl + sizes.fabSize + spacing.md,
      right: spacing.xl,
      gap: spacing.sm,
      alignItems: 'flex-end',
    },
    fabMenuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.md,
    },
    fabMenuItemText: {
      ...typography.bodySemibold,
      color: colors.foreground,
    },
    fabMenuItemIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

export default function RecurringJobsScreen() {
  const { colors } = useTheme();
  const confirm = useConfirmDialog();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);

  const [recurringJobs, setRecurringJobs] = useState<RecurringJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingJob, setEditingJob] = useState<RecurringJob | null>(null);
  const [editPattern, setEditPattern] = useState<RecurrencePattern>('monthly');
  const [editInterval, setEditInterval] = useState('1');
  const [editEndDate, setEditEndDate] = useState('');
  const [editPaused, setEditPaused] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const [fabMenuVisible, setFabMenuVisible] = useState(false);

  const [jobPickerVisible, setJobPickerVisible] = useState(false);
  const [allJobs, setAllJobs] = useState<JobListItem[]>([]);
  const [jobSearch, setJobSearch] = useState('');
  const [jobsLoading, setJobsLoading] = useState(false);
  const [convertingJobId, setConvertingJobId] = useState<string | null>(null);

  const fetchRecurringJobs = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get<RecurringJob[]>('/api/recurring/jobs');
      if (res.error) {
        setError(res.error);
      } else {
        setRecurringJobs(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      setError('Failed to load recurring jobs');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRecurringJobs();
  }, [fetchRecurringJobs]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRecurringJobs();
  }, [fetchRecurringJobs]);

  const filteredJobs = useMemo(() => {
    if (activeFilter === 'all') return recurringJobs;
    return recurringJobs.filter((j) => {
      const status = j.recurrenceStatus || 'active';
      return status === activeFilter;
    });
  }, [recurringJobs, activeFilter]);

  const filterCounts = useMemo(() => ({
    all: recurringJobs.length,
    active: recurringJobs.filter((j) => (j.recurrenceStatus || 'active') === 'active').length,
    paused: recurringJobs.filter((j) => j.recurrenceStatus === 'paused').length,
    completed: recurringJobs.filter((j) => j.recurrenceStatus === 'completed').length,
  }), [recurringJobs]);

  const handleCreateRecurringJob = () => {
    router.push('/more/create-job?recurring=true');
  };

  const handleEditRecurrence = (job: RecurringJob) => {
    setEditingJob(job);
    setEditPattern(job.recurrencePattern || 'monthly');
    setEditInterval(String(job.recurrenceInterval || 1));
    setEditEndDate(job.recurrenceEndDate || '');
    setEditPaused((job.recurrenceStatus || 'active') === 'paused');
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editingJob) return;
    setEditSaving(true);
    try {
      const body: Record<string, any> = {
        recurrencePattern: editPattern,
        recurrenceInterval: parseInt(editInterval, 10) || 1,
        recurrenceStatus: editPaused ? 'paused' : 'active',
      };
      if (editEndDate) {
        body.recurrenceEndDate = editEndDate;
      } else {
        body.recurrenceEndDate = null;
      }
      const res = await api.patch(`/api/jobs/${editingJob.id}`, body);
      if (res.error) {
        Alert.alert('Error', res.error);
      } else {
        setEditModalVisible(false);
        setEditingJob(null);
        fetchRecurringJobs();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to update recurrence settings.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleOpenJobPicker = async () => {
    setJobPickerVisible(true);
    setJobSearch('');
    setJobsLoading(true);
    try {
      const res = await api.get<JobListItem[]>('/api/jobs');
      if (res.data) {
        const nonRecurring = (Array.isArray(res.data) ? res.data : []).filter((j) => !j.isRecurring);
        setAllJobs(nonRecurring);
      }
    } catch (err) {
      setAllJobs([]);
    } finally {
      setJobsLoading(false);
    }
  };

  const handleConvertJob = async (job: JobListItem) => {
    Alert.alert(
      'Convert to Recurring',
      `Make "${job.title}" a recurring job? This will enable monthly recurrence by default.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Convert',
          onPress: async () => {
            setConvertingJobId(job.id);
            try {
              const res = await api.patch(`/api/jobs/${job.id}`, {
                isRecurring: true,
                recurrencePattern: 'monthly',
                recurrenceInterval: 1,
                recurrenceStatus: 'active',
              });
              if (res.error) {
                Alert.alert('Error', res.error);
              } else {
                setJobPickerVisible(false);
                Alert.alert('Success', `"${job.title}" is now a recurring job.`);
                fetchRecurringJobs();
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to convert job.');
            } finally {
              setConvertingJobId(null);
            }
          },
        },
      ]
    );
  };

  const filteredPickerJobs = useMemo(() => {
    if (!jobSearch.trim()) return allJobs;
    const q = jobSearch.toLowerCase();
    return allJobs.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        (j.clientName && j.clientName.toLowerCase().includes(q))
    );
  }, [allJobs, jobSearch]);

  const handlePauseResume = async (job: RecurringJob) => {
    const currentStatus = job.recurrenceStatus || 'active';
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    const actionLabel = currentStatus === 'active' ? 'Pause' : 'Resume';

    Alert.alert(
      `${actionLabel} Recurring Job`,
      `Are you sure you want to ${actionLabel.toLowerCase()} "${job.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionLabel,
          onPress: async () => {
            setActionLoading(job.id);
            try {
              const res = await api.patch(`/api/jobs/${job.id}`, {
                recurrenceStatus: newStatus,
              });
              if (res.error) {
                Alert.alert('Error', res.error);
              } else {
                fetchRecurringJobs();
              }
            } catch (err) {
              Alert.alert('Error', `Failed to ${actionLabel.toLowerCase()} job.`);
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleGenerateNow = async (job: RecurringJob) => {
    Alert.alert(
      'Generate Next Job',
      `Generate the next occurrence of "${job.title}" now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            setActionLoading(job.id);
            try {
              const res = await api.post(`/api/recurring-contracts/${job.id}/generate-job`);
              if (res.error) {
                Alert.alert('Error', res.error);
              } else {
                Alert.alert('Success', 'Next job has been generated.');
                fetchRecurringJobs();
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to generate job.');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (job: RecurringJob) => {
    const ok = await confirm({ title: 'Delete Recurring Job', message: `Are you sure you want to delete "${job.title}"? This will stop future occurrences. Existing jobs will not be affected.`, confirmText: 'Delete', cancelText: 'Cancel', destructive: true });
    if (ok) {
      setActionLoading(job.id);
      try {
        const res = await api.post(`/api/recurring/jobs/${job.id}/stop`);
        if (res.error) {
          Alert.alert('Error', res.error);
        } else {
          fetchRecurringJobs();
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to delete recurring job.');
      } finally {
        setActionLoading(null);
      }
    }
  };

  const isOverdue = (dateStr?: string) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  const renderFilterChips = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
      <View style={styles.filterContainer}>
        {(['all', 'active', 'paused', 'completed'] as FilterType[]).map((filter) => {
          const isActive = activeFilter === filter;
          const config = filter === 'all' ? null : getStatusConfig(filter as RecurringJobStatus, colors);
          return (
            <PressableRow key={filter} style={[styles.filterChip, isActive && styles.activeFilterChip]} onPress={() => setActiveFilter(filter)} >
              {config && (
                <Feather
                  name={config.icon}
                  size={iconSizes.sm}
                  color={isActive ? colors.primaryForeground : config.color}
                />
              )}
              <Text style={[styles.filterText, isActive && styles.activeFilterText]}>
                {filter === 'all' ? 'All' : config!.label}
              </Text>
              <View style={[styles.filterBadge, isActive && styles.activeFilterBadge]}>
                <Text style={[styles.filterBadgeText, isActive && styles.activeFilterBadgeText]}>
                  {filterCounts[filter]}
                </Text>
              </View>
            </PressableRow>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderStatsRow = () => (
    <View style={styles.statsRow}>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: colors.successLight || 'rgba(34,197,94,0.1)' }]}>
          <Feather name="play-circle" size={16} color={colors.success} />
        </View>
        <Text style={styles.statValue}>{filterCounts.active}</Text>
        <Text style={styles.statLabel}>ACTIVE</Text>
      </View>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: colors.warningLight || 'rgba(245,158,11,0.1)' }]}>
          <Feather name="pause-circle" size={16} color={colors.warning} />
        </View>
        <Text style={styles.statValue}>{filterCounts.paused}</Text>
        <Text style={styles.statLabel}>PAUSED</Text>
      </View>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: 'rgba(107,114,128,0.1)' }]}>
          <Feather name="check-circle" size={16} color={colors.mutedForeground} />
        </View>
        <Text style={styles.statValue}>{filterCounts.completed}</Text>
        <Text style={styles.statLabel}>COMPLETED</Text>
      </View>
    </View>
  );

  const renderCard = (job: RecurringJob) => {
    const statusConfig = getStatusConfig(job.recurrenceStatus as RecurringJobStatus, colors);
    const overdue = isOverdue(job.nextRecurrenceDate);
    const isJobLoading = actionLoading === job.id;
    const currentStatus = job.recurrenceStatus || 'active';
    const isPaused = currentStatus === 'paused';
    const isActiveJob = currentStatus === 'active';

    return (
      <View key={job.id} style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={2}>{job.title}</Text>
            {job.clientName && (
              <Text style={styles.cardClient} numberOfLines={1}>{job.clientName}</Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <View style={[styles.statusBadgeDot, { backgroundColor: statusConfig.color }]} />
            <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <View style={styles.cardInfoRow}>
          <Feather name="repeat" size={iconSizes.sm} color={colors.mutedForeground} />
          <Text style={styles.cardInfoText}>Frequency: </Text>
          <Text style={styles.cardInfoHighlight}>{getPatternLabel(job.recurrencePattern)}</Text>
        </View>

        {job.nextRecurrenceDate && (
          <View style={styles.cardInfoRow}>
            <Feather name="calendar" size={iconSizes.sm} color={colors.mutedForeground} />
            <Text style={styles.cardInfoText}>Next run: </Text>
            <Text style={styles.cardInfoHighlight}>{formatDate(job.nextRecurrenceDate)}</Text>
          </View>
        )}

        {job.recurrenceEndDate && (
          <View style={styles.cardInfoRow}>
            <Feather name="flag" size={iconSizes.sm} color={colors.mutedForeground} />
            <Text style={styles.cardInfoText}>Ends: </Text>
            <Text style={styles.cardInfoHighlight}>{formatDate(job.recurrenceEndDate)}</Text>
          </View>
        )}

        {job.address && (
          <View style={styles.cardInfoRow}>
            <Feather name="map-pin" size={iconSizes.sm} color={colors.mutedForeground} />
            <Text style={styles.cardInfoText} numberOfLines={1}>{job.address}</Text>
          </View>
        )}

        {isActiveJob && job.nextRecurrenceDate && !overdue && (
          <View style={styles.nextRunCard}>
            <Feather name="clock" size={iconSizes.sm} color={colors.primary} />
            <Text style={styles.nextRunText}>{formatRelativeDate(job.nextRecurrenceDate)}</Text>
          </View>
        )}

        {isActiveJob && overdue && (
          <View style={styles.overdueCard}>
            <Feather name="alert-triangle" size={iconSizes.sm} color={colors.destructive} />
            <Text style={styles.overdueText}>{formatRelativeDate(job.nextRecurrenceDate)}</Text>
          </View>
        )}

        <View style={styles.cardDivider} />

        <View style={styles.cardActions}>
          {(isActiveJob || isPaused) && (
            <PressableRow style={[styles.actionButton, styles.actionButtonPrimary]} onPress={() => handleEditRecurrence(job)} disabled={isJobLoading} >
              <Feather name="edit-2" size={iconSizes.sm} color={colors.primary} />
              <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>Edit</Text>
            </PressableRow>
          )}

          {(isActiveJob || isPaused) && (
            <PressableRow style={[styles.actionButton, isPaused && styles.actionButtonPrimary]} onPress={() => handlePauseResume(job)} disabled={isJobLoading} >
              {isJobLoading ? (
                <ActivityIndicator size="small" color={colors.foreground} />
              ) : (
                <>
                  <Feather
                    name={isPaused ? 'play' : 'pause'}
                    size={iconSizes.sm}
                    color={isPaused ? colors.primary : colors.foreground}
                  />
                  <Text style={[styles.actionButtonText, isPaused && styles.actionButtonTextPrimary]}>
                    {isPaused ? 'Resume' : 'Pause'}
                  </Text>
                </>
              )}
            </PressableRow>
          )}

          {isActiveJob && (
            <PressableRow style={[styles.actionButton, styles.actionButtonPrimary]} onPress={() => handleGenerateNow(job)} disabled={isJobLoading} >
              {isJobLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Feather name="plus-circle" size={iconSizes.sm} color={colors.primary} />
                  <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>Generate</Text>
                </>
              )}
            </PressableRow>
          )}

          {(isActiveJob || isPaused) && (
            <PressableRow style={[styles.actionButton, styles.actionButtonDestructive]} onPress={() => handleDelete(job)} disabled={isJobLoading} >
              <Feather name="trash-2" size={iconSizes.sm} color={colors.destructive} />
              <Text style={[styles.actionButtonText, styles.actionButtonTextDestructive]}>Delete</Text>
            </PressableRow>
          )}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Feather name="repeat" size={28} color={colors.mutedForeground} />
      </View>
      <Text style={styles.emptyTitle}>No Recurring Jobs</Text>
      <Text style={styles.emptySubtitle}>
        {activeFilter !== 'all'
          ? `No ${activeFilter} recurring jobs found. Try a different filter.`
          : 'Set up recurring jobs to automatically generate new jobs on a schedule.'}
      </Text>
      {activeFilter === 'all' && (
        <>
          <PressableRow style={styles.emptyButton} onPress={handleCreateRecurringJob} >
            <Feather name="plus" size={iconSizes.md} color={colors.primaryForeground} />
            <Text style={styles.emptyButtonText}>Create Recurring Job</Text>
          </PressableRow>
          <PressableRow style={styles.emptyButtonSecondary} onPress={handleOpenJobPicker} >
            <Feather name="refresh-cw" size={iconSizes.md} color={colors.foreground} />
            <Text style={styles.emptyButtonSecondaryText}>Convert Existing Job</Text>
          </PressableRow>
        </>
      )}
    </View>
  );

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Feather name="alert-circle" size={40} color={colors.destructive} />
      <Text style={styles.errorText}>{error}</Text>
      <PressableRow style={styles.retryButton} onPress={handleRefresh} >
        <Text style={styles.retryButtonText}>Try Again</Text>
      </PressableRow>
    </View>
  );

  const renderEditModal = () => (
    <Modal
      visible={editModalVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setEditModalVisible(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setEditModalVisible(false)}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Recurrence</Text>
              <PressableRow onPress={() => setEditModalVisible(false)} >
                <Feather name="x" size={iconSizes['2xl']} color={colors.mutedForeground} />
              </PressableRow>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalLabel, { marginTop: 0 }]}>Frequency</Text>
              {RECURRENCE_OPTIONS.map((opt) => (
                <PressableRow key={opt.value} style={[ styles.modalOptionRow, editPattern === opt.value && styles.modalOptionRowSelected, ]} onPress={() => setEditPattern(opt.value)} >
                  <Text
                    style={[
                      styles.modalOptionText,
                      editPattern === opt.value && styles.modalOptionTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {editPattern === opt.value && (
                    <Feather name="check" size={iconSizes.lg} color={colors.primary} />
                  )}
                </PressableRow>
              ))}

              <Text style={styles.modalLabel}>Interval</Text>
              <View style={styles.intervalRow}>
                <Text style={styles.intervalLabel}>Every</Text>
                <TextInput
                  style={styles.intervalInput}
                  value={editInterval}
                  onChangeText={(t) => setEditInterval(t.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  maxLength={3}
                  placeholderTextColor={colors.mutedForeground}
                />
                <Text style={styles.intervalLabel}>
                  {editPattern === 'weekly'
                    ? 'week(s)'
                    : editPattern === 'fortnightly'
                    ? 'fortnight(s)'
                    : editPattern === 'monthly'
                    ? 'month(s)'
                    : editPattern === 'quarterly'
                    ? 'quarter(s)'
                    : 'year(s)'}
                </Text>
              </View>

              <Text style={styles.modalLabel}>End Date (optional)</Text>
              <TextInput
                style={styles.modalInput}
                value={editEndDate}
                onChangeText={setEditEndDate}
                placeholder="YYYY-MM-DD (leave blank for no end)"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="default"
              />

              <Text style={styles.modalLabel}>Status</Text>
              <PressableRow style={styles.pauseToggleRow} onPress={() => setEditPaused(!editPaused)} >
                <View style={{ flex: 1 }}>
                  <Text style={styles.pauseToggleLabel}>
                    {editPaused ? 'Paused' : 'Active'}
                  </Text>
                  <Text style={styles.pauseToggleDescription}>
                    {editPaused
                      ? 'Job generation is paused. No new jobs will be created.'
                      : 'Jobs will be generated on schedule.'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.toggleTrack,
                    editPaused ? styles.toggleTrackActive : styles.toggleTrackInactive,
                  ]}
                >
                  <View
                    style={[
                      styles.toggleThumb,
                      { alignSelf: editPaused ? 'flex-end' : 'flex-start' },
                    ]}
                  />
                </View>
              </PressableRow>

              <PressableRow style={styles.modalSaveButton} onPress={handleSaveEdit} disabled={editSaving} >
                {editSaving ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <>
                    <Feather name="check" size={iconSizes.md} color={colors.primaryForeground} />
                    <Text style={styles.modalSaveButtonText}>Save Changes</Text>
                  </>
                )}
              </PressableRow>

              <PressableRow style={styles.modalCancelButton} onPress={() => setEditModalVisible(false)} >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </PressableRow>

              <View style={{ height: spacing.xl }} />
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  const renderJobPickerModal = () => (
    <Modal
      visible={jobPickerVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setJobPickerVisible(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setJobPickerVisible(false)}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Convert Existing Job</Text>
              <PressableRow onPress={() => setJobPickerVisible(false)} >
                <Feather name="x" size={iconSizes['2xl']} color={colors.mutedForeground} />
              </PressableRow>
            </View>

            <TextInput
              style={styles.searchInput}
              value={jobSearch}
              onChangeText={setJobSearch}
              placeholder="Search jobs..."
              placeholderTextColor={colors.mutedForeground}
            />

            {jobsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : filteredPickerJobs.length === 0 ? (
              <Text style={styles.jobPickerEmptyText}>
                {jobSearch ? 'No matching jobs found.' : 'No non-recurring jobs available.'}
              </Text>
            ) : (
              <FlatList
                data={filteredPickerJobs}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <PressableRow style={styles.jobPickerItem} onPress={() => handleConvertJob(item)} disabled={convertingJobId === item.id} >
                    <View style={styles.jobPickerItemInfo}>
                      <Text style={styles.jobPickerItemTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.clientName && (
                        <Text style={styles.jobPickerItemSub} numberOfLines={1}>
                          {item.clientName}
                        </Text>
                      )}
                    </View>
                    {convertingJobId === item.id ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Feather name="refresh-cw" size={iconSizes.lg} color={colors.primary} />
                    )}
                  </PressableRow>
                )}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <PressableRow onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Feather name="arrow-left" size={iconSizes.lg} color={colors.foreground} />
        </PressableRow>
        <Text style={styles.headerTitle}>Recurring Jobs</Text>
        <PressableRow onPress={handleCreateRecurringJob} >
          <Feather name="plus" size={iconSizes['2xl']} color={colors.primary} />
        </PressableRow>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading recurring jobs...</Text>
          </View>
        ) : error ? (
          renderError()
        ) : (
          <>
            {renderStatsRow()}
            {renderFilterChips()}
            {filteredJobs.length === 0 ? renderEmptyState() : filteredJobs.map(renderCard)}
          </>
        )}
      </ScrollView>

      {!isLoading && !error && fabMenuVisible && (
        <TouchableOpacity
          style={styles.fabMenuOverlay}
          activeOpacity={1}
          onPress={() => setFabMenuVisible(false)}
        >
          <View style={styles.fabMenuContainer}>
            <PressableRow style={styles.fabMenuItem} onPress={() => { setFabMenuVisible(false); handleCreateRecurringJob(); }} >
              <Text style={styles.fabMenuItemText}>Create Recurring Job</Text>
              <View style={[styles.fabMenuItemIcon, { backgroundColor: colors.primaryLight }]}>
                <Feather name="plus" size={iconSizes.lg} color={colors.primary} />
              </View>
            </PressableRow>
            <PressableRow style={styles.fabMenuItem} onPress={() => { setFabMenuVisible(false); handleOpenJobPicker(); }} >
              <Text style={styles.fabMenuItemText}>Convert Existing Job</Text>
              <View style={[styles.fabMenuItemIcon, { backgroundColor: colors.warningLight }]}>
                <Feather name="refresh-cw" size={iconSizes.lg} color={colors.warning} />
              </View>
            </PressableRow>
          </View>
        </TouchableOpacity>
      )}

      {!isLoading && !error && (
        <PressableRow style={styles.fab} onPress={() => setFabMenuVisible(!fabMenuVisible)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} >
          <Feather name={fabMenuVisible ? 'x' : 'plus'} size={iconSizes['2xl']} color={colors.primaryForeground} />
        </PressableRow>
      )}

      {renderEditModal()}
      {renderJobPickerModal()}
    </View>
  );
}
