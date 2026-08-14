/**
 * VariationsSection — displays job variations (change orders) on the mobile job detail screen.
 * Read-only list for all users; owners/managers can add new variations and approve/reject pending ones.
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Image,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ThemeColors } from '../../lib/theme';
import { spacing, radius, typography, fontWeights } from '../../lib/design-tokens';
import api from '../../lib/api';
import { showToast } from '../../lib/toast';
import { AppBottomSheet, BottomSheetScrollView } from '../ui/AppBottomSheet';
import { SheetButton } from '../ui/SheetButton';
import { useActionSheet } from '../ui/ActionSheet';

// ─── types ────────────────────────────────────────────────────────────────────

export type VariationStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'pending';

export interface JobVariation {
  id: string;
  jobId: string;
  number: string;
  title: string;
  description?: string | null;
  reason?: string | null;
  additionalAmount: string;
  gstAmount: string;
  totalAmount: string;
  status: VariationStatus;
  photos?: any[];
  createdByName?: string | null;
  createdAt?: string | null;
  approvedAt?: string | null;
  approvedByName?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<VariationStatus, { label: string; bg: string; text: string }> = {
  draft:    { label: 'Draft',    bg: '#F3F4F6', text: '#374151' },
  sent:     { label: 'Pending',  bg: '#FEF3C7', text: '#92400E' },
  pending:  { label: 'Pending',  bg: '#FEF3C7', text: '#92400E' },
  approved: { label: 'Approved', bg: '#D1FAE5', text: '#065F46' },
  rejected: { label: 'Rejected', bg: '#FEE2E2', text: '#991B1B' },
};

function fmt(v: string | number | null | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
  return `$${(isNaN(n) ? 0 : n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

// ─── component ────────────────────────────────────────────────────────────────

export interface VariationsSectionProps {
  colors: ThemeColors;
  variations: JobVariation[];
  isLoading: boolean;
  jobId: string;
  isOwnerOrManager?: boolean;
  onRefresh?: () => void;
}

export function VariationsSection({
  colors,
  variations,
  isLoading,
  jobId,
  isOwnerOrManager = false,
  onRefresh,
}: VariationsSectionProps) {
  const showActionSheet = useActionSheet();

  // ── add sheet state ───────────────────────────────────────────────────────
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addForm, setAddForm] = useState({
    title: '',
    description: '',
    reason: '',
    additionalAmount: '',
  });
  const [addPhotos, setAddPhotos] = useState<string[]>([]); // local URIs
  const [isSaving, setIsSaving] = useState(false);

  // ── action state ──────────────────────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── computed ──────────────────────────────────────────────────────────────
  const approvedTotal = variations
    .filter((v) => v.status === 'approved')
    .reduce((sum, v) => sum + parseFloat(v.totalAmount || '0'), 0);

  const pendingCount = variations.filter((v) => v.status === 'sent').length;

  // ── photo picker ──────────────────────────────────────────────────────────
  const handlePickPhotos = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast({ type: 'error', message: 'Camera roll access is required to attach photos' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
      selectionLimit: 5,
    });
    if (!result.canceled && result.assets.length > 0) {
      const uris = result.assets.map((a) => a.uri);
      setAddPhotos((prev) => [...prev, ...uris].slice(0, 5));
    }
  }, []);

  // ── upload photos — uses base64 JSON API (POST /api/jobs/:jobId/photos) ──
  const uploadPhotos = useCallback(async (uris: string[]): Promise<{ photoId: string; fileName: string }[]> => {
    const results: { photoId: string; fileName: string }[] = [];
    for (const uri of uris) {
      try {
        const rawName = uri.split('/').pop() || 'variation-photo.jpg';
        const fileName = rawName.includes('.') ? rawName : `${rawName}.jpg`;
        const mimeType = fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        const fileBase64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const res = await api.post<{ photoId: string; success: boolean }>(
          `/api/jobs/${jobId}/photos`,
          { fileName, fileBase64, mimeType, category: 'variation' },
        );
        if (res.error) {
          console.warn('[VariationsSection] photo upload failed:', res.error);
          continue; // best effort — don't block variation creation on a single photo failure
        }
        if (res.data?.photoId) {
          results.push({ photoId: res.data.photoId, fileName });
        }
      } catch (e) {
        console.warn('[VariationsSection] photo upload error:', e);
      }
    }
    return results;
  }, [jobId]);

  // ── create variation ──────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!addForm.title.trim()) {
      showToast({ type: 'error', message: 'Title is required' });
      return;
    }
    setIsSaving(true);
    try {
      const photoRefs = addPhotos.length > 0 ? await uploadPhotos(addPhotos) : [];
      const res = await api.post(`/api/jobs/${jobId}/variations`, {
        title: addForm.title.trim(),
        description: addForm.description.trim() || null,
        reason: addForm.reason.trim() || null,
        additionalAmount: parseFloat(addForm.additionalAmount.replace(/[^0-9.]/g, '')) || 0,
        photos: photoRefs,
      });
      if (res.error) {
        showToast({ type: 'error', message: res.error });
        return;
      }
      showToast({ type: 'success', message: 'Variation created' });
      setShowAddSheet(false);
      setAddForm({ title: '', description: '', reason: '', additionalAmount: '' });
      setAddPhotos([]);
      onRefresh?.();
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Failed to create variation' });
    } finally {
      setIsSaving(false);
    }
  }, [addForm, addPhotos, jobId, uploadPhotos, onRefresh]);

  // ── approve / reject ──────────────────────────────────────────────────────
  const handleVariationAction = useCallback((variation: JobVariation) => {
    if (!isOwnerOrManager) return;
    const isPendingStatus = variation.status === 'sent' || variation.status === 'pending';
    if (!isPendingStatus) return;

    showActionSheet({
      title: `${variation.number}: ${variation.title}`,
      message: `${fmt(variation.totalAmount)} (incl. GST)`,
      actions: [
        {
          label: 'Approve',
          icon: 'check-circle' as const,
          onPress: async () => {
            setActionLoading(variation.id);
            try {
              const res = await api.patch(`/api/jobs/${jobId}/variations/${variation.id}`, { status: 'approved' });
              if (res.error) {
                showToast({ type: 'error', message: res.error });
              } else {
                showToast({ type: 'success', message: 'Variation approved' });
                onRefresh?.();
              }
            } catch (e: any) {
              showToast({ type: 'error', message: e?.message || 'Failed to approve variation' });
            } finally {
              setActionLoading(null);
            }
          },
        },
        {
          label: 'Reject',
          icon: 'x-circle' as const,
          style: 'destructive' as const,
          onPress: async () => {
            setActionLoading(variation.id);
            try {
              const res = await api.patch(`/api/jobs/${jobId}/variations/${variation.id}`, { status: 'rejected' });
              if (res.error) {
                showToast({ type: 'error', message: res.error });
              } else {
                showToast({ type: 'success', message: 'Variation rejected' });
                onRefresh?.();
              }
            } catch (e: any) {
              showToast({ type: 'error', message: e?.message || 'Failed to reject variation' });
            } finally {
              setActionLoading(null);
            }
          },
        },
        {
          label: 'Cancel',
          style: 'cancel' as const,
        },
      ],
    });
  }, [isOwnerOrManager, jobId, onRefresh, showActionSheet]);

  // ── submit draft for approval ─────────────────────────────────────────────
  const handleSubmitDraft = useCallback(async (variation: JobVariation) => {
    if (!isOwnerOrManager) return;
    setActionLoading(variation.id);
    try {
      const res = await api.patch<{ notificationWarning?: string }>(`/api/jobs/${jobId}/variations/${variation.id}`, { status: 'sent' });
      if (res.error) {
        showToast({ type: 'error', message: res.error });
      } else {
        showToast({ type: 'success', message: 'Variation submitted for approval' });
        if (res.data?.notificationWarning) {
          showToast({ type: 'info', message: res.data.notificationWarning });
        }
        onRefresh?.();
      }
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Failed to submit variation' });
    } finally {
      setActionLoading(null);
    }
  }, [isOwnerOrManager, jobId, onRefresh]);

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Feather name="git-pull-request" size={14} color={colors.mutedForeground} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Variations</Text>
        {variations.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.countText, { color: colors.mutedForeground }]}>{variations.length}</Text>
          </View>
        )}
        {pendingCount > 0 && (
          <View style={[styles.countBadge, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.countText, { color: '#92400E' }]}>{pendingCount} pending</Text>
          </View>
        )}
        {isOwnerOrManager && (
          <TouchableOpacity
            onPress={() => setShowAddSheet(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginLeft: spacing.xs }}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: colors.primaryLight,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
              borderRadius: 8,
            }}>
              <Feather name="plus" size={13} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: fontWeights.semibold, color: colors.primary }}>Add</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Approved total summary */}
      {approvedTotal > 0 && (
        <View style={[styles.summaryBox, { backgroundColor: '#D1FAE520', borderColor: '#065F4633' }]}>
          <Feather name="check-circle" size={13} color="#065F46" />
          <Text style={[styles.summaryText, { color: '#065F46' }]}>
            Approved variations: {fmt(approvedTotal)} added to contract value
          </Text>
        </View>
      )}

      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={colors.mutedForeground} />
        </View>
      )}

      {!isLoading && variations.length === 0 && (
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          No variations yet. Add a variation to capture scope changes.
        </Text>
      )}

      {variations.map((variation) => {
        const cfg = STATUS_CONFIG[variation.status] ?? STATUS_CONFIG.draft;
        const isActioning = actionLoading === variation.id;
        const isPending = variation.status === 'sent' || variation.status === 'pending';
        const isDraft = variation.status === 'draft';

        return (
          <TouchableOpacity
            key={variation.id}
            style={[styles.variationCard, { borderColor: colors.cardBorder, backgroundColor: colors.card }]}
            onPress={() => {
              if (isPending && isOwnerOrManager) {
                handleVariationAction(variation);
              } else if (isDraft && isOwnerOrManager) {
                handleSubmitDraft(variation);
              }
            }}
            activeOpacity={(isPending || isDraft) && isOwnerOrManager ? 0.7 : 1}
          >
            <View style={styles.cardRow}>
              {/* Number badge */}
              <View style={[styles.numberBadge, { borderColor: colors.primary + '55' }]}>
                <Text style={[styles.numberText, { color: colors.primary }]}>{variation.number}</Text>
              </View>

              {/* Main info */}
              <View style={styles.cardMain}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {variation.title}
                </Text>
                {variation.description ? (
                  <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {variation.description}
                  </Text>
                ) : null}
                <View style={styles.cardMeta}>
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
                  </View>
                  <Text style={[styles.amountText, { color: colors.foreground }]}>
                    {fmt(variation.totalAmount)}
                  </Text>
                  {variation.createdAt && (
                    <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
                      {fmtDate(variation.createdAt)}
                    </Text>
                  )}
                </View>
                {variation.approvedByName && variation.status === 'approved' && (
                  <Text style={[styles.approverText, { color: '#065F46' }]}>
                    Approved by {variation.approvedByName}
                  </Text>
                )}
                {variation.rejectionReason && variation.status === 'rejected' && (
                  <Text style={[styles.approverText, { color: '#991B1B' }]}>
                    Rejected: {variation.rejectionReason}
                  </Text>
                )}
              </View>

              {/* Right side action indicator */}
              <View style={styles.cardRight}>
                {isActioning ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : isPending && isOwnerOrManager ? (
                  <View style={{ alignItems: 'center', gap: 3 }}>
                    <Feather name="check-circle" size={16} color="#065F46" />
                    <Text style={{ fontSize: 9, color: colors.mutedForeground }}>Tap to act</Text>
                  </View>
                ) : isDraft && isOwnerOrManager ? (
                  <View style={{ alignItems: 'center', gap: 3 }}>
                    <Feather name="send" size={14} color={colors.primary} />
                    <Text style={{ fontSize: 9, color: colors.mutedForeground }}>Submit</Text>
                  </View>
                ) : (
                  <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Add Variation Bottom Sheet */}
      <AppBottomSheet
        visible={showAddSheet}
        onDismiss={() => {
          setShowAddSheet(false);
          setAddForm({ title: '', description: '', reason: '', additionalAmount: '' });
          setAddPhotos([]);
        }}
        title="Add Variation"
        showCloseButton
        snapPoints={['85%']}
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <SheetButton
              variant="outline"
              label="Cancel"
              onPress={() => {
                setShowAddSheet(false);
                setAddForm({ title: '', description: '', reason: '', additionalAmount: '' });
                setAddPhotos([]);
              }}
              style={{ flex: 1 }}
            />
            <SheetButton
              onPress={handleSave}
              loading={isSaving}
              disabled={isSaving || !addForm.title.trim()}
              label="Create Variation"
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        >
          {/* Title */}
          <Text style={[styles.formLabel, { color: colors.foreground }]}>Title *</Text>
          <TextInput
            style={[styles.formInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="e.g. Additional earthworks"
            placeholderTextColor={colors.mutedForeground}
            value={addForm.title}
            onChangeText={(t) => setAddForm((f) => ({ ...f, title: t }))}
            maxLength={100}
          />

          {/* Estimated Cost */}
          <Text style={[styles.formLabel, { color: colors.foreground }]}>Estimated Cost (excl. GST)</Text>
          <TextInput
            style={[styles.formInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="0.00"
            placeholderTextColor={colors.mutedForeground}
            value={addForm.additionalAmount}
            onChangeText={(t) => setAddForm((f) => ({ ...f, additionalAmount: t }))}
            keyboardType="decimal-pad"
          />

          {/* Description */}
          <Text style={[styles.formLabel, { color: colors.foreground }]}>Description</Text>
          <TextInput
            style={[styles.formInput, styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="Describe the scope change..."
            placeholderTextColor={colors.mutedForeground}
            value={addForm.description}
            onChangeText={(t) => setAddForm((f) => ({ ...f, description: t }))}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Reason */}
          <Text style={[styles.formLabel, { color: colors.foreground }]}>Reason for Change</Text>
          <TextInput
            style={[styles.formInput, styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="Why is this change needed?"
            placeholderTextColor={colors.mutedForeground}
            value={addForm.reason}
            onChangeText={(t) => setAddForm((f) => ({ ...f, reason: t }))}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* Photos */}
          <Text style={[styles.formLabel, { color: colors.foreground }]}>Photos (evidence)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              {addPhotos.map((uri, idx) => (
                <View key={idx} style={styles.photoThumb}>
                  <Image source={{ uri }} style={styles.photoThumbImg} />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => setAddPhotos((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Feather name="x" size={10} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {addPhotos.length < 5 && (
                <TouchableOpacity
                  style={[styles.addPhotoBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
                  onPress={handlePickPhotos}
                >
                  <Feather name="camera" size={20} color={colors.mutedForeground} />
                  <Text style={[styles.addPhotoText, { color: colors.mutedForeground }]}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          {/* GST note */}
          {addForm.additionalAmount ? (
            <View style={[styles.gstNote, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="info" size={12} color={colors.mutedForeground} />
              <Text style={[styles.gstNoteText, { color: colors.mutedForeground }]}>
                GST (10%) will be added automatically. Total:{' '}
                {fmt((parseFloat(addForm.additionalAmount.replace(/[^0-9.]/g, '')) || 0) * 1.1)}
              </Text>
            </View>
          ) : null}
        </BottomSheetScrollView>
      </AppBottomSheet>
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: fontWeights.semibold,
    marginLeft: spacing.xs,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countText: {
    fontSize: 10,
    fontWeight: fontWeights.medium,
  },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginBottom: spacing.sm,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: fontWeights.medium,
    flex: 1,
  },
  centered: {
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.caption.fontSize,
    paddingVertical: spacing.xs,
  },
  variationCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  numberBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  numberText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: fontWeights.semibold,
  },
  cardMain: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: fontWeights.medium,
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: fontWeights.medium,
  },
  amountText: {
    fontSize: 13,
    fontWeight: fontWeights.semibold,
  },
  dateText: {
    fontSize: 11,
  },
  approverText: {
    fontSize: 11,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    paddingTop: 2,
  },
  // Form styles
  formLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.md,
    height: 44,
  },
  textArea: {
    height: undefined,
    minHeight: 80,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    overflow: 'visible',
    position: 'relative',
  },
  photoThumbImg: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
  },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  addPhotoBtn: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 9,
    fontWeight: fontWeights.medium,
  },
  gstNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  gstNoteText: {
    fontSize: 12,
    flex: 1,
  },
});
