/**
 * JobNotesSection — shared job notepad visible to all team members.
 * Workers leave persistent, non-dated notes (access codes, site quirks,
 * client preferences, etc.) that stay for the life of the job.
 *
 * Notes are sorted newest-first. Workers can delete their own notes;
 * owners/managers can delete any note.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AppBottomSheet } from '../ui/AppBottomSheet';
import { SheetButton } from '../ui/SheetButton';
import { Feather } from '@expo/vector-icons';
import api from '../../lib/api';
import { showToast } from '../../lib/toast';
import { useConfirmDialog } from '../ui/ConfirmDialog';
import { spacing, radius, typography, fontWeights, iconSizes } from '../../lib/design-tokens';
import { SkeletonSection } from '../Skeleton';
import { TeamAvatar } from '../TeamAvatar';
import { format, parseISO } from 'date-fns';

interface JobNote {
  id: string;
  jobId: string;
  /** Tenant owner ID (business/owner effectiveUserId) — not the author. */
  userId: string;
  /** Authenticated user ID of the person who created the note. */
  createdBy?: string | null;
  content: string;
  createdByName?: string | null;
  /** Signed URL for the photo, regenerated fresh by the server on each GET. */
  photoUrl?: string | null;
  createdAt: string;
}

interface JobNotesSectionProps {
  jobId: string;
  colors: any;
  styles: any;
  isOwnerOrManager: boolean;
  currentUserId?: string;
  /** Start collapsed with a tappable header (used on the Overview tab). */
  collapsible?: boolean;
}

