import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Modal,
  TextInput,
  Platform,
  Share,
  FlatList,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '@/components/ui/PressableRow';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Stack, useFocusEffect, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useJobsStore, useTimeTrackingStore, useAuthStore } from '../../src/lib/store';
import { useUserRole } from '../../src/hooks/use-user-role';
import api from '../../src/lib/api';
import { useTheme, ThemeColors, colorWithOpacity } from '../../src/lib/theme';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes, fontWeights } from '../../src/lib/design-tokens';

type TabKey = 'timer' | 'sheet' | 'stats';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'timer', label: 'Timer', icon: 'clock' },
  { key: 'sheet', label: 'Sheet', icon: 'calendar' },
  { key: 'stats', label: 'Stats', icon: 'bar-chart-2' },
];

interface TimeEntry {
  id: string;
  jobId: string;
  userId: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  description: string | null;
  isBreak?: boolean;
  isBillable?: boolean;
  hourlyRate?: string | number | null;
  category?: string;
  createdAt?: string;
  isDisputed?: boolean;
  disputeReason?: string | null;
  disputedAt?: string | null;
  disputeResolvedAt?: string | null;
  disputeResolution?: string | null;
  userName?: string;
  userEmail?: string;
}

interface WeeklyStats {
  day: string;
  dayLabel: string;
  hours: number;
}

const createStyles = (colors: ThemeColors, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingTop: pageShell.paddingTop,
    paddingBottom: bottomNavHeight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    ...typography.largeTitle,
    color: colors.foreground,
  },
  pageSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.xs,
  },
  headerButtonText: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: fontWeights.medium,
  },
  statsGrid: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  statTitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
    fontSize: typography.sizes.xs,
    letterSpacing: 0.5,
    fontWeight: fontWeights.semibold,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.xs,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.primary + '15',
  },
  tabText: {
    ...typography.caption,
    color: colors.mutedForeground,
    fontWeight: fontWeights.medium,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
  timerSection: {
    gap: spacing.md,
  },
  timerCard: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  timerHeaderText: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  timerDisplay: {
    fontSize: 52,
    fontWeight: '200',
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  timerStatus: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  timerJobName: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: fontWeights.semibold,
    marginTop: spacing.xs,
  },
  timerButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  timerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    gap: spacing.sm,
  },
  timerButtonStart: {
    backgroundColor: colors.primary,
  },
  timerButtonStop: {
    backgroundColor: colors.destructive,
  },
  timerButtonPause: {
    backgroundColor: colors.warning,
  },
  timerButtonResume: {
    backgroundColor: colors.success,
  },
  timerButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.white,
  },
  breakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colorWithOpacity(colors.warning, 0.09),
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  breakBadgeText: {
    ...typography.badge,
    color: colors.warning,
    fontWeight: fontWeights.semibold,
  },
  currentTime: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  quickActionsSection: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.sm,
    ...shadows.sm,
  },
  quickActionText: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: fontWeights.medium,
  },
  jobSelectSection: {
    gap: spacing.sm,
  },
  jobSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.md,
    ...shadows.sm,
  },
  jobSelectCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '08',
  },
  jobSelectRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobSelectRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  jobSelectContent: {
    flex: 1,
  },
  jobSelectTitle: {
    ...typography.body,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  jobSelectStatus: {
    ...typography.caption,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyStateTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  emptyStateText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
  sheetDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sheetDateText: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  sheetDateNav: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sheetDateButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.md,
    ...shadows.sm,
  },
  entryTimeline: {
    alignItems: 'center',
    width: 48,
  },
  entryTimelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  entryTimelineLine: {
    width: 2,
    flex: 1,
    marginTop: spacing.xs,
  },
  entryContent: {
    flex: 1,
  },
  entryJobName: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: 2,
  },
  entryDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  entryTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  entryTimeText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  entryDuration: {
    ...typography.badge,
    color: colors.primary,
    fontWeight: fontWeights.bold,
  },
  entryBillableBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  entryBillableText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
  },
  entryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary + '10',
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  dayTotalLabel: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  dayTotalValue: {
    ...typography.body,
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  weeklyChart: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  chartTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  chartBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    gap: spacing.xs,
  },
  chartBarColumn: {
    flex: 1,
    alignItems: 'center',
  },
  chartBar: {
    width: '70%',
    borderRadius: radius.md,
    minHeight: 4,
  },
  chartBarLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  chartBarValue: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  statsSection: {
    gap: spacing.md,
  },
  statsCard: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  statsCardTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  statsMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
  },
  statsMetricLabel: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  statsMetricValue: {
    ...typography.body,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  statsProgressBarContainer: {
    height: 8,
    backgroundColor: colors.border + '40',
    borderRadius: 4,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  statsProgressBar: {
    height: '100%',
    borderRadius: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalTitle: {
    ...typography.cardTitle,
    fontSize: typography.sizes.lg,
  },
  modalSaveButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 36,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveButtonDisabled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    opacity: 0.45,
  },
  modalSaveText: {
    ...typography.button,
    color: colors.primaryForeground,
    fontWeight: fontWeights.bold,
  },
  modalSaveTextDisabled: {
    color: colors.primaryForeground,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  formLabel: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  formInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  formInputText: {
    ...typography.body,
    color: colors.foreground,
  },
  formTextArea: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    ...typography.body,
    color: colors.foreground,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  durationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary + '12',
    padding: spacing.md,
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
  },
  durationPreviewText: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  billableToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  billableToggleLabel: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: fontWeights.medium,
  },
  exportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.md,
    ...shadows.sm,
  },
  exportCardText: {
    flex: 1,
  },
  exportCardTitle: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  exportCardSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});

function StatCard({ 
  title, value, icon, colors, accentColor
}: { 
  title: string; value: string | number; icon: React.ReactNode; colors: ThemeColors; accentColor?: string;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: (accentColor || colors.primary) + '15' }]}>
        {icon}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

interface TimeStats {
  todayHours: number;
  weekHours: number;
  totalEntries: number;
  billableHours: number;
  breakHours: number;
  weeklyEarnings: number;
  todayEarnings: number;
}

function formatDurationHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function getEffectiveRate(entry: TimeEntry, jobs: any[], userDefaultRate: number): number {
  if (entry.hourlyRate != null && entry.hourlyRate !== '') return Number(entry.hourlyRate);
  const job = jobs.find((j: any) => j.id === entry.jobId);
  if (job && (job as any).hourlyRate != null && (job as any).hourlyRate !== '') return Number((job as any).hourlyRate);
  return userDefaultRate;
}

function calculateEarnings(minutes: number, hourlyRate: number): number {
  return (minutes / 60) * hourlyRate;
}

