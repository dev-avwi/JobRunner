import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
} from 'react-native-reanimated';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
let MapView: any;
let Marker: any;
type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
}
import { router, Stack } from 'expo-router';
import { OwnerOnlyGuard } from '../../src/components/ui/OwnerOnlyGuard';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography, shadows, usePageShell, iconSizes, sizes, fontWeights } from '../../src/lib/design-tokens';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { useIsTablet, useContentWidth } from '../../src/lib/device';
import { format, isToday, parseISO, isBefore, startOfDay, isSameDay, startOfWeek, addWeeks } from 'date-fns';
import { TeamAvatar } from '../../src/components/TeamAvatar';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { showToast } from '../../src/lib/toast';

// ─── Board constants ────────────────────────────────────────────────────────
const BOARD_START_HOUR = 7;
const BOARD_END_HOUR = 19;
const HOUR_HEIGHT = 64;
const BOARD_HEIGHT = (BOARD_END_HOUR - BOARD_START_HOUR) * HOUR_HEIGHT; // 768px
const TIME_GUTTER_WIDTH = 48;
const COLUMN_WIDTH = 160;
const COLUMN_GAP = 6;
const COLUMN_STRIDE = COLUMN_WIDTH + COLUMN_GAP;
const COLUMN_HEADER_HEIGHT = 56;
const WEEK_DAY_HEADER_HEIGHT = 36;
const WEEK_BOARD_HEADER_HEIGHT = WEEK_DAY_HEADER_HEIGHT + COLUMN_HEADER_HEIGHT;
const GHOST_CARD_HEIGHT = 52;
const MIN_CARD_HEIGHT = 28;
const SNAP_MINUTES = 15;

// ─── Types ───────────────────────────────────────────────────────────────────
type ViewMode = 'schedule' | 'kanban' | 'map';
type ScheduleViewMode = 'day' | 'week';

interface TeamMember {
  id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  roleName?: string;
  inviteStatus?: string;
}

interface JobData {
  id: string;
  title: string;
  status: string;
  address?: string;
  clientName?: string;
  assignedTo?: string;
  scheduledAt?: string;
  estimatedDuration?: number;
  priority?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  isRecurring?: boolean;
}

interface TeamPresence {
  userId: string;
  status: string;
  lastLocationLat?: number;
  lastLocationLng?: number;
}

interface GeocodedJob {
  job: JobData;
  lat: number;
  lng: number;
}

interface OpsHealth {
  conflicts: number;
  overdue: number;
  unassigned: number;
  totalToday: number;
  inProgress: number;
  completed: number;
}

interface UndoState {
  jobId: string;
  originalScheduledAt?: string;
  originalAssignedTo?: string;
  timer: ReturnType<typeof setTimeout>;
}

interface BoardColumn {
  id: string; // 'unassigned' | member.userId
  member?: TeamMember;
  label: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getMemberName(member: TeamMember): string {
  if (member.firstName && member.lastName) return `${member.firstName} ${member.lastName}`;
  if (member.firstName) return member.firstName;
  return member.email || 'Unknown';
}

function formatRelativeAgo(d: Date | null): string {
  if (!d) return 'never';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLng = (bLng - aLng) * Math.PI / 180;
  const sa = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa));
}

function jobTopOffset(scheduledAt: string): number {
  try {
    const d = parseISO(scheduledAt);
    const totalMins = d.getHours() * 60 + d.getMinutes();
    const boardStartMins = BOARD_START_HOUR * 60;
    const boardEndMins = BOARD_END_HOUR * 60;
    // Clamp so cards from outside board hours still appear at the edge, not invisible
    const clampedMins = Math.max(boardStartMins, Math.min(boardEndMins - 30, totalMins));
    return ((clampedMins - boardStartMins) / 60) * HOUR_HEIGHT;
  } catch {
    return 0;
  }
}

function isOutsideBoardHours(scheduledAt: string): boolean {
  try {
    const d = parseISO(scheduledAt);
    const totalMins = d.getHours() * 60 + d.getMinutes();
    return totalMins < BOARD_START_HOUR * 60 || totalMins >= BOARD_END_HOUR * 60;
  } catch {
    return false;
  }
}

function jobCardHeight(estimatedDuration?: number): number {
  if (!estimatedDuration) return MIN_CARD_HEIGHT * 2;
  return Math.max(MIN_CARD_HEIGHT, (estimatedDuration / 60) * HOUR_HEIGHT);
}

