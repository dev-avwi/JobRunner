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
import { useClientsStore, useJobsStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import api from '../../src/lib/api';
import offlineStorage, { useOfflineStore } from '../../src/lib/offline-storage';
import { useUserRole } from '../../src/hooks/use-user-role';

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
      paddingHorizontal: 16,
      paddingVertical: 12,
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
      fontSize: 18,
      fontWeight: '600',
      color: colors.foreground,
    },
    headerRight: {
      width: 36,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 16,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      fontSize: 15,
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
      fontSize: 15,
      color: colors.mutedForeground,
    },
    selectedItem: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
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
      fontSize: 15,
      fontWeight: '500',
      color: colors.foreground,
    },
    selectedItemDetail: {
      fontSize: 13,
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
      fontSize: 15,
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
      fontSize: 15,
      color: colors.foreground,
    },
    scheduleRow: {
      flexDirection: 'row',
      gap: 12,
    },
    clearSchedule: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 8,
    },
    clearScheduleText: {
      fontSize: 13,
      color: colors.destructive,
    },
    actionsContainer: {
      padding: 16,
      paddingBottom: Platform.OS === 'ios' ? 32 : 16,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    saveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
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
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.foreground,
    },
    modalSearch: {
      backgroundColor: colors.background,
      borderRadius: 10,
      margin: 16,
      padding: 12,
      fontSize: 15,
      color: colors.foreground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalList: {
      paddingHorizontal: 16,
    },
    clientItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      borderRadius: 12,
      marginBottom: 8,
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
      fontSize: 15,
      fontWeight: '500',
      color: colors.foreground,
    },
    clientItemEmail: {
      fontSize: 13,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    statusItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      borderRadius: 12,
      marginBottom: 8,
      backgroundColor: colors.background,
    },
    statusItemSelected: {
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    statusItemText: {
      flex: 1,
      fontSize: 15,
      color: colors.foreground,
    },
    emptyList: {
      alignItems: 'center',
      paddingVertical: 32,
    },
    emptyListText: {
      fontSize: 14,
      color: colors.mutedForeground,
    },
    suggestionsCard: {
      backgroundColor: colors.successLight || colors.success + '15',
      borderRadius: 12,
      padding: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.success + '30',
    },
    suggestionsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    suggestionsTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.success,
    },
    suggestionsLabel: {
      fontSize: 12,
      color: colors.mutedForeground,
      marginBottom: 6,
    },
    suggestionsChipsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    suggestionChip: {
      backgroundColor: colors.card,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    suggestionChipText: {
      fontSize: 13,
      color: colors.foreground,
    },
    suggestionsLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
    },
    suggestionsLoadingText: {
      fontSize: 13,
      color: colors.mutedForeground,
    },
    addressSuggestionsContainer: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 4,
      overflow: 'hidden',
    },
    addressSuggestionItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 10,
    },
    addressSuggestionText: {
      flex: 1,
      fontSize: 14,
      color: colors.foreground,
    },
    addressLoadingRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 8,
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
            <PressableRow style={[styles.clientItem, { backgroundColor: colors.primaryLight, borderColor: colors.primary, marginBottom: 8 }]} onPress={onQuickAdd} >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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

