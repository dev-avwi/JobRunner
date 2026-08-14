/**
 * DefectsSection — punch list / defect tracking for project-type jobs.
 * Shows open defect items, lets owners/managers add items and attach photos.
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme, colorWithOpacity } from '../../lib/theme';
import { spacing, radius, typography, fontWeights, shadows, iconSizes } from '../../lib/design-tokens';
import api, { API_URL } from '../../lib/api';
import { showToast } from '../../lib/toast';
import { AppBottomSheet, BottomSheetScrollView } from '../ui/AppBottomSheet';
import { SheetButton } from '../ui/SheetButton';

// ─── types ────────────────────────────────────────────────────────────────────

export interface DefectItem {
  id: string;
  jobId: string;
  description: string;
  photoUrl?: string | null;
  assignedTo?: string | null;
  assignedToName?: string | null;
  dueDate?: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'client_approved';
  notes?: string | null;
  createdAt: string;
}

interface Props {
  jobId: string;
  isTradie?: boolean;
  items: DefectItem[];
  loading?: boolean;
  onRefresh: () => void;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_ORDER: DefectItem['status'][] = ['open', 'in_progress', 'resolved', 'client_approved'];

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  client_approved: 'Client Approved',
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  open:             { bg: '#FEF3C7', text: '#92400E' },
  in_progress:      { bg: '#DBEAFE', text: '#1E40AF' },
  resolved:         { bg: '#D1FAE5', text: '#065F46' },
  client_approved:  { bg: '#EDE9FE', text: '#5B21B6' },
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

// ─── component ────────────────────────────────────────────────────────────────

export function DefectsSection({ jobId, isTradie = false, items, loading = false, onRefresh }: Props) {
  const { colors } = useTheme();

  const [expanded, setExpanded] = useState(true);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const openCount = items.filter(i => i.status === 'open' || i.status === 'in_progress').length;
  const allCleared = items.length > 0 && items.every(i => i.status === 'resolved' || i.status === 'client_approved');

  // ── add item ──────────────────────────────────────────────────────────────
  const handleAdd = useCallback(async () => {
    if (!description.trim()) {
      showToast({ type: 'error', message: 'Description is required' });
      return;
    }
    setIsSaving(true);
    try {
      const res = await api.post<{ id: string }>(`/api/jobs/${jobId}/defect-items`, {
        description: description.trim(),
        notes: notes.trim() || null,
        status: 'open',
      });
      if (res.error) {
        showToast({ type: 'error', message: res.error });
        return;
      }
      setDescription('');
      setNotes('');
      setShowAddSheet(false);
      onRefresh();
      showToast({ type: 'success', message: 'Defect item added' });
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Failed to add item' });
    } finally {
      setIsSaving(false);
    }
  }, [description, notes, jobId, onRefresh]);

  // ── cycle status ──────────────────────────────────────────────────────────
  const cycleStatus = useCallback(async (item: DefectItem) => {
    const nextStatus = STATUS_ORDER[(STATUS_ORDER.indexOf(item.status) + 1) % STATUS_ORDER.length];
    try {
      const res = await api.patch(`/api/jobs/${jobId}/defect-items/${item.id}`, { status: nextStatus });
      if (res.error) {
        showToast({ type: 'error', message: res.error });
        return;
      }
      onRefresh();
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Failed to update status' });
    }
  }, [jobId, onRefresh]);

  // ── attach photo ──────────────────────────────────────────────────────────
  // Uploads via base64 to the JSON photo endpoint (mirrors VariationsSection).
  // Stores /api/jobs/:jobId/photos/:photoId/view as a durable (non-expiring) ref.
  const handlePickPhoto = useCallback(async (item: DefectItem) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showToast({ type: 'error', message: 'Camera permission is required to attach photos' });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;

    setUploadingId(item.id);
    try {
      const asset = result.assets[0];
      const rawName = asset.uri.split('/').pop() || 'defect.jpg';
      const fileName = rawName.includes('.') ? rawName : `${rawName}.jpg`;
      const mimeType = fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

      const fileBase64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const uploadRes = await api.post<{ photoId: string; success: boolean }>(
        `/api/jobs/${jobId}/photos`,
        { fileName, fileBase64, mimeType, category: 'defect' },
      );

      if (uploadRes.error || !uploadRes.data?.photoId) {
        showToast({ type: 'error', message: 'Failed to upload photo' });
        return;
      }

      // Store a durable, auth-resolved view URL (not a transient signed URL).
      const photoUrl = `${API_URL}/api/jobs/${jobId}/photos/${uploadRes.data.photoId}/view`;

      const patchRes = await api.patch(`/api/jobs/${jobId}/defect-items/${item.id}`, { photoUrl });
      if (patchRes.error) {
        showToast({ type: 'error', message: 'Photo uploaded but could not attach to item' });
        return;
      }

      onRefresh();
      showToast({ type: 'success', message: 'Photo attached' });
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Failed to attach photo' });
    } finally {
      setUploadingId(null);
    }
  }, [jobId, onRefresh]);

  // ── delete item ───────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (item: DefectItem) => {
    try {
      const res = await api.delete(`/api/jobs/${jobId}/defect-items/${item.id}`);
      if (res.error) {
        showToast({ type: 'error', message: res.error });
        return;
      }
      onRefresh();
      showToast({ type: 'success', message: 'Item removed' });
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Failed to remove item' });
    }
  }, [jobId, onRefresh]);

  const s = makeStyles(colors);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <View style={s.wrapper}>
      {/* Section header */}
      <Pressable style={s.header} onPress={() => setExpanded(v => !v)}>
        <View style={s.iconBox}>
          <Feather name="tool" size={iconSizes.md} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Defects &amp; Punch List</Text>
          {!expanded && items.length > 0 && (
            <Text style={s.headerSub} numberOfLines={1}>
              {openCount > 0 ? `${openCount} open` : 'All cleared'}
            </Text>
          )}
        </View>
        {openCount > 0 && (
          <View style={[s.countBadge, { backgroundColor: colorWithOpacity(colors.warning, 0.15) }]}>
            <Text style={[s.countBadgeText, { color: colors.warning }]}>{openCount}</Text>
          </View>
        )}
        {allCleared && (
          <Feather name="check-circle" size={iconSizes.md} color={colors.success} />
        )}
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={iconSizes.lg} color={colors.mutedForeground} />
      </Pressable>

      {expanded && (
        <View style={s.body}>
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} />
          ) : (
            <>
              {allCleared && (
                <View style={s.clearedBanner}>
                  <Feather name="check-circle" size={14} color={colors.success} />
                  <Text style={[s.clearedText, { color: colors.success }]}>
                    All defects cleared. Retention can be released.
                  </Text>
                </View>
              )}

              {items.length === 0 ? (
                <Text style={s.empty}>No defect items yet</Text>
              ) : (
                items.map(item => {
                  const sc = STATUS_COLOR[item.status] ?? STATUS_COLOR.open;
                  return (
                    <View key={item.id} style={s.item}>
                      {/* Status tap */}
                      <TouchableOpacity
                        style={s.dotWrap}
                        onPress={() => !isTradie && cycleStatus(item)}
                        activeOpacity={isTradie ? 1 : 0.6}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <View style={[s.dot, { backgroundColor: sc.text }]} />
                      </TouchableOpacity>

                      <View style={{ flex: 1 }}>
                        <Text style={s.desc}>{item.description}</Text>
                        <View style={s.metaRow}>
                          <View style={[s.badge, { backgroundColor: sc.bg }]}>
                            <Text style={[s.badgeText, { color: sc.text }]}>
                              {STATUS_LABEL[item.status] ?? item.status}
                            </Text>
                          </View>
                          {item.dueDate ? (
                            <Text style={s.metaText}>Due {fmtDate(item.dueDate)}</Text>
                          ) : null}
                          {item.photoUrl ? (
                            <View style={s.metaRow}>
                              <Feather name="image" size={10} color={colors.mutedForeground} />
                            </View>
                          ) : null}
                        </View>
                        {item.notes ? <Text style={s.notes} numberOfLines={2}>{item.notes}</Text> : null}
                      </View>

                      {!isTradie && (
                        <View style={s.actions}>
                          <TouchableOpacity
                            onPress={() => handlePickPhoto(item)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            {uploadingId === item.id
                              ? <ActivityIndicator size="small" color={colors.primary} />
                              : <Feather name="camera" size={16} color={colors.mutedForeground} />
                            }
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDelete(item)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })
              )}

              {!isTradie && (
                <TouchableOpacity style={s.addBtn} onPress={() => setShowAddSheet(true)} activeOpacity={0.7}>
                  <Feather name="plus" size={14} color={colors.primary} />
                  <Text style={[s.addBtnText, { color: colors.primary }]}>Add Defect Item</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      {/* Add sheet */}
      <AppBottomSheet visible={showAddSheet} onDismiss={() => setShowAddSheet(false)} title="Add Defect Item">
        <BottomSheetScrollView>
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <View>
              <Text style={[s.label, { color: colors.mutedForeground }]}>Description *</Text>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Describe the defect or outstanding item…"
                placeholderTextColor={colors.mutedForeground}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>
            <View>
              <Text style={[s.label, { color: colors.mutedForeground }]}>Notes (optional)</Text>
              <TextInput
                style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Additional notes or rectification instructions…"
                placeholderTextColor={colors.mutedForeground}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={2}
              />
            </View>
            <SheetButton
              label={isSaving ? 'Adding…' : 'Add Item'}
              onPress={handleAdd}
              disabled={isSaving || !description.trim()}
              variant="primary"
            />
          </View>
        </BottomSheetScrollView>
      </AppBottomSheet>
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    wrapper: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      overflow: 'hidden',
      marginBottom: spacing.md,
      ...shadows.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    iconBox: {
      width: 32,
      height: 32,
      borderRadius: radius.md,
      backgroundColor: colorWithOpacity(colors.primary, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.semibold as any,
      color: colors.foreground,
    },
    headerSub: {
      fontSize: typography.sizes.xs,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    countBadge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    countBadgeText: {
      fontSize: 11,
      fontWeight: fontWeights.bold as any,
    },
    body: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      gap: spacing.sm,
    },
    clearedBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      padding: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colorWithOpacity(colors.success, 0.1),
      borderWidth: 1,
      borderColor: colorWithOpacity(colors.success, 0.25),
    },
    clearedText: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.medium as any,
      flex: 1,
    },
    empty: {
      color: colors.mutedForeground,
      fontSize: typography.sizes.sm,
      textAlign: 'center',
      paddingVertical: spacing.lg,
    },
    item: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'flex-start',
      paddingVertical: spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    dotWrap: {
      marginTop: 4,
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    desc: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.medium as any,
      color: colors.foreground,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: 3,
      flexWrap: 'wrap',
    },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radius.sm,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: fontWeights.semibold as any,
    },
    metaText: {
      fontSize: 10,
      color: colors.mutedForeground,
    },
    notes: {
      fontSize: 11,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    actions: {
      gap: spacing.sm,
      alignItems: 'center',
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      marginTop: spacing.xs,
    },
    addBtnText: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.medium as any,
    },
    label: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.medium as any,
      marginBottom: 4,
    },
    input: {
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.sm,
      fontSize: typography.sizes.sm,
      minHeight: 70,
      textAlignVertical: 'top',
    },
  });
}