function formatTimeShort(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getWeekDates(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const start = new Date(now);
  start.setDate(now.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function buildTimeTrackingConfig(colors: ThemeColors) {
  return {
    breakBadgeBg: colorWithOpacity(colors.warning, 0.08),
    billableBadgeBg: colorWithOpacity(colors.success, 0.08),
    disputeBadgeBg: colorWithOpacity(colors.destructive, 0.08),
    statusColors: {
      active: colors.success,
      break: colors.warning,
      late: colors.destructive,
    },
  };
}

export default function TimeTrackingScreen() {
  const { colors } = useTheme();
  const confirm = useConfirmDialog();
  const ttConfig = useMemo(() => buildTimeTrackingConfig(colors), [colors]);
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const { jobs, fetchJobs, isLoading: isLoadingJobs } = useJobsStore();
  const { activeTimer, isLoading: isTimerLoading, startTimer, stopTimer, pauseTimer, resumeTimer, fetchActiveTimer } = useTimeTrackingStore();
  const [activeTab, setActiveTab] = useState<TabKey>('timer');
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [timeStats, setTimeStats] = useState<TimeStats>({ todayHours: 0, weekHours: 0, totalEntries: 0, billableHours: 0, breakHours: 0, weeklyEarnings: 0, todayEarnings: 0 });
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [sheetDate, setSheetDate] = useState(new Date());
  const [weeklyData, setWeeklyData] = useState<WeeklyStats[]>([]);
  const [teamViewEnabled, setTeamViewEnabled] = useState(false);
  const { user } = useAuthStore();
  const { hasTeamSubscription, isManager } = useUserRole();
  // isManager matches manager/admin/supervisor role names case-insensitively;
  // the old exact 'MANAGER' string check missed real DB role names like "Manager".
  const isOwnerOrManager = user?.isOwner === true || isManager;

  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeEntryId, setDisputeEntryId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date());
  const [entryStartTime, setEntryStartTime] = useState(new Date());
  const [entryEndTime, setEntryEndTime] = useState(new Date());
  const [entryDescription, setEntryDescription] = useState('');
  const [entryJobId, setEntryJobId] = useState<string | null>(null);
  const [showEntryDatePicker, setShowEntryDatePicker] = useState(false);
  const [showEntryStartPicker, setShowEntryStartPicker] = useState(false);
  const [showEntryEndPicker, setShowEntryEndPicker] = useState(false);
  const [isAddingEntry, setIsAddingEntry] = useState(false);
  const [entryIsBillable, setEntryIsBillable] = useState(true);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const userDefaultRate = user?.defaultHourlyRate != null ? Number(user.defaultHourlyRate) : 100;

  const isLoading = isLoadingJobs || isTimerLoading;
  const isTimerRunning = !!activeTimer;
  const isOnBreak = activeTimer?.isBreak === true;
  const isPaused = activeTimer?.isPaused === true;

  const fetchTimeEntries = useCallback(async (date?: Date) => {
    setIsLoadingEntries(true);
    try {
      const targetDate = date || sheetDate;
      const dateStr = targetDate.toISOString().split('T')[0];
      const teamParam = teamViewEnabled && isOwnerOrManager ? '&teamView=true' : '';
      const response = await api.get<any[]>(`/api/time-entries?startDate=${dateStr}&endDate=${dateStr}${teamParam}`);
      if (Array.isArray(response.data)) {
        setTimeEntries(response.data);
      }
    } catch (error) {
      if (__DEV__) console.log('Failed to fetch time entries:', error);
    } finally {
      setIsLoadingEntries(false);
    }
  }, [sheetDate, teamViewEnabled, isOwnerOrManager]);

  const fetchWeeklyData = useCallback(async () => {
    try {
      const { start, end } = getWeekDates();
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      const response = await api.get<any[]>(`/api/time-entries?startDate=${startStr}&endDate=${endStr}`);
      if (response.data) {
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const weekly: WeeklyStats[] = dayNames.map((dayLabel, i) => {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          const dayStr = d.toISOString().split('T')[0];
          const dayEntries = response.data!.filter((e: any) => {
            const entryDay = new Date(e.startTime).toISOString().split('T')[0];
            return entryDay === dayStr;
          });
          const totalMinutes = dayEntries.reduce((sum: number, e: any) => sum + (e.duration || 0), 0);
          return { day: dayStr, dayLabel, hours: Math.round((totalMinutes / 60) * 10) / 10 };
        });
        setWeeklyData(weekly);
      }
    } catch (error) {
      if (__DEV__) console.log('Failed to fetch weekly data:', error);
    }
  }, []);

  const fetchTimeStats = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { start } = getWeekDates();
      const weekStartStr = start.toISOString().split('T')[0];
      
      const response = await api.get<any[]>(`/api/time-entries?startDate=${weekStartStr}&endDate=${today}`);
      if (response.data) {
        const entries = response.data;
        let todayMinutes = 0;
        let weekMinutes = 0;
        let billableMinutes = 0;
        let breakMinutes = 0;
        let weeklyEarnings = 0;
        let todayEarnings = 0;
        
        entries.forEach((entry: any) => {
          if (entry.duration) {
            weekMinutes += entry.duration;
            if (entry.isBreak) {
              breakMinutes += entry.duration;
            } else if (entry.isBillable !== false) {
              billableMinutes += entry.duration;
              const rate = getEffectiveRate(entry, jobs, userDefaultRate);
              const earned = calculateEarnings(entry.duration, rate);
              weeklyEarnings += earned;
              const ed = new Date(entry.startTime).toISOString().split('T')[0];
              if (ed === today) {
                todayEarnings += earned;
              }
            }
            const entryDate = new Date(entry.startTime).toISOString().split('T')[0];
            if (entryDate === today) {
              todayMinutes += entry.duration;
            }
          }
        });
        
        setTimeStats({
          todayHours: Math.round((todayMinutes / 60) * 10) / 10,
          weekHours: Math.round((weekMinutes / 60) * 10) / 10,
          totalEntries: entries.length,
          billableHours: Math.round((billableMinutes / 60) * 10) / 10,
          breakHours: Math.round((breakMinutes / 60) * 10) / 10,
          weeklyEarnings: Math.round(weeklyEarnings * 100) / 100,
          todayEarnings: Math.round(todayEarnings * 100) / 100,
        });
      }
    } catch (error) {
      if (__DEV__) console.log('Failed to fetch time stats:', error);
    }
  }, [jobs, userDefaultRate]);

  const refreshData = useCallback(async () => {
    await Promise.all([fetchJobs(), fetchActiveTimer(), fetchTimeStats(), fetchWeeklyData()]);
  }, [fetchJobs, fetchActiveTimer, fetchTimeStats, fetchWeeklyData]);

  // Keep the latest refreshData in a ref so the focus effect below does not
  // re-fire on every render. refreshData's identity changes whenever `jobs`
  // updates (fetchTimeStats depends on it), and refreshData itself calls
  // fetchJobs() — wiring that directly into useFocusEffect's deps caused an
  // infinite refetch loop (the page "kept physically refreshing").
  const refreshDataRef = useRef(refreshData);
  refreshDataRef.current = refreshData;

  useEffect(() => {
    refreshDataRef.current();
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshDataRef.current();
    }, [])
  );

  useEffect(() => {
    if (activeTab === 'sheet') {
      fetchTimeEntries();
    }
  }, [activeTab, sheetDate, teamViewEnabled]);

  useEffect(() => {
    if (activeTimer) {
      setSelectedJob(activeTimer.jobId ?? null);
      const startTime = new Date(activeTimer.startTime).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setTimerSeconds(Math.max(0, elapsed));
      
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const start = new Date(activeTimer.startTime).getTime();
        setTimerSeconds(Math.floor((now - start) / 1000));
      }, 1000);
    } else {
      setTimerSeconds(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [activeTimer]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartTimer = async () => {
    if (!selectedJob) {
      Alert.alert('Select a Job', 'Please select a job to track time for.');
      return;
    }
    setIsStarting(true);
    try {
      const selectedJobData = jobs.find(j => j.id === selectedJob);
      const description = selectedJobData ? `Working on: ${selectedJobData.title}` : 'Working on job';
      const success = await startTimer(selectedJob, description);
      if (!success) {
        Alert.alert('Error', 'Failed to start timer. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start timer. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopTimer = async () => {
    if (!activeTimer) return;
    confirm({
      title: 'Stop Timer',
      message: `Save ${formatTime(timerSeconds)} of tracked time?`,
      confirmText: 'Save',
    }).then(async (ok) => {
      if (!ok) return;
      setIsStopping(true);
      try {
        const success = await stopTimer();
        if (success) {
          await Promise.all([fetchTimeStats(), fetchWeeklyData()]);
        } else {
          Alert.alert('Error', 'Failed to save time entry.');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to save time entry.');
      } finally {
        setIsStopping(false);
      }
    });
  };

  const handlePauseTimer = async () => {
    setIsPausing(true);
    try {
      const success = await pauseTimer();
      if (!success) {
        Alert.alert('Error', 'Failed to pause timer.');
      }
    } catch {
      Alert.alert('Error', 'Failed to pause timer.');
    } finally {
      setIsPausing(false);
    }
  };

  const handleResumeTimer = async () => {
    setIsPausing(true);
    try {
      const success = await resumeTimer();
      if (!success) {
        Alert.alert('Error', 'Failed to resume timer.');
      }
    } catch {
      Alert.alert('Error', 'Failed to resume timer.');
    } finally {
      setIsPausing(false);
    }
  };

  const handleDeleteEntry = (entry: TimeEntry) => {
    confirm({
      title: 'Delete Entry',
      message: 'Are you sure you want to delete this time entry?',
      confirmText: 'Delete',
      destructive: true,
    }).then(async (ok) => {
      if (!ok) return;
      try {
        await api.delete(`/api/time-entries/${entry.id}`);
        await Promise.all([fetchTimeEntries(), fetchTimeStats(), fetchWeeklyData()]);
      } catch {
        Alert.alert('Error', 'Failed to delete entry.');
      }
    });
  };

  const handleOpenEditEntry = (entry: TimeEntry) => {
    const start = new Date(entry.startTime);
    const end = entry.endTime ? new Date(entry.endTime) : new Date();
    setEditingEntry(entry);
    setEntryDate(start);
    setEntryStartTime(start);
    setEntryEndTime(end);
    setEntryDescription(entry.description || '');
    setEntryJobId(entry.jobId);
    setEntryIsBillable(entry.isBillable !== false);
    setShowAddEntryModal(true);
  };

  const handleSaveEditEntry = async () => {
    if (!editingEntry) return;
    const startDateTime = new Date(entryDate);
    startDateTime.setHours(entryStartTime.getHours(), entryStartTime.getMinutes(), 0, 0);
    const endDateTime = new Date(entryDate);
    endDateTime.setHours(entryEndTime.getHours(), entryEndTime.getMinutes(), 0, 0);
    if (endDateTime <= startDateTime) {
      Alert.alert('Invalid Time', 'End time must be after start time.');
      return;
    }
    const durationMinutes = Math.round((endDateTime.getTime() - startDateTime.getTime()) / 60000);
    setIsSavingEdit(true);
    try {
      await api.patch(`/api/time-entries/${editingEntry.id}`, {
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        duration: durationMinutes,
        description: entryDescription || undefined,
        isBillable: entryIsBillable,
        jobId: entryJobId,
      });
      setShowAddEntryModal(false);
      setEditingEntry(null);
      await Promise.all([fetchTimeEntries(), fetchTimeStats(), fetchWeeklyData()]);
      Alert.alert('Updated', 'Time entry updated.');
    } catch (error) {
      Alert.alert('Error', 'Failed to update time entry.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleOpenDispute = (entryId: string) => {
    setDisputeEntryId(entryId);
    setDisputeReason('');
    setShowDisputeModal(true);
  };

  const handleSubmitDispute = async () => {
    if (!disputeEntryId || !disputeReason.trim()) {
      Alert.alert('Required', 'Please provide a reason for the dispute.');
      return;
    }
    setIsSubmittingDispute(true);
    try {
      await api.post(`/api/time-entries/${disputeEntryId}/dispute`, { reason: disputeReason.trim() });
      setShowDisputeModal(false);
      setDisputeEntryId(null);
      setDisputeReason('');
      await fetchTimeEntries();
      Alert.alert('Dispute Filed', 'Your dispute has been submitted for review.');
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Failed to submit dispute.';
      Alert.alert('Error', msg);
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  const handleOpenAddEntry = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0);
    setEditingEntry(null);
    setEntryDate(now);
    setEntryStartTime(startOfToday);
    setEntryEndTime(endOfToday);
    setEntryDescription('');
    setEntryJobId(null);
    setEntryIsBillable(true);
    setShowAddEntryModal(true);
  };

  const handleAddEntry = async () => {
    if (!entryJobId) {
      Alert.alert('Select a Job', 'Please select a job for this time entry.');
      return;
    }
    const startDateTime = new Date(entryDate);
    startDateTime.setHours(entryStartTime.getHours(), entryStartTime.getMinutes(), 0, 0);
    const endDateTime = new Date(entryDate);
    endDateTime.setHours(entryEndTime.getHours(), entryEndTime.getMinutes(), 0, 0);
    if (endDateTime <= startDateTime) {
      Alert.alert('Invalid Time', 'End time must be after start time.');
      return;
    }
    const durationMinutes = Math.round((endDateTime.getTime() - startDateTime.getTime()) / 60000);
    setIsAddingEntry(true);
    try {
      await api.post('/api/time-entries', {
        jobId: entryJobId,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        duration: durationMinutes,
        description: entryDescription || undefined,
        isBillable: entryIsBillable,
      });
      setShowAddEntryModal(false);
      await Promise.all([fetchTimeStats(), fetchTimeEntries(), fetchWeeklyData()]);
      Alert.alert('Saved', 'Time entry added.');
    } catch (error) {
      Alert.alert('Error', 'Failed to add time entry.');
    } finally {
      setIsAddingEntry(false);
    }
  };

  const buildCsvExport = (entries: TimeEntry[], label: string) => {
    const rows: string[] = [];
    rows.push('Date,Start,End,Duration,Job,Type,Billable,Rate ($/hr),Amount ($),Notes');
    let totalEarnings = 0;
    entries.forEach(entry => {
      const jobData = jobs.find(j => j.id === entry.jobId);
      const dateVal = new Date(entry.startTime).toLocaleDateString('en-AU');
      const start = formatTimeShort(entry.startTime);
      const end = entry.endTime ? formatTimeShort(entry.endTime) : 'Running';
      const dur = entry.duration ? formatDurationHM(entry.duration) : '--';
      const type = entry.isBreak ? 'Break' : 'Work';
      const billable = entry.isBillable !== false && !entry.isBreak ? 'Yes' : 'No';
      const rate = getEffectiveRate(entry, jobs, userDefaultRate);
      const amount = entry.duration && !entry.isBreak && entry.isBillable !== false
        ? calculateEarnings(entry.duration, rate)
        : 0;
      totalEarnings += amount;
      const notes = (entry.description || '').replace(/"/g, '""');
      const jobTitle = (jobData?.title || 'Unknown').replace(/"/g, '""');
      rows.push(`${dateVal},${start},${end},${dur},"${jobTitle}",${type},${billable},${rate.toFixed(2)},${amount.toFixed(2)},"${notes}"`);
    });
    const totalMinutes = entries.reduce((sum, e) => sum + (e.duration || 0), 0);
    rows.push('');
    rows.push(`,,,"${formatDurationHM(totalMinutes)}",,,,,${totalEarnings.toFixed(2)},`);
    return { csv: rows.join('\n'), totalEarnings, totalMinutes };
  };

  const handleExportTimesheet = async () => {
    const dateStr = sheetDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const { csv, totalEarnings, totalMinutes } = buildCsvExport(timeEntries, dateStr);
    const summary = `Timesheet - ${dateStr}\nTotal: ${formatDurationHM(totalMinutes)} | Earnings: ${formatCurrency(totalEarnings)}\n\n${csv}`;
    try {
      await Share.share({ message: summary, title: `Timesheet ${dateStr}` });
    } catch {}
  };

  const handleExportWeekly = async () => {
    try {
      const { start, end } = getWeekDates();
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      const response = await api.get<any[]>(`/api/time-entries?startDate=${startStr}&endDate=${endStr}`);
      if (!response.data?.length) {
        Alert.alert('No Data', 'No time entries this week to export.');
        return;
      }
      const weekLabel = `${start.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      const { csv, totalEarnings, totalMinutes } = buildCsvExport(response.data, weekLabel);
      const summary = `Weekly Timesheet - ${weekLabel}\nTotal: ${formatDurationHM(totalMinutes)} | Earnings: ${formatCurrency(totalEarnings)}\n\n${csv}`;
      await Share.share({ message: summary, title: `Weekly Timesheet ${weekLabel}` });
    } catch {
      Alert.alert('Error', 'Failed to export weekly timesheet.');
    }
  };

  const navigateSheetDate = (direction: number) => {
    const newDate = new Date(sheetDate);
    newDate.setDate(newDate.getDate() + direction);
    setSheetDate(newDate);
  };

  const inProgressJobs = jobs.filter(j => j.status === 'in_progress' || j.status === 'scheduled');
  const activeJobName = activeTimer ? jobs.find(j => j.id === activeTimer.jobId)?.title : null;
  const dayTotalMinutes = timeEntries.reduce((sum, e) => sum + (e.duration || 0), 0);
  const maxWeeklyHours = Math.max(8, ...weeklyData.map(d => d.hours));

  const renderTimerTab = () => (
    <View style={styles.timerSection}>
      <View style={styles.timerCard}>
        <View style={styles.timerHeader}>
          {isTimerRunning && (
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: isOnBreak ? ttConfig.statusColors.break : ttConfig.statusColors.active, marginRight: 4 }} />
          )}
          <Feather name="clock" size={20} color={colors.foreground} />
          <Text style={styles.timerHeaderText}>
            {isOnBreak ? 'On Break' : 'Time Tracker'}
          </Text>
        </View>
        
        <Text style={[styles.timerDisplay, isOnBreak && { color: ttConfig.statusColors.break }]}>
          {formatTime(timerSeconds)}
        </Text>
        
        {activeJobName && (
          <Text style={styles.timerJobName} numberOfLines={1}>{activeJobName}</Text>
        )}
        
        <Text style={styles.timerStatus}>
          {isOnBreak 
            ? 'Taking a break...' 
            : isTimerRunning 
              ? 'Timer running...' 
              : 'Ready to start tracking'}
        </Text>

        {isTimerRunning && !isOnBreak && (() => {
          const activeJob = activeTimer ? jobs.find(j => j.id === activeTimer.jobId) : null;
          const rate = activeJob && (activeJob as any).hourlyRate != null && (activeJob as any).hourlyRate !== ''
            ? Number((activeJob as any).hourlyRate)
            : userDefaultRate;
          const earned = (timerSeconds / 3600) * rate;
          return (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginTop: -spacing.xs }}>
              <Text style={{ fontSize: typography.sizes.xl, fontWeight: fontWeights.bold, color: ttConfig.statusColors.active, fontVariant: ['tabular-nums'] as any }}>
                {formatCurrency(earned)}
              </Text>
              <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>
                @ {formatCurrency(rate)}/hr
              </Text>
            </View>
          );
        })()}

        {isOnBreak && (
          <View style={styles.breakBadge}>
            <Feather name="coffee" size={12} color={ttConfig.statusColors.break} />
            <Text style={styles.breakBadgeText}>Break Time</Text>
          </View>
        )}

        {!isTimerRunning ? (
          <TouchableOpacity
            style={[styles.timerButton, styles.timerButtonStart, { width: '100%' }]}
            onPress={handleStartTimer}
            disabled={isStarting}
            activeOpacity={0.7}
          >
            {isStarting ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <>
                <Feather name="play" size={20} color={colors.primaryForeground} />
                <Text style={[styles.timerButtonText, { color: colors.primaryForeground }]}>Start Timer</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={[styles.timerButtonsRow, { marginTop: spacing.xs }]}>
            {isOnBreak ? (
              <TouchableOpacity
                style={[styles.timerButton, styles.timerButtonResume]}
                onPress={handleResumeTimer}
                disabled={isPausing}
                activeOpacity={0.7}
              >
                {isPausing ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Feather name="play" size={18} color={colors.white} />
                    <Text style={styles.timerButtonText}>Resume</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.timerButton, styles.timerButtonPause]}
                onPress={handlePauseTimer}
                disabled={isPausing}
                activeOpacity={0.7}
              >
                {isPausing ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Feather name="coffee" size={18} color={colors.white} />
                    <Text style={styles.timerButtonText}>Break</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.timerButton, styles.timerButtonStop]}
              onPress={handleStopTimer}
              disabled={isStopping}
              activeOpacity={0.7}
            >
              {isStopping ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Feather name="square" size={18} color={colors.white} />
                  <Text style={styles.timerButtonText}>Stop</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.currentTime}>
          {new Date().toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}
        </Text>
      </View>

      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
        <View style={styles.quickActionsGrid}>
          <PressableRow 
            style={styles.quickActionCard} 

            onPress={handleOpenAddEntry}
          >
            <Feather name="plus-circle" size={20} color={colors.primary} />
            <Text style={styles.quickActionText}>Add Entry</Text>
          </PressableRow>
          <PressableRow 
            style={styles.quickActionCard} 

            onPress={() => setActiveTab('sheet')}
          >
            <Feather name="file-text" size={20} color={colors.primary} />
            <Text style={styles.quickActionText}>View Sheet</Text>
          </PressableRow>
          <PressableRow 
            style={styles.quickActionCard} 

            onPress={() => setActiveTab('stats')}
          >
            <Feather name="bar-chart-2" size={20} color={colors.primary} />
            <Text style={styles.quickActionText}>Stats</Text>
          </PressableRow>
        </View>
      </View>

      {!isTimerRunning && (
        <View style={styles.jobSelectSection}>
          <Text style={styles.sectionTitle}>SELECT JOB</Text>
          {inProgressJobs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No active or scheduled jobs to track</Text>
            </View>
          ) : (
            inProgressJobs.slice(0, 6).map(job => (
              <TouchableOpacity
                key={job.id}
                style={[
                  styles.jobSelectCard,
                  selectedJob === job.id && styles.jobSelectCardActive
                ]}
                onPress={() => setSelectedJob(job.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.jobSelectRadio, selectedJob === job.id && { borderColor: colors.primary }]}>
                  {selectedJob === job.id && <View style={styles.jobSelectRadioInner} />}
                </View>
                <View style={styles.jobSelectContent}>
                  <Text style={styles.jobSelectTitle} numberOfLines={1}>{job.title}</Text>
                  <Text style={styles.jobSelectStatus}>{(job.status || '').replace('_', ' ')}</Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );

  const renderSheetTab = () => {
    const dateLabel = sheetDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' });
    const isToday = sheetDate.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];

    return (
      <View style={{ gap: spacing.md }}>
        {isOwnerOrManager && hasTeamSubscription && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.cardBorder }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Feather name={teamViewEnabled ? 'users' : 'user'} size={16} color={teamViewEnabled ? colors.primary : colors.mutedForeground} />
              <Text style={{ ...typography.body, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                {teamViewEnabled ? 'Team View' : 'My Entries'}
              </Text>
            </View>
            <Switch
              value={teamViewEnabled}
              onValueChange={(val) => {
                setTeamViewEnabled(val);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={colors.border}
            />
          </View>
        )}
        {isOwnerOrManager && !hasTeamSubscription && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push('/more/subscription')}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.cardBorder, opacity: 0.85 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
              <Feather name="lock" size={16} color={colors.mutedForeground} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.body, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                  Team Timesheets
                </Text>
                <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 2 }}>
                  Review & approve crew hours — Team plan
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.primary + '20', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm }}>
              <Text style={{ ...typography.caption, fontWeight: fontWeights.semibold, color: colors.primary }}>Team</Text>
              <Feather name="chevron-right" size={14} color={colors.primary} />
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.sheetDateHeader}>
          <View>
            <Text style={styles.sheetDateText}>{dateLabel}</Text>
            {isToday && (
              <Text style={[styles.emptyStateText, { textAlign: 'left', marginTop: 2 }]}>Today</Text>
            )}
          </View>
          <View style={styles.sheetDateNav}>
            <TouchableOpacity style={styles.sheetDateButton} onPress={() => navigateSheetDate(-1)} activeOpacity={0.7}>
              <Feather name="chevron-left" size={18} color={colors.foreground} />
            </TouchableOpacity>
            {!isToday && (
              <TouchableOpacity 
                style={[styles.sheetDateButton, { backgroundColor: colors.primary + '15' }]} 
                onPress={() => setSheetDate(new Date())} 
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: colors.primary }}>Today</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.sheetDateButton} onPress={() => navigateSheetDate(1)} activeOpacity={0.7}>
              <Feather name="chevron-right" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        {dayTotalMinutes > 0 && (() => {
          const dayBillableEntries = timeEntries.filter(e => !e.isBreak && e.isBillable !== false && e.duration);
          const dayEarnings = dayBillableEntries.reduce((sum, e) => {
            const rate = getEffectiveRate(e, jobs, userDefaultRate);
            return sum + calculateEarnings(e.duration!, rate);
          }, 0);
          const uniqueWorkers = teamViewEnabled && isOwnerOrManager ? new Set(timeEntries.map(e => e.userId)).size : 0;
          return (
            <View style={styles.dayTotalRow}>
              <View>
                <Text style={styles.dayTotalLabel}>{teamViewEnabled && isOwnerOrManager ? 'Team Total' : 'Day Total'}</Text>
                {uniqueWorkers > 0 && (
                  <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: 1 }}>
                    {uniqueWorkers} {uniqueWorkers === 1 ? 'worker' : 'workers'}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.dayTotalValue}>{formatDurationHM(dayTotalMinutes)}</Text>
                {dayEarnings > 0 && (
                  <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: ttConfig.statusColors.active, marginTop: 1 }}>
                    {formatCurrency(dayEarnings)}
                  </Text>
                )}
              </View>
            </View>
          );
        })()}

        {isLoadingEntries ? (
          <View style={[styles.emptyState, { paddingVertical: spacing['2xl'] }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.emptyStateText, { marginTop: spacing.md }]}>Loading entries...</Text>
          </View>
        ) : timeEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyStateIcon, { backgroundColor: colors.primary + '12' }]}>
              <Feather name="calendar" size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyStateTitle}>No Entries</Text>
            <Text style={styles.emptyStateText}>
              No time tracked on this day. Use the timer or add a manual entry.
            </Text>
          </View>
        ) : teamViewEnabled && isOwnerOrManager ? (
          (() => {
            interface WorkerGroup {
              userId: string;
              userName: string;
              userEmail: string;
              entries: TimeEntry[];
              totalWorkMinutes: number;
              totalBreakMinutes: number;
            }

            const workerMap = new Map<string, WorkerGroup>();

            timeEntries.forEach(entry => {
              const uid = entry.userId;
              if (!workerMap.has(uid)) {
                workerMap.set(uid, {
                  userId: uid,
                  userName: entry.userName || entry.userEmail || 'Unknown',
                  userEmail: entry.userEmail || '',
                  entries: [],
                  totalWorkMinutes: 0,
                  totalBreakMinutes: 0,
                });
              }
              const wg = workerMap.get(uid)!;
              wg.entries.push(entry);
              if (entry.isBreak) {
                wg.totalBreakMinutes += entry.duration || 0;
              } else {
                wg.totalWorkMinutes += entry.duration || 0;
              }
            });

            const workerGroups = Array.from(workerMap.values()).sort((a, b) => b.totalWorkMinutes - a.totalWorkMinutes);

            return workerGroups.map((wg) => {
              const sortedEntries = [...wg.entries].sort(
                (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
              );
              const totalMinutes = wg.totalWorkMinutes + wg.totalBreakMinutes;
              const initials = wg.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

              return (
                <View key={wg.userId} style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.cardBorder, marginBottom: spacing.md, overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border + '40' }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.bold, color: colors.primary }}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }} numberOfLines={1}>{wg.userName}</Text>
                      <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: 1 }}>
                        {wg.entries.length} {wg.entries.length === 1 ? 'entry' : 'entries'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.bold, color: colors.foreground }}>{formatDurationHM(totalMinutes)}</Text>
                      {wg.totalBreakMinutes > 0 && (
                        <Text style={{ fontSize: typography.sizes.xs, color: ttConfig.statusColors.break, fontWeight: fontWeights.medium, marginTop: 1 }}>
                          {formatDurationHM(wg.totalBreakMinutes)} break
                        </Text>
                      )}
                    </View>
                  </View>
                  {sortedEntries.map((entry, idx) => {
                    const jobData = jobs.find(j => j.id === entry.jobId);
                    const jobTitle = jobData?.title || 'Unknown Job';
                    const startStr = formatTimeShort(entry.startTime);
                    const endStr = entry.endTime ? formatTimeShort(entry.endTime) : 'Running';
                    const durationStr = entry.duration ? formatDurationHM(entry.duration) : '--';
                    const isBreakEntry = entry.isBreak;
                    const isBillable = entry.isBillable !== false && !isBreakEntry;

                    return (
                      <View key={entry.id}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: idx < sortedEntries.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: colors.border + '30' }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isBreakEntry ? ttConfig.statusColors.break : colors.primary, marginRight: spacing.sm }} />
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
                              <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.foreground, fontWeight: fontWeights.medium }} numberOfLines={1}>
                                {isBreakEntry ? 'Break' : jobTitle}
                              </Text>
                              {isBreakEntry ? (
                                <View style={{ backgroundColor: ttConfig.breakBadgeBg, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                  <Feather name="coffee" size={9} color={ttConfig.statusColors.break} />
                                </View>
                              ) : isBillable ? (
                                <View style={{ backgroundColor: ttConfig.billableBadgeBg, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                  <Text style={{ fontSize: typography.sizes.xs, color: ttConfig.statusColors.active, fontWeight: fontWeights.semibold }}>$</Text>
                                </View>
                              ) : null}
                              {entry.isDisputed && (
                                <View style={{ backgroundColor: ttConfig.disputeBadgeBg, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                  <Feather name="alert-triangle" size={8} color={ttConfig.statusColors.late} />
                                  <Text style={{ fontSize: typography.sizes.xs, color: ttConfig.statusColors.late, fontWeight: fontWeights.semibold }}>
                                    {entry.disputeResolvedAt ? 'Resolved' : 'Disputed'}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: 1 }}>
                              {startStr} — {endStr}
                            </Text>
                          </View>
                          <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: isBreakEntry ? ttConfig.statusColors.break : colors.foreground, marginRight: spacing.sm }}>
                            {durationStr}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                            {entry.endTime && (
                              <TouchableOpacity onPress={() => handleOpenEditEntry(entry)} activeOpacity={0.7} hitSlop={8}>
                                <Feather name="edit-2" size={14} color={colors.primary} />
                              </TouchableOpacity>
                            )}
                            {!entry.isDisputed && !isBreakEntry && (
                              <TouchableOpacity onPress={() => handleOpenDispute(entry.id)} activeOpacity={0.7} hitSlop={8}>
                                <Feather name="flag" size={14} color={ttConfig.statusColors.break} />
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => handleDeleteEntry(entry)} activeOpacity={0.7} hitSlop={8}>
                              <Feather name="trash-2" size={14} color={ttConfig.statusColors.late} />
                            </TouchableOpacity>
                          </View>
                        </View>
                        {entry.isDisputed && entry.disputeReason && !entry.disputeResolvedAt && (
                          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xs }}>
                            <Text style={{ fontSize: typography.sizes.xs, color: ttConfig.statusColors.late }} numberOfLines={2}>
                              Reason: {entry.disputeReason}
                            </Text>
                          </View>
                        )}
                        {entry.isDisputed && entry.disputeResolution && (
                          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xs }}>
                            <Text style={{ fontSize: typography.sizes.xs, color: ttConfig.statusColors.active }} numberOfLines={2}>
                              Resolution: {entry.disputeResolution}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            });
          })()
        ) : (
          (() => {
            interface GroupedJob {
              jobId: string;
              jobTitle: string;
              workEntries: TimeEntry[];
              breakEntries: TimeEntry[];
              totalWorkMinutes: number;
              totalBreakMinutes: number;
              earliestStart: string;
              latestEnd: string | null;
            }

            const grouped: GroupedJob[] = [];
            const jobMap = new Map<string, GroupedJob>();

            timeEntries.forEach(entry => {
              const jId = entry.jobId;
              if (!jobMap.has(jId)) {
                const jobData = jobs.find(j => j.id === jId);
                const group: GroupedJob = {
                  jobId: jId,
                  jobTitle: jobData?.title || 'Unknown Job',
                  workEntries: [],
                  breakEntries: [],
                  totalWorkMinutes: 0,
                  totalBreakMinutes: 0,
                  earliestStart: entry.startTime,
                  latestEnd: entry.endTime,
                };
                jobMap.set(jId, group);
                grouped.push(group);
              }
              const group = jobMap.get(jId)!;
              if (entry.isBreak) {
                group.breakEntries.push(entry);
                group.totalBreakMinutes += entry.duration || 0;
              } else {
                group.workEntries.push(entry);
                group.totalWorkMinutes += entry.duration || 0;
              }
              if (entry.startTime < group.earliestStart) group.earliestStart = entry.startTime;
              if (entry.endTime && (!group.latestEnd || entry.endTime > group.latestEnd)) group.latestEnd = entry.endTime;
            });

            return grouped.map((group, groupIdx) => {
              const allEntries = [...group.workEntries, ...group.breakEntries].sort(
                (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
              );
              const totalMinutes = group.totalWorkMinutes + group.totalBreakMinutes;

              return (
                <View key={group.jobId} style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.cardBorder, marginBottom: spacing.md, overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border + '40' }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="briefcase" size={16} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }} numberOfLines={1}>{group.jobTitle}</Text>
                      <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: 1 }}>
                        {formatTimeShort(group.earliestStart)} — {group.latestEnd ? formatTimeShort(group.latestEnd) : 'Running'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: typography.sizes.md, fontWeight: fontWeights.bold, color: colors.foreground }}>{formatDurationHM(totalMinutes)}</Text>
                      {group.breakEntries.length > 0 && (
                        <Text style={{ fontSize: typography.sizes.xs, color: ttConfig.statusColors.break, fontWeight: fontWeights.medium, marginTop: 1 }}>
                          {formatDurationHM(group.totalBreakMinutes)} break
                        </Text>
                      )}
                    </View>
                  </View>
                  {allEntries.map((entry, idx) => {
                    const startStr = formatTimeShort(entry.startTime);
                    const endStr = entry.endTime ? formatTimeShort(entry.endTime) : 'Running';
                    const durationStr = entry.duration ? formatDurationHM(entry.duration) : '--';
                    const isBreakEntry = entry.isBreak;
                    const isBillable = entry.isBillable !== false && !isBreakEntry;

                    return (
                      <View key={entry.id}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: idx < allEntries.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: colors.border + '30' }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isBreakEntry ? ttConfig.statusColors.break : colors.primary, marginRight: spacing.sm }} />
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
                              <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.foreground, fontWeight: fontWeights.medium }}>
                                {isBreakEntry ? 'Break' : 'Work'}
                              </Text>
                              {isBreakEntry ? (
                                <View style={{ backgroundColor: ttConfig.breakBadgeBg, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                  <Feather name="coffee" size={9} color={ttConfig.statusColors.break} />
                                </View>
                              ) : isBillable ? (
                                <View style={{ backgroundColor: ttConfig.billableBadgeBg, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                  <Text style={{ fontSize: typography.sizes.xs, color: ttConfig.statusColors.active, fontWeight: fontWeights.semibold }}>$</Text>
                                </View>
                              ) : null}
                              {entry.isDisputed && (
                                <View style={{ backgroundColor: ttConfig.disputeBadgeBg, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                  <Feather name="alert-triangle" size={8} color={ttConfig.statusColors.late} />
                                  <Text style={{ fontSize: typography.sizes.xs, color: ttConfig.statusColors.late, fontWeight: fontWeights.semibold }}>
                                    {entry.disputeResolvedAt ? 'Resolved' : 'Disputed'}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: 1 }}>
                              {startStr} — {endStr}
                            </Text>
                          </View>
                          <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: isBreakEntry ? ttConfig.statusColors.break : colors.foreground, marginRight: spacing.sm }}>
                            {durationStr}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                            {entry.endTime && (
                              <TouchableOpacity onPress={() => handleOpenEditEntry(entry)} activeOpacity={0.7} hitSlop={8}>
                                <Feather name="edit-2" size={14} color={colors.primary} />
                              </TouchableOpacity>
                            )}
                            {!entry.isDisputed && !isBreakEntry && (
                              <TouchableOpacity onPress={() => handleOpenDispute(entry.id)} activeOpacity={0.7} hitSlop={8}>
                                <Feather name="flag" size={14} color={ttConfig.statusColors.break} />
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => handleDeleteEntry(entry)} activeOpacity={0.7} hitSlop={8}>
                              <Feather name="trash-2" size={14} color={ttConfig.statusColors.late} />
                            </TouchableOpacity>
                          </View>
                        </View>
                        {entry.isDisputed && entry.disputeReason && !entry.disputeResolvedAt && (
                          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xs }}>
                            <Text style={{ fontSize: typography.sizes.xs, color: ttConfig.statusColors.late }} numberOfLines={2}>
                              Reason: {entry.disputeReason}
                            </Text>
                          </View>
                        )}
                        {entry.isDisputed && entry.disputeResolution && (
                          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xs }}>
                            <Text style={{ fontSize: typography.sizes.xs, color: ttConfig.statusColors.active }} numberOfLines={2}>
                              Resolution: {entry.disputeResolution}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            });
          })()
        )}

        {timeEntries.length > 0 && (
          <TouchableOpacity style={styles.exportCard} onPress={handleExportTimesheet} activeOpacity={0.7}>
            <View style={[styles.emptyStateIcon, { backgroundColor: colors.primary + '12', width: 44, height: 44 }]}>
              <Feather name="share" size={20} color={colors.primary} />
            </View>
            <View style={styles.exportCardText}>
              <Text style={styles.exportCardTitle}>Export Day CSV</Text>
              <Text style={styles.exportCardSubtitle}>Share this day's entries with rates and earnings</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderStatsTab = () => {
    const billablePercent = timeStats.weekHours > 0 
      ? Math.round((timeStats.billableHours / timeStats.weekHours) * 100)
      : 0;
    const avgDailyHours = timeStats.weekHours > 0 
      ? Math.round((timeStats.weekHours / Math.max(1, weeklyData.filter(d => d.hours > 0).length)) * 10) / 10
      : 0;
    const weeklyEarnings = timeStats.weeklyEarnings;
    const daysWorked = weeklyData.filter(d => d.hours > 0).length;
    const avgDailyEarnings = daysWorked > 0 ? weeklyEarnings / daysWorked : 0;

    return (
      <View style={styles.statsSection}>
        {weeklyEarnings > 0 && (
          <View style={[styles.statsCard, { backgroundColor: colorWithOpacity(ttConfig.statusColors.active, 0.07), borderColor: colorWithOpacity(ttConfig.statusColors.active, 0.19) }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colorWithOpacity(ttConfig.statusColors.active, 0.13), alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="dollar-sign" size={18} color={ttConfig.statusColors.active} />
              </View>
              <Text style={{ ...typography.cardTitle, color: colors.foreground }}>Weekly Earnings</Text>
            </View>
            <Text style={{ fontSize: typography.sizes['4xl'], fontWeight: fontWeights.bold, color: ttConfig.statusColors.active, marginBottom: spacing.xs }}>
              {formatCurrency(weeklyEarnings)}
            </Text>
            <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground }}>
              Avg {formatCurrency(avgDailyEarnings)}/day  ·  {timeStats.billableHours}h billable
            </Text>
          </View>
        )}

        <View style={styles.weeklyChart}>
          <Text style={styles.chartTitle}>This Week</Text>
          <View style={styles.chartBarsContainer}>
            {weeklyData.map((day) => {
              const barHeight = maxWeeklyHours > 0 ? (day.hours / maxWeeklyHours) * 100 : 0;
              const isToday = day.day === new Date().toISOString().split('T')[0];
              return (
                <View key={day.day} style={styles.chartBarColumn}>
                  {day.hours > 0 && (
                    <Text style={styles.chartBarValue}>{day.hours}h</Text>
                  )}
                  <View
                    style={[
                      styles.chartBar,
                      { 
                        height: Math.max(4, barHeight),
                        backgroundColor: isToday ? colors.primary : (day.hours > 0 ? colors.primary + '60' : colors.border + '40'),
                      }
                    ]}
                  />
                  <Text style={[styles.chartBarLabel, isToday && { color: colors.primary, fontWeight: fontWeights.bold }]}>
                    {day.dayLabel}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.statsCardTitle}>Weekly Summary</Text>
          <View style={styles.statsMetricRow}>
            <Text style={styles.statsMetricLabel}>Total Hours</Text>
            <Text style={styles.statsMetricValue}>{timeStats.weekHours}h</Text>
          </View>
          <View style={styles.statsMetricRow}>
            <Text style={styles.statsMetricLabel}>Billable Hours</Text>
            <Text style={[styles.statsMetricValue, { color: ttConfig.statusColors.active }]}>{timeStats.billableHours}h</Text>
          </View>
          <View style={styles.statsMetricRow}>
            <Text style={styles.statsMetricLabel}>Break Time</Text>
            <Text style={[styles.statsMetricValue, { color: ttConfig.statusColors.break }]}>{timeStats.breakHours}h</Text>
          </View>
          <View style={styles.statsMetricRow}>
            <Text style={styles.statsMetricLabel}>Total Entries</Text>
            <Text style={styles.statsMetricValue}>{timeStats.totalEntries}</Text>
          </View>
          <View style={[styles.statsMetricRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.statsMetricLabel}>Avg Daily</Text>
            <Text style={styles.statsMetricValue}>{avgDailyHours}h</Text>
          </View>
          {weeklyEarnings > 0 && (
            <View style={[styles.statsMetricRow, { borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: colors.border + '40', marginTop: spacing.xs }]}>
              <Text style={[styles.statsMetricLabel, { fontWeight: fontWeights.semibold }]}>Est. Earnings</Text>
              <Text style={[styles.statsMetricValue, { color: ttConfig.statusColors.active }]}>{formatCurrency(weeklyEarnings)}</Text>
            </View>
          )}
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.statsCardTitle}>Billable Rate</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginBottom: spacing.sm }}>
            <Text style={{ fontSize: 36, fontWeight: fontWeights.bold, color: colors.primary }}>{billablePercent}%</Text>
            <Text style={styles.statsMetricLabel}>of hours are billable</Text>
          </View>
          <View style={styles.statsProgressBarContainer}>
            <View style={[styles.statsProgressBar, { width: `${billablePercent}%`, backgroundColor: ttConfig.statusColors.active }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
            <Text style={{ fontSize: typography.sizes.xs, color: ttConfig.statusColors.active, fontWeight: fontWeights.semibold }}>
              {timeStats.billableHours}h billable
            </Text>
            <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>
              {Math.round((timeStats.weekHours - timeStats.billableHours) * 10) / 10}h non-billable
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.exportCard} onPress={handleExportWeekly} activeOpacity={0.7}>
          <View style={[styles.emptyStateIcon, { backgroundColor: colors.primary + '12', width: 44, height: 44 }]}>
            <Feather name="download" size={20} color={colors.primary} />
          </View>
          <View style={styles.exportCardText}>
            <Text style={styles.exportCardTitle}>Export Weekly CSV</Text>
            <Text style={styles.exportCardSubtitle}>Share weekly timesheet with rates and earnings</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    );
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
              colors={[colors.primary]}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Time Tracking</Text>
              <Text style={styles.pageSubtitle}>Track hours, breaks, and timesheets</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={handleOpenAddEntry}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="plus" size={16} color={colors.foreground} />
                <Text style={styles.headerButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                title="TODAY"
                value={`${timeStats.todayHours.toFixed(1)}h`}
                icon={<Feather name="sun" size={18} color={colors.primary} />}
                colors={colors}
              />
              <StatCard
                title="THIS WEEK"
                value={`${timeStats.weekHours.toFixed(1)}h`}
                icon={<Feather name="calendar" size={18} color="#3b82f6" />}
                colors={colors}
                accentColor="#3b82f6"
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                title="EARNED"
                value={formatCurrency(timeStats.weeklyEarnings)}
                icon={<Feather name="dollar-sign" size={18} color={ttConfig.statusColors.active} />}
                colors={colors}
                accentColor={ttConfig.statusColors.active}
              />
              <StatCard
                title="ENTRIES"
                value={timeStats.totalEntries}
                icon={<Feather name="list" size={18} color="#8b5cf6" />}
                colors={colors}
                accentColor="#8b5cf6"
              />
            </View>
          </View>

          <View style={styles.tabContainer}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                  activeOpacity={0.7}
                >
                  <Feather 
                    name={tab.icon as any}
                    size={16} 
                    color={isActive ? colors.primary : colors.mutedForeground} 
                  />
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {activeTab === 'timer' && renderTimerTab()}
          {activeTab === 'sheet' && renderSheetTab()}
          {activeTab === 'stats' && renderStatsTab()}
        </ScrollView>
      </View>
      
      <AppBottomSheet
        visible={showAddEntryModal}
        onDismiss={() => { setShowAddEntryModal(false); setEditingEntry(null); }}
        snapPoints={['92%']}
        scrollable={false}
        contentPadding={0}>
        <View style={[styles.container, { paddingTop: spacing.lg }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => { setShowAddEntryModal(false); setEditingEntry(null); }}
              style={styles.modalCloseButton}
            >
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editingEntry ? 'Edit Time Entry' : 'Add Time Entry'}
            </Text>
            <TouchableOpacity 
              onPress={editingEntry ? handleSaveEditEntry : handleAddEntry}
              disabled={(editingEntry ? isSavingEdit : isAddingEntry) || !entryJobId}
              style={[styles.modalSaveButton, (!entryJobId || (editingEntry ? isSavingEdit : isAddingEntry)) && styles.modalSaveButtonDisabled]}
            >
              <Text style={[styles.modalSaveText, (!entryJobId || (editingEntry ? isSavingEdit : isAddingEntry)) && styles.modalSaveTextDisabled]}>
                {editingEntry 
                  ? (isSavingEdit ? 'Saving...' : 'Update')
                  : (isAddingEntry ? 'Saving...' : 'Save')}
              </Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Date</Text>
              <TouchableOpacity 
                style={styles.formInput}
                onPress={() => setShowEntryDatePicker(true)}
              >
                <Feather name="calendar" size={18} color={colors.mutedForeground} />
                <Text style={styles.formInputText}>
                  {entryDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
              {showEntryDatePicker && (
                <DateTimePicker
                  value={entryDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, date) => {
                    setShowEntryDatePicker(Platform.OS === 'ios');
                    if (date) setEntryDate(date);
                  }}
                />
              )}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Start Time</Text>
              <TouchableOpacity 
                style={styles.formInput}
                onPress={() => setShowEntryStartPicker(true)}
              >
                <Feather name="clock" size={18} color={colors.mutedForeground} />
                <Text style={styles.formInputText}>
                  {entryStartTime.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </Text>
              </TouchableOpacity>
              {showEntryStartPicker && (
                <DateTimePicker
                  value={entryStartTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, time) => {
                    setShowEntryStartPicker(Platform.OS === 'ios');
                    if (time) setEntryStartTime(time);
                  }}
                />
              )}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>End Time</Text>
              <TouchableOpacity 
                style={styles.formInput}
                onPress={() => setShowEntryEndPicker(true)}
              >
                <Feather name="clock" size={18} color={colors.mutedForeground} />
                <Text style={styles.formInputText}>
                  {entryEndTime.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </Text>
              </TouchableOpacity>
              {showEntryEndPicker && (
                <DateTimePicker
                  value={entryEndTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, time) => {
                    setShowEntryEndPicker(Platform.OS === 'ios');
                    if (time) setEntryEndTime(time);
                  }}
                />
              )}
            </View>
            
            <View style={styles.durationPreview}>
              <Feather name="trending-up" size={16} color={colors.primary} />
              <Text style={styles.durationPreviewText}>
                Duration: {(() => {
                  const diffMs = entryEndTime.getTime() - entryStartTime.getTime();
                  if (diffMs <= 0) return '--:--';
                  const hours = Math.floor(diffMs / 3600000);
                  const mins = Math.floor((diffMs % 3600000) / 60000);
                  return `${hours}h ${mins}m`;
                })()}
              </Text>
            </View>

            <View style={styles.formGroup}>
              <TouchableOpacity 
                style={styles.billableToggle}
                onPress={() => setEntryIsBillable(!entryIsBillable)}
                activeOpacity={0.7}
              >
                <Text style={styles.billableToggleLabel}>Billable</Text>
                <Feather 
                  name={entryIsBillable ? 'check-square' : 'square'} 
                  size={22} 
                  color={entryIsBillable ? ttConfig.statusColors.active : colors.mutedForeground} 
                />
              </TouchableOpacity>
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Job</Text>
              {inProgressJobs.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No active jobs available</Text>
                </View>
              ) : (
                inProgressJobs.map(job => (
                  <TouchableOpacity
                    key={job.id}
                    style={[
                      styles.jobSelectCard,
                      entryJobId === job.id && styles.jobSelectCardActive
                    ]}
                    onPress={() => setEntryJobId(job.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.jobSelectRadio, entryJobId === job.id && { borderColor: colors.primary }]}>
                      {entryJobId === job.id && <View style={styles.jobSelectRadioInner} />}
                    </View>
                    <View style={styles.jobSelectContent}>
                      <Text style={styles.jobSelectTitle}>{job.title}</Text>
                      <Text style={styles.jobSelectStatus}>{(job.status || '').replace('_', ' ')}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notes (optional)</Text>
              <TextInput
                style={styles.formTextArea}
                placeholder="What did you work on?"
                placeholderTextColor={colors.mutedForeground}
                value={entryDescription}
                onChangeText={setEntryDescription}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>
        </View>
      </AppBottomSheet>

      <AppBottomSheet
        visible={showDisputeModal}
        onDismiss={() => setShowDisputeModal(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={[styles.container, { paddingTop: spacing.lg }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setShowDisputeModal(false)}
              style={styles.modalCloseButton}
            >
              <Feather name="x" size={24} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Flag Entry</Text>
            <TouchableOpacity 
              onPress={handleSubmitDispute}
              disabled={isSubmittingDispute || !disputeReason.trim()}
              style={[styles.modalSaveButton, (!disputeReason.trim() || isSubmittingDispute) && styles.modalSaveButtonDisabled]}
            >
              <Text style={[styles.modalSaveText, (!disputeReason.trim() || isSubmittingDispute) && styles.modalSaveTextDisabled]}>
                {isSubmittingDispute ? 'Submitting...' : 'Submit'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
            <View style={{ 
              flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
              backgroundColor: colorWithOpacity(ttConfig.statusColors.break, 0.09), padding: spacing.md, borderRadius: radius.xl, marginBottom: spacing.lg 
            }}>
              <Feather name="alert-triangle" size={18} color={ttConfig.statusColors.break} />
              <Text style={{ flex: 1, color: colors.foreground, fontSize: typography.sizes.sm, lineHeight: 18 }}>
                Flag this entry if you believe it was edited incorrectly. Your employer will be notified to review it.
              </Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Reason for Dispute</Text>
              <TextInput
                style={styles.formTextArea}
                placeholder="e.g., I worked until 5pm not 4pm"
                placeholderTextColor={colors.mutedForeground}
                value={disputeReason}
                onChangeText={setDisputeReason}
                multiline
                numberOfLines={4}
              />
            </View>
          </ScrollView>
        </View>
      </AppBottomSheet>
    </>
  );
}
