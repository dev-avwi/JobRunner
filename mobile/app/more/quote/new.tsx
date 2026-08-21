import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../../src/components/ui/PressableRow';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { VoiceRecorder } from '../../../src/components/VoiceRecorder';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore, useClientsStore, useQuotesStore } from '../../../src/lib/store';
import { useTheme, ThemeColors, getVisibleButtonColors } from '../../../src/lib/theme';
import { AppBottomSheet } from '../../../src/components/ui/AppBottomSheet';
import api from '../../../src/lib/api';
import offlineStorage, { useOfflineStore } from '../../../src/lib/offline-storage';
import LiveDocumentPreview from '../../../src/components/LiveDocumentPreview';
import { getBottomNavHeight } from '../../../src/components/BottomNav';
import { DatePicker } from '../../../src/components/ui/DatePicker';
import { showToast } from '../../../src/lib/toast';
import { typography, fontWeights, spacing } from '../../../src/lib/design-tokens';

const formatLocalDate = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    stickyHeader: {
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backButtonPressed: {
      backgroundColor: colors.border,
    },
    headerTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
      flex: 1,
      marginLeft: spacing.md,
    },
    totalBadge: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: 12,
    },
    totalBadgeText: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.semibold,
      color: colors.primary,
    },
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: colors.muted,
      borderRadius: 14,
      padding: 5,
      width: '100%',
      alignSelf: 'stretch',
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      borderRadius: 10,
      gap: 10,
    },
    tabContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    tabActive: {
      backgroundColor: colors.primary,
    },
    tabPressed: {
      opacity: 0.8,
    },
    tabActivePressed: {
      backgroundColor: colors.primaryDark,
    },
    tabText: {
      fontSize: typography.sizes.lg,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    tabTextActive: {
      color: colors.primaryForeground,
    },
    previewContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    editContainer: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      paddingTop: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    cardHeaderText: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
    },
    itemCountBadge: {
      backgroundColor: colors.muted,
      paddingHorizontal: 10,
      paddingVertical: spacing.xs,
      borderRadius: 8,
    },
    itemCountText: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
    },
    selectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectPlaceholder: {
      fontSize: typography.sizes.md,
      color: colors.mutedForeground,
    },
    selectedClient: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    clientAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clientAvatarText: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.primary,
    },
    selectedClientText: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
    },
    inputGroup: {
      marginBottom: spacing.lg,
    },
    inputLabel: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 14,
      fontSize: typography.sizes.md,
      color: colors.foreground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    textArea: {
      minHeight: 80,
      paddingTop: 14,
    },
    dateInputWrapper: {
      position: 'relative',
    },
    dateIcon: {
      position: 'absolute',
      left: 14,
      top: 16,
      zIndex: 1,
    },
    dateInput: {
      paddingLeft: spacing['4xl'],
    },
    inputRow: {
      flexDirection: 'row',
    },
    lineItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.muted,
      borderRadius: 10,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    lineItemInfo: {
      flex: 1,
    },
    lineItemDescription: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
      marginBottom: spacing.xxs,
    },
    lineItemMeta: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
    },
    lineItemTotal: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
      marginRight: spacing.sm,
    },
    lineItemActions: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    iconButton: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
      marginHorizontal: spacing.xs,
    },
    addItemButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addItemText: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
    },
    templateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
      marginHorizontal: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
    },
    templateButtonText: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.medium,
      color: colors.primary,
    },
    catalogButton: {
      flex: 1,
      height: 48,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    totalsCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    totalLabel: {
      fontSize: typography.button.fontSize,
      color: colors.mutedForeground,
    },
    totalValue: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
    },
    grandTotalRow: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: spacing.sm,
      paddingTop: spacing.md,
    },
    grandTotalLabel: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    grandTotalValue: {
      fontSize: typography.subtitle.fontSize,
      fontWeight: fontWeights.bold,
      color: colors.foreground,
    },
    depositHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    toggleSwitch: {
      width: 48,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.muted,
      padding: spacing.xxs,
      justifyContent: 'center',
    },
    toggleSwitchOn: {
      backgroundColor: colors.primary,
    },
    toggleKnob: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.white,
    },
    toggleKnobOn: {
      alignSelf: 'flex-end',
    },
    depositOptions: {
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    depositLabel: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
      marginBottom: 10,
    },
    depositPercentRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    depositPercentOption: {
      flex: 1,
      paddingVertical: spacing.md,
      backgroundColor: colors.muted,
      borderRadius: 10,
      alignItems: 'center',
    },
    depositPercentSelected: {
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    depositPercentText: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
    },
    depositPercentTextSelected: {
      color: colors.primary,
    },
    depositAmount: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
      marginTop: spacing.md,
      textAlign: 'center',
    },
    depositCustomRow: {
      marginTop: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.muted,
      borderRadius: 10,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    depositCustomPrefix: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.medium,
      color: colors.mutedForeground,
      marginRight: spacing.xs,
    },
    depositCustomInput: {
      flex: 1,
      paddingVertical: spacing.md,
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderRadius: 12,
      paddingVertical: spacing.lg,
      borderWidth: 1,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      fontSize: typography.subtitle.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.primaryForeground,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    modalContent: {
      flex: 1,
      padding: spacing.lg,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 48,
    },
    emptyStateText: {
      fontSize: typography.button.fontSize,
      color: colors.mutedForeground,
      marginTop: spacing.md,
      marginBottom: spacing.lg,
    },
    createClientButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
    },
    createClientButtonText: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.medium,
      color: colors.primary,
    },
    clientOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    clientOptionAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    clientOptionAvatarText: {
      fontSize: typography.subtitle.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.primary,
    },
    clientOptionInfo: {
      flex: 1,
    },
    clientOptionName: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
    },
    clientOptionEmail: {
      fontSize: typography.sizes.sm,
      color: colors.mutedForeground,
      marginTop: spacing.xxs,
    },
    lineTotalPreview: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.muted,
      borderRadius: 12,
      padding: spacing.lg,
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
    },
    lineTotalLabel: {
      fontSize: typography.button.fontSize,
      color: colors.mutedForeground,
    },
    lineTotalValue: {
      fontSize: typography.sizes.lg,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    saveItemButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    saveItemButtonText: {
      fontSize: typography.subtitle.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.primaryForeground,
    },
    previewHeadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    previewHeadingTitle: {
      fontSize: typography.captionSmall.fontSize,
      fontWeight: fontWeights.medium,
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    previewHeadingBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: colors.muted,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewHeadingBadgeText: {
      fontSize: typography.sizes.xs,
      color: colors.mutedForeground,
    },
  });
}

interface LineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

