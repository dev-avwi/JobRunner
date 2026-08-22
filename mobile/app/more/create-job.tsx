import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePicker } from '../../src/components/ui/DatePicker';
import { TimePicker } from '../../src/components/ui/TimePicker';
import { useAuthStore, useClientsStore, useJobsStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import api from '../../src/lib/api';
import offlineStorage, { useOfflineStore } from '../../src/lib/offline-storage';
import { useUserRole } from '../../src/hooks/use-user-role';
import { typography, fontWeights, spacing } from '../../src/lib/design-tokens';
import { TeamAvatar } from '../../src/components/TeamAvatar';
import { ProjectSetupSection } from '../../src/components/projectSetup';
import type { DocumentFile, ProjectSetupData } from '../../src/components/projectSetup';
import { DEFAULT_FINANCIAL_SETTINGS, hasAdvancedData, validateProjectSetup } from '../../src/components/projectSetup';
import {
  copyToDurableLocation,
  claimPendingUploadsForJob,
  discardPendingUploadsForRequest,
  persistPendingUploads,
  persistPendingUploadsForRequest,
  uploadPendingDocuments,
  type PendingProjectUpload,
} from '../../src/lib/pending-project-uploads';
import {
  clearPendingProjectCreation,
  getPendingProjectCreation,
  persistPendingProjectCreation,
  replayPendingProjectCreation,
  type PendingProjectCreation,
} from '../../src/lib/pending-project-creation';

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

function createStyles(colors: ThemeColors) {
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
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    headerRight: {
      width: 36,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: spacing.lg,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
      marginBottom: spacing.sm,
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      fontSize: typography.sizes.md,
      color: colors.foreground,
    },
    textArea: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    selector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      minHeight: 52,
    },
    selectorPlaceholder: {
      fontSize: typography.sizes.md,
      color: colors.mutedForeground,
    },
    selectedItem: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: spacing.md,
    },
    clientAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedItemText: {
      flex: 1,
    },
    selectedItemName: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
    },
    selectedItemDetail: {
      fontSize: typography.sizes.sm,
      color: colors.mutedForeground,
    },
    addressInput: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
    },
    addressIcon: {
      marginRight: 10,
    },
    addressField: {
      flex: 1,
      paddingVertical: 14,
      fontSize: typography.sizes.md,
      color: colors.foreground,
    },
    statusDisplay: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    statusText: {
      fontSize: typography.sizes.md,
      color: colors.foreground,
    },
    scheduleRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    clearSchedule: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    clearScheduleText: {
      fontSize: typography.sizes.sm,
      color: colors.destructive,
    },
    actionsContainer: {
      padding: spacing.lg,
      paddingBottom: Platform.OS === 'ios' ? 32 : 16,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      paddingVertical: spacing.lg,
      borderRadius: 12,
    },
    saveButtonText: {
      fontSize: typography.subtitle.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.primaryForeground,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      flex: 1,
      backgroundColor: colors.card,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    modalSearch: {
      backgroundColor: colors.background,
      borderRadius: 10,
      margin: spacing.lg,
      padding: spacing.md,
      fontSize: typography.sizes.md,
      color: colors.foreground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalList: {
      paddingHorizontal: spacing.lg,
    },
    clientItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      borderRadius: 12,
      marginBottom: spacing.sm,
      backgroundColor: colors.background,
    },
    clientItemSelected: {
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    clientItemContent: {
      flex: 1,
    },
    clientItemName: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
    },
    clientItemEmail: {
      fontSize: typography.sizes.sm,
      color: colors.mutedForeground,
      marginTop: spacing.xxs,
    },
    statusItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: 14,
      borderRadius: 12,
      marginBottom: spacing.sm,
      backgroundColor: colors.background,
    },
    statusItemSelected: {
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    statusItemText: {
      flex: 1,
      fontSize: typography.sizes.md,
      color: colors.foreground,
    },
    emptyList: {
      alignItems: 'center',
      paddingVertical: spacing['3xl'],
    },
    emptyListText: {
      fontSize: typography.button.fontSize,
      color: colors.mutedForeground,
    },
    suggestionsCard: {
      backgroundColor: colors.successLight || colors.success + '15',
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.xl,
      borderWidth: 1,
      borderColor: colors.success + '30',
    },
    suggestionsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: 10,
    },
    suggestionsTitle: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.success,
    },
    suggestionsLabel: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
      marginBottom: 6,
    },
    suggestionsChipsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    suggestionChip: {
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    suggestionChipText: {
      fontSize: typography.sizes.sm,
      color: colors.foreground,
    },
    suggestionsLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    suggestionsLoadingText: {
      fontSize: typography.sizes.sm,
      color: colors.mutedForeground,
    },
    addressSuggestionsContainer: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: spacing.xs,
      overflow: 'hidden',
    },
    addressSuggestionItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 14,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 10,
    },
    addressSuggestionText: {
      flex: 1,
      fontSize: typography.button.fontSize,
      color: colors.foreground,
    },
    addressLoadingRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: spacing.sm,
    },
  });
}

