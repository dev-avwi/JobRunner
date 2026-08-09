import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, Modal, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { Alert } from '@/lib/alert';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { resolveAttachmentUrl } from '../../src/lib/chat-attachments';
import { useTheme } from '../../src/lib/theme';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { api } from '../../src/lib/api';
import { format } from 'date-fns';
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes, componentStyles, fontWeights } from '../../src/lib/design-tokens';
import PhotoLibrary from '../../src/components/PhotoLibrary';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { getDocumentPicker } from '../../src/lib/document-picker';

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

interface Job {
  id: string;
  title?: string;
  status?: string;
  photos?: any[];
}

type FilterTab = 'all' | 'photos' | 'documents' | 'compliance';
type ComplianceFilter = 'all' | 'valid' | 'expiring_soon' | 'expired';

const DOCUMENT_TYPES = [
  { value: 'licence', label: 'Licence' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'certification', label: 'Certification' },
  { value: 'white_card', label: 'White Card' },
  { value: 'vehicle_rego', label: 'Vehicle Rego' },
  { value: 'other', label: 'Other' },
];

const getStatusConfig = (colors: any): Record<string, { label: string; color: string; bgColor: string }> => ({
  valid: { label: 'Valid', color: colors.success, bgColor: colors.success + '1F' },
  expiring_soon: { label: 'Expiring Soon', color: colors.warning, bgColor: colors.warning + '1F' },
  expired: { label: 'Expired', color: colors.destructive, bgColor: colors.destructive + '1F' },
  pending: { label: 'Pending', color: colors.mutedForeground, bgColor: colors.mutedForeground + '1F' },
});

const getTypeConfig = (type: string, colors: any) => {
  const TYPE_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; label: string; color: string }> = {
    licence: { icon: 'shield', label: 'Licence', color: colors.primary },
    license: { icon: 'shield', label: 'Licence', color: colors.primary },
    insurance: { icon: 'file-text', label: 'Insurance', color: colors.invoiced },
    certification: { icon: 'award', label: 'Certification', color: colors.warning },
    certificate: { icon: 'award', label: 'Certificate', color: colors.warning },
    white_card: { icon: 'credit-card', label: 'White Card', color: colors.done },
    vehicle_rego: { icon: 'truck', label: 'Vehicle Rego', color: '#6366f1' },
    permit: { icon: 'clipboard', label: 'Permit', color: '#ec4899' },
    other: { icon: 'file', label: 'Other', color: colors.mutedForeground },
  };
  return TYPE_CONFIG[type.toLowerCase()] || { icon: 'file' as keyof typeof Feather.glyphMap, label: type, color: colors.mutedForeground };
};

const normalizeStatus = (status: string): string => {
  const s = status.toLowerCase().trim();
  if (s === 'active' || s === 'approved' || s === 'valid') return 'valid';
  if (s === 'expiring_soon' || s === 'expiring') return 'expiring_soon';
  if (s === 'expired') return 'expired';
  if (s === 'pending' || s === 'draft') return 'pending';
  return 'valid';
};

const computeStatus = (doc: ComplianceDocument): string => {
  if (doc.status) return normalizeStatus(doc.status);
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

const getCategoryColors = (colors: any) => ({
  photos: { color: colors.primary, bg: colors.primary + '1A' },
  voiceNotes: { color: colors.invoiced, bg: colors.invoiced + '1A' },
  compliance: { color: colors.warning, bg: colors.warning + '1A' },
  sitePhotos: { color: colors.success, bg: colors.success + '1A' },
});

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'photos', label: 'Photos' },
  { key: 'documents', label: 'Documents' },
  { key: 'compliance', label: 'Compliance' },
];

const COMPLIANCE_FILTERS: { key: ComplianceFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'valid', label: 'Active' },
  { key: 'expiring_soon', label: 'Expiring' },
  { key: 'expired', label: 'Expired' },
];

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

const formatDateStr = (dateStr?: string | null) => {
  if (!dateStr) return '';
  try {
    return format(new Date(dateStr), 'dd MMM yyyy');
  } catch {
    return '';
  }
};

