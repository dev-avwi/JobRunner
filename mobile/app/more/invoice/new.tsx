import { useState, useEffect, useRef, useMemo } from 'react';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
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
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../../src/components/ui/PressableRow';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore, useClientsStore, useInvoicesStore } from '../../../src/lib/store';
import { useTheme, ThemeColors, getVisibleButtonColors } from '../../../src/lib/theme';
import { AppBottomSheet } from '../../../src/components/ui/AppBottomSheet';
import api from '../../../src/lib/api';
import offlineStorage, { useOfflineStore } from '../../../src/lib/offline-storage';
import LiveDocumentPreview from '../../../src/components/LiveDocumentPreview';
import { getBottomNavHeight } from '../../../src/components/BottomNav';
import { DatePicker } from '../../../src/components/ui/DatePicker';
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
    tabSwitcher: {
      flexDirection: 'row',
      backgroundColor: colors.muted,
      borderRadius: 12,
      padding: spacing.xs,
      gap: spacing.xs,
      marginTop: spacing.xxs,
    },
    tabSwitch: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: 40,
      borderRadius: 8,
    },
    tabSwitchActive: {
      backgroundColor: colors.primary,
    },
    tabSwitchText: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.semibold,
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
    },
    addItemButton: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addItemText: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
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
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.xs,
    },
    toggleInfo: {
      flex: 1,
      marginRight: spacing.lg,
    },
    toggleTitle: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
      marginBottom: spacing.xxs,
    },
    toggleDescription: {
      fontSize: typography.sizes.sm,
      color: colors.mutedForeground,
      lineHeight: 18,
    },
    toggleSwitch: {
      width: 50,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.muted,
      padding: spacing.xxs,
      justifyContent: 'center',
    },
    toggleThumb: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.card,
    },
    toggleThumbActive: {
      alignSelf: 'flex-end',
    },
    recurringOptions: {
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    inputHint: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
      marginTop: 6,
      marginLeft: spacing.xxs,
    },
    recurringPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.infoLight || colors.muted,
      borderRadius: 10,
      marginTop: spacing.sm,
    },
    recurringPreviewText: {
      flex: 1,
      fontSize: typography.sizes.sm,
      color: colors.info || colors.primary,
      lineHeight: 18,
    },
    frequencyModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    frequencyModalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 34,
      paddingTop: spacing.md,
    },
    frequencyModalHandle: {
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.muted,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    frequencyModalTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
      textAlign: 'center',
      marginBottom: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    frequencyOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: spacing.xl,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    frequencyOptionSelected: {
      backgroundColor: colors.primaryLight,
    },
    frequencyOptionContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    frequencyOptionText: {
      fontSize: typography.subtitle.fontSize,
      color: colors.foreground,
    },
    frequencyModalCancel: {
      marginTop: spacing.sm,
      paddingVertical: 14,
      alignItems: 'center',
    },
    frequencyModalCancelText: {
      fontSize: typography.subtitle.fontSize,
      fontWeight: fontWeights.medium,
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

export default function NewInvoiceScreen() {
  const insets = useSafeAreaInsets();
  const confirm = useConfirmDialog();
  const params = useLocalSearchParams<{ jobId?: string; clientId?: string; editInvoiceId?: string; batchQueue?: string; batchIndex?: string; claimId?: string }>();
  const batchQueue = useMemo(
    () => (params.batchQueue ? String(params.batchQueue).split(',').filter(Boolean) : []),
    [params.batchQueue],
  );
  const batchIndex = params.batchIndex ? parseInt(String(params.batchIndex), 10) : 0;
  const isBatchReview = batchQueue.length > 0;
  const isLastInBatch = isBatchReview && batchIndex + 1 >= batchQueue.length;

  const proceedAfterSave = () => {
    if (isBatchReview && batchIndex + 1 < batchQueue.length) {
      const nextIdx = batchIndex + 1;
      router.replace(
        `/more/invoice/new?jobId=${batchQueue[nextIdx]}&batchQueue=${batchQueue.join(',')}&batchIndex=${nextIdx}` as any,
      );
    } else if (isBatchReview) {
      router.replace('/more/invoices' as any);
    } else {
      router.back();
    }
  };
  const { user, businessSettings } = useAuthStore();
  const { clients, fetchClients, isLoading: isLoadingClients } = useClientsStore();
  const { fetchInvoices, getInvoice } = useInvoicesStore();
  const isEditing = !!params.editInvoiceId;
  const { colors, isDark } = useTheme();
  const { isOnline, pendingSyncCount } = useOfflineStore();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isLoading, setIsLoading] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showLineItemEditor, setShowLineItemEditor] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
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
  
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [jobId, setJobId] = useState<string | null>(params.jobId || null);
  
  const [form, setForm] = useState({
    clientId: params.clientId || '',
    clientName: '',
    title: '',
    description: '',
    notes: '',
    terms: '',
    invoiceDate: formatLocalDate(new Date()),
    dueDate: formatLocalDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
  });
  
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false);

  const RECURRENCE_OPTIONS = [
    { value: 'weekly', label: 'Weekly', interval: 1 },
    { value: 'fortnightly', label: 'Fortnightly (2 weeks)', interval: 1 },
    { value: 'monthly', label: 'Monthly', interval: 1 },
    { value: 'quarterly', label: 'Quarterly (3 months)', interval: 3 },
    { value: 'yearly', label: 'Yearly', interval: 1 },
  ] as const;

  const calculateNextRecurrenceDate = (dueDate: string, pattern: string): string => {
    const due = new Date(dueDate);
    switch (pattern) {
      case 'weekly':
        due.setDate(due.getDate() + 7);
        break;
      case 'fortnightly':
        due.setDate(due.getDate() + 14);
        break;
      case 'monthly':
        due.setMonth(due.getMonth() + 1);
        break;
      case 'quarterly':
        due.setMonth(due.getMonth() + 3);
        break;
      case 'yearly':
        due.setFullYear(due.getFullYear() + 1);
        break;
    }
    return due.toISOString();
  };
  
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [editForm, setEditForm] = useState({
    description: '',
    quantity: '1',
    unitPrice: ''
  });
  const [jobExpenses, setJobExpenses] = useState<any[]>([]);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [isLoadingJob, setIsLoadingJob] = useState(false);
  const [costCheckData, setCostCheckData] = useState<{
    purchaseOrders: { reconciledCount: number; reconciledTotal: number; outstandingCount: number; outstandingTotal: number };
    variations: Array<{ id: string; title: string; amount: number; variationNumber: number | null }>;
    materials: { markupCaptured: number; sellPriceTotal: number };
  } | null>(null);
  const [costCheckExpanded, setCostCheckExpanded] = useState(false);

  const bottomNavHeight = getBottomNavHeight(insets.bottom);

  useEffect(() => {
    fetchClients();
    if (params.editInvoiceId) {
      loadInvoiceForEditing(params.editInvoiceId);
    }
  }, []);

  // Param-driven prefill: re-runs when the job changes (e.g. advancing through a
  // batch review). Resets per-invoice state first so nothing leaks between jobs,
  // regardless of whether the screen remounts on router.replace.
  useEffect(() => {
    if (params.editInvoiceId) return;
    if (!params.jobId) return;
    setJobId(params.jobId);
    setForm(prev => ({
      ...prev,
      clientId: params.clientId || '',
      clientName: '',
      title: '',
      description: '',
      notes: '',
      terms: '',
    }));
    setLineItems([]);
    setJobExpenses([]);
    setIsRecurring(false);
    setCostCheckData(null);
    setCostCheckExpanded(false);
    fetchJobExpenses(params.jobId);
    fetchCostCheck(params.jobId);
    if (params.claimId) {
      fetchClaimAndPrefill(params.jobId, params.claimId);
    } else {
      fetchJobAndPrefill(params.jobId);
    }
  }, [params.jobId, params.claimId]);

  type InvoiceCostCheckResponse = {
    purchaseOrders: { reconciledCount: number; reconciledTotal: number; outstandingCount: number; outstandingTotal: number };
    variations: Array<{ id: string; title: string; amount: number; variationNumber: number | null }>;
    materials: { markupCaptured: number; sellPriceTotal: number };
  };

  const fetchCostCheck = async (jId: string) => {
    try {
      const res = await api.get<InvoiceCostCheckResponse>(`/api/jobs/${jId}/invoice-cost-check`);
      if (res.data) setCostCheckData({
        purchaseOrders: res.data.purchaseOrders ?? { reconciledCount: 0, reconciledTotal: 0, outstandingCount: 0, outstandingTotal: 0 },
        variations: res.data.variations ?? [],
        materials: res.data.materials ?? { markupCaptured: 0, sellPriceTotal: 0 },
      });
    } catch (_) {
      // non-fatal: cost check is advisory only
    }
  };

  const loadInvoiceForEditing = async (invoiceId: string) => {
    setIsLoading(true);
    try {
      const invoiceData = await getInvoice(invoiceId);
      if (invoiceData) {
        setForm(prev => ({
          ...prev,
          clientId: invoiceData.clientId || '',
          title: invoiceData.title || '',
          description: invoiceData.description || '',
          dueDate: invoiceData.dueDate
            ? formatLocalDate(new Date(invoiceData.dueDate))
            : formatLocalDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
          notes: invoiceData.notes || '',
          terms: invoiceData.terms || '',
        }));
        setIsRecurring(invoiceData.isRecurring || false);
        if (invoiceData.recurrencePattern) {
          setRecurrencePattern(invoiceData.recurrencePattern as typeof recurrencePattern);
        }
        if (invoiceData.recurrenceEndDate) {
          setRecurrenceEndDate(formatLocalDate(new Date(invoiceData.recurrenceEndDate)));
        }
        if (invoiceData.lineItems && invoiceData.lineItems.length > 0) {
          setLineItems(invoiceData.lineItems.map((item: any): LineItem => ({
            id: String(item.id || `line-${Date.now()}-${Math.random()}`),
            description: String(item.description || ''),
            quantity: String(item.quantity ?? 1),
            unitPrice: String(item.unitPrice ?? 0),
          })));
        }
        // Load cost check when the invoice is linked to a job so the panel
        // shows on the edit/send path, not just on new-invoice creation.
        if (invoiceData.jobId) {
          setJobId(invoiceData.jobId);
          setCostCheckData(null);
          setCostCheckExpanded(false);
          fetchCostCheck(invoiceData.jobId);
        }
      }
    } catch (error) {
      if (__DEV__) console.log('Error loading invoice for editing:', error);
      Alert.alert('Error', 'Failed to load invoice data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClaimAndPrefill = async (jId: string, cId: string) => {
    setIsLoadingJob(true);
    try {
      // Fetch job metadata for client name
      const jobRes = await api.get<{ clientId?: string; title?: string; description?: string }>(`/api/jobs/${jId}`);
      if (jobRes.data) {
        const job = jobRes.data;
        setForm(prev => ({ ...prev, clientId: job.clientId || prev.clientId }));
        if (job.clientId) {
          const clientRes = await api.get<{ name?: string }>(`/api/clients/${job.clientId}`);
          if (clientRes.data) {
            setForm(prev => ({ ...prev, clientName: clientRes.data!.name || '' }));
          }
        }
      }
      // Fetch the progress claim detail
      const claimRes = await api.get<{ claim: any; lineItems: any[] }>(`/api/jobs/${jId}/claims/${cId}`);
      if (claimRes.data) {
        const { claim, lineItems } = claimRes.data;
        setForm(prev => ({
          ...prev,
          title: `Progress Claim ${claim.claimNumber || ''}`.trim(),
          description: claim.notes || prev.description,
        }));
        if (Array.isArray(lineItems) && lineItems.length > 0) {
          const invoiceLines: LineItem[] = lineItems
            .filter((li: any) => parseFloat(li.thisClaim || '0') > 0)
            .map((li: any, idx: number) => ({
              id: `claim-${cId}-${idx}`,
              description: String(li.description || ''),
              quantity: '1',
              unitPrice: String(Math.abs(parseFloat(li.thisClaim || '0')).toFixed(2)),
            }));
          if (invoiceLines.length > 0) setLineItems(invoiceLines);
        }
      }
    } catch (err) {
      if (__DEV__) console.log('[invoice/new] Error loading claim for prefill:', err);
    } finally {
      setIsLoadingJob(false);
    }
  };

  const fetchJobAndPrefill = async (jId: string) => {
    setIsLoadingJob(true);
    try {
      const response = await api.get<{ clientId?: string; title?: string; description?: string }>(`/api/jobs/${jId}`);
      if (response.data) {
        const job = response.data;
        setForm(prev => ({
          ...prev,
          clientId: job.clientId || prev.clientId,
          title: job.title || prev.title,
          description: job.description || prev.description,
        }));
        if (job.clientId) {
          const clientResponse = await api.get<{ name?: string }>(`/api/clients/${job.clientId}`);
          if (clientResponse.data) {
            setForm(prev => ({
              ...prev,
              clientName: clientResponse.data!.name || '',
            }));
          }
        }

        let prefilledFromQuote = false;
        try {
          const quotesResponse = await api.get<any[]>(`/api/quotes`);
          if (quotesResponse.data && Array.isArray(quotesResponse.data)) {
            const jobQuotes = quotesResponse.data
              .filter((q: any) => q.jobId === jId && (q.status === 'accepted' || q.status === 'sent'))
              .sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
            const jobQuote = jobQuotes[0];
            if (jobQuote && jobQuote.lineItems && Array.isArray(jobQuote.lineItems) && jobQuote.lineItems.length > 0) {
              const quoteItems: LineItem[] = jobQuote.lineItems.map((item: any, idx: number) => ({
                id: `quote-${idx}-${Date.now()}`,
                description: item.description || item.name || '',
                quantity: String(item.quantity || 1),
                unitPrice: String(item.unitPrice || item.price || item.rate || 0),
              }));
              setLineItems(quoteItems);
              prefilledFromQuote = true;
            }
          }
        } catch (quoteError) {
          if (__DEV__) console.log('Error fetching quotes for job:', quoteError);
        }

        if (!prefilledFromQuote) {
          const prefillLines: LineItem[] = [];
          try {
            const timeResponse = await api.get(`/api/time-entries?jobId=${jId}&teamView=true`);
            if (timeResponse.data && Array.isArray(timeResponse.data)) {
              // Breaks are only billed when the business has opted in via "Bill for breaks".
              const billBreaks = !!(businessSettings as any)?.billBreaks;
              const completed = timeResponse.data.filter((e: any) => e.endTime && (billBreaks || !e.isBreak));
              if (completed.length > 0) {
                const byWorker: Record<string, { name: string; totalMs: number; rate: number; entries: number }> = {};
                completed.forEach((e: any) => {
                  const key = e.userId || 'unknown';
                  if (!byWorker[key]) {
                    byWorker[key] = {
                      name: e.userName || 'Labour',
                      totalMs: 0,
                      rate: parseFloat(e.hourlyRate) || 0,
                      entries: 0,
                    };
                  }
                  byWorker[key].totalMs += new Date(e.endTime).getTime() - new Date(e.startTime).getTime();
                  byWorker[key].entries++;
                  if (parseFloat(e.hourlyRate) > 0) {
                    byWorker[key].rate = parseFloat(e.hourlyRate);
                  }
                });
                Object.entries(byWorker).forEach(([, worker]) => {
                  const hrs = Math.round(worker.totalMs / (1000 * 60 * 60) * 10) / 10;
                  if (hrs > 0) {
                    const rate = Math.round(worker.rate * 100) / 100;
                    const rateNote = rate > 0 ? '' : ' (rate not set)';
                    prefillLines.push({
                      id: `labour-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                      description: `Labour \u2014 ${worker.name} \u2014 ${hrs}hrs${rateNote}`,
                      quantity: String(hrs),
                      unitPrice: String(rate),
                    });
                  }
                });
              }
            }
          } catch (timeError) {
            if (__DEV__) console.log('Error fetching time entries:', timeError);
          }

          // Materials roll into the invoice with the rate-card markup applied.
          // Sell-price priority: explicit unitPrice > (unitCost x markup) > skip.
          // Markup % priority: material markupPercent > rate card materialMarkupPct > 20% default.
          try {
            const matResponse = await api.get(`/api/jobs/${jId}/materials`);
            if (matResponse.data && Array.isArray(matResponse.data) && matResponse.data.length > 0) {
              let fallbackMarkup = 20;
              try {
                const rcResponse = await api.get(`/api/rate-cards`);
                if (rcResponse.data && Array.isArray(rcResponse.data)) {
                  const card = rcResponse.data.find((r: any) => r?.tradeType === (businessSettings as any)?.tradeType) || rcResponse.data[0];
                  const cardMarkup = parseFloat(card?.materialMarkupPct ?? '');
                  if (Number.isFinite(cardMarkup)) fallbackMarkup = cardMarkup;
                }
              } catch {}
              matResponse.data.forEach((m: any) => {
                const qty = parseFloat(m.quantity ?? '1') || 0;
                const explicitPrice = parseFloat(m.unitPrice ?? '0') || 0;
                const cost = parseFloat(m.unitCost ?? '0') || 0;
                const ownMarkup = parseFloat(m.markupPercent ?? '');
                const markupPct = Number.isFinite(ownMarkup) ? ownMarkup : fallbackMarkup;
                let price = 0;
                if (explicitPrice > 0) {
                  price = explicitPrice;
                } else if (cost > 0) {
                  price = Math.round(cost * (1 + markupPct / 100) * 100) / 100;
                }
                if (qty <= 0 || price <= 0) return;
                const unitLabel = m.unit && m.unit !== 'each' ? ` (${m.unit})` : '';
                prefillLines.push({
                  id: `mat-${m.id || Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  description: `${m.name}${unitLabel}`,
                  quantity: String(qty),
                  unitPrice: String(price),
                });
              });
            }
          } catch (matError) {
            if (__DEV__) console.log('Error fetching materials:', matError);
          }

          if (prefillLines.length > 0) {
            setLineItems(prefillLines);
          }
        }
      }
    } catch (error) {
      if (__DEV__) console.log('Error fetching job data:', error);
    } finally {
      setIsLoadingJob(false);
    }
  };

  const fetchJobExpenses = async (jId: string) => {
    setIsLoadingExpenses(true);
    try {
      const response = await api.get(`/api/expenses?jobId=${jId}`);
      if (response.data && Array.isArray(response.data)) {
        setJobExpenses(response.data);
      }
    } catch (error) {
      if (__DEV__) console.log('Error fetching job expenses:', error);
    } finally {
      setIsLoadingExpenses(false);
    }
  };

  const handleImportExpenses = () => {
    if (jobExpenses.length === 0) {
      Alert.alert('No Expenses', 'No expenses recorded for this job');
      return;
    }
    const newItems: LineItem[] = jobExpenses.map(exp => ({
      id: `exp-${exp.id}`,
      description: `${exp.categoryName || 'Expense'}: ${exp.description}`,
      quantity: '1',
      unitPrice: String(parseFloat(exp.amount) || 0),
    }));
    setLineItems([...lineItems, ...newItems]);
    setJobExpenses([]);
    Alert.alert('Expenses Added', `${newItems.length} expense(s) added as line items`);
  };

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
      Alert.alert('Error', 'Please enter a description for this item');
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
      Alert.alert('Error', 'Please enter a client name');
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
      
      Alert.alert('Success', `${response.data!.name} has been added and selected`);
    } catch (error: any) {
      console.error('Failed to create client:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to create client');
    } finally {
      setIsCreatingClient(false);
    }
  };

  const selectedClient = clients.find(c => c.id === form.clientId);

  const handleSave = async () => {
    if (!form.clientId) {
      Alert.alert('Error', 'Please select a client');
      return;
    }

    if (!form.title.trim()) {
      Alert.alert('Error', 'Please enter an invoice title');
      return;
    }

    if (lineItems.length === 0) {
      Alert.alert('Error', 'Please add at least one line item');
      return;
    }

    setIsLoading(true);
    
    const invoiceData: any = {
      clientId: form.clientId,
      clientName: selectedClient?.name,
      jobId: jobId || undefined,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      notes: form.notes.trim() || undefined,
      dueDate: new Date(form.dueDate).toISOString(),
      subtotal: parseFloat(subtotal.toFixed(2)),
      gstAmount: parseFloat(gst.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      documentTemplate: (businessSettings as any)?.documentTemplate || 'professional',
      documentTemplateSettings: (businessSettings as any)?.documentTemplateSettings || null,
      lineItems: lineItems.map(item => ({
        description: item.description,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
      })),
    };

    if (isRecurring) {
      invoiceData.isRecurring = true;
      invoiceData.recurrencePattern = recurrencePattern;
      invoiceData.recurrenceInterval = 1;
      invoiceData.nextRecurrenceDate = calculateNextRecurrenceDate(form.dueDate, recurrencePattern);
      if (recurrenceEndDate) {
        invoiceData.recurrenceEndDate = new Date(recurrenceEndDate).toISOString();
      }
    }
    
    // Offline-first: save offline if no connection
    if (!isOnline) {
      try {
        await offlineStorage.saveInvoiceOffline(invoiceData);
        await confirm({
          title: 'Saved Offline',
          message: 'Invoice saved locally and will sync when you\'re back online.',
          confirmText: 'OK',
          showCancel: false,
        });
        proceedAfterSave();
      } catch (error) {
        console.error('Failed to save invoice offline:', error);
        Alert.alert('Error', 'Failed to save invoice offline. Please try again.');
      }
      setIsLoading(false);
      return;
    }
    
    // Online: try API first, fallback to offline if network error
    try {
      const response = isEditing 
        ? await api.patch(`/api/invoices/${params.editInvoiceId}`, invoiceData)
        : await api.post('/api/invoices', invoiceData);

      if (response.error) {
        Alert.alert('Error', response.error || (isEditing ? 'Failed to update invoice' : 'Failed to create invoice'));
      } else if (response.data) {
        await fetchInvoices();
        await confirm({
          title: 'Success',
          message: isEditing ? 'Invoice updated successfully' : 'Invoice created successfully',
          confirmText: 'OK',
          showCancel: false,
        });
        proceedAfterSave();
      } else {
        Alert.alert('Error', isEditing ? 'Failed to update invoice' : 'Failed to create invoice');
      }
    } catch (error: any) {
      // Network error - save offline (only for create, not edit)
      if (!isEditing && (error.message?.includes('Network') || error.code === 'ECONNABORTED')) {
        try {
          await offlineStorage.saveInvoiceOffline(invoiceData);
          await confirm({
            title: 'Saved Offline',
            message: 'Invoice saved locally and will sync when connection is restored.',
            confirmText: 'OK',
            showCancel: false,
          });
          proceedAfterSave();
        } catch (offlineError) {
          console.error('Failed to save invoice offline:', offlineError);
          Alert.alert('Error', 'Failed to save invoice. Please try again.');
        }
      } else {
        Alert.alert('Error', isEditing ? 'Failed to update invoice. Please try again.' : 'Failed to create invoice. Please try again.');
      }
    }
    setIsLoading(false);
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
      Alert.alert('Error', 'Failed to load catalog');
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
      Alert.alert('Error', 'Failed to load price list');
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
            <Text style={styles.headerTitle}>{isEditing ? 'Edit Invoice' : 'New Invoice'}</Text>
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeText}>{formatCurrency(total)}</Text>
            </View>
          </View>
          
          {/* Edit / Preview switcher */}
          <View style={styles.tabSwitcher}>
            {(['edit', 'preview'] as const).map((tab) => {
              const active = activeTab === tab;
              return (
                <Pressable
                  key={tab}
                  style={[styles.tabSwitch, active && styles.tabSwitchActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Feather
                    name={tab === 'edit' ? 'edit-2' : 'eye'}
                    size={16}
                    color={active ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text style={[styles.tabSwitchText, { color: active ? colors.primaryForeground : colors.foreground }]}>
                    {tab === 'edit' ? 'Edit' : 'Preview'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Batch Review Banner */}
        {isBatchReview && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingVertical: 10,
            backgroundColor: colors.muted,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 }}>
              <Feather name="layers" size={16} color={colors.primary} />
              <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                Reviewing invoice {batchIndex + 1} of {batchQueue.length}
              </Text>
            </View>
            <Pressable
              onPress={proceedAfterSave}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.mutedForeground }}>
                Skip
              </Text>
            </Pressable>
          </View>
        )}

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
              type="invoice"
              title={form.title}
              description={form.description}
              date={form.invoiceDate}
              dueDate={form.dueDate}
              lineItems={previewLineItems}
              notes={form.notes}
              terms={form.terms}
              business={businessInfo}
              client={clientInfo}
              gstEnabled={user?.gstEnabled !== false}
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
            {(isLoadingClients && clients.length === 0) || isLoadingJob ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground, marginTop: spacing.md }}>
                  {isLoadingJob ? 'Loading job data...' : 'Loading clients...'}
                </Text>
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
                          {form.clientName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.selectedClientText}>{form.clientName}</Text>
                    </View>
                  ) : (
                    <Text style={styles.selectPlaceholder}>Tap to select a client...</Text>
                  )}
                  <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
                </PressableRow>
              </View>

              {/* Invoice Details Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Feather name="file-text" size={16} color={colors.primary} />
                  <Text style={styles.cardHeaderText}>Invoice Details</Text>
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Title</Text>
                  <TextInput
                    style={styles.input}
                    value={form.title}
                    onChangeText={(text) => setForm({ ...form, title: text })}
                    placeholder="e.g., Plumbing Services - March"
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
                    label="Due Date"
                    value={new Date(form.dueDate + 'T00:00:00')}
                    onChange={(date) => setForm({ ...form, dueDate: formatLocalDate(date) })}
                    minimumDate={new Date()}
                  />
                </View>
              </View>

              {/* Recurring Invoice Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Feather name="repeat" size={16} color={colors.primary} />
                  <Text style={styles.cardHeaderText}>Recurring Invoice</Text>
                </View>
                
                <PressableRow style={styles.toggleRow} onPress={() => setIsRecurring(!isRecurring)} >
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleTitle}>Make this recurring</Text>
                    <Text style={styles.toggleDescription}>
                      Automatically generate invoices on a schedule
                    </Text>
                  </View>
                  <View style={[
                    styles.toggleSwitch, 
                    isRecurring && { backgroundColor: colors.primary }
                  ]}>
                    <View style={[
                      styles.toggleThumb,
                      isRecurring && styles.toggleThumbActive
                    ]} />
                  </View>
                </PressableRow>

                {isRecurring && (
                  <View style={styles.recurringOptions}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Frequency</Text>
                      <PressableRow style={styles.selectButton} onPress={() => setShowRecurrenceOptions(true)} >
                        <View style={styles.selectedClient}>
                          <Feather name="repeat" size={16} color={colors.primary} />
                          <Text style={styles.selectedClientText}>
                            {RECURRENCE_OPTIONS.find(o => o.value === recurrencePattern)?.label || 'Select frequency'}
                          </Text>
                        </View>
                        <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
                      </PressableRow>
                    </View>

                    <View style={styles.inputGroup}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                        <Text style={styles.inputLabel}>End Date (optional)</Text>
                        {recurrenceEndDate ? (
                          <PressableRow onPress={() => setRecurrenceEndDate('')} >
                            <Text style={{ fontSize: typography.sizes.sm, color: colors.primary, fontWeight: fontWeights.medium }}>Clear</Text>
                          </PressableRow>
                        ) : null}
                      </View>
                      {recurrenceEndDate ? (
                        <DatePicker
                          value={new Date(recurrenceEndDate + 'T00:00:00')}
                          onChange={(date) => setRecurrenceEndDate(formatLocalDate(date))}
                          minimumDate={new Date(form.dueDate + 'T00:00:00')}
                        />
                      ) : (
                        <PressableRow style={[styles.input, { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }]} onPress={() => setRecurrenceEndDate(formatLocalDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)))} >
                          <Feather name="calendar" size={16} color={colors.mutedForeground} />
                          <Text style={{ color: colors.mutedForeground, fontSize: typography.sizes.md }}>No end date (runs indefinitely)</Text>
                        </PressableRow>
                      )}
                    </View>

                    <View style={styles.recurringPreview}>
                      <Feather name="info" size={14} color={colors.info} />
                      <Text style={styles.recurringPreviewText}>
                        Next invoice will be generated on{' '}
                        {new Date(calculateNextRecurrenceDate(form.dueDate, recurrencePattern)).toLocaleDateString('en-AU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </Text>
                    </View>
                  </View>
                )}
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
                  const isZeroRate = (parseFloat(item.unitPrice) || 0) === 0 && item.description.toLowerCase().includes('labour');
                  return (
                    <View key={item.id} style={styles.lineItemRow}>
                      <View style={styles.lineItemInfo}>
                        <Text style={styles.lineItemDescription} numberOfLines={1}>
                          {item.description}
                        </Text>
                        <Text style={[styles.lineItemMeta, isZeroRate && { color: colors.warning }]}>
                          {isZeroRate ? 'Rate not set \u2014 tap to edit' : `${item.quantity} \u00d7 ${formatCurrency(parseFloat(item.unitPrice) || 0)}`}
                        </Text>
                      </View>
                      <Text style={[styles.lineItemTotal, isZeroRate && { color: colors.warning }]}>
                        {isZeroRate ? '$0.00' : formatCurrency(itemTotal)}
                      </Text>
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
                </View>

                {jobId && jobExpenses.length > 0 && (
                  <PressableRow style={[styles.addItemButton, { marginTop: spacing.sm, backgroundColor: colors.primaryLight }]} onPress={handleImportExpenses} >
                    <Feather name="credit-card" size={16} color={colors.primary} />
                    <Text style={[styles.addItemText, { color: colors.primary }]}>
                      Import {jobExpenses.length} Job Expense{jobExpenses.length !== 1 ? 's' : ''} ({formatCurrency(jobExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0))})
                    </Text>
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

              {/* Cost Check Panel — shown when invoice is linked to a job */}
              {jobId && costCheckData && (() => {
                const po = costCheckData.purchaseOrders;
                // Match each approved variation against current line item descriptions
                // (case-insensitive substring). Only unmatched ones get a warning.
                const lineDescriptions = lineItems.map(li => li.description.toLowerCase());
                const unmatchedVariations = costCheckData.variations.filter(v => {
                  const needle = v.title.toLowerCase();
                  return !lineDescriptions.some(d => d.includes(needle));
                });
                const unmatchedTotal = unmatchedVariations.reduce((s, v) => s + v.amount, 0);
                const hasOutstandingPOs = po.outstandingCount > 0;
                const hasUnmatchedVariations = unmatchedVariations.length > 0;
                const hasWarnings = hasOutstandingPOs || hasUnmatchedVariations;
                const warningCount = (hasOutstandingPOs ? 1 : 0) + (hasUnmatchedVariations ? 1 : 0);
                const fmt = (n: number) => formatCurrency(n);
                return (
                  <View style={[styles.card, { borderColor: hasWarnings ? colors.warning : colors.border }]}>
                    <Pressable
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                      onPress={() => setCostCheckExpanded(!costCheckExpanded)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Feather
                          name={hasWarnings ? 'alert-triangle' : 'check-circle'}
                          size={16}
                          color={hasWarnings ? colors.warning : colors.success}
                        />
                        <Text style={styles.cardHeaderText}>Cost check</Text>
                        {hasWarnings && (
                          <View style={{ backgroundColor: colors.warningLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                            <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: colors.warningDark }}>
                              {warningCount === 1 ? '1 item to review' : `${warningCount} items to review`}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Feather name={costCheckExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.mutedForeground} />
                    </Pressable>

                    {costCheckExpanded && (
                      <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
                        {/* Purchase Orders */}
                        <View style={{ backgroundColor: hasOutstandingPOs ? colors.warningLight : colors.muted, borderRadius: 10, padding: spacing.md }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                            <Feather name="shopping-cart" size={14} color={hasOutstandingPOs ? colors.warningDark : colors.mutedForeground} />
                            <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: hasOutstandingPOs ? colors.warningDark : colors.foreground }}>
                              Purchase Orders
                            </Text>
                          </View>
                          {po.reconciledCount === 0 && po.outstandingCount === 0 ? (
                            <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>No purchase orders for this job</Text>
                          ) : (
                            <>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                                <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>Reconciled</Text>
                                <Text style={{ fontSize: typography.sizes.sm, color: colors.success }}>
                                  {po.reconciledCount} ({fmt(po.reconciledTotal)})
                                </Text>
                              </View>
                              {hasOutstandingPOs && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                                  <Text style={{ fontSize: typography.sizes.sm, color: colors.warningDark, fontWeight: fontWeights.medium }}>Outstanding</Text>
                                  <Text style={{ fontSize: typography.sizes.sm, color: colors.warningDark, fontWeight: fontWeights.semibold }}>
                                    {po.outstandingCount} ({fmt(po.outstandingTotal)})
                                  </Text>
                                </View>
                              )}
                              {hasOutstandingPOs && (
                                <Pressable onPress={() => router.push(`/job/${jobId}` as any)} style={{ marginTop: spacing.xs }}>
                                  <Text style={{ fontSize: typography.sizes.sm, color: colors.primary, fontWeight: fontWeights.medium }}>
                                    Review POs on job
                                  </Text>
                                </Pressable>
                              )}
                            </>
                          )}
                        </View>

                        {/* Approved Variations — only warn for ones not yet in line items */}
                        <View style={{ backgroundColor: hasUnmatchedVariations ? colors.warningLight : colors.muted, borderRadius: 10, padding: spacing.md }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                            <Feather name="git-merge" size={14} color={hasUnmatchedVariations ? colors.warningDark : colors.mutedForeground} />
                            <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: hasUnmatchedVariations ? colors.warningDark : colors.foreground }}>
                              Approved Variations
                            </Text>
                          </View>
                          {costCheckData.variations.length === 0 ? (
                            <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>No approved variations</Text>
                          ) : hasUnmatchedVariations ? (
                            <>
                              {unmatchedVariations.map(v => (
                                <View key={v.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                                  <Text style={{ fontSize: typography.sizes.sm, color: colors.warningDark, flex: 1, marginRight: spacing.sm }} numberOfLines={1}>{v.title}</Text>
                                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.warningDark }}>{fmt(v.amount)}</Text>
                                </View>
                              ))}
                              <Text style={{ fontSize: typography.sizes.sm, color: colors.warningDark, marginTop: spacing.xs }}>
                                Not yet found in line items — add them before sending
                              </Text>
                            </>
                          ) : (
                            <Text style={{ fontSize: typography.sizes.sm, color: colors.success }}>
                              All {costCheckData.variations.length} variation{costCheckData.variations.length !== 1 ? 's' : ''} ({fmt(costCheckData.variations.reduce((s, v) => s + v.amount, 0))}) accounted for
                            </Text>
                          )}
                        </View>

                        {/* Material Markup */}
                        <View style={{ backgroundColor: colors.muted, borderRadius: 10, padding: spacing.md }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                            <Feather name="tag" size={14} color={colors.mutedForeground} />
                            <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                              Material Markup
                            </Text>
                          </View>
                          {costCheckData.materials.sellPriceTotal === 0 ? (
                            <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>No materials recorded</Text>
                          ) : (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                              <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>Markup captured</Text>
                              <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.success }}>
                                {fmt(costCheckData.materials.markupCaptured)}
                              </Text>
                            </View>
                          )}
                        </View>

                        <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, textAlign: 'center' }}>
                          Advisory only. You can still save and send this invoice.
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Payment Terms Card */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Feather name="file-text" size={16} color={colors.primary} />
                  <Text style={styles.cardHeaderText}>Payment Terms & Notes</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={form.notes}
                  onChangeText={(text) => setForm({ ...form, notes: text })}
                  placeholder="Payment terms, bank details, or notes for the client..."
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
                    <Text style={{ color: colors.primaryForeground, fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold }}>{isEditing ? 'Update Invoice' : isBatchReview ? (isLastInBatch ? 'Save & Finish' : 'Save & Next') : 'Create Invoice'}</Text>
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
                placeholder="What are you charging for?"
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

      {/* Recurrence Frequency Picker Modal */}
      <AppBottomSheet
        visible={showRecurrenceOptions}
        onDismiss={() => setShowRecurrenceOptions(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}
      >
        <TouchableOpacity 
          style={styles.frequencyModalOverlay}
          activeOpacity={1}
          onPress={() => setShowRecurrenceOptions(false)}
        >
          <View style={styles.frequencyModalContent}>
            <View style={styles.frequencyModalHandle} />
            <Text style={styles.frequencyModalTitle}>Select Frequency</Text>
            {RECURRENCE_OPTIONS.map((option) => (
              <PressableRow key={option.value} style={[ styles.frequencyOption, recurrencePattern === option.value && styles.frequencyOptionSelected ]} onPress={() => { setRecurrencePattern(option.value); setShowRecurrenceOptions(false); }} >
                <View style={styles.frequencyOptionContent}>
                  <Feather 
                    name="repeat" 
                    size={18} 
                    color={recurrencePattern === option.value ? colors.primary : colors.mutedForeground} 
                  />
                  <Text style={[
                    styles.frequencyOptionText,
                    recurrencePattern === option.value && { color: colors.primary, fontWeight: fontWeights.semibold }
                  ]}>
                    {option.label}
                  </Text>
                </View>
                {recurrencePattern === option.value && (
                  <Feather name="check" size={20} color={colors.primary} />
                )}
              </PressableRow>
            ))}
            <PressableRow style={styles.frequencyModalCancel} onPress={() => setShowRecurrenceOptions(false)} >
              <Text style={styles.frequencyModalCancelText}>Cancel</Text>
            </PressableRow>
          </View>
        </TouchableOpacity>
      </AppBottomSheet>
    </>
  );
}
