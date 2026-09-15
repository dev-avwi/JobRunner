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
}

export function JobNotesSection({
  jobId,
  colors,
  styles: parentStyles,
  isOwnerOrManager,
  currentUserId,
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
      {/* Section header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={[s.iconWrap, { backgroundColor: `${colors.warning}18` }]}>
            <Feather name="file-text" size={iconSizes.lg} color={colors.warning} />
          </View>
          <Text style={s.headerTitle}>Job Notes</Text>
          {notes.length > 0 && (
            <View style={s.countBadge}>
              <Text style={s.countText}>{notes.length}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={s.addBtn} onPress={openForm}>
          <Feather name="plus" size={14} color={colors.primary} />
          <Text style={[s.addBtnText, { color: colors.primary }]}>Add Note</Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      {loadError && (
        <View style={s.errorState}>
          <Feather name="alert-circle" size={20} color={colors.destructive} />
          <Text style={[s.errorText, { color: colors.destructive }]}>Couldn't load notes</Text>
          <TouchableOpacity onPress={loadNotes} style={s.retryBtn}>
            <Text style={[s.addBtnText, { color: colors.primary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && <SkeletonSection rows={2} />}

      {loaded && notes.length === 0 && (
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

      {loaded && notes.length > 0 && (
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
            <TouchableOpacity
              style={[s.cancelBtn, { borderColor: colors.border }]}
              onPress={closeForm}
            >
              <Text style={[s.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: colors.primary, opacity: noteText.trim() ? 1 : 0.5 }]}
              onPress={handleSave}
              disabled={!noteText.trim() || saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.saveBtnText}>Save Note</Text>
              )}
            </TouchableOpacity>
          </View>
        }
      >
        <View style={{ padding: spacing.md, gap: spacing.md }}>
          <TextInput
            style={[
              s.textInput,
              {
                color: colors.foreground,
                borderColor: colors.border,
                backgroundColor: colors.input ?? colors.card,
              },
            ]}
            placeholder="Write a note for the team..."
            placeholderTextColor={colors.mutedForeground}
            value={noteText}
            onChangeText={setNoteText}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            autoFocus
          />
          {/* Photo attachment */}
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
              style={[s.attachPhotoBtn, { borderColor: colors.border }]}
              onPress={pickPhoto}
            >
              <Feather name="camera" size={14} color={colors.mutedForeground} />
              <Text style={[s.attachPhotoBtnText, { color: colors.mutedForeground }]}>Attach photo</Text>
            </TouchableOpacity>
          )}
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
    textInput: {
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
      fontSize: typography.sizes.sm,
      minHeight: 120,
    },
    attachPhotoBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderRadius: radius.md,
      borderStyle: 'dashed',
    },
    attachPhotoBtnText: {
      fontSize: typography.sizes.sm,
    },
    photoPreviewRow: {
      position: 'relative',
    },
    photoPreview: {
      width: '100%',
      height: 140,
      borderRadius: radius.md,
    },
    removePhotoBtn: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.md,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
    },
    cancelBtnText: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.medium,
    },
    saveBtn: {
      flex: 2,
      paddingVertical: spacing.md,
      alignItems: 'center',
      borderRadius: radius.md,
    },
    saveBtnText: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.semibold,
      color: '#fff',
    },
  });
}
