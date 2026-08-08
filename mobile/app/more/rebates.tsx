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
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes, fontWeights } from '../../src/lib/design-tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';

type RebateStatus = 'pending' | 'submitted' | 'approved' | 'received' | 'rejected';
type RebateType = 'manufacturer' | 'government' | 'other';
type FilterType = 'all' | 'pending' | 'submitted' | 'received';

interface Rebate {
  id: string;
  name: string;
  rebateType: RebateType;
  description?: string;
  amount: string;
  status?: RebateStatus;
  clientId?: string;
  jobId?: string;
  invoiceId?: string;
  referenceNumber?: string;
  expiryDate?: string;
  notes?: string;
}

interface RebatesSummary {
  pending: number;
  submitted: number;
  approved: number;
  received: number;
  rejected: number;
}

interface Client {
  id: string;
  name: string;
}

interface Job {
  id: string;
  title: string;
}

interface Invoice {
  id: string;
  number: string;
}

const REBATE_TYPE_OPTIONS: { value: RebateType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: 'manufacturer', label: 'Manufacturer', icon: 'package' },
  { value: 'government', label: 'Government', icon: 'award' },
  { value: 'other', label: 'Other', icon: 'file-text' },
];

const formatCurrency = (amount: string | number): string => {
  const { formatCurrency: fmt } = require('../../src/lib/format');
  return fmt(amount);
};

const getStatusConfig = (status: RebateStatus | undefined, colors: ThemeColors) => {
  switch (status) {
    case 'pending':
      return {
        label: 'Pending',
        color: colors.mutedForeground,
        bgColor: colors.muted,
        icon: 'clock' as const,
      };
    case 'submitted':
      return {
        label: 'Submitted',
        color: colors.info,
        bgColor: colors.infoLight,
        icon: 'send' as const,
      };
    case 'approved':
      return {
        label: 'Approved',
        color: colors.primary,
        bgColor: colors.primaryLight,
        icon: 'check-circle' as const,
      };
    case 'received':
      return {
        label: 'Received',
        color: colors.success,
        bgColor: colors.successLight || 'rgba(34,197,94,0.1)',
        icon: 'check' as const,
      };
    case 'rejected':
      return {
        label: 'Rejected',
        color: colors.destructive,
        bgColor: colors.destructiveLight || 'rgba(239,68,68,0.1)',
        icon: 'x-circle' as const,
      };
    default:
      return {
        label: 'Pending',
        color: colors.mutedForeground,
        bgColor: colors.muted,
        icon: 'clock' as const,
      };
  }
};

const getTypeIcon = (type: RebateType): keyof typeof Feather.glyphMap => {
  switch (type) {
    case 'manufacturer': return 'package';
    case 'government': return 'award';
    case 'other': return 'file-text';
    default: return 'file-text';
  }
};

const getTypeLabel = (type: RebateType): string => {
  switch (type) {
    case 'manufacturer': return 'Manufacturer';
    case 'government': return 'Government';
    case 'other': return 'Other';
    default: return 'Other';
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
    summaryRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.xs,
    },
    summaryIconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    summaryValue: {
      ...typography.cardTitle,
      color: colors.foreground,
    },
    summaryLabel: {
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
    cardLeft: {
      flexDirection: 'row',
      flex: 1,
      gap: spacing.sm,
    },
    typeIconContainer: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitleArea: {
      flex: 1,
      gap: 2,
    },
    cardTitle: {
      ...typography.bodySemibold,
      color: colors.foreground,
    },
    cardAmount: {
      ...typography.cardTitle,
      color: colors.primary,
      marginTop: 2,
    },
    cardDescription: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: 4,
    },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.xs,
      flexWrap: 'wrap',
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
    typeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeBadgeText: {
      ...typography.badge,
      color: colors.mutedForeground,
    },
    cardInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: 4,
    },
    cardInfoText: {
      ...typography.caption,
      color: colors.mutedForeground,
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
    modalTextarea: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      ...typography.body,
      color: colors.foreground,
      minHeight: 60,
      textAlignVertical: 'top',
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
    pickerModalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radius['2xl'],
      borderTopRightRadius: radius['2xl'],
      paddingTop: spacing.lg,
      paddingBottom: Platform.OS === 'ios' ? 40 : spacing.xl,
      maxHeight: '60%',
    },
    pickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.sm,
    },
    pickerItemText: {
      ...typography.body,
      color: colors.foreground,
      flex: 1,
    },
    pickerItemSubtext: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    pickerSearchInput: {
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
    rowFields: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    halfField: {
      flex: 1,
    },
    selectButton: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    selectButtonText: {
      ...typography.body,
      color: colors.foreground,
    },
    selectButtonPlaceholder: {
      ...typography.body,
      color: colors.mutedForeground,
    },
    menuButton: {
      padding: spacing.xs,
    },
  });
}

