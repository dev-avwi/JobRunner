import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Image,
  Dimensions,
  FlatList,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme, ThemeColors, colorWithOpacity } from '../lib/theme';
import { AppBottomSheet } from './ui/AppBottomSheet';
import { useConfirmDialog } from './ui/ConfirmDialog';
import { api } from '../lib/api';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { spacing, radius, shadows, typography, iconSizes, sizes } from '../lib/design-tokens';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_PADDING = 16;
const GRID_GAP = 4;
const NUM_COLUMNS = 3;
const THUMB_SIZE = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

interface PhotoItem {
  id: string;
  userId: string;
  jobId: string | null;
  objectStorageKey: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  category: string | null;
  caption: string | null;
  takenAt: string | null;
  uploadedBy: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  tags: string[];
  sortOrder: number;
  createdAt: string;
  jobTitle: string | null;
  jobStatus: string | null;
  clientId: string | null;
  clientName: string | null;
  url: string;
}

interface PhotoStats {
  totalPhotos: number;
  thisWeek: number;
  categoryBreakdown: Record<string, number>;
  storageUsedBytes: number;
  storageUsedFormatted: string;
  mostPhotographedJob: { jobId: string; title: string; count: number } | null;
}

interface Job {
  id: string;
  title?: string;
  status?: string;
}

type CategoryFilter = 'all' | 'before' | 'progress' | 'after' | 'materials' | 'general';

const CATEGORY_FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'before', label: 'Before' },
  { key: 'progress', label: 'During' },
  { key: 'after', label: 'After' },
  { key: 'materials', label: 'Materials' },
  { key: 'general', label: 'General' },
];

const UPLOAD_CATEGORIES = [
  { value: 'before', label: 'Before' },
  { value: 'progress', label: 'During' },
  { value: 'after', label: 'After' },
  { value: 'materials', label: 'Materials' },
  { value: 'general', label: 'General' },
];

const getCategoryColors = (colors: ThemeColors): Record<string, { color: string; bg: string }> => ({
  before: { color: colors.warning, bg: colorWithOpacity(colors.warning, 0.12) },
  progress: { color: colors.primary, bg: colorWithOpacity(colors.primary, 0.12) },
  after: { color: colors.success, bg: colorWithOpacity(colors.success, 0.12) },
  materials: { color: colors.invoiced, bg: colorWithOpacity(colors.invoiced, 0.12) },
  general: { color: colors.mutedForeground, bg: colorWithOpacity(colors.mutedForeground, 0.12) },
  receipt: { color: '#ec4899', bg: 'rgba(236,72,153,0.12)' },
});
const getCategoryStyle = (cat: string | null, colors: ThemeColors) => {
  const map = getCategoryColors(colors);
  return map[cat || 'general'] || map.general;
};

const getCategoryLabel = (cat: string | null) => {
  if (!cat) return 'General';
  const map: Record<string, string> = {
    before: 'Before',
    progress: 'During',
    after: 'After',
    materials: 'Materials',
    general: 'General',
    receipt: 'Receipt',
  };
  return map[cat] || cat.charAt(0).toUpperCase() + cat.slice(1);
};

