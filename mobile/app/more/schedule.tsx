import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import {
  spacing, radius, typography, shadows, fontWeights, iconSizes,
} from '../../src/lib/design-tokens';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import api from '../../src/lib/api';
import {
  format, startOfWeek, addWeeks, subWeeks, addDays, isSameDay, isToday, parseISO,
} from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Job {
  id: string;
  title: string;
  status: string;
  scheduledAt?: string | null;
  clientName?: string;
  clientId?: string;
  address?: string;
  estimatedDuration?: number;
  jobType?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(iso?: string | null): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'h:mm a');
  } catch {
    return '';
  }
}

function formatDuration(mins?: number): string {
  if (!mins || mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getStatusColor(status: string, colors: ThemeColors): string {
  switch (status) {
    case 'in_progress': return colors.warning;
    case 'done': return colors.success;
    case 'invoiced': return (colors as any).info || colors.primary;
    case 'scheduled': return colors.primary;
    case 'pending': return colors.mutedForeground;
    default: return colors.mutedForeground;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'in_progress': return 'In Progress';
    case 'done': return 'Done';
    case 'invoiced': return 'Invoiced';
    case 'scheduled': return 'Scheduled';
    case 'pending': return 'Pending';
    default: return status;
  }
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ScheduleScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [selectedDate, setSelectedDate] = useState(new Date());

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const loadJobs = useCallback(async () => {
    try {
      const res = await api.get<Job[]>('/api/jobs');
      if (res.data && Array.isArray(res.data)) {
        setJobs(res.data);
      }
    } catch {
      // keep existing list on error
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadJobs(); }, [loadJobs]));
  useEffect(() => { loadJobs(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadJobs();
  }, [loadJobs]);

  // Jobs for the selected day, sorted by time
  const dayJobs = useMemo(() => {
    return jobs
      .filter(j => {
        if (!j.scheduledAt) return false;
        try {
          return isSameDay(parseISO(j.scheduledAt), selectedDate);
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        if (!a.scheduledAt) return 1;
        if (!b.scheduledAt) return -1;
        return a.scheduledAt.localeCompare(b.scheduledAt);
      });
  }, [jobs, selectedDate]);

  // Unscheduled jobs (no scheduledAt)
  const unscheduledJobs = useMemo(
    () => jobs.filter(j => !j.scheduledAt && j.status !== 'done' && j.status !== 'invoiced'),
    [jobs],
  );

  // Dot indicators per day (has any job scheduled)
  const dayHasJobs = useCallback(
    (day: Date) => jobs.some(j => {
      if (!j.scheduledAt) return false;
      try { return isSameDay(parseISO(j.scheduledAt), day); } catch { return false; }
    }),
    [jobs],
  );

  const goToPrevWeek = () => {
    const prev = subWeeks(weekStart, 1);
    setWeekStart(prev);
    setSelectedDate(addDays(prev, selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1));
  };

  const goToNextWeek = () => {
    const next = addWeeks(weekStart, 1);
    setWeekStart(next);
    setSelectedDate(addDays(next, selectedDate.getDay() === 0 ? 6 : selectedDate.getDay() - 1));
  };

  const goToToday = () => {
    const today = new Date();
    setWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
    setSelectedDate(today);
  };

  const renderJobCard = (job: Job) => {
    const statusColor = getStatusColor(job.status, colors);
    const time = formatTime(job.scheduledAt);
    const duration = formatDuration(job.estimatedDuration);
    return (
      <TouchableOpacity
        key={job.id}
        style={styles.jobCard}
        onPress={() => router.push(`/job/${job.id}` as any)}
        activeOpacity={0.8}
      >
        <View style={[styles.jobCardAccent, { backgroundColor: statusColor }]} />
        <View style={styles.jobCardContent}>
          <View style={styles.jobCardHeader}>
            <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {getStatusLabel(job.status)}
              </Text>
            </View>
          </View>
          {job.clientName ? (
            <View style={styles.jobMeta}>
              <Feather name="user" size={11} color={colors.mutedForeground} />
              <Text style={styles.jobMetaText} numberOfLines={1}>{job.clientName}</Text>
            </View>
          ) : null}
          {job.address ? (
            <View style={styles.jobMeta}>
              <Feather name="map-pin" size={11} color={colors.mutedForeground} />
              <Text style={styles.jobMetaText} numberOfLines={1}>{job.address}</Text>
            </View>
          ) : null}
          {(time || duration) ? (
            <View style={styles.jobMeta}>
              <Feather name="clock" size={11} color={colors.mutedForeground} />
              <Text style={styles.jobMetaText}>
                {[time, duration].filter(Boolean).join('  ·  ')}
              </Text>
            </View>
          ) : null}
        </View>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
    );
  };

  const selectedDayLabel = isToday(selectedDate)
    ? 'Today'
    : format(selectedDate, 'EEEE d MMMM');

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.pageTitle}>Schedule</Text>
            <Text style={styles.pageSubtitle}>{format(new Date(), 'MMMM yyyy')}</Text>
          </View>
          <TouchableOpacity onPress={goToToday} style={styles.todayBtn} activeOpacity={0.8}>
            <Feather name="calendar" size={13} color={colors.primary} />
            <Text style={styles.todayBtnText}>Today</Text>
          </TouchableOpacity>
        </View>

        {/* ── Week navigation ── */}
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={goToPrevWeek} style={styles.weekNavBtn} activeOpacity={0.7}>
            <Feather name="chevron-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.weekLabel}>
            {format(weekStart, 'd MMM')} – {format(addDays(weekStart, 6), 'd MMM')}
          </Text>
          <TouchableOpacity onPress={goToNextWeek} style={styles.weekNavBtn} activeOpacity={0.7}>
            <Feather name="chevron-right" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        {/* ── Day strip ── */}
        <View style={styles.dayStrip}>
          {weekDays.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const today = isToday(day);
            const hasDot = dayHasJobs(day);
            return (
              <TouchableOpacity
                key={day.toISOString()}
                style={[styles.dayItem, isSelected && styles.dayItemActive]}
                onPress={() => setSelectedDate(day)}
                activeOpacity={0.8}
              >
                <Text style={[styles.dayName, isSelected && styles.dayNameActive]}>
                  {format(day, 'E')[0]}
                </Text>
                <Text style={[
                  styles.dayNum,
                  today && styles.dayNumToday,
                  isSelected && styles.dayNumActive,
                ]}>
                  {format(day, 'd')}
                </Text>
                <View style={[styles.dayDot, { opacity: hasDot ? 1 : 0, backgroundColor: isSelected ? colors.primaryForeground : colors.primary }]} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Content ── */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: bottomNavHeight + spacing['2xl'] }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {isLoading ? (
            <ActivityIndicator style={{ marginTop: spacing['2xl'] }} color={colors.primary} />
          ) : (
            <>
              <Text style={styles.dayHeading}>{selectedDayLabel}</Text>

              {dayJobs.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Feather name="calendar" size={iconSizes['3xl']} color={colors.mutedForeground} />
                  </View>
                  <Text style={styles.emptyTitle}>Nothing scheduled</Text>
                  <Text style={styles.emptySubtitle}>
                    No jobs are scheduled for {isToday(selectedDate) ? 'today' : format(selectedDate, 'EEEE')}.
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push('/more/create-job' as any)}
                    style={styles.createBtn}
                    activeOpacity={0.8}
                  >
                    <Feather name="plus" size={14} color={colors.primaryForeground} />
                    <Text style={styles.createBtnText}>Create Job</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.jobList}>
                  {dayJobs.map(renderJobCard)}
                </View>
              )}

              {/* Unscheduled jobs section */}
              {unscheduledJobs.length > 0 && (
                <View style={styles.unscheduledSection}>
                  <Text style={styles.sectionLabel}>UNSCHEDULED</Text>
                  <View style={styles.jobList}>
                    {unscheduledJobs.map(renderJobCard)}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    headerLeft: {
      gap: 2,
    },
    pageTitle: {
      fontSize: typography.sizes['2xl'],
      fontWeight: fontWeights.extrabold,
      color: colors.foreground,
      letterSpacing: -0.4,
    },
    pageSubtitle: {
      fontSize: typography.caption.fontSize,
      color: colors.mutedForeground,
    },
    todayBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.pill,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
    },
    todayBtnText: {
      fontSize: 13,
      fontWeight: fontWeights.semibold,
      color: colors.primary,
    },
    weekNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      marginBottom: spacing.xs,
    },
    weekNavBtn: {
      padding: spacing.sm,
    },
    weekLabel: {
      fontSize: typography.caption.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.mutedForeground,
    },
    dayStrip: {
      flexDirection: 'row',
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    dayItem: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
    },
    dayItemActive: {
      backgroundColor: colors.primary,
    },
    dayName: {
      fontSize: 10,
      fontWeight: fontWeights.semibold,
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    dayNameActive: {
      color: colors.primaryForeground,
    },
    dayNum: {
      fontSize: 16,
      fontWeight: fontWeights.bold,
      color: colors.foreground,
    },
    dayNumToday: {
      color: colors.primary,
    },
    dayNumActive: {
      color: colors.primaryForeground,
    },
    dayDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    dayHeading: {
      fontSize: 17,
      fontWeight: fontWeights.bold,
      color: colors.foreground,
      marginBottom: spacing.md,
    },
    jobList: {
      gap: spacing.sm,
    },
    jobCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      overflow: 'hidden',
      ...shadows.sm,
    },
    jobCardAccent: {
      width: 3,
      alignSelf: 'stretch',
    },
    jobCardContent: {
      flex: 1,
      padding: spacing.md,
      gap: 4,
    },
    jobCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: 2,
    },
    jobTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    statusText: {
      fontSize: 10,
      fontWeight: fontWeights.semibold,
      letterSpacing: 0.2,
    },
    jobMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    jobMetaText: {
      fontSize: 12,
      color: colors.mutedForeground,
      flex: 1,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing['3xl'],
      gap: spacing.sm,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: 'center',
      paddingHorizontal: spacing['2xl'],
    },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
    },
    createBtnText: {
      fontSize: 14,
      fontWeight: fontWeights.semibold,
      color: colors.primaryForeground,
    },
    unscheduledSection: {
      marginTop: spacing.xl,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: fontWeights.bold,
      letterSpacing: 0.8,
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
    },
  });
}
