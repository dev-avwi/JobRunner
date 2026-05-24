import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
  Platform,
} from 'react-native';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
let MapView: any;
let Marker: any;
let Callout: any;
type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  Callout = maps.Callout;
}
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography, shadows, usePageShell } from '../../src/lib/design-tokens';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { useIsTablet, useContentWidth } from '../../src/lib/device';
import { format, isToday, parseISO, isBefore, startOfDay } from 'date-fns';
import { getAvatarColor } from '../../src/lib/avatar-colors';
import { TeamAvatar } from '../../src/components/TeamAvatar';
import { Swipeable } from 'react-native-gesture-handler';
import { hapticFeedback } from '../../src/lib/haptics';

type ViewMode = 'liveops' | 'schedule' | 'performance' | 'kanban' | 'map';
type PerfPeriod = 'today' | 'week' | 'month';

const TIMELINE_HOUR_START = 7;
const TIMELINE_HOUR_END = 19;
const TIMELINE_HOUR_COUNT = TIMELINE_HOUR_END - TIMELINE_HOUR_START;
const TIMELINE_HOUR_WIDTH = 60;
const TIMELINE_ROW_HEIGHT = 64;
const TIMELINE_LABEL_WIDTH = 92;
const TIMELINE_GRID_WIDTH = TIMELINE_HOUR_COUNT * TIMELINE_HOUR_WIDTH;

const KANBAN_STATUS_ORDER = [
  { key: 'unassigned', status: 'pending', label: 'Unassigned', icon: 'inbox' as const },
  { key: 'assigned', status: 'scheduled', label: 'Assigned', icon: 'user-check' as const },
  { key: 'en_route', status: 'en_route', label: 'En Route', icon: 'navigation' as const },
  { key: 'in_progress', status: 'in_progress', label: 'In Progress', icon: 'play-circle' as const },
  { key: 'completed', status: 'done', label: 'Complete', icon: 'check-circle' as const },
];

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
  parentJobId?: string;
}

type QuickFilter = 'all' | 'unassigned' | 'overdue' | 'urgent';

interface GeocodedJob {
  job: JobData;
  lat: number;
  lng: number;
}

