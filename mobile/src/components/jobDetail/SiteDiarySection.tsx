/**
 * SiteDiarySection — mobile component for the daily site diary.
 * Card stack sorted newest-first. A FAB-style button adds today's entry.
 * Entries older than 24 h are read-only unless the user is owner/manager.
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../lib/api';
import { showToast } from '../../lib/toast';
import { spacing, radius, typography, fontWeights, iconSizes } from '../../lib/design-tokens';
import { format, parseISO, differenceInHours } from 'date-fns';

const WEATHER_OPTIONS = [
  { value: 'sunny', label: 'Sunny', icon: 'sun' },
  { value: 'partly_cloudy', label: 'Partly Cloudy', icon: 'cloud' },
  { value: 'overcast', label: 'Overcast', icon: 'cloud' },
  { value: 'light_rain', label: 'Light Rain', icon: 'cloud-rain' },
  { value: 'heavy_rain', label: 'Heavy Rain', icon: 'cloud-rain' },
  { value: 'windy', label: 'Windy', icon: 'wind' },
  { value: 'storm', label: 'Storm', icon: 'cloud-lightning' },
  { value: 'hot', label: 'Hot', icon: 'thermometer' },
  { value: 'cold', label: 'Cold', icon: 'thermometer' },
  { value: 'foggy', label: 'Foggy', icon: 'cloud' },
] as const;

type WeatherValue = typeof WEATHER_OPTIONS[number]['value'];

interface SiteDiaryEntry {
  id: string;
  jobId: string;
  userId: string;
  entryDate: string;
  weather: string | null;
  workersOnSite: string[];
  workDone: string | null;
  issuesDelays: string | null;
  photoKeys: string[];
  photoUrls?: string[];
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

interface SiteDiarySectionProps {
  jobId: string;
  colors: any;
  styles: any;
  isOwnerOrManager: boolean;
  /** The authenticated user's own ID — used to gate edit/delete to the entry author. */
  currentUserId?: string;
}

interface FormState {
  entryDate: string;
  weather: WeatherValue | '';
  workersOnSite: string;
  workDone: string;
  issuesDelays: string;
}

function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function weatherLabel(w: string | null): string {
  if (!w) return '';
  return WEATHER_OPTIONS.find((o) => o.value === w)?.label ?? w;
}

function weatherIcon(w: string | null): string {
  if (!w) return 'cloud';
  return WEATHER_OPTIONS.find((o) => o.value === w)?.icon ?? 'cloud';
}

function isWithin24Hours(createdAt: string): boolean {
  return differenceInHours(new Date(), parseISO(createdAt)) < 24;
}

const EMPTY_FORM: FormState = {
  entryDate: todayISO(),
  weather: '',
  workersOnSite: '',
  workDone: '',
  issuesDelays: '',
};