const getDateGroupLabel = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isThisWeek(date)) return 'This Week';
  if (isThisMonth(date)) return 'This Month';
  return format(date, 'MMMM yyyy');
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.sm,
    alignItems: 'center',
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700', fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
    color: colors.foreground,
  },
  statLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 2,
    textAlign: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    height: sizes.filterChipHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterChipText: {
    ...typography.button,
    color: colors.mutedForeground,
  },
  filterChipTextActive: {
    color: colors.primaryForeground,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  uploadBtnText: {
    color: colors.primaryForeground,
    ...typography.button,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.mutedForeground,
  },
  dateGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  dateGroupLabel: {
    ...typography.subtitle,
    fontWeight: '700', fontFamily: 'Inter_700Bold',
    color: colors.foreground,
  },
  dateGroupCount: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  gridRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  thumbWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.muted,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbCategoryBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  thumbCategoryText: {
    fontSize: 9,
    fontWeight: '700', fontFamily: 'Inter_700Bold',
    color: colors.white,
  },
  thumbSelectOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(59,130,246,0.3)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 6,
  },
  thumbCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbCheckboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
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
  emptyBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyBtnText: {
    color: colors.primaryForeground,
    ...typography.button,
  },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  bulkBarCount: {
    ...typography.caption,
    fontWeight: '700', fontFamily: 'Inter_700Bold',
    color: colors.primary,
    minWidth: 80,
  },
  bulkAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  bulkActionText: {
    ...typography.captionSmall,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    color: colors.foreground,
  },
  bulkActionDanger: {
    backgroundColor: colorWithOpacity(colors.destructive, 0.12),
  },
  bulkActionDangerText: {
    color: colors.destructive,
  },
  bulkCancel: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  bulkCancelText: {
    ...typography.captionSmall,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    color: colors.mutedForeground,
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
    fontWeight: '700', fontFamily: 'Inter_700Bold',
    color: colors.foreground,
  },
  modalClose: {
    padding: spacing.xs,
  },
  modalBody: {
    padding: spacing.md,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  formLabel: {
    ...typography.caption,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
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
  catSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  catOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  catOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}18`,
  },
  catOptionText: {
    ...typography.caption,
    fontWeight: '500', fontFamily: 'Inter_500Medium',
    color: colors.mutedForeground,
  },
  catOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
  },
  previewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  previewThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceBtn: {
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
    marginBottom: spacing.sm,
  },
  sourceBtnText: {
    ...typography.body,
    fontWeight: '500', fontFamily: 'Inter_500Medium',
    color: colors.mutedForeground,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    ...typography.body,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    color: colors.mutedForeground,
  },
  saveBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    ...typography.body,
    fontWeight: '700', fontFamily: 'Inter_700Bold',
    color: colors.primaryForeground,
  },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  lightboxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === 'ios' ? 56 : spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  lightboxClose: {
    padding: spacing.sm,
  },
  lightboxActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  lightboxActionBtn: {
    padding: spacing.sm,
  },
  lightboxImage: {
    flex: 1,
  },
  lightboxMeta: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: spacing.md,
    paddingBottom: spacing.md,
  },
  lightboxBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  lightboxBadgeText: {
    fontSize: 11,
    fontWeight: '700', fontFamily: 'Inter_700Bold',
    color: colors.white,
  },
  lightboxCaption: {
    ...typography.body,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  lightboxTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  lightboxTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  lightboxTagText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  lightboxInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  lightboxInfoText: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
  },
  lightboxLink: {
    ...typography.caption,
    color: '#60a5fa',
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
  },
  lightboxNav: {
    position: 'absolute',
    top: '45%',
    padding: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: radius.full,
  },
  lightboxNavLeft: {
    left: spacing.sm,
  },
  lightboxNavRight: {
    right: spacing.sm,
  },
  lightboxEditSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
  lightboxEditLabel: {
    ...typography.captionSmall,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    marginBottom: spacing.xs,
  },
  lightboxEditInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.white,
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  lightboxEditCatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  lightboxEditCatChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  lightboxEditCatChipActive: {
    borderColor: '#60a5fa',
    backgroundColor: 'rgba(96,165,250,0.2)',
  },
  lightboxEditCatText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  lightboxEditCatTextActive: {
    color: '#60a5fa',
    fontWeight: '700', fontFamily: 'Inter_700Bold',
  },
  lightboxSaveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  lightboxSaveBtnText: {
    ...typography.button,
    color: colors.primaryForeground,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.muted,
    borderRadius: 2,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  jobPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  jobPickerTitle: {
    ...typography.body,
    color: colors.foreground,
    flex: 1,
  },
  jobPickerStatus: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
});

export default function PhotoLibrary() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const confirm = useConfirmDialog();

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [stats, setStats] = useState<PhotoStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadImages, setUploadImages] = useState<{ uri: string; fileName: string }[]>([]);
  const [uploadCategory, setUploadCategory] = useState('general');
  const [uploadCaption, setUploadCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoItem | null>(null);
  const [lightboxEditing, setLightboxEditing] = useState(false);
  const [editCategory, setEditCategory] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [editTags, setEditTags] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [showBulkCategoryPicker, setShowBulkCategoryPicker] = useState(false);
  const [showBulkJobPicker, setShowBulkJobPicker] = useState(false);
  const [jobsList, setJobsList] = useState<Job[]>([]);

  const fetchPhotos = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      params.set('sortBy', 'date');
      params.set('sortOrder', 'desc');
      params.set('limit', '200');
      const qs = params.toString();
      const res = await api.get<PhotoItem[]>(`/api/photos${qs ? `?${qs}` : ''}`);
      setPhotos(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPhotos([]);
    }
  }, [categoryFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get<PhotoStats>('/api/photos/stats');
      setStats(res.data || null);
    } catch {
      setStats(null);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchPhotos(), fetchStats()]);
    setIsLoading(false);
    setRefreshing(false);
  }, [fetchPhotos, fetchStats]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    fetchPhotos();
  }, [categoryFilter, fetchPhotos]);

  const groupedPhotos = useMemo(() => {
    const groups: { label: string; photos: PhotoItem[] }[] = [];
    const map = new Map<string, PhotoItem[]>();
    photos.forEach(p => {
      const label = getDateGroupLabel(p.createdAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(p);
    });
    map.forEach((items, label) => groups.push({ label, photos: items }));
    return groups;
  }, [photos]);

  const flatPhotos = useMemo(() => photos, [photos]);

  const openLightbox = (photo: PhotoItem) => {
    if (selectionMode) {
      toggleSelect(photo.id);
      return;
    }
    setLightboxPhoto(photo);
    setLightboxEditing(false);
    setEditCategory(photo.category || 'general');
    setEditCaption(photo.caption || '');
    setEditTags((photo.tags || []).join(', '));
  };

  const closeLightbox = () => {
    setLightboxPhoto(null);
    setLightboxEditing(false);
  };

  const navigateLightbox = (dir: -1 | 1) => {
    if (!lightboxPhoto) return;
    const idx = flatPhotos.findIndex(p => p.id === lightboxPhoto.id);
    const next = idx + dir;
    if (next >= 0 && next < flatPhotos.length) {
      const np = flatPhotos[next];
      setLightboxPhoto(np);
      setEditCategory(np.category || 'general');
      setEditCaption(np.caption || '');
      setEditTags((np.tags || []).join(', '));
      setLightboxEditing(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!lightboxPhoto) return;
    setIsSavingEdit(true);
    try {
      const tags = editTags.split(',').map(t => t.trim()).filter(Boolean);
      await api.patch(`/api/photos/${lightboxPhoto.id}`, {
        category: editCategory,
        caption: editCaption.trim() || null,
        tags,
      });
      setLightboxEditing(false);
      fetchPhotos();
      const updated = { ...lightboxPhoto, category: editCategory, caption: editCaption.trim() || null, tags };
      setLightboxPhoto(updated);
      Alert.alert('Saved', 'Photo updated.');
    } catch {
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeletePhoto = async (photo: PhotoItem) => {
    const ok = await confirm({ title: 'Delete Photo', message: 'Are you sure? This cannot be undone.', confirmText: 'Delete', cancelText: 'Cancel', destructive: true });
    if (ok) {
      try {
        await api.patch('/api/photos/bulk', { photoIds: [photo.id], action: 'delete' });
        closeLightbox();
        fetchPhotos();
        fetchStats();
      } catch {
        Alert.alert('Error', 'Failed to delete photo.');
      }
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  };

  const handleLongPress = (id: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === photos.length) {
      setSelectedIds(new Set());
      setSelectionMode(false);
    } else {
      setSelectedIds(new Set(photos.map(p => p.id)));
    }
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    const ok = await confirm({ title: 'Delete Photos', message: `Delete ${count} photo${count > 1 ? 's' : ''}? This cannot be undone.`, confirmText: 'Delete', cancelText: 'Cancel', destructive: true });
    if (ok) {
      try {
        await api.patch('/api/photos/bulk', { photoIds: Array.from(selectedIds), action: 'delete' });
        cancelSelection();
        fetchPhotos();
        fetchStats();
        Alert.alert('Deleted', `${count} photo${count > 1 ? 's' : ''} deleted.`);
      } catch {
        Alert.alert('Error', 'Failed to delete photos.');
      }
    }
  };

  const handleBulkSetCategory = async (cat: string) => {
    try {
      await api.patch('/api/photos/bulk', { photoIds: Array.from(selectedIds), action: 'setCategory', category: cat });
      setShowBulkCategoryPicker(false);
      cancelSelection();
      fetchPhotos();
      Alert.alert('Updated', `Category set to "${getCategoryLabel(cat)}".`);
    } catch {
      Alert.alert('Error', 'Failed to update category.');
    }
  };

  const handleBulkAttachToJob = async (jobId: string) => {
    try {
      await api.patch('/api/photos/bulk', { photoIds: Array.from(selectedIds), action: 'attachToJob', jobId });
      setShowBulkJobPicker(false);
      cancelSelection();
      fetchPhotos();
      Alert.alert('Attached', 'Photos attached to job.');
    } catch {
      Alert.alert('Error', 'Failed to attach photos to job.');
    }
  };

  const openBulkJobPicker = async () => {
    try {
      const res = await api.get<Job[]>('/api/jobs');
      setJobsList((Array.isArray(res.data) ? res.data : []).filter(j => j.status !== 'cancelled'));
    } catch {
      setJobsList([]);
    }
    setShowBulkJobPicker(true);
  };

  const openUploadModal = () => {
    setUploadImages([]);
    setUploadCategory('general');
    setUploadCaption('');
    setUploadProgress(0);
    setShowUploadModal(true);
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access is needed to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: false,
    });
    if (!result.canceled && result.assets?.length) {
      const newImages = result.assets.map(a => ({
        uri: a.uri,
        fileName: a.uri.split('/').pop() || `photo_${Date.now()}.jpg`,
      }));
      setUploadImages(prev => [...prev, ...newImages]);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsMultipleSelection: true,
      base64: false,
    });
    if (!result.canceled && result.assets?.length) {
      const newImages = result.assets.map(a => ({
        uri: a.uri,
        fileName: a.uri.split('/').pop() || `photo_${Date.now()}.jpg`,
      }));
      setUploadImages(prev => [...prev, ...newImages]);
    }
  };

  const removeUploadImage = (idx: number) => {
    setUploadImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (uploadImages.length === 0) {
      Alert.alert('No Photos', 'Please select at least one photo.');
      return;
    }
    setIsUploading(true);
    setUploadProgress(0);
    let successCount = 0;
    for (let i = 0; i < uploadImages.length; i++) {
      try {
        const img = uploadImages[i];
        const base64 = await FileSystem.readAsStringAsync(img.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const ext = img.fileName.split('.').pop()?.toLowerCase() || 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : ext === 'heic' ? 'image/heic' : 'image/jpeg';
        await api.post('/api/photos/upload-standalone', {
          data: base64,
          fileName: img.fileName,
          mimeType,
          category: uploadCategory,
          caption: uploadCaption.trim() || null,
          tags: [],
        });
        successCount++;
      } catch {
        // continue uploading remaining
      }
      setUploadProgress((i + 1) / uploadImages.length);
    }
    setIsUploading(false);
    setShowUploadModal(false);
    fetchPhotos();
    fetchStats();
    if (successCount > 0) {
      Alert.alert('Uploaded', `${successCount} photo${successCount > 1 ? 's' : ''} uploaded successfully.`);
    } else {
      Alert.alert('Error', 'Failed to upload photos. Please try again.');
    }
  };

  const renderStats = () => {
    if (!stats) return null;
    const topJob = stats.mostPhotographedJob;
    return (
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: colorWithOpacity(colors.primary, 0.12) }]}>
            <Feather name="image" size={14} color={colors.primary} />
          </View>
          <Text style={styles.statValue}>{stats.totalPhotos}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: colorWithOpacity(colors.success, 0.12) }]}>
            <Feather name="trending-up" size={14} color={colors.success} />
          </View>
          <Text style={styles.statValue}>{stats.thisWeek}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: colorWithOpacity(colors.invoiced, 0.12) }]}>
            <Feather name="briefcase" size={14} color={colors.invoiced} />
          </View>
          <Text style={styles.statValue} numberOfLines={1}>
            {topJob ? topJob.count : 0}
          </Text>
          <Text style={styles.statLabel} numberOfLines={1}>
            {topJob ? topJob.title : 'Top Job'}
          </Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: colorWithOpacity(colors.warning, 0.12) }]}>
            <Feather name="hard-drive" size={14} color={colors.warning} />
          </View>
          <Text style={styles.statValue} numberOfLines={1}>
            {stats.storageUsedFormatted || '0 KB'}
          </Text>
          <Text style={styles.statLabel}>Storage</Text>
        </View>
      </View>
    );
  };

  const renderFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
      <View style={styles.filterRow}>
        {CATEGORY_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, categoryFilter === f.key && styles.filterChipActive]}
            onPress={() => setCategoryFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterChipText, categoryFilter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderPhotoThumb = (photo: PhotoItem) => {
    const isSelected = selectedIds.has(photo.id);
    const catStyle = getCategoryStyle(photo.category, colors);
    return (
      <TouchableOpacity
        key={photo.id}
        style={styles.thumbWrap}
        onPress={() => openLightbox(photo)}
        onLongPress={() => handleLongPress(photo.id)}
        activeOpacity={0.8}
      >
        <Image source={{ uri: photo.url }} style={styles.thumbImage} resizeMode="cover" />
        {photo.category && (
          <View style={[styles.thumbCategoryBadge, { backgroundColor: catStyle.color }]}>
            <Text style={styles.thumbCategoryText}>{getCategoryLabel(photo.category)}</Text>
          </View>
        )}
        {selectionMode && (
          <View style={styles.thumbSelectOverlay}>
            <View style={[styles.thumbCheckbox, isSelected && styles.thumbCheckboxSelected]}>
              {isSelected && <Feather name="check" size={14} color={colors.primaryForeground} />}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderGrid = () => {
    if (photos.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Feather name="camera" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>No Photos Yet</Text>
          <Text style={styles.emptyText}>
            Upload your first photo using the camera or gallery.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={openUploadModal} activeOpacity={0.7}>
            <Feather name="plus" size={16} color={colors.primaryForeground} />
            <Text style={styles.emptyBtnText}>Upload Photos</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <>
        {groupedPhotos.map(group => (
          <View key={group.label}>
            <View style={styles.dateGroupHeader}>
              <Text style={styles.dateGroupLabel}>{group.label}</Text>
              <Text style={styles.dateGroupCount}>{group.photos.length}</Text>
            </View>
            {chunkArray(group.photos, NUM_COLUMNS).map((row, ri) => (
              <View key={ri} style={styles.gridRow}>
                {row.map(renderPhotoThumb)}
                {row.length < NUM_COLUMNS &&
                  Array.from({ length: NUM_COLUMNS - row.length }).map((_, i) => (
                    <View key={`spacer-${i}`} style={{ width: THUMB_SIZE }} />
                  ))}
              </View>
            ))}
          </View>
        ))}
      </>
    );
  };

  const renderBulkBar = () => {
    if (!selectionMode || selectedIds.size === 0) return null;
    return (
      <View style={styles.bulkBar}>
        <Text style={styles.bulkBarCount}>{selectedIds.size} selected</Text>
        <TouchableOpacity style={styles.bulkAction} onPress={toggleSelectAll} activeOpacity={0.7}>
          <Feather name={selectedIds.size === photos.length ? 'minus-square' : 'check-square'} size={14} color={colors.foreground} />
          <Text style={styles.bulkActionText}>{selectedIds.size === photos.length ? 'Deselect All' : 'Select All'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bulkAction} onPress={() => setShowBulkCategoryPicker(true)} activeOpacity={0.7}>
          <Feather name="tag" size={14} color={colors.foreground} />
          <Text style={styles.bulkActionText}>Category</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bulkAction} onPress={openBulkJobPicker} activeOpacity={0.7}>
          <Feather name="briefcase" size={14} color={colors.foreground} />
          <Text style={styles.bulkActionText}>Attach</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bulkAction, styles.bulkActionDanger]} onPress={handleBulkDelete} activeOpacity={0.7}>
          <Feather name="trash-2" size={14} color={colors.destructive} />
          <Text style={[styles.bulkActionText, styles.bulkActionDangerText]}>Delete</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bulkCancel} onPress={cancelSelection} activeOpacity={0.7}>
          <Text style={styles.bulkCancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderUploadModal = () => (
    <AppBottomSheet
      visible={showUploadModal}
      onDismiss={() => !isUploading && setShowUploadModal(false)}
      snapPoints={['85%']}
      scrollable={false}
      contentPadding={0}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Upload Photos</Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => !isUploading && setShowUploadModal(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <TouchableOpacity style={styles.sourceBtn} onPress={pickFromCamera} activeOpacity={0.7}>
              <Feather name="camera" size={20} color={colors.mutedForeground} />
              <Text style={styles.sourceBtnText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sourceBtn} onPress={pickFromGallery} activeOpacity={0.7}>
              <Feather name="image" size={20} color={colors.mutedForeground} />
              <Text style={styles.sourceBtnText}>Choose from Gallery</Text>
            </TouchableOpacity>

            {uploadImages.length > 0 && (
              <View style={styles.previewRow}>
                {uploadImages.map((img, i) => (
                  <View key={i} style={styles.previewThumb}>
                    <Image source={{ uri: img.uri }} style={styles.previewImage} />
                    <TouchableOpacity style={styles.previewRemove} onPress={() => removeUploadImage(i)}>
                      <Feather name="x" size={12} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Category</Text>
              <View style={styles.catSelector}>
                {UPLOAD_CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.value}
                    style={[styles.catOption, uploadCategory === c.value && styles.catOptionSelected]}
                    onPress={() => setUploadCategory(c.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.catOptionText, uploadCategory === c.value && styles.catOptionTextSelected]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Caption (optional)</Text>
              <TextInput
                style={[styles.formInput, styles.formInputMultiline]}
                value={uploadCaption}
                onChangeText={setUploadCaption}
                placeholder="Add a note about these photos..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
              />
            </View>

            {isUploading && (
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.round(uploadProgress * 100)}%` }]} />
              </View>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => !isUploading && setShowUploadModal(false)} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, (isUploading || uploadImages.length === 0) && styles.saveBtnDisabled]}
              onPress={handleUpload}
              disabled={isUploading || uploadImages.length === 0}
              activeOpacity={0.7}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={styles.saveBtnText}>
                  Upload {uploadImages.length > 0 ? `(${uploadImages.length})` : ''}
                </Text>
              )}
            </TouchableOpacity>
          </View>
      </KeyboardAvoidingView>
    </AppBottomSheet>
  );

  const renderLightbox = () => {
    if (!lightboxPhoto) return null;
    const idx = flatPhotos.findIndex(p => p.id === lightboxPhoto.id);
    const catStyle = getCategoryStyle(lightboxPhoto.category, colors);
    return (
      <Modal visible={true} animationType="fade" statusBarTranslucent onRequestClose={closeLightbox}>
        {/* The lightbox is always black; force light status-bar icons while it
            is open (the central StatusBar in _layout follows the app theme, so
            in light mode the icons would be dark-on-black and unreadable on
            Android's translucent status bar). */}
        <StatusBar style="light" />
        <View style={styles.lightboxOverlay}>
          <View style={styles.lightboxHeader}>
            <TouchableOpacity style={styles.lightboxClose} onPress={closeLightbox}>
              <Feather name="x" size={24} color={colors.white} />
            </TouchableOpacity>
            <View style={styles.lightboxActions}>
              <TouchableOpacity
                style={styles.lightboxActionBtn}
                onPress={() => setLightboxEditing(!lightboxEditing)}
              >
                <Feather name={lightboxEditing ? 'x-circle' : 'edit-2'} size={20} color={colors.white} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.lightboxActionBtn}
                onPress={() => handleDeletePhoto(lightboxPhoto)}
              >
                <Feather name="trash-2" size={20} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          </View>

          <Image source={{ uri: lightboxPhoto.url }} style={styles.lightboxImage} resizeMode="contain" />

          {idx > 0 && (
            <TouchableOpacity style={[styles.lightboxNav, styles.lightboxNavLeft]} onPress={() => navigateLightbox(-1)}>
              <Feather name="chevron-left" size={28} color={colors.white} />
            </TouchableOpacity>
          )}
          {idx < flatPhotos.length - 1 && (
            <TouchableOpacity style={[styles.lightboxNav, styles.lightboxNavRight]} onPress={() => navigateLightbox(1)}>
              <Feather name="chevron-right" size={28} color={colors.white} />
            </TouchableOpacity>
          )}

          <ScrollView style={styles.lightboxMeta} showsVerticalScrollIndicator={false}>
            <View style={[styles.lightboxBadge, { backgroundColor: catStyle.color }]}>
              <Text style={styles.lightboxBadgeText}>{getCategoryLabel(lightboxPhoto.category)}</Text>
            </View>

            {lightboxPhoto.caption && (
              <Text style={styles.lightboxCaption}>{lightboxPhoto.caption}</Text>
            )}

            {lightboxPhoto.tags && lightboxPhoto.tags.length > 0 && (
              <View style={styles.lightboxTagsRow}>
                {lightboxPhoto.tags.map((t, i) => (
                  <View key={i} style={styles.lightboxTag}>
                    <Text style={styles.lightboxTagText}>{t}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.lightboxInfoRow}>
              <Feather name="calendar" size={12} color="rgba(255,255,255,0.5)" />
              <Text style={styles.lightboxInfoText}>
                {format(new Date(lightboxPhoto.createdAt), 'dd MMM yyyy, h:mm a')}
              </Text>
            </View>

            {lightboxPhoto.jobTitle && (
              <TouchableOpacity
                style={styles.lightboxInfoRow}
                onPress={() => {
                  closeLightbox();
                  router.push(`/job/${lightboxPhoto.jobId}` as any);
                }}
              >
                <Feather name="briefcase" size={12} color="#60a5fa" />
                <Text style={styles.lightboxLink}>{lightboxPhoto.jobTitle}</Text>
              </TouchableOpacity>
            )}

            {lightboxPhoto.clientName && (
              <TouchableOpacity
                style={styles.lightboxInfoRow}
                onPress={() => {
                  closeLightbox();
                  router.push(`/more/client/${lightboxPhoto.clientId}` as any);
                }}
              >
                <Feather name="user" size={12} color="#60a5fa" />
                <Text style={styles.lightboxLink}>{lightboxPhoto.clientName}</Text>
              </TouchableOpacity>
            )}

            {lightboxPhoto.address && (
              <View style={styles.lightboxInfoRow}>
                <Feather name="map-pin" size={12} color="rgba(255,255,255,0.5)" />
                <Text style={styles.lightboxInfoText}>{lightboxPhoto.address}</Text>
              </View>
            )}

            {lightboxPhoto.fileName && (
              <View style={styles.lightboxInfoRow}>
                <Feather name="file" size={12} color="rgba(255,255,255,0.5)" />
                <Text style={styles.lightboxInfoText}>{lightboxPhoto.fileName}</Text>
              </View>
            )}

            {lightboxEditing && (
              <View style={styles.lightboxEditSection}>
                <Text style={styles.lightboxEditLabel}>CATEGORY</Text>
                <View style={styles.lightboxEditCatRow}>
                  {UPLOAD_CATEGORIES.map(c => (
                    <TouchableOpacity
                      key={c.value}
                      style={[styles.lightboxEditCatChip, editCategory === c.value && styles.lightboxEditCatChipActive]}
                      onPress={() => setEditCategory(c.value)}
                    >
                      <Text style={[styles.lightboxEditCatText, editCategory === c.value && styles.lightboxEditCatTextActive]}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.lightboxEditLabel}>CAPTION</Text>
                <TextInput
                  style={styles.lightboxEditInput}
                  value={editCaption}
                  onChangeText={setEditCaption}
                  placeholder="Add caption..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  multiline
                />

                <Text style={styles.lightboxEditLabel}>TAGS (comma separated)</Text>
                <TextInput
                  style={styles.lightboxEditInput}
                  value={editTags}
                  onChangeText={setEditTags}
                  placeholder="kitchen, damage, warranty..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />

                <TouchableOpacity
                  style={[styles.lightboxSaveBtn, isSavingEdit && styles.saveBtnDisabled]}
                  onPress={handleSaveEdit}
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Text style={styles.lightboxSaveBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const renderBulkCategoryPicker = () => (
    <AppBottomSheet
        visible={showBulkCategoryPicker}
        onDismiss={() => setShowBulkCategoryPicker(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}
      >
      <View>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set Category</Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowBulkCategoryPicker(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            {UPLOAD_CATEGORIES.map(c => (
              <TouchableOpacity
                key={c.value}
                style={styles.jobPickerItem}
                onPress={() => handleBulkSetCategory(c.value)}
                activeOpacity={0.7}
              >
                <View style={[{ width: 12, height: 12, borderRadius: 6 }, { backgroundColor: getCategoryStyle(c.value, colors).color }]} />
                <Text style={styles.jobPickerTitle}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
      </View>
    </AppBottomSheet>
  );

  const renderBulkJobPicker = () => (
    <AppBottomSheet
        visible={showBulkJobPicker}
        onDismiss={() => setShowBulkJobPicker(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
      <View>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Attach to Job</Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowBulkJobPicker(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={[styles.modalBody, { maxHeight: 400 }]}>
            {jobsList.length === 0 ? (
              <Text style={{ ...typography.caption, color: colors.mutedForeground, textAlign: 'center', padding: spacing.lg }}>
                No jobs found.
              </Text>
            ) : (
              jobsList.map(j => (
                <TouchableOpacity
                  key={j.id}
                  style={styles.jobPickerItem}
                  onPress={() => handleBulkAttachToJob(j.id)}
                  activeOpacity={0.7}
                >
                  <Feather name="briefcase" size={16} color={colors.mutedForeground} />
                  <Text style={styles.jobPickerTitle}>{j.title || `Job #${j.id}`}</Text>
                  {j.status && <Text style={styles.jobPickerStatus}>{j.status}</Text>}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
      </View>
    </AppBottomSheet>
  );

  if (isLoading) {
    return (
      <View style={{ alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.md }}>
          Loading photos...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>PHOTO LIBRARY</Text>
        <TouchableOpacity style={styles.uploadBtn} onPress={openUploadModal} activeOpacity={0.7}>
          <Feather name="plus" size={14} color={colors.primaryForeground} />
          <Text style={styles.uploadBtnText}>Upload</Text>
        </TouchableOpacity>
      </View>

      {renderStats()}
      {renderFilters()}
      {renderBulkBar()}
      {renderGrid()}

      {renderUploadModal()}
      {renderLightbox()}
      {renderBulkCategoryPicker()}
      {renderBulkJobPicker()}
    </View>
  );
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
