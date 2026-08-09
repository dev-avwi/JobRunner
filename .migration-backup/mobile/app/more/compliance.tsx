import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, Modal, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { Alert } from '@/lib/alert';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, ThemeColors, colorWithOpacity } from '../../src/lib/theme';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { api, API_URL } from '../../src/lib/api';
import { format } from 'date-fns';
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes, componentStyles, fontWeights } from '../../src/lib/design-tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { PressableRow } from '../../src/components/ui/PressableRow';

interface ComplianceDocument {
  id: string;
  type: string;
  title: string;
  documentNumber: string | null;
  issuer: string | null;
  holderName: string | null;
  holderUserId: string | null;
  expiryDate: string | null;
  coverageAmount: string | null;
  insurer: string | null;
  vehiclePlate: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  status?: string;
  documentName?: string;
  issuedDate?: string | null;
}

type FilterTab = 'all' | 'valid' | 'expiring_soon' | 'expired';

const DOCUMENT_TYPES = [
  { value: 'licence', label: 'Licence' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'certification', label: 'Certification' },
  { value: 'white_card', label: 'White Card' },
  { value: 'vehicle_rego', label: 'Vehicle Rego' },
  { value: 'other', label: 'Other' },
];

type StatusConfigEntry = { label: string; color: string; bgColor: string };
type TypeConfigEntry = { icon: keyof typeof Feather.glyphMap; label: string; color: string };

const buildStatusConfig = (colors: ThemeColors): Record<string, StatusConfigEntry> => ({
  valid: {
    label: 'Valid',
    color: colors.success,
    bgColor: colorWithOpacity(colors.success, 0.12),
  },
  expiring_soon: {
    label: 'Expiring Soon',
    color: colors.warning,
    bgColor: colorWithOpacity(colors.warning, 0.12),
  },
  expired: {
    label: 'Expired',
    color: colors.destructive,
    bgColor: colorWithOpacity(colors.destructive, 0.12),
  },
  pending: {
    label: 'Pending',
    color: colors.mutedForeground,
    bgColor: colorWithOpacity(colors.mutedForeground, 0.12),
  },
});

const buildTypeConfig = (colors: ThemeColors): Record<string, TypeConfigEntry> => ({
  licence: { icon: 'shield', label: 'Licence', color: colors.info },
  license: { icon: 'shield', label: 'Licence', color: colors.info },
  insurance: { icon: 'file-text', label: 'Insurance', color: colors.primary },
  certification: { icon: 'award', label: 'Certification', color: colors.warning },
  certificate: { icon: 'award', label: 'Certificate', color: colors.warning },
  white_card: { icon: 'credit-card', label: 'White Card', color: colors.success },
  vehicle_rego: { icon: 'truck', label: 'Vehicle Rego', color: colors.info },
  permit: { icon: 'clipboard', label: 'Permit', color: colors.destructive },
  other: { icon: 'file', label: 'Other', color: colors.mutedForeground },
});

const makeGetTypeConfig = (typeConfig: Record<string, TypeConfigEntry>, fallbackColor: string) =>
  (type: string): TypeConfigEntry =>
    typeConfig[type.toLowerCase()] || { icon: 'file' as keyof typeof Feather.glyphMap, label: type, color: fallbackColor };

const computeStatus = (doc: ComplianceDocument): string => {
  if (doc.status) return doc.status;
  if (!doc.expiryDate) return 'valid';
  const now = new Date();
  const expiry = new Date(doc.expiryDate);
  if (expiry < now) return 'expired';
  const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntilExpiry <= 30) return 'expiring_soon';
  return 'valid';
};

const getDocName = (doc: ComplianceDocument): string => {
  return doc.documentName || doc.title || 'Untitled Document';
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'valid', label: 'Active' },
  { key: 'expiring_soon', label: 'Expiring' },
  { key: 'expired', label: 'Expired' },
];

