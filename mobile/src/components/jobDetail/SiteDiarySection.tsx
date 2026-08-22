/**
 * SiteDiarySection — mobile component for the daily site diary.
 * Card stack sorted newest-first. A FAB-style button adds today's entry.
 * Entries older than 24 h are read-only unless the user is owner/manager.
 *
 * Polish additions:
 *  - Date filter input at section header to jump to a specific entry
 *  - Inline photo thumbnail grid (up to 4) on each diary card header
 *  - Full-screen photo viewer on thumbnail tap
 *  - Weather icon glyph shown inline alongside the text label
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
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import { AppBottomSheet } from '../ui/AppBottomSheet';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api from '../../lib/api';
import { showToast } from '../../lib/toast';
import { useConfirmDialog } from '../ui/ConfirmDialog';
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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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

  // Month chip filter — value is "yyyy-MM" string or '' for All
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loadError, setLoadError] = useState(false);
  const confirm = useConfirmDialog();

  // Full-screen photo viewer
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [showViewer, setShowViewer] = useState(false);

  const openViewer = useCallback((photos: string[], index: number) => {
    setViewerPhotos(photos);
    setViewerIndex(index);
    setShowViewer(true);
  }, []);

  const loadEntries = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<SiteDiaryEntry[]>(`/api/jobs/${jobId}/diary`);
      if (!res.error && Array.isArray(res.data)) {
        setEntries(res.data);
        setLoaded(true);
      } else {
        setLoadError(true);
        setLoaded(false);
      }
    } catch {
      setLoadError(true);
      setLoaded(false);
    } finally {
      setLoading(false);
    }
  }, [jobId, loading]);

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
        const res = await api.patch<SiteDiaryEntry>(`/api/jobs/${jobId}/diary/${editingEntry.id}`, formData);
        if (res.error) { showToast({ type: 'error', message: res.error }); return; }
        setEntries((prev) => prev.map((e) => (e.id === editingEntry.id ? (res.data as SiteDiaryEntry) : e)));
        showToast({ type: 'success', message: 'Diary entry updated' });
      } else {
        const res = await api.post<SiteDiaryEntry>(`/api/jobs/${jobId}/diary`, formData);
        if (res.error) { showToast({ type: 'error', message: res.error }); return; }
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

  async function handleDelete(id: string, entryDate: string) {
    const label = entryDate
      ? (() => { try { return format(parseISO(entryDate), 'd MMM yyyy'); } catch { return entryDate; } })()
      : 'this entry';
    const ok = await confirm({
      title: 'Delete Diary Entry',
      message: `Delete the diary entry for ${label}? This cannot be undone.`,
      confirmText: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setDeleting(id);
    try {
      const res = await api.delete(`/api/jobs/${jobId}/diary/${id}`);
      if (res.error) { showToast({ type: 'error', message: res.error }); return; }
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (expanded === id) setExpanded(null);
      showToast({ type: 'success', message: 'Entry deleted' });
    } catch {
      showToast({ type: 'error', message: 'Failed to delete entry' });
    } finally {
      setDeleting(null);
    }
  }

  // Derive sorted unique months (yyyy-MM) from loaded entries
  const availableMonths = (() => {
    const seen = new Set<string>();
    for (const e of entries) {
      const m = e.entryDate.slice(0, 7); // "yyyy-MM"
      seen.add(m);
    }
    return Array.from(seen).sort();
  })();

  // Filter entries by selected month chip
  const filteredEntries = selectedMonth
    ? entries.filter((e) => e.entryDate.startsWith(selectedMonth))
    : entries;

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

      {/* Month chip filter — shown when there are multiple months, or while a month is actively selected
          (keeping the bar visible lets the user always tap "All" to escape a now-empty filter) */}
      {loaded && (availableMonths.length > 1 || selectedMonth !== '') && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.chipScroll}
          contentContainerStyle={s.chipScrollContent}
        >
          {/* "All" chip */}
          <TouchableOpacity
            style={[s.chip, !selectedMonth && s.chipActive, !selectedMonth && { borderColor: colors.primary, backgroundColor: `${colors.primary}15` }]}
            onPress={() => setSelectedMonth('')}
            activeOpacity={0.7}
          >
            <Text style={[s.chipText, { color: !selectedMonth ? colors.primary : colors.mutedForeground }, !selectedMonth && s.chipTextActive]}>
              All
            </Text>
          </TouchableOpacity>

          {availableMonths.map((month) => {
            const isActive = selectedMonth === month;
            let label = month;
            try { label = format(parseISO(month + '-01'), 'MMM yyyy'); } catch {}
            return (
              <TouchableOpacity
                key={month}
                style={[s.chip, isActive && s.chipActive, isActive && { borderColor: colors.primary, backgroundColor: `${colors.primary}15` }]}
                onPress={() => setSelectedMonth((prev) => (prev === month ? '' : month))}
                activeOpacity={0.7}
              >
                <Text style={[s.chipText, { color: isActive ? colors.primary : colors.mutedForeground }, isActive && s.chipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Body */}
      {loadError && (
        <View style={s.errorState}>
          <Feather name="alert-circle" size={20} color={colors.destructive} />
          <Text style={s.errorText}>Couldn't load diary entries</Text>
          <TouchableOpacity onPress={() => loadEntries()} style={s.retryBtn}>
            <Text style={[s.addBtnText, { color: colors.primary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loaded && !loading && !loadError && (
        <TouchableOpacity onPress={handleSectionOpen} style={s.loadPrompt}>
          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
          <Text style={s.loadPromptText}>Tap to load diary</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: spacing.lg }} />
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

      {loaded && filteredEntries.length === 0 && entries.length > 0 && (
        <View style={s.emptyState}>
          <Text style={s.emptySubtitle}>
            {selectedMonth
              ? (() => { try { return `No entries for ${format(parseISO(selectedMonth + '-01'), 'MMMM yyyy')}`; } catch { return 'No entries for this month'; } })()
              : 'No entries found'}
          </Text>
        </View>
      )}

      {loaded && filteredEntries.length > 0 && (
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {filteredEntries.map((entry) => {
            const isExpanded = expanded === entry.id;
            const canEdit = isOwnerOrManager || (entry.userId === currentUserId && isWithin24Hours(entry.createdAt));
            const canDelete = isOwnerOrManager || (entry.userId === currentUserId && isWithin24Hours(entry.createdAt));
            const isLocked = !canEdit;
            const previewPhotos = (entry.photoUrls ?? []).slice(0, 4);
            const extraPhotoCount = (entry.photoUrls?.length ?? 0) - 4;

            return (
              <View key={entry.id} style={s.entryCard}>
                {/* Tap header to expand */}
                <TouchableOpacity
                  style={s.entryHeader}
                  onPress={() => handleToggle(entry.id)}
                  activeOpacity={0.7}
                >
                  <View style={s.entryHeaderLeft}>
                    {/* Weather icon + label */}
                    {entry.weather ? (
                      <View style={s.weatherInline}>
                        <Feather
                          name={weatherIcon(entry.weather) as any}
                          size={13}
                          color={colors.mutedForeground}
                        />
                        <Text style={s.weatherInlineText}>{weatherLabel(entry.weather)}</Text>
                      </View>
                    ) : (
                      <Feather name="cloud" size={13} color={colors.mutedForeground} style={{ opacity: 0.3 }} />
                    )}
                    <Text style={s.entryDate}>
                      {format(parseISO(entry.entryDate), 'EEE d MMM yyyy')}
                    </Text>
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
                    {previewPhotos.length > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <Feather name="image" size={11} color={colors.mutedForeground} />
                        <Text style={s.workerCount}>{entry.photoUrls?.length}</Text>
                      </View>
                    )}
                    <Feather
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={colors.mutedForeground}
                    />
                  </View>
                </TouchableOpacity>

                {/* Inline photo thumbnail strip — shown on collapsed card when photos exist */}
                {!isExpanded && previewPhotos.length > 0 && (
                  <View style={s.thumbStrip}>
                    {previewPhotos.map((url, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => openViewer(entry.photoUrls ?? [], i)}
                        activeOpacity={0.85}
                      >
                        <Image source={{ uri: url }} style={s.thumbImg} />
                        {/* Overlay showing extra count on last visible thumb */}
                        {i === 3 && extraPhotoCount > 0 && (
                          <View style={s.thumbOverlay}>
                            <Text style={s.thumbOverlayText}>+{extraPhotoCount}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

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
                        <View style={s.photoGrid}>
                          {entry.photoUrls.map((url, i) => (
                            <TouchableOpacity
                              key={i}
                              onPress={() => openViewer(entry.photoUrls ?? [], i)}
                              activeOpacity={0.85}
                            >
                              <Image source={{ uri: url }} style={s.photoGridImg} />
                              {i === 3 && entry.photoUrls!.length > 4 && (
                                <View style={s.thumbOverlay}>
                                  <Text style={s.thumbOverlayText}>+{entry.photoUrls!.length - 4}</Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          ))}
                        </View>
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
                            onPress={() => handleDelete(entry.id, entry.entryDate)}
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

      {/* Add / Edit Sheet */}
      <AppBottomSheet
        visible={showForm}
        title={editingEntry ? 'Edit Diary Entry' : 'New Diary Entry'}
        showCloseButton
        onDismiss={closeForm}
        autoHeight
        footer={
          <TouchableOpacity
            style={[s.submitBtn, { backgroundColor: colors.primary, opacity: saving || !form.entryDate ? 0.5 : 1 }]}
            onPress={handleSave}
            disabled={saving || !form.entryDate}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.submitBtnText}>{editingEntry ? 'Save Changes' : 'Save Entry'}</Text>
            )}
          </TouchableOpacity>
        }
      >
        <View style={{ gap: spacing.md }}>
          {/* Date */}
          <View style={s.field}>
            <Text style={[s.label, { color: colors.foreground }]}>Date</Text>
            <TextInput
              style={[s.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
              value={form.entryDate}
              onChangeText={(v) => setForm((f) => ({ ...f, entryDate: v }))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.mutedForeground}
              editable={!editingEntry}
            />
          </View>

          {/* Weather — inline picker (no nested Modal) */}
          <View style={s.field}>
            <Text style={[s.label, { color: colors.foreground }]}>Weather (optional)</Text>
            <TouchableOpacity
              style={[s.textInput, { borderColor: showWeatherPicker ? colors.primary : colors.border, backgroundColor: colors.muted, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
              onPress={() => setShowWeatherPicker((v) => !v)}
              activeOpacity={0.7}
            >
              {form.weather ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Feather name={weatherIcon(form.weather) as any} size={15} color={colors.foreground} />
                  <Text style={{ color: colors.foreground }}>{weatherLabel(form.weather)}</Text>
                </View>
              ) : (
                <Text style={{ color: colors.mutedForeground }}>Select weather…</Text>
              )}
              <Feather
                name={showWeatherPicker ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
            {showWeatherPicker && (
              <View style={{ marginTop: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                {WEATHER_OPTIONS.map((opt, idx) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, backgroundColor: form.weather === opt.value ? `${colors.primary}15` : colors.muted },
                      idx < WEATHER_OPTIONS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                    ]}
                    onPress={() => {
                      setForm((f) => ({ ...f, weather: opt.value }));
                      setShowWeatherPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Feather name={opt.icon as any} size={16} color={form.weather === opt.value ? colors.primary : colors.foreground} />
                    <Text style={{ flex: 1, fontSize: typography.sizes.sm, color: form.weather === opt.value ? colors.primary : colors.foreground, fontWeight: form.weather === opt.value ? '600' : '400' }}>{opt.label}</Text>
                    {form.weather === opt.value && (
                      <Feather name="check" size={14} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Workers */}
          <View style={s.field}>
            <Text style={[s.label, { color: colors.foreground }]}>Workers on site (optional)</Text>
            <TextInput
              style={[s.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
              value={form.workersOnSite}
              onChangeText={(v) => setForm((f) => ({ ...f, workersOnSite: v }))}
              placeholder="e.g. John Smith, Maria Garcia"
              placeholderTextColor={colors.mutedForeground}
            />
            <Text style={[s.hint, { color: colors.mutedForeground }]}>Separate names with commas</Text>
          </View>

          {/* Work done */}
          <View style={s.field}>
            <Text style={[s.label, { color: colors.foreground }]}>Summary of work done (optional)</Text>
            <TextInput
              style={[s.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
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
          <View style={s.field}>
            <Text style={[s.label, { color: colors.foreground }]}>Issues / delays (optional)</Text>
            <TextInput
              style={[s.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
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
          <View style={s.field}>
            <Text style={[s.label, { color: colors.foreground }]}>Photos (optional)</Text>
            <TouchableOpacity
              style={[s.photoPickBtn, { borderColor: colors.border, backgroundColor: colors.muted }]}
              onPress={pickPhoto}
            >
              <Feather name="camera" size={20} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: typography.button.fontSize }}>Attach photos</Text>
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
        </View>
      </AppBottomSheet>


      {/* Full-screen photo viewer */}
      <Modal
        visible={showViewer}
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={() => setShowViewer(false)}
      >
        <View style={s.viewerContainer}>
          <TouchableOpacity
            style={s.viewerClose}
            onPress={() => setShowViewer(false)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="x" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={s.viewerCounter}>
            {viewerIndex + 1} / {viewerPhotos.length}
          </Text>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
              setViewerIndex(idx);
            }}
            contentOffset={{ x: viewerIndex * SCREEN_W, y: 0 }}
          >
            {viewerPhotos.map((url, i) => (
              <View key={i} style={{ width: SCREEN_W, height: SCREEN_H, justifyContent: 'center', alignItems: 'center' }}>
                <Image
                  source={{ uri: url }}
                  style={{ width: SCREEN_W, height: SCREEN_H }}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>
        </View>
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
    chipScroll: {
      marginBottom: spacing.sm,
    },
    chipScrollContent: {
      flexDirection: 'row',
      gap: spacing.xs,
      paddingHorizontal: 0,
      paddingVertical: 2,
    },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs,
      backgroundColor: colors.card,
    },
    chipActive: {
      // border/bg overridden inline with colors.primary
    },
    chipText: {
      fontSize: typography.captionSmall.fontSize,
      fontWeight: fontWeights.medium,
    },
    chipTextActive: {
      fontWeight: fontWeights.semibold,
    },
    errorState: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    errorText: {
      fontSize: typography.sizes.sm,
      color: colors.mutedForeground,
      flex: 1,
    },
    retryBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    loadPrompt: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
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
    weatherInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.muted,
      borderRadius: radius.sm,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    weatherInlineText: {
      fontSize: 10,
      color: colors.mutedForeground,
      fontWeight: fontWeights.medium,
    },
    entryDate: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
    },
    workerCount: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
    },
    thumbStrip: {
      flexDirection: 'row',
      gap: 3,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    thumbImg: {
      width: 52,
      height: 52,
      borderRadius: radius.sm,
    },
    thumbOverlay: {
      position: 'absolute',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbOverlayText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: fontWeights.bold,
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
      gap: spacing.xs,
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
    photoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    photoGridImg: {
      width: 80,
      height: 80,
      borderRadius: radius.sm,
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
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
    },
    modalTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: fontWeights.bold,
    },
    modalFooter: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
    },
    submitBtn: {
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    submitBtnText: {
      color: '#fff',
      fontWeight: fontWeights.semibold,
      fontSize: typography.button.fontSize,
    },
    label: {
      fontSize: typography.caption.fontSize,
      fontWeight: fontWeights.semibold,
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
      marginTop: 2,
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
    // Viewer
    viewerContainer: {
      flex: 1,
      backgroundColor: '#000',
    },
    viewerClose: {
      position: 'absolute',
      top: 54,
      right: 20,
      zIndex: 10,
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 20,
      padding: 8,
    },
    viewerCounter: {
      position: 'absolute',
      top: 56,
      alignSelf: 'center',
      zIndex: 10,
      color: '#fff',
      fontSize: 13,
      fontWeight: fontWeights.semibold,
      backgroundColor: 'rgba(0,0,0,0.4)',
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
  });
}