export default function RebatesScreen() {
  const { colors } = useTheme();
  const confirm = useConfirmDialog();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);

  const [rebates, setRebates] = useState<Rebate[]>([]);
  const [summary, setSummary] = useState<RebatesSummary>({ pending: 0, submitted: 0, approved: 0, received: 0, rejected: 0 });
  const [clients, setClients] = useState<Client[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingRebate, setEditingRebate] = useState<Rebate | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<RebateType>('manufacturer');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formClientId, setFormClientId] = useState('');
  const [formJobId, setFormJobId] = useState('');
  const [formInvoiceId, setFormInvoiceId] = useState('');
  const [formReferenceNumber, setFormReferenceNumber] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const [clientPickerVisible, setClientPickerVisible] = useState(false);
  const [jobPickerVisible, setJobPickerVisible] = useState(false);
  const [invoicePickerVisible, setInvoicePickerVisible] = useState(false);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);
  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j.title])), [jobs]);
  const invoiceMap = useMemo(() => new Map(invoices.map((i) => [i.id, i.number])), [invoices]);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [rebatesRes, summaryRes, clientsRes, jobsRes, invoicesRes] = await Promise.all([
        api.get<Rebate[]>('/api/rebates'),
        api.get<RebatesSummary>('/api/rebates/summary'),
        api.get<Client[]>('/api/clients'),
        api.get<Job[]>('/api/jobs'),
        api.get<Invoice[]>('/api/invoices'),
      ]);
      if (rebatesRes.error) {
        setError(rebatesRes.error);
      } else {
        setRebates(rebatesRes.data || []);
      }
      if (summaryRes.data) setSummary(summaryRes.data);
      if (clientsRes.data) setClients(clientsRes.data);
      if (jobsRes.data) setJobs(jobsRes.data);
      if (invoicesRes.data) setInvoices(invoicesRes.data);
    } catch (err) {
      setError('Failed to load rebates');
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

  const filteredRebates = useMemo(() => {
    if (activeFilter === 'all') return rebates;
    if (activeFilter === 'pending') return rebates.filter((r) => r.status === 'pending');
    if (activeFilter === 'submitted') return rebates.filter((r) => r.status === 'submitted' || r.status === 'approved');
    if (activeFilter === 'received') return rebates.filter((r) => r.status === 'received');
    return rebates;
  }, [rebates, activeFilter]);

  const filterCounts = useMemo(() => ({
    all: rebates.length,
    pending: rebates.filter((r) => (r.status || 'pending') === 'pending').length,
    submitted: rebates.filter((r) => r.status === 'submitted' || r.status === 'approved').length,
    received: rebates.filter((r) => r.status === 'received').length,
  }), [rebates]);

  const resetForm = () => {
    setFormName('');
    setFormType('manufacturer');
    setFormDescription('');
    setFormAmount('');
    setFormClientId('');
    setFormJobId('');
    setFormInvoiceId('');
    setFormReferenceNumber('');
    setFormNotes('');
    setEditingRebate(null);
  };

  const openCreate = () => {
    resetForm();
    setFormModalVisible(true);
  };

  const openEdit = (rebate: Rebate) => {
    setEditingRebate(rebate);
    setFormName(rebate.name);
    setFormType(rebate.rebateType);
    setFormDescription(rebate.description || '');
    setFormAmount(rebate.amount);
    setFormClientId(rebate.clientId || '');
    setFormJobId(rebate.jobId || '');
    setFormInvoiceId(rebate.invoiceId || '');
    setFormReferenceNumber(rebate.referenceNumber || '');
    setFormNotes(rebate.notes || '');
    setFormModalVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert('Required', 'Please enter a rebate name.');
      return;
    }
    if (!formAmount.trim() || isNaN(parseFloat(formAmount))) {
      Alert.alert('Required', 'Please enter a valid amount.');
      return;
    }

    setFormSaving(true);
    try {
      const data = {
        name: formName.trim(),
        rebateType: formType,
        description: formDescription.trim() || null,
        amount: formAmount,
        clientId: formClientId || null,
        jobId: formJobId || null,
        invoiceId: formInvoiceId || null,
        referenceNumber: formReferenceNumber.trim() || null,
        notes: formNotes.trim() || null,
      };

      let res;
      if (editingRebate) {
        res = await api.patch(`/api/rebates/${editingRebate.id}`, data);
      } else {
        res = await api.post('/api/rebates', data);
      }

      if (res.error) {
        Alert.alert('Error', res.error);
      } else {
        setFormModalVisible(false);
        resetForm();
        fetchData();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to save rebate');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (rebate: Rebate) => {
    const ok = await confirm({ title: 'Delete Rebate', message: `Are you sure you want to delete "${rebate.name}"?`, confirmText: 'Delete', cancelText: 'Cancel', destructive: true });
    if (ok) {
      setActionLoading(rebate.id);
      try {
        const res = await api.delete(`/api/rebates/${rebate.id}`);
        if (res.error) {
          Alert.alert('Error', res.error);
        } else {
          fetchData();
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to delete rebate');
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleSubmit = async (rebate: Rebate) => {
    setActionLoading(rebate.id);
    try {
      const res = await api.post(`/api/rebates/${rebate.id}/submit`);
      if (res.error) {
        Alert.alert('Error', res.error);
      } else {
        fetchData();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to submit rebate');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReceive = async (rebate: Rebate) => {
    setActionLoading(rebate.id);
    try {
      const res = await api.post(`/api/rebates/${rebate.id}/receive`);
      if (res.error) {
        Alert.alert('Error', res.error);
      } else {
        fetchData();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to mark rebate as received');
    } finally {
      setActionLoading(null);
    }
  };

  const summaryCards = [
    { label: 'Pending', amount: summary.pending, color: colors.mutedForeground, icon: 'clock' as const },
    { label: 'Submitted', amount: (summary.submitted || 0) + (summary.approved || 0), color: colors.info, icon: 'send' as const },
    { label: 'Received', amount: summary.received, color: colors.success, icon: 'check-circle' as const },
  ];

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'received', label: 'Received' },
  ];

  const renderSummary = () => (
    <View style={styles.summaryRow}>
      {summaryCards.map((card) => (
        <View key={card.label} style={styles.summaryCard}>
          <View style={[styles.summaryIconContainer, { backgroundColor: card.color + '15' }]}>
            <Feather name={card.icon} size={iconSizes.lg} color={card.color} />
          </View>
          <Text style={[styles.summaryValue, { color: card.color }]}>
            {formatCurrency(card.amount)}
          </Text>
          <Text style={styles.summaryLabel}>{card.label}</Text>
        </View>
      ))}
    </View>
  );

  const renderFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
      <View style={styles.filterContainer}>
        {filters.map((filter) => {
          const isActive = activeFilter === filter.key;
          const count = filterCounts[filter.key];
          return (
            <PressableRow key={filter.key} style={[styles.filterChip, isActive && styles.activeFilterChip]} onPress={() => setActiveFilter(filter.key)} >
              <Text style={[styles.filterText, isActive && styles.activeFilterText]}>
                {filter.label}
              </Text>
              <View style={[styles.filterBadge, isActive && styles.activeFilterBadge]}>
                <Text style={[styles.filterBadgeText, isActive && styles.activeFilterBadgeText]}>
                  {count}
                </Text>
              </View>
            </PressableRow>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderRebateCard = (rebate: Rebate) => {
    const statusConfig = getStatusConfig(rebate.status as RebateStatus, colors);
    const isActioning = actionLoading === rebate.id;

    return (
      <View key={rebate.id} style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardLeft}>
            <View style={styles.typeIconContainer}>
              <Feather name={getTypeIcon(rebate.rebateType)} size={iconSizes.lg} color={colors.mutedForeground} />
            </View>
            <View style={styles.cardTitleArea}>
              <Text style={styles.cardTitle} numberOfLines={1}>{rebate.name}</Text>
              <Text style={styles.cardAmount}>{formatCurrency(rebate.amount)}</Text>
            </View>
          </View>
          <PressableRow style={styles.menuButton} onPress={() => { Alert.alert( rebate.name, undefined, [ { text: 'Edit', onPress: () => openEdit(rebate) }, { text: 'Delete', style: 'destructive', onPress: () => handleDelete(rebate) }, { text: 'Cancel', style: 'cancel' }, ] ); }} >
            <Feather name="more-vertical" size={iconSizes.xl} color={colors.mutedForeground} />
          </PressableRow>
        </View>

        {rebate.description ? (
          <Text style={styles.cardDescription} numberOfLines={1}>{rebate.description}</Text>
        ) : null}

        <View style={styles.badgeRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <View style={[styles.statusBadgeDot, { backgroundColor: statusConfig.color }]} />
            <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{getTypeLabel(rebate.rebateType)}</Text>
          </View>
        </View>

        <View style={{ marginTop: spacing.sm }}>
          {rebate.clientId && clientMap.get(rebate.clientId) ? (
            <View style={styles.cardInfoRow}>
              <Feather name="user" size={iconSizes.xs} color={colors.mutedForeground} />
              <Text style={styles.cardInfoText}>{clientMap.get(rebate.clientId)}</Text>
            </View>
          ) : null}
          {rebate.jobId && jobMap.get(rebate.jobId) ? (
            <View style={styles.cardInfoRow}>
              <Feather name="briefcase" size={iconSizes.xs} color={colors.mutedForeground} />
              <Text style={styles.cardInfoText}>{jobMap.get(rebate.jobId)}</Text>
            </View>
          ) : null}
          {rebate.invoiceId && invoiceMap.get(rebate.invoiceId) ? (
            <View style={styles.cardInfoRow}>
              <Feather name="file-text" size={iconSizes.xs} color={colors.mutedForeground} />
              <Text style={styles.cardInfoText}>{invoiceMap.get(rebate.invoiceId)}</Text>
            </View>
          ) : null}
          {rebate.referenceNumber ? (
            <View style={styles.cardInfoRow}>
              <Feather name="hash" size={iconSizes.xs} color={colors.mutedForeground} />
              <Text style={styles.cardInfoText}>Ref: {rebate.referenceNumber}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardActions}>
          {rebate.status === 'pending' && (
            <PressableRow style={[styles.actionButton, styles.actionButtonPrimary]} onPress={() => handleSubmit(rebate)} disabled={isActioning} >
              {isActioning ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Feather name="send" size={iconSizes.sm} color={colors.primary} />
                  <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>Submit</Text>
                </>
              )}
            </PressableRow>
          )}
          {(rebate.status === 'submitted' || rebate.status === 'approved') && (
            <PressableRow style={[styles.actionButton, styles.actionButtonPrimary]} onPress={() => handleReceive(rebate)} disabled={isActioning} >
              {isActioning ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Feather name="check" size={iconSizes.sm} color={colors.primary} />
                  <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>Received</Text>
                </>
              )}
            </PressableRow>
          )}
          <PressableRow style={styles.actionButton} onPress={() => openEdit(rebate)} >
            <Feather name="edit-2" size={iconSizes.sm} color={colors.foreground} />
            <Text style={styles.actionButtonText}>Edit</Text>
          </PressableRow>
          <PressableRow style={[styles.actionButton, styles.actionButtonDestructive]} onPress={() => handleDelete(rebate)} >
            <Feather name="trash-2" size={iconSizes.sm} color={colors.destructive} />
            <Text style={[styles.actionButtonText, styles.actionButtonTextDestructive]}>Delete</Text>
          </PressableRow>
        </View>
      </View>
    );
  };

  const renderPickerModal = (
    visible: boolean,
    onClose: () => void,
    title: string,
    items: { id: string; label: string; sublabel?: string }[],
    selectedId: string,
    onSelect: (id: string) => void,
  ) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.pickerModalContent}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <PressableRow onPress={onClose}>
              <Feather name="x" size={iconSizes['2xl']} color={colors.mutedForeground} />
            </PressableRow>
          </View>
          <PressableRow style={styles.pickerItem} onPress={() => { onSelect(''); onClose(); }} >
            <Text style={[styles.pickerItemText, { color: colors.mutedForeground }]}>None</Text>
            {selectedId === '' && <Feather name="check" size={iconSizes.lg} color={colors.primary} />}
          </PressableRow>
          <ScrollView>
            {items.map((item) => (
              <PressableRow key={item.id} style={styles.pickerItem} onPress={() => { onSelect(item.id); onClose(); }} >
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickerItemText}>{item.label}</Text>
                  {item.sublabel ? <Text style={styles.pickerItemSubtext}>{item.sublabel}</Text> : null}
                </View>
                {selectedId === item.id && <Feather name="check" size={iconSizes.lg} color={colors.primary} />}
              </PressableRow>
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  const renderFormModal = () => (
    <Modal visible={formModalVisible} transparent animationType="slide" onRequestClose={() => setFormModalVisible(false)}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFormModalVisible(false)}>
        <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingRebate ? 'Edit Rebate' : 'Add Rebate'}
            </Text>
            <PressableRow onPress={() => setFormModalVisible(false)}>
              <Feather name="x" size={iconSizes['2xl']} color={colors.mutedForeground} />
            </PressableRow>
          </View>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={[styles.modalLabel, { marginTop: 0 }]}>Rebate Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g., Daikin Cashback, Solar Rebate VIC"
              placeholderTextColor={colors.mutedForeground}
              value={formName}
              onChangeText={setFormName}
            />

            <Text style={styles.modalLabel}>Type</Text>
            {REBATE_TYPE_OPTIONS.map((opt) => {
              const selected = formType === opt.value;
              return (
                <PressableRow key={opt.value} style={[styles.modalOptionRow, selected && styles.modalOptionRowSelected]} onPress={() => setFormType(opt.value)} >
                  <Feather name={opt.icon} size={iconSizes.lg} color={selected ? colors.primary : colors.mutedForeground} />
                  <Text style={[styles.modalOptionText, selected && styles.modalOptionTextSelected]}>
                    {opt.label}
                  </Text>
                  {selected && <Feather name="check" size={iconSizes.lg} color={colors.primary} />}
                </PressableRow>
              );
            })}

            <View style={styles.rowFields}>
              <View style={styles.halfField}>
                <Text style={styles.modalLabel}>Amount ($)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  value={formAmount}
                  onChangeText={setFormAmount}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.modalLabel}>Reference Number</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Optional"
                  placeholderTextColor={colors.mutedForeground}
                  value={formReferenceNumber}
                  onChangeText={setFormReferenceNumber}
                />
              </View>
            </View>

            <Text style={styles.modalLabel}>Description</Text>
            <TextInput
              style={styles.modalTextarea}
              placeholder="Brief description of the rebate"
              placeholderTextColor={colors.mutedForeground}
              value={formDescription}
              onChangeText={setFormDescription}
              multiline
              numberOfLines={2}
            />

            <Text style={styles.modalLabel}>Client (Optional)</Text>
            <PressableRow style={styles.selectButton} onPress={() => setClientPickerVisible(true)}>
              <Text style={formClientId ? styles.selectButtonText : styles.selectButtonPlaceholder}>
                {formClientId ? clientMap.get(formClientId) || 'Select client' : 'Select client'}
              </Text>
              <Feather name="chevron-down" size={iconSizes.lg} color={colors.mutedForeground} />
            </PressableRow>

            <Text style={styles.modalLabel}>Job (Optional)</Text>
            <PressableRow style={styles.selectButton} onPress={() => setJobPickerVisible(true)}>
              <Text style={formJobId ? styles.selectButtonText : styles.selectButtonPlaceholder}>
                {formJobId ? jobMap.get(formJobId) || 'Select job' : 'Select job'}
              </Text>
              <Feather name="chevron-down" size={iconSizes.lg} color={colors.mutedForeground} />
            </PressableRow>

            <Text style={styles.modalLabel}>Invoice (Optional)</Text>
            <PressableRow style={styles.selectButton} onPress={() => setInvoicePickerVisible(true)}>
              <Text style={formInvoiceId ? styles.selectButtonText : styles.selectButtonPlaceholder}>
                {formInvoiceId ? invoiceMap.get(formInvoiceId) || 'Select invoice' : 'Select invoice'}
              </Text>
              <Feather name="chevron-down" size={iconSizes.lg} color={colors.mutedForeground} />
            </PressableRow>

            <Text style={styles.modalLabel}>Notes</Text>
            <TextInput
              style={styles.modalTextarea}
              placeholder="Additional notes..."
              placeholderTextColor={colors.mutedForeground}
              value={formNotes}
              onChangeText={setFormNotes}
              multiline
              numberOfLines={2}
            />

            <PressableRow style={styles.modalSaveButton} onPress={handleSave} disabled={formSaving} >
              {formSaving ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="check" size={iconSizes.lg} color={colors.primaryForeground} />
                  <Text style={styles.modalSaveButtonText}>
                    {editingRebate ? 'Update Rebate' : 'Create Rebate'}
                  </Text>
                </>
              )}
            </PressableRow>

            <PressableRow style={styles.modalCancelButton} onPress={() => setFormModalVisible(false)} >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </PressableRow>

            <View style={{ height: spacing.xl }} />
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Rebates & Credits', headerShown: true }} />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading rebates...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={iconSizes['4xl']} color={colors.destructive} />
          <Text style={styles.errorText}>{error}</Text>
          <PressableRow style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </PressableRow>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
            }
            showsVerticalScrollIndicator={false}
          >
            {renderSummary()}
            {renderFilters()}

            {filteredRebates.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Feather name="dollar-sign" size={iconSizes['2xl']} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyTitle}>No rebates found</Text>
                <Text style={styles.emptySubtitle}>
                  Track manufacturer rebates and government incentives by adding your first rebate.
                </Text>
                <PressableRow style={styles.emptyButton} onPress={openCreate} >
                  <Feather name="plus" size={iconSizes.lg} color={colors.primaryForeground} />
                  <Text style={styles.emptyButtonText}>Add Rebate</Text>
                </PressableRow>
              </View>
            ) : (
              filteredRebates.map(renderRebateCard)
            )}
          </ScrollView>

          <PressableRow style={styles.fab} onPress={openCreate} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="plus" size={iconSizes['2xl']} color={colors.primaryForeground} />
          </PressableRow>
        </>
      )}

      {renderFormModal()}

      {renderPickerModal(
        clientPickerVisible,
        () => setClientPickerVisible(false),
        'Select Client',
        clients.map((c) => ({ id: c.id, label: c.name })),
        formClientId,
        setFormClientId,
      )}

      {renderPickerModal(
        jobPickerVisible,
        () => setJobPickerVisible(false),
        'Select Job',
        jobs.map((j) => ({ id: j.id, label: j.title })),
        formJobId,
        setFormJobId,
      )}

      {renderPickerModal(
        invoicePickerVisible,
        () => setInvoicePickerVisible(false),
        'Select Invoice',
        invoices.map((i) => ({ id: i.id, label: i.number || `Invoice ${i.id}` })),
        formInvoiceId,
        setFormInvoiceId,
      )}
    </View>
  );
}