export function JobNotesSection({
  jobId,
  colors,
  styles: parentStyles,
  isOwnerOrManager,
  currentUserId,
  collapsible = false,
}: JobNotesSectionProps) {
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadingRef = useRef(false);
  const confirm = useConfirmDialog();
  const [expanded, setExpanded] = useState(!collapsible);

  const loadNotes = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<JobNote[]>(`/api/jobs/${jobId}/notes`);
      if (!res.error && Array.isArray(res.data)) {
        setNotes(res.data);
        setLoaded(true);
      } else {
        setLoadError(true);
        setLoaded(false);
      }
    } catch {
      setLoadError(true);
      setLoaded(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  function openForm() {
    setNoteText('');
    setPhotoUri(null);
    setShowForm(true);
    // Expand so the new note is visible once saved.
    setExpanded(true);
  }

  function closeForm() {
    setShowForm(false);
    setNoteText('');
    setPhotoUri(null);
  }

  async function pickPhoto() {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo access to attach a photo to this note.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
      });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      showToast({ type: 'error', message: 'Could not open photo picker' });
    }
  }

  async function handleSave() {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      let result: JobNote | undefined;

      if (photoUri) {
        // Send as FormData so the server's multer middleware can receive the file.
        const form = new FormData();
        form.append('content', noteText.trim());
        const filename = photoUri.split('/').pop() ?? 'photo.jpg';
        const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        form.append('photo', { uri: photoUri, name: filename, type: mimeType } as any);
        const res = await api.uploadFile<JobNote>(`/api/jobs/${jobId}/notes`, form);
        if (res.error) { showToast({ type: 'error', message: res.error }); return; }
        result = res.data as JobNote;
      } else {
        const res = await api.post<JobNote>(`/api/jobs/${jobId}/notes`, { content: noteText.trim() });
        if (res.error) { showToast({ type: 'error', message: res.error }); return; }
        result = res.data as JobNote;
      }

      setNotes((prev) => [result!, ...prev]);
      showToast({ type: 'success', message: 'Note added' });
      closeForm();
    } catch (err: any) {
      showToast({ type: 'error', message: err?.message ?? 'Failed to save note' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(note: JobNote) {
    const ok = await confirm({
      title: 'Delete Note',
      message: 'Delete this note? This cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setDeleting(note.id);
    try {
      const res = await api.delete(`/api/jobs/${jobId}/notes/${note.id}`);
      if (res.error) { showToast({ type: 'error', message: res.error }); return; }
      setNotes((prev) => prev.filter((n) => n.id !== note.id));
      showToast({ type: 'success', message: 'Note deleted' });
    } catch {
      showToast({ type: 'error', message: 'Failed to delete note' });
    } finally {
      setDeleting(null);
    }
  }

  const s = localStyles(colors);

  return (
    <View style={[parentStyles.photosCard]}>
      {/* Section header — tappable toggle when collapsible */}
      <View style={s.header}>
        <TouchableOpacity
          style={s.headerLeft}
          onPress={collapsible ? () => setExpanded((v) => !v) : undefined}
          disabled={!collapsible}
          activeOpacity={0.7}
        >
          <View style={[s.iconWrap, { backgroundColor: `${colors.warning}18` }]}>
            <Feather name="file-text" size={iconSizes.lg} color={colors.warning} />
          </View>
          <Text style={s.headerTitle}>Job Notes</Text>
          {notes.length > 0 && (
            <View style={s.countBadge}>
              <Text style={s.countText}>{notes.length}</Text>
            </View>
          )}
          {collapsible && (
            <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={s.addBtn} onPress={openForm}>
          <Feather name="plus" size={14} color={colors.primary} />
          <Text style={[s.addBtnText, { color: colors.primary }]}>Add Note</Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      {expanded && loadError && (
        <View style={s.errorState}>
          <Feather name="alert-circle" size={20} color={colors.destructive} />
          <Text style={[s.errorText, { color: colors.destructive }]}>Couldn't load notes</Text>
          <TouchableOpacity onPress={loadNotes} style={s.retryBtn}>
            <Text style={[s.addBtnText, { color: colors.primary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {expanded && loading && <SkeletonSection rows={2} />}

      {expanded && loaded && notes.length === 0 && (
        <View style={s.emptyState}>
          <Feather name="file-text" size={28} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>No notes yet</Text>
          <Text style={[s.emptySubtitle, { color: colors.mutedForeground }]}>
            Leave notes for the team: access codes, site quirks, client preferences.
          </Text>
          <TouchableOpacity style={[s.addBtn, s.emptyAddBtn, { borderColor: colors.border }]} onPress={openForm}>
            <Feather name="plus" size={14} color={colors.primary} />
            <Text style={[s.addBtnText, { color: colors.primary }]}>Add a Note</Text>
          </TouchableOpacity>
        </View>
      )}

      {expanded && loaded && notes.length > 0 && (
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {notes.map((note) => {
            // createdBy is the authenticated user ID; userId is the tenant owner.
            const canDelete = isOwnerOrManager || note.createdBy === currentUserId;
            const isDeleting = deleting === note.id;
            let dateLabel = '';
            try { dateLabel = format(parseISO(note.createdAt), 'd MMM yyyy'); } catch {}

            return (
              <View key={note.id} style={[s.noteCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <View style={s.noteTop}>
                  <TeamAvatar name={note.createdByName ?? '?'} userId={note.userId} size={28} />
                  <View style={s.noteMeta}>
                    <Text style={[s.noteAuthor, { color: colors.foreground }]}>
                      {note.createdByName ?? 'Team member'}
                    </Text>
                    <Text style={[s.noteDate, { color: colors.mutedForeground }]}>{dateLabel}</Text>
                  </View>
                  {canDelete && (
                    isDeleting ? (
                      <ActivityIndicator size="small" color={colors.mutedForeground} />
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleDelete(note)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="trash-2" size={14} color={colors.destructive} style={{ opacity: 0.7 }} />
                      </TouchableOpacity>
                    )
                  )}
                </View>
                <Text style={[s.noteContent, { color: colors.foreground }]}>{note.content}</Text>
                {note.photoUrl && (
                  <Image
                    source={{ uri: note.photoUrl }}
                    style={s.notePhoto}
                    resizeMode="cover"
                  />
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Add note bottom sheet */}
      <AppBottomSheet
        visible={showForm}
        onDismiss={closeForm}
        title="Add Job Note"
        footer={
          <View style={s.footerRow}>
            <SheetButton variant="outline" label="Cancel" onPress={closeForm} style={{ flex: 1 }} />
            <SheetButton
              label="Save Note"
              onPress={handleSave}
              loading={saving}
              disabled={!noteText.trim() || saving}
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <View style={{ gap: spacing.lg, paddingTop: spacing.xs }}>
          <View>
            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Note</Text>
            <TextInput
              style={[
                s.textInput,
                {
                  color: colors.foreground,
                  borderColor: colors.cardBorder,
                  backgroundColor: colors.card,
                },
              ]}
              placeholder="Access codes, site quirks, client preferences..."
              placeholderTextColor={colors.mutedForeground}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              autoFocus
            />
          </View>
          {/* Photo attachment */}
          <View>
            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Photo (optional)</Text>
            {photoUri ? (
              <View style={s.photoPreviewRow}>
                <Image source={{ uri: photoUri }} style={s.photoPreview} resizeMode="cover" />
                <TouchableOpacity
                  style={[s.removePhotoBtn, { backgroundColor: colors.destructive }]}
                  onPress={() => setPhotoUri(null)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Feather name="x" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[s.attachPhotoBtn, { borderColor: colors.cardBorder, backgroundColor: colors.card }]}
                onPress={pickPhoto}
                activeOpacity={0.7}
              >
                <View style={[s.attachPhotoIconWrap, { backgroundColor: `${colors.primary}12` }]}>
                  <Feather name="camera" size={16} color={colors.primary} />
                </View>
                <Text style={[s.attachPhotoBtnText, { color: colors.foreground }]}>Attach a photo</Text>
                <Text style={[s.attachPhotoHint, { color: colors.mutedForeground }]}>From your photo library</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </AppBottomSheet>
    </View>
  );
}

function localStyles(colors: any) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    countBadge: {
      backgroundColor: `${colors.primary}20`,
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    countText: {
      fontSize: 11,
      fontWeight: fontWeights.bold,
      color: colors.primary,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: `${colors.primary}40`,
      backgroundColor: `${colors.primary}08`,
    },
    addBtnText: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.medium,
    },
    errorState: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    errorText: {
      fontSize: typography.sizes.sm,
      flex: 1,
    },
    retryBtn: {
      paddingHorizontal: spacing.sm,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      gap: spacing.sm,
    },
    emptyTitle: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.semibold,
    },
    emptySubtitle: {
      fontSize: typography.sizes.sm,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: spacing.md,
    },
    emptyAddBtn: {
      marginTop: spacing.xs,
    },
    noteCard: {
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.md,
      gap: spacing.sm,
    },
    noteTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    noteMeta: {
      flex: 1,
    },
    noteAuthor: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.semibold,
    },
    noteDate: {
      fontSize: typography.sizes.xs,
    },
    noteContent: {
      fontSize: typography.sizes.sm,
      lineHeight: 20,
    },
    notePhoto: {
      width: '100%',
      height: 180,
      borderRadius: radius.sm,
    },
    fieldLabel: {
      fontSize: 11,
      fontWeight: fontWeights.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: spacing.sm,
    },
    textInput: {
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      fontSize: typography.body.fontSize,
      lineHeight: 21,
      minHeight: 120,
    },
    attachPhotoBtn: {
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderRadius: radius.lg,
      borderStyle: 'dashed',
    },
    attachPhotoIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    attachPhotoBtnText: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.semibold,
    },
    attachPhotoHint: {
      fontSize: typography.sizes.xs,
    },
    photoPreviewRow: {
      position: 'relative',
    },
    photoPreview: {
      width: '100%',
      height: 160,
      borderRadius: radius.lg,
    },
    removePhotoBtn: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
  });
}