export default function NewQuoteScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ jobId?: string; clientId?: string; editQuoteId?: string }>();
  const { user, businessSettings } = useAuthStore();
  const { clients, fetchClients, isLoading: isLoadingClients } = useClientsStore();
  const { fetchQuotes, getQuote } = useQuotesStore();
  const { colors, isDark } = useTheme();
  const isEditing = !!params.editQuoteId;
  const { isOnline, pendingSyncCount } = useOfflineStore();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isLoading, setIsLoading] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showLineItemEditor, setShowLineItemEditor] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiPhotos, setAiPhotos] = useState<string[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [showPriceList, setShowPriceList] = useState(false);
  const [priceListItems, setPriceListItems] = useState<any[]>([]);
  const [isLoadingPriceList, setIsLoadingPriceList] = useState(false);
  const [priceListSearch, setPriceListSearch] = useState('');
  const [showQuickAddClient, setShowQuickAddClient] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({ name: '', email: '', phone: '' });
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [showQuoteTemplates, setShowQuoteTemplates] = useState(false);
  const [quoteTemplates, setQuoteTemplates] = useState<any[]>([]);
  const [isLoadingQuoteTemplates, setIsLoadingQuoteTemplates] = useState(false);
  const [quoteTemplateSearch, setQuoteTemplateSearch] = useState('');
  
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [jobId, setJobId] = useState<string | null>(params.jobId || null);
  
  const [form, setForm] = useState({
    clientId: params.clientId || '',
    clientName: '',
    title: '',
    description: '',
    notes: '',
    terms: '',
    validUntil: formatLocalDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    quoteDate: formatLocalDate(new Date()),
    requireDeposit: false,
    depositPercent: '50',
    depositCustomAmount: '',
  });
  
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [editForm, setEditForm] = useState({
    description: '',
    quantity: '1',
    unitPrice: ''
  });

  const bottomNavHeight = getBottomNavHeight(insets.bottom);

  useEffect(() => {
    fetchClients();
  }, []);

  // Auto-fill client when creating quote from job
  useEffect(() => {
    const fetchJobAndSetClient = async () => {
      if (params.jobId && !params.clientId) {
        try {
          const response = await api.get<{ clientId?: string }>(`/api/jobs/${params.jobId}`);
          if (response.data && response.data.clientId) {
            setForm(prev => ({
              ...prev,
              clientId: response.data!.clientId!,
            }));
          }
        } catch (error) {
          console.error('Failed to fetch job for client auto-fill:', error);
        }
      }
    };
    fetchJobAndSetClient();
  }, [params.jobId, params.clientId]);

  useEffect(() => {
    const loadQuoteForEditing = async (quoteId: string) => {
      try {
        type QuoteResp = { clientId?: string; title?: string; description?: string; notes?: string; terms?: string; validUntil?: string; quoteDate?: string; depositRequired?: boolean; depositAmount?: number; depositPercent?: number | string; jobId?: string; lineItems?: Array<{ id?: string; description?: string; quantity?: number | string; unitPrice?: number | string }> };
        const response = await api.get<QuoteResp>(`/api/quotes/${quoteId}`);
        const q = response.data;
        if (q) {
          setForm({
            clientId: q.clientId || '',
            clientName: '',
            title: q.title || '',
            description: q.description || '',
            notes: q.notes || '',
            terms: q.terms || '',
            validUntil: q.validUntil ? formatLocalDate(new Date(q.validUntil)) : formatLocalDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
            quoteDate: q.quoteDate ? formatLocalDate(new Date(q.quoteDate)) : formatLocalDate(new Date()),
            requireDeposit: !!q.depositRequired || !!q.depositAmount,
            depositPercent: q.depositPercent ? String(q.depositPercent) : '50',
            depositCustomAmount: '',
          });
          if (q.jobId) setJobId(q.jobId);
          if (q.lineItems && Array.isArray(q.lineItems)) {
            setLineItems(q.lineItems.map((item: any, idx: number) => ({
              id: item.id || `edit-${idx}`,
              description: item.description || '',
              quantity: String(item.quantity || 1),
              unitPrice: String(item.unitPrice || 0),
            })));
          }
        }
      } catch (error) {
        console.error('Failed to load quote for editing:', error);
        showToast({ type: 'error', message: 'Could not load quote for editing' });
      }
    };
    if (params.editQuoteId) {
      loadQuoteForEditing(params.editQuoteId);
    }
  }, [params.editQuoteId]);

  useEffect(() => {
    if (form.clientId && clients.length > 0 && !form.clientName) {
      const client = clients.find(c => c.id === form.clientId);
      if (client) {
        setForm(prev => ({
          ...prev,
          clientName: client.name,
        }));
      }
    }
  }, [form.clientId, clients, form.clientName]);

  const handleAddLineItem = () => {
    setEditForm({ description: '', quantity: '1', unitPrice: '' });
    setEditingItemIndex(-1);
    setShowLineItemEditor(true);
  };

  const handleEditLineItem = (index: number) => {
    const item = lineItems[index];
    setEditForm({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    });
    setEditingItemIndex(index);
    setShowLineItemEditor(true);
  };

  const handleSaveLineItem = () => {
    if (!editForm.description.trim()) {
      Alert.alert('Please enter a description for this item');
      return;
    }

    if (editingItemIndex === -1) {
      setLineItems([
        ...lineItems,
        { id: Date.now().toString(), ...editForm }
      ]);
    } else if (editingItemIndex !== null) {
      setLineItems(lineItems.map((item, index) => 
        index === editingItemIndex ? { ...item, ...editForm } : item
      ));
    }
    setShowLineItemEditor(false);
    setEditingItemIndex(null);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const calculateTotal = (quantity: string, unitPrice: string) => {
    return (parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0);
  };

  const gstEnabled = user?.gstEnabled !== false;
  const subtotal = lineItems.reduce(
    (sum, item) => sum + calculateTotal(item.quantity, item.unitPrice), 
    0
  );
  const gst = gstEnabled ? subtotal * 0.1 : 0;
  const total = subtotal + gst;

  const formatCurrency = (amount: number) => {
    const { formatCurrency: fmt } = require('../../../src/lib/format');
    return fmt(amount);
  };

  const handleSelectClient = (client: any) => {
    setForm({
      ...form,
      clientId: client.id,
      clientName: client.name
    });
    setShowClientPicker(false);
  };

  const handleQuickAddClient = async () => {
    if (!quickAddForm.name.trim()) {
      Alert.alert('Please enter a client name');
      return;
    }

    setIsCreatingClient(true);
    try {
      const response = await api.post<{ id: string; name: string }>('/api/clients', {
        name: quickAddForm.name.trim(),
        email: quickAddForm.email.trim() || undefined,
        phone: quickAddForm.phone.trim() || undefined,
      });
      
      await fetchClients();
      
      setForm({
        ...form,
        clientId: response.data!.id,
        clientName: response.data!.name
      });
      
      setShowQuickAddClient(false);
      setShowClientPicker(false);
      setQuickAddForm({ name: '', email: '', phone: '' });
      
      showToast({ type: 'success', message: `${response.data!.name} has been added and selected` });
    } catch (error: any) {
      console.error('Failed to create client:', error);
      showToast({ type: 'error', message: error.response?.data?.error || 'Failed to create client' });
    } finally {
      setIsCreatingClient(false);
    }
  };

  const selectedClient = clients.find(c => c.id === form.clientId);

  // Auto-fill the quote title when a client is picked. Pattern:
  // "Quote for {client.name} – {DD Mon YYYY}". We remember the last
  // auto-generated string so we only overwrite it if the user hasn't typed
  // a custom title. If they switch clients and the title still matches the
  // previous auto value, refresh it; otherwise leave their text alone.
  const lastAutoTitleRef = useRef<string>('');
  useEffect(() => {
    if (!selectedClient?.name) return;
    const tz = (businessSettings as any)?.timezone || 'Australia/Sydney';
    let dateStr: string;
    try {
      dateStr = new Intl.DateTimeFormat('en-AU', {
        timeZone: tz,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date()).replace(/,/g, '');
    } catch {
      dateStr = new Intl.DateTimeFormat('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date()).replace(/,/g, '');
    }
    const nextTitle = `Quote for ${selectedClient.name} \u2013 ${dateStr}`;
    setForm(prev => {
      const current = prev.title.trim();
      if (current === '' || current === lastAutoTitleRef.current) {
        lastAutoTitleRef.current = nextTitle;
        return { ...prev, title: nextTitle };
      }
      return prev;
    });
  }, [selectedClient?.id, selectedClient?.name, businessSettings]);

  const handleSave = async () => {
    if (!form.clientId) {
      Alert.alert('Please select a client');
      return;
    }

    if (!form.title.trim()) {
      Alert.alert('Please enter a quote title');
      return;
    }

    if (lineItems.length === 0) {
      Alert.alert('Please add at least one line item');
      return;
    }

    setIsLoading(true);
    
    const quoteData = {
      clientId: form.clientId,
      clientName: selectedClient?.name,
      jobId: jobId || undefined,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      notes: form.notes.trim() || undefined,
      validUntil: new Date(form.validUntil).toISOString(),
      subtotal: parseFloat(subtotal.toFixed(2)),
      gstAmount: parseFloat(gst.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      depositRequired: form.requireDeposit,
      depositPercent: form.requireDeposit && form.depositPercent !== 'custom' ? parseInt(form.depositPercent) : 0,
      depositAmount: form.requireDeposit
        ? form.depositPercent === 'custom'
          ? parseFloat(parseFloat(form.depositCustomAmount || '0').toFixed(2))
          : parseFloat((total * (parseInt(form.depositPercent) / 100)).toFixed(2))
        : 0,
      documentTemplate: (businessSettings as any)?.documentTemplate || 'professional',
      documentTemplateSettings: (businessSettings as any)?.documentTemplateSettings || null,
      lineItems: lineItems.map(item => ({
        description: item.description,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
      })),
    };
    
    // Offline-first: save offline if no connection
    if (!isOnline) {
      try {
        await offlineStorage.saveQuoteOffline(quoteData);
        showToast({ type: 'success', message: 'Saved Offline', description: 'Quote saved locally and will sync when you\'re back online.' });
        router.back();
      } catch (error) {
        console.error('Failed to save quote offline:', error);
        showToast({ type: 'error', message: 'Failed to save quote offline. Please try again.' });
      }
      setIsLoading(false);
      return;
    }
    
    try {
      const response = isEditing
        ? await api.patch(`/api/quotes/${params.editQuoteId}`, quoteData)
        : await api.post('/api/quotes', quoteData);

      if (response.error) {
        showToast({ type: 'error', message: response.error || `Failed to ${isEditing ? 'update' : 'create'} quote` });
      } else if (response.data) {
        await fetchQuotes();
        showToast({ type: 'success', message: 'Success', description: isEditing ? 'Quote updated successfully' : 'Quote created successfully' });
        router.back();
      } else {
        showToast({ type: 'error', message: `Failed to ${isEditing ? 'update' : 'create'} quote` });
      }
    } catch (error: any) {
      // Network error - save offline
      if (error.message?.includes('Network') || error.code === 'ECONNABORTED') {
        try {
          await offlineStorage.saveQuoteOffline(quoteData);
          showToast({ type: 'success', message: 'Saved Offline', description: 'Quote saved locally and will sync when connection is restored.' });
          router.back();
        } catch (offlineError) {
          console.error('Failed to save quote offline:', offlineError);
          showToast({ type: 'error', message: 'Failed to save quote. Please try again.' });
        }
      } else {
        showToast({ type: 'error', message: 'Failed to create quote. Please try again.' });
      }
    }
    setIsLoading(false);
  };

  const handlePickAIPhoto = async (source: 'camera' | 'gallery') => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera access is needed to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Photo library access is needed to select photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsMultipleSelection: true,
          selectionLimit: 5,
        });
      }
      if (!result.canceled && result.assets?.length > 0) {
        const newUris = result.assets.map(a => a.uri);
        setAiPhotos(prev => [...prev, ...newUris].slice(0, 10));
      }
    } catch (error) {
      if (__DEV__) console.error('Error picking photo:', error);
      showToast({ type: 'error', message: 'Could not pick photo. Please try again.' });
    }
  };

  const handleRemoveAIPhoto = (index: number) => {
    setAiPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleVoiceRecordingDone = async (uri: string, duration: number) => {
    setShowVoiceRecorder(false);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() || 'voice.m4a';
      formData.append('file', {
        uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
        name: filename,
        type: 'audio/m4a',
      } as any);
      const uploadResponse = await api.uploadFile<{ url: string }>('/api/upload', formData);
      if (uploadResponse.data?.url) {
        const transcribeResponse = await api.post<{ transcription: string }>('/api/voice-notes/transcribe', {
          audioUrl: uploadResponse.data.url,
        });
        if (transcribeResponse.data?.transcription) {
          setAiDescription(prev => prev ? `${prev}\n${transcribeResponse.data!.transcription}` : transcribeResponse.data!.transcription);
        } else {
          showToast({ type: 'info', message: 'Note', description: 'Voice was recorded but could not be transcribed. Please type your description instead.' });
        }
      }
    } catch (error) {
      if (__DEV__) console.error('Voice transcription error:', error);
      showToast({ type: 'error', message: 'Could not process voice recording. Please type your description instead.' });
    }
  };

  const handleGenerateAI = async () => {
    if (!aiDescription.trim() && aiPhotos.length === 0) {
      Alert.alert('Please describe the job or add photos');
      return;
    }
    setIsGeneratingAI(true);
    try {
      let photoUrls: string[] = [];
      if (aiPhotos.length > 0) {
        setIsUploadingPhotos(true);
        for (const photoUri of aiPhotos) {
          const formData = new FormData();
          const filename = photoUri.split('/').pop() || 'photo.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          formData.append('file', {
            uri: Platform.OS === 'ios' ? photoUri.replace('file://', '') : photoUri,
            name: filename,
            type,
          } as any);
          const uploadResponse = await api.uploadFile<{ url: string }>('/api/upload', formData);
          if (uploadResponse.data?.url) {
            photoUrls.push(uploadResponse.data.url);
          }
        }
        setIsUploadingPhotos(false);
      }

      type AIQuoteResp = { lineItems?: Array<{ description?: string; quantity?: number | string; unitPrice?: number | string }>; suggestedTitle?: string; notes?: string[] };
      const response = await api.post<AIQuoteResp>('/api/ai/generate-quote', {
        jobId: jobId || undefined,
        jobDescription: aiDescription.trim() || undefined,
        photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
      });
      if (response.data && response.data.lineItems) {
        const aiItems = response.data.lineItems.map((item) => ({
          id: Date.now().toString() + Math.random(),
          description: item.description || '',
          quantity: String(item.quantity || 1),
          unitPrice: String(item.unitPrice || 0),
        }));
        setLineItems([...lineItems, ...aiItems]);
        if (response.data.suggestedTitle && !form.title) {
          setForm({ ...form, title: response.data.suggestedTitle });
        }
        setShowAIGenerator(false);
        setAiDescription('');
        setAiPhotos([]);
        showToast({ type: 'success', message: `Added ${aiItems.length} items from AI` });
      } else {
        showToast({ type: 'error', message: response.data?.notes?.[0] || 'Could not generate quote' });
      }
    } catch (error) {
      showToast({ type: 'error', message: 'Failed to generate quote. Please try again.' });
    } finally {
      setIsGeneratingAI(false);
      setIsUploadingPhotos(false);
    }
  };

  const handleOpenCatalog = async () => {
    setShowCatalog(true);
    setIsLoadingCatalog(true);
    try {
      const response = await api.get<any[]>('/api/catalog');
      if (response.data) {
        setCatalogItems(response.data);
      }
    } catch (error) {
      showToast({ type: 'error', message: 'Failed to load catalog' });
    }
    setIsLoadingCatalog(false);
  };

  const handleAddCatalogItem = (catalogItem: any) => {
    setLineItems([...lineItems, {
      id: Date.now().toString(),
      description: catalogItem.name || catalogItem.description,
      quantity: '1',
      unitPrice: String(catalogItem.price || catalogItem.unitPrice || 0),
    }]);
    setShowCatalog(false);
  };

  const handleOpenPriceList = async () => {
    setShowPriceList(true);
    setIsLoadingPriceList(true);
    try {
      const response = await api.get<any[]>('/api/price-list-items');
      if (response.data) {
        const active = response.data.filter((i: any) => i.isActive !== false);
        const tradeType = (user?.tradeType as string | undefined) ?? ((businessSettings as any)?.tradeType as string | undefined);
        // Trade-relevant: no trade tag, matches user's trade, or explicitly 'general'
        const tradeItems = tradeType
          ? active.filter((i: any) => !i.tradeType || i.tradeType === tradeType || i.tradeType === 'general')
          : active;
        // Other-trade items shown at the bottom so they're still accessible
        const otherItems = tradeType
          ? active.filter((i: any) => i.tradeType && i.tradeType !== tradeType && i.tradeType !== 'general')
          : [];
        setPriceListItems([...tradeItems, ...otherItems]);
      }
    } catch (error) {
      showToast({ type: 'error', message: 'Failed to load price list' });
    }
    setIsLoadingPriceList(false);
  };

  const handleAddPriceListItem = (item: any) => {
    // If the saved price already includes GST, convert to ex-GST so the document
    // doesn't double-charge GST when it applies its own 10% calculation.
    const savedPrice = parseFloat(item.unitPrice || 0);
    const basePrice = item.gstIncluded ? savedPrice / 1.1 : savedPrice;
    const markupPct = item.itemType === 'material' ? parseFloat(businessSettings?.defaultMaterialMarkupPct || '0') : 0;
    const appliedPrice = markupPct > 0 ? basePrice * (1 + markupPct / 100) : basePrice;
    setLineItems([...lineItems, {
      id: Date.now().toString(),
      description: item.name + (item.description ? ` — ${item.description}` : ''),
      quantity: String(item.defaultQuantity || 1),
      unitPrice: appliedPrice.toFixed(2),
    }]);
    setShowPriceList(false);
    setPriceListSearch('');
  };

  const handleOpenQuoteTemplates = async () => {
    setShowQuoteTemplates(true);
    setIsLoadingQuoteTemplates(true);
    try {
      const response = await api.get<any[]>('/api/quote-templates');
      if (!response.error && Array.isArray(response.data)) {
        setQuoteTemplates(response.data);
      }
    } catch {
      showToast({ type: 'error', message: 'Failed to load templates' });
    }
    setIsLoadingQuoteTemplates(false);
  };

  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const handleSaveAsTemplate = async () => {
    if (lineItems.length === 0 || isSavingTemplate) return;
    setIsSavingTemplate(true);
    try {
      const res = await api.post<any>('/api/quote-templates', {
        name: form.title.trim() || 'My Quote Template',
        description: form.description?.trim() || null,
        items: lineItems.map((item) => ({
          description: item.description,
          quantity: String(item.quantity || 1),
          unitPrice: String(item.unitPrice || 0),
        })),
      });
      if (!res.error) {
        showToast({ type: 'success', message: 'Template Saved', description: 'Find it under "Use a Saved Template" next time.' });
      } else {
        showToast({ type: 'error', message: 'Could not save template', description: res.error });
      }
    } catch {
      showToast({ type: 'error', message: 'Could not save template' });
    }
    setIsSavingTemplate(false);
  };

  const applyQuoteTemplate = (template: any) => {
    const items = Array.isArray(template.items) ? template.items : [];
    const newItems: LineItem[] = items
      .filter((item: any) => item.description || item.label)
      .map((item: any) => ({
        id: Date.now().toString() + Math.random(),
        description: item.description || item.label || '',
        quantity: String(item.quantity || item.qty || item.defaultQty || 1),
        unitPrice: String(item.unitPrice || item.estimatedPrice || item.price || 0),
      }));
    if (newItems.length > 0) {
      setLineItems((prev) => [...prev, ...newItems]);
      showToast({ type: 'success', message: `Added ${newItems.length} ${newItems.length === 1 ? 'item' : 'items'} from "${template.name}"` });
    }
    setShowQuoteTemplates(false);
    setQuoteTemplateSearch('');
  };

  const businessInfo = {
    businessName: businessSettings?.businessName || user?.businessName || 'Your Business',
    abn: businessSettings?.abn,
    email: businessSettings?.email || user?.email,
    phone: businessSettings?.phone,
    address: businessSettings?.address,
    logoUrl: businessSettings?.logoUrl,
    brandColor: businessSettings?.brandColor,
  };

  const clientInfo = selectedClient ? {
    name: selectedClient.name,
    email: selectedClient.email,
    phone: selectedClient.phone,
    address: selectedClient.address,
  } : null;

  const previewLineItems = lineItems.map(item => ({
    description: item.description,
    quantity: parseFloat(item.quantity) || 0,
    unitPrice: parseFloat(item.unitPrice) || 0,
  }));

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Sticky Header with Back + Title + Total */}
        <View style={styles.stickyHeader}>
          <View style={styles.headerRow}>
            <Pressable 
              style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]} 
              onPress={() => router.back()}
            >
              <Feather name="chevron-left" size={24} color={colors.foreground} />
            </Pressable>
            <Text style={styles.headerTitle}>{isEditing ? 'Edit Quote' : 'New Quote'}</Text>
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeText}>{formatCurrency(total)}</Text>
            </View>
          </View>
          
          {/* Tab Switcher */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: colors.muted,
            borderRadius: 10,
            padding: spacing.xs,
            width: '100%',
          }}>
            <Pressable
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 8,
                gap: spacing.sm,
                backgroundColor: activeTab === 'edit' ? colors.primary : 'transparent',
              }}
              onPress={() => setActiveTab('edit')}
            >
              <Feather 
                name="edit-2" 
                size={16} 
                color={activeTab === 'edit' ? colors.primaryForeground : colors.foreground} 
              />
              <Text style={{
                fontSize: typography.sizes.md,
                fontWeight: fontWeights.semibold,
                color: activeTab === 'edit' ? colors.primaryForeground : colors.foreground,
              }}>
                Edit
              </Text>
            </Pressable>
            <Pressable
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 8,
                gap: spacing.sm,
                backgroundColor: activeTab === 'preview' ? colors.primary : 'transparent',
              }}
              onPress={() => setActiveTab('preview')}
            >
              <Feather 
                name="eye" 
                size={16} 
                color={activeTab === 'preview' ? colors.primaryForeground : colors.foreground} 
              />
              <Text style={{
                fontSize: typography.sizes.md,
                fontWeight: fontWeights.semibold,
                color: activeTab === 'preview' ? colors.primaryForeground : colors.foreground,
              }}>
                Preview
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Preview Mode */}
        {activeTab === 'preview' && (
          <View style={styles.previewContainer}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: spacing.sm,
            }}>
              <Text style={{
                fontSize: typography.captionSmall.fontSize,
                fontWeight: fontWeights.medium,
                color: colors.mutedForeground,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                Live Preview
              </Text>
              <View style={{
                backgroundColor: colors.muted,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: colors.border,
              }}>
                <Text style={{
                  fontSize: typography.sizes.xs,
                  fontWeight: fontWeights.medium,
                  color: colors.mutedForeground,
                }}>
                  Updates as you type
                </Text>
              </View>
            </View>
            <LiveDocumentPreview
              bottomPadding={bottomNavHeight}
              type="quote"
              title={form.title}
              description={form.description}
              date={form.quoteDate}
              validUntil={form.validUntil}
              lineItems={previewLineItems}
              notes={form.notes}
              terms={form.terms}
              business={businessInfo}
              client={clientInfo}
              gstEnabled={user?.gstEnabled !== false}
              showDepositSection={form.requireDeposit}
              depositPercent={parseInt(form.depositPercent) || 50}
              templateId={(businessSettings as any)?.documentTemplate || 'minimal'}
              templateCustomization={(businessSettings as any)?.documentTemplateSettings}
            />
          </View>
        )}

        {/* Edit Mode */}
        {activeTab === 'edit' && (
          <KeyboardAvoidingView 
            style={styles.editContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            {isLoadingClients && clients.length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground, marginTop: spacing.md }}>Loading clients...</Text>
              </View>
            ) : (
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={[styles.content, { paddingBottom: bottomNavHeight + 20 }]}
              showsVerticalScrollIndicator={false}
            >
              {/* Client Selection Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Feather name="user" size={16} color={colors.primary} />
                  <Text style={styles.cardHeaderText}>Client</Text>
                </View>
                <PressableRow style={styles.selectButton} onPress={() => setShowClientPicker(true)} >
                  {form.clientId ? (
                    <View style={styles.selectedClient}>
                      <View style={styles.clientAvatar}>
                        <Text style={styles.clientAvatarText}>
                          {(selectedClient?.name || form.clientName || 'Select Client').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.selectedClientText}>{selectedClient?.name || form.clientName || 'Select Client'}</Text>
                    </View>
                  ) : (
                    <Text style={styles.selectPlaceholder}>Tap to select a client...</Text>
                  )}
                  <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
                </PressableRow>
              </View>

              {/* Quote Details Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Feather name="file-text" size={16} color={colors.primary} />
                  <Text style={styles.cardHeaderText}>Quote Details</Text>
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Title</Text>
                  <TextInput
                    style={styles.input}
                    value={form.title}
                    onChangeText={(text) => setForm({ ...form, title: text })}
                    placeholder="e.g., Bathroom Renovation"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Description (optional)</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={form.description}
                    onChangeText={(text) => setForm({ ...form, description: text })}
                    placeholder="Brief description of the work..."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <DatePicker
                    label="Valid Until"
                    value={new Date(form.validUntil + 'T00:00:00')}
                    onChange={(date) => setForm({ ...form, validUntil: formatLocalDate(date) })}
                    minimumDate={new Date()}
                  />
                </View>
              </View>

              {/* Line Items Card */}
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeader}>
                    <Feather name="package" size={16} color={colors.primary} />
                    <Text style={styles.cardHeaderText}>Line Items</Text>
                  </View>
                  <View style={styles.itemCountBadge}>
                    <Text style={styles.itemCountText}>
                      {lineItems.length} {lineItems.length === 1 ? 'item' : 'items'}
                    </Text>
                  </View>
                </View>

                {lineItems.map((item, index) => {
                  const itemTotal = calculateTotal(item.quantity, item.unitPrice);
                  return (
                    <View key={item.id} style={styles.lineItemRow}>
                      <View style={styles.lineItemInfo}>
                        <Text style={styles.lineItemDescription} numberOfLines={1}>
                          {item.description}
                        </Text>
                        <Text style={styles.lineItemMeta}>
                          {item.quantity} × {formatCurrency(parseFloat(item.unitPrice) || 0)}
                        </Text>
                      </View>
                      <Text style={styles.lineItemTotal}>{formatCurrency(itemTotal)}</Text>
                      <View style={styles.lineItemActions}>
                        <PressableRow style={styles.iconButton} onPress={() => handleEditLineItem(index)} >
                          <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                        </PressableRow>
                        <PressableRow style={styles.iconButton} onPress={() => removeLineItem(index)} >
                          <Feather name="trash-2" size={14} color={colors.destructive} />
                        </PressableRow>
                      </View>
                    </View>
                  );
                })}

                <View style={styles.addButtonsRow}>
                  <PressableRow style={styles.addItemButton} onPress={handleAddLineItem} >
                    <Feather name="plus" size={16} color={colors.foreground} />
                    <Text style={styles.addItemText}>Add Item</Text>
                  </PressableRow>
                  <PressableRow style={styles.catalogButton} onPress={handleOpenCatalog} >
                    <Feather name="book-open" size={16} color={colors.foreground} />
                  </PressableRow>
                  <PressableRow style={[styles.catalogButton, { backgroundColor: colors.primaryLight }]} onPress={handleOpenPriceList} >
                    <Feather name="tag" size={16} color={colors.primary} />
                  </PressableRow>
                  <PressableRow style={[styles.catalogButton, { backgroundColor: colors.primaryLight }]} onPress={() => setShowAIGenerator(true)} >
                    <Feather name="zap" size={16} color={colors.primary} />
                  </PressableRow>
                </View>

                <PressableRow style={styles.templateButton} onPress={handleOpenQuoteTemplates} >
                  <Feather name="clipboard" size={16} color={colors.primary} />
                  <Text style={styles.templateButtonText}>Use a Saved Template</Text>
                </PressableRow>

                {lineItems.length > 0 && (
                  <PressableRow style={styles.templateButton} onPress={handleSaveAsTemplate} >
                    <Feather name="save" size={16} color={colors.primary} />
                    <Text style={styles.templateButtonText}>{isSavingTemplate ? 'Saving Template...' : 'Save Items as Template'}</Text>
                  </PressableRow>
                )}
              </View>

              {/* Totals Card */}
              {lineItems.length > 0 && (
                <View style={styles.totalsCard}>
                  {gstEnabled ? (
                    <>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Subtotal</Text>
                        <Text style={styles.totalValue}>{formatCurrency(subtotal)}</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>GST (10%)</Text>
                        <Text style={styles.totalValue}>{formatCurrency(gst)}</Text>
                      </View>
                      <View style={[styles.totalRow, styles.grandTotalRow]}>
                        <Text style={styles.grandTotalLabel}>Total (inc. GST)</Text>
                        <Text style={styles.grandTotalValue}>{formatCurrency(total)}</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.totalRow}>
                      <Text style={styles.grandTotalLabel}>Total</Text>
                      <Text style={styles.grandTotalValue}>{formatCurrency(total)}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Deposit Card */}
              <View style={styles.card}>
                <View style={styles.depositHeader}>
                  <View style={styles.cardHeader}>
                    <Feather name="dollar-sign" size={16} color={colors.primary} />
                    <Text style={styles.cardHeaderText}>Require Deposit</Text>
                  </View>
                  <PressableRow style={[styles.toggleSwitch, form.requireDeposit && styles.toggleSwitchOn]} onPress={() => setForm({ ...form, requireDeposit: !form.requireDeposit })} >
                    <View style={[styles.toggleKnob, form.requireDeposit && styles.toggleKnobOn]} />
                  </PressableRow>
                </View>
                {form.requireDeposit && (
                  <View style={styles.depositOptions}>
                    <Text style={styles.depositLabel}>Deposit Amount</Text>
                    <View style={styles.depositPercentRow}>
                      {(['25', '50', '75', 'custom'] as const).map((option) => (
                        <PressableRow
                          key={option}
                          style={[styles.depositPercentOption, form.depositPercent === option && styles.depositPercentSelected]}
                          onPress={() => setForm({ ...form, depositPercent: option })}
                        >
                          <Text style={[styles.depositPercentText, form.depositPercent === option && styles.depositPercentTextSelected]}>
                            {option === 'custom' ? 'Custom' : `${option}%`}
                          </Text>
                        </PressableRow>
                      ))}
                    </View>
                    {form.depositPercent === 'custom' ? (
                      <View style={styles.depositCustomRow}>
                        <Text style={styles.depositCustomPrefix}>$</Text>
                        <TextInput
                          style={styles.depositCustomInput}
                          value={form.depositCustomAmount}
                          onChangeText={(text) => setForm({ ...form, depositCustomAmount: text.replace(/[^0-9.]/g, '') })}
                          placeholder="0.00"
                          placeholderTextColor={colors.mutedForeground}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    ) : null}
                    <Text style={styles.depositAmount}>
                      Deposit:{' '}
                      {form.depositPercent === 'custom'
                        ? formatCurrency(parseFloat(form.depositCustomAmount || '0') || 0)
                        : formatCurrency(total * (parseInt(form.depositPercent) / 100))}
                    </Text>
                  </View>
                )}
              </View>

              {/* Terms Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Feather name="file-text" size={16} color={colors.primary} />
                  <Text style={styles.cardHeaderText}>Terms & Conditions</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={form.terms}
                  onChangeText={(text) => setForm({ ...form, terms: text })}
                  placeholder="Terms, conditions, or notes for the client..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Submit Button - Uses business primary color */}
              <PressableRow style={{ backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: spacing.xl, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, opacity: isLoading ? 0.6 : 1, }} onPress={handleSave} disabled={isLoading} >
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <>
                    <Feather name="check" size={18} color={colors.primaryForeground} />
                    <Text style={{ color: colors.primaryForeground, fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold }}>{isEditing ? 'Update Quote' : 'Create Quote'}</Text>
                  </>
                )}
              </PressableRow>
            </ScrollView>
            )}
          </KeyboardAvoidingView>
        )}
      </View>

      {/* Client Picker Modal */}
      <AppBottomSheet
        visible={showClientPicker}
        onDismiss={() => {
          setShowClientPicker(false);
          setShowQuickAddClient(false);
          setQuickAddForm({ name: '', email: '', phone: '' });
        }}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{showQuickAddClient ? 'Quick Add Client' : 'Select Client'}</Text>
            <PressableRow onPress={() => { if (showQuickAddClient) { setShowQuickAddClient(false); setQuickAddForm({ name: '', email: '', phone: '' }); } else { setShowClientPicker(false); } }}>
              <Feather name={showQuickAddClient ? 'arrow-left' : 'x'} size={24} color={colors.foreground} />
            </PressableRow>
          </View>
          
          {showQuickAddClient ? (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
              <ScrollView style={styles.modalContent}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Client Name *</Text>
                  <TextInput
                    style={styles.input}
                    value={quickAddForm.name}
                    onChangeText={(text) => setQuickAddForm({ ...quickAddForm, name: text })}
                    placeholder="e.g. John Smith"
                    placeholderTextColor={colors.mutedForeground}
                    autoFocus
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={quickAddForm.email}
                    onChangeText={(text) => setQuickAddForm({ ...quickAddForm, email: text })}
                    placeholder="john@email.com"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={quickAddForm.phone}
                    onChangeText={(text) => setQuickAddForm({ ...quickAddForm, phone: text })}
                    placeholder="0400 000 000"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="phone-pad"
                  />
                </View>
                <PressableRow style={[styles.saveItemButton, { opacity: isCreatingClient ? 0.6 : 1 }]} onPress={handleQuickAddClient} disabled={isCreatingClient} >
                  {isCreatingClient ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Text style={styles.saveItemButtonText}>Add & Select Client</Text>
                  )}
                </PressableRow>
              </ScrollView>
            </KeyboardAvoidingView>
          ) : (
            <ScrollView style={styles.modalContent}>
              {/* Quick Add Client Button */}
              <PressableRow style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight, padding: 14, borderRadius: 10, marginBottom: spacing.lg, gap: 10, }} onPress={() => setShowQuickAddClient(true)} >
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Feather name="user-plus" size={18} color={colors.primaryForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: typography.sizes.md, fontWeight: fontWeights.semibold, color: colors.primary }}>Quick Add Client</Text>
                  <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground }}>Create a new client without leaving this screen</Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.primary} />
              </PressableRow>

              {clients.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="user" size={48} color={colors.mutedForeground} />
                  <Text style={styles.emptyStateText}>No clients found</Text>
                  <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, textAlign: 'center', marginTop: spacing.xs }}>
                    Use Quick Add above to create your first client
                  </Text>
                </View>
              ) : (
                clients.map((client) => (
                  <PressableRow key={client.id} style={styles.clientOption} onPress={() => handleSelectClient(client)} >
                    <View style={styles.clientOptionAvatar}>
                      <Text style={styles.clientOptionAvatarText}>
                        {client.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.clientOptionInfo}>
                      <Text style={styles.clientOptionName}>{client.name}</Text>
                      {client.email && (
                        <Text style={styles.clientOptionEmail}>{client.email}</Text>
                      )}
                    </View>
                  </PressableRow>
                ))
              )}
            </ScrollView>
          )}
        </View>
      </AppBottomSheet>

      {/* Line Item Editor Modal */}
      <AppBottomSheet
        visible={showLineItemEditor}
        onDismiss={() => setShowLineItemEditor(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingItemIndex === -1 ? 'Add Item' : 'Edit Item'}
            </Text>
            <PressableRow onPress={() => setShowLineItemEditor(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </PressableRow>
          </View>
          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={styles.input}
                value={editForm.description}
                onChangeText={(text) => setEditForm({ ...editForm, description: text })}
                placeholder="What are you quoting for?"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.quantity}
                  onChangeText={(text) => setEditForm({ ...editForm, quantity: text })}
                  placeholder="1"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing.md }]}>
                <Text style={styles.inputLabel}>Unit Price ($)</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.unitPrice}
                  onChangeText={(text) => setEditForm({ ...editForm, unitPrice: text })}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.lineTotalPreview}>
              <Text style={styles.lineTotalLabel}>Line Total</Text>
              <Text style={styles.lineTotalValue}>
                {formatCurrency(calculateTotal(editForm.quantity, editForm.unitPrice))}
              </Text>
            </View>

            <PressableRow style={styles.saveItemButton} onPress={handleSaveLineItem} >
              <Text style={styles.saveItemButtonText}>
                {editingItemIndex === -1 ? 'Add Item' : 'Save Changes'}
              </Text>
            </PressableRow>
          </View>
        </View>
      </AppBottomSheet>

      {/* AI Generator Modal */}
      <AppBottomSheet
        visible={showAIGenerator}
        onDismiss={() => { setShowAIGenerator(false); setShowVoiceRecorder(false); }}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>AI Quote Generator</Text>
            <PressableRow onPress={() => { setShowAIGenerator(false); setShowVoiceRecorder(false); }}>
              <Feather name="x" size={24} color={colors.foreground} />
            </PressableRow>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground, marginBottom: spacing.lg }}>
              Describe the job, add photos, or use voice input. AI will generate quote line items with realistic pricing.
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Job Description</Text>
              <TextInput
                style={[styles.input, styles.textArea, { minHeight: 120 }]}
                value={aiDescription}
                onChangeText={setAiDescription}
                placeholder="e.g., Full bathroom renovation including new tiles, toilet, vanity and shower..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: spacing.lg }}>
              <PressableRow style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.muted, borderRadius: 10, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.border, }} onPress={() => handlePickAIPhoto('camera')} >
                <Feather name="camera" size={18} color={colors.foreground} />
                <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.medium, color: colors.foreground }}>Camera</Text>
              </PressableRow>
              <PressableRow style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.muted, borderRadius: 10, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.border, }} onPress={() => handlePickAIPhoto('gallery')} >
                <Feather name="image" size={18} color={colors.foreground} />
                <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.medium, color: colors.foreground }}>Gallery</Text>
              </PressableRow>
              <PressableRow style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: showVoiceRecorder ? colors.primaryLight : colors.muted, borderRadius: 10, paddingVertical: spacing.md, borderWidth: 1, borderColor: showVoiceRecorder ? colors.primary : colors.border, }} onPress={() => setShowVoiceRecorder(!showVoiceRecorder)} >
                <Feather name="mic" size={18} color={showVoiceRecorder ? colors.primary : colors.foreground} />
                <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.medium, color: showVoiceRecorder ? colors.primary : colors.foreground }}>Voice</Text>
              </PressableRow>
            </View>

            {aiPhotos.length > 0 && (
              <View style={{ marginBottom: spacing.lg }}>
                <Text style={[styles.inputLabel, { marginBottom: spacing.sm }]}>
                  Photos ({aiPhotos.length})
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                  {aiPhotos.map((uri, index) => (
                    <View key={`${uri}-${index}`} style={{ marginRight: 10, position: 'relative' }}>
                      <Image
                        source={{ uri }}
                        style={{ width: 80, height: 80, borderRadius: 10, backgroundColor: colors.muted }}
                      />
                      <PressableRow style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.destructive, alignItems: 'center', justifyContent: 'center', }} onPress={() => handleRemoveAIPhoto(index)} >
                        <Feather name="x" size={12} color={colors.white} />
                      </PressableRow>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {showVoiceRecorder && (
              <View style={{
                marginBottom: spacing.lg,
                backgroundColor: colors.muted,
                borderRadius: 12,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
              }}>
                <VoiceRecorder
                  onSave={handleVoiceRecordingDone}
                  onCancel={() => setShowVoiceRecorder(false)}
                />
              </View>
            )}

            <PressableRow style={[styles.saveItemButton, (isGeneratingAI || isUploadingPhotos) && { opacity: 0.6 }]} onPress={handleGenerateAI} disabled={isGeneratingAI || isUploadingPhotos} >
              {isGeneratingAI || isUploadingPhotos ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                  <Text style={styles.saveItemButtonText}>
                    {isUploadingPhotos ? 'Uploading Photos...' : 'Generating...'}
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Feather name="zap" size={18} color={colors.primaryForeground} />
                  <Text style={styles.saveItemButtonText}>Generate Quote Items</Text>
                </View>
              )}
            </PressableRow>
          </ScrollView>
        </View>
      </AppBottomSheet>

      {/* Catalog Picker Modal */}
      <AppBottomSheet
        visible={showCatalog}
        onDismiss={() => { setShowCatalog(false); setCatalogSearch(''); }}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Product Catalog</Text>
            <PressableRow onPress={() => { setShowCatalog(false); setCatalogSearch(''); }}>
              <Feather name="x" size={24} color={colors.foreground} />
            </PressableRow>
          </View>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.muted,
              borderRadius: 10,
              paddingHorizontal: spacing.md,
              gap: spacing.sm,
            }}>
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: spacing.md,
                  fontSize: typography.sizes.md,
                  color: colors.foreground,
                }}
                value={catalogSearch}
                onChangeText={setCatalogSearch}
                placeholder="Search catalog..."
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {catalogSearch.length > 0 && (
                <PressableRow onPress={() => setCatalogSearch('')}>
                  <Feather name="x-circle" size={16} color={colors.mutedForeground} />
                </PressableRow>
              )}
            </View>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            {isLoadingCatalog ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (() => {
              const searchLower = catalogSearch.toLowerCase().trim();
              const filtered = searchLower
                ? catalogItems.filter(item =>
                    (item.name || item.description || '').toLowerCase().includes(searchLower) ||
                    (item.category || '').toLowerCase().includes(searchLower)
                  )
                : catalogItems;

              if (filtered.length === 0) {
                return (
                  <View style={styles.emptyState}>
                    <Feather name={catalogSearch ? 'search' : 'book-open'} size={48} color={colors.mutedForeground} />
                    <Text style={styles.emptyStateText}>
                      {catalogSearch ? 'No items match your search' : 'No catalog items found'}
                    </Text>
                    {!catalogSearch && (
                      <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, textAlign: 'center' }}>
                        Add items to your catalog from the web app
                      </Text>
                    )}
                  </View>
                );
              }

              const grouped: Record<string, any[]> = {};
              filtered.forEach(item => {
                const cat = item.category || 'Uncategorized';
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(item);
              });
              const categoryKeys = Object.keys(grouped).sort((a, b) => {
                if (a === 'Uncategorized') return 1;
                if (b === 'Uncategorized') return -1;
                return a.localeCompare(b);
              });
              const hasCategories = categoryKeys.length > 1 || (categoryKeys.length === 1 && categoryKeys[0] !== 'Uncategorized');

              return categoryKeys.map(category => (
                <View key={category}>
                  {hasCategories && (
                    <View style={{
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.xs,
                      marginTop: spacing.sm,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}>
                      <Text style={{
                        fontSize: typography.captionSmall.fontSize,
                        fontWeight: fontWeights.semibold,
                        color: colors.mutedForeground,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}>
                        {category}
                      </Text>
                    </View>
                  )}
                  {grouped[category].map((item: any) => (
                    <PressableRow key={item.id} style={styles.clientOption} onPress={() => { handleAddCatalogItem(item); setCatalogSearch(''); }} >
                      <View style={[styles.clientOptionAvatar, { backgroundColor: colors.muted }]}>
                        <Feather name="package" size={18} color={colors.foreground} />
                      </View>
                      <View style={styles.clientOptionInfo}>
                        <Text style={styles.clientOptionName}>{item.name || item.description}</Text>
                        <Text style={styles.clientOptionEmail}>
                          {formatCurrency(item.price || item.unitPrice || 0)}
                          {item.category ? ` · ${item.category}` : ''}
                        </Text>
                      </View>
                      <Feather name="plus" size={20} color={colors.primary} />
                    </PressableRow>
                  ))}
                </View>
              ));
            })()}
          </ScrollView>
        </View>
      </AppBottomSheet>

      {/* Price List Picker Modal */}
      <AppBottomSheet
        visible={showPriceList}
        onDismiss={() => { setShowPriceList(false); setPriceListSearch(''); }}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Price List</Text>
            <PressableRow onPress={() => { setShowPriceList(false); setPriceListSearch(''); }}>
              <Feather name="x" size={24} color={colors.foreground} />
            </PressableRow>
          </View>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.muted,
              borderRadius: 10,
              paddingHorizontal: spacing.md,
              gap: spacing.sm,
            }}>
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: spacing.md,
                  fontSize: typography.sizes.md,
                  color: colors.foreground,
                }}
                value={priceListSearch}
                onChangeText={setPriceListSearch}
                placeholder="Search price list..."
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {priceListSearch.length > 0 && (
                <PressableRow onPress={() => setPriceListSearch('')}>
                  <Feather name="x-circle" size={16} color={colors.mutedForeground} />
                </PressableRow>
              )}
            </View>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            {isLoadingPriceList ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (() => {
              const searchLower = priceListSearch.toLowerCase().trim();
              const filtered = searchLower
                ? priceListItems.filter(item =>
                    (item.name || '').toLowerCase().includes(searchLower) ||
                    (item.description || '').toLowerCase().includes(searchLower) ||
                    (item.category || '').toLowerCase().includes(searchLower)
                  )
                : priceListItems;

              if (filtered.length === 0) {
                return (
                  <View style={styles.emptyState}>
                    <Feather name={priceListSearch ? 'search' : 'tag'} size={48} color={colors.mutedForeground} />
                    <Text style={styles.emptyStateText}>
                      {priceListSearch ? 'No items match your search' : 'No price list items yet'}
                    </Text>
                    {!priceListSearch && (
                      <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, textAlign: 'center' }}>
                        Add items in Settings → Templates → Price List
                      </Text>
                    )}
                  </View>
                );
              }

              const grouped: Record<string, any[]> = {};
              filtered.forEach(item => {
                const cat = item.category || 'General';
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(item);
              });
              const categoryKeys = Object.keys(grouped).sort((a, b) => {
                if (a === 'General') return -1;
                if (b === 'General') return 1;
                return a.localeCompare(b);
              });
              const hasCategories = categoryKeys.length > 1 || (categoryKeys.length === 1 && categoryKeys[0] !== 'General');

              return categoryKeys.map(category => (
                <View key={category}>
                  {hasCategories && (
                    <View style={{
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.xs,
                      marginTop: spacing.sm,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}>
                      <Text style={{
                        fontSize: typography.captionSmall.fontSize,
                        fontWeight: fontWeights.semibold,
                        color: colors.mutedForeground,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}>
                        {category}
                      </Text>
                    </View>
                  )}
                  {grouped[category].map((item: any) => {
                    const markupPct = item.itemType === 'material' ? parseFloat(businessSettings?.defaultMaterialMarkupPct || '0') : 0;
                    const basePrice = parseFloat(item.unitPrice || 0);
                    const displayPrice = markupPct > 0 ? basePrice * (1 + markupPct / 100) : basePrice;
                    return (
                      <PressableRow key={item.id} style={styles.clientOption} onPress={() => handleAddPriceListItem(item)} >
                        <View style={[styles.clientOptionAvatar, { backgroundColor: colors.muted }]}>
                          <Feather name={item.itemType === 'material' ? 'package' : item.itemType === 'equipment' ? 'tool' : 'briefcase'} size={18} color={colors.foreground} />
                        </View>
                        <View style={styles.clientOptionInfo}>
                          <Text style={styles.clientOptionName}>{item.name}</Text>
                          <Text style={styles.clientOptionEmail}>
                            {formatCurrency(displayPrice)}/{item.unit || 'each'}
                            {item.itemType === 'material' && markupPct > 0 ? ` (+${markupPct}% markup)` : ''}
                            {item.itemType ? ` · ${item.itemType}` : ''}
                          </Text>
                        </View>
                        <Feather name="plus" size={20} color={colors.primary} />
                      </PressableRow>
                    );
                  })}
                </View>
              ));
            })()}
          </ScrollView>
        </View>
      </AppBottomSheet>

      <AppBottomSheet
        visible={showQuoteTemplates}
        onDismiss={() => { setShowQuoteTemplates(false); setQuoteTemplateSearch(''); }}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Quote Templates</Text>
            <PressableRow onPress={() => { setShowQuoteTemplates(false); setQuoteTemplateSearch(''); }}>
              <Feather name="x" size={24} color={colors.foreground} />
            </PressableRow>
          </View>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.muted,
              borderRadius: 10,
              paddingHorizontal: spacing.md,
              gap: spacing.sm,
            }}>
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: spacing.md,
                  fontSize: typography.sizes.md,
                  color: colors.foreground,
                }}
                value={quoteTemplateSearch}
                onChangeText={setQuoteTemplateSearch}
                placeholder="Search templates..."
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {quoteTemplateSearch.length > 0 && (
                <PressableRow onPress={() => setQuoteTemplateSearch('')}>
                  <Feather name="x-circle" size={16} color={colors.mutedForeground} />
                </PressableRow>
              )}
            </View>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            {isLoadingQuoteTemplates ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (() => {
              const searchLower = quoteTemplateSearch.toLowerCase().trim();
              const filtered = searchLower
                ? quoteTemplates.filter(t =>
                    (t.name || '').toLowerCase().includes(searchLower) ||
                    (t.description || '').toLowerCase().includes(searchLower) ||
                    (t.tradeType || '').toLowerCase().includes(searchLower)
                  )
                : quoteTemplates;

              if (filtered.length === 0) {
                return (
                  <View style={styles.emptyState}>
                    <Feather name={quoteTemplateSearch ? 'search' : 'clipboard'} size={48} color={colors.mutedForeground} />
                    <Text style={styles.emptyStateText}>
                      {quoteTemplateSearch ? 'No templates match your search' : 'No quote templates found'}
                    </Text>
                    {!quoteTemplateSearch && (
                      <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, textAlign: 'center' }}>
                        Create templates in the web app
                      </Text>
                    )}
                  </View>
                );
              }

              const grouped: Record<string, any[]> = {};
              filtered.forEach(t => {
                const trade = t.tradeType || 'general';
                if (!grouped[trade]) grouped[trade] = [];
                grouped[trade].push(t);
              });
              const tradeKeys = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

              return tradeKeys.map(trade => (
                <View key={trade}>
                  <View style={{
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.xs,
                    marginTop: spacing.sm,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}>
                    <Text style={{
                      fontSize: typography.captionSmall.fontSize,
                      fontWeight: fontWeights.semibold,
                      color: colors.mutedForeground,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}>
                      {trade}
                    </Text>
                  </View>
                  {grouped[trade].map((template: any) => {
                    const itemCount = Array.isArray(template.items) ? template.items.length : 0;
                    return (
                      <PressableRow key={template.id} style={styles.clientOption} onPress={() => applyQuoteTemplate(template)} >
                        <View style={[styles.clientOptionAvatar, { backgroundColor: colors.muted }]}>
                          <Feather name="clipboard" size={18} color={colors.foreground} />
                        </View>
                        <View style={styles.clientOptionInfo}>
                          <Text style={styles.clientOptionName}>{template.name}</Text>
                          <Text style={styles.clientOptionEmail}>
                            {itemCount} {itemCount === 1 ? 'item' : 'items'}
                            {template.description ? ` · ${template.description}` : ''}
                          </Text>
                        </View>
                        <Feather name="plus" size={20} color={colors.primary} />
                      </PressableRow>
                    );
                  })}
                </View>
              ));
            })()}
          </ScrollView>
        </View>
      </AppBottomSheet>
    </>
  );
}