function ClientSelector({
  clients,
  selectedId,
  onSelect,
  visible,
  onClose,
  colors,
  onQuickAdd,
}: {
  clients: any[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  visible: boolean;
  onClose: () => void;
  colors: ThemeColors;
  onQuickAdd?: () => void;
}) {
  const [search, setSearch] = useState('');
  const styles = useMemo(() => createStyles(colors), [colors]);

  const filteredClients = clients.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppBottomSheet
        visible={visible}
        onDismiss={onClose}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
      <View style={{ flex: 1 }}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Client (Optional)</Text>
            <PressableRow onPress={onClose}>
              <Feather name="x" size={24} color={colors.foreground} />
            </PressableRow>
          </View>

          <PressableRow style={[styles.clientItem, !selectedId && styles.clientItemSelected]} onPress={() => { onSelect(null); onClose(); }} >
            <Text style={styles.clientItemName}>No Client</Text>
            {!selectedId && <Feather name="check" size={20} color={colors.primary} />}
          </PressableRow>

          <TextInput
            style={styles.modalSearch}
            placeholder="Search clients..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
          />

          {onQuickAdd && (
            <PressableRow style={[styles.clientItem, { backgroundColor: colors.primaryLight, borderColor: colors.primary, marginBottom: spacing.sm }]} onPress={onQuickAdd} >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Feather name="plus-circle" size={20} color={colors.primary} />
                <Text style={[styles.clientItemName, { color: colors.primary }]}>Quick Add New Client</Text>
              </View>
            </PressableRow>
          )}

          <ScrollView style={styles.modalList}>
            {filteredClients.map((client) => (
              <PressableRow key={client.id} style={[ styles.clientItem, selectedId === client.id && styles.clientItemSelected, ]} onPress={() => { onSelect(client.id); onClose(); }} >
                <View style={styles.clientItemContent}>
                  <Text style={styles.clientItemName}>{client.name}</Text>
                  <Text style={styles.clientItemEmail}>{client.email}</Text>
                </View>
                {selectedId === client.id && (
                  <Feather name="check" size={20} color={colors.primary} />
                )}
              </PressableRow>
            ))}
            {filteredClients.length === 0 && (
              <View style={styles.emptyList}>
                <Text style={styles.emptyListText}>No clients found</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </AppBottomSheet>
  );
}

function StatusSelector({
  selectedStatus,
  onSelect,
  visible,
  onClose,
  colors,
}: {
  selectedStatus: JobStatus;
  onSelect: (status: JobStatus) => void;
  visible: boolean;
  onClose: () => void;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const STATUS_OPTIONS: { value: JobStatus; label: string; color: string }[] = [
    { value: 'pending', label: 'Pending', color: colors.pending },
    { value: 'scheduled', label: 'Scheduled', color: colors.scheduled },
    { value: 'in_progress', label: 'In Progress', color: colors.inProgress },
    { value: 'done', label: 'Done', color: colors.done },
    { value: 'invoiced', label: 'Invoiced', color: colors.invoiced },
  ];

  return (
    <AppBottomSheet
        visible={visible}
        onDismiss={onClose}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
      <View style={{ flex: 1 }}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Status</Text>
            <PressableRow onPress={onClose}>
              <Feather name="x" size={24} color={colors.foreground} />
            </PressableRow>
          </View>

          <ScrollView style={styles.modalList}>
            {STATUS_OPTIONS.map((status) => (
              <PressableRow key={status.value} style={[ styles.statusItem, selectedStatus === status.value && styles.statusItemSelected, ]} onPress={() => { onSelect(status.value); onClose(); }} >
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Text style={styles.statusItemText}>{status.label}</Text>
                {selectedStatus === status.value && (
                  <Feather name="check" size={20} color={colors.primary} />
                )}
              </PressableRow>
            ))}
          </ScrollView>
        </View>
      </View>
    </AppBottomSheet>
  );
}

type JobType = 'service' | 'project';

export default function CreateJobScreen() {
  const params = useLocalSearchParams<{ clientId?: string; recurring?: string; enquiryName?: string; enquiryPhone?: string; smsConversationId?: string }>();
  const { clients, fetchClients } = useClientsStore();
  const { fetchJobs } = useJobsStore();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const { isOwner, isManager, isStandaloneSubcontractor, isLoading: isRoleLoading } = useUserRole();
  const canCreateJob = isOwner || isManager || isStandaloneSubcontractor;

  // Job type: null = show picker; 'service' | 'project' = show form
  const [jobType, setJobType] = useState<JobType | null>(null);

  const isFromEnquiry = !!(params.enquiryName || params.enquiryPhone);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(isFromEnquiry ? `Enquiry from ${params.enquiryName || params.enquiryPhone || 'unknown'}` : '');
  const [clientId, setClientId] = useState<string | null>(params.clientId || null);
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<JobStatus>('pending');
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [notes, setNotes] = useState('');

  // Advanced project setup (phases, POs, claims, docs, etc.)
  const [projectSetupData, setProjectSetupData] = useState<ProjectSetupData>({
    phases: [],
    purchaseOrders: [],
    claimStages: [],
    checklistItems: [],
    requiredInformation: [],
    documents: [],
    financialSettings: DEFAULT_FINANCIAL_SETTINGS,
  });

  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [assignedToIds, setAssignedToIds] = useState<Set<string>>(new Set());
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [showQuickAddClient, setShowQuickAddClient] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isOnline = useOfflineStore((state) => state.isOnline);
  const clientGeneratedIdRef = useRef<string | null>(null);
  const creationRecoveryAttemptedRef = useRef(false);
  const [prefillSuggestions, setPrefillSuggestions] = useState<any>(null);
  const [loadingPrefill, setLoadingPrefill] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientEmail, setQuickClientEmail] = useState('');
  const [quickClientPhone, setQuickClientPhone] = useState('');
  const [isAddingClient, setIsAddingClient] = useState(false);

  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [addressLatLng, setAddressLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchAddresses = useCallback(async (query: string) => {
    if (query.length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }
    setAddressSearching(true);
    try {
      const encoded = encodeURIComponent(query);
      const response = await api.get<any[]>(`/api/address-search?q=${encoded}`);
      if (response.data && response.data.length > 0) {
        setAddressSuggestions(response.data);
        setShowAddressSuggestions(true);
      } else {
        setAddressSuggestions([]);
        setShowAddressSuggestions(false);
      }
    } catch (error) {
      if (__DEV__) console.log('Address search error:', error);
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
    } finally {
      setAddressSearching(false);
    }
  }, []);

  const handleAddressChange = useCallback((text: string) => {
    setAddress(text);
    setAddressLatLng(null);
    if (addressDebounceRef.current) {
      clearTimeout(addressDebounceRef.current);
    }
    addressDebounceRef.current = setTimeout(() => {
      searchAddresses(text);
    }, 400);
  }, [searchAddresses]);

  const handleAddressSelect = useCallback(async (suggestion: any) => {
    setAddress(suggestion.description);
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);

    if (suggestion.lat && suggestion.lng) {
      setAddressLatLng({ lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lng) });
    } else if (suggestion.place_id && suggestion.provider === 'google') {
      try {
        const response = await api.get<any>(`/api/address-search/details?place_id=${suggestion.place_id}`);
        if (response.data?.lat && response.data?.lng) {
          setAddressLatLng({ lat: response.data.lat, lng: response.data.lng });
        }
      } catch (error) {
        if (__DEV__) console.log('Address details error:', error);
      }
    }
  }, []);

  // Recurring job state
  const [isRecurring, setIsRecurring] = useState(params.recurring === 'true');
  const [recurrencePattern, setRecurrencePattern] = useState<'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false);

  const RECURRENCE_OPTIONS = [
    { value: 'weekly' as const, label: 'Weekly' },
    { value: 'fortnightly' as const, label: 'Fortnightly (2 weeks)' },
    { value: 'monthly' as const, label: 'Monthly' },
    { value: 'quarterly' as const, label: 'Quarterly (3 months)' },
    { value: 'yearly' as const, label: 'Yearly' },
  ];

  const calculateNextRecurrenceDate = (baseDate: string, pattern: string): string => {
    const date = new Date(baseDate);
    switch (pattern) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'fortnightly':
        date.setDate(date.getDate() + 14);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
    }
    return date.toISOString();
  };

  const STATUS_OPTIONS: { value: JobStatus; label: string; color: string }[] = [
    { value: 'pending', label: 'Pending', color: colors.pending },
    { value: 'scheduled', label: 'Scheduled', color: colors.scheduled },
    { value: 'in_progress', label: 'In Progress', color: colors.inProgress },
    { value: 'done', label: 'Done', color: colors.done },
    { value: 'invoiced', label: 'Invoiced', color: colors.invoiced },
  ];

  const PRIORITY_OPTIONS: { value: 'low' | 'medium' | 'high' | 'urgent'; label: string; color: string; icon: string }[] = [
    { value: 'low', label: 'Low', color: '#6B7280', icon: 'minus' },
    { value: 'medium', label: 'Medium', color: '#F59E0B', icon: 'minus-circle' },
    { value: 'high', label: 'High', color: '#EF4444', icon: 'alert-triangle' },
    { value: 'urgent', label: 'Urgent', color: '#DC2626', icon: 'alert-octagon' },
  ];

  const selectedPriorityOption = PRIORITY_OPTIONS.find((p) => p.value === priority);
  const selectedTeamMembers = teamMembers.filter((m) => assignedToIds.has(String(m.memberId || m.id)));

  const getTeamMemberDisplayName = (member: any): string => {
    if (member.name && member.name.trim()) return member.name;
    const fullName = [member.firstName, member.lastName].filter(Boolean).join(' ');
    if (fullName.trim()) return fullName;
    if (member.email) return member.email.split('@')[0];
    if (member.username) return member.username;
    return member.roleName || 'Team Member';
  };

  const getTeamMemberSubtitle = (member: any): string => {
    if (member.email) return member.email;
    return member.roleName || member.role?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Team Member';
  };

  const reconcilePendingProjectCreation: (
    pending: PendingProjectCreation,
  ) => Promise<void> = useCallback(async (pending) => {
    clientGeneratedIdRef.current = pending.requestId;
    if (!useOfflineStore.getState().isOnline) {
      Alert.alert(
        'Project Creation Waiting',
        'A previous Project creation is saved on this device and still needs to be checked. Connect to the internet, then tap Create Project to recover it safely.',
      );
      return;
    }

    setIsSaving(true);
    try {
      const response = await replayPendingProjectCreation(
        pending,
        (payload) => api.post<{ id?: string }>('/api/jobs', payload),
      );
      const jobId = response.data?.id;
      if (!jobId) {
        Alert.alert(
          'Project Creation Needs Attention',
          `${response.error || 'The saved Project creation could not be checked.'}\n\nKeep it for a safe retry, or discard the saved attempt if you are certain you no longer need it.`,
          [
            {
              text: 'Discard Attempt',
              style: 'destructive',
              onPress: async () => {
                await discardPendingUploadsForRequest(pending.requestId);
                await clearPendingProjectCreation(pending.userId, pending.requestId);
                clientGeneratedIdRef.current = null;
              },
            },
            { text: 'Keep for Retry', style: 'cancel' },
          ],
        );
        return;
      }

      if (pending.postCreate?.assignedToIds?.length) {
        await api.post(`/api/jobs/${jobId}/multi-assign`, {
          workerIds: pending.postCreate.assignedToIds,
        });
      }
      if (pending.postCreate?.smsConversationId) {
        await api.patch(`/api/sms/conversations/${pending.postCreate.smsConversationId}`, { jobId });
      }

      try {
        const pendingDocuments = await claimPendingUploadsForJob(pending.requestId, jobId);
        const failedDocuments = await uploadPendingDocuments(jobId, pendingDocuments);
        await persistPendingUploads(jobId, failedDocuments);
        await clearPendingProjectCreation(pending.userId, pending.requestId);
        await fetchJobs();

        Alert.alert(
          'Project Recovered',
          failedDocuments.length > 0
            ? `The Project was already created. ${failedDocuments.length} document${failedDocuments.length === 1 ? '' : 's'} are still saved on this device and can be retried from the Project.`
            : 'The previous Project creation was recovered successfully.',
          [
            { text: 'View Project', onPress: () => router.replace(`/job/${jobId}`) },
            { text: 'Back to Jobs', onPress: () => router.back(), style: 'cancel' },
          ],
        );
      } catch (queueError) {
        if (__DEV__) console.log('Failed to reconcile recovered project documents:', queueError);
        Alert.alert(
          'Project Recovered',
          'The Project was already created, but its selected documents are still waiting on this device. Open the Project to finish recovering them.',
          [{ text: 'View Project', onPress: () => router.replace(`/job/${jobId}`) }],
        );
      }
    } finally {
      setIsSaving(false);
    }
  }, [fetchJobs]);

  useEffect(() => {
    fetchClients();
    fetchTeamMembers();
  }, []);

  useEffect(() => {
    if (isRoleLoading || !canCreateJob || creationRecoveryAttemptedRef.current) return;
    creationRecoveryAttemptedRef.current = true;
    if (!currentUserId) return;
    getPendingProjectCreation(currentUserId)
      .then((pending) => {
        if (pending) return reconcilePendingProjectCreation(pending);
      })
      .catch((error) => {
        if (__DEV__) console.log('Failed to check pending project creation:', error);
      });
  }, [canCreateJob, currentUserId, isRoleLoading, reconcilePendingProjectCreation]);

  const fetchTeamMembers = async () => {
    setLoadingTeam(true);
    try {
      const response = await api.get<any[]>('/api/team/members');
      if (Array.isArray(response.data)) {
        setTeamMembers(response.data);
      }
    } catch (error) {
      if (__DEV__) console.log('Team members not available:', error);
    } finally {
      setLoadingTeam(false);
    }
  };

  // Handle pre-filled clientId from URL params
  useEffect(() => {
    if (params.clientId && clients.length > 0) {
      const client = clients.find((c) => c.id === params.clientId);
      if (client?.address && !address) {
        setAddress(client.address);
      }
    }
  }, [params.clientId, clients]);

  const selectedClient = clients.find((c) => c.id === clientId);
  const selectedStatusOption = STATUS_OPTIONS.find((s) => s.value === status);

  const handleClientSelect = async (id: string | null) => {
    setClientId(id);
    setPrefillSuggestions(null);
    setLoadingPrefill(false);
    
    if (!id) {
      // Client deselected - reset state and exit early
      return;
    }
    
    const client = clients.find((c) => c.id === id);
    // Auto-fill address from client if empty
    if (client?.address && !address) {
      setAddress(client.address);
    }
    
    // Fetch smart pre-fill suggestions
    setLoadingPrefill(true);
    try {
      const response = await api.get<any>(`/api/clients/${id}/prefill-suggestions`);
      if (response.data) {
        setPrefillSuggestions(response.data);
        // Auto-apply address suggestion if we haven't set one yet
        if (response.data.address && !address && !client?.address) {
          setAddress(response.data.address);
        }
      }
    } catch (error) {
      if (__DEV__) console.log('Pre-fill suggestions not available:', error);
      setPrefillSuggestions(null);
    } finally {
      setLoadingPrefill(false);
    }
  };

  const validateJob = () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a job title');
      return false;
    }
    return true;
  };

  const saveJob = async () => {
    if (!currentUserId) {
      Alert.alert('Sign In Required', 'Please sign in again before creating a Project.');
      return;
    }

    const pendingCreation = await getPendingProjectCreation(currentUserId);
    if (pendingCreation) {
      await reconcilePendingProjectCreation(pendingCreation);
      return;
    }

    if (!validateJob()) return;

    const { isOnline } = useOfflineStore.getState();
    const selectedClient = clients.find(c => c.id === clientId);

    // Advanced project setup has been filled in - requires online save
    const isProject = jobType === 'project';
    const advancedData = isProject && hasAdvancedData(projectSetupData);
    if (advancedData) {
      const setupError = validateProjectSetup(projectSetupData);
      if (setupError) {
        Alert.alert('Check Project Setup', setupError);
        return;
      }
    }
    if (!isOnline && advancedData) {
      Alert.alert(
        'Internet Required',
        'Advanced project setup (phases, POs, claims, documents, and financial settings) can only be saved when online. Please connect to the internet before creating this project, or remove the advanced setup data to save a minimal project offline.'
      );
      return;
    }

    if (!clientGeneratedIdRef.current) {
      clientGeneratedIdRef.current = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    const toPendingUploads = (documents: DocumentFile[]): PendingProjectUpload[] =>
      documents.map((doc) => ({
        clientId: doc.clientId,
        uri: doc.uri,
        name: doc.name,
        mimeType: doc.mimeType,
        title: doc.title,
        category: doc.category,
      }));

    let durableProjectDocuments = projectSetupData.documents;
    if (isProject && durableProjectDocuments.length > 0) {
      try {
        const prepared: DocumentFile[] = [];
        for (const doc of durableProjectDocuments) {
          prepared.push(await copyToDurableLocation(doc));
        }
        durableProjectDocuments = prepared;
        await persistPendingUploadsForRequest(
          clientGeneratedIdRef.current,
          toPendingUploads(durableProjectDocuments),
        );
      } catch (error: any) {
        Alert.alert(
          'Document Not Available',
          error?.message || 'A selected document could not be saved for upload. Remove it or select it again before creating the project.',
        );
        return;
      }
    }

    setIsSaving(true);

    const fs = projectSetupData.financialSettings;

    const jobData: any = {
      clientGeneratedId: clientGeneratedIdRef.current,
      title: title.trim(),
      description: description.trim() || null,
      clientId: clientId || null,
      clientName: selectedClient?.name,
      address: address.trim() || null,
      latitude: addressLatLng?.lat?.toString() || null,
      longitude: addressLatLng?.lng?.toString() || null,
      status,
      priority,
      assignedTo: assignedToIds.size > 0 ? [...assignedToIds][0] : null,
      notes: notes.trim() || null,
      jobType: isProject ? 'project' : 'service',
      // Project-specific financial fields
      ...(isProject && {
        ...(fs.totalBudget ? { budgetedCost: fs.totalBudget } : {}),
        ...(fs.materialMarkupPct ? { materialMarkupPct: fs.materialMarkupPct } : {}),
        ...(fs.equipmentMarkupPct ? { equipmentMarkupPct: fs.equipmentMarkupPct } : {}),
        ...(fs.subcontractorMarkupPct ? { subcontractorMarkupPct: fs.subcontractorMarkupPct } : {}),
        retentionPercent: fs.retentionPercent || '0',
        ...(fs.defectsLiabilityMonths ? { defectsLiabilityMonths: parseInt(fs.defectsLiabilityMonths, 10) } : {}),
        customFields: {
          projectSetup: {
            ...(fs.contractValue ? { contractValue: fs.contractValue } : {}),
            ...(fs.paymentTerms ? { paymentTerms: fs.paymentTerms } : {}),
            ...(fs.depositPercent ? { depositPercent: fs.depositPercent } : {}),
            ...(fs.retentionPercent ? { retentionPercent: fs.retentionPercent } : {}),
            ...(projectSetupData.requiredInformation.length > 0
              ? { requiredInformation: projectSetupData.requiredInformation.map((r) => ({ label: r.label, value: r.value })) }
              : {}),
          },
        },
        // Send initialProjectSetup only if there is advanced data
        ...(advancedData && {
          initialProjectSetup: {
            phases: projectSetupData.phases.map((ph, index) => ({
              clientId: ph.clientId,
              phaseCode: ph.phaseCode.trim() || `P${String(index + 1).padStart(2, '0')}`,
              name: ph.name,
              description: ph.description || null,
              scheduledStart: ph.scheduledStart || null,
              scheduledEnd: ph.scheduledEnd || null,
              budgetedCost: ph.budgetedCost || null,
              assignedUserId: ph.assignedUserId || null,
              assignedUserIds: ph.assignedUserIds?.length ? ph.assignedUserIds : undefined,
              sortOrder: ph.sortOrder,
            })),
            purchaseOrders: projectSetupData.purchaseOrders.map((po) => ({
              poNumber: po.poNumber,
              supplierId: po.supplierId,
              phaseClientId: po.phaseClientId || null,
              requiredDate: po.requiredDate || null,
              terms: po.terms || null,
              notes: po.notes || null,
              items: po.items.map((it) => ({
                description: it.description,
                quantity: Number(it.quantity),
                unitPrice: Number(it.unitPrice),
              })),
            })),
            claimStages: projectSetupData.claimStages.map((cs) => ({
              name: cs.name,
              claimDate: cs.claimDate,
              percentage: Number(cs.percentage),
              retentionPercent: cs.retentionPercent ? Number(cs.retentionPercent) : 0,
              phaseClientId: cs.phaseClientId || null,
            })),
            checklistItems: projectSetupData.checklistItems.map((ci) => ({ title: ci.title })),
            requiredInformation: projectSetupData.requiredInformation.map((r) => ({ label: r.label, value: r.value })),
          },
        }),
      }),
    };

    if (scheduledAt) {
      jobData.scheduledAt = scheduledAt.toISOString();
      if (status === 'pending') {
        jobData.status = 'scheduled';
      }
    }

    if (estimatedDuration) {
      const hours = parseFloat(estimatedDuration);
      if (!isNaN(hours) && hours > 0) {
        jobData.estimatedDuration = Math.round(hours * 60);
      }
    }

    // Add recurring job fields
    if (isRecurring) {
      const baseDate = scheduledAt ? scheduledAt.toISOString() : new Date().toISOString();
      jobData.isRecurring = true;
      jobData.recurrencePattern = recurrencePattern;
      jobData.recurrenceInterval = 1;
      jobData.nextRecurrenceDate = calculateNextRecurrenceDate(baseDate, recurrencePattern);
      if (recurrenceEndDate) {
        jobData.recurrenceEndDate = new Date(recurrenceEndDate).toISOString();
      }
    }
    
    // Offline-first: save offline if no connection (only for minimal service/project jobs)
    if (!isOnline) {
      try {
        await offlineStorage.saveJobOffline(jobData, 'create');
        Alert.alert(
          'Saved Offline', 
          'Job saved locally and will sync when you\'re back online.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } catch (error) {
        console.error('Failed to save job offline:', error);
        Alert.alert('Error', 'Failed to save job offline. Please try again.');
      }
      setIsSaving(false);
      return;
    }

    if (isProject) {
      try {
        await persistPendingProjectCreation({
          userId: currentUserId,
          requestId: clientGeneratedIdRef.current,
          payload: jobData,
          createdAt: new Date().toISOString(),
          postCreate: {
            assignedToIds: [...assignedToIds],
            smsConversationId: params.smsConversationId || null,
          },
        });
      } catch (error) {
        if (__DEV__) console.log('Failed to persist project creation recovery:', error);
        await discardPendingUploadsForRequest(clientGeneratedIdRef.current);
        Alert.alert(
          'Could Not Prepare Project',
          'The Project was not sent because a safe recovery copy could not be saved on this device. Free some storage and try again.',
        );
        setIsSaving(false);
        return;
      }
    }
    
    // Online: try API first, fallback to offline if network error
    try {
      const response = await api.post<{
        id?: string;
        code?: string;
        jobId?: string;
      }>('/api/jobs', jobData);

      if (response.error && !response.data?.id) {
        if (response.data?.code === 'PROJECT_SETUP_INCOMPLETE' && response.data.jobId) {
          const incompleteJobId = response.data.jobId;
          Alert.alert(
            'Project Needs Attention',
            response.error,
            [
              { text: 'View Project', onPress: () => router.replace(`/job/${incompleteJobId}`) },
              { text: 'Back to Jobs', onPress: () => router.back(), style: 'cancel' },
            ],
          );
          setIsSaving(false);
          return;
        }
        Alert.alert(
          isProject ? 'Project Creation Waiting' : 'Error',
          isProject
            ? `${response.error || 'Failed to create Project.'}\n\nThis creation attempt is saved on this device. Tap Create Project again to retry safely without creating a duplicate.`
            : response.error || 'Failed to create job. Please try again.',
        );
        setIsSaving(false);
        return;
      }

      if (response.data?.id) {
        const jobId = response.data.id;

        if (assignedToIds.size > 0) {
          try {
            await api.post(`/api/jobs/${jobId}/multi-assign`, { workerIds: [...assignedToIds] });
          } catch (assignErr) {
            if (__DEV__) console.log('Failed to assign worker on create:', assignErr);
          }
        }
        if (params.smsConversationId) {
          try {
            await api.patch(`/api/sms/conversations/${params.smsConversationId}`, { jobId });
          } catch (linkErr) {
            if (__DEV__) console.log('Failed to link SMS conversation to job:', linkErr);
          }
        }

        const docs = durableProjectDocuments;

        const showUploadRecovery = (failedDocuments: PendingProjectUpload[]) => {
          Alert.alert(
            'Project Created',
            `The project was created successfully, but ${failedDocuments.length} document${failedDocuments.length !== 1 ? 's' : ''} did not upload. They are saved and will keep waiting. Retry now or open the project and finish uploading there.`,
            [
              {
                text: 'Retry Uploads',
                onPress: async () => {
                  setIsSaving(true);
                  const stillFailed = await uploadPendingDocuments(jobId, failedDocuments);
                  await persistPendingUploads(jobId, stillFailed);
                  setIsSaving(false);
                  if (stillFailed.length > 0) {
                    showUploadRecovery(stillFailed);
                  } else {
                    Alert.alert(
                      'Uploads Complete',
                      'All selected documents are now attached to the project.',
                      [{ text: 'View Project', onPress: () => router.replace(`/job/${jobId}`) }],
                    );
                  }
                },
              },
              { text: 'View Project', onPress: () => router.replace(`/job/${jobId}`) },
              { text: 'Back to Jobs', onPress: () => router.back(), style: 'cancel' },
            ],
          );
        };

        let failedDocuments: PendingProjectUpload[] = [];
        if (isProject && docs.length > 0) {
          try {
            // Claim the provisional request queue for this project before
            // uploading. Project detail can perform the same claim after an
            // app restart by using the creationRequestId returned on the job.
            const pending = await claimPendingUploadsForJob(
              clientGeneratedIdRef.current!,
              jobId,
            );
            failedDocuments = await uploadPendingDocuments(jobId, pending);
            await persistPendingUploads(jobId, failedDocuments);
          } catch (queueError) {
            if (__DEV__) console.log('Failed to prepare project document uploads:', queueError);
            Alert.alert(
              'Project Created',
              'The project was created, but its selected documents are still waiting on this device. Open the project to retry them.',
              [{ text: 'View Project', onPress: () => router.replace(`/job/${jobId}`) }],
            );
            setIsSaving(false);
            return;
          }
        }

        if (isProject) {
          await clearPendingProjectCreation(currentUserId, clientGeneratedIdRef.current!);
        }

        await fetchJobs();

        if (failedDocuments.length > 0) {
          showUploadRecovery(failedDocuments);
        } else {
          Alert.alert(
            'Job Created!',
            isFromEnquiry ? 'Job created and linked to the enquiry conversation.' : 'Your job has been created successfully.',
            [
              { text: 'View Job', onPress: () => router.replace(`/job/${jobId}`) },
              { text: 'Back to Jobs', onPress: () => router.back(), style: 'cancel' },
            ]
          );
        }
      }
    } catch (error: any) {
      // Network error - save offline (only if no advanced data)
      if ((error.message?.includes('Network') || error.code === 'ECONNABORTED') && !advancedData && !isProject) {
        try {
          await offlineStorage.saveJobOffline(jobData, 'create');
          Alert.alert(
            'Saved Offline', 
            'Job saved locally and will sync when connection is restored.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
        } catch (offlineError) {
          console.error('Failed to save job offline:', offlineError);
          Alert.alert('Error', 'Failed to save job. Please try again.');
        }
      } else {
        console.error('Save job error:', error);
        Alert.alert(
          isProject ? 'Project Creation Waiting' : 'Error',
          isProject
            ? 'This Project creation attempt is saved on this device. Tap Create Project again when connected to recover it safely.'
            : error.response?.data?.error || 'Failed to save job. Please try again.'
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDateChange = (date: Date) => {
    const newDate = scheduledAt ? new Date(scheduledAt) : new Date();
    newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    setScheduledAt(newDate);
  };

  const handleTimeChange = (time: Date) => {
    const newDate = scheduledAt ? new Date(scheduledAt) : new Date();
    newDate.setHours(time.getHours(), time.getMinutes(), 0, 0);
    setScheduledAt(newDate);
  };

  const handleQuickAddClient = async () => {
    if (!quickClientName.trim()) {
      Alert.alert('Missing Name', 'Please enter a client name');
      return;
    }

    setIsAddingClient(true);
    const { isOnline } = useOfflineStore.getState();
    
    try {
      if (isOnline) {
        const response = await api.post<{ id: string }>('/api/clients', {
          name: quickClientName.trim(),
          email: quickClientEmail.trim() || null,
          phone: quickClientPhone.trim() || null,
        });

        if (response.data?.id) {
          await fetchClients();
          handleClientSelect(response.data.id);
          setShowQuickAddClient(false);
          setQuickClientName('');
          setQuickClientEmail('');
          setQuickClientPhone('');
          Alert.alert('Success', 'Client added successfully');
        }
      } else {
        const savedClient = await offlineStorage.saveClientOffline({
          name: quickClientName.trim(),
          email: quickClientEmail.trim() || undefined,
          phone: quickClientPhone.trim() || undefined,
        }, 'create');

        await fetchClients();
        handleClientSelect(savedClient.id);
        setShowQuickAddClient(false);
        setQuickClientName('');
        setQuickClientEmail('');
        setQuickClientPhone('');
        Alert.alert('Saved Offline', 'Client saved offline. Will sync when back online.');
      }
    } catch (error: any) {
      console.error('Quick add client error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to add client');
    } finally {
      setIsAddingClient(false);
    }
  };

  if (!canCreateJob) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.header}>
            <PressableRow style={styles.backButton} onPress={() => router.back()}>
              <Feather name="chevron-left" size={24} color={colors.foreground} />
            </PressableRow>
            <Text style={styles.headerTitle}>Create Job</Text>
            <View style={styles.headerRight} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'] }}>
            {isRoleLoading ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }}>
                  <Feather name="lock" size={28} color={colors.mutedForeground} />
                </View>
                <Text style={{ fontSize: typography.sizes.lg, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: spacing.sm, textAlign: 'center' }}>
                  Not available
                </Text>
                <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground, textAlign: 'center', marginBottom: spacing['2xl'] }}>
                  You don't have permission to create jobs. Ask your business owner if you need access.
                </Text>
                <PressableRow style={{ paddingHorizontal: spacing['2xl'], paddingVertical: spacing.md, borderRadius: 10, backgroundColor: colors.primary }} onPress={() => router.back()}>
                  <Text style={{ fontSize: typography.sizes.md, fontWeight: fontWeights.semibold, color: colors.primaryForeground }}>Go Back</Text>
                </PressableRow>
              </>
            )}
          </View>
        </View>
      </>
    );
  }

  // ── Job type picker ────────────────────────────────────────────────────────
  if (jobType === null) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.header}>
            <PressableRow style={styles.backButton} onPress={() => router.back()}>
              <Feather name="chevron-left" size={24} color={colors.foreground} />
            </PressableRow>
            <Text style={styles.headerTitle}>Create Job</Text>
            <View style={styles.headerRight} />
          </View>

          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: bottomNavHeight + 24 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={{ fontSize: typography.sizes.xl, fontWeight: fontWeights.bold, color: colors.foreground, marginBottom: spacing.xs }}>
              What kind of job is this?
            </Text>
            <Text style={{ fontSize: typography.sizes.md, color: colors.mutedForeground, marginBottom: spacing['2xl'] }}>
              Choose the type that best fits — only the relevant fields will be shown.
            </Text>

            {/* Service Call card */}
            <PressableRow
              testID="card-job-type-service"
              onPress={() => setJobType('service')}
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: colors.border,
                padding: spacing.lg,
                marginBottom: spacing.lg,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  backgroundColor: colors.primaryLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Feather name="tool" size={26} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: typography.sizes.lg, fontWeight: fontWeights.bold, color: colors.foreground, marginBottom: spacing.xxs }}>
                    Job
                  </Text>
                  <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, lineHeight: 20, marginBottom: spacing.md }}>
                    Simple single-visit jobs — fault finding, repairs, maintenance, and quick call-outs.
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                    {['Client', 'Title', 'Schedule', 'Team', 'Notes'].map((f) => (
                      <View key={f} style={{ backgroundColor: colors.muted, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 6 }}>
                        <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground }}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </View>
            </PressableRow>

            {/* Project card */}
            <PressableRow
              testID="card-job-type-project"
              onPress={() => setJobType('project')}
              style={{
                backgroundColor: colors.card,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: colors.border,
                padding: spacing.lg,
                marginBottom: spacing['2xl'],
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                <View style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  backgroundColor: colors.muted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Feather name="layers" size={26} color={colors.mutedForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: typography.sizes.lg, fontWeight: fontWeights.bold, color: colors.foreground, marginBottom: spacing.xxs }}>
                    Project
                  </Text>
                  <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, lineHeight: 20, marginBottom: spacing.md }}>
                    Multi-phase work with tracked spend — fit-outs, builds, renovations, and long-running contracts.
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                    {['Phases', 'Budget', 'Markup', 'POs', 'Claims'].map((f) => (
                      <View key={f} style={{ backgroundColor: colors.muted, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 6 }}>
                        <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground }}>{f}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </View>
            </PressableRow>
          </ScrollView>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Custom Header */}
        <View style={styles.header}>
          <PressableRow style={styles.backButton} onPress={() => setJobType(null)}>
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </PressableRow>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={styles.headerTitle}>Create Job</Text>
            <View style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: 3,
              borderRadius: 8,
              backgroundColor: jobType === 'project' ? colors.muted : colors.primaryLight,
            }}>
              <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: jobType === 'project' ? colors.mutedForeground : colors.primary }}>
                {jobType === 'project' ? 'Project' : 'Job'}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.content, { paddingBottom: bottomNavHeight + 24 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Job Title */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Job Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Bathroom renovation"
                placeholderTextColor={colors.mutedForeground}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Details about the job..."
                placeholderTextColor={colors.mutedForeground}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Client Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Client (Optional)</Text>
              <PressableRow style={styles.selector} onPress={() => setShowClientPicker(true)} >
                {selectedClient ? (
                  <View style={styles.selectedItem}>
                    <View style={styles.clientAvatar}>
                      <Feather name="user" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.selectedItemText}>
                      <Text style={styles.selectedItemName}>{selectedClient.name}</Text>
                      <Text style={styles.selectedItemDetail}>{selectedClient.email}</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.selectorPlaceholder}>Select a client</Text>
                )}
                <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
              </PressableRow>
            </View>

            {/* Address */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Address</Text>
              <View style={styles.addressInput}>
                <Feather name="map-pin" size={18} color={colors.mutedForeground} style={styles.addressIcon} />
                <TextInput
                  style={styles.addressField}
                  placeholder="Start typing an address..."
                  placeholderTextColor={colors.mutedForeground}
                  value={address}
                  onChangeText={handleAddressChange}
                  onBlur={() => {
                    setTimeout(() => setShowAddressSuggestions(false), 400);
                  }}
                />
                {addressSearching && (
                  <ActivityIndicator size="small" color={colors.mutedForeground} style={{ marginRight: 10 }} />
                )}
                {address.length > 0 && (
                  <PressableRow onPress={() => { setAddress(''); setAddressLatLng(null); setAddressSuggestions([]); setShowAddressSuggestions(false); }} style={{ marginRight: 10 }} >
                    <Feather name="x-circle" size={18} color={colors.mutedForeground} />
                  </PressableRow>
                )}
              </View>
              {showAddressSuggestions && addressSuggestions.length > 0 && (
                <View style={styles.addressSuggestionsContainer}>
                  {addressSuggestions.map((suggestion, index) => (
                    <PressableRow key={`${suggestion.description}-${index}`} style={[ styles.addressSuggestionItem, index === addressSuggestions.length - 1 && { borderBottomWidth: 0 }, ]} onPress={() => handleAddressSelect(suggestion)} >
                      <Feather name="map-pin" size={16} color={colors.primary} />
                      <Text style={styles.addressSuggestionText} numberOfLines={2}>
                        {suggestion.description}
                      </Text>
                    </PressableRow>
                  ))}
                </View>
              )}
            </View>

            {/* Past Job Suggestions */}
            {clientId && loadingPrefill && (
              <View style={styles.suggestionsLoading}>
                <ActivityIndicator size="small" color={colors.success} />
                <Text style={styles.suggestionsLoadingText}>Loading suggestions...</Text>
              </View>
            )}
            
            {clientId && prefillSuggestions && prefillSuggestions.recentJobDescriptions?.length > 0 && (
              <View style={styles.suggestionsCard}>
                <View style={styles.suggestionsHeader}>
                  <Feather name="clock" size={16} color={colors.success} />
                  <Text style={styles.suggestionsTitle}>Past Jobs</Text>
                </View>
                
                <Text style={styles.suggestionsLabel}>Tap to use as job title:</Text>
                <View style={styles.suggestionsChipsContainer}>
                  {prefillSuggestions.recentJobDescriptions.slice(0, 6).map((jobDesc: string, idx: number) => (
                    <PressableRow key={idx} style={styles.suggestionChip} onPress={() => { setTitle(jobDesc); if (!description) { setDescription(`Repeat work: ${jobDesc}`); } }} testID={`suggestion-chip-${idx}`} >
                      <Text style={styles.suggestionChipText}>{jobDesc}</Text>
                    </PressableRow>
                  ))}
                </View>
              </View>
            )}

            {/* Status */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Status</Text>
              <PressableRow style={styles.selector} onPress={() => setShowStatusPicker(true)} >
                <View style={styles.statusDisplay}>
                  <View style={[styles.statusDot, { backgroundColor: selectedStatusOption?.color }]} />
                  <Text style={styles.statusText}>{selectedStatusOption?.label}</Text>
                </View>
                <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
              </PressableRow>
            </View>

            {/* Priority */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Priority</Text>
              <PressableRow style={styles.selector} onPress={() => setShowPriorityPicker(true)} >
                <View style={styles.statusDisplay}>
                  <View style={[styles.statusDot, { backgroundColor: selectedPriorityOption?.color }]} />
                  <Text style={styles.statusText}>{selectedPriorityOption?.label}</Text>
                </View>
                <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
              </PressableRow>
            </View>

            {/* Team Member Assignment */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Assign To (Optional)</Text>
              <PressableRow style={styles.selector} onPress={() => setShowTeamPicker(true)} >
                {selectedTeamMembers.length > 0 ? (
                  <View style={styles.selectedItem}>
                    {/* Stacked avatars */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {selectedTeamMembers.slice(0, 4).map((m, i) => (
                        <View key={m.memberId || m.id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 4 - i }}>
                          <TeamAvatar
                            name={getTeamMemberDisplayName(m)}
                            email={m.email}
                            userId={String(m.memberId || m.id)}
                            themeColor={m.themeColor}
                            size={32}
                          />
                        </View>
                      ))}
                      {selectedTeamMembers.length > 4 && (
                        <View style={{ marginLeft: -8, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center', zIndex: 0 }}>
                          <Text style={{ fontSize: 11, fontWeight: fontWeights.semibold, color: colors.mutedForeground }}>+{selectedTeamMembers.length - 4}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                      {selectedTeamMembers.length === 1 ? (
                        <>
                          <Text style={styles.selectedItemName}>{getTeamMemberDisplayName(selectedTeamMembers[0])}</Text>
                          <Text style={styles.selectedItemDetail}>{getTeamMemberSubtitle(selectedTeamMembers[0])}</Text>
                        </>
                      ) : (
                        <Text style={styles.selectedItemName}>{selectedTeamMembers.length} workers assigned</Text>
                      )}
                    </View>
                  </View>
                ) : (
                  <Text style={styles.selectorPlaceholder}>
                    {loadingTeam ? 'Loading team...' : 'Select team member'}
                  </Text>
                )}
                <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
              </PressableRow>
            </View>

            {/* Schedule Date/Time */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Schedule (Optional)</Text>
              <View style={styles.scheduleRow}>
                <View style={{ flex: 1 }}>
                  <DatePicker
                    value={scheduledAt || new Date()}
                    onChange={handleDateChange}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TimePicker
                    value={scheduledAt || new Date()}
                    onChange={handleTimeChange}
                  />
                </View>
              </View>

              {scheduledAt && (
                <PressableRow style={styles.clearSchedule} onPress={() => setScheduledAt(null)} >
                  <Feather name="x" size={14} color={colors.destructive} />
                  <Text style={styles.clearScheduleText}>Clear schedule</Text>
                </PressableRow>
              )}
            </View>

            {/* Estimated Duration */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Estimated Duration (Hours)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 4"
                placeholderTextColor={colors.mutedForeground}
                value={estimatedDuration}
                onChangeText={setEstimatedDuration}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Internal Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Private notes (not visible to client)..."
                placeholderTextColor={colors.mutedForeground}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Guided Project Setup (expandable and optional) */}
            {jobType === 'project' && (
              <ProjectSetupSection
                data={projectSetupData}
                onChange={setProjectSetupData}
                teamMembers={teamMembers}
                isOffline={!isOnline}
              />
            )}

            {/* Recurring Job Section */}
            <View style={[styles.section, { backgroundColor: colors.card, padding: spacing.lg, borderRadius: 12, borderWidth: 1, borderColor: colors.border }]}>
              <PressableRow style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} onPress={() => setIsRecurring(!isRecurring)} >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: spacing.lg }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }}>
                    <Feather name="repeat" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: typography.sizes.md, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: spacing.xxs }}>Make this recurring</Text>
                    <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>
                      Automatically create jobs on a schedule
                    </Text>
                  </View>
                </View>
                <View style={[
                  { width: 50, height: 30, borderRadius: 15, justifyContent: 'center', paddingHorizontal: spacing.xxs },
                  { backgroundColor: isRecurring ? colors.primary : colors.muted }
                ]}>
                  <View style={[
                    { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.white },
                    { alignSelf: isRecurring ? 'flex-end' : 'flex-start' }
                  ]} />
                </View>
              </PressableRow>

              {isRecurring && (
                <View style={{ marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <View style={{ marginBottom: spacing.lg }}>
                    <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginBottom: 6 }}>Frequency</Text>
                    <PressableRow style={styles.selector} onPress={() => setShowRecurrenceOptions(true)} >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Feather name="repeat" size={16} color={colors.primary} />
                        <Text style={{ fontSize: typography.sizes.md, fontWeight: fontWeights.medium, color: colors.foreground }}>
                          {RECURRENCE_OPTIONS.find(o => o.value === recurrencePattern)?.label || 'Select frequency'}
                        </Text>
                      </View>
                      <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
                    </PressableRow>
                  </View>

                  <View style={{ marginBottom: spacing.lg }}>
                    <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginBottom: 6 }}>End Date (Optional)</Text>
                    <View style={{ position: 'relative' }}>
                      <Feather name="calendar" size={16} color={colors.mutedForeground} style={{ position: 'absolute', left: 14, top: 16, zIndex: 1 }} />
                      <TextInput
                        style={[styles.input, { paddingLeft: spacing['4xl'] }]}
                        value={recurrenceEndDate}
                        onChangeText={setRecurrenceEndDate}
                        placeholder="YYYY-MM-DD (leave empty for no end)"
                        placeholderTextColor={colors.mutedForeground}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primaryLight, padding: spacing.md, borderRadius: 10 }}>
                    <Feather name="info" size={14} color={colors.primary} />
                    <Text style={{ flex: 1, fontSize: typography.sizes.sm, color: colors.primary }}>
                      Next job will be created on{' '}
                      {new Date(calculateNextRecurrenceDate(
                        scheduledAt ? scheduledAt.toISOString() : new Date().toISOString(),
                        recurrencePattern
                      )).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Save Button */}
          <View style={[styles.actionsContainer, { paddingBottom: bottomNavHeight }]}>
            <PressableRow style={styles.saveButton} onPress={saveJob} disabled={isSaving} testID="button-create-job">
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Feather name="save" size={20} color={colors.white} />
                  <Text style={styles.saveButtonText}>Create Job</Text>
                </>
              )}
            </PressableRow>
          </View>
        </KeyboardAvoidingView>
      </View>

      <ClientSelector
        clients={clients}
        selectedId={clientId}
        onSelect={handleClientSelect}
        visible={showClientPicker}
        onClose={() => setShowClientPicker(false)}
        colors={colors}
        onQuickAdd={() => {
          // Close the picker modal FIRST and wait for it to fully unmount
          // (close animation + safety unmount ~280ms) before presenting the
          // quick-add modal. Opening a second native Modal while the first is
          // still dismissing collides on iOS and leaves an invisible backdrop
          // that freezes the whole screen.
          setShowClientPicker(false);
          setTimeout(() => setShowQuickAddClient(true), 350);
        }}
      />

      <StatusSelector
        selectedStatus={status}
        onSelect={setStatus}
        visible={showStatusPicker}
        onClose={() => setShowStatusPicker(false)}
        colors={colors}
      />

      {/* Priority Picker Modal */}
      <AppBottomSheet
        visible={showPriorityPicker}
        onDismiss={() => setShowPriorityPicker(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={{ flex: 1 }}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Priority</Text>
              <PressableRow onPress={() => setShowPriorityPicker(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </PressableRow>
            </View>

            <ScrollView style={styles.modalList}>
              {PRIORITY_OPTIONS.map((option) => (
                <PressableRow key={option.value} style={[ styles.statusItem, priority === option.value && styles.statusItemSelected, ]} onPress={() => { setPriority(option.value); setShowPriorityPicker(false); }} >
                  <Feather name={option.icon as any} size={18} color={option.color} />
                  <Text style={[styles.statusItemText, { color: option.color, fontWeight: priority === option.value ? fontWeights.semibold : fontWeights.regular }]}>
                    {option.label}
                  </Text>
                  {priority === option.value && (
                    <Feather name="check" size={20} color={colors.primary} />
                  )}
                </PressableRow>
              ))}
            </ScrollView>
          </View>
        </View>
      </AppBottomSheet>

      {/* Team Member Picker Modal */}
      <AppBottomSheet
        visible={showTeamPicker}
        onDismiss={() => setShowTeamPicker(false)}
        title="Assign Team Member"
        scrollable={false}
        contentPadding={0}
        footer={
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.sm }}>
            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                borderRadius: 10,
                paddingVertical: spacing.md,
                alignItems: 'center',
              }}
              onPress={() => setShowTeamPicker(false)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.primaryForeground }}>
                {assignedToIds.size > 0 ? `Assign ${assignedToIds.size} Worker${assignedToIds.size !== 1 ? 's' : ''}` : 'Done'}
              </Text>
            </TouchableOpacity>
          </View>
        }
      >
        <View>
          {assignedToIds.size > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
              <Feather name="check-circle" size={14} color={colors.primary} />
              <Text style={{ ...typography.caption, color: colors.primary, fontWeight: fontWeights.semibold }}>
                {assignedToIds.size} worker{assignedToIds.size !== 1 ? 's' : ''} selected
              </Text>
            </View>
          )}
          <ScrollView style={styles.modalList}>
            {/* Unassigned row */}
            <TouchableOpacity
              style={[
                styles.clientItem,
                assignedToIds.size === 0 && styles.clientItemSelected,
                { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
              ]}
              onPress={() => setAssignedToIds(new Set())}
              activeOpacity={0.7}
            >
              <View style={{
                width: 22, height: 22, borderRadius: 11,
                borderWidth: 2,
                borderColor: assignedToIds.size === 0 ? colors.primary : colors.border,
                backgroundColor: assignedToIds.size === 0 ? colors.primary : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {assignedToIds.size === 0 && <Feather name="check" size={13} color={colors.primaryForeground} />}
              </View>
              <Text style={[styles.clientItemName, { flex: 1 }]}>Unassigned</Text>
            </TouchableOpacity>

            {teamMembers.map((member) => {
              const memberId = String(member.memberId || member.id);
              const isSelected = assignedToIds.has(memberId);
              return (
                <TouchableOpacity
                  key={memberId}
                  style={[
                    styles.clientItem,
                    isSelected && styles.clientItemSelected,
                    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
                  ]}
                  onPress={() => {
                    const next = new Set(assignedToIds);
                    if (next.has(memberId)) { next.delete(memberId); } else { next.add(memberId); }
                    setAssignedToIds(next);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{
                    width: 22, height: 22, borderRadius: 4,
                    borderWidth: 2,
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSelected && <Feather name="check" size={13} color={colors.primaryForeground} />}
                  </View>
                  <TeamAvatar
                    name={getTeamMemberDisplayName(member)}
                    email={member.email}
                    userId={memberId}
                    themeColor={member.themeColor}
                    size={36}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clientItemName}>{getTeamMemberDisplayName(member)}</Text>
                    <Text style={styles.clientItemEmail}>{getTeamMemberSubtitle(member)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {teamMembers.length === 0 && !loadingTeam && (
              <View style={styles.emptyList}>
                <Text style={styles.emptyListText}>No team members found</Text>
              </View>
            )}
            {loadingTeam && (
              <View style={styles.emptyList}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
          </ScrollView>
        </View>
      </AppBottomSheet>

      <AppBottomSheet
        visible={showQuickAddClient}
        onDismiss={() => setShowQuickAddClient(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <View style={{ flex: 1 }}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Quick Add Client</Text>
                <PressableRow onPress={() => setShowQuickAddClient(false)} testID="button-close-quick-add" >
                  <Feather name="x" size={24} color={colors.foreground} />
                </PressableRow>
              </View>
              
              <ScrollView 
                style={{ maxHeight: 400 }} 
                contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
                keyboardShouldPersistTaps="handled"
              >
                <View>
                  <Text style={styles.sectionTitle}>Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Client name"
                    placeholderTextColor={colors.mutedForeground}
                    value={quickClientName}
                    onChangeText={setQuickClientName}
                    autoFocus
                    testID="input-quick-client-name"
                  />
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="client@email.com"
                    placeholderTextColor={colors.mutedForeground}
                    value={quickClientEmail}
                    onChangeText={setQuickClientEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    testID="input-quick-client-email"
                  />
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Phone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0400 000 000"
                    placeholderTextColor={colors.mutedForeground}
                    value={quickClientPhone}
                    onChangeText={setQuickClientPhone}
                    keyboardType="phone-pad"
                    testID="input-quick-client-phone"
                  />
                </View>
                
                <PressableRow style={[styles.saveButton, { marginTop: spacing.sm, opacity: isAddingClient ? 0.6 : 1 }]} onPress={handleQuickAddClient} disabled={isAddingClient} testID="button-add-quick-client" >
                  {isAddingClient ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Feather name="plus" size={18} color={colors.white} />
                      <Text style={styles.saveButtonText}>Add Client</Text>
                    </>
                  )}
                </PressableRow>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </AppBottomSheet>

      {/* Recurrence Options Modal */}
      <AppBottomSheet
        visible={showRecurrenceOptions}
        onDismiss={() => setShowRecurrenceOptions(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={{ flex: 1 }}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Frequency</Text>
              <PressableRow onPress={() => setShowRecurrenceOptions(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </PressableRow>
            </View>

            <ScrollView style={styles.modalList}>
              {RECURRENCE_OPTIONS.map((option) => (
                <PressableRow key={option.value} style={[ styles.statusItem, recurrencePattern === option.value && styles.statusItemSelected, ]} onPress={() => { setRecurrencePattern(option.value); setShowRecurrenceOptions(false); }} >
                  <Feather 
                    name="repeat" 
                    size={18} 
                    color={recurrencePattern === option.value ? colors.primary : colors.mutedForeground} 
                  />
                  <Text style={[
                    styles.statusItemText,
                    recurrencePattern === option.value && { color: colors.primary, fontWeight: fontWeights.semibold }
                  ]}>
                    {option.label}
                  </Text>
                  {recurrencePattern === option.value && (
                    <Feather name="check" size={20} color={colors.primary} />
                  )}
                </PressableRow>
              ))}
            </ScrollView>
          </View>
        </View>
      </AppBottomSheet>
    </>
  );
}
