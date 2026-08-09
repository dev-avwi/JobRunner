import { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppBottomSheet, BottomSheetScrollView } from './ui/AppBottomSheet';
import { useTheme, ThemeColors, colorWithOpacity } from '../lib/theme';
import { spacing, radius } from '../lib/design-tokens';
import { api } from '../lib/api';

type Job = {
  id: string;
  title?: string;
  address?: string;
  clientName?: string;
  status?: string;
};

function statusColor(colors: ThemeColors, status?: string): string {
  switch (status) {
    case 'done':
    case 'invoiced':
      return colors.success;
    case 'in_progress':
    case 'scheduled':
      return colors.info;
    case 'cancelled':
      return colors.mutedForeground;
    default:
      return colors.warning;
  }
}

function statusLabel(status?: string): string {
  if (!status) return 'Job';
  return status
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function JobLinkField({
  value,
  onChange,
  onJobSelected,
}: {
  value: string;
  onChange: (jobId: string) => void;
  onJobSelected?: (job: Job) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (open && !loaded) {
      setLoading(true);
      api
        .get<Job[]>('/api/jobs')
        .then(res => {
          if (cancelled) return;
          setJobs(Array.isArray(res.data) ? res.data : []);
          setLoaded(true);
        })
        .catch(() => {
          if (!cancelled) setJobs([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  const selectedJob = jobs.find(j => j.id === value);

  const activeJobs = jobs.filter(j => j.status !== 'cancelled');
  const filtered = activeJobs.filter(j => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      j.title?.toLowerCase().includes(q) ||
      j.address?.toLowerCase().includes(q) ||
      j.clientName?.toLowerCase().includes(q)
    );
  });

  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={styles.labelRow}>
        <Feather name="link" size={12} color={colors.mutedForeground} />
        <Text style={styles.label}>Link to Job</Text>
      </View>

      {value && selectedJob ? (
        <View style={styles.selectedCard}>
          <View style={[styles.iconWrap, { backgroundColor: colorWithOpacity(statusColor(colors, selectedJob.status), 0.15) }]}>
            <Feather name="briefcase" size={16} color={statusColor(colors, selectedJob.status)} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.selectedTitle} numberOfLines={1}>{selectedJob.title || 'Job'}</Text>
            {selectedJob.address ? (
              <Text style={styles.selectedMeta} numberOfLines={1}>{selectedJob.address}</Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => onChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x-circle" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      ) : value ? (
        <TouchableOpacity style={styles.linkButton} onPress={() => setOpen(true)} activeOpacity={0.7}>
          <Feather name="briefcase" size={16} color={colors.primary} />
          <Text style={styles.linkButtonText}>Linked job — tap to change</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.linkButton} onPress={() => setOpen(true)} activeOpacity={0.7}>
          <Feather name="briefcase" size={16} color={colors.primary} />
          <Text style={styles.linkButtonText}>Link this to a job</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}

      <AppBottomSheet visible={open} onDismiss={() => setOpen(false)} snapPoints={['80%']} scrollable={false} contentPadding={0}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Link to Job</Text>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search by title, address, or client"
              placeholderTextColor={colors.mutedForeground}
              autoCorrect={false}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ) : null}
          </View>

          {value ? (
            <TouchableOpacity
              style={styles.unlinkRow}
              onPress={() => { onChange(''); setOpen(false); }}
              activeOpacity={0.7}>
              <Feather name="x-circle" size={16} color={colors.destructive} />
              <Text style={styles.unlinkText}>Unlink current job</Text>
            </TouchableOpacity>
          ) : null}

          <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md }}>
            {loading ? (
              <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : filtered.length === 0 ? (
              <View style={{ paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.xs }}>
                <Feather name="briefcase" size={28} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>{search ? 'No jobs match your search' : 'No active jobs'}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.resultCount}>
                  {filtered.length} {search ? 'result' : 'active job'}{filtered.length === 1 ? '' : 's'}
                </Text>
                {filtered.slice(0, 30).map(job => (
                  <TouchableOpacity
                    key={job.id}
                    style={styles.jobRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      onChange(job.id);
                      onJobSelected?.(job);
                      setSearch('');
                      setOpen(false);
                    }}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor(colors, job.status) }]} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.jobTitle} numberOfLines={1}>{job.title || 'Untitled job'}</Text>
                      <Text style={styles.jobMeta} numberOfLines={1}>
                        {job.address ? job.address : ''}
                        {job.address && job.clientName ? '  ·  ' : ''}
                        {job.clientName ? job.clientName : ''}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: colorWithOpacity(statusColor(colors, job.status), 0.15) }]}>
                      <Text style={[styles.statusBadgeText, { color: statusColor(colors, job.status) }]}>{statusLabel(job.status)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </BottomSheetScrollView>
        </View>
      </AppBottomSheet>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: spacing.xs },
  label: { fontSize: 13, fontWeight: '500', color: colors.foreground },
  selectedCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.lg, padding: spacing.sm,
  },
  iconWrap: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  selectedTitle: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  selectedMeta: { fontSize: 12, color: colors.mutedForeground, marginTop: 1 },
  linkButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.md,
  },
  linkButtonText: { flex: 1, fontSize: 14, color: colors.foreground },
  sheet: { flex: 1, backgroundColor: colors.background },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: colors.foreground },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginHorizontal: spacing.md, marginTop: spacing.md,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.foreground, padding: 0, letterSpacing: 0, textAlign: 'left' },
  unlinkRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
  },
  unlinkText: { fontSize: 13, color: colors.destructive, fontWeight: '500' },
  resultCount: {
    fontSize: 11, fontWeight: '600', color: colors.mutedForeground,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm,
  },
  jobRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.sm + 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  jobTitle: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  jobMeta: { fontSize: 12, color: colors.mutedForeground, marginTop: 1 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  statusBadgeText: { fontSize: 10, fontWeight: '600' },
  emptyText: { fontSize: 14, color: colors.mutedForeground },
});