interface TeamMemberLocation {
  member: TeamMember;
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

const getKanbanColumns = (colors: any) => [
  { key: 'unassigned', label: 'Unassigned', icon: 'inbox' as const, color: colors.mutedForeground },
  { key: 'assigned', label: 'Assigned', icon: 'user-check' as const, color: colors.scheduled || colors.primary },
  { key: 'en_route', label: 'En Route', icon: 'navigation' as const, color: colors.info || '#3b82f6' },
  { key: 'in_progress', label: 'In Progress', icon: 'play-circle' as const, color: colors.warning },
  { key: 'completed', label: 'Complete', icon: 'check-circle' as const, color: colors.success },
];

function getInitials(firstName?: string, lastName?: string, email?: string): string {
  if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  if (email) return email[0].toUpperCase();
  return '?';
}

function getMemberName(member: TeamMember): string {
  if (member.firstName && member.lastName) return `${member.firstName} ${member.lastName}`;
  if (member.firstName) return member.firstName;
  return member.email || 'Unknown';
}

export default function DispatchBoardScreen() {
  const { colors, isDark } = useTheme();
  const responsiveShell = usePageShell();
  const contentWidth = useContentWidth();
  const isTabletDevice = useIsTablet();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, contentWidth, responsiveShell.paddingHorizontal, isTabletDevice, isDark), [colors, contentWidth, responsiveShell.paddingHorizontal, isTabletDevice, isDark]);
  const { user } = useAuthStore();

  const [viewMode, setViewMode] = useState<ViewMode>('liveops');
  const [perfPeriod, setPerfPeriod] = useState<PerfPeriod>('today');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningJob, setAssigningJob] = useState<JobData | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedMapJob, setSelectedMapJob] = useState<JobData | null>(null);
  const [pickup, setPickup] = useState<JobData | null>(null);
  const [kanbanCol, setKanbanCol] = useState<string>('unassigned');
  const [now, setNow] = useState(new Date());
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [selectedQueue, setSelectedQueue] = useState<Set<string>>(new Set());
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const mapRef = useRef<any>(null);
  const kanbanScrollRef = useRef<ScrollView>(null);
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());
  const longPressFiredRef = useRef<boolean>(false);

  const handleLongPress = (fn: () => void) => () => {
    longPressFiredRef.current = true;
    fn();
    setTimeout(() => { longPressFiredRef.current = false; }, 400);
  };
  const handlePressGuarded = (fn: () => void) => () => {
    if (longPressFiredRef.current) return;
    fn();
  };

  const fetchData = useCallback(async () => {
    try {
      const [membersRes, jobsRes] = await Promise.all([
        api.get<TeamMember[]>('/api/team/members'),
        api.get<JobData[]>('/api/jobs'),
      ]);
      if (membersRes.data) setTeamMembers(membersRes.data.filter(m => m.inviteStatus === 'accepted'));
      if (jobsRes.data) setJobs(jobsRes.data);
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

  const activeJobs = useMemo(() => {
    return jobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled' && j.status !== 'done');
  }, [jobs]);

  const todayJobs = useMemo(() => {
    return jobs.filter(j => {
      if (!j.scheduledAt) return false;
      return isToday(parseISO(j.scheduledAt));
    });
  }, [jobs]);

  const opsHealth: OpsHealth = useMemo(() => {
    const unassigned = activeJobs.filter(j => !j.assignedTo).length;
    const overdue = activeJobs.filter(j => {
      if (!j.scheduledAt) return false;
      return isBefore(parseISO(j.scheduledAt), startOfDay(new Date())) && j.status !== 'completed' && j.status !== 'done';
    }).length;

    const todayScheduled = todayJobs;
    const jobsByTime: { start: number; end: number; id: string }[] = [];
    todayScheduled.forEach(j => {
      if (!j.scheduledAt) return;
      const start = parseISO(j.scheduledAt).getTime();
      const duration = (j.estimatedDuration || 60) * 60 * 1000;
      jobsByTime.push({ start, end: start + duration, id: j.id });
    });

    let conflicts = 0;
    for (let i = 0; i < jobsByTime.length; i++) {
      for (let k = i + 1; k < jobsByTime.length; k++) {
        if (jobsByTime[i].start < jobsByTime[k].end && jobsByTime[k].start < jobsByTime[i].end) {
          conflicts++;
        }
      }
    }

    return {
      conflicts,
      overdue,
      unassigned,
      totalToday: todayJobs.length,
      inProgress: activeJobs.filter(j => j.status === 'in_progress').length,
      completed: jobs.filter(j => j.status === 'completed' || j.status === 'done').length,
    };
  }, [activeJobs, todayJobs, jobs]);

  const kanbanData = useMemo(() => {
    const unassigned = activeJobs.filter(j => !j.assignedTo);
    const enRoute = activeJobs.filter(j => j.status === 'en_route' || j.status === 'on_my_way');
    const inProgress = activeJobs.filter(j => j.status === 'in_progress' || j.status === 'working');
    const enRouteIds = new Set(enRoute.map(j => j.id));
    const inProgressIds = new Set(inProgress.map(j => j.id));
    const assigned = activeJobs.filter(j => j.assignedTo && !enRouteIds.has(j.id) && !inProgressIds.has(j.id));
    const completed = jobs.filter(j => j.status === 'completed' || j.status === 'done' || j.status === 'invoiced').slice(0, 10);

    return { unassigned, assigned, en_route: enRoute, in_progress: inProgress, completed };
  }, [activeJobs, jobs]);

  const weekDays = useMemo(() => {
    const anchor = new Date();
    const days: Date[] = [];
    for (let i = -2; i <= 4; i++) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    return days;
  }, []);

  const liveOpsData = useMemo(() => {
    const memberStatus = new Map<string, { status: 'on_job' | 'en_route' | 'available'; job?: JobData }>();
    teamMembers.forEach(m => memberStatus.set(m.userId, { status: 'available' }));
    activeJobs.forEach(j => {
      if (!j.assignedTo) return;
      const entry = memberStatus.get(j.assignedTo);
      if (!entry) return;
      if (j.status === 'in_progress' || j.status === 'working') {
        entry.status = 'on_job';
        entry.job = j;
      } else if ((j.status === 'en_route' || j.status === 'on_my_way') && entry.status === 'available') {
        entry.status = 'en_route';
        entry.job = j;
      }
    });
    const list = teamMembers.map(m => ({ member: m, ...(memberStatus.get(m.userId) || { status: 'available' as const }) }));
    const onJob = list.filter(l => l.status === 'on_job').length;
    const enRoute = list.filter(l => l.status === 'en_route').length;
    const available = list.filter(l => l.status === 'available').length;
    const unassigned = activeJobs.filter(j => !j.assignedTo).length;
    return { list, online: teamMembers.length, onJob, enRoute, available, unassigned, total: activeJobs.length };
  }, [teamMembers, activeJobs]);

  const performanceData = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (perfPeriod === 'today') start.setHours(0, 0, 0, 0);
    else if (perfPeriod === 'week') { start.setDate(now.getDate() - 7); start.setHours(0, 0, 0, 0); }
    else { start.setMonth(now.getMonth() - 1); start.setHours(0, 0, 0, 0); }

    const inPeriod = jobs.filter(j => {
      if (!j.scheduledAt) return false;
      const d = parseISO(j.scheduledAt);
      return d >= start && d <= now;
    });
    const completed = inPeriod.filter(j => j.status === 'completed' || j.status === 'done').length;
    const activeCount = inPeriod.filter(j => j.status === 'in_progress' || j.status === 'working' || j.status === 'en_route').length;
    const totalPeriod = inPeriod.length;
    const onTimeRate = totalPeriod > 0 ? Math.round((completed / totalPeriod) * 100) : 0;
    const unassignedPeriod = inPeriod.filter(j => !j.assignedTo).length;

    const perMember = teamMembers.map(m => {
      const memberJobs = inPeriod.filter(j => j.assignedTo === m.userId);
      const memDone = memberJobs.filter(j => j.status === 'completed' || j.status === 'done').length;
      const memActive = memberJobs.filter(j => j.status === 'in_progress' || j.status === 'working' || j.status === 'en_route').length;
      const score = memberJobs.length > 0 ? Math.round((memDone / memberJobs.length) * 100) : 0;
      return { member: m, done: memDone, active: memActive, total: memberJobs.length, score };
    }).sort((a, b) => b.done - a.done || b.score - a.score);

    return { completed, activeCount, totalPeriod, onTimeRate, unassignedPeriod, perMember };
  }, [jobs, teamMembers, perfPeriod]);

  const scheduleData = useMemo(() => {
    const memberMap = new Map<string, { member: TeamMember; jobs: JobData[] }>();

    teamMembers.forEach(m => {
      memberMap.set(m.userId, { member: m, jobs: [] });
    });

    const unassignedJobs: JobData[] = [];

    const dateJobs = jobs.filter(j => {
      if (!j.scheduledAt) return j.status !== 'completed' && j.status !== 'done' && j.status !== 'cancelled';
      const jobDate = parseISO(j.scheduledAt);
      return format(jobDate, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
    });

    dateJobs.forEach(j => {
      if (j.assignedTo && memberMap.has(j.assignedTo)) {
        memberMap.get(j.assignedTo)!.jobs.push(j);
      } else if (!j.assignedTo) {
        unassignedJobs.push(j);
      }
    });

    memberMap.forEach(entry => {
      entry.jobs.sort((a, b) => {
        if (!a.scheduledAt) return 1;
        if (!b.scheduledAt) return -1;
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      });
    });

    return { memberMap, unassignedJobs };
  }, [teamMembers, jobs, selectedDate]);

  const KANBAN_COLUMNS = useMemo(() => getKanbanColumns(colors), [colors]);

  const geocodedJobs = useMemo((): GeocodedJob[] => {
    return activeJobs
      .filter(j => {
        const lat = j.latitude != null ? Number(j.latitude) : NaN;
        const lng = j.longitude != null ? Number(j.longitude) : NaN;
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      })
      .map(j => ({
        job: j,
        lat: Number(j.latitude),
        lng: Number(j.longitude),
      }));
  }, [activeJobs]);

  const mapRegion = useMemo((): Region => {
    const points = geocodedJobs.map(g => ({ lat: g.lat, lng: g.lng }));
    if (points.length === 0) {
      return { latitude: -33.8688, longitude: 151.2093, latitudeDelta: 0.1, longitudeDelta: 0.1 };
    }
    if (points.length === 1) {
      return { latitude: points[0].lat, longitude: points[0].lng, latitudeDelta: 0.02, longitudeDelta: 0.02 };
    }
    const lats = points.map(p => p.lat);
    const lngs = points.map(p => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latDelta = Math.max((maxLat - minLat) * 1.4, 0.02);
    const lngDelta = Math.max((maxLng - minLng) * 1.4, 0.02);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [geocodedJobs]);

  const handleAssign = async (memberId: string) => {
    if (!assigningJob || isAssigning) return;
    setIsAssigning(true);
    try {
      await api.patch(`/api/jobs/${assigningJob.id}`, { assignedTo: memberId });
      setJobs(prev => prev.map(j => j.id === assigningJob.id ? { ...j, assignedTo: memberId, status: j.status === 'pending' ? 'scheduled' : j.status } : j));
      setShowAssignModal(false);
      setAssigningJob(null);
      const member = teamMembers.find(m => m.userId === memberId);
      Alert.alert('Assigned', `Job assigned to ${getMemberName(member!)}`);
    } catch {
      Alert.alert('Error', 'Failed to assign job');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassign = async (job: JobData) => {
    Alert.alert('Unassign Job', `Remove assignment from "${job.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unassign',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.patch(`/api/jobs/${job.id}`, { assignedTo: null });
            setJobs(prev => prev.map(j => j.id === job.id ? { ...j, assignedTo: undefined } : j));
          } catch {
            Alert.alert('Error', 'Failed to unassign job');
          }
        },
      },
    ]);
  };

  const handleDropPickup = async (memberId: string | null, hour: number) => {
    if (!pickup) return;
    const job = pickup;
    setPickup(null);
    const dropDate = new Date(selectedDate);
    dropDate.setHours(hour, 0, 0, 0);
    const isoDate = dropDate.toISOString();
    try {
      const body: any = { scheduledAt: isoDate };
      if (memberId) body.assignedTo = memberId;
      await api.patch(`/api/jobs/${job.id}`, body);
      setJobs(prev => prev.map(j => j.id === job.id ? {
        ...j,
        assignedTo: memberId || j.assignedTo,
        scheduledAt: isoDate,
        status: j.status === 'pending' && memberId ? 'scheduled' : j.status,
      } : j));
    } catch {
      Alert.alert('Error', 'Failed to schedule job');
    }
  };

  const handleStatusChange = async (job: JobData, newStatus: string) => {
    try {
      await api.patch(`/api/jobs/${job.id}`, { status: newStatus });
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j));
    } catch {
      Alert.alert('Error', 'Failed to update job status');
    }
  };

  const showMoveMenu = (job: JobData) => {
    const statusOptions: { label: string; status: string; icon: string }[] = [
      { label: 'Pending (Unassigned)', status: 'pending', icon: 'inbox' },
      { label: 'Scheduled (Assigned)', status: 'scheduled', icon: 'user-check' },
      { label: 'En Route', status: 'en_route', icon: 'navigation' },
      { label: 'In Progress', status: 'in_progress', icon: 'play-circle' },
      { label: 'Complete', status: 'done', icon: 'check-circle' },
    ];

    const available = statusOptions.filter(o => o.status !== job.status);
    const buttons: { text: string; onPress: () => void | Promise<void> }[] = available.map(opt => ({
      text: opt.label,
      onPress: () => handleStatusChange(job, opt.status),
    }));
    buttons.push({ text: 'Cancel', onPress: () => {} });

    Alert.alert(
      'Move Job',
      `Change status of "${job.title}"`,
      buttons
    );
  };

  const openAssignModal = (job: JobData) => {
    setAssigningJob(job);
    setShowAssignModal(true);
  };

  const navigateDateBy = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d);
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    return format(parseISO(dateStr), 'h:mm a');
  };

  const formatRelativeAgo = (d: Date) => {
    const s = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (s < 5) return 'just now';
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    return `${h}h ago`;
  };

  const availabilityByMember = useMemo(() => {
    const m = new Map<string, 'on_job' | 'en_route' | 'available'>();
    liveOpsData.list.forEach(l => m.set(l.member.userId, l.status));
    return m;
  }, [liveOpsData]);

  const handleAutoAssign = async () => {
    const jobIds = Array.from(selectedQueue);
    if (jobIds.length === 0) return;
    if (teamMembers.length === 0) {
      Alert.alert('No workers', 'Add team members before auto-assigning.');
      return;
    }
    const load = new Map<string, number>();
    teamMembers.forEach(m => load.set(m.userId, 0));
    jobs.forEach(j => {
      if (j.assignedTo && load.has(j.assignedTo)) {
        load.set(j.assignedTo, (load.get(j.assignedTo) || 0) + 1);
      }
    });
    const picks: { jobId: string; memberId: string }[] = [];
    for (const jid of jobIds) {
      let best: string | null = null;
      let bestLoad = Infinity;
      load.forEach((l, mid) => { if (l < bestLoad) { bestLoad = l; best = mid; } });
      if (best) {
        picks.push({ jobId: jid, memberId: best });
        load.set(best, bestLoad + 1);
      }
    }
    try {
      await Promise.all(picks.map(p =>
        api.patch(`/api/jobs/${p.jobId}`, { assignedTo: p.memberId })
      ));
      setJobs(prev => prev.map(j => {
        const p = picks.find(x => x.jobId === j.id);
        return p ? { ...j, assignedTo: p.memberId, status: j.status === 'pending' ? 'scheduled' : j.status } : j;
      }));
      setSelectedQueue(new Set());
      hapticFeedback.success();
      Alert.alert('Auto-assigned', `${picks.length} job${picks.length === 1 ? '' : 's'} balanced across the crew.`);
    } catch {
      Alert.alert('Error', 'Failed to auto-assign');
    }
  };

  const toggleQueueSelect = (jobId: string) => {
    hapticFeedback.selection();
    setSelectedQueue(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return colors.warning;
      case 'scheduled': return colors.scheduled || colors.primary;
      case 'en_route': case 'on_my_way': return colors.info || '#3b82f6';
      case 'in_progress': case 'working': return colors.success;
      case 'completed': case 'done': return colors.success;
      case 'invoiced': return colors.primary;
      default: return colors.mutedForeground;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'scheduled': return 'Scheduled';
      case 'en_route': case 'on_my_way': return 'En Route';
      case 'in_progress': case 'working': return 'In Progress';
      case 'completed': case 'done': return 'Complete';
      case 'invoiced': return 'Invoiced';
      default: return status;
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[typography.body, { color: colors.mutedForeground, marginTop: spacing.md }]}>Loading dispatch board...</Text>
        </View>
      </>
    );
  }

  const renderLiveOps = () => {
    const statusMeta = {
      on_job: { label: 'On Job', color: colors.info || '#3b82f6' },
      en_route: { label: 'En Route', color: colors.warning },
      available: { label: 'Available', color: colors.success },
    } as const;
    const stats: { value: number; label: string; color: string }[] = [
      { value: liveOpsData.online, label: 'Online', color: colors.info || '#3b82f6' },
      { value: liveOpsData.onJob, label: 'On Job', color: colors.success },
      { value: liveOpsData.unassigned, label: 'Unassigned', color: colors.warning },
      { value: liveOpsData.total, label: 'Total', color: colors.foreground },
    ];
    return (
      <View>
        <View style={styles.statBar}>
          {stats.map(s => (
            <View key={s.label} style={styles.statBarItem}>
              <Text style={[styles.statBarValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statBarLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {liveOpsData.unassigned > 0 && (
          <PressableRow style={styles.alertBanner} onPress={() => setViewMode('schedule')}>
            <View style={[styles.alertBannerIcon, { backgroundColor: colors.warning }]}>
              <Feather name="inbox" size={18} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertBannerTitle}>{liveOpsData.unassigned} jobs need assigning</Text>
              <Text style={styles.alertBannerSub}>Tap to dispatch from queue</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.warning} />
          </PressableRow>
        )}

        <Text style={styles.sectionEyebrow}>On Shift</Text>
        {liveOpsData.list.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="users" size={36} color={colors.mutedForeground} />
            <Text style={styles.emptyStateSubtitle}>No team members on shift</Text>
          </View>
        ) : (
          liveOpsData.list.map(({ member, status, job }) => {
            const meta = statusMeta[status];
            const subtitle = job
              ? `${job.title}${job.address ? ` · ${job.address.split(',')[0]}` : ''}`
              : 'Free · ready for a job';
            return (
              <PressableRow
                key={member.id}
                style={styles.workerCard}
                onPress={() => job ? router.push(`/job/${job.id}`) : undefined}
              >
                <View style={styles.workerCardAvatarWrap}>
                  <TeamAvatar
                    firstName={member.firstName}
                    lastName={member.lastName}
                    userId={String(member.userId)}
                    themeColor={(member as any).themeColor}
                    size={40}
                  />
                  <View style={[styles.workerCardStatusDot, { backgroundColor: meta.color, borderColor: colors.card }]} />
                </View>
                <View style={styles.workerCardBody}>
                  <Text style={styles.workerCardName} numberOfLines={1}>{getMemberName(member)}</Text>
                  <View style={styles.workerCardMetaRow}>
                    {job && <Feather name="map-pin" size={11} color={colors.mutedForeground} />}
                    <Text style={styles.workerCardMeta} numberOfLines={1}>{subtitle}</Text>
                  </View>
                </View>
                <View style={[styles.workerStatusPill, { backgroundColor: `${meta.color}18` }]}>
                  <Text style={[styles.workerStatusPillText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </PressableRow>
            );
          })
        )}
      </View>
    );
  };

  const renderPerformance = () => {
    const periods: { key: PerfPeriod; label: string }[] = [
      { key: 'today', label: 'Today' },
      { key: 'week', label: 'This Week' },
      { key: 'month', label: 'This Month' },
    ];
    const metrics: { value: string; label: string; color: string; icon: keyof typeof Feather.glyphMap }[] = [
      { value: String(performanceData.completed), label: 'Jobs Completed', color: colors.success, icon: 'check-circle' },
      { value: `${performanceData.onTimeRate}%`, label: 'Completion Rate', color: colors.info || '#3b82f6', icon: 'trending-up' },
      { value: String(performanceData.activeCount), label: 'Active Jobs', color: colors.warning, icon: 'play-circle' },
      { value: String(performanceData.unassignedPeriod), label: 'Unassigned', color: colors.destructive, icon: 'inbox' },
    ];
    return (
      <View>
        <View style={styles.periodRow}>
          {periods.map(p => {
            const active = perfPeriod === p.key;
            return (
              <TouchableOpacity
                key={p.key}
                activeOpacity={0.7}
                onPress={() => setPerfPeriod(p.key)}
                style={[styles.periodPill, active && styles.periodPillActive]}
              >
                <Text style={[styles.periodPillText, active && styles.periodPillTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.metricGrid}>
          {metrics.map(m => (
            <View key={m.label} style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Feather name={m.icon} size={14} color={m.color} />
                <Text style={styles.metricLabel}>{m.label}</Text>
              </View>
              <Text style={[styles.metricValue, { color: m.color }]}>{m.value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionEyebrow}>Individual</Text>
        {performanceData.perMember.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="bar-chart-2" size={36} color={colors.mutedForeground} />
            <Text style={styles.emptyStateSubtitle}>No team members yet</Text>
          </View>
        ) : (
          performanceData.perMember.map(({ member, done, active, total, score }) => (
            <View key={member.id} style={styles.perfMemberCard}>
              <View style={styles.perfMemberHeader}>
                <TeamAvatar
                  firstName={member.firstName}
                  lastName={member.lastName}
                  userId={String(member.userId)}
                  themeColor={(member as any).themeColor}
                  size={36}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.perfMemberName} numberOfLines={1}>{getMemberName(member)}</Text>
                  {member.roleName ? <Text style={styles.perfMemberRole} numberOfLines={1}>{member.roleName}</Text> : null}
                </View>
                <Text style={[styles.perfMemberScore, { color: score >= 80 ? colors.success : score >= 50 ? colors.warning : colors.mutedForeground }]}>
                  {total > 0 ? `${score}%` : '—'}
                </Text>
              </View>
              <View style={styles.perfBarTrack}>
                <View style={[styles.perfBarFill, { width: `${score}%`, backgroundColor: score >= 80 ? colors.success : score >= 50 ? colors.warning : colors.mutedForeground }]} />
              </View>
              <View style={styles.perfStatsRow}>
                <Text style={styles.perfStat}><Text style={styles.perfStatStrong}>{done}</Text> done</Text>
                <Text style={styles.perfStatDot}>·</Text>
                <Text style={styles.perfStat}><Text style={styles.perfStatStrong}>{active}</Text> active</Text>
                <Text style={styles.perfStatDot}>·</Text>
                <Text style={styles.perfStat}><Text style={styles.perfStatStrong}>{total}</Text> total</Text>
              </View>
            </View>
          ))
        )}
      </View>
    );
  };

  const renderJobCard = (job: JobData, showAssignAction: boolean = true) => {
    const statusColor = getStatusColor(job.status);
    const assignedMember = job.assignedTo ? teamMembers.find(m => m.userId === job.assignedTo) : null;

    return (
      <PressableRow key={job.id} style={styles.jobCard} onPress={() => router.push(`/job/${job.id}`)} onLongPress={() => showMoveMenu(job)} delayLongPress={400} >
        <View style={[styles.jobCardStatusStrip, { backgroundColor: statusColor }]} />
        <View style={styles.jobCardContent}>
        <View style={styles.jobCardHeader}>
          <Text style={styles.jobCardTitle} numberOfLines={1}>{job.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor }]}>{getStatusLabel(job.status)}</Text>
          </View>
        </View>
        {job.scheduledAt && (
          <View style={styles.jobCardDetail}>
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text style={styles.jobCardDetailText}>{formatTime(job.scheduledAt)}</Text>
            {job.estimatedDuration && (
              <Text style={styles.jobCardDetailText}> ({job.estimatedDuration}min)</Text>
            )}
          </View>
        )}
        {job.address && (
          <View style={styles.jobCardDetail}>
            <Feather name="map-pin" size={12} color={colors.mutedForeground} />
            <Text style={styles.jobCardDetailText} numberOfLines={1}>{job.address}</Text>
          </View>
        )}
        {job.clientName && (
          <View style={styles.jobCardDetail}>
            <Feather name="user" size={12} color={colors.mutedForeground} />
            <Text style={styles.jobCardDetailText}>{job.clientName}</Text>
          </View>
        )}
        <View style={styles.jobCardActions}>
          {assignedMember ? (
            <PressableRow style={styles.assignedBadge} onPress={() => openAssignModal(job)} >
              <TeamAvatar
                firstName={assignedMember.firstName}
                lastName={assignedMember.lastName}
                userId={String(assignedMember.userId)}
                themeColor={(assignedMember as any).themeColor}
                size={22}
              />
              <Text style={styles.assignedName}>{getMemberName(assignedMember)}</Text>
              <Feather name="repeat" size={12} color={colors.mutedForeground} />
            </PressableRow>
          ) : showAssignAction ? (
            <PressableRow style={styles.assignButton} onPress={() => openAssignModal(job)} >
              <Feather name="user-plus" size={14} color={colors.primary} />
              <Text style={[styles.assignButtonText, { color: colors.primary }]}>Assign</Text>
            </PressableRow>
          ) : null}
        </View>
        </View>
      </PressableRow>
    );
  };

  const renderHourRuler = () => (
    <View style={styles.timelineRuler}>
      {Array.from({ length: TIMELINE_HOUR_COUNT }).map((_, i) => {
        const h = TIMELINE_HOUR_START + i;
        const label = h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`;
        return (
          <View key={h} style={styles.timelineRulerCell}>
            <Text style={styles.timelineRulerText}>{label}</Text>
          </View>
        );
      })}
    </View>
  );

  const renderTimelineRow = (
    member: TeamMember | null,
    memberJobs: JobData[],
    isUnassignedRow: boolean = false,
  ) => {
    const userId = member?.userId || null;
    const rowName = member ? getMemberName(member) : 'Unassigned';
    const subtitle = member?.roleName || (isUnassignedRow ? 'no worker' : '');

    const avail = userId ? availabilityByMember.get(userId) : null;
    const availColor =
      avail === 'on_job' ? colors.success :
      avail === 'en_route' ? (colors.info || '#3b82f6') :
      avail === 'available' ? colors.mutedForeground :
      colors.border;
    const availLabel = avail === 'on_job' ? 'on job' : avail === 'en_route' ? 'en route' : avail === 'available' ? 'available' : '';

    // Pre-compute spans for conflict detection + travel blocks
    const spans = memberJobs
      .filter(j => j.scheduledAt)
      .map(j => {
        const d = parseISO(j.scheduledAt!);
        const start = d.getHours() + d.getMinutes() / 60;
        const dur = Math.max(0.5, (j.estimatedDuration || 60) / 60);
        return { job: j, start, end: start + dur };
      })
      .sort((a, b) => a.start - b.start);

    const conflictIds = new Set<string>();
    for (let i = 0; i < spans.length; i++) {
      for (let k = i + 1; k < spans.length; k++) {
        if (spans[i].end > spans[k].start && spans[i].start < spans[k].end) {
          conflictIds.add(spans[i].job.id);
          conflictIds.add(spans[k].job.id);
        }
      }
    }

    const travelBlocks: { left: number; width: number }[] = [];
    for (let i = 0; i < spans.length - 1; i++) {
      const gap = spans[i + 1].start - spans[i].end;
      if (gap > 0 && gap < 2) {
        const left = (spans[i].end - TIMELINE_HOUR_START) * TIMELINE_HOUR_WIDTH;
        const width = gap * TIMELINE_HOUR_WIDTH;
        if (left + width > 0 && left < TIMELINE_GRID_WIDTH) {
          travelBlocks.push({ left: Math.max(0, left), width: Math.min(width, TIMELINE_GRID_WIDTH - left) });
        }
      }
    }

    const isSameDay = format(selectedDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
    const nowHourFloat = now.getHours() + now.getMinutes() / 60;
    const nowOffset = nowHourFloat - TIMELINE_HOUR_START;
    const showNowLine = isSameDay && nowOffset >= 0 && nowOffset <= TIMELINE_HOUR_COUNT;

    return (
      <View key={userId || 'unassigned'} style={styles.timelineRow}>
        <View style={[styles.timelineLabel, isUnassignedRow && { backgroundColor: `${colors.destructive}10` }]}>
          {!isUnassignedRow && (
            <View style={[styles.availStrip, { backgroundColor: availColor }]} />
          )}
          {member ? (
            <TeamAvatar
              firstName={member.firstName}
              lastName={member.lastName}
              userId={String(member.userId)}
              themeColor={(member as any).themeColor}
              size={28}
            />
          ) : (
            <View style={[styles.timelineLabelIcon, { backgroundColor: colors.destructive }]}>
              <Feather name="inbox" size={14} color={colors.white} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.timelineLabelName} numberOfLines={1}>{rowName}</Text>
            {availLabel ? (
              <Text style={[styles.timelineLabelSub, { color: availColor }]} numberOfLines={1}>{availLabel}</Text>
            ) : subtitle ? (
              <Text style={styles.timelineLabelSub} numberOfLines={1}>{subtitle}</Text>
            ) : null}
          </View>
        </View>
        <View style={styles.timelineGrid}>
          {/* hour gridlines */}
          {Array.from({ length: TIMELINE_HOUR_COUNT }).map((_, i) => (
            <View key={`gl-${i}`} style={[styles.timelineGridline, { left: i * TIMELINE_HOUR_WIDTH }]} />
          ))}
          {/* travel blocks (between consecutive jobs) */}
          {travelBlocks.map((t, i) => (
            <View key={`tr-${i}`} style={[styles.travelBlock, { left: t.left, width: t.width }]}>
              <Feather name="navigation" size={9} color={colors.mutedForeground} />
            </View>
          ))}
          {/* drop targets when picking up */}
          {pickup && Array.from({ length: TIMELINE_HOUR_COUNT }).map((_, i) => (
            <TouchableOpacity
              key={`drop-${i}`}
              activeOpacity={0.6}
              onPress={() => { hapticFeedback.success(); handleDropPickup(userId, TIMELINE_HOUR_START + i); }}
              style={[styles.timelineDropCell, { left: i * TIMELINE_HOUR_WIDTH }]}
            />
          ))}
          {/* job blocks */}
          {spans.map(({ job: j, start, end }) => {
            const offset = start - TIMELINE_HOUR_START;
            if (offset < 0 || offset >= TIMELINE_HOUR_COUNT) return null;
            const durHours = end - start;
            const width = Math.max(44, Math.min(durHours * TIMELINE_HOUR_WIDTH, TIMELINE_GRID_WIDTH - offset * TIMELINE_HOUR_WIDTH) - 4);
            const color = getStatusColor(j.status);
            const isConflict = conflictIds.has(j.id);
            return (
              <TouchableOpacity
                key={j.id}
                activeOpacity={0.8}
                onLongPress={handleLongPress(() => { hapticFeedback.longPress(); setPickup(j); })}
                delayLongPress={250}
                onPress={handlePressGuarded(() => router.push(`/job/${j.id}` as any))}
                style={[
                  styles.timelineBlock,
                  {
                    left: offset * TIMELINE_HOUR_WIDTH + 2,
                    width,
                    backgroundColor: `${color}25`,
                    borderLeftColor: color,
                  },
                  isConflict && styles.timelineBlockConflict,
                ]}
              >
                <View style={styles.timelineBlockTitleRow}>
                  {isConflict && <Feather name="alert-triangle" size={9} color={colors.destructive} />}
                  {j.isRecurring && <Feather name="repeat" size={9} color={color} />}
                  <Text style={[styles.timelineBlockTitle, { color }]} numberOfLines={1}>{j.title}</Text>
                </View>
                <Text style={styles.timelineBlockMeta} numberOfLines={1}>
                  {formatTime(j.scheduledAt)} · {j.estimatedDuration || 60}m
                </Text>
              </TouchableOpacity>
            );
          })}
          {/* now line — only on today's date */}
          {showNowLine && (
            <View pointerEvents="none" style={[styles.nowLine, { left: nowOffset * TIMELINE_HOUR_WIDTH }]}>
              <View style={styles.nowLineDot} />
            </View>
          )}
          {/* empty hint */}
          {memberJobs.length === 0 && !pickup && (
            <Text style={styles.timelineEmptyHint}>Free all day</Text>
          )}
        </View>
      </View>
    );
  };

  const renderScheduleView = () => {
    // Apply quick filter
    const matchFilter = (j: JobData): boolean => {
      if (quickFilter === 'all') return true;
      if (quickFilter === 'unassigned') return !j.assignedTo;
      if (quickFilter === 'overdue') {
        return !!j.scheduledAt && isBefore(parseISO(j.scheduledAt), now) && j.status !== 'completed' && j.status !== 'done';
      }
      if (quickFilter === 'urgent') {
        return j.priority === 'urgent' || j.priority === 'high';
      }
      return true;
    };

    const filteredMemberMap = new Map<string, { member: TeamMember; jobs: JobData[] }>();
    scheduleData.memberMap.forEach((entry, k) => {
      filteredMemberMap.set(k, { member: entry.member, jobs: entry.jobs.filter(matchFilter) });
    });
    const filteredUnassigned = scheduleData.unassignedJobs.filter(matchFilter);

    const memberRows = Array.from(filteredMemberMap.entries());
    const hasAnyJobs = filteredUnassigned.length > 0 || memberRows.some(([, v]) => v.jobs.length > 0);

    const filterChips: { key: QuickFilter; label: string; count: number }[] = [
      { key: 'all', label: 'All', count: scheduleData.unassignedJobs.length + Array.from(scheduleData.memberMap.values()).reduce((a, v) => a + v.jobs.length, 0) },
      { key: 'unassigned', label: 'Unassigned', count: scheduleData.unassignedJobs.length },
      { key: 'overdue', label: 'Overdue', count: opsHealth.overdue },
      { key: 'urgent', label: 'Urgent', count: jobs.filter(j => (j.priority === 'urgent' || j.priority === 'high') && j.status !== 'completed' && j.status !== 'done').length },
    ];

    return (
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weekStripRow}
        >
          {weekDays.map(d => {
            const sel = format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
            return (
              <TouchableOpacity
                key={d.toISOString()}
                activeOpacity={0.7}
                onPress={() => setSelectedDate(d)}
                style={[styles.weekDay, sel && styles.weekDaySel]}
              >
                <Text style={[styles.weekDayDow, sel && styles.weekDayDowSel]}>{format(d, 'EEE').toUpperCase()}</Text>
                <Text style={[styles.weekDayDom, sel && styles.weekDayDomSel]}>{format(d, 'd')}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Quick filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          {filterChips.map(c => {
            const active = quickFilter === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                activeOpacity={0.7}
                onPress={() => { hapticFeedback.selection(); setQuickFilter(c.key); }}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipLabel, active && styles.filterChipLabelActive]}>{c.label}</Text>
                <View style={[styles.filterChipCount, active && styles.filterChipCountActive]}>
                  <Text style={[styles.filterChipCountText, active && styles.filterChipCountTextActive]}>{c.count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Pickup hint */}
        {pickup && (
          <View style={styles.pickupBar}>
            <Feather name="package" size={14} color={colors.primary} />
            <Text style={styles.pickupBarText} numberOfLines={1}>Holding <Text style={{ fontWeight: '700' }}>{pickup.title}</Text> — tap a time slot</Text>
            <TouchableOpacity onPress={() => setPickup(null)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}

        {/* Timeline grid */}
        {memberRows.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="users" size={48} color={colors.mutedForeground} />
            <Text style={styles.emptyStateTitle}>No team members</Text>
            <Text style={styles.emptyStateSubtitle}>Add team members to start dispatching</Text>
          </View>
        ) : (
          <View style={styles.timelineCard}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
              persistentScrollbar
              contentContainerStyle={{ paddingRight: spacing.sm }}
            >
              <View>
                <View style={styles.timelineRulerRow}>
                  <View style={{ width: TIMELINE_LABEL_WIDTH }}>
                    <Text style={styles.timelineRulerCorner}>Worker</Text>
                  </View>
                  {renderHourRuler()}
                </View>
                {memberRows.map(([, { member, jobs: memberJobs }]) => renderTimelineRow(member, memberJobs))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Unassigned queue card */}
        {filteredUnassigned.length > 0 && (
          <View style={styles.queueCard}>
            {selectedQueue.size > 0 ? (
              <View style={styles.queueCardHeader}>
                <Text style={[styles.queueCardTitle, { color: colors.primary }]}>{selectedQueue.size} selected</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => { hapticFeedback.light(); setSelectedQueue(new Set()); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.queueBulkCancel}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleAutoAssign}
                  style={styles.queueBulkBtn}
                >
                  <Feather name="zap" size={12} color={colors.primaryForeground} />
                  <Text style={styles.queueBulkBtnText}>Auto-balance</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.queueCardHeader}>
                <Text style={styles.queueCardTitle}>Unassigned Queue · {filteredUnassigned.length} job{filteredUnassigned.length === 1 ? '' : 's'}</Text>
                <Text style={styles.queueCardHint}>Hold to lift · Long-press to multi-select</Text>
              </View>
            )}
            {filteredUnassigned.map(j => {
              const held = pickup?.id === j.id;
              const selected = selectedQueue.has(j.id);
              return (
                <View key={j.id} style={[styles.queueItem, held && styles.queueItemHeld, selected && styles.queueItemSelected]}>
                  {selectedQueue.size > 0 && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => toggleQueueSelect(j.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.queueCheckbox}
                    >
                      <Feather
                        name={selected ? 'check-square' : 'square'}
                        size={18}
                        color={selected ? colors.primary : colors.mutedForeground}
                      />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handlePressGuarded(() => {
                      if (selectedQueue.size > 0) { toggleQueueSelect(j.id); return; }
                      hapticFeedback.light();
                      setPickup(held ? null : j);
                    })}
                    onLongPress={handleLongPress(() => { hapticFeedback.longPress(); toggleQueueSelect(j.id); })}
                    delayLongPress={300}
                    style={styles.queueItemMain}
                  >
                    <View style={styles.queueItemTitleRow}>
                      {j.isRecurring && <Feather name="repeat" size={11} color={colors.mutedForeground} />}
                      <Text style={styles.queueItemTitle} numberOfLines={1}>{j.title}</Text>
                    </View>
                    <Text style={styles.queueItemMeta} numberOfLines={1}>
                      {[j.address?.split(',')[0], j.estimatedDuration ? `~${Math.round(j.estimatedDuration / 60 * 10) / 10}hr` : null].filter(Boolean).join(' · ') || 'No location'}
                    </Text>
                  </TouchableOpacity>
                  {selectedQueue.size === 0 && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => openAssignModal(j)}
                      style={styles.queueItemAssignBtn}
                    >
                      <Text style={styles.queueItemAssignText}>Assign</Text>
                      <Feather name="arrow-right" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {!hasAnyJobs && memberRows.length > 0 && (
          <View style={[styles.emptyState, { paddingVertical: spacing.xl }]}>
            <Feather name="calendar" size={36} color={colors.mutedForeground} />
            <Text style={styles.emptyStateSubtitle}>No jobs scheduled for this day</Text>
          </View>
        )}
      </View>
    );
  };

  const getAdjacentStatus = (currentColumnKey: string, direction: 'prev' | 'next') => {
    const idx = KANBAN_STATUS_ORDER.findIndex(s => s.key === currentColumnKey);
    if (idx === -1) return null;
    const targetIdx = direction === 'prev' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= KANBAN_STATUS_ORDER.length) return null;
    return KANBAN_STATUS_ORDER[targetIdx];
  };

  const renderSwipeAction = (direction: 'prev' | 'next', columnKey: string) => {
    const target = getAdjacentStatus(columnKey, direction);
    if (!target) return () => null;
    const col = getKanbanColumns(colors).find(c => c.key === target.key);
    const actionColor = col?.color || colors.primary;
    const isAssignTransition = columnKey === 'unassigned' && target.key === 'assigned';
    const isUnassignTransition = columnKey === 'assigned' && target.key === 'unassigned';
    const actionLabel = isAssignTransition ? 'Assign' : isUnassignTransition ? 'Unassign' : target.label;
    const actionIcon = isAssignTransition ? 'user-plus' : isUnassignTransition ? 'user-minus' : (direction === 'prev' ? 'chevron-left' : 'chevron-right');
    return () => (
      <View style={{
        backgroundColor: actionColor,
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        borderRadius: radius.md,
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.sm,
      }}>
        <Feather
          name={actionIcon as any}
          size={16}
          color={colors.white}
        />
        <Text style={{ color: colors.white, fontSize: 10, fontWeight: '600', textAlign: 'center', marginTop: 2 }} numberOfLines={1}>
          {actionLabel}
        </Text>
      </View>
    );
  };

  const handleSwipeOpen = (job: JobData, columnKey: string, direction: 'left' | 'right') => {
    const swipeDirection = direction === 'left' ? 'next' : 'prev';
    const target = getAdjacentStatus(columnKey, swipeDirection);
    const ref = swipeableRefs.current.get(job.id);
    if (ref) {
      setTimeout(() => ref.close(), 200);
    }
    if (!target) return;

    if (columnKey === 'unassigned' && target.key === 'assigned') {
      openAssignModal(job);
      return;
    }
    if (columnKey === 'assigned' && target.key === 'unassigned') {
      handleUnassign(job);
      return;
    }

    handleStatusChange(job, target.status);
  };

  const renderKanbanJobCard = (job: JobData, showAssignAction: boolean = true, columnKey: string = '') => {
    const statusColor = getStatusColor(job.status);
    const assignedMember = job.assignedTo ? teamMembers.find(m => m.userId === job.assignedTo) : null;
    const hasPrev = !!getAdjacentStatus(columnKey, 'prev');
    const hasNext = !!getAdjacentStatus(columnKey, 'next');

    const cardContent = (
      <PressableRow style={styles.kanbanJobCard} onPress={() => router.push(`/job/${job.id}`)} onLongPress={() => showMoveMenu(job)} delayLongPress={400} >
        <View style={[styles.kanbanJobStrip, { backgroundColor: statusColor }]} />
        <View style={styles.kanbanJobBody}>
          <Text style={styles.kanbanJobTitle} numberOfLines={2}>{job.title}</Text>
          {job.clientName && (
            <View style={styles.kanbanJobDetail}>
              <Feather name="user" size={10} color={colors.mutedForeground} />
              <Text style={styles.kanbanJobDetailText} numberOfLines={1}>{job.clientName}</Text>
            </View>
          )}
          {job.scheduledAt && (
            <View style={styles.kanbanJobDetail}>
              <Feather name="clock" size={10} color={colors.mutedForeground} />
              <Text style={styles.kanbanJobDetailText}>{formatTime(job.scheduledAt)}</Text>
            </View>
          )}
          <View style={styles.kanbanCardActions}>
            {assignedMember ? (
              <PressableRow style={styles.kanbanAssignedRow} onPress={() => openAssignModal(job)} >
                <TeamAvatar
                  firstName={assignedMember.firstName}
                  lastName={assignedMember.lastName}
                  userId={String(assignedMember.userId)}
                  themeColor={(assignedMember as any).themeColor}
                  size={20}
                />
                <Text style={styles.kanbanAssignedName} numberOfLines={1}>{getMemberName(assignedMember).split(' ')[0]}</Text>
              </PressableRow>
            ) : showAssignAction ? (
              <PressableRow style={styles.kanbanAssignBtn} onPress={() => openAssignModal(job)} >
                <Feather name="user-plus" size={12} color={colors.primary} />
                <Text style={styles.kanbanAssignBtnText}>Assign</Text>
              </PressableRow>
            ) : <View />}
            <PressableRow style={styles.kanbanMoveBtn} onPress={() => showMoveMenu(job)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} >
              <Feather name="move" size={12} color={colors.mutedForeground} />
            </PressableRow>
          </View>
        </View>
      </PressableRow>
    );

    if (!hasPrev && !hasNext) {
      return <View key={job.id}>{cardContent}</View>;
    }

    return (
      <Swipeable
        key={job.id}
        ref={(ref) => { if (ref) swipeableRefs.current.set(job.id, ref); }}
        renderLeftActions={hasNext ? renderSwipeAction('next', columnKey) : undefined}
        renderRightActions={hasPrev ? renderSwipeAction('prev', columnKey) : undefined}
        onSwipeableOpen={(direction) => handleSwipeOpen(job, columnKey, direction)}
        overshootLeft={false}
        overshootRight={false}
        friction={2}
      >
        {cardContent}
      </Swipeable>
    );
  };

  const renderKanbanColumn = (column: ReturnType<typeof getKanbanColumns>[0]) => {
    const columnJobs = kanbanData[column.key as keyof typeof kanbanData] || [];
    return (
      <View key={column.key} style={styles.kanbanColumn}>
        <View style={[styles.kanbanColumnHeader, { borderTopColor: column.color }]}>
          <View style={styles.kanbanColumnTitleRow}>
            <Feather name={column.icon} size={14} color={column.color} />
            <Text style={styles.kanbanColumnTitle}>{column.label}</Text>
          </View>
          <View style={[styles.kanbanCountBadge, { backgroundColor: `${column.color}20` }]}>
            <Text style={[styles.kanbanCountText, { color: column.color }]}>{columnJobs.length}</Text>
          </View>
        </View>
        <ScrollView
          style={styles.kanbanColumnScroll}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {columnJobs.length === 0 ? (
            <View style={styles.kanbanEmpty}>
              <Feather name={column.icon} size={20} color={colors.mutedForeground} />
              <Text style={styles.kanbanEmptyText}>No jobs</Text>
            </View>
          ) : (
            columnJobs.map(j => renderKanbanJobCard(j, column.key === 'unassigned', column.key))
          )}
        </ScrollView>
      </View>
    );
  };

  const kanbanColWidth = isTabletDevice ? 210 : 170;

  const jumpToCol = (key: string) => {
    setKanbanCol(key);
    const idx = KANBAN_COLUMNS.findIndex(c => c.key === key);
    if (idx >= 0 && kanbanScrollRef.current) {
      kanbanScrollRef.current.scrollTo({ x: idx * (kanbanColWidth + spacing.sm), animated: true });
    }
  };

  const renderKanbanView = () => (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kanbanNavRow}>
        {KANBAN_COLUMNS.map(col => {
          const count = (kanbanData[col.key as keyof typeof kanbanData] || []).length;
          const active = kanbanCol === col.key;
          return (
            <TouchableOpacity
              key={col.key}
              activeOpacity={0.7}
              onPress={() => jumpToCol(col.key)}
              style={[styles.kanbanNavChip, active && { backgroundColor: col.color, borderColor: col.color }]}
            >
              <Feather name={col.icon} size={12} color={active ? colors.white : col.color} />
              <Text style={[styles.kanbanNavChipText, { color: active ? colors.white : colors.foreground }]}>{col.label}</Text>
              <View style={[styles.kanbanNavCount, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : `${col.color}20` }]}>
                <Text style={[styles.kanbanNavCountText, { color: active ? colors.white : col.color }]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.kanbanHint}>
        <Feather name="info" size={12} color={colors.mutedForeground} />
        <Text style={styles.kanbanHintText}>Swipe a card left or right to move it</Text>
      </View>
      <ScrollView
        ref={kanbanScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.kanbanScrollContainer}
        contentContainerStyle={styles.kanbanScrollContent}
        decelerationRate="fast"
        snapToInterval={kanbanColWidth + spacing.sm}
        snapToAlignment="start"
      >
        {KANBAN_COLUMNS.map(col => renderKanbanColumn(col))}
      </ScrollView>
    </View>
  );

  const getMarkerColor = (status: string): string => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'scheduled': return '#3b82f6';
      case 'en_route': case 'on_my_way': return '#8b5cf6';
      case 'in_progress': case 'working': return '#f97316';
      case 'completed': case 'done': return '#22c55e';
      case 'invoiced': return '#6366f1';
      default: return '#6b7280';
    }
  };

  const renderMapView = () => {
    if (Platform.OS === 'web' || !MapView) {
      return (
        <View style={{ padding: spacing.xl, alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <Feather name="map" size={48} color={colors.mutedForeground} />
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground, marginTop: spacing.md }}>Map Not Available</Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: 'center', marginTop: spacing.xs }}>
            Map view is available in the native app
          </Text>
        </View>
      );
    }

    const screenHeight = Dimensions.get('window').height;
    const mapHeight = screenHeight - 280;

    return (
      <View>
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={{ width: '100%', height: mapHeight }}
            initialRegion={mapRegion}
            showsUserLocation
            showsMyLocationButton
          >
            {geocodedJobs.map(({ job, lat, lng }) => {
              const markerColor = getMarkerColor(job.status);
              const assignedMember = job.assignedTo ? teamMembers.find(m => m.userId === job.assignedTo) : null;
              return (
                <Marker
                  key={`job-${job.id}`}
                  coordinate={{ latitude: lat, longitude: lng }}
                  pinColor={markerColor}
                  onPress={() => setSelectedMapJob(job)}
                >
                  <Callout onPress={() => router.push(`/job/${job.id}`)}>
                    <View style={styles.calloutContainer}>
                      <Text style={styles.calloutTitle}>{job.title}</Text>
                      <View style={[styles.calloutStatusBadge, { backgroundColor: `${markerColor}25` }]}>
                        <Text style={[styles.calloutStatusText, { color: markerColor }]}>{getStatusLabel(job.status)}</Text>
                      </View>
                      {job.clientName && (
                        <Text style={styles.calloutDetail}>{job.clientName}</Text>
                      )}
                      {job.address && (
                        <Text style={styles.calloutDetail} numberOfLines={2}>{job.address}</Text>
                      )}
                      {assignedMember && (
                        <Text style={styles.calloutAssigned}>
                          Assigned: {getMemberName(assignedMember)}
                        </Text>
                      )}
                      {job.scheduledAt && (
                        <Text style={styles.calloutDetail}>
                          {format(parseISO(job.scheduledAt), 'EEE, d MMM · h:mm a')}
                        </Text>
                      )}
                      <Text style={styles.calloutTapHint}>Tap to view job</Text>
                    </View>
                  </Callout>
                </Marker>
              );
            })}
          </MapView>

          {geocodedJobs.length === 0 && (
            <View style={styles.mapEmptyOverlay}>
              <View style={styles.mapEmptyCard}>
                <Feather name="map-pin" size={24} color={colors.mutedForeground} />
                <Text style={styles.mapEmptyTitle}>No job locations</Text>
                <Text style={styles.mapEmptySubtitle}>
                  Jobs with addresses will appear as pins on the map
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.mapLegend}>
          <Text style={styles.mapLegendTitle}>
            {geocodedJobs.length} job{geocodedJobs.length !== 1 ? 's' : ''} on map
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mapLegendItems}>
            {[
              { label: 'Pending', color: '#f59e0b' },
              { label: 'Scheduled', color: '#3b82f6' },
              { label: 'En Route', color: '#8b5cf6' },
              { label: 'In Progress', color: '#f97316' },
              { label: 'Complete', color: '#22c55e' },
            ].map(item => (
              <View key={item.label} style={styles.mapLegendItem}>
                <View style={[styles.mapLegendDot, { backgroundColor: item.color }]} />
                <Text style={styles.mapLegendLabel}>{item.label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {selectedMapJob && (
          <View style={styles.mapJobDetail}>
            <PressableRow style={styles.mapJobDetailCard} onPress={() => router.push(`/job/${selectedMapJob.id}`)} >
              <View style={[styles.mapJobDetailStrip, { backgroundColor: getMarkerColor(selectedMapJob.status) }]} />
              <View style={styles.mapJobDetailContent}>
                <View style={styles.mapJobDetailHeader}>
                  <Text style={styles.mapJobDetailTitle} numberOfLines={1}>{selectedMapJob.title}</Text>
                  <PressableRow onPress={() => setSelectedMapJob(null)} >
                    <Feather name="x" size={18} color={colors.mutedForeground} />
                  </PressableRow>
                </View>
                <View style={[styles.calloutStatusBadge, { backgroundColor: `${getMarkerColor(selectedMapJob.status)}25`, alignSelf: 'flex-start' }]}>
                  <Text style={[styles.calloutStatusText, { color: getMarkerColor(selectedMapJob.status) }]}>{getStatusLabel(selectedMapJob.status)}</Text>
                </View>
                {selectedMapJob.clientName && (
                  <View style={styles.mapJobDetailRow}>
                    <Feather name="user" size={12} color={colors.mutedForeground} />
                    <Text style={styles.mapJobDetailText}>{selectedMapJob.clientName}</Text>
                  </View>
                )}
                {selectedMapJob.address && (
                  <View style={styles.mapJobDetailRow}>
                    <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                    <Text style={styles.mapJobDetailText} numberOfLines={1}>{selectedMapJob.address}</Text>
                  </View>
                )}
                {selectedMapJob.scheduledAt && (
                  <View style={styles.mapJobDetailRow}>
                    <Feather name="clock" size={12} color={colors.mutedForeground} />
                    <Text style={styles.mapJobDetailText}>{format(parseISO(selectedMapJob.scheduledAt), 'EEE, d MMM · h:mm a')}</Text>
                  </View>
                )}
                <View style={styles.mapJobDetailActions}>
                  <PressableRow style={[styles.mapJobDetailBtn, { backgroundColor: colors.primary }]} onPress={() => router.push(`/job/${selectedMapJob.id}`)} >
                    <Feather name="eye" size={14} color={colors.primaryForeground || colors.white} />
                    <Text style={[styles.mapJobDetailBtnText, { color: colors.primaryForeground || colors.white }]}>View Job</Text>
                  </PressableRow>
                  <PressableRow style={[styles.mapJobDetailBtn, { backgroundColor: colors.muted }]} onPress={() => openAssignModal(selectedMapJob)} >
                    <Feather name="user-plus" size={14} color={colors.foreground} />
                    <Text style={[styles.mapJobDetailBtnText, { color: colors.foreground }]}>
                      {selectedMapJob.assignedTo ? 'Reassign' : 'Assign'}
                    </Text>
                  </PressableRow>
                </View>
              </View>
            </PressableRow>
          </View>
        )}
      </View>
    );
  };

  const renderAssignModal = () => (
    <AppBottomSheet
      visible={showAssignModal}
      onDismiss={() => { setShowAssignModal(false); setAssigningJob(null); }}
      title={assigningJob?.assignedTo ? 'Reassign Job' : 'Assign Job'}
      showCloseButton
      snapPoints={['70%']}
    >
      <View>
        {assigningJob && (
          <View style={styles.modalJobInfo}>
            <Text style={styles.modalJobTitle}>{assigningJob.title}</Text>
            {assigningJob.scheduledAt && (
              <Text style={styles.modalJobMeta}>{format(parseISO(assigningJob.scheduledAt), 'EEE, d MMM · h:mm a')}</Text>
            )}
          </View>
        )}
        {assigningJob?.assignedTo && (
          <PressableRow style={styles.modalMemberItem} onPress={() => handleUnassign(assigningJob)} >
            <View style={[styles.modalMemberAvatar, { backgroundColor: colors.destructive }]}>
              <Feather name="user-x" size={16} color={colors.destructiveForeground || colors.white} />
            </View>
            <Text style={[styles.modalMemberName, { color: colors.destructive }]}>Unassign</Text>
          </PressableRow>
        )}
        {teamMembers.map(member => {
          const isCurrentlyAssigned = assigningJob?.assignedTo === member.userId;
          return (
            <PressableRow key={member.id} style={[styles.modalMemberItem, isCurrentlyAssigned && styles.modalMemberItemActive]} onPress={() => handleAssign(member.userId)} disabled={isAssigning || isCurrentlyAssigned} >
              <TeamAvatar
                firstName={member.firstName}
                lastName={member.lastName}
                userId={String(member.userId)}
                themeColor={(member as any).themeColor}
                size={36}
              />
              <View style={styles.modalMemberInfo}>
                <Text style={styles.modalMemberName}>{getMemberName(member)}</Text>
                {member.roleName && <Text style={styles.modalMemberRole}>{member.roleName}</Text>}
              </View>
              {isCurrentlyAssigned && (
                <Feather name="check" size={18} color={colors.primary} />
              )}
            </PressableRow>
          );
        })}
        {isAssigning && (
          <View style={styles.modalLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.modalLoadingText}>Assigning...</Text>
          </View>
        )}
      </View>
    </AppBottomSheet>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomNavHeight + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          <View style={styles.header}>
            <PressableRow onPress={() => router.back()} style={styles.backButton} >
              <Feather name="chevron-left" size={22} color={colors.foreground} />
            </PressableRow>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Dispatch Board</Text>
            </View>
            <View style={styles.headerDatePill}>
              <Text style={styles.headerDatePillText}>{format(now, 'EEE d MMM')}</Text>
            </View>
            <PressableRow onPress={onRefresh} style={styles.refreshBtn} accessibilityLabel="Refresh data">
              <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
            </PressableRow>
          </View>
          <View style={styles.syncStampRow}>
            <View style={[styles.syncDot, { backgroundColor: refreshing ? colors.warning : colors.success }]} />
            <Text style={styles.syncStampText}>
              {refreshing ? 'Syncing…' : `Updated ${formatRelativeAgo(lastSyncedAt)}`}
            </Text>
          </View>

          <View style={styles.tabBar}>
            {([
              { key: 'liveops', label: 'Live Ops' },
              { key: 'schedule', label: 'Schedule' },
              { key: 'performance', label: 'Performance' },
            ] as { key: ViewMode; label: string }[]).map(t => {
              const active = viewMode === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  activeOpacity={0.7}
                  onPress={() => setViewMode(t.key)}
                  style={styles.tabBtn}
                >
                  <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{t.label}</Text>
                  {active && <View style={styles.tabBtnUnderline} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {viewMode === 'liveops' && renderLiveOps()}
          {viewMode === 'schedule' && renderScheduleView()}
          {viewMode === 'performance' && renderPerformance()}
          {viewMode === 'kanban' && renderKanbanView()}
          {viewMode === 'map' && renderMapView()}
        </ScrollView>

        {renderAssignModal()}
      </View>
    </>
  );
}

const createStyles = (colors: ThemeColors, contentWidth: number, responsivePadding: number, isTabletDevice: boolean, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: responsivePadding,
    paddingTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 2,
  },
  headerLeft: {
    flex: 1,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 2,
  },
  pageTitle: {
    ...typography.sectionTitle,
    color: colors.foreground,
  },
  pageSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  opsHealthContainer: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...(isDark ? {} : {
      shadowColor: '#1c2130',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
    }),
  },
  opsHealthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  opsHealthTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  opsHealthTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  opsHealthDate: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  opsHealthGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  opsHealthRow2: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  opsHealthSmallCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.muted,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  opsHealthSmallValue: {
    ...typography.bodySemibold,
    color: colors.foreground,
  },
  opsHealthSmallLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  opsHealthCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  opsHealthCardAlert: {
    backgroundColor: colors.destructiveLight || (isDark ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2'),
  },
  opsHealthCardWarn: {
    backgroundColor: colors.warningLight || (isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb'),
  },
  opsHealthValue: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  opsHealthLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.xs,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  viewToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  viewToggleButtonActive: {
    backgroundColor: colors.primary,
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  viewToggleTextActive: {
    color: colors.primaryForeground,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dateNavButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateNavTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    textAlign: 'center',
  },
  dateNavToday: {
    ...typography.captionSmall,
    color: colors.primary,
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 2,
  },
  scheduleSection: {
    marginBottom: spacing.xl,
  },
  scheduleSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  scheduleSectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  scheduleSectionTitle: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  scheduleSectionTitleWrap: {
    flex: 1,
  },
  scheduleSectionSubtitle: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  emptyMemberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyMemberText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  jobCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  jobCardStatusStrip: {
    width: 4,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
  jobCardContent: {
    flex: 1,
    padding: spacing.md,
  },
  jobCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  jobCardTitle: {
    ...typography.bodySemibold,
    color: colors.foreground,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  jobCardDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 3,
  },
  jobCardDetailText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  jobCardActions: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  miniAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.white,
  },
  assignedName: {
    ...typography.captionSmall,
    color: colors.foreground,
    fontWeight: '500',
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  assignButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.sm,
  },
  emptyStateTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  emptyStateSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  kanbanScrollContainer: {
    marginHorizontal: -responsivePadding,
  },
  kanbanScrollContent: {
    paddingHorizontal: responsivePadding,
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  kanbanColumn: {
    width: isTabletDevice ? 210 : 170,
    backgroundColor: colors.muted,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...(isDark ? {} : shadows.xs),
  },
  kanbanColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: 3,
  },
  kanbanColumnTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  kanbanColumnTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.foreground,
  },
  kanbanCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: radius.sm,
    minWidth: 22,
    alignItems: 'center',
  },
  kanbanCountText: {
    fontSize: 11,
    fontWeight: '800',
  },
  kanbanColumnScroll: {
    maxHeight: 480,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  kanbanEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.sm,
    opacity: 0.6,
  },
  kanbanEmptyText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  kanbanJobCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  kanbanJobStrip: {
    width: 3,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
  kanbanJobBody: {
    flex: 1,
    padding: spacing.sm,
    gap: 3,
  },
  kanbanJobTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
    lineHeight: 17,
  },
  kanbanJobDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  kanbanJobDetailText: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  kanbanHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  kanbanHintText: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  kanbanCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  kanbanMoveBtn: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kanbanAssignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  kanbanMiniAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kanbanMiniAvatarText: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.white,
  },
  kanbanAssignedName: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.foreground,
  },
  kanbanAssignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  kanbanAssignBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    maxHeight: '70%',
    paddingBottom: spacing['4xl'],
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.muted,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  modalJobInfo: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalJobTitle: {
    ...typography.bodySemibold,
    color: colors.foreground,
  },
  modalJobMeta: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  modalList: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  modalMemberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalMemberItemActive: {
    opacity: 0.6,
  },
  modalMemberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalMemberAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.foreground,
  },
  modalMemberInfo: {
    flex: 1,
  },
  modalMemberName: {
    ...typography.bodySemibold,
    color: colors.foreground,
  },
  modalMemberRole: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  modalLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  modalLoadingText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  mapContainer: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...(isDark ? {} : shadows.xs),
  },
  mapEmptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  mapEmptyCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapEmptyTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  mapEmptySubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  mapLegend: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapLegendTitle: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  mapLegendItems: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  mapLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  mapLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  mapLegendLabel: {
    ...typography.captionSmall,
    color: colors.foreground,
  },
  mapJobDetail: {
    marginTop: spacing.md,
  },
  mapJobDetailCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...(isDark ? {} : shadows.sm),
  },
  mapJobDetailStrip: {
    width: 4,
  },
  mapJobDetailContent: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  mapJobDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mapJobDetailTitle: {
    ...typography.bodySemibold,
    color: colors.foreground,
    flex: 1,
  },
  mapJobDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  mapJobDetailText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    flex: 1,
  },
  mapJobDetailActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  mapJobDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  mapJobDetailBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  calloutContainer: {
    padding: spacing.sm,
    minWidth: 180,
    maxWidth: 250,
  },
  calloutTitle: {
    ...typography.bodySemibold,
    color: '#000',
    marginBottom: spacing.xs,
  },
  calloutStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  calloutStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  calloutDetail: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  calloutAssigned: {
    fontSize: 12,
    color: colors.foreground,
    fontWeight: '500',
    marginTop: spacing.xs,
  },
  calloutTapHint: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '600',
    marginTop: 6,
  },
  // Compact ops health
  opsCompact: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  opsCompactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  opsChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  opsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.muted,
  },
  opsChipValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  opsChipLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  opsExpanded: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  opsExpandedCard: {
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    gap: 2,
  },
  opsExpandedValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  opsExpandedLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  // Unassigned pickup strip
  unassignedStrip: {
    marginBottom: spacing.md,
  },
  unassignedStripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  unassignedStripTitle: {
    ...typography.captionSmall,
    color: colors.foreground,
    fontWeight: '700',
    flex: 1,
  },
  unassignedStripHint: {
    fontSize: 10,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  pickupCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.muted,
  },
  pickupCancelText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  unassignedChipsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: 2,
  },
  unassignedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 200,
  },
  unassignedChipActive: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  unassignedChipText: {
    fontSize: 12,
    color: colors.foreground,
    flexShrink: 1,
  },
  unassignedChipDur: {
    fontSize: 10,
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  // Timeline
  timelineCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginHorizontal: -responsivePadding,
  },
  timelineRulerRow: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timelineRulerCorner: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  timelineRuler: {
    flexDirection: 'row',
  },
  timelineRulerCell: {
    width: TIMELINE_HOUR_WIDTH,
    paddingVertical: spacing.xs,
    paddingLeft: 4,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  timelineRulerText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  timelineRow: {
    flexDirection: 'row',
    height: TIMELINE_ROW_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timelineLabel: {
    width: TIMELINE_LABEL_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.xs,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.background,
  },
  timelineLabelIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLabelName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.foreground,
  },
  timelineLabelSub: {
    fontSize: 10,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  timelineGrid: {
    width: TIMELINE_GRID_WIDTH,
    height: TIMELINE_ROW_HEIGHT,
    position: 'relative',
  },
  timelineGridline: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.border,
    opacity: 0.5,
  },
  timelineDropCell: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: TIMELINE_HOUR_WIDTH - 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}08`,
  },
  timelineBlock: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  timelineBlockTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  timelineBlockMeta: {
    fontSize: 9,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  timelineEmptyHint: {
    position: 'absolute',
    left: spacing.md,
    top: '50%',
    marginTop: -7,
    fontSize: 10,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  // Kanban nav chips
  kanbanNavRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: 2,
    marginBottom: spacing.sm,
  },
  kanbanNavChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  kanbanNavChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  kanbanNavCount: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.sm,
    minWidth: 18,
    alignItems: 'center',
  },
  kanbanNavCountText: {
    fontSize: 10,
    fontWeight: '800',
  },

  // Header date pill
  headerDatePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    marginRight: spacing.xs,
  },
  headerDatePillText: {
    ...typography.caption,
    color: colors.mutedForeground,
    fontWeight: '600',
  },

  // Tab bar (underline style)
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.xl,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    position: 'relative',
  },
  tabBtnText: {
    ...typography.body,
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  tabBtnTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  tabBtnUnderline: {
    position: 'absolute',
    bottom: -1,
    left: '15%',
    right: '15%',
    height: 2.5,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },

  // Stat bar (Live Ops top) — bold premium numbers, no busy borders
  statBar: {
    flexDirection: 'row',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.lg,
  },
  statBarItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  statBarValue: {
    ...typography.largeTitle,
    fontWeight: '700',
  },
  statBarLabel: {
    ...typography.label,
    color: colors.mutedForeground,
  },

  // Alert banner
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: `${colors.warning}12`,
    borderWidth: 1,
    borderColor: `${colors.warning}30`,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadows.xs,
  },
  alertBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBannerTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  alertBannerSub: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },

  // Section eyebrow
  sectionEyebrow: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },

  // Worker card
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.xs,
  },
  workerCardAvatarWrap: {
    position: 'relative',
  },
  workerCardStatusDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  workerCardBody: {
    flex: 1,
    minWidth: 0,
  },
  workerCardName: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  workerCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  workerCardMeta: {
    ...typography.caption,
    color: colors.mutedForeground,
    flex: 1,
  },
  workerStatusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  workerStatusPillText: {
    ...typography.badge,
  },

  // Week strip
  weekStripRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  weekDay: {
    minWidth: 56,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    alignItems: 'center',
    backgroundColor: colors.muted,
  },
  weekDaySel: {
    backgroundColor: colors.primary,
    ...shadows.xs,
  },
  weekDayDow: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
  },
  weekDayDowSel: {
    color: colors.primaryForeground,
  },
  weekDayDom: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.foreground,
    marginTop: 2,
  },
  weekDayDomSel: {
    color: colors.primaryForeground,
  },

  // Pickup hint bar
  pickupBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: `${colors.primary}10`,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  pickupBarText: {
    ...typography.captionSmall,
    color: colors.foreground,
    flex: 1,
  },

  // Unassigned queue card
  queueCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.lg,
    ...shadows.xs,
  },
  queueCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  queueCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flex: 1,
  },
  queueCardHint: {
    fontSize: 10,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    marginBottom: spacing.xs,
  },
  queueItemHeld: {
    backgroundColor: `${colors.primary}12`,
    borderWidth: 1,
    borderColor: `${colors.primary}40`,
  },
  queueItemMain: {
    flex: 1,
    minWidth: 0,
  },
  queueItemTitle: {
    ...typography.bodySmall,
    color: colors.foreground,
    fontWeight: '700',
  },
  queueItemMeta: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  queueItemAssignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  queueItemAssignText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },

  // Performance — period pills
  periodRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  periodPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
  },
  periodPillActive: {
    backgroundColor: colors.primary,
  },
  periodPillText: {
    ...typography.captionSmall,
    color: colors.foreground,
    fontWeight: '600',
  },
  periodPillTextActive: {
    color: colors.primaryForeground,
    fontWeight: '700',
  },

  // Performance metric grid
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  metricCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.xs,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    fontWeight: '600',
    flex: 1,
  },
  metricValue: {
    ...typography.largeTitle,
    fontWeight: '700',
  },

  // Performance per-member
  perfMemberCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.xs,
  },
  perfMemberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  perfMemberName: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  perfMemberRole: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  perfMemberScore: {
    ...typography.headline,
    letterSpacing: -0.5,
  },
  perfBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.muted,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  perfBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  perfStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  perfStat: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  perfStatStrong: {
    color: colors.foreground,
    fontWeight: '700',
  },
  perfStatDot: {
    fontSize: 12,
    color: colors.mutedForeground,
  },

  // Sync stamp (under header)
  syncStampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
    paddingLeft: spacing.xxs,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncStampText: {
    fontSize: 11,
    color: colors.mutedForeground,
    fontWeight: '500',
  },

  // Worker availability strip (left edge of timeline label)
  availStrip: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },

  // Travel block (light grey segment between consecutive jobs)
  travelBlock: {
    position: 'absolute',
    top: TIMELINE_ROW_HEIGHT / 2 - 6,
    height: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Conflict highlight on timeline block
  timelineBlockConflict: {
    borderWidth: 1.5,
    borderColor: colors.destructive,
    borderLeftWidth: 3,
  },
  timelineBlockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  // Now line
  nowLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.destructive,
    zIndex: 10,
  },
  nowLineDot: {
    position: 'absolute',
    top: -3,
    left: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.destructive,
  },

  // Quick filter chips
  filterChipsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: `${colors.primary}15`,
    borderColor: colors.primary,
  },
  filterChipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  filterChipLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  filterChipCount: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  filterChipCountActive: {
    backgroundColor: colors.primary,
  },
  filterChipCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.mutedForeground,
  },
  filterChipCountTextActive: {
    color: colors.primaryForeground,
  },

  // Queue bulk-actions
  queueItemSelected: {
    backgroundColor: `${colors.primary}10`,
    borderWidth: 1,
    borderColor: `${colors.primary}40`,
  },
  queueItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  queueCheckbox: {
    paddingRight: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueBulkCancel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  queueBulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  queueBulkBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryForeground,
  },
});
