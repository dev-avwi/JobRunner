import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useJobsStore, useClientsStore } from '../../src/lib/store';
import { StatusBadge } from '../../src/components/ui/StatusBadge';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, usePageShell, typography, fontWeights } from '../../src/lib/design-tokens';
import { useIsTablet } from '../../src/lib/device';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { useUserRole } from '../../src/hooks/use-user-role';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ViewMode = 'week' | 'month' | 'today';

const SCHEDULE_TABS = [
  { key: 'today', label: 'Today', icon: 'sun' },
  { key: 'week', label: 'Week', icon: 'calendar' },
  { key: 'month', label: 'Month', icon: 'grid' },
] as const;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const handleScheduleJob = () => {
  router.push('/more/create-job');
};

const createStyles = (colors: ThemeColors, isTabletDevice: boolean = false, responsivePadding: number = spacing.lg, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: bottomNavHeight,
    paddingHorizontal: responsivePadding,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    fontSize: typography.sizes['3xl'],
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  pageSubtitle: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dispatchButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  scheduleButtonText: {
    color: colors.primaryForeground,
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  tabTextActive: {
    color: colors.primaryForeground,
  },
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateRangeContainer: {
    alignItems: 'center',
  },
  dateRangeText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  jobsCountText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  weekView: {
    marginBottom: spacing.xl,
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginHorizontal: 2,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekDayToday: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  weekDaySelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  weekDayName: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  weekDayNumber: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  weekDayTextActive: {
    color: colors.primaryForeground,
  },
  jobDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  monthView: {
    marginBottom: spacing.xl,
    flex: isTabletDevice ? 1 : undefined,
  },
  monthHeader: {
    marginBottom: spacing.md,
  },
  monthJobsCount: {
    fontSize: isTabletDevice ? 16 : 14,
    color: colors.mutedForeground,
  },
  monthDaysHeader: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    paddingHorizontal: isTabletDevice ? spacing.sm : 0,
  },
  monthDayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: isTabletDevice ? 14 : 12,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: isTabletDevice ? colors.card : undefined,
    borderRadius: isTabletDevice ? radius.xl : 0,
    borderWidth: isTabletDevice ? 1 : 0,
    borderColor: colors.border,
    padding: isTabletDevice ? spacing.sm : 0,
  },
  monthDay: {
    width: '14.28%',
    minHeight: isTabletDevice ? 80 : 50,
    padding: isTabletDevice ? spacing.sm : 2,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  monthDayCircle: {
    width: isTabletDevice ? 40 : 32,
    height: isTabletDevice ? 40 : 32,
    borderRadius: isTabletDevice ? 20 : 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  monthDayCircleToday: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  monthDayCircleSelected: {
    backgroundColor: colors.primary,
  },
  monthDayNumber: {
    fontSize: isTabletDevice ? 16 : 14,
    fontWeight: isTabletDevice ? fontWeights.medium : undefined,
    color: colors.foreground,
  },
  monthDayNumberToday: {
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  monthDayNumberSelected: {
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  monthJobIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginTop: 2,
  },
  monthJobDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.primary,
  },
  monthJobMore: {
    fontSize: isTabletDevice ? 10 : 9,
    color: colors.mutedForeground,
    marginLeft: 2,
  },
  selectedDayContainer: {
    marginBottom: spacing.xl,
  },
  selectedDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  selectedDayTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectedDayTitle: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  todayBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.lg,
  },
  todayBadgeText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  noJobsCard: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.sm,
  },
  noJobsText: {
    fontSize: typography.sizes.md,
    color: colors.mutedForeground,
    fontWeight: fontWeights.medium,
  },
  jobCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  jobCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  jobTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    gap: 4,
  },
  jobTime: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  jobCardContent: {
    gap: 4,
  },
  jobTitle: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  jobDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  jobDetailText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    flex: 1,
  },
  todayViewContainer: {
    marginBottom: spacing.xl,
  },
  todayViewHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  todayViewDate: {
    fontSize: typography.sizes['4xl'],
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  todayViewWeekday: {
    fontSize: typography.sizes.lg,
    color: colors.primary,
    fontWeight: fontWeights.semibold,
    marginTop: spacing.xs,
  },
  todayViewSubtitle: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
  todayJobsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  todayJobsTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  todayJobsCount: {
    fontSize: typography.button.fontSize,
    color: colors.primary,
    fontWeight: fontWeights.medium,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.lg,
  },
  conflictBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.destructiveLight || '#FEF2F2',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: `${colors.destructive}30`,
    gap: spacing.sm,
  },
  conflictBannerDark: {
    backgroundColor: `${colors.destructive}18`,
    borderColor: `${colors.destructive}40`,
  },
  conflictBannerContent: {
    flex: 1,
  },
  conflictBannerTitle: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.destructive,
    marginBottom: 2,
  },
  conflictBannerText: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.destructive,
  },
  conflictDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.destructive,
    marginTop: 2,
  },
  conflictJobCard: {
    borderLeftColor: colors.destructive,
  },
  conflictJobBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.destructiveLight || '#FEF2F2',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.md,
    gap: 4,
    marginTop: spacing.xs,
  },
  conflictJobBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.destructive,
  },
});