const createStyles = (colors: any, bottomNavHeight: number = 0) => StyleSheet.create({
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
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: fontWeights.bold,
    letterSpacing: -0.5,
    color: colors.foreground,
  },
  statLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
    fontSize: typography.sizes.xs,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
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
  quickAccessSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  categoryContent: {
    flex: 1,
  },
  categoryTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  categoryCount: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  complianceSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  complianceHeader: {
    ...componentStyles.sectionHeader,
  },
  complianceFilterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  complianceFilterTab: {
    paddingHorizontal: spacing.lg,
    height: sizes.filterChipHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  complianceFilterTabActive: {
    backgroundColor: colors.primary,
  },
  complianceFilterTabText: {
    ...typography.button,
    color: colors.mutedForeground,
  },
  complianceFilterTabTextActive: {
    color: colors.primaryForeground,
  },
  documentCard: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginBottom: spacing.sm,
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
    width: 40,
    height: 40,
    borderRadius: radius.xl,
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
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
    backgroundColor: colors.destructive + '1F',
  },
  deleteButtonText: {
    ...typography.button,
    color: colors.destructive,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.sm,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  emptyText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
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
    marginBottom: spacing.sm,
  },
  emptyAddButtonText: {
    color: colors.primaryForeground,
    ...typography.button,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  loadingText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.sm,
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
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
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
    backgroundColor: colors.success + '1F',
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
  complianceStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  complianceStatCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
});