export function SiteDiarySection({
  jobId,
  colors,
  styles: parentStyles,
  isOwnerOrManager,
  currentUserId,
}: SiteDiarySectionProps) {
  const [entries, setEntries] = useState<SiteDiaryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<SiteDiaryEntry | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showWeatherPicker, setShowWeatherPicker] = useState(false);
  const [newPhotos, setNewPhotos] = useState<{ uri: string; name: string; mimeType: string }[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await api.get<SiteDiaryEntry[]>(`/api/jobs/${jobId}/diary`);
      if (!res.error && Array.isArray(res.data)) {
        setEntries(res.data);
      }
      setLoaded(true);
    } catch {
      // silently ignore – section is optional
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [jobId, loading]);

  // Lazy-load on first expand
  const handleToggle = useCallback(
    (id: string) => {
      if (!loaded && !loading) loadEntries();
      setExpanded((prev) => (prev === id ? null : id));
    },
    [loaded, loading, loadEntries],
  );

  const handleSectionOpen = useCallback(() => {
    if (!loaded && !loading) loadEntries();
  }, [loaded, loading, loadEntries]);

  function openNew() {
    handleSectionOpen();
    setEditingEntry(null);
    setForm({ ...EMPTY_FORM, entryDate: todayISO() });
    setNewPhotos([]);
    setShowForm(true);
  }

  function openEdit(entry: SiteDiaryEntry) {
    setEditingEntry(entry);
    setForm({
      entryDate: entry.entryDate,
      weather: (entry.weather as WeatherValue) ?? '',
      workersOnSite: entry.workersOnSite.join(', '),
      workDone: entry.workDone ?? '',
      issuesDelays: entry.issuesDelays ?? '',
    });
    setNewPhotos([]);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingEntry(null);
    setForm(EMPTY_FORM);
    setNewPhotos([]);
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!result.canceled) {
      const picked = result.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? `photo_${Date.now()}.jpg`,
        mimeType: a.mimeType ?? 'image/jpeg',
      }));
      setNewPhotos((prev) => [...prev, ...picked]);
    }
  }

  async function handleSave() {
    if (!form.entryDate) return;
    setSaving(true);
    try {
      const workers = form.workersOnSite
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const formData = new FormData();
      formData.append('entryDate', form.entryDate);
      if (form.weather) formData.append('weather', form.weather);
      formData.append('workersOnSite', JSON.stringify(workers));
      if (form.workDone) formData.append('workDone', form.workDone);
      if (form.issuesDelays) formData.append('issuesDelays', form.issuesDelays);
      for (const photo of newPhotos) {
        formData.append('photos', { uri: photo.uri, name: photo.name, type: photo.mimeType } as any);
      }

      if (editingEntry) {
        // FormData is detected automatically by the API client (removes Content-Type so the
        // browser sets the correct multipart boundary).
        const res = await api.patch<SiteDiaryEntry>(`/api/jobs/${jobId}/diary/${editingEntry.id}`, formData);
        if (res.error) {
          showToast({ type: 'error', message: res.error });
          return;
        }
        setEntries((prev) => prev.map((e) => (e.id === editingEntry.id ? (res.data as SiteDiaryEntry) : e)));
        showToast({ type: 'success', message: 'Diary entry updated' });
      } else {
        const res = await api.post<SiteDiaryEntry>(`/api/jobs/${jobId}/diary`, formData);
        if (res.error) {
          showToast({ type: 'error', message: res.error });
          return;
        }
        setEntries((prev) => [res.data as SiteDiaryEntry, ...prev]);
        showToast({ type: 'success', message: 'Diary entry saved' });
      }
      closeForm();
    } catch (err: any) {
      showToast({ type: 'error', message: err?.message ?? 'Failed to save entry' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await api.delete(`/api/jobs/${jobId}/diary/${id}`);
      if (res.error) {
        showToast({ type: 'error', message: res.error });
        return;
      }
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (expanded === id) setExpanded(null);
      showToast({ type: 'success', message: 'Entry deleted' });
    } catch {
      showToast({ type: 'error', message: 'Failed to delete entry' });
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
          <View style={[s.iconWrap, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name="book-open" size={iconSizes.lg} color={colors.primary} />
          </View>
          <Text style={s.headerTitle}>Site Diary</Text>
          {entries.length > 0 && (
            <View style={s.countBadge}>
              <Text style={s.countText}>{entries.length}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={s.addBtn} onPress={openNew}>
          <Feather name="plus" size={14} color={colors.primary} />
          <Text style={[s.addBtnText, { color: colors.primary }]}>Add Entry</Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      {!loaded && !loading && (
        <TouchableOpacity onPress={handleSectionOpen} style={s.loadPrompt}>
          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
          <Text style={s.loadPromptText}>Tap to load diary</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <ActivityIndicator
          size="small"
          color={colors.primary}
          style={{ paddingVertical: spacing.lg }}
        />
      )}

      {loaded && entries.length === 0 && (
        <View style={s.emptyState}>
          <Feather name="book-open" size={28} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
          <Text style={s.emptyTitle}>No diary entries yet</Text>
          <Text style={s.emptySubtitle}>
            Record who was on site, what was done, and any issues each day.
          </Text>
          <TouchableOpacity style={[s.addBtn, s.emptyAddBtn, { borderColor: colors.border }]} onPress={openNew}>
            <Feather name="plus" size={14} color={colors.primary} />
            <Text style={[s.addBtnText, { color: colors.primary }]}>Add Today's Entry</Text>
          </TouchableOpacity>
        </View>
      )}

      {loaded && entries.length > 0 && (
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {entries.map((entry) => {
            const isExpanded = expanded === entry.id;
            // Owner/manager can edit any entry; staff can only edit their own within 24 h.
            const canEdit = isOwnerOrManager || (entry.userId === currentUserId && isWithin24Hours(entry.createdAt));
            // Same logic for delete (staff author within 24 h, or owner/manager).
            const canDelete = isOwnerOrManager || (entry.userId === currentUserId && isWithin24Hours(entry.createdAt));
            const isLocked = !canEdit;

            return (
              <View key={entry.id} style={s.entryCard}>
                {/* Tap header to expand */}
                <TouchableOpacity
                  style={s.entryHeader}
                  onPress={() => handleToggle(entry.id)}
                  activeOpacity={0.7}
                >
                  <View style={s.entryHeaderLeft}>
                    <Feather
                      name={weatherIcon(entry.weather) as any}
                      size={14}
                      color={colors.mutedForeground}
                    />
                    <Text style={s.entryDate}>
                      {format(parseISO(entry.entryDate), 'EEE d MMM yyyy')}
                    </Text>
                    {entry.weather && (
                      <View style={s.weatherBadge}>
                        <Text style={s.weatherBadgeText}>{weatherLabel(entry.weather)}</Text>
                      </View>
                    )}
                    {isLocked && (
                      <Feather name="lock" size={11} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    {entry.workersOnSite.length > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Feather name="users" size={11} color={colors.mutedForeground} />
                        <Text style={s.workerCount}>{entry.workersOnSite.length}</Text>
                      </View>
                    )}
                    <Feather
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={colors.mutedForeground}
                    />
                  </View>
                </TouchableOpacity>

                {/* Expanded body */}
                {isExpanded && (
                  <View style={s.entryBody}>
                    {entry.workersOnSite.length > 0 && (
                      <View style={s.field}>
                        <Text style={s.fieldLabel}>
                          <Feather name="users" size={11} /> Workers on site
                        </Text>
                        <Text style={s.fieldValue}>{entry.workersOnSite.join(', ')}</Text>
                      </View>
                    )}
                    {entry.workDone && (
                      <View style={s.field}>
                        <Text style={s.fieldLabel}>Work done</Text>
                        <Text style={s.fieldValue}>{entry.workDone}</Text>
                      </View>
                    )}
                    {entry.issuesDelays && (
                      <View style={s.field}>
                        <Text style={s.fieldLabel}>
                          ⚠️ Issues / delays
                        </Text>
                        <Text style={[s.fieldValue, { color: colors.warning ?? '#B45309' }]}>
                          {entry.issuesDelays}
                        </Text>
                      </View>
                    )}
                    {entry.photoUrls && entry.photoUrls.length > 0 && (
                      <View style={s.field}>
                        <Text style={s.fieldLabel}>Photos ({entry.photoUrls.length})</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                            {entry.photoUrls.map((url, i) => (
                              <Image
                                key={i}
                                source={{ uri: url }}
                                style={s.photo}
                              />
                            ))}
                          </View>
                        </ScrollView>
                      </View>
                    )}
                    <Text style={s.authorLine}>
                      Added by {entry.authorName ?? 'staff'} ·{' '}
                      {format(parseISO(entry.createdAt), 'd MMM yyyy h:mm a')}
                    </Text>
                    {(canEdit || canDelete) && (
                      <View style={s.entryActions}>
                        {canEdit && (
                          <TouchableOpacity
                            style={[s.actionBtn, { borderColor: colors.border }]}
                            onPress={() => openEdit(entry)}
                          >
                            <Feather name="edit-2" size={13} color={colors.foreground} />
                            <Text style={[s.actionBtnText, { color: colors.foreground }]}>Edit</Text>
                          </TouchableOpacity>
                        )}
                        {canDelete && (
                          <TouchableOpacity
                            style={[s.actionBtn, { borderColor: colors.border }]}
                            onPress={() => handleDelete(entry.id)}
                            disabled={deleting === entry.id}
                          >
                            {deleting === entry.id ? (
                              <ActivityIndicator size="small" color={colors.destructive} />
                            ) : (
                              <>
                                <Feather name="trash-2" size={13} color={colors.destructive} />
                                <Text style={[s.actionBtnText, { color: colors.destructive }]}>Delete</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Add / Edit Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: colors.background }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Modal header */}
          <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={closeForm} disabled={saving}>
              <Text style={[s.modalCancel, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>
              {editingEntry ? 'Edit Entry' : 'New Diary Entry'}
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !form.entryDate}
              style={[s.modalSave, { backgroundColor: colors.primary }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.modalSaveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Date */}
            <View>
              <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>Date</Text>
              <TextInput
                style={[s.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                value={form.entryDate}
                onChangeText={(v) => setForm((f) => ({ ...f, entryDate: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.mutedForeground}
                editable={!editingEntry}
              />
            </View>

            {/* Weather */}
            <View>
              <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>Weather</Text>
              <TouchableOpacity
                style={[s.textInput, { borderColor: colors.border, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => setShowWeatherPicker(true)}
              >
                <Text style={{ color: form.weather ? colors.foreground : colors.mutedForeground }}>
                  {form.weather ? weatherLabel(form.weather) : 'Select weather…'}
                </Text>
                <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Workers */}
            <View>
              <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>Workers on site</Text>
              <TextInput
                style={[s.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                value={form.workersOnSite}
                onChangeText={(v) => setForm((f) => ({ ...f, workersOnSite: v }))}
                placeholder="e.g. John Smith, Maria Garcia"
                placeholderTextColor={colors.mutedForeground}
              />
              <Text style={[s.hint, { color: colors.mutedForeground }]}>Separate names with commas</Text>
            </View>

            {/* Work done */}
            <View>
              <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>Summary of work done</Text>
              <TextInput
                style={[s.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                value={form.workDone}
                onChangeText={(v) => setForm((f) => ({ ...f, workDone: v }))}
                placeholder="What was completed today?"
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Issues */}
            <View>
              <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>Issues / delays</Text>
              <TextInput
                style={[s.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                value={form.issuesDelays}
                onChangeText={(v) => setForm((f) => ({ ...f, issuesDelays: v }))}
                placeholder="Any problems, delays, or incidents?"
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Photos */}
            <View>
              <Text style={[s.inputLabel, { color: colors.mutedForeground }]}>Photos</Text>
              <TouchableOpacity
                style={[s.photoPickBtn, { borderColor: colors.border }]}
                onPress={pickPhoto}
              >
                <Feather name="camera" size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: typography.button.fontSize }}>Attach photos</Text>
              </TouchableOpacity>
              {newPhotos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {newPhotos.map((p, i) => (
                      <View key={i} style={{ position: 'relative' }}>
                        <Image source={{ uri: p.uri }} style={s.photo} />
                        <TouchableOpacity
                          style={s.removePhoto}
                          onPress={() => setNewPhotos((prev) => prev.filter((_, j) => j !== i))}
                        >
                          <Feather name="x" size={10} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
          </ScrollView>

          {/* Weather picker modal */}
          <Modal visible={showWeatherPicker} transparent animationType="slide">
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
              onPress={() => setShowWeatherPicker(false)}
            />
            <View style={[s.weatherSheet, { backgroundColor: colors.card }]}>
              <Text style={[s.weatherSheetTitle, { color: colors.foreground }]}>Select Weather</Text>
              {WEATHER_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[s.weatherOption, form.weather === opt.value && { backgroundColor: `${colors.primary}15` }]}
                  onPress={() => {
                    setForm((f) => ({ ...f, weather: opt.value }));
                    setShowWeatherPicker(false);
                  }}
                >
                  <Feather name={opt.icon as any} size={16} color={colors.foreground} />
                  <Text style={{ color: colors.foreground, fontSize: typography.sizes.sm }}>{opt.label}</Text>
                  {form.weather === opt.value && (
                    <Feather name="check" size={14} color={colors.primary} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Modal>
        </KeyboardAvoidingView>
      </Modal>
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
      fontSize: typography.subtitle.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    countBadge: {
      backgroundColor: colors.muted,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    countText: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
      fontWeight: fontWeights.medium,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: `${colors.primary}40`,
    },
    addBtnText: {
      fontSize: typography.captionSmall.fontSize,
      fontWeight: fontWeights.medium,
    },
    loadPrompt: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
    },
    loadPromptText: {
      fontSize: typography.sizes.sm,
      color: colors.mutedForeground,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      gap: spacing.sm,
    },
    emptyTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.medium,
      color: colors.mutedForeground,
    },
    emptySubtitle: {
      fontSize: typography.sizes.xs,
      color: colors.mutedForeground,
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
    },
    emptyAddBtn: {
      marginTop: spacing.sm,
      backgroundColor: 'transparent',
    },
    entryCard: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder ?? colors.border,
      overflow: 'hidden',
    },
    entryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    entryHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flex: 1,
    },
    entryDate: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
    },
    weatherBadge: {
      backgroundColor: colors.muted,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
    },
    weatherBadgeText: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
    },
    workerCount: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
    },
    entryBody: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: `${colors.muted}40`,
      gap: spacing.sm,
    },
    field: {
      gap: spacing.xxs ?? 3,
      marginTop: spacing.sm,
    },
    fieldLabel: {
      fontSize: typography.captionSmall.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    fieldValue: {
      fontSize: typography.sizes.sm,
      color: colors.foreground,
      lineHeight: 20,
    },
    photo: {
      width: 80,
      height: 80,
      borderRadius: radius.sm,
    },
    authorLine: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
      marginTop: spacing.xs,
      opacity: 0.7,
    },
    entryActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      borderWidth: 1,
    },
    actionBtnText: {
      fontSize: typography.captionSmall.fontSize,
      fontWeight: fontWeights.medium,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      borderBottomWidth: 1,
    },
    modalCancel: {
      fontSize: typography.sizes.sm,
    },
    modalTitle: {
      fontSize: typography.subtitle.fontSize,
      fontWeight: fontWeights.semibold,
    },
    modalSave: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.md,
      minWidth: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalSaveText: {
      color: '#fff',
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.semibold,
    },
    inputLabel: {
      fontSize: typography.captionSmall.fontSize,
      fontWeight: fontWeights.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      marginBottom: spacing.xs,
    },
    textInput: {
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.sizes.sm,
      minHeight: 40,
    },
    textArea: {
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.sizes.sm,
      minHeight: 80,
    },
    hint: {
      fontSize: typography.captionSmall.fontSize,
      marginTop: spacing.xxs ?? 3,
    },
    photoPickBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    removePhoto: {
      position: 'absolute',
      top: 2,
      right: 2,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 8,
      padding: 2,
    },
    weatherSheet: {
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    },
    weatherSheetTitle: {
      fontSize: typography.subtitle.fontSize,
      fontWeight: fontWeights.semibold,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    weatherOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
    },
  });
}