// ─── Main screen ─────────────────────────────────────────────────────────────
function DispatchBoardScreenInner() {
  const { colors, isDark } = useTheme();
  const confirm = useConfirmDialog();
  const responsiveShell = usePageShell();
  const contentWidth = useContentWidth();
  const isTabletDevice = useIsTablet();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(
    () => createStyles(colors, contentWidth, responsiveShell.paddingHorizontal, isTabletDevice, isDark),
    [colors, contentWidth, responsiveShell.paddingHorizontal, isTabletDevice, isDark],
  );

  // ── View state ──────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('schedule');
  const [scheduleViewMode, setScheduleViewMode] = useState<ScheduleViewMode>('day');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [presence, setPresence] = useState<TeamPresence[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningJob, setAssigningJob] = useState<JobData | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedMapJob, setSelectedMapJob] = useState<JobData | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());
  const [trayExpanded, setTrayExpanded] = useState(true);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [draggingJob, setDraggingJob] = useState<JobData | null>(null);
  const [isDraggingState, setIsDraggingState] = useState(false);

  // ── Drag refs / shared values ────────────────────────────────────────────
  const draggingJobRef = useRef<JobData | null>(null);
  const boardRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const hScrollOffsetRef = useRef(0);
  const containerRef = useRef<View>(null);
  const boardRef = useRef<View>(null);
  const mapRef = useRef<any>(null);
  const containerTopY = useSharedValue(0);
  const containerLeftX = useSharedValue(0);
  const ghostX = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const isDraggingValue = useSharedValue(false);

  const ghostCardStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: ghostX.value - containerLeftX.value - COLUMN_WIDTH / 2,
    top: ghostY.value - containerTopY.value - GHOST_CARD_HEIGHT / 2,
    width: COLUMN_WIDTH,
    opacity: isDraggingValue.value ? 0.88 : 0,
    zIndex: 2000,
    pointerEvents: 'none' as any,
    elevation: 24,
  }));

  // ── Data ─────────────────────────────────────────────────────────────────
  const safeFmt = (iso: string | null | undefined, pattern: string) => {
    if (!iso) return '';
    try { return format(parseISO(iso), pattern); } catch { return ''; }
  };

  const fetchData = useCallback(async () => {
    try {
      const [membersRes, jobsRes, presenceRes] = await Promise.all([
        api.get<TeamMember[]>('/api/team/members'),
        api.get<JobData[]>('/api/jobs'),
        api.get<TeamPresence[]>('/api/team/presence'),
      ]);
      if (Array.isArray(membersRes.data)) setTeamMembers(membersRes.data.filter(m => m.inviteStatus === 'accepted'));
      if (Array.isArray(jobsRes.data)) setJobs(jobsRes.data);
      if (Array.isArray(presenceRes.data)) setPresence(presenceRes.data);
      setLastSyncedAt(new Date());
    } catch (error) {
      console.error('Error fetching dispatch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // ── Derived data ─────────────────────────────────────────────────────────
  const activeJobs = useMemo(() =>
    jobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled' && j.status !== 'done'),
    [jobs],
  );

  const todayJobs = useMemo(() =>
    jobs.filter(j => {
      if (!j.scheduledAt) return false;
      try { return isToday(parseISO(j.scheduledAt)); } catch { return false; }
    }),
    [jobs],
  );

  const opsHealth: OpsHealth = useMemo(() => {
    const unassigned = activeJobs.filter(j => !j.assignedTo).length;
    const overdue = activeJobs.filter(j => {
      if (!j.scheduledAt) return false;
      try { return isBefore(parseISO(j.scheduledAt), startOfDay(new Date())) && j.status !== 'completed' && j.status !== 'done'; }
      catch { return false; }
    }).length;
    const slots: { start: number; end: number; userId?: string }[] = [];
    todayJobs.forEach(j => {
      if (!j.scheduledAt || !j.assignedTo) return;
      try {
        const start = parseISO(j.scheduledAt).getTime();
        const duration = (j.estimatedDuration || 60) * 60 * 1000;
        slots.push({ start, end: start + duration, userId: j.assignedTo });
      } catch { /* ignore */ }
    });
    const byUser = new Map<string, { start: number; end: number }[]>();
    for (const s of slots) {
      if (!s.userId) continue;
      const arr = byUser.get(s.userId);
      if (arr) arr.push({ start: s.start, end: s.end });
      else byUser.set(s.userId, [{ start: s.start, end: s.end }]);
    }
    let conflicts = 0;
    byUser.forEach(arr => {
      arr.sort((a, b) => a.start - b.start);
      for (let i = 1; i < arr.length; i++) {
        if (arr[i].start < arr[i - 1].end) conflicts++;
      }
    });
    return {
      conflicts,
      overdue,
      unassigned,
      totalToday: todayJobs.length,
      inProgress: activeJobs.filter(j => j.status === 'in_progress' || j.status === 'working').length,
      completed: jobs.filter(j => j.status === 'completed' || j.status === 'done').length,
    };
  }, [activeJobs, todayJobs, jobs]);

  const weekDays = useMemo(() => {
    const anchor = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    return days;
  }, [selectedDate]);

  // Board columns: one per team member (all accepted)
  const boardColumns = useMemo((): BoardColumn[] => {
    const cols: BoardColumn[] = teamMembers.map(m => ({
      id: m.userId,
      member: m,
      label: getMemberName(m),
    }));
    // Prepend unassigned column
    cols.unshift({ id: 'unassigned', label: 'Unassigned' });
    return cols;
  }, [teamMembers]);

  const weekBoardColumns = useMemo(
    () => weekDays.flatMap(date => boardColumns.map(column => ({ date, column }))),
    [weekDays, boardColumns],
  );

  // Jobs scheduled on the selected date
  const scheduledJobs = useMemo(() => {
    return jobs.filter(j => {
      if (!j.scheduledAt) return false;
      try { return isSameDay(parseISO(j.scheduledAt), selectedDate); } catch { return false; }
    });
  }, [jobs, selectedDate]);

  // Jobs without any scheduled time (for the tray)
  const unscheduledJobs = useMemo(() =>
    activeJobs.filter(j => !j.scheduledAt),
    [activeJobs],
  );

  const kanbanData = useMemo(() => {
    const unassigned = activeJobs.filter(j => !j.assignedTo);
    const inProgress = activeJobs.filter(j => j.status === 'in_progress' || j.status === 'working');
    const inProgressIds = new Set(inProgress.map(j => j.id));
    const assigned = activeJobs.filter(j => j.assignedTo && !inProgressIds.has(j.id));
    const completed = jobs.filter(j => j.status === 'completed' || j.status === 'done').slice(0, 20);
    return { unassigned, assigned, in_progress: inProgress, completed };
  }, [activeJobs, jobs]);

  const geocodedJobs = useMemo((): GeocodedJob[] =>
    activeJobs
      .filter(j => {
        const lat = j.latitude != null ? Number(j.latitude) : NaN;
        const lng = j.longitude != null ? Number(j.longitude) : NaN;
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      })
      .map(j => ({ job: j, lat: Number(j.latitude), lng: Number(j.longitude) })),
    [activeJobs],
  );

  const mapRegion = useMemo((): Region => {
    const points = geocodedJobs.map(g => ({ lat: g.lat, lng: g.lng }));
    if (points.length === 0) return { latitude: -16.9186, longitude: 145.7781, latitudeDelta: 0.15, longitudeDelta: 0.15 };
    if (points.length === 1) return { latitude: points[0].lat, longitude: points[0].lng, latitudeDelta: 0.02, longitudeDelta: 0.02 };
    const lats = points.map(p => p.lat);
    const lngs = points.map(p => p.lng);
    const minLat = Math.min(...lats); const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs); const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.02),
      longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.02),
    };
  }, [geocodedJobs]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const getStatusColor = (status: string, scheduledAt?: string): string => {
    if (scheduledAt) {
      try {
        if (isBefore(parseISO(scheduledAt), startOfDay(new Date())) && status !== 'completed' && status !== 'done')
          return colors.warning;
      } catch { /* ignore */ }
    }
    switch (status) {
      case 'in_progress': case 'working': return colors.success;
      case 'completed': case 'done': return colors.mutedForeground;
      case 'en_route': case 'on_my_way': return colors.info || colors.primary;
      case 'pending': return colors.warning;
      default: return colors.info || colors.primary;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'scheduled': return 'Scheduled';
      case 'en_route': case 'on_my_way': return 'En Route';
      case 'in_progress': case 'working': return 'In Progress';
      case 'completed': case 'done': return 'Complete';
      default: return status;
    }
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try { return format(parseISO(dateStr), 'h:mm a'); } catch { return ''; }
  };

  const handleAssign = async (memberId: string) => {
    if (!assigningJob || isAssigning) return;
    setIsAssigning(true);
    try {
      await api.patch(`/api/jobs/${assigningJob.id}`, { assignedTo: memberId });
      setJobs(prev => prev.map(j => j.id === assigningJob.id ? { ...j, assignedTo: memberId, status: j.status === 'pending' ? 'scheduled' : j.status } : j));
      setShowAssignModal(false);
      setAssigningJob(null);
      const member = teamMembers.find(m => m.userId === memberId);
      Alert.alert('Assigned', `Job assigned to ${member ? getMemberName(member) : 'team member'}`);
    } catch {
      Alert.alert('Error', 'Failed to assign job');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassign = async (job: JobData) => {
    const ok = await confirm({
      title: 'Unassign Job',
      message: `Remove assignment from "${job.title}"?`,
      confirmText: 'Unassign',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (ok) {
      try {
        await api.patch(`/api/jobs/${job.id}`, { assignedTo: null });
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, assignedTo: undefined } : j));
      } catch {
        Alert.alert('Error', 'Failed to unassign job');
      }
    }
  };

  const openAssignModal = (job: JobData) => {
    setAssigningJob(job);
    setShowAssignModal(true);
  };

  const navigateWeek = (direction: -1 | 1) => {
    setSelectedDate(prev => addWeeks(prev, direction));
  };

  // ── Drag-drop logic ───────────────────────────────────────────────────────
  const startDrag = (job: JobData) => {
    draggingJobRef.current = job;
    setDraggingJob(job);
    setIsDraggingState(true);
  };

  const clearDrag = () => {
    draggingJobRef.current = null;
    setDraggingJob(null);
    setIsDraggingState(false);
  };

  const dismissUndo = () => {
    setUndoState(prev => {
      if (prev) clearTimeout(prev.timer);
      return null;
    });
  };

  const handleUndo = async () => {
    if (!undoState) return;
    clearTimeout(undoState.timer);
    const { jobId, originalScheduledAt, originalAssignedTo } = undoState;
    setUndoState(null);
    try {
      await api.patch(`/api/jobs/${jobId}`, {
        scheduledAt: originalScheduledAt || null,
        assignedTo: originalAssignedTo || null,
      });
      setJobs(prev => prev.map(j =>
        j.id === jobId ? { ...j, scheduledAt: originalScheduledAt, assignedTo: originalAssignedTo } : j,
      ));
    } catch {
      showToast({ type: 'error', message: 'Could not undo' });
    }
  };

  const handleBoardDrop = (absX: number, absY: number) => {
    const job = draggingJobRef.current;
    clearDrag();
    if (!job || !boardRectRef.current) return;

    const rect = boardRectRef.current;
    const relX = absX - rect.x - TIME_GUTTER_WIDTH + hScrollOffsetRef.current;
    const headerHeight = scheduleViewMode === 'week' ? WEEK_BOARD_HEADER_HEIGHT : COLUMN_HEADER_HEIGHT;
    const relY = absY - rect.y - headerHeight;

    if (relX < 0 || relY < 0 || relY > BOARD_HEIGHT) return;

    const colIdx = Math.floor(relX / COLUMN_STRIDE);
    const dropColumns = scheduleViewMode === 'week' ? weekBoardColumns : null;
    if (scheduleViewMode === 'week' ? colIdx >= weekBoardColumns.length : colIdx >= boardColumns.length) return;

    const hourFraction = relY / HOUR_HEIGHT;
    const totalMinutes = (BOARD_START_HOUR + hourFraction) * 60;
    const snappedMinutes = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES;
    const clampedMinutes = Math.max(BOARD_START_HOUR * 60, Math.min((BOARD_END_HOUR - 0.25) * 60, snappedMinutes));

    const targetDate = scheduleViewMode === 'week' ? weekBoardColumns[colIdx].date : selectedDate;
    const newDate = new Date(targetDate);
    newDate.setHours(Math.floor(clampedMinutes / 60), clampedMinutes % 60, 0, 0);

    const targetCol = dropColumns ? dropColumns[colIdx].column : boardColumns[colIdx];
    const newAssignedTo = targetCol.id === 'unassigned' ? undefined : targetCol.id;

    // Save original state for undo
    const originalScheduledAt = job.scheduledAt;
    const originalAssignedTo = job.assignedTo;
    const newScheduledAt = newDate.toISOString();

    // Optimistic update
    setJobs(prev => prev.map(j => j.id === job.id
      ? { ...j, scheduledAt: newScheduledAt, assignedTo: newAssignedTo }
      : j,
    ));

    // Show undo banner
    const timer = setTimeout(dismissUndo, 5000);
    setUndoState({ jobId: job.id, originalScheduledAt, originalAssignedTo, timer });

    // Persist
    api.patch(`/api/jobs/${job.id}`, { scheduledAt: newScheduledAt, assignedTo: newAssignedTo || null })
      .catch(() => {
        // Revert on error
        setJobs(prev => prev.map(j => j.id === job.id
          ? { ...j, scheduledAt: originalScheduledAt, assignedTo: originalAssignedTo }
          : j,
        ));
        dismissUndo();
        showToast({ type: 'error', message: 'Failed to update job' });
      });
  };

  // Must be a plain JS function (not a worklet) so it can call measureInWindow via the bridge
  const measureBoardForDrop = () => {
    boardRef.current?.measureInWindow((bx, by, bw, bh) => {
      boardRectRef.current = { x: bx, y: by, w: bw, h: bh };
    });
  };

  // Build gesture for a draggable card
  const buildDragGesture = (job: JobData) =>
    Gesture.Pan()
      .activateAfterLongPress(200)
      .onStart((e) => {
        ghostX.value = e.absoluteX;
        ghostY.value = e.absoluteY;
        isDraggingValue.value = true;
        // Both calls must go through runOnJS — worklets cannot touch JS refs or bridge APIs
        runOnJS(startDrag)(job);
        runOnJS(measureBoardForDrop)();
      })
      .onUpdate((e) => {
        ghostX.value = e.absoluteX;
        ghostY.value = e.absoluteY;
      })
      .onEnd((e) => {
        runOnJS(handleBoardDrop)(e.absoluteX, e.absoluteY);
        isDraggingValue.value = false;
      })
      .onFinalize(() => {
        isDraggingValue.value = false;
        runOnJS(clearDrag)();
      });

  // ── Render parts ──────────────────────────────────────────────────────────
  const renderHero = () => (
    <View style={styles.heroSection}>
      <Text style={styles.pageTitle}>Dispatch Board</Text>
      <Text style={styles.pageSubtitle}>Manage job assignments and scheduling</Text>
      <View style={styles.subtitleRow}>
        <View style={[styles.syncDot, { backgroundColor: refreshing ? colors.warning : colors.success }]} />
        <Text style={styles.pageSubtitle}>{refreshing ? ' Syncing...' : ` Updated ${formatRelativeAgo(lastSyncedAt)}`}</Text>
      </View>
    </View>
  );

  const renderTabs = () => {
    const tabs: { key: ViewMode; icon: keyof typeof Feather.glyphMap; label: string }[] = [
      { key: 'schedule', icon: 'calendar', label: 'Schedule' },
      { key: 'kanban', icon: 'grid', label: 'Kanban' },
      { key: 'map', icon: 'map', label: 'Map' },
    ];
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContainer}>
        {tabs.map(t => {
          const active = viewMode === t.key;
          return (
            <PressableRow
              key={t.key}
              style={[styles.tabButton, active ? styles.tabButtonActive : styles.tabButtonInactive]}
              onPress={() => setViewMode(t.key)}
            >
              <Feather name={t.icon} size={iconSizes.sm} color={active ? (colors.primaryForeground || '#fff') : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: active ? (colors.primaryForeground || '#fff') : colors.mutedForeground }]}>{t.label}</Text>
            </PressableRow>
          );
        })}
      </ScrollView>
    );
  };

  const renderOpsHealth = () => {
    const stats = [
      { value: opsHealth.conflicts, label: 'Conflicts', color: colors.destructive },
      { value: opsHealth.overdue, label: 'Overdue', color: colors.warning },
      { value: opsHealth.unassigned, label: 'Unassigned', color: colors.warning },
      { value: opsHealth.totalToday, label: 'Today', color: colors.foreground },
    ];
    return (
      <>
        <View style={styles.statBar}>
          {stats.map((s, i) => (
            <View key={s.label} style={styles.statBarItemRow}>
              <View style={styles.statBarItem}>
                <Text style={[styles.statBarValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statBarLabel}>{s.label}</Text>
              </View>
              {i < stats.length - 1 && <View style={styles.statBarDivider} />}
            </View>
          ))}
        </View>
        <View style={styles.secondaryPillRow}>
          <View style={[styles.secondaryPill, { backgroundColor: `${colors.info || colors.primary}18` }]}>
            <View style={[styles.secondaryDot, { backgroundColor: colors.info || colors.primary }]} />
            <Text style={[styles.secondaryPillText, { color: colors.info || colors.primary }]}>{opsHealth.inProgress} In Progress</Text>
          </View>
          <View style={[styles.secondaryPill, { backgroundColor: `${colors.success}18` }]}>
            <View style={[styles.secondaryDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.secondaryPillText, { color: colors.success }]}>{opsHealth.completed} Completed</Text>
          </View>
        </View>
      </>
    );
  };

  const renderScheduleView = () => {
    const hours = Array.from({ length: BOARD_END_HOUR - BOARD_START_HOUR + 1 }, (_, i) => BOARD_START_HOUR + i);
    const weekGroupWidth = boardColumns.length * COLUMN_STRIDE;
    const visibleScheduledJobs = scheduleViewMode === 'week'
      ? jobs.filter(j => {
        if (!j.scheduledAt) return false;
        try {
          return weekDays.some(d => isSameDay(parseISO(j.scheduledAt!), d));
        } catch {
          return false;
        }
      })
      : scheduledJobs;

    const renderColumnHeader = (col: BoardColumn) => (
      <>
        {col.member ? (
          <TeamAvatar
            firstName={col.member.firstName}
            lastName={col.member.lastName}
            userId={String(col.member.userId)}
            themeColor={(col.member as any).themeColor}
            size={28}
          />
        ) : (
          <View style={[styles.unassignedAvatar, { backgroundColor: colors.muted }]}>
            <Feather name="user" size={14} color={colors.mutedForeground} />
          </View>
        )}
        <Text style={styles.columnHeaderName} numberOfLines={1}>
          {col.member ? getMemberName(col.member).split(' ')[0] : 'Unassigned'}
        </Text>
      </>
    );

    const renderBoardCard = (job: JobData, memberColor?: string) => {
      const topPx = jobTopOffset(job.scheduledAt!);
      const heightPx = jobCardHeight(job.estimatedDuration);
      const statusColor = getStatusColor(job.status, job.scheduledAt);
      const accentColor = memberColor || statusColor;
      const isBeingDragged = draggingJob?.id === job.id;
      const gesture = buildDragGesture(job);
      return (
        <GestureDetector key={job.id} gesture={gesture}>
          <Animated.View
            style={[
              styles.boardCard,
              {
                top: topPx,
                height: heightPx,
                borderLeftColor: accentColor,
                backgroundColor: isDark
                  ? `${accentColor}18`
                  : `${accentColor}10`,
                opacity: isBeingDragged ? 0.35 : 1,
              },
            ]}
          >
            <PressableRow
              style={{ flex: 1 }}
              onPress={() => router.push(`/job/${job.id}` as any)}
            >
              <Text style={styles.boardCardTitle} numberOfLines={2}>{job.title}</Text>
              {heightPx > 40 && (
                <Text style={styles.boardCardTime} numberOfLines={1}>
                  {formatTime(job.scheduledAt)}
                </Text>
              )}
              {heightPx > 56 && job.clientName && (
                <Text style={styles.boardCardClient} numberOfLines={1}>{job.clientName}</Text>
              )}
            </PressableRow>
          </Animated.View>
        </GestureDetector>
      );
    };

    const renderBoardColumn = (col: BoardColumn, colIdx: number, columnJobs: JobData[], key: string) => {
      const memberColor = (col.member as any)?.themeColor as string | undefined;
      return (
        <View
          key={key}
          style={[
            styles.column,
            colIdx < boardColumns.length - 1 && styles.columnBorderRight,
          ]}
        >
          {hours.map(h => (
            <View
              key={h}
              style={[styles.hourLine, { top: (h - BOARD_START_HOUR) * HOUR_HEIGHT }]}
            />
          ))}
          {hours.slice(0, -1).map(h => (
            <View
              key={`half-${h}`}
              style={[styles.halfHourLine, { top: (h - BOARD_START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }]}
            />
          ))}
          {columnJobs.map(job => renderBoardCard(job, memberColor))}
        </View>
      );
    };

    return (
      <View>
        {/* Day/week view toggle */}
        <View style={styles.scheduleToolbar}>
          <View style={styles.scheduleModeToggle}>
            {(['day', 'week'] as ScheduleViewMode[]).map(mode => {
              const active = scheduleViewMode === mode;
              return (
                <PressableRow
                  key={mode}
                  testID={`dispatch-schedule-${mode}-toggle`}
                  style={[styles.scheduleModeButton, active && styles.scheduleModeButtonActive]}
                  onPress={() => setScheduleViewMode(mode)}
                >
                  <Text style={[styles.scheduleModeText, { color: active ? (colors.primaryForeground || '#fff') : colors.mutedForeground }]}>
                    {mode === 'day' ? 'Day' : 'Week'}
                  </Text>
                </PressableRow>
              );
            })}
          </View>
          {scheduleViewMode === 'week' ? (
            <View style={styles.weekNavRow}>
              <PressableRow
                testID="dispatch-prev-week"
                style={styles.weekNavButton}
                onPress={() => navigateWeek(-1)}
              >
                <Feather name="chevron-left" size={iconSizes.sm} color={colors.foreground} />
              </PressableRow>
              <Text style={styles.weekNavRangeText}>
                {`${format(weekDays[0], 'd MMM')} – ${format(weekDays[6], 'd MMM yyyy')}`}
              </Text>
              <PressableRow
                testID="dispatch-next-week"
                style={styles.weekNavButton}
                onPress={() => navigateWeek(1)}
              >
                <Feather name="chevron-right" size={iconSizes.sm} color={colors.foreground} />
              </PressableRow>
            </View>
          ) : (
            <Text style={styles.scheduleRangeText}>
              {format(selectedDate, 'EEE, d MMM')}
            </Text>
          )}
        </View>

        {/* Date strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekStripRow}>
          {weekDays.map(d => {
            const isSel = isSameDay(d, selectedDate);
            const isTodayDay = isToday(d);
            return (
              <PressableRow
                key={d.toISOString()}
                onPress={() => setSelectedDate(d)}
                style={[styles.dayPill, isSel ? styles.dayPillActive : styles.dayPillInactive]}
              >
                <Text style={[styles.dayPillDow, { color: isSel ? (colors.primaryForeground || '#fff') : colors.mutedForeground }]}>
                  {format(d, 'EEE').toUpperCase()}
                </Text>
                <Text style={[styles.dayPillNum, { color: isSel ? (colors.primaryForeground || '#fff') : colors.foreground }]}>
                  {format(d, 'd')}
                </Text>
                {isTodayDay && !isSel && <View style={[styles.todayDot, { backgroundColor: colors.primary }]} />}
              </PressableRow>
            );
          })}
        </ScrollView>

        {/* Hint */}
        <Text style={styles.dragHint}>Hold and drag cards to reschedule or reassign</Text>

        {/* Notice for jobs that fall outside the 7am–7pm visible window */}
        {(() => {
          const offHours = visibleScheduledJobs.filter(j => j.scheduledAt && isOutsideBoardHours(j.scheduledAt));
          if (offHours.length === 0) return null;
          return (
            <View style={[styles.offHoursBanner, { backgroundColor: `${colors.warning}18`, borderColor: `${colors.warning}40` }]}>
              <Feather name="clock" size={13} color={colors.warning} />
              <Text style={[styles.offHoursBannerText, { color: colors.warning }]}>
                {offHours.length} job{offHours.length === 1 ? '' : 's'} outside 7am–7pm are pinned to the board edge
              </Text>
            </View>
          );
        })()}

        {/* Board — single horizontal ScrollView so headers and columns are always aligned */}
        <View
          ref={boardRef}
          style={styles.boardOuter}
          onLayout={() => {
            boardRef.current?.measureInWindow((x, y, w, h) => {
              boardRectRef.current = { x, y, w, h };
            });
          }}
        >
          <View style={{ flexDirection: 'row' }}>
            {/* Fixed left gutter: header spacer + time labels */}
            <View style={styles.timeGutter}>
              {/* Spacer aligned with column header height */}
              <View
                style={[
                  styles.timeGutterHeaderSpacer,
                  {
                    height: scheduleViewMode === 'week' ? WEEK_BOARD_HEADER_HEIGHT : COLUMN_HEADER_HEIGHT,
                    borderBottomColor: colors.cardBorder,
                  },
                ]}
              />
              {hours.map(h => (
                <View key={h} style={styles.timeGutterCell}>
                  <Text style={styles.timeLabel}>
                    {h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
                  </Text>
                </View>
              ))}
            </View>

            {/* Single horizontal ScrollView: headers + grid in one scroll container */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEnabled={!isDraggingState}
              onScroll={e => { hScrollOffsetRef.current = e.nativeEvent.contentOffset.x; }}
              scrollEventThrottle={16}
            >
              {scheduleViewMode === 'day' ? (
                <View>
                  <View style={[styles.boardHeaderRow, { borderBottomColor: colors.cardBorder }]}>
                    {boardColumns.map(col => (
                      <View
                        key={col.id}
                        style={[
                          styles.columnHeader,
                          col.member && (col.member as any).themeColor
                            ? { borderTopWidth: 3, borderTopColor: (col.member as any).themeColor }
                            : undefined,
                        ]}
                      >
                        {renderColumnHeader(col)}
                      </View>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', height: BOARD_HEIGHT }}>
                    {boardColumns.map((col, colIdx) => {
                      const colJobs = scheduledJobs.filter(j =>
                        col.id === 'unassigned' ? !j.assignedTo : j.assignedTo === col.id,
                      );
                      return renderBoardColumn(col, colIdx, colJobs, col.id);
                    })}
                  </View>
                </View>
              ) : (
                <View>
                  <View style={styles.weekDayHeaderRow}>
                    {weekDays.map(day => {
                      const dayJobs = visibleScheduledJobs.filter(j => isSameDay(parseISO(j.scheduledAt!), day));
                      const today = isToday(day);
                      return (
                        <View
                          key={day.toISOString()}
                          style={[
                            styles.weekDayHeader,
                            { width: weekGroupWidth, borderRightColor: colors.cardBorder },
                            today && { backgroundColor: `${colors.primary}18` },
                          ]}
                        >
                          <Text style={[styles.weekDayHeaderText, { color: today ? colors.primary : colors.foreground }]}>
                            {format(day, 'EEE').toUpperCase()}
                          </Text>
                          <Text style={styles.weekDayHeaderSubtext}>
                            {format(day, 'd MMM')} · {dayJobs.length} {dayJobs.length === 1 ? 'job' : 'jobs'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  <View style={[styles.boardHeaderRow, { borderBottomColor: colors.cardBorder }]}>
                    {weekBoardColumns.map(({ date, column }, index) => (
                      <View
                        key={`${date.toISOString()}-${column.id}`}
                        style={[
                          styles.columnHeader,
                          index % boardColumns.length === 0 && styles.weekColumnHeaderStart,
                          column.member && (column.member as any).themeColor
                            ? { borderTopWidth: 3, borderTopColor: (column.member as any).themeColor }
                            : undefined,
                        ]}
                      >
                        {renderColumnHeader(column)}
                      </View>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', height: BOARD_HEIGHT }}>
                    {weekBoardColumns.map(({ date, column }, index) => {
                      const colJobs = visibleScheduledJobs.filter(j => {
                        if (!j.scheduledAt || !isSameDay(parseISO(j.scheduledAt), date)) return false;
                        return column.id === 'unassigned' ? !j.assignedTo : j.assignedTo === column.id;
                      });
                      return renderBoardColumn(
                        column,
                        index % boardColumns.length,
                        colJobs,
                        `${date.toISOString()}-${column.id}`,
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>

        {/* Unscheduled tray */}
        <View style={styles.trayContainer}>
          <PressableRow
            style={styles.trayHeader}
            onPress={() => setTrayExpanded(v => !v)}
          >
            <Feather name="inbox" size={16} color={colors.mutedForeground} />
            <Text style={styles.trayTitle}>Unscheduled</Text>
            <View style={[styles.trayCountBadge, { backgroundColor: `${colors.warning}20` }]}>
              <Text style={[styles.trayCountText, { color: colors.warning }]}>{unscheduledJobs.length}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Feather
              name={trayExpanded ? 'chevron-down' : 'chevron-up'}
              size={16}
              color={colors.mutedForeground}
            />
          </PressableRow>
          {trayExpanded && (
            unscheduledJobs.length === 0 ? (
              <View style={styles.trayEmpty}>
                <Text style={styles.trayEmptyText}>All jobs are scheduled</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.trayScrollContent}
              >
                {unscheduledJobs.map(job => {
                  const statusColor = getStatusColor(job.status, job.scheduledAt);
                  const isBeingDragged = draggingJob?.id === job.id;
                  const gesture = buildDragGesture(job);
                  return (
                    <GestureDetector key={job.id} gesture={gesture}>
                      <Animated.View
                        style={[styles.trayCard, { borderLeftColor: statusColor, opacity: isBeingDragged ? 0.3 : 1 }]}
                      >
                        <PressableRow onPress={() => router.push(`/job/${job.id}` as any)}>
                          <Text style={styles.trayCardTitle} numberOfLines={2}>{job.title}</Text>
                          {job.clientName && (
                            <Text style={styles.trayCardMeta} numberOfLines={1}>{job.clientName}</Text>
                          )}
                          <View style={styles.trayCardHint}>
                            <Feather name="move" size={10} color={colors.mutedForeground} />
                            <Text style={styles.trayCardHintText}>Drag to board</Text>
                          </View>
                        </PressableRow>
                      </Animated.View>
                    </GestureDetector>
                  );
                })}
              </ScrollView>
            )
          )}
        </View>
      </View>
    );
  };

  const renderKanbanCard = (job: JobData, color: string) => {
    const assigned = job.assignedTo ? teamMembers.find(m => m.userId === job.assignedTo) : null;
    return (
      <PressableRow
        key={job.id}
        style={styles.kanbanMiniCard}
        onPress={() => router.push(`/job/${job.id}` as any)}
        onLongPress={() => openAssignModal(job)}
      >
        <View style={[styles.cardAccentMD, { backgroundColor: color }]} />
        <Text style={styles.kanbanMiniTitle} numberOfLines={2}>{job.title}</Text>
        {job.scheduledAt && (
          <Text style={styles.kanbanMiniTime}>{formatTime(job.scheduledAt)}</Text>
        )}
        {assigned ? (
          <View style={styles.kanbanMiniWorker}>
            <TeamAvatar
              firstName={assigned.firstName}
              lastName={assigned.lastName}
              userId={String(assigned.userId)}
              themeColor={(assigned as any).themeColor}
              size={18}
            />
            <Text style={styles.kanbanMiniWorkerName} numberOfLines={1}>{getMemberName(assigned).split(' ')[0]}</Text>
          </View>
        ) : (
          <View style={styles.kanbanMiniWorker}>
            <Feather name="user" size={12} color={colors.mutedForeground} />
            <Text style={[styles.kanbanMiniWorkerName, { color: colors.mutedForeground }]}>Unassigned</Text>
          </View>
        )}
      </PressableRow>
    );
  };

  const renderKanbanView = () => {
    const cols: { key: keyof typeof kanbanData; label: string; color: string }[] = [
      { key: 'unassigned', label: 'Unassigned', color: colors.warning },
      { key: 'assigned', label: 'Assigned', color: colors.info || colors.primary },
      { key: 'in_progress', label: 'In Progress', color: colors.success },
      { key: 'completed', label: 'Completed', color: colors.mutedForeground },
    ];
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kanbanScrollContent}>
        {cols.map(col => {
          const list = kanbanData[col.key] || [];
          return (
            <View key={col.key} style={styles.kanbanColumn}>
              <View style={styles.kanbanColumnHeader}>
                <View style={[styles.kanbanColumnDot, { backgroundColor: col.color }]} />
                <Text style={styles.kanbanColumnLabel}>{col.label}</Text>
                <View style={[styles.kanbanCountBadge, { backgroundColor: `${col.color}22` }]}>
                  <Text style={[styles.kanbanCountText, { color: col.color }]}>{list.length}</Text>
                </View>
              </View>
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {list.length === 0 ? (
                  <View style={styles.kanbanEmpty}>
                    <Text style={styles.kanbanEmptyText}>No jobs</Text>
                  </View>
                ) : (
                  list.map(j => renderKanbanCard(j, col.color))
                )}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderMapView = () => {
    if (Platform.OS === 'web' || !MapView) {
      return (
        <View style={styles.emptyBox}>
          <Feather name="map" size={iconSizes['2xl']} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>Map view is available in the native app</Text>
        </View>
      );
    }
    const screenHeight = Dimensions.get('window').height;
    const mapHeight = screenHeight - 360;
    return (
      <View style={[styles.mapCard, { height: Math.max(320, mapHeight) }]}>
        <MapView ref={mapRef} style={{ flex: 1 }} initialRegion={mapRegion} showsUserLocation>
          {geocodedJobs.map(({ job, lat, lng }) => {
            const c = getStatusColor(job.status, job.scheduledAt);
            return (
              <Marker
                key={`job-${job.id}`}
                coordinate={{ latitude: lat, longitude: lng }}
                pinColor={c}
                onPress={() => setSelectedMapJob(job)}
              />
            );
          })}
        </MapView>
      </View>
    );
  };

  const renderMapSheet = () => {
    if (!selectedMapJob) return null;
    const job = selectedMapJob;
    const sc = getStatusColor(job.status, job.scheduledAt);
    const assigned = job.assignedTo ? teamMembers.find(m => m.userId === job.assignedTo) : null;
    const jobLat = job.latitude != null ? Number(job.latitude) : NaN;
    const jobLng = job.longitude != null ? Number(job.longitude) : NaN;
    let nearby: { member: TeamMember; km: number }[] = [];
    if (!isNaN(jobLat) && !isNaN(jobLng)) {
      nearby = teamMembers
        .map(m => {
          const p = presence.find(pr => pr.userId === m.userId);
          if (!p || p.lastLocationLat == null || p.lastLocationLng == null) return null;
          return { member: m, km: haversineKm(jobLat, jobLng, p.lastLocationLat, p.lastLocationLng) };
        })
        .filter((x): x is { member: TeamMember; km: number } => x !== null)
        .sort((a, b) => a.km - b.km)
        .slice(0, 5);
    }
    return (
      <AppBottomSheet visible onDismiss={() => setSelectedMapJob(null)} title={job.title} showCloseButton>
        <View>
          <View style={[styles.statusPillSheet, { backgroundColor: `${sc}22` }]}>
            <Text style={[styles.statusPillSheetText, { color: sc }]}>{getStatusLabel(job.status)}</Text>
          </View>
          {job.address && (
            <View style={styles.sheetMetaRow}>
              <Feather name="map-pin" size={14} color={colors.mutedForeground} />
              <Text style={styles.sheetMetaText}>{job.address}</Text>
            </View>
          )}
          {job.scheduledAt && (
            <View style={styles.sheetMetaRow}>
              <Feather name="clock" size={14} color={colors.mutedForeground} />
              <Text style={styles.sheetMetaText}>{safeFmt(job.scheduledAt, 'EEE, d MMM · h:mm a')}</Text>
            </View>
          )}
          {assigned && (
            <View style={styles.sheetMetaRow}>
              <Feather name="user" size={14} color={colors.mutedForeground} />
              <Text style={styles.sheetMetaText}>Assigned to {getMemberName(assigned)}</Text>
            </View>
          )}
          <Text style={styles.sheetEyebrow}>Nearby workers</Text>
          {nearby.length === 0 ? (
            <Text style={styles.sheetMutedText}>No worker locations available</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyRow}>
              {nearby.map(({ member, km }) => (
                <PressableRow
                  key={member.id}
                  style={styles.nearbyCard}
                  onPress={() => { setSelectedMapJob(null); openAssignModal(job); }}
                >
                  <TeamAvatar
                    firstName={member.firstName}
                    lastName={member.lastName}
                    userId={String(member.userId)}
                    themeColor={(member as any).themeColor}
                    size={36}
                  />
                  <Text style={styles.nearbyName} numberOfLines={1}>{getMemberName(member).split(' ')[0]}</Text>
                  <Text style={styles.nearbyKm}>{km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`}</Text>
                </PressableRow>
              ))}
            </ScrollView>
          )}
          <PressableRow
            style={[styles.sheetPrimaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => { const id = job.id; setSelectedMapJob(null); router.push(`/job/${id}` as any); }}
          >
            <Feather name="eye" size={16} color={colors.primaryForeground || '#fff'} />
            <Text style={[styles.sheetPrimaryBtnText, { color: colors.primaryForeground || '#fff' }]}>View Job</Text>
          </PressableRow>
          <PressableRow
            style={[styles.sheetSecondaryBtn, { borderColor: colors.cardBorder }]}
            onPress={() => { setSelectedMapJob(null); openAssignModal(job); }}
          >
            <Feather name="user-plus" size={16} color={colors.foreground} />
            <Text style={[styles.sheetSecondaryBtnText, { color: colors.foreground }]}>
              {job.assignedTo ? 'Reassign' : 'Assign'}
            </Text>
          </PressableRow>
        </View>
      </AppBottomSheet>
    );
  };

  const renderAssignModal = () => (
    <AppBottomSheet
      visible={showAssignModal}
      onDismiss={() => { setShowAssignModal(false); setAssigningJob(null); }}
      title={assigningJob?.assignedTo ? 'Reassign Job' : 'Assign Job'}
      showCloseButton
    >
      <View>
        {assigningJob && (
          <View style={styles.assignJobInfo}>
            <Text style={styles.assignJobInfoTitle}>{assigningJob.title}</Text>
            {assigningJob.scheduledAt && (
              <Text style={styles.assignJobInfoMeta}>{safeFmt(assigningJob.scheduledAt, 'EEE, d MMM · h:mm a')}</Text>
            )}
          </View>
        )}
        {assigningJob?.assignedTo && (
          <PressableRow style={[styles.assignMemberRow, { borderColor: colors.destructive }]} onPress={() => handleUnassign(assigningJob)}>
            <View style={[styles.assignMemberAvatarFallback, { backgroundColor: colors.destructive }]}>
              <Feather name="user-x" size={16} color={colors.destructiveForeground || '#fff'} />
            </View>
            <Text style={[styles.assignMemberName, { color: colors.destructive }]}>Unassign</Text>
          </PressableRow>
        )}
        {teamMembers.map(member => {
          const isCurrent = assigningJob?.assignedTo === member.userId;
          return (
            <PressableRow
              key={member.id}
              style={[styles.assignMemberRow, isCurrent && { borderColor: colors.primary }]}
              onPress={() => handleAssign(member.userId)}
              disabled={isAssigning || isCurrent}
            >
              <TeamAvatar
                firstName={member.firstName}
                lastName={member.lastName}
                userId={String(member.userId)}
                themeColor={(member as any).themeColor}
                size={36}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.assignMemberName} numberOfLines={1}>{getMemberName(member)}</Text>
                {member.roleName && <Text style={styles.assignMemberRole} numberOfLines={1}>{member.roleName}</Text>}
              </View>
              {isCurrent && <Feather name="check" size={18} color={colors.primary} />}
            </PressableRow>
          );
        })}
        {isAssigning && (
          <View style={styles.assignLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.assignLoadingText}>Assigning...</Text>
          </View>
        )}
      </View>
    </AppBottomSheet>
  );

  const renderDragGhost = () => {
    const job = draggingJob;
    if (!job) return null;
    const sc = getStatusColor(job.status, job.scheduledAt);
    return (
      <Animated.View style={[styles.ghostCard, ghostCardStyle, { borderLeftColor: sc }]} pointerEvents="none">
        <Text style={styles.ghostCardTitle} numberOfLines={2}>{job.title}</Text>
        {job.clientName && <Text style={styles.ghostCardMeta} numberOfLines={1}>{job.clientName}</Text>}
      </Animated.View>
    );
  };

  const renderUndoBanner = () => {
    if (!undoState) return null;
    return (
      <View style={[styles.undoBanner, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <Feather name="check-circle" size={16} color={colors.success} />
        <Text style={[styles.undoBannerText, { color: colors.foreground }]}>Job rescheduled</Text>
        <View style={{ flex: 1 }} />
        <PressableRow style={[styles.undoBtn, { borderColor: colors.primary }]} onPress={handleUndo}>
          <Text style={[styles.undoBtnText, { color: colors.primary }]}>Undo</Text>
        </PressableRow>
      </View>
    );
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        ref={containerRef}
        style={styles.container}
        onLayout={() => {
          containerRef.current?.measureInWindow((x, y) => {
            containerLeftX.value = x;
            containerTopY.value = y;
          });
        }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomNavHeight + spacing['2xl'] }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isDraggingState}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {renderHero()}
          {renderTabs()}
          {renderOpsHealth()}
          {viewMode === 'schedule' && renderScheduleView()}
          {viewMode === 'kanban' && renderKanbanView()}
          {viewMode === 'map' && renderMapView()}
        </ScrollView>
        {renderDragGhost()}
        {renderUndoBanner()}
        {renderAssignModal()}
        {renderMapSheet()}
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const createStyles = (colors: ThemeColors, contentWidth: number, responsivePadding: number, isTabletDevice: boolean, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: responsivePadding,
    paddingTop: spacing.md,
  },

  // Hero
  heroSection: {
    marginBottom: spacing.md,
  },
  pageTitle: {
    fontSize: typography.sizes['3xl'],
    fontWeight: fontWeights.extrabold,
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    height: sizes.filterChipHeight,
    borderRadius: radius.pill,
    gap: spacing.sm,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabButtonInactive: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tabText: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
  },

  // Ops Health
  statBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius['2xl'],
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  statBarItemRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statBarItem: {
    flex: 1,
    alignItems: 'center',
  },
  statBarValue: {
    fontSize: typography.sizes.xl,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.5,
  },
  statBarLabel: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
    marginTop: 3,
  },
  statBarDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.cardBorder,
  },
  secondaryPillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  secondaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  secondaryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  secondaryPillText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.bold,
  },

  emptyBox: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },

  // Schedule - date strip
  weekStripRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  dayPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    minWidth: 48,
    position: 'relative',
  },
  dayPillActive: {
    backgroundColor: colors.primary,
  },
  dayPillInactive: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  dayPillDow: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.5,
  },
  dayPillNum: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.bold,
    marginTop: 2,
  },
  todayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  scheduleToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  scheduleModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  scheduleModeButton: {
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  scheduleModeButtonActive: {
    backgroundColor: colors.primary,
  },
  scheduleModeText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.bold,
  },
  scheduleRangeText: {
    flex: 1,
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    textAlign: 'right',
  },
  weekNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    justifyContent: 'flex-end',
  },
  weekNavButton: {
    width: 28,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavRangeText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    textAlign: 'center',
  },

  dragHint: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    marginTop: 2,
    fontStyle: 'italic',
  },
  offHoursBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  offHoursBannerText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.medium,
    flex: 1,
  },

  // Board outer
  boardOuter: {
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    ...shadows.sm,
  },
  // Column headers rendered inside the single horizontal ScrollView
  boardHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    backgroundColor: colors.muted,
    height: COLUMN_HEADER_HEIGHT,
    alignItems: 'center',
  },
  weekDayHeaderRow: {
    flexDirection: 'row',
    height: WEEK_DAY_HEADER_HEIGHT,
    backgroundColor: colors.muted,
  },
  weekDayHeader: {
    height: WEEK_DAY_HEADER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
  },
  weekDayHeaderText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.5,
  },
  weekDayHeaderSubtext: {
    fontSize: 9,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  columnHeader: {
    width: COLUMN_WIDTH,
    marginRight: COLUMN_GAP,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: COLUMN_HEADER_HEIGHT,
  },
  weekColumnHeaderStart: {
    borderLeftWidth: 1,
    borderLeftColor: colors.cardBorder,
  },
  columnHeaderName: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    textAlign: 'center',
  },
  unassignedAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Time gutter (fixed left column)
  timeGutter: {
    width: TIME_GUTTER_WIDTH,
    borderRightWidth: 1,
    borderRightColor: colors.cardBorder,
  },
  // Spacer inside time gutter that matches the column header height
  timeGutterHeaderSpacer: {
    height: COLUMN_HEADER_HEIGHT,
    borderBottomWidth: 1,
    backgroundColor: colors.muted,
  },
  timeGutterCell: {
    height: HOUR_HEIGHT,
    justifyContent: 'flex-start',
    paddingTop: 4,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  timeLabel: {
    fontSize: 9,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    textAlign: 'right',
  },
  column: {
    width: COLUMN_WIDTH,
    height: BOARD_HEIGHT,
    position: 'relative',
    marginRight: COLUMN_GAP,
  },
  columnBorderRight: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.cardBorder,
  },
  hourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
  },
  halfHourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
  },

  // Board job card blocks
  boardCard: {
    position: 'absolute',
    left: 2,
    right: 2,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 5,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  boardCardTitle: {
    fontSize: 10,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    lineHeight: 13,
  },
  boardCardTime: {
    fontSize: 9,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  boardCardClient: {
    fontSize: 9,
    color: colors.mutedForeground,
    marginTop: 1,
  },

  // Ghost card (drag overlay)
  ghostCard: {
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.sm,
    ...shadows.md,
    height: GHOST_CARD_HEIGHT,
    justifyContent: 'center',
  },
  ghostCardTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  ghostCardMeta: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
  },

  // Unscheduled tray
  trayContainer: {
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    ...shadows.sm,
  },
  trayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  trayTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  trayCountBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    minWidth: 22,
    alignItems: 'center',
  },
  trayCountText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.bold,
  },
  trayEmpty: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  trayEmptyText: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
  },
  trayScrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    flexDirection: 'row',
  },
  trayCard: {
    width: 148,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderLeftWidth: 3,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: 72,
    justifyContent: 'space-between',
  },
  trayCardTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
    lineHeight: 14,
  },
  trayCardMeta: {
    fontSize: 10,
    color: colors.mutedForeground,
    marginTop: 3,
  },
  trayCardHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: spacing.xs,
  },
  trayCardHintText: {
    fontSize: 9,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },

  // Undo banner
  undoBanner: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    zIndex: 100,
    ...shadows.md,
  },
  undoBannerText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
  },
  undoBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  undoBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.bold,
  },

  // Kanban
  kanbanScrollContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  kanbanColumn: {
    width: isTabletDevice ? 220 : 180,
    height: 480,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.sm,
    ...shadows.sm,
  },
  kanbanColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  kanbanColumnDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  kanbanColumnLabel: {
    ...typography.label,
    flex: 1,
    color: colors.foreground,
    fontWeight: fontWeights.bold,
  },
  kanbanCountBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    minWidth: 24,
    alignItems: 'center',
  },
  kanbanCountText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.bold,
  },
  kanbanEmpty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  kanbanEmptyText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  kanbanMiniCard: {
    position: 'relative',
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
    paddingLeft: spacing.sm + 3,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.background,
    marginBottom: spacing.xs,
  },
  cardAccentMD: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
  },
  kanbanMiniTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  kanbanMiniTime: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  kanbanMiniWorker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
  },
  kanbanMiniWorkerName: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },

  // Map
  mapCard: {
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },

  // Sheet
  statusPillSheet: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  statusPillSheetText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.bold,
  },
  sheetMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sheetMetaText: {
    fontSize: typography.sizes.sm,
    color: colors.foreground,
    flex: 1,
  },
  sheetEyebrow: {
    ...typography.label,
    color: colors.mutedForeground,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sheetMutedText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  nearbyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  nearbyCard: {
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minWidth: 80,
  },
  nearbyName: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  nearbyKm: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  sheetPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
  },
  sheetPrimaryBtnText: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.bold,
  },
  sheetSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  sheetSecondaryBtnText: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
  },

  // Assign modal
  assignJobInfo: {
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.md,
  },
  assignJobInfoTitle: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  assignJobInfoMeta: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  assignMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    marginBottom: spacing.sm,
  },
  assignMemberAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignMemberName: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  assignMemberRole: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  assignLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  assignLoadingText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
});

export default function DispatchBoardScreen() {
  return (
    <OwnerOnlyGuard requiredPermission={['view_dispatch', 'assign_jobs']}>
      <DispatchBoardScreenInner />
    </OwnerOnlyGuard>
  );
}