export default function CreateJobScreen() {
  const params = useLocalSearchParams<{ clientId?: string; recurring?: string; enquiryName?: string; enquiryPhone?: string; smsConversationId?: string }>();
  const { clients, fetchClients } = useClientsStore();
  const { fetchJobs } = useJobsStore();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const { isOwner, isManager, isStandaloneSubcontractor, isLoading: isRoleLoading } = useUserRole();
  const canCreateJob = isOwner || isManager || isStandaloneSubcontractor;

  const isFromEnquiry = !!(params.enquiryName || params.enquiryPhone);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(isFromEnquiry ? `Enquiry from ${params.enquiryName || params.enquiryPhone || 'unknown'}` : '');
  const [clientId, setClientId] = useState<string | null>(params.clientId || null);
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<JobStatus>('pending');
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [notes, setNotes] = useState('');

  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [assignedToId, setAssignedToId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [showQuickAddClient, setShowQuickAddClient] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
  const selectedTeamMember = teamMembers.find((m) => String(m.memberId || m.id) === assignedToId);

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

  useEffect(() => {
    fetchClients();
    fetchTeamMembers();
  }, []);

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
    if (!validateJob()) return;

    setIsSaving(true);
    
    const { isOnline } = useOfflineStore.getState();
    const selectedClient = clients.find(c => c.id === clientId);

    const jobData: any = {
      title: title.trim(),
      description: description.trim() || null,
      clientId: clientId || null,
      clientName: selectedClient?.name,
      address: address.trim() || null,
      latitude: addressLatLng?.lat?.toString() || null,
      longitude: addressLatLng?.lng?.toString() || null,
      status,
      priority,
      assignedTo: assignedToId || null,
      notes: notes.trim() || null,
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
    
    // Offline-first: save offline if no connection
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
    
    // Online: try API first, fallback to offline if network error
    try {
      const response = await api.post<{ id: string }>('/api/jobs', jobData);

      if (response.data?.id) {
        if (assignedToId) {
          try {
            await api.post(`/api/jobs/${response.data.id}/multi-assign`, { workerIds: [assignedToId] });
          } catch (assignErr) {
            if (__DEV__) console.log('Failed to assign worker on create:', assignErr);
          }
        }
        if (params.smsConversationId) {
          try {
            await api.patch(`/api/sms/conversations/${params.smsConversationId}`, { jobId: response.data.id });
          } catch (linkErr) {
            if (__DEV__) console.log('Failed to link SMS conversation to job:', linkErr);
          }
        }
        await fetchJobs();
        Alert.alert(
          'Job Created!',
          isFromEnquiry ? 'Job created and linked to the enquiry conversation.' : 'Your job has been created successfully.',
          [
            {
              text: 'View Job',
              onPress: () => router.replace(`/job/${response.data!.id}`),
            },
            {
              text: 'Back to Jobs',
              onPress: () => router.back(),
              style: 'cancel',
            },
          ]
        );
      }
    } catch (error: any) {
      // Network error - save offline
      if (error.message?.includes('Network') || error.code === 'ECONNABORTED') {
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
          'Error',
          error.response?.data?.error || 'Failed to save job. Please try again.'
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
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            {isRoleLoading ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Feather name="lock" size={28} color={colors.mutedForeground} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground, marginBottom: 8, textAlign: 'center' }}>
                  Not available
                </Text>
                <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: 'center', marginBottom: 24 }}>
                  You don't have permission to create jobs. Ask your business owner if you need access.
                </Text>
                <PressableRow style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primary }} onPress={() => router.back()}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primaryForeground }}>Go Back</Text>
                </PressableRow>
              </>
            )}
          </View>
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
          <PressableRow style={styles.backButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </PressableRow>
          <Text style={styles.headerTitle}>Create Job</Text>
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
                {selectedTeamMember ? (
                  <View style={styles.selectedItem}>
                    <View style={[styles.clientAvatar, { backgroundColor: (selectedTeamMember.themeColor || colors.primary) + '20' }]}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: selectedTeamMember.themeColor || colors.primary }}>
                        {getTeamMemberDisplayName(selectedTeamMember).charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.selectedItemText}>
                      <Text style={styles.selectedItemName}>{getTeamMemberDisplayName(selectedTeamMember)}</Text>
                      <Text style={styles.selectedItemDetail}>{getTeamMemberSubtitle(selectedTeamMember)}</Text>
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

            {/* Recurring Job Section */}
            <View style={[styles.section, { backgroundColor: colors.card, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border }]}>
              <PressableRow style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} onPress={() => setIsRecurring(!isRecurring)} >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Feather name="repeat" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground, marginBottom: 2 }}>Make this recurring</Text>
                    <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                      Automatically create jobs on a schedule
                    </Text>
                  </View>
                </View>
                <View style={[
                  { width: 50, height: 30, borderRadius: 15, justifyContent: 'center', paddingHorizontal: 2 },
                  { backgroundColor: isRecurring ? colors.primary : colors.muted }
                ]}>
                  <View style={[
                    { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.white },
                    { alignSelf: isRecurring ? 'flex-end' : 'flex-start' }
                  ]} />
                </View>
              </PressableRow>

              {isRecurring && (
                <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 6 }}>Frequency</Text>
                    <PressableRow style={styles.selector} onPress={() => setShowRecurrenceOptions(true)} >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Feather name="repeat" size={16} color={colors.primary} />
                        <Text style={{ fontSize: 15, fontWeight: '500', color: colors.foreground }}>
                          {RECURRENCE_OPTIONS.find(o => o.value === recurrencePattern)?.label || 'Select frequency'}
                        </Text>
                      </View>
                      <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
                    </PressableRow>
                  </View>

                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 6 }}>End Date (Optional)</Text>
                    <View style={{ position: 'relative' }}>
                      <Feather name="calendar" size={16} color={colors.mutedForeground} style={{ position: 'absolute', left: 14, top: 16, zIndex: 1 }} />
                      <TextInput
                        style={[styles.input, { paddingLeft: 40 }]}
                        value={recurrenceEndDate}
                        onChangeText={setRecurrenceEndDate}
                        placeholder="YYYY-MM-DD (leave empty for no end)"
                        placeholderTextColor={colors.mutedForeground}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primaryLight, padding: 12, borderRadius: 10 }}>
                    <Feather name="info" size={14} color={colors.primary} />
                    <Text style={{ flex: 1, fontSize: 13, color: colors.primary }}>
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
            <PressableRow style={styles.saveButton} onPress={saveJob} disabled={isSaving} >
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
                  <Text style={[styles.statusItemText, { color: option.color, fontWeight: priority === option.value ? '600' : '400' }]}>
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
        contentPadding={0}>
        <View>
          <View>
            <View style={{ height: 0 }} />
            <ScrollView style={styles.modalList}>
              <PressableRow style={[styles.clientItem, !assignedToId && styles.clientItemSelected]} onPress={() => { setAssignedToId(null); setShowTeamPicker(false); }} >
                <Text style={styles.clientItemName}>Unassigned</Text>
                {!assignedToId && <Feather name="check" size={20} color={colors.primary} />}
              </PressableRow>

              {teamMembers.map((member) => (
                <PressableRow key={member.memberId || member.id} style={[ styles.clientItem, assignedToId === String(member.memberId || member.id) && styles.clientItemSelected, ]} onPress={() => { setAssignedToId(String(member.memberId || member.id)); setShowTeamPicker(false); }} >
                  <View style={styles.clientItemContent}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={[styles.clientAvatar, { backgroundColor: (member.themeColor || colors.primary) + '20' }]}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: member.themeColor || colors.primary }}>
                          {getTeamMemberDisplayName(member).charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.clientItemName}>{getTeamMemberDisplayName(member)}</Text>
                        <Text style={styles.clientItemEmail}>{getTeamMemberSubtitle(member)}</Text>
                      </View>
                    </View>
                  </View>
                  {assignedToId === String(member.memberId || member.id) && (
                    <Feather name="check" size={20} color={colors.primary} />
                  )}
                </PressableRow>
              ))}

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
                contentContainerStyle={{ padding: 16, gap: 12 }}
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
                
                <PressableRow style={[styles.saveButton, { marginTop: 8, opacity: isAddingClient ? 0.6 : 1 }]} onPress={handleQuickAddClient} disabled={isAddingClient} testID="button-add-quick-client" >
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
                    recurrencePattern === option.value && { color: colors.primary, fontWeight: '600' }
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
