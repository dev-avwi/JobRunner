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
  TextInput,
  FlatList,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import { api } from '../../src/lib/api';
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes, fontWeights } from '../../src/lib/design-tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';

type ReminderStatus = 'pending' | 'sent' | 'completed' | 'cancelled';
type FilterType = 'upcoming' | 'all' | 'completed';

interface ServiceReminder {
  id: string;
  serviceType: string;
  clientId: string;
  clientName?: string;
  jobId?: string;
  nextDueDate: string;
  intervalMonths?: number;
  reminderDays?: number;
  notes?: string;
  status?: ReminderStatus;
  createdAt?: string;
}

interface Client {
  id: string;
  name: string;
}

const INTERVAL_LABELS: Record<number, string> = {
  1: 'Monthly',
  3: 'Quarterly',
  6: '6 Monthly',
  12: 'Yearly',
  24: '2 Years',
};

const INTERVAL_OPTIONS = [
  { value: 1, label: 'Monthly' },
  { value: 3, label: 'Quarterly' },
  { value: 6, label: '6 Monthly' },
  { value: 12, label: 'Yearly' },
  { value: 24, label: '2 Years' },
];

const REMINDER_DAYS_OPTIONS = [
  { value: 7, label: '1 week before' },
  { value: 14, label: '2 weeks before' },
  { value: 30, label: '1 month before' },
];

const COMMON_SERVICE_TYPES = [
  'Annual AC Service',
  'Fire Safety Check',
  'Pool Maintenance',
  'Electrical Safety Inspection',
  'Plumbing Maintenance',
  'HVAC Filter Replacement',
  'Gutter Cleaning',
  'Smoke Alarm Testing',
  'Hot Water System Service',
  'Solar Panel Cleaning',
];

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'Not set';
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getDueDateStatus = (dateStr: string): 'overdue' | 'due-soon' | 'upcoming' => {
  const now = new Date();
  const due = new Date(dateStr);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'overdue';
  if (diffDays <= 14) return 'due-soon';
  return 'upcoming';
};

const getDueDateLabel = (dateStr: string): string => {
  const status = getDueDateStatus(dateStr);
  if (status === 'overdue') return 'Overdue';
  if (status === 'due-soon') return 'Due Soon';
  return '';
};

const getStatusConfig = (status: ReminderStatus | undefined, colors: ThemeColors) => {
  switch (status) {
    case 'sent':
      return {
        label: 'Sent',
        color: colors.info,
        bgColor: colors.infoLight,
      };
    case 'completed':
      return {
        label: 'Completed',
        color: colors.mutedForeground,
        bgColor: 'rgba(107,114,128,0.1)',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        color: colors.destructive,
        bgColor: colors.destructiveLight || 'rgba(239,68,68,0.1)',
      };
    case 'pending':
    default:
      return {
        label: 'Pending',
        color: colors.warning,
        bgColor: colors.warningLight || 'rgba(245,158,11,0.1)',
      };
  }
};

function createStyles(colors: ThemeColors, bottomNavHeight: number = 0) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: pageShell.paddingHorizontal,
      paddingTop: pageShell.paddingTop,
      paddingBottom: bottomNavHeight,
    },
    filterContainer: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
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
      paddingHorizontal: spacing.xs,
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
      marginBottom: spacing.xs,
    },
    cardInfoText: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    dueSoonTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.warningLight || 'rgba(245,158,11,0.1)',
      borderRadius: radius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      marginTop: spacing.xs,
    },
    dueSoonText: {
      ...typography.caption,
      fontWeight: fontWeights.semibold,
      color: colors.warning,
    },
    overdueTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
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
    },
    emptyButtonText: {
      ...typography.button,
      color: colors.primaryForeground,
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
      maxHeight: '85%',
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
    modalSaveButtonDisabled: {
      opacity: 0.5,
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
    clientPickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    clientPickerItemInfo: {
      flex: 1,
    },
    clientPickerItemTitle: {
      ...typography.bodySemibold,
      color: colors.foreground,
    },
    clientPickerEmptyText: {
      ...typography.body,
      color: colors.mutedForeground,
      textAlign: 'center',
      paddingVertical: spacing['3xl'],
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
    completeModalBody: {
      paddingHorizontal: spacing.lg,
    },
    completeModalDescription: {
      ...typography.body,
      color: colors.mutedForeground,
      marginBottom: spacing.lg,
    },
    repeatInfoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.muted,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      marginBottom: spacing.lg,
    },
    repeatInfoText: {
      ...typography.caption,
      color: colors.mutedForeground,
      flex: 1,
    },
    completeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.muted,
      marginBottom: spacing.sm,
    },
    completeButtonText: {
      ...typography.button,
      color: colors.foreground,
    },
    completeAndScheduleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      marginBottom: spacing.sm,
    },
    completeAndScheduleButtonText: {
      ...typography.button,
      color: colors.primaryForeground,
    },
    notesText: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: spacing.xs,
    },
  });
}