const createStyles = (colors: ThemeColors, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingTop: pageShell.paddingTop,
    paddingBottom: bottomNavHeight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    ...typography.largeTitle,
    color: colors.foreground,
  },
  pageSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  addButtonText: {
    color: colors.primaryForeground,
    ...typography.button,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: fontWeights.bold,
    letterSpacing: -0.5,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.label,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  sectionHeader: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  filterTab: {
    paddingHorizontal: spacing.lg,
    height: sizes.filterChipHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    ...typography.button,
    color: colors.mutedForeground,
  },
  filterTabTextActive: {
    color: colors.primaryForeground,
  },
  documentCard: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  documentCardExpanded: {
    borderColor: colors.primary,
  },
  documentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  documentIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
  },
  typeBadgeText: {
    ...typography.badge,
    color: colors.mutedForeground,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  statusBadgeText: {
    ...typography.badge,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.3,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  expiryText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  detailsContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  detailValue: {
    ...typography.caption,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    justifyContent: 'space-between',
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
  },
  editButtonText: {
    ...typography.button,
    color: colors.primaryForeground,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colorWithOpacity(colors.destructive, 0.12),
  },
  deleteButtonText: {
    ...typography.button,
    color: colors.destructive,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingBottom: bottomNavHeight,
  },
  loadingText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colorWithOpacity(colors.mutedForeground, 0.10),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  emptyAddButton: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyAddButtonText: {
    color: colors.primaryForeground,
    ...typography.button,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
    marginBottom: spacing.md,
    paddingBottom: bottomNavHeight,
  },
  errorText: {
    ...typography.caption,
    color: colors.destructive,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
  },
  retryButtonText: {
    ...typography.button,
    color: colors.primaryForeground,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  modalTitle: {
    ...typography.cardTitle,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalBody: {
    padding: spacing.md,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  formLabel: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  formInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    ...typography.body,
    color: colors.foreground,
  },
  formInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  typeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}18`,
  },
  typeOptionText: {
    ...typography.caption,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  typeOptionTextSelected: {
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.card,
  },
  uploadButtonText: {
    ...typography.body,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  uploadedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colorWithOpacity(colors.success, 0.12),
  },
  uploadedText: {
    ...typography.caption,
    fontWeight: fontWeights.medium,
    color: colors.success,
    flex: 1,
  },
  removeUploadButton: {
    padding: spacing.xs,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
  },
  saveButton: {
    flex: 2,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...typography.body,
    fontWeight: fontWeights.bold,
    color: colors.primaryForeground,
  },
});

interface FormData {
  type: string;
  title: string;
  documentNumber: string;
  issuer: string;
  expiryDate: string;
  notes: string;
  holderName: string;
  coverageAmount: string;
  insurer: string;
  vehiclePlate: string;
}

const emptyForm: FormData = {
  type: 'licence',
  title: '',
  documentNumber: '',
  issuer: '',
  expiryDate: '',
  notes: '',
  holderName: '',
  coverageAmount: '',
  insurer: '',
  vehiclePlate: '',
};

export default function ComplianceScreen() {
  const { colors } = useTheme();
  const confirm = useConfirmDialog();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = createStyles(colors, bottomNavHeight);
  const STATUS_CONFIG = buildStatusConfig(colors);
  const TYPE_CONFIG = buildTypeConfig(colors);
  const getTypeConfig = makeGetTypeConfig(TYPE_CONFIG, colors.mutedForeground);

  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const [showModal, setShowModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ComplianceDocument | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [hasExistingAttachment, setHasExistingAttachment] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get<ComplianceDocument[]>('/api/compliance-documents');
      if (response.error) {
        setError(response.error);
      } else {
        setDocuments(response.data || []);
      }
    } catch (err) {
      setError('Failed to load compliance documents');
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

  const documentsWithStatus = documents.map(doc => ({
    ...doc,
    computedStatus: computeStatus(doc),
  }));

  const filteredDocuments = activeFilter === 'all'
    ? documentsWithStatus
    : documentsWithStatus.filter(d => d.computedStatus === activeFilter);

  const validCount = documentsWithStatus.filter(d => d.computedStatus === 'valid').length;
  const expiringSoonCount = documentsWithStatus.filter(d => d.computedStatus === 'expiring_soon').length;
  const expiredCount = documentsWithStatus.filter(d => d.computedStatus === 'expired').length;
  const totalCount = documents.length;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'dd MMM yyyy');
    } catch {
      return '—';
    }
  };

  const openCreateModal = () => {
    setEditingDoc(null);
    setForm(emptyForm);
    setAttachmentUri(null);
    setHasExistingAttachment(false);
    setShowModal(true);
  };

  const openEditModal = (doc: ComplianceDocument) => {
    setEditingDoc(doc);
    setForm({
      type: doc.type || 'other',
      title: getDocName(doc),
      documentNumber: doc.documentNumber || '',
      issuer: doc.issuer || '',
      expiryDate: doc.expiryDate ? new Date(doc.expiryDate).toISOString().split('T')[0] : '',
      notes: doc.notes || '',
      holderName: doc.holderName || '',
      coverageAmount: doc.coverageAmount || '',
      insurer: doc.insurer || '',
      vehiclePlate: doc.vehiclePlate || '',
    });
    setAttachmentUri(null);
    setHasExistingAttachment(!!doc.attachmentUrl);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingDoc(null);
    setForm(emptyForm);
    setAttachmentUri(null);
    setHasExistingAttachment(false);
  };

  const handlePickImage = async () => {
    Alert.alert(
      'Add Photo',
      'Choose a source for the document photo',
      [
        {
          text: 'Camera',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Required', 'Camera access is needed to take photos.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              quality: 0.8,
              allowsEditing: true,
            });
            if (!result.canceled && result.assets[0]) {
              setAttachmentUri(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Photo Library',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Required', 'Photo library access is needed to select photos.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              quality: 0.8,
              allowsEditing: true,
            });
            if (!result.canceled && result.assets[0]) {
              setAttachmentUri(result.assets[0].uri);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const uploadAttachment = async (docId: string): Promise<string | null> => {
    if (!attachmentUri) return null;
    try {
      const filename = attachmentUri.split('/').pop() || 'document.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1] : 'jpg';
      const type = `image/${ext}`;

      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'ios' ? attachmentUri.replace('file://', '') : attachmentUri,
        name: filename,
        type,
      } as any);
      formData.append('type', 'compliance');

      const response = await api.uploadFile<{ url: string }>('/api/upload', formData);
      if (response.data?.url) {
        return response.data.url;
      }
      return null;
    } catch (err) {
      if (__DEV__) console.log('Attachment upload failed:', err);
      return null;
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert('Required', 'Please enter a document name.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        type: form.type,
        title: form.title.trim(),
        documentNumber: form.documentNumber.trim() || null,
        issuer: form.issuer.trim() || null,
        expiryDate: form.expiryDate || null,
        notes: form.notes.trim() || null,
        holderName: form.holderName.trim() || null,
        coverageAmount: form.coverageAmount.trim() || null,
        insurer: form.insurer.trim() || null,
        vehiclePlate: form.vehiclePlate.trim() || null,
      };

      let response;
      if (editingDoc) {
        response = await api.patch<ComplianceDocument>(`/api/compliance-documents/${editingDoc.id}`, payload);
      } else {
        response = await api.post<ComplianceDocument>('/api/compliance-documents', payload);
      }

      if (response.error) {
        Alert.alert('Error', response.error);
        return;
      }

      if (attachmentUri && response.data?.id) {
        const uploadedUrl = await uploadAttachment(response.data.id);
        if (uploadedUrl) {
          await api.patch(`/api/compliance-documents/${response.data.id}`, {
            attachmentUrl: uploadedUrl,
            attachmentType: 'image',
          });
        }
      }

      closeModal();
      fetchData();
      Alert.alert('Success', editingDoc ? 'Document updated successfully.' : 'Document added successfully.');
    } catch (err) {
      Alert.alert('Error', 'Failed to save document. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (doc: ComplianceDocument) => {
    const ok = await confirm({
      title: 'Delete Document',
      message: `Are you sure you want to delete "${getDocName(doc)}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (ok) {
      try {
        const response = await api.delete(`/api/compliance-documents/${doc.id}`);
        if (response.error) {
          Alert.alert('Error', response.error);
          return;
        }
        setExpandedId(null);
        fetchData();
        Alert.alert('Deleted', 'Document has been deleted.');
      } catch (err) {
        Alert.alert('Error', 'Failed to delete document.');
      }
    }
  };

  const renderHeroSection = () => {
    return (
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: STATUS_CONFIG.valid.bgColor }]}>
            <Feather name="check-circle" size={16} color={STATUS_CONFIG.valid.color} />
          </View>
          <Text style={[styles.statValue, { color: STATUS_CONFIG.valid.color }]}>{validCount}</Text>
          <Text style={styles.statLabel}>Valid</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: STATUS_CONFIG.expiring_soon.bgColor }]}>
            <Feather name="clock" size={16} color={STATUS_CONFIG.expiring_soon.color} />
          </View>
          <Text style={[styles.statValue, { color: STATUS_CONFIG.expiring_soon.color }]}>{expiringSoonCount}</Text>
          <Text style={styles.statLabel}>Expiring</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: STATUS_CONFIG.expired.bgColor }]}>
            <Feather name="alert-circle" size={16} color={STATUS_CONFIG.expired.color} />
          </View>
          <Text style={[styles.statValue, { color: STATUS_CONFIG.expired.color }]}>{expiredCount}</Text>
          <Text style={styles.statLabel}>Expired</Text>
        </View>
      </View>
    );
  };

  const renderFilterTabs = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
      <View style={styles.filterRow}>
        {FILTER_TABS.map(tab => (
          <PressableRow key={tab.key} style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]} onPress={() => setActiveFilter(tab.key)} >
            <Text style={[styles.filterTabText, activeFilter === tab.key && styles.filterTabTextActive]}>
              {tab.label}
              {tab.key !== 'all' && ` (${tab.key === 'valid' ? validCount : tab.key === 'expiring_soon' ? expiringSoonCount : expiredCount})`}
            </Text>
          </PressableRow>
        ))}
      </View>
    </ScrollView>
  );

  const renderDocumentCard = (doc: ComplianceDocument & { computedStatus: string }) => {
    const typeConfig = getTypeConfig(doc.type);
    const statusConfig = STATUS_CONFIG[doc.computedStatus] || STATUS_CONFIG.pending;
    const isExpanded = expandedId === doc.id;

    return (
      <PressableRow key={doc.id} style={[styles.documentCard, isExpanded && styles.documentCardExpanded]} onPress={() => setExpandedId(isExpanded ? null : doc.id)} >
        <View style={styles.documentTopRow}>
          <View style={[styles.documentIconContainer, { backgroundColor: `${typeConfig.color}18` }]}>
            <Feather name={typeConfig.icon} size={20} color={typeConfig.color} />
          </View>
          <View style={styles.documentInfo}>
            <Text style={styles.documentName} numberOfLines={2}>{getDocName(doc)}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{typeConfig.label}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
              </View>
            </View>
          </View>
          <Feather name={isExpanded ? 'chevron-up' : 'chevron-right'} size={18} color={colors.mutedForeground} />
        </View>

        {doc.expiryDate && (
          <View style={styles.expiryRow}>
            <Feather name="calendar" size={12} color={colors.mutedForeground} />
            <Text style={styles.expiryText}>Expires {formatDate(doc.expiryDate)}</Text>
          </View>
        )}

        {isExpanded && (
          <View style={styles.detailsContainer}>
            {doc.documentNumber && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Document Number</Text>
                <Text style={styles.detailValue}>{doc.documentNumber}</Text>
              </View>
            )}
            {doc.issuer && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Issuing Body</Text>
                <Text style={styles.detailValue}>{doc.issuer}</Text>
              </View>
            )}
            {doc.holderName && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Holder</Text>
                <Text style={styles.detailValue}>{doc.holderName}</Text>
              </View>
            )}
            {doc.insurer && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Insurer</Text>
                <Text style={styles.detailValue}>{doc.insurer}</Text>
              </View>
            )}
            {doc.coverageAmount && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Coverage</Text>
                <Text style={styles.detailValue}>{doc.coverageAmount}</Text>
              </View>
            )}
            {doc.vehiclePlate && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Vehicle Plate</Text>
                <Text style={styles.detailValue}>{doc.vehiclePlate}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Expiry Date</Text>
              <Text style={styles.detailValue}>{formatDate(doc.expiryDate)}</Text>
            </View>
            {doc.attachmentUrl && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Attachment</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Feather name="paperclip" size={12} color={colors.primary} />
                  <Text style={[styles.detailValue, { color: colors.primary }]}>Uploaded</Text>
                </View>
              </View>
            )}
            {doc.notes && (
              <View style={[styles.detailRow, { flexDirection: 'column', alignItems: 'flex-start', gap: spacing.xs }]}>
                <Text style={styles.detailLabel}>Notes</Text>
                <Text style={[styles.detailValue, { fontWeight: fontWeights.regular }]}>{doc.notes}</Text>
              </View>
            )}
            <View style={styles.actionButtonsRow}>
              <PressableRow style={styles.editButton} onPress={() => openEditModal(doc)} >
                <Feather name="edit-2" size={14} color={colors.primaryForeground} />
                <Text style={styles.editButtonText}>Edit</Text>
              </PressableRow>
              <PressableRow style={styles.deleteButton} onPress={() => handleDelete(doc)} >
                <Feather name="trash-2" size={14} color="#ef4444" />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </PressableRow>
            </View>
          </View>
        )}
      </PressableRow>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Feather name="shield" size={40} color={colors.mutedForeground} />
      </View>
      <Text style={styles.emptyTitle}>No Documents</Text>
      <Text style={styles.emptySubtitle}>
        {activeFilter !== 'all'
          ? `No ${activeFilter === 'valid' ? 'active' : activeFilter === 'expiring_soon' ? 'expiring' : 'expired'} documents found.`
          : 'Compliance documents like licences, insurance and certificates will appear here.'}
      </Text>
      {activeFilter === 'all' && (
        <PressableRow style={styles.emptyAddButton} onPress={openCreateModal} >
          <Feather name="plus" size={16} color={colors.primaryForeground} />
          <Text style={styles.emptyAddButtonText}>Add Document</Text>
        </PressableRow>
      )}
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Feather name="alert-circle" size={40} color={colors.destructive} />
      <Text style={styles.errorText}>{error}</Text>
      <PressableRow style={styles.retryButton} onPress={fetchData}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </PressableRow>
    </View>
  );

  const renderFormModal = () => (
    <Modal
      visible={showModal}
      animationType="slide"
      transparent
      onRequestClose={closeModal}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeModal} />
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingDoc ? 'Edit Document' : 'Add Document'}</Text>
            <PressableRow style={styles.modalCloseButton} onPress={closeModal}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </PressableRow>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Document Type</Text>
              <View style={styles.typeSelector}>
                {DOCUMENT_TYPES.map(dt => (
                  <PressableRow key={dt.value} style={[styles.typeOption, form.type === dt.value && styles.typeOptionSelected]} onPress={() => setForm(f => ({ ...f, type: dt.value }))} >
                    <Text style={[styles.typeOptionText, form.type === dt.value && styles.typeOptionTextSelected]}>
                      {dt.label}
                    </Text>
                  </PressableRow>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Document Name *</Text>
              <TextInput
                style={styles.formInput}
                value={form.title}
                onChangeText={(v) => setForm(f => ({ ...f, title: v }))}
                placeholder="e.g. Electrical Licence"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Document Number</Text>
              <TextInput
                style={styles.formInput}
                value={form.documentNumber}
                onChangeText={(v) => setForm(f => ({ ...f, documentNumber: v }))}
                placeholder="e.g. LIC-12345"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Issuing Body</Text>
              <TextInput
                style={styles.formInput}
                value={form.issuer}
                onChangeText={(v) => setForm(f => ({ ...f, issuer: v }))}
                placeholder="e.g. NSW Fair Trading"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Expiry Date</Text>
              <TextInput
                style={styles.formInput}
                value={form.expiryDate}
                onChangeText={(v) => setForm(f => ({ ...f, expiryDate: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            {(form.type === 'white_card') && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Holder Name</Text>
                <TextInput
                  style={styles.formInput}
                  value={form.holderName}
                  onChangeText={(v) => setForm(f => ({ ...f, holderName: v }))}
                  placeholder="Name of card holder"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            )}

            {(form.type === 'insurance') && (
              <>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Insurer</Text>
                  <TextInput
                    style={styles.formInput}
                    value={form.insurer}
                    onChangeText={(v) => setForm(f => ({ ...f, insurer: v }))}
                    placeholder="e.g. QBE Insurance"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Coverage Amount</Text>
                  <TextInput
                    style={styles.formInput}
                    value={form.coverageAmount}
                    onChangeText={(v) => setForm(f => ({ ...f, coverageAmount: v }))}
                    placeholder="e.g. $20,000,000"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              </>
            )}

            {(form.type === 'vehicle_rego') && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Vehicle Plate</Text>
                <TextInput
                  style={styles.formInput}
                  value={form.vehiclePlate}
                  onChangeText={(v) => setForm(f => ({ ...f, vehiclePlate: v }))}
                  placeholder="e.g. ABC 123"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notes</Text>
              <TextInput
                style={[styles.formInput, styles.formInputMultiline]}
                value={form.notes}
                onChangeText={(v) => setForm(f => ({ ...f, notes: v }))}
                placeholder="Optional notes..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Document Photo</Text>
              {attachmentUri ? (
                <View style={styles.uploadedIndicator}>
                  <Feather name="image" size={16} color="#22c55e" />
                  <Text style={styles.uploadedText}>Photo selected</Text>
                  <PressableRow style={styles.removeUploadButton} onPress={() => setAttachmentUri(null)} >
                    <Feather name="x" size={16} color="#ef4444" />
                  </PressableRow>
                </View>
              ) : hasExistingAttachment ? (
                <View style={styles.uploadedIndicator}>
                  <Feather name="paperclip" size={16} color="#22c55e" />
                  <Text style={styles.uploadedText}>Existing attachment</Text>
                  <PressableRow style={styles.removeUploadButton} onPress={handlePickImage} >
                    <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
                  </PressableRow>
                </View>
              ) : (
                <PressableRow style={styles.uploadButton} onPress={handlePickImage} >
                  <Feather name="camera" size={18} color={colors.mutedForeground} />
                  <Text style={styles.uploadButtonText}>Take Photo or Choose from Library</Text>
                </PressableRow>
              )}
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={[styles.modalFooter, { paddingBottom: spacing.md + insets.bottom }]}>
            <PressableRow style={styles.cancelButton} onPress={closeModal} >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </PressableRow>
            <PressableRow style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={handleSave} disabled={isSaving} >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={styles.saveButtonText}>{editingDoc ? 'Update' : 'Add Document'}</Text>
              )}
            </PressableRow>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {isLoading && documents.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading compliance documents...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
          >
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.pageTitle}>Compliance</Text>
                <Text style={styles.pageSubtitle}>Licences, insurance & certifications</Text>
              </View>
              <PressableRow style={styles.addButton} onPress={openCreateModal} >
                <Feather name="plus" size={16} color={colors.primaryForeground} />
                <Text style={styles.addButtonText}>Add</Text>
              </PressableRow>
            </View>

            {error ? renderErrorState() : documents.length === 0 && activeFilter === 'all' ? renderEmptyState() : (
              <>
                {renderHeroSection()}
                <Text style={styles.sectionHeader}>DOCUMENTS</Text>
                {renderFilterTabs()}
                {filteredDocuments.length === 0 ? renderEmptyState() : filteredDocuments.map(renderDocumentCard)}
              </>
            )}
          </ScrollView>
        )}
      </View>
      {renderFormModal()}
    </>
  );
}