export default function CalendarScreen() {
  const { colors } = useTheme();
  const isTabletDevice = useIsTablet();
  const responsiveShell = usePageShell();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, isTabletDevice, responsiveShell.paddingHorizontal, bottomNavHeight), [colors, isTabletDevice, responsiveShell.paddingHorizontal, bottomNavHeight]);
  
  const { jobs, fetchJobs, isLoading } = useJobsStore();
  const { clients, fetchClients } = useClientsStore();
  const { isOwner, isManager } = useUserRole();
  const canCreateJobs = isOwner || isManager;
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const refreshData = useCallback(async () => {
    await Promise.all([fetchJobs(), fetchClients()]);
  }, [fetchJobs, fetchClients]);

  useEffect(() => {
    refreshData();
  }, []);

  // Refresh data when screen gains focus (syncs with web app)
  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

  const getClientName = (clientId?: string) => {
    if (!clientId) return undefined;
    const client = clients.find(c => c.id === clientId);
    return client?.name;
  };

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d;
  };

  const getWeekDates = (date: Date) => {
    const weekStart = getWeekStart(date);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const getMonthDates = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const dates: (Date | null)[] = [];
    
    for (let i = 0; i < startPadding; i++) {
      dates.push(null);
    }
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
      dates.push(new Date(year, month, i));
    }
    
    return dates;
  };

  const getJobsForDate = (date: Date) => {
    return jobs.filter(job => {
      if (!job.scheduledAt) return false;
      const jobDate = new Date(job.scheduledAt);
      return jobDate.toDateString() === date.toDateString();
    });
  };

  const getConflictsForDate = (date: Date) => {
    const dateJobs = getJobsForDate(date);
    if (dateJobs.length < 2) return [];

    const conflicts: { jobA: typeof dateJobs[0]; jobB: typeof dateJobs[0] }[] = [];

    for (let i = 0; i < dateJobs.length; i++) {
      for (let j = i + 1; j < dateJobs.length; j++) {
        const a = dateJobs[i];
        const b = dateJobs[j];
        if (!a.scheduledAt || !b.scheduledAt) continue;

        const aStart = new Date(a.scheduledAt).getTime();
        const aDuration = (a.estimatedDuration || 60) * 60 * 1000;
        const aEnd = aStart + aDuration;

        const bStart = new Date(b.scheduledAt).getTime();
        const bDuration = (b.estimatedDuration || 60) * 60 * 1000;
        const bEnd = bStart + bDuration;

        if (aStart < bEnd && bStart < aEnd) {
          conflicts.push({ jobA: a, jobB: b });
        }
      }
    }
    return conflicts;
  };

  const hasConflictsOnDate = (date: Date) => {
    return getConflictsForDate(date).length > 0;
  };

  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const getDateRangeLabel = () => {
    if (viewMode === 'week') {
      const weekDates = getWeekDates(currentDate);
      const start = weekDates[0];
      const end = weekDates[6];
      return `${start.getDate()} ${MONTHS[start.getMonth()].slice(0, 3)} - ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)}`;
    }
    return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  const scheduledJobsCount = jobs.filter(job => {
    if (!job.scheduledAt) return false;
    const jobDate = new Date(job.scheduledAt);
    if (viewMode === 'week') {
      const weekDates = getWeekDates(currentDate);
      return jobDate >= weekDates[0] && jobDate <= weekDates[6];
    } else {
      return jobDate.getMonth() === currentDate.getMonth() && jobDate.getFullYear() === currentDate.getFullYear();
    }
  }).length;

  const today = new Date();
  const isToday = (date: Date) => date.toDateString() === today.toDateString();
  const isSelected = (date: Date) => date.toDateString() === selectedDate.toDateString();

  const weekDates = getWeekDates(currentDate);
  const monthDates = getMonthDates(currentDate);
  const selectedDateJobs = getJobsForDate(selectedDate);
  const selectedDateConflicts = getConflictsForDate(selectedDate);

  const conflictingJobIds = useMemo(() => {
    const ids = new Set<string>();
    selectedDateConflicts.forEach(c => {
      ids.add(c.jobA.id);
      ids.add(c.jobB.id);
    });
    return ids;
  }, [selectedDateConflicts]);

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

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
              refreshing={isLoading}
              onRefresh={refreshData}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Schedule</Text>
              <Text style={styles.pageSubtitle}>Schedule and track your jobs</Text>
            </View>
            <View style={styles.headerActions}>
              {canCreateJobs && (
                <PressableRow style={styles.dispatchButton} onPress={() => router.push('/more/dispatch-board' as any)} >
                  <Feather name="columns" size={16} color={colors.foreground} />
                </PressableRow>
              )}
              {canCreateJobs && (
                <PressableRow style={styles.scheduleButton} onPress={handleScheduleJob} >
                  <Feather name="plus" size={18} color={colors.primaryForeground} />
                  <Text style={styles.scheduleButtonText}>New Job</Text>
                </PressableRow>
              )}
            </View>
          </View>

          <View style={styles.tabsContainer}>
            {SCHEDULE_TABS.map(tab => (
              <PressableRow key={tab.key} style={[styles.tabButton, viewMode === tab.key && styles.tabButtonActive]} onPress={() => { if (tab.key === 'today') { setViewMode('today'); setCurrentDate(new Date()); setSelectedDate(new Date()); } else { setViewMode(tab.key as ViewMode); } }} >
                <Feather 
                  name={tab.icon as any} 
                  size={14} 
                  color={viewMode === tab.key ? colors.primaryForeground : colors.foreground} 
                />
                <Text style={[styles.tabText, viewMode === tab.key && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </PressableRow>
            ))}
          </View>

          {viewMode !== 'today' && (
            <View style={styles.dateNavigation}>
              <PressableRow onPress={goToPrevious} style={styles.navButton} >
                <Feather name="chevron-left" size={20} color={colors.foreground} />
              </PressableRow>
              <View style={styles.dateRangeContainer}>
                <Text style={styles.dateRangeText}>{getDateRangeLabel()}</Text>
                <Text style={styles.jobsCountText}>{scheduledJobsCount} jobs scheduled</Text>
              </View>
              <PressableRow onPress={goToNext} style={styles.navButton} >
                <Feather name="chevron-right" size={20} color={colors.foreground} />
              </PressableRow>
            </View>
          )}

          {viewMode === 'today' && (() => {
            const TIMELINE_START = 6;
            const TIMELINE_END = 20;
            const HOUR_HEIGHT = 72;
            const timelineHours = Array.from({ length: TIMELINE_END - TIMELINE_START }, (_, i) => TIMELINE_START + i);
            const currentHour = today.getHours();
            const currentMinute = today.getMinutes();
            const nowOffset = (currentHour - TIMELINE_START) * HOUR_HEIGHT + (currentMinute / 60) * HOUR_HEIGHT;

            const getJobPosition = (job: any) => {
              if (!job.scheduledAt) return null;
              const jobDate = new Date(job.scheduledAt);
              const jobHour = jobDate.getHours();
              const jobMinute = jobDate.getMinutes();
              const rawTop = (jobHour - TIMELINE_START) * HOUR_HEIGHT + (jobMinute / 60) * HOUR_HEIGHT;
              const durationMin = job.estimatedDuration || 60;
              const rawHeight = Math.max((durationMin / 60) * HOUR_HEIGHT, 44);
              const containerHeight = timelineHours.length * HOUR_HEIGHT;
              const top = Math.max(0, Math.min(rawTop, containerHeight - 44));
              const height = Math.min(rawHeight, containerHeight - top);
              return { top, height, isOutOfRange: jobHour < TIMELINE_START || jobHour >= TIMELINE_END };
            };

            const earlyLateJobs = selectedDateJobs.filter(job => {
              if (!job.scheduledAt) return false;
              const h = new Date(job.scheduledAt).getHours();
              return h < TIMELINE_START || h >= TIMELINE_END;
            });

            return (
              <View style={styles.todayViewContainer}>
                <View style={styles.todayViewHeader}>
                  <Text style={styles.todayViewDate}>
                    {today.toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}
                  </Text>
                  <Text style={styles.todayViewWeekday}>
                    {today.toLocaleDateString('en-AU', { weekday: 'long' })}
                  </Text>
                  <Text style={styles.todayViewSubtitle}>
                    {selectedDateJobs.length} job{selectedDateJobs.length !== 1 ? 's' : ''} scheduled today
                  </Text>
                </View>

                {selectedDateConflicts.length > 0 && (
                  <View style={styles.conflictBanner}>
                    <Feather name="alert-triangle" size={20} color={colors.destructive} />
                    <View style={styles.conflictBannerContent}>
                      <Text style={styles.conflictBannerTitle}>
                        Schedule Conflict{selectedDateConflicts.length > 1 ? 's' : ''}
                      </Text>
                      <Text style={styles.conflictBannerText}>
                        {selectedDateConflicts.length} overlapping job{selectedDateConflicts.length > 1 ? 's' : ''} detected today
                      </Text>
                    </View>
                  </View>
                )}

                {selectedDateJobs.length === 0 ? (
                  <View style={styles.noJobsCard}>
                    <Feather name="sun" size={32} color={colors.mutedForeground} />
                    <Text style={styles.noJobsText}>No jobs scheduled for today</Text>
                  </View>
                ) : (
                  <>
                  {earlyLateJobs.length > 0 && (
                    <View style={{ marginBottom: spacing.md }}>
                      <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: colors.mutedForeground, marginBottom: spacing.xs }}>Outside Hours</Text>
                      {earlyLateJobs.map(job => (
                        <PressableRow key={`early-${job.id}`} onPress={() => router.push(`/job/${job.id}`)} style={{ backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, }} >
                          <Feather name="clock" size={14} color={colors.mutedForeground} />
                          <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: colors.primary }}>{formatTime(job.scheduledAt)}</Text>
                          <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground, flex: 1 }} numberOfLines={1}>{job.title}</Text>
                          <StatusBadge status={job.status} size="sm" />
                        </PressableRow>
                      ))}
                    </View>
                  )}
                  <View style={{ height: timelineHours.length * HOUR_HEIGHT, position: 'relative' }}>
                    {timelineHours.map(hour => {
                      const h = hour % 12 || 12;
                      const ampm = hour < 12 ? 'am' : 'pm';
                      const yPos = (hour - TIMELINE_START) * HOUR_HEIGHT;
                      return (
                        <View key={hour} style={{ position: 'absolute', top: yPos, left: 0, right: 0, height: HOUR_HEIGHT, flexDirection: 'row' }}>
                          <View style={{ width: 48, alignItems: 'flex-end', paddingRight: 8, paddingTop: 0 }}>
                            <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, fontWeight: fontWeights.medium }}>{h} {ampm}</Text>
                          </View>
                          <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: colors.border }} />
                        </View>
                      );
                    })}

                    {currentHour >= TIMELINE_START && currentHour < TIMELINE_END && (
                      <View style={{ position: 'absolute', top: nowOffset, left: 40, right: 0, flexDirection: 'row', alignItems: 'center', zIndex: 10 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.destructive }} />
                        <View style={{ flex: 1, height: 2, backgroundColor: colors.destructive }} />
                      </View>
                    )}

                    {selectedDateJobs.filter(job => {
                      if (!job.scheduledAt) return false;
                      const h = new Date(job.scheduledAt).getHours();
                      return h >= TIMELINE_START && h < TIMELINE_END;
                    }).map(job => {
                      const pos = getJobPosition(job);
                      if (!pos) return null;
                      const isConflict = conflictingJobIds.has(job.id);
                      const accentColor = isConflict ? colors.destructive : colors.primary;
                      return (
                        <PressableRow key={job.id} onPress={() => router.push(`/job/${job.id}`)} style={{ position: 'absolute', top: pos.top + 1, left: 58, right: 10, height: Math.max(pos.height - 2, 32), backgroundColor: colors.card, borderLeftWidth: 3, borderLeftColor: accentColor, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 4, justifyContent: 'center', zIndex: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.cardBorder, }} >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: accentColor }}>
                              {formatTime(job.scheduledAt)}
                            </Text>
                            <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground, flex: 1, letterSpacing: -0.2 }} numberOfLines={1}>{job.title}</Text>
                            {isConflict && <Feather name="alert-triangle" size={10} color={colors.destructive} />}
                          </View>
                          {pos.height > 40 && getClientName(job.clientId) && (
                            <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: 1 }} numberOfLines={1}>{getClientName(job.clientId)}</Text>
                          )}
                          {pos.height > 56 && job.address && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 }}>
                              <Feather name="map-pin" size={9} color={colors.mutedForeground} />
                              <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }} numberOfLines={1}>{job.address}</Text>
                            </View>
                          )}
                        </PressableRow>
                      );
                    })}
                  </View>
                  </>
                )}
              </View>
            );
          })()}

          {viewMode === 'week' && (
            <View style={styles.weekView}>
              <View style={styles.weekDays}>
                {weekDates.map((date, index) => {
                  const dateJobs = getJobsForDate(date);
                  return (
                    <PressableRow key={index} style={[ styles.weekDay, isToday(date) && styles.weekDayToday, isSelected(date) && styles.weekDaySelected, ]} onPress={() => setSelectedDate(date)} >
                      <Text style={[
                        styles.weekDayName,
                        (isToday(date) || isSelected(date)) && styles.weekDayTextActive
                      ]}>
                        {DAYS[date.getDay()]}
                      </Text>
                      <Text style={[
                        styles.weekDayNumber,
                        (isToday(date) || isSelected(date)) && styles.weekDayTextActive
                      ]}>
                        {date.getDate()}
                      </Text>
                      {dateJobs.length > 0 && (
                        <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
                          <View style={styles.jobDot} />
                          {hasConflictsOnDate(date) && (
                            <View style={styles.conflictDot} />
                          )}
                        </View>
                      )}
                    </PressableRow>
                  );
                })}
              </View>
            </View>
          )}

          {viewMode === 'month' && (
            <View style={styles.monthView}>
              <View style={styles.monthHeader}>
                <Text style={styles.monthJobsCount}>{scheduledJobsCount} jobs this month</Text>
              </View>
              <View style={styles.monthDaysHeader}>
                {DAYS.map(day => (
                  <Text key={day} style={styles.monthDayHeader}>{day}</Text>
                ))}
              </View>
              <View style={styles.monthGrid}>
                {monthDates.map((date, index) => {
                  if (!date) {
                    return <View key={`empty-${index}`} style={styles.monthDay} />;
                  }
                  const dateJobs = getJobsForDate(date);
                  return (
                    <TouchableOpacity key={index} activeOpacity={0.7} style={styles.monthDay} onPress={() => setSelectedDate(date)} >
                      <View style={[
                        styles.monthDayCircle,
                        isToday(date) && styles.monthDayCircleToday,
                        isSelected(date) && styles.monthDayCircleSelected,
                      ]}>
                        <Text style={[
                          styles.monthDayNumber,
                          isToday(date) && styles.monthDayNumberToday,
                          isSelected(date) && styles.monthDayNumberSelected,
                        ]}>
                          {date.getDate()}
                        </Text>
                      </View>
                      {dateJobs.length > 0 && (
                        <View style={styles.monthJobIndicator}>
                          {dateJobs.slice(0, 3).map((_, i) => (
                            <View key={i} style={styles.monthJobDot} />
                          ))}
                          {dateJobs.length > 3 && (
                            <Text style={styles.monthJobMore} numberOfLines={1}>+{dateJobs.length - 3}</Text>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {viewMode !== 'today' && (
            <View style={styles.selectedDayContainer}>
              <View style={styles.selectedDayHeader}>
                <View style={styles.selectedDayTitleRow}>
                  <Feather name="calendar" size={18} color={colors.foreground} />
                  <Text style={styles.selectedDayTitle}>
                    {selectedDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                {isToday(selectedDate) && (
                  <View style={styles.todayBadge}>
                    <Text style={styles.todayBadgeText}>Today</Text>
                  </View>
                )}
              </View>

              {selectedDateConflicts.length > 0 && (
                <View style={styles.conflictBanner}>
                  <Feather name="alert-triangle" size={20} color={colors.destructive} />
                  <View style={styles.conflictBannerContent}>
                    <Text style={styles.conflictBannerTitle}>
                      Schedule Conflict{selectedDateConflicts.length > 1 ? 's' : ''}
                    </Text>
                    <Text style={styles.conflictBannerText}>
                      {selectedDateConflicts.length} overlapping job{selectedDateConflicts.length > 1 ? 's' : ''} on this day
                    </Text>
                  </View>
                </View>
              )}

              {selectedDateJobs.length === 0 ? (
                <View style={styles.noJobsCard}>
                  <Feather name="calendar" size={32} color={colors.mutedForeground} />
                  <Text style={styles.noJobsText}>No jobs scheduled</Text>
                </View>
              ) : (
                selectedDateJobs.map(job => (
                  <PressableRow key={job.id} style={[styles.jobCard, conflictingJobIds.has(job.id) && styles.conflictJobCard]} onPress={() => router.push(`/job/${job.id}`)} >
                    <View style={styles.jobCardLeft}>
                      <View style={styles.jobTimeContainer}>
                        <Feather name="clock" size={14} color={colors.primary} />
                        <Text style={styles.jobTime}>{formatTime(job.scheduledAt)}</Text>
                      </View>
                      <StatusBadge status={job.status} size="sm" />
                    </View>
                    <View style={styles.jobCardContent}>
                      <Text style={styles.jobTitle}>{job.title}</Text>
                      {conflictingJobIds.has(job.id) && (
                        <View style={styles.conflictJobBadge}>
                          <Feather name="alert-triangle" size={11} color={colors.destructive} />
                          <Text style={styles.conflictJobBadgeText}>Overlapping</Text>
                        </View>
                      )}
                      {getClientName(job.clientId) && (
                        <View style={styles.jobDetailRow}>
                          <Feather name="user" size={12} color={colors.mutedForeground} />
                          <Text style={styles.jobDetailText}>{getClientName(job.clientId)}</Text>
                        </View>
                      )}
                      {job.address && (
                        <View style={styles.jobDetailRow}>
                          <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                          <Text style={styles.jobDetailText} numberOfLines={1}>{job.address}</Text>
                        </View>
                      )}
                    </View>
                  </PressableRow>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}