export default function FilesScreen() {
  const { colors } = useTheme();
  const confirm = useConfirmDialog();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const STATUS_CONFIG = useMemo(() => getStatusConfig(colors), [colors]);
  const CATEGORY_COLORS = useMemo(() => getCategoryColors(colors), [colors]);

  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocument[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ComplianceDocument | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [attachmentMime, setAttachmentMime] = useState<string | null>(null);
  const [hasExistingAttachment, setHasExistingAttachment] = useState(false);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [complianceRes, jobsRes] = await Promise.all([
        api.get<ComplianceDocument[]>('/api/compliance-documents').catch(() => ({ data: [] as ComplianceDocument[], error: null })),
        api.get<Job[]>('/api/jobs').catch(() => ({ data: [] as Job[], error: null })),
      ]);

      setComplianceDocs(complianceRes.data || []);
      setJobs(jobsRes.data || []);
    } catch (err) {
      setError('Failed to load files. Pull down to retry.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const jobsWithPhotos = jobs.filter(j => j.status !== 'cancelled' && Array.isArray(j.photos) && j.photos.length > 0).length;
  const complianceCount = complianceDocs.length;
  const totalFiles = jobsWithPhotos + complianceCount;

  const docsWithStatus = useMemo(() => complianceDocs.map(doc => ({
    ...doc,
    computedStatus: computeStatus(doc),
  })), [complianceDocs]);

  const validCount = docsWithStatus.filter(d => d.computedStatus === 'valid').length;
  const expiringSoonCount = docsWithStatus.filter(d => d.computedStatus === 'expiring_soon').length;
  const expiredCount = docsWithStatus.filter(d => d.computedStatus === 'expired').length;

  const filteredComplianceDocs = useMemo(() => {
    if (complianceFilter === 'all') return docsWithStatus;
    return docsWithStatus.filter(d => d.computedStatus === complianceFilter);
  }, [docsWithStatus, complianceFilter]);

  const openCreateModal = () => {
    setEditingDoc(null);
    setForm(emptyForm);
    setAttachmentUri(null);
    setAttachmentName(null);
    setAttachmentMime(null);
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
    setAttachmentName(null);
    setAttachmentMime(null);
    setHasExistingAttachment(!!doc.attachmentUrl);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingDoc(null);
    setForm(emptyForm);
    setAttachmentUri(null);
    setAttachmentName(null);
    setAttachmentMime(null);
    setHasExistingAttachment(false);
  };

  const openAttachment = async (url: string | null) => {
    if (!url) return;
    try {
      // Private compliance files are gated to owners/managers server-side. The in-app
      // browser can't send the auth token, so fetch a short-lived signed URL first.
      if (url.includes('.private/compliance/')) {
        const res = await api.post<{ url: string }>('/api/objects/sign-download', { path: url });
        if (res.error || !res.data?.url) {
          Alert.alert('Access denied', "You don't have permission to open this file.");
          return;
        }
        await WebBrowser.openBrowserAsync(res.data.url);
        return;
      }
      const fullUrl = resolveAttachmentUrl(url);
      if (!fullUrl) return;
      await WebBrowser.openBrowserAsync(fullUrl);
    } catch (err) {
      if (__DEV__) console.log('Open attachment failed:', err);
      Alert.alert('Error', 'Could not open the attachment.');
    }
  };

  const handlePickImage = async () => {
    Alert.alert(
      'Add Photo',
      'Choose a source for the document',
      [
        {
          text: 'Camera',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission Required', 'Camera access is needed to take photos.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
            if (!result.canceled && result.assets[0]) {
              const asset = result.assets[0];
              setAttachmentUri(asset.uri);
              setAttachmentName(asset.fileName || asset.uri.split('/').pop() || 'photo.jpg');
              setAttachmentMime(asset.mimeType || 'image/jpeg');
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
            const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true });
            if (!result.canceled && result.assets[0]) {
              const asset = result.assets[0];
              setAttachmentUri(asset.uri);
              setAttachmentName(asset.fileName || asset.uri.split('/').pop() || 'photo.jpg');
              setAttachmentMime(asset.mimeType || 'image/jpeg');
            }
          },
        },
        {
          text: 'Attach File (PDF)',
          onPress: async () => {
            const DocumentPicker = getDocumentPicker();
            if (!DocumentPicker) {
              Alert.alert(
                'Update required',
                'Attaching PDFs needs the latest app build. Please update the app, then try again. You can still attach photos in the meantime.'
              );
              return;
            }
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true,
              });
              if (!result.canceled && result.assets?.[0]) {
                const asset = result.assets[0];
                setAttachmentUri(asset.uri);
                setAttachmentName(asset.name || asset.uri.split('/').pop() || 'document');
                setAttachmentMime(asset.mimeType || 'application/octet-stream');
              }
            } catch (err) {
              if (__DEV__) console.log('Document pick failed:', err);
              Alert.alert('Error', 'Could not open the file picker. Please try again.');
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
      const fallbackName = attachmentUri.split('/').pop() || 'document';
      const filename = attachmentName || fallbackName;
      const extMatch = /\.(\w+)$/.exec(filename);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
      const type = attachmentMime || (ext === 'pdf' ? 'application/pdf' : `image/${ext}`);

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
          const isPdf = (attachmentMime || '').includes('pdf') || /\.pdf$/i.test(attachmentName || uploadedUrl);
          await api.patch(`/api/compliance-documents/${response.data.id}`, {
            attachmentUrl: uploadedUrl,
            attachmentType: isPdf ? 'pdf' : 'image',
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

  const renderComplianceDocCard = (doc: ComplianceDocument & { computedStatus: string }) => {
    const typeConfig = getTypeConfig(doc.type, colors);
    const statusConfig = STATUS_CONFIG[doc.computedStatus] || STATUS_CONFIG.pending;
    const isExpanded = expandedId === doc.id;

    return (
      <View
        key={doc.id}
        style={[styles.documentCard, isExpanded && styles.documentCardExpanded]}
      >
        <PressableRow style={styles.documentTopRow} onPress={() => setExpandedId(isExpanded ? null : doc.id)} >
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
                <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
                <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
              </View>
            </View>
          </View>
          <Feather name={isExpanded ? 'chevron-up' : 'chevron-right'} size={18} color={colors.mutedForeground} />
        </PressableRow>

        {doc.expiryDate && (
          <View style={styles.expiryRow}>
            <Feather name="calendar" size={12} color={colors.mutedForeground} />
            <Text style={styles.expiryText}>Expires {formatDateStr(doc.expiryDate)}</Text>
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
              <Text style={styles.detailValue}>{formatDateStr(doc.expiryDate) || '\u2014'}</Text>
            </View>
            {doc.attachmentUrl && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Attachment</Text>
                <PressableRow style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }} onPress={() => openAttachment(doc.attachmentUrl)} >
                  <Feather name={doc.attachmentType === 'pdf' ? 'file-text' : 'image'} size={12} color={colors.primary} />
                  <Text style={[styles.detailValue, { color: colors.primary }]}>View</Text>
                  <Feather name="external-link" size={12} color={colors.primary} />
                </PressableRow>
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
                <Feather name="trash-2" size={14} color={colors.destructive} />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </PressableRow>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderComplianceSection = () => (
    <View style={styles.complianceSection}>
      <View style={styles.complianceHeader}>
        <Text style={styles.sectionTitle}>COMPLIANCE DOCUMENTS</Text>
        <PressableRow onPress={openCreateModal} >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Feather name="plus" size={14} color={colors.primary} />
            <Text style={{ ...typography.body, color: colors.primary, fontWeight: fontWeights.medium }}>Add</Text>
          </View>
        </PressableRow>
      </View>

      {complianceCount > 0 && (
        <>
          <View style={styles.complianceStatsRow}>
            <View style={styles.complianceStatCard}>
              <View style={[styles.statIconContainer, { backgroundColor: STATUS_CONFIG.valid.bgColor }]}>
                <Feather name="check-circle" size={16} color={STATUS_CONFIG.valid.color} />
              </View>
              <Text style={[styles.statValue, { color: STATUS_CONFIG.valid.color }]}>{validCount}</Text>
              <Text style={styles.statLabel}>Valid</Text>
            </View>
            <View style={styles.complianceStatCard}>
              <View style={[styles.statIconContainer, { backgroundColor: STATUS_CONFIG.expiring_soon.bgColor }]}>
                <Feather name="alert-triangle" size={16} color={STATUS_CONFIG.expiring_soon.color} />
              </View>
              <Text style={[styles.statValue, { color: STATUS_CONFIG.expiring_soon.color }]}>{expiringSoonCount}</Text>
              <Text style={styles.statLabel}>Expiring</Text>
            </View>
            <View style={styles.complianceStatCard}>
              <View style={[styles.statIconContainer, { backgroundColor: STATUS_CONFIG.expired.bgColor }]}>
                <Feather name="x-circle" size={16} color={STATUS_CONFIG.expired.color} />
              </View>
              <Text style={[styles.statValue, { color: STATUS_CONFIG.expired.color }]}>{expiredCount}</Text>
              <Text style={styles.statLabel}>Expired</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
            <View style={styles.complianceFilterRow}>
              {COMPLIANCE_FILTERS.map(tab => (
                <PressableRow key={tab.key} style={[styles.complianceFilterTab, complianceFilter === tab.key && styles.complianceFilterTabActive]} onPress={() => setComplianceFilter(tab.key)} >
                  <Text style={[styles.complianceFilterTabText, complianceFilter === tab.key && styles.complianceFilterTabTextActive]}>
                    {tab.label}
                    {tab.key !== 'all' && ` (${tab.key === 'valid' ? validCount : tab.key === 'expiring_soon' ? expiringSoonCount : expiredCount})`}
                  </Text>
                </PressableRow>
              ))}
            </View>
          </ScrollView>
        </>
      )}

      {filteredComplianceDocs.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconContainer}>
            <Feather name="shield" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>
            {complianceFilter !== 'all' ? 'No Matching Documents' : 'No Compliance Documents'}
          </Text>
          <Text style={styles.emptyText}>
            {complianceFilter !== 'all'
              ? `No ${complianceFilter === 'valid' ? 'active' : complianceFilter === 'expiring_soon' ? 'expiring' : 'expired'} documents found.`
              : 'Add licences, insurance, certifications and other compliance documents here.'}
          </Text>
          {complianceFilter === 'all' && (
            <PressableRow style={styles.emptyAddButton} onPress={openCreateModal} >
              <Feather name="plus" size={16} color={colors.primaryForeground} />
              <Text style={styles.emptyAddButtonText}>Add Document</Text>
            </PressableRow>
          )}
        </View>
      ) : (
        filteredComplianceDocs.map(renderComplianceDocCard)
      )}
    </View>
  );

  const renderQuickAccessCards = () => (
    <View style={styles.quickAccessSection}>
      <Text style={styles.sectionTitle}>QUICK ACCESS</Text>

      <PressableRow style={styles.categoryCard} onPress={() => setActiveFilter('photos')} >
        <View style={[styles.categoryIconContainer, { backgroundColor: CATEGORY_COLORS.photos.bg }]}>
          <Feather name="camera" size={16} color={CATEGORY_COLORS.photos.color} />
        </View>
        <View style={styles.categoryContent}>
          <Text style={styles.categoryTitle}>Photo Library</Text>
          <Text style={styles.categoryCount}>Browse, upload & manage all photos</Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </PressableRow>

      <PressableRow style={styles.categoryCard} onPress={() => setActiveFilter('documents')} >
        <View style={[styles.categoryIconContainer, { backgroundColor: CATEGORY_COLORS.voiceNotes.bg }]}>
          <Feather name="folder" size={16} color={CATEGORY_COLORS.voiceNotes.color} />
        </View>
        <View style={styles.categoryContent}>
          <Text style={styles.categoryTitle}>Documents</Text>
          <Text style={styles.categoryCount}>PDFs, files & other documents</Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </PressableRow>

      <PressableRow style={styles.categoryCard} onPress={() => setActiveFilter('compliance')} >
        <View style={[styles.categoryIconContainer, { backgroundColor: CATEGORY_COLORS.compliance.bg }]}>
          <Feather name="shield" size={16} color={CATEGORY_COLORS.compliance.color} />
        </View>
        <View style={styles.categoryContent}>
          <Text style={styles.categoryTitle}>Compliance</Text>
          <Text style={styles.categoryCount}>Licences, insurance & certifications</Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </PressableRow>
    </View>
  );

  const renderAllContent = () => (
    <>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: CATEGORY_COLORS.photos.bg }]}>
            <Feather name="folder" size={16} color={CATEGORY_COLORS.photos.color} />
          </View>
          <Text style={styles.statValue}>{totalFiles}</Text>
          <Text style={styles.statLabel}>TOTAL</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: CATEGORY_COLORS.photos.bg }]}>
            <Feather name="camera" size={16} color={CATEGORY_COLORS.photos.color} />
          </View>
          <Text style={styles.statValue}>{jobsWithPhotos}</Text>
          <Text style={styles.statLabel}>WITH PHOTOS</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconContainer, { backgroundColor: CATEGORY_COLORS.compliance.bg }]}>
            <Feather name="shield" size={16} color={CATEGORY_COLORS.compliance.color} />
          </View>
          <Text style={styles.statValue}>{complianceCount}</Text>
          <Text style={styles.statLabel}>DOCS</Text>
        </View>
      </View>

      {renderQuickAccessCards()}
      {renderComplianceSection()}
    </>
  );

  const renderPhotosContent = () => (
    <PhotoLibrary />
  );

  // The Documents view shows the actual uploaded files/PDFs (the compliance store).
  // Quotes, invoices & receipts have their own dedicated page and are not files.
  const renderDocumentsContent = () => renderComplianceSection();

  const renderComplianceContent = () => renderComplianceSection();

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
              <Text style={styles.formLabel}>Document File</Text>
              {attachmentUri ? (
                <View style={styles.uploadedIndicator}>
                  <Feather name={(attachmentMime || '').includes('pdf') ? 'file-text' : 'image'} size={16} color={colors.success} />
                  <Text style={styles.uploadedText} numberOfLines={1}>{attachmentName || 'File selected'}</Text>
                  <PressableRow style={styles.removeUploadButton} onPress={() => { setAttachmentUri(null); setAttachmentName(null); setAttachmentMime(null); }} >
                    <Feather name="x" size={16} color={colors.destructive} />
                  </PressableRow>
                </View>
              ) : hasExistingAttachment ? (
                <View style={styles.uploadedIndicator}>
                  <Feather name="paperclip" size={16} color={colors.success} />
                  <Text style={styles.uploadedText}>Existing attachment</Text>
                  <PressableRow style={styles.removeUploadButton} onPress={handlePickImage} >
                    <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
                  </PressableRow>
                </View>
              ) : (
                <PressableRow style={styles.uploadButton} onPress={handlePickImage} >
                  <Feather name="paperclip" size={18} color={colors.mutedForeground} />
                  <Text style={styles.uploadButtonText}>Take Photo, or Attach a File / PDF</Text>
                </PressableRow>
              )}
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={[styles.modalFooter, { paddingBottom: insets.bottom + spacing.md }]}>
            <TouchableOpacity style={styles.cancelButton} onPress={closeModal} activeOpacity={0.7} >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={handleSave} disabled={isSaving} activeOpacity={0.8} >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={styles.saveButtonText}>{editingDoc ? 'Update' : 'Add Document'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
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
              <Text style={styles.pageTitle}>Files</Text>
              <Text style={styles.pageSubtitle}>Photos, documents & compliance</Text>
            </View>
            <PressableRow style={styles.addButton} onPress={openCreateModal} >
              <Feather name="plus" size={16} color={colors.primaryForeground} />
              <Text style={styles.addButtonText}>Add Document</Text>
            </PressableRow>
          </View>

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading files...</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={40} color={colors.destructive} />
              <Text style={styles.errorText}>{error}</Text>
              <PressableRow style={styles.retryButton} onPress={handleRefresh} >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </PressableRow>
            </View>
          )}

          {!isLoading && !error && (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.xs }}>
                <View style={styles.filterRow}>
                  {FILTER_TABS.map(tab => (
                    <PressableRow key={tab.key} style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]} onPress={() => { setActiveFilter(tab.key); if (tab.key !== 'compliance') { setComplianceFilter('all'); } }} >
                      <Text style={[styles.filterTabText, activeFilter === tab.key && styles.filterTabTextActive]}>
                        {tab.label}
                      </Text>
                    </PressableRow>
                  ))}
                </View>
              </ScrollView>

              {activeFilter === 'all' && renderAllContent()}
              {activeFilter === 'photos' && renderPhotosContent()}
              {activeFilter === 'documents' && renderDocumentsContent()}
              {activeFilter === 'compliance' && renderComplianceContent()}
            </>
          )}
        </ScrollView>
      </View>
      {renderFormModal()}
    </>
  );
}