export default function ServiceRemindersScreen() {
  const { colors } = useTheme();
  const confirm = useConfirmDialog();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);

  const [reminders, setReminders] = useState<ServiceReminder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('upcoming');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ServiceReminder | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  const [formServiceType, setFormServiceType] = useState('');
  const [formCustomServiceType, setFormCustomServiceType] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formIntervalMonths, setFormIntervalMonths] = useState(12);
  const [formReminderDays, setFormReminderDays] = useState(14);
  const [formNotes, setFormNotes] = useState('');

  const [serviceTypePickerVisible, setServiceTypePickerVisible] = useState(false);
  const [clientPickerVisible, setClientPickerVisible] = useState(false);
  const [intervalPickerVisible, setIntervalPickerVisible] = useState(false);
  const [reminderDaysPickerVisible, setReminderDaysPickerVisible] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [completingReminder, setCompletingReminder] = useState<ServiceReminder | null>(null);

  const clientMap = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [clients]);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [remindersRes, clientsRes] = await Promise.all([
        api.get<ServiceReminder[]>('/api/service-reminders'),
        api.get<Client[]>('/api/clients'),
      ]);
      if (remindersRes.error) {
        setError(remindersRes.error);
      } else {
        setReminders(remindersRes.data || []);
      }
      if (clientsRes.data) {
        setClients(clientsRes.data);
      }
    } catch (err) {
      setError('Failed to load service reminders');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const filteredReminders = useMemo(() => {
    let filtered = reminders;
    if (activeFilter === 'upcoming') {
      filtered = reminders.filter((r) => r.status === 'pending' || r.status === 'sent' || !r.status);
    } else if (activeFilter === 'completed') {
      filtered = reminders.filter((r) => r.status === 'completed');
    }
    return [...filtered].sort(
      (a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()
    );
  }, [reminders, activeFilter]);

  const filterCounts = useMemo(
    () => ({
      upcoming: reminders.filter((r) => r.status === 'pending' || r.status === 'sent' || !r.status).length,
      all: reminders.length,
      completed: reminders.filter((r) => r.status === 'completed').length,
    }),
    [reminders]
  );

  const resetForm = () => {
    setFormServiceType('');
    setFormCustomServiceType('');
    setFormClientId('');
    setFormIntervalMonths(12);
    setFormReminderDays(14);
    setFormNotes('');
  };

  const openCreateModal = () => {
    setEditingReminder(null);
    resetForm();
    setFormModalVisible(true);
  };

  const openEditModal = (reminder: ServiceReminder) => {
    setEditingReminder(reminder);
    const isCustom = !COMMON_SERVICE_TYPES.includes(reminder.serviceType);
    setFormServiceType(isCustom ? '' : reminder.serviceType);
    setFormCustomServiceType(isCustom ? reminder.serviceType : '');
    setFormClientId(reminder.clientId);
    setFormIntervalMonths(reminder.intervalMonths || 12);
    setFormReminderDays(reminder.reminderDays || 14);
    setFormNotes(reminder.notes || '');
    setFormModalVisible(true);
  };

  const handleSave = async () => {
    const serviceType = formCustomServiceType || formServiceType;
    if (!serviceType || !formClientId) {
      Alert.alert('Missing Fields', 'Please select a service type and client.');
      return;
    }
    setFormSaving(true);
    try {
      const payload = {
        serviceType,
        clientId: formClientId,
        nextDueDate: new Date().toISOString(),
        intervalMonths: formIntervalMonths,
        reminderDays: formReminderDays,
        notes: formNotes || undefined,
      };

      if (editingReminder) {
        const res = await api.patch(`/api/service-reminders/${editingReminder.id}`, payload);
        if (res.error) {
          Alert.alert('Error', res.error);
        } else {
          setFormModalVisible(false);
          resetForm();
          fetchData();
        }
      } else {
        const res = await api.post('/api/service-reminders', payload);
        if (res.error) {
          Alert.alert('Error', res.error);
        } else {
          setFormModalVisible(false);
          resetForm();
          fetchData();
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to save service reminder');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (reminder: ServiceReminder) => {
    const ok = await confirm({
      title: 'Delete Reminder',
      message: `Delete "${reminder.serviceType}" reminder?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (ok) {
      setActionLoading(reminder.id);
      try {
        const res = await api.delete(`/api/service-reminders/${reminder.id}`);
        if (res.error) {
          Alert.alert('Error', res.error);
        } else {
          fetchData();
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to delete reminder');
      } finally {
        setActionLoading(null);
      }
    }
  };

  const openCompleteModal = (reminder: ServiceReminder) => {
    setCompletingReminder(reminder);
    setCompleteModalVisible(true);
  };

  const handleComplete = async (scheduleNext: boolean) => {
    if (!completingReminder) return;
    setActionLoading(completingReminder.id);
    try {
      const res = await api.post(`/api/service-reminders/${completingReminder.id}/complete`, {
        scheduleNext,
      });
      if (res.error) {
        Alert.alert('Error', res.error);
      } else {
        setCompleteModalVisible(false);
        setCompletingReminder(null);
        fetchData();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to complete reminder');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    const search = clientSearch.toLowerCase();
    return clients.filter((c) => c.name.toLowerCase().includes(search));
  }, [clients, clientSearch]);

  const renderFilterChips = () => {
    const filters: { key: FilterType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
      { key: 'upcoming', label: 'Upcoming', icon: 'clock' },
      { key: 'all', label: 'All', icon: 'list' },
      { key: 'completed', label: 'Completed', icon: 'check' },
    ];
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
        <View style={styles.filterContainer}>
          {filters.map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <PressableRow key={f.key} style={[styles.filterChip, isActive && styles.activeFilterChip]} onPress={() => setActiveFilter(f.key)} >
                <Feather
                  name={f.icon}
                  size={iconSizes.sm}
                  color={isActive ? colors.primaryForeground : colors.foreground}
                />
                <Text style={[styles.filterText, isActive && styles.activeFilterText]}>{f.label}</Text>
                <View style={[styles.filterBadge, isActive && styles.activeFilterBadge]}>
                  <Text style={[styles.filterBadgeText, isActive && styles.activeFilterBadgeText]}>
                    {filterCounts[f.key]}
                  </Text>
                </View>
              </PressableRow>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  const renderReminderCard = (reminder: ServiceReminder) => {
    const statusConfig = getStatusConfig(reminder.status as ReminderStatus, colors);
    const isActive = reminder.status === 'pending' || reminder.status === 'sent' || !reminder.status;
    const dueDateStatus = getDueDateStatus(reminder.nextDueDate);
    const dueDateLabel = getDueDateLabel(reminder.nextDueDate);
    const loading = actionLoading === reminder.id;

    return (
      <View key={reminder.id} style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardTitleRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Feather name="bell" size={iconSizes.md} color={colors.mutedForeground} />
              <Text style={styles.cardTitle} numberOfLines={1}>
                {reminder.serviceType}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 }}>
              <Feather name="user" size={iconSizes.xs} color={colors.mutedForeground} />
              <Text style={styles.cardClient} numberOfLines={1}>
                {clientMap.get(reminder.clientId) || reminder.clientName || 'Unknown Client'}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <View style={[styles.statusBadgeDot, { backgroundColor: statusConfig.color }]} />
            <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
        </View>

        <View style={styles.cardInfoRow}>
          <Feather
            name="calendar"
            size={iconSizes.sm}
            color={
              isActive && dueDateStatus === 'overdue'
                ? colors.destructive
                : isActive && dueDateStatus === 'due-soon'
                ? colors.warning
                : colors.mutedForeground
            }
          />
          <Text
            style={[
              styles.cardInfoText,
              isActive && dueDateStatus === 'overdue' && { color: colors.destructive, fontWeight: fontWeights.semibold },
              isActive && dueDateStatus === 'due-soon' && { color: colors.warning, fontWeight: fontWeights.semibold },
            ]}
          >
            {formatDate(reminder.nextDueDate)}
            {isActive && dueDateLabel ? ` (${dueDateLabel})` : ''}
          </Text>
        </View>

        {reminder.intervalMonths && (
          <View style={styles.cardInfoRow}>
            <Feather name="repeat" size={iconSizes.xs} color={colors.mutedForeground} />
            <Text style={styles.cardInfoText}>
              {INTERVAL_LABELS[reminder.intervalMonths] || `${reminder.intervalMonths}mo`}
            </Text>
          </View>
        )}

        {reminder.notes ? (
          <Text style={styles.notesText} numberOfLines={2}>
            {reminder.notes}
          </Text>
        ) : null}

        <View style={styles.cardDivider} />

        <View style={styles.cardActions}>
          {isActive && (
            <PressableRow style={[styles.actionButton, styles.actionButtonPrimary]} onPress={() => openCompleteModal(reminder)} disabled={loading} >
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Feather name="check" size={iconSizes.sm} color={colors.primary} />
                  <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>Complete</Text>
                </>
              )}
            </PressableRow>
          )}
          <PressableRow style={styles.actionButton} onPress={() => openEditModal(reminder)} disabled={loading}>
            <Feather name="edit-2" size={iconSizes.sm} color={colors.foreground} />
            <Text style={styles.actionButtonText}>Edit</Text>
          </PressableRow>
          <PressableRow style={[styles.actionButton, styles.actionButtonDestructive]} onPress={() => handleDelete(reminder)} disabled={loading} >
            <Feather name="trash-2" size={iconSizes.sm} color={colors.destructive} />
            <Text style={[styles.actionButtonText, styles.actionButtonTextDestructive]}>Delete</Text>
          </PressableRow>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading reminders...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={iconSizes['3xl']} color={colors.destructive} />
          <Text style={styles.errorText}>{error}</Text>
          <PressableRow style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </PressableRow>
        </View>
      );
    }

    if (filteredReminders.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="bell" size={iconSizes['2xl']} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>
            {activeFilter === 'completed' ? 'No completed reminders' : 'No service reminders yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeFilter === 'completed'
              ? 'Completed service reminders will appear here'
              : 'Create your first service reminder to track recurring maintenance'}
          </Text>
          {activeFilter !== 'completed' && (
            <PressableRow style={styles.emptyButton} onPress={openCreateModal}>
              <Feather name="plus" size={iconSizes.md} color={colors.primaryForeground} />
              <Text style={styles.emptyButtonText}>New Reminder</Text>
            </PressableRow>
          )}
        </View>
      );
    }

    return filteredReminders.map(renderReminderCard);
  };

  const effectiveServiceType = formCustomServiceType || formServiceType;
  const canSave = !!effectiveServiceType && !!formClientId;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Service Reminders',
          headerShown: true,
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {renderFilterChips()}
        {renderContent()}
      </ScrollView>

      <PressableRow style={styles.fab} onPress={openCreateModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Feather name="plus" size={iconSizes['2xl']} color={colors.primaryForeground} />
      </PressableRow>

      <AppBottomSheet
        visible={formModalVisible}
        onDismiss={() => setFormModalVisible(false)}
        snapPoints={['85%']}
        scrollable={false}
        contentPadding={0}>
        <View>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingReminder ? 'Edit Service Reminder' : 'New Service Reminder'}
              </Text>
              <PressableRow onPress={() => setFormModalVisible(false)}>
                <Feather name="x" size={iconSizes.xl} color={colors.mutedForeground} />
              </PressableRow>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>SERVICE TYPE</Text>
              <PressableRow style={styles.modalOptionRow} onPress={() => setServiceTypePickerVisible(true)} >
                <Text style={[styles.modalOptionText, !formServiceType && { color: colors.mutedForeground }]}>
                  {formServiceType || 'Select a service type'}
                </Text>
                <Feather name="chevron-right" size={iconSizes.md} color={colors.mutedForeground} />
              </PressableRow>

              <Text style={[styles.modalLabel, { marginTop: spacing.sm }]}>OR CUSTOM TYPE</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter custom service type"
                placeholderTextColor={colors.mutedForeground}
                value={formCustomServiceType}
                onChangeText={(text) => {
                  setFormCustomServiceType(text);
                  if (text) setFormServiceType('');
                }}
              />

              <Text style={styles.modalLabel}>CLIENT</Text>
              <PressableRow style={styles.modalOptionRow} onPress={() => { setClientSearch(''); setClientPickerVisible(true); }} >
                <Text style={[styles.modalOptionText, !formClientId && { color: colors.mutedForeground }]}>
                  {formClientId ? clientMap.get(formClientId) || 'Selected' : 'Select a client'}
                </Text>
                <Feather name="chevron-right" size={iconSizes.md} color={colors.mutedForeground} />
              </PressableRow>

              <Text style={styles.modalLabel}>REPEAT INTERVAL</Text>
              <PressableRow style={styles.modalOptionRow} onPress={() => setIntervalPickerVisible(true)} >
                <Text style={styles.modalOptionText}>
                  {INTERVAL_LABELS[formIntervalMonths] || `${formIntervalMonths} months`}
                </Text>
                <Feather name="chevron-right" size={iconSizes.md} color={colors.mutedForeground} />
              </PressableRow>

              <Text style={styles.modalLabel}>REMIND BEFORE</Text>
              <PressableRow style={styles.modalOptionRow} onPress={() => setReminderDaysPickerVisible(true)} >
                <Text style={styles.modalOptionText}>
                  {REMINDER_DAYS_OPTIONS.find((o) => o.value === formReminderDays)?.label || `${formReminderDays} days`}
                </Text>
                <Feather name="chevron-right" size={iconSizes.md} color={colors.mutedForeground} />
              </PressableRow>

              <Text style={styles.modalLabel}>NOTES</Text>
              <TextInput
                style={[styles.modalInput, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="Additional notes..."
                placeholderTextColor={colors.mutedForeground}
                value={formNotes}
                onChangeText={setFormNotes}
                multiline
              />

              <PressableRow style={[styles.modalSaveButton, !canSave && styles.modalSaveButtonDisabled]} onPress={handleSave} disabled={!canSave || formSaving} >
                {formSaving ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <>
                    <Feather name="check" size={iconSizes.md} color={colors.primaryForeground} />
                    <Text style={styles.modalSaveButtonText}>
                      {editingReminder ? 'Update Reminder' : 'Create Reminder'}
                    </Text>
                  </>
                )}
              </PressableRow>

              <PressableRow style={styles.modalCancelButton} onPress={() => setFormModalVisible(false)} >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </PressableRow>

              <View style={{ height: 40 }} />
            </ScrollView>
        </View>
      </AppBottomSheet>

      <AppBottomSheet
        visible={serviceTypePickerVisible}
        onDismiss={() => setServiceTypePickerVisible(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Service Type</Text>
              <PressableRow onPress={() => setServiceTypePickerVisible(false)}>
                <Feather name="x" size={iconSizes.xl} color={colors.mutedForeground} />
              </PressableRow>
            </View>
            <FlatList
              data={COMMON_SERVICE_TYPES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const selected = formServiceType === item;
                return (
                  <PressableRow style={[styles.clientPickerItem]} onPress={() => { setFormServiceType(item); setFormCustomServiceType(''); setServiceTypePickerVisible(false); }} >
                    <Text style={styles.clientPickerItemTitle}>{item}</Text>
                    {selected && <Feather name="check" size={iconSizes.md} color={colors.primary} />}
                  </PressableRow>
                );
              }}
            />
        </View>
      </AppBottomSheet>

      <AppBottomSheet
        visible={clientPickerVisible}
        onDismiss={() => setClientPickerVisible(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Client</Text>
              <PressableRow onPress={() => setClientPickerVisible(false)}>
                <Feather name="x" size={iconSizes.xl} color={colors.mutedForeground} />
              </PressableRow>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search clients..."
              placeholderTextColor={colors.mutedForeground}
              value={clientSearch}
              onChangeText={setClientSearch}
            />
            <FlatList
              data={filteredClients}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={<Text style={styles.clientPickerEmptyText}>No clients found</Text>}
              renderItem={({ item }) => {
                const selected = formClientId === item.id;
                return (
                  <PressableRow style={styles.clientPickerItem} onPress={() => { setFormClientId(item.id); setClientPickerVisible(false); }} >
                    <View style={styles.clientPickerItemInfo}>
                      <Text style={styles.clientPickerItemTitle}>{item.name}</Text>
                    </View>
                    {selected && <Feather name="check" size={iconSizes.md} color={colors.primary} />}
                  </PressableRow>
                );
              }}
            />
        </View>
      </AppBottomSheet>

      <AppBottomSheet
        visible={intervalPickerVisible}
        onDismiss={() => setIntervalPickerVisible(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Repeat Interval</Text>
              <PressableRow onPress={() => setIntervalPickerVisible(false)}>
                <Feather name="x" size={iconSizes.xl} color={colors.mutedForeground} />
              </PressableRow>
            </View>
            <FlatList
              data={INTERVAL_OPTIONS}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => {
                const selected = formIntervalMonths === item.value;
                return (
                  <PressableRow style={[styles.clientPickerItem]} onPress={() => { setFormIntervalMonths(item.value); setIntervalPickerVisible(false); }} >
                    <Text style={styles.clientPickerItemTitle}>{item.label}</Text>
                    {selected && <Feather name="check" size={iconSizes.md} color={colors.primary} />}
                  </PressableRow>
                );
              }}
            />
        </View>
      </AppBottomSheet>

      <AppBottomSheet
        visible={reminderDaysPickerVisible}
        onDismiss={() => setReminderDaysPickerVisible(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Remind Before</Text>
              <PressableRow onPress={() => setReminderDaysPickerVisible(false)}>
                <Feather name="x" size={iconSizes.xl} color={colors.mutedForeground} />
              </PressableRow>
            </View>
            <FlatList
              data={REMINDER_DAYS_OPTIONS}
              keyExtractor={(item) => String(item.value)}
              renderItem={({ item }) => {
                const selected = formReminderDays === item.value;
                return (
                  <PressableRow style={[styles.clientPickerItem]} onPress={() => { setFormReminderDays(item.value); setReminderDaysPickerVisible(false); }} >
                    <Text style={styles.clientPickerItemTitle}>{item.label}</Text>
                    {selected && <Feather name="check" size={iconSizes.md} color={colors.primary} />}
                  </PressableRow>
                );
              }}
            />
        </View>
      </AppBottomSheet>

      <AppBottomSheet
        visible={completeModalVisible}
        onDismiss={() => setCompleteModalVisible(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}
      >
        <View>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Complete Service</Text>
              <PressableRow onPress={() => setCompleteModalVisible(false)}>
                <Feather name="x" size={iconSizes.xl} color={colors.mutedForeground} />
              </PressableRow>
            </View>
            <View style={styles.completeModalBody}>
              <Text style={styles.completeModalDescription}>
                Mark "{completingReminder?.serviceType}" as completed?
              </Text>
              {completingReminder?.intervalMonths && (
                <View style={styles.repeatInfoCard}>
                  <Feather name="repeat" size={iconSizes.md} color={colors.mutedForeground} />
                  <Text style={styles.repeatInfoText}>
                    This service repeats every{' '}
                    {INTERVAL_LABELS[completingReminder.intervalMonths] ||
                      `${completingReminder.intervalMonths} months`}
                  </Text>
                </View>
              )}

              <PressableRow style={styles.completeButton} onPress={() => handleComplete(false)} disabled={!!actionLoading} >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={colors.foreground} />
                ) : (
                  <Text style={styles.completeButtonText}>Complete Only</Text>
                )}
              </PressableRow>

              {completingReminder?.intervalMonths && (
                <PressableRow style={styles.completeAndScheduleButton} onPress={() => handleComplete(true)} disabled={!!actionLoading} >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Text style={styles.completeAndScheduleButtonText}>Complete & Schedule Next</Text>
                  )}
                </PressableRow>
              )}
            </View>
        </View>
      </AppBottomSheet>
    </View>
  );
}
