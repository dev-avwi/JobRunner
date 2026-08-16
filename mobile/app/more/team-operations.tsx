import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import { router, Stack, useFocusEffect } from 'expo-router';
import { OwnerOnlyGuard } from '../../src/components/ui/OwnerOnlyGuard';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, sizes, iconSizes, usePageShell, fontWeights } from '../../src/lib/design-tokens';
import { TeamAvatar } from '../../src/components/TeamAvatar';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { formatDistanceToNow, format, isAfter, isToday, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { useIsTablet, useContentWidth } from '../../src/lib/device';
import { useUserRole } from '../../src/hooks/use-user-role';

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: keyof typeof Feather.glyphMap }> = {
  online: { color: '#22c55e', label: 'Online', icon: 'circle' },
  busy: { color: '#f59e0b', label: 'Busy', icon: 'circle' },
  on_job: { color: '#f97316', label: 'On Job', icon: 'tool' },
  break: { color: '#9ca3af', label: 'On Break', icon: 'coffee' },
  offline: { color: '#6b7280', label: 'Offline', icon: 'circle' },
  available: { color: '#22c55e', label: 'Available', icon: 'check-circle' },
  travelling: { color: '#3b82f6', label: 'Travelling', icon: 'navigation' },
  delayed: { color: '#eab308', label: 'Delayed', icon: 'alert-triangle' },
  needs_help: { color: '#ef4444', label: 'Needs Help', icon: 'alert-circle' },
  unavailable: { color: '#9ca3af', label: 'Unavailable', icon: 'x-circle' },
};

const ACTIVITY_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; color: string; bgColor: string }> = {
  job_created: { icon: 'briefcase', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' },
  job_started: { icon: 'play', color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' },
  job_completed: { icon: 'check-circle', color: '#10b981', bgColor: 'rgba(16,185,129,0.1)' },
  quote_sent: { icon: 'file-text', color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
  invoice_sent: { icon: 'send', color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' },
  invoice_paid: { icon: 'credit-card', color: '#10b981', bgColor: 'rgba(16,185,129,0.1)' },
  check_in: { icon: 'map-pin', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' },
  check_out: { icon: 'log-out', color: '#a855f7', bgColor: 'rgba(168,85,247,0.1)' },
  client_added: { icon: 'user-plus', color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' },
  message_sent: { icon: 'message-circle', color: '#a855f7', bgColor: 'rgba(168,85,247,0.1)' },
};

interface TeamPresenceData {
  userId: string;
  status: string;
  statusMessage?: string;
  currentJobId?: string;
  lastSeenAt?: string;
  lastLocationLat?: number;
  lastLocationLng?: number;
  user?: { id: string; firstName?: string; lastName?: string; email?: string; profileImageUrl?: string };
  currentJob?: { id: string; title: string };
}

interface TeamMemberData {
  id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  profileImageUrl?: string;
  role?: string;
  roleName?: string;
  inviteStatus?: string;
  hourlyRate?: string;
}

interface ActivityFeedItem {
  id: string;
  actorName?: string;
  actorUserId?: string;
  activityType: string;
  entityType?: string;
  entityId?: string;
  entityTitle?: string;
  description?: string;
  isImportant?: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

interface JobData {
  id: string;
  title: string;
  status: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  clientName?: string;
  assignedTo?: string;
  scheduledAt?: string;
  estimatedDuration?: number;
}

interface MemberWithDetails extends TeamMemberData {
  assignedJobs: JobData[];
  presence?: TeamPresenceData;
}

interface TeamMemberAvailability {
  id: string;
  teamMemberId: string;
  dayOfWeek: number;
  isAvailable: boolean;
  startTime?: string;
  endTime?: string;
}

interface TeamMemberTimeOff {
  id: string;
  teamMemberId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
}

type TabType = 'live' | 'scheduling' | 'performance';
type PerfPeriod = 'today' | 'week' | 'month';

function safeDateDistance(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch { return ''; }
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

function formatJobTimeRange(job: JobData): string {
  if (!job.scheduledAt) return '';
  try {
    const start = parseISO(job.scheduledAt);
    if (isNaN(start.getTime())) return '';
    const dur = job.estimatedDuration || 60;
    const end = new Date(start.getTime() + dur * 60000);
    return `${format(start, 'h:mma')} – ${format(end, 'h:mma')}`;
  } catch { return ''; }
}

function TeamOperationsScreenInner() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const responsiveShell = usePageShell();
  const contentWidth = useContentWidth();
  const isTabletDevice = useIsTablet();
  const styles = useMemo(() => createStyles(colors, contentWidth, responsiveShell.paddingHorizontal, isTabletDevice, isDark), [colors, contentWidth, responsiveShell.paddingHorizontal, isTabletDevice, isDark]);
  const { user } = useAuthStore();

  const { hasTeamSubscription, hasProSubscription, subscriptionTier, isOwner: roleIsOwner, isManager: roleIsManager } = useUserRole();

  const [activeTab, setActiveTab] = useState<TabType>('live');
  const [perfPeriod, setPerfPeriod] = useState<PerfPeriod>('week');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [teamMembers, setTeamMembers] = useState<TeamMemberData[]>([]);
  const [teamPresence, setTeamPresence] = useState<TeamPresenceData[]>([]);
  const [workerStates, setWorkerStates] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<Map<string, TeamMemberAvailability[]>>(new Map());
  const [timeOffRequests, setTimeOffRequests] = useState<TeamMemberTimeOff[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningToMember, setAssigningToMember] = useState<MemberWithDetails | null>(null);
  const [isAssigningJob, setIsAssigningJob] = useState(false);
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [timeOffStart, setTimeOffStart] = useState('');
  const [timeOffEnd, setTimeOffEnd] = useState('');
  const [timeOffReason, setTimeOffReason] = useState('annual_leave');
  const [timeOffNotes, setTimeOffNotes] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [now, setNow] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // user.role from the auth store is unreliable (legacy column); use the
  // resolved role hook so real managers pass this gate.
  const isOwnerOrManager = roleIsOwner || roleIsManager || user?.role === 'owner' || user?.role === 'admin' || user?.role === 'manager';

  const handleAssignJob = async (job: JobData) => {
    if (!assigningToMember || isAssigningJob) return;
    setIsAssigningJob(true);
    try {
      await api.patch(`/api/jobs/${job.id}`, { assignedTo: assigningToMember.userId });
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, assignedTo: assigningToMember.userId } : j));
      setShowAssignModal(false);
      setAssigningToMember(null);
      Alert.alert('Assigned', `${job.title} assigned to ${assigningToMember.firstName} ${assigningToMember.lastName}`);
    } catch {
      Alert.alert('Error', 'Failed to assign job. Please try again.');
    } finally {
      setIsAssigningJob(false);
    }
  };

  const isFetchingRef = useRef(false);
  const fetchData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const [membersRes, presenceRes, activityRes, jobsRes, timeOffRes, workerStatesRes] = await Promise.all([
        api.get<TeamMemberData[]>('/api/team/members'),
        api.get<TeamPresenceData[]>('/api/team/presence'),
        api.get<ActivityFeedItem[]>('/api/activity-feed?limit=50'),
        api.get<JobData[]>('/api/jobs'),
        api.get<TeamMemberTimeOff[]>('/api/team/time-off'),
        api.get<any[]>('/api/team/worker-states'),
      ]);

      if (Array.isArray(membersRes.data)) setTeamMembers(membersRes.data);
      if (Array.isArray(presenceRes.data)) setTeamPresence(presenceRes.data);
      if (Array.isArray(workerStatesRes.data)) setWorkerStates(workerStatesRes.data);
      if (Array.isArray(activityRes.data)) setActivityFeed(activityRes.data);
      if (Array.isArray(jobsRes.data)) setJobs(jobsRes.data);
      if (Array.isArray(timeOffRes.data)) setTimeOffRequests(timeOffRes.data);
      setLastSyncedAt(new Date());
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  const fetchAvailability = useCallback(async (memberId: string) => {
    setAvailabilityLoading(true);
    try {
      const res = await api.get<TeamMemberAvailability[]>(`/api/team/availability?teamMemberId=${memberId}`);
      if (res.data) {
        setAvailabilityMap(prev => new Map(prev).set(memberId, res.data!));
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setAvailabilityLoading(false);
    }
  }, []);

  // Keep the Live Ops board current: refetch on screen focus and poll while
  // open, so worker availability/status changes (e.g. a subbie going Busy)
  // appear without the owner manually pulling to refresh.
  useFocusEffect(
    useCallback(() => {
      fetchData();
      const poll = setInterval(() => { fetchData(); }, 20000);
      return () => clearInterval(poll);
    }, [fetchData])
  );

  useEffect(() => {
    if (selectedMemberId) fetchAvailability(selectedMemberId);
  }, [selectedMemberId, fetchAvailability]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setAvailabilityMap(new Map());
    await fetchData();
    if (selectedMemberId) await fetchAvailability(selectedMemberId);
    setRefreshing(false);
  }, [fetchData, fetchAvailability, selectedMemberId]);

  const acceptedMembers = useMemo(() =>
    teamMembers.filter(m => m.inviteStatus === 'accepted'),
    [teamMembers]
  );

  const membersWithDetails = useMemo(() => {
    return acceptedMembers.map(member => {
      const presence = teamPresence.find(p => p.userId === member.userId);
      const assignedJobs = jobs.filter(j => j.assignedTo === member.userId);
      return { ...member, presence, assignedJobs };
    });
  }, [acceptedMembers, teamPresence, jobs]);

  const memberStats = useMemo(() => {
    const start = new Date();
    let from: Date;
    let to: Date = new Date();
    if (perfPeriod === 'today') { from = new Date(); from.setHours(0,0,0,0); }
    else if (perfPeriod === 'week') { from = startOfWeek(start, { weekStartsOn: 1 }); to = endOfWeek(start, { weekStartsOn: 1 }); }
    else { from = startOfMonth(start); to = endOfMonth(start); }

    return acceptedMembers.map(member => {
      const allJobs = jobs.filter(j => j.assignedTo === member.userId);
      const periodJobs = allJobs.filter(j => {
        if (!j.scheduledAt) return perfPeriod === 'today';
        const d = parseISO(j.scheduledAt);
        return d >= from && d <= to;
      });
      const completedJobs = periodJobs.filter(j => j.status === 'completed' || j.status === 'done');
      const inProgressJobs = periodJobs.filter(j => j.status === 'in_progress' || j.status === 'working');
      const scheduledJobs = periodJobs.filter(j => j.status === 'scheduled');
      return {
        ...member,
        totalJobs: periodJobs.length,
        completedJobs: completedJobs.length,
        inProgressJobs: inProgressJobs.length,
        scheduledJobs: scheduledJobs.length,
        completionRate: periodJobs.length > 0 ? Math.round((completedJobs.length / periodJobs.length) * 100) : 0,
      };
    }).sort((a, b) => b.completedJobs - a.completedJobs);
  }, [acceptedMembers, jobs, perfPeriod]);

  const totalCompleted = memberStats.reduce((sum, m) => sum + m.completedJobs, 0);
  const totalInProgress = memberStats.reduce((sum, m) => sum + m.inProgressJobs, 0);
  const avgCompletionRate = memberStats.length > 0
    ? Math.round(memberStats.reduce((sum, m) => sum + m.completionRate, 0) / memberStats.length)
    : 0;

  const pendingTimeOff = (timeOffRequests || []).filter(t => t.status === 'pending');

  const onlineCount = useMemo(() =>
    teamPresence.filter(p => p.status === 'online' || p.status === 'on_job').length,
    [teamPresence]
  );
  const onJobCount = useMemo(() =>
    teamPresence.filter(p => p.status === 'on_job').length,
    [teamPresence]
  );

  const unassignedJobs = useMemo(() =>
    jobs.filter(j => !j.assignedTo && (j.status === 'pending' || j.status === 'scheduled' || j.status === 'in_progress')),
    [jobs]
  );

  const handleUpdateAvailability = async (dayOfWeek: number, isAvailable: boolean, startTime?: string, endTime?: string) => {
    if (!selectedMemberId) return;
    try {
      const res = await api.post<TeamMemberAvailability>('/api/team/availability', {
        teamMemberId: selectedMemberId,
        dayOfWeek,
        isAvailable,
        startTime: startTime || '08:00',
        endTime: endTime || '17:00',
      });
      if (res.data) {
        setAvailabilityMap(prev => {
          const next = new Map(prev);
          const list = [...(next.get(selectedMemberId) || [])];
          const idx = list.findIndex(a => a.dayOfWeek === dayOfWeek);
          if (idx >= 0) list[idx] = res.data!; else list.push(res.data!);
          next.set(selectedMemberId, list);
          return next;
        });
      }
    } catch {
      await fetchAvailability(selectedMemberId);
      Alert.alert('Error', 'Failed to update availability');
    }
  };

  const handleRequestTimeOff = async () => {
    if (!selectedMemberId || !timeOffStart || !timeOffEnd) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    try {
      const res = await api.post<TeamMemberTimeOff>('/api/team/time-off', {
        teamMemberId: selectedMemberId,
        startDate: timeOffStart,
        endDate: timeOffEnd,
        reason: timeOffReason,
        notes: timeOffNotes || undefined,
      });
      if (res.data && !res.error) {
        setShowTimeOffModal(false);
        setTimeOffStart(''); setTimeOffEnd(''); setTimeOffReason('annual_leave'); setTimeOffNotes('');
        await fetchData();
        Alert.alert('Success', 'Time off requested');
      }
    } catch {
      Alert.alert('Error', 'Failed to request time off');
    }
  };

  const handleApproveTimeOff = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await api.patch<TeamMemberTimeOff>(`/api/team/time-off/${id}`, { status });
      if (res.data && !res.error) await fetchData();
    } catch {
      Alert.alert('Error', 'Failed to update time off request');
    }
  };

  // Week strip days
  const weekDays = useMemo(() => {
    const anchor = new Date();
    const out: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(anchor); d.setDate(anchor.getDate() + i); d.setHours(0,0,0,0);
      out.push(d);
    }
    return out;
  }, []);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'in_progress': case 'working': return colors.success;
      case 'completed': case 'done': return colors.mutedForeground;
      case 'en_route': case 'on_my_way': return colors.info || colors.primary;
      case 'pending': return colors.warning;
      default: return colors.info || colors.primary;
    }
  };

  // -- RENDER PARTS --

  const renderHero = () => (
    <View style={styles.heroSection}>
      <Text style={styles.pageTitle}>Team Operations</Text>
      <View style={styles.subtitleRow}>
        <Text style={styles.pageSubtitle}>
          {acceptedMembers.length} team member{acceptedMembers.length === 1 ? '' : 's'}  ·  
        </Text>
        <View style={[styles.syncDot, { backgroundColor: refreshing ? colors.warning : colors.success }]} />
        <Text style={styles.pageSubtitle}>
          {refreshing ? ' Syncing…' : ` Updated ${formatRelativeAgo(lastSyncedAt)}`}
        </Text>
      </View>
    </View>
  );

  const renderTabs = () => {
    const tabs: { key: TabType; icon: keyof typeof Feather.glyphMap; label: string }[] = [
      { key: 'live', icon: 'activity', label: 'Live Ops' },
      { key: 'scheduling', icon: 'calendar', label: 'Scheduling' },
      { key: 'performance', icon: 'bar-chart-2', label: 'Performance' },
    ];
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabContainer}>
        {tabs.map(t => {
          const active = activeTab === t.key;
          return (
            <PressableRow
              key={t.key}
              style={[styles.tabButton, active ? styles.tabButtonActive : styles.tabButtonInactive]}
              onPress={() => setActiveTab(t.key)}
            >
              <Feather name={t.icon} size={iconSizes.sm} color={active ? (colors.primaryForeground || colors.white) : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: active ? (colors.primaryForeground || colors.white) : colors.mutedForeground }]}>{t.label}</Text>
            </PressableRow>
          );
        })}
      </ScrollView>
    );
  };

  const renderStatBar = (items: { value: number | string; label: string; color: string }[]) => (
    <View style={styles.statBar}>
      {items.map((s, i) => (
        <View key={s.label} style={styles.statBarItemRow}>
          <View style={styles.statBarItem}>
            <Text style={[styles.statBarValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statBarLabel}>{s.label}</Text>
          </View>
          {i < items.length - 1 && <View style={styles.statBarDivider} />}
        </View>
      ))}
    </View>
  );

  const renderMemberCard = (member: MemberWithDetails) => {
    const ws = workerStates.find((w: any) => w.userId === member.userId);
    const wsState = ws?.state || member.presence?.status || 'offline';
    const wsConfig = STATUS_CONFIG[wsState] || STATUS_CONFIG.offline;

    const activeJob = member.assignedJobs.find(j => j.status === 'in_progress' || j.status === 'working');
    const enRouteJob = !activeJob ? member.assignedJobs.find(j => j.status === 'en_route' || j.status === 'on_my_way') : null;
    const focusJob = activeJob || enRouteJob;

    let pillLabel = 'Available';
    let pillColor = colors.success;
    if (activeJob) { pillLabel = 'On Job'; pillColor = colors.success; }
    else if (enRouteJob) { pillLabel = 'En Route'; pillColor = colors.info || colors.primary; }
    else if (wsState === 'offline') { pillLabel = 'Offline'; pillColor = colors.mutedForeground; }
    else if (wsState === 'busy') { pillLabel = 'Busy'; pillColor = '#f59e0b'; }
    else if (wsState === 'unavailable') { pillLabel = 'Unavailable'; pillColor = colors.mutedForeground; }

    const locShort = focusJob?.address ? focusJob.address.split(',')[0] : null;
    const subtitle = focusJob
      ? `${focusJob.title}${locShort ? ` · ${locShort}` : ''}`
      : (wsState === 'offline' ? 'Offline'
        : wsState === 'busy' ? 'Busy'
        : wsState === 'unavailable' ? 'Unavailable'
        : 'Free · ready for a job');

    return (
      <PressableRow
        key={member.id}
        style={styles.memberCard}
        onPress={() => router.push(`/more/team-management?memberId=${member.id}` as any)}
      >
        <View style={styles.avatarWrap}>
          <TeamAvatar
            firstName={member.firstName}
            lastName={member.lastName}
            email={member.email}
            userId={String(member.userId)}
            profileImageUrl={member.profileImageUrl}
            themeColor={(member as any).themeColor}
            size={40}
          />
          <View style={[styles.statusDot, { backgroundColor: wsConfig.color, borderColor: colors.card }]} />
        </View>
        <View style={styles.memberBody}>
          <Text style={styles.memberName} numberOfLines={1}>{member.firstName} {member.lastName}</Text>
          <Text style={styles.memberSubtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: `${pillColor}20` }]}>
          <Text style={[styles.statusPillText, { color: pillColor }]}>{pillLabel}</Text>
        </View>
      </PressableRow>
    );
  };

  const renderActivityItem = (item: ActivityFeedItem) => {
    const config = ACTIVITY_CONFIG[item.activityType] || { icon: 'activity' as const, color: colors.mutedForeground, bgColor: colors.muted };
    return (
      <View key={item.id} style={styles.activityCard}>
        <View style={[styles.activityIcon, { backgroundColor: config.bgColor }]}>
          <Feather name={config.icon} size={16} color={config.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.activityTitle} numberOfLines={2}>
            {item.description || (typeof item.activityType === 'string' ? item.activityType.replace(/_/g, ' ') : 'Activity')}
          </Text>
          {item.actorName && <Text style={styles.activitySub} numberOfLines={1}>{item.actorName}</Text>}
          <Text style={styles.activityTime}>{safeDateDistance(item.createdAt)}</Text>
        </View>
      </View>
    );
  };

  const renderLiveOpsTab = () => (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {renderStatBar([
        { value: onlineCount, label: 'Online', color: colors.info || colors.primary },
        { value: onJobCount, label: 'On Job', color: colors.success },
        { value: unassignedJobs.length, label: 'Unassigned', color: colors.warning },
        { value: acceptedMembers.length, label: 'Team', color: colors.foreground },
      ])}

      {unassignedJobs.length > 0 && (
        <PressableRow style={styles.alertBanner} onPress={() => router.push('/more/dispatch-board' as any)}>
          <View style={[styles.alertBannerIcon, { backgroundColor: colors.warning }]}>
            <Feather name="inbox" size={18} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertBannerTitle}>{unassignedJobs.length} jobs need assigning</Text>
            <Text style={styles.alertBannerSub}>Tap to open Dispatch Board</Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.warning} />
        </PressableRow>
      )}

      <Text style={styles.sectionEyebrow}>On Shift</Text>
      {membersWithDetails.length === 0 ? (
        <View style={styles.emptyBox}>
          <Feather name="users" size={iconSizes['2xl']} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No team members yet</Text>
        </View>
      ) : (
        membersWithDetails.map(renderMemberCard)
      )}

      {activityFeed.length > 0 && (
        <>
          <Text style={[styles.sectionEyebrow, { marginTop: spacing.lg }]}>Recent Activity</Text>
          {activityFeed.slice(0, 5).map(renderActivityItem)}
        </>
      )}
    </ScrollView>
  );

  const renderSchedulingTab = () => {
    const dayJobs = jobs.filter(j => {
      if (!j.scheduledAt) return false;
      try { return isSameDay(parseISO(j.scheduledAt), selectedDate); } catch { return false; }
    });
    const unassignedForDay = dayJobs.filter(j => !j.assignedTo);

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekStripRow}>
          {weekDays.map(d => {
            const isSel = isSameDay(d, selectedDate);
            const isTodayDay = isToday(d);
            return (
              <PressableRow
                key={d.toISOString()}
                onPress={() => setSelectedDate(d)}
                style={[
                  styles.dayPill,
                  isSel ? styles.dayPillActive : styles.dayPillInactive,
                ]}
              >
                <Text style={[styles.dayPillDow, { color: isSel ? (colors.primaryForeground || colors.white) : colors.mutedForeground }]}>
                  {format(d, 'EEE').toUpperCase()}
                </Text>
                <Text style={[styles.dayPillNum, { color: isSel ? (colors.primaryForeground || colors.white) : colors.foreground }]}>
                  {format(d, 'd')}
                </Text>
                {isTodayDay && !isSel && <View style={[styles.todayDot, { backgroundColor: colors.primary }]} />}
              </PressableRow>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionEyebrow}>Crew · {format(selectedDate, 'EEE d MMM')}</Text>
        {acceptedMembers.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="users" size={iconSizes['2xl']} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No team members yet</Text>
          </View>
        ) : (
          acceptedMembers.map(member => {
            const memberJobs = dayJobs
              .filter(j => j.assignedTo === member.userId)
              .sort((a, b) => {
                if (!a.scheduledAt || !b.scheduledAt) return 0;
                return parseISO(a.scheduledAt).getTime() - parseISO(b.scheduledAt).getTime();
              });
            return (
              <View key={member.id} style={styles.scheduleMemberRow}>
                <View style={styles.scheduleMemberHeader}>
                  <TeamAvatar
                    firstName={member.firstName}
                    lastName={member.lastName}
                    email={member.email}
                    userId={String(member.userId)}
                    profileImageUrl={member.profileImageUrl}
                    themeColor={(member as any).themeColor}
                    size={32}
                  />
                  <Text style={styles.scheduleMemberName} numberOfLines={1}>{member.firstName} {member.lastName}</Text>
                  <Text style={styles.scheduleMemberCount}>{memberJobs.length} job{memberJobs.length === 1 ? '' : 's'}</Text>
                </View>
                {memberJobs.length === 0 ? (
                  <PressableRow
                    style={styles.assignDashedRow}
                    onPress={() => router.push('/more/dispatch-board' as any)}
                  >
                    <Feather name="plus" size={14} color={colors.primary} />
                    <Text style={[styles.assignDashedText, { color: colors.primary }]}>Tap to assign</Text>
                  </PressableRow>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.jobBlockRow}>
                    {memberJobs.map(j => {
                      const sc = getStatusColor(j.status);
                      return (
                        <PressableRow
                          key={j.id}
                          style={[styles.jobBlock, { backgroundColor: `${sc}18` }]}
                          onPress={() => router.push(`/job/${j.id}` as any)}
                        >
                          <View style={[styles.jobBlockAccent, { backgroundColor: sc }]} />
                          <Text style={[styles.jobBlockTitle, { color: sc }]} numberOfLines={1}>{j.title}</Text>
                          <Text style={styles.jobBlockMeta} numberOfLines={1}>{formatJobTimeRange(j)}</Text>
                          {j.address && (
                            <Text style={styles.jobBlockAddr} numberOfLines={1}>{j.address.split(',')[0]}</Text>
                          )}
                        </PressableRow>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            );
          })
        )}

        {unassignedForDay.length > 0 && (
          <>
            <Text style={[styles.sectionEyebrow, { marginTop: spacing.lg }]}>Unassigned Queue</Text>
            {unassignedForDay.map(j => (
              <View key={j.id} style={styles.queueCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.queueTitle} numberOfLines={1}>{j.title}</Text>
                  <Text style={styles.queueMeta} numberOfLines={1}>
                    {[j.clientName, formatJobTimeRange(j)].filter(Boolean).join(' · ') || 'No details'}
                  </Text>
                </View>
                <PressableRow
                  style={styles.assignDashedBtn}
                  onPress={() => router.push('/more/dispatch-board' as any)}
                >
                  <Text style={[styles.assignDashedBtnText, { color: colors.primary }]}>Assign →</Text>
                </PressableRow>
              </View>
            ))}
          </>
        )}

        {pendingTimeOff.length > 0 && isOwnerOrManager && (
          <>
            <Text style={[styles.sectionEyebrow, { marginTop: spacing.lg }]}>Pending Time Off</Text>
            {pendingTimeOff.map(req => {
              const member = teamMembers.find(m => m.id === req.teamMemberId);
              return (
                <View key={req.id} style={styles.queueCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.queueTitle} numberOfLines={1}>{member?.firstName} {member?.lastName}</Text>
                    <Text style={styles.queueMeta} numberOfLines={1}>
                      {req.startDate?.slice(0, 10)} – {req.endDate?.slice(0, 10)} · {req.reason.replace(/_/g, ' ')}
                    </Text>
                  </View>
                  <PressableRow style={[styles.smallBtn, { backgroundColor: colors.success }]} onPress={() => handleApproveTimeOff(req.id, 'approved')}>
                    <Feather name="check" size={14} color={colors.white} />
                  </PressableRow>
                  <PressableRow style={[styles.smallBtn, { backgroundColor: colors.destructive, marginLeft: spacing.xs }]} onPress={() => handleApproveTimeOff(req.id, 'rejected')}>
                    <Feather name="x" size={14} color={colors.white} />
                  </PressableRow>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    );
  };

  const renderPerformanceTab = () => {
    const periods: { key: PerfPeriod; label: string }[] = [
      { key: 'today', label: 'Today' },
      { key: 'week', label: 'This Week' },
      { key: 'month', label: 'This Month' },
    ];
    const metrics: { value: string | number; label: string; color: string }[] = [
      { value: totalCompleted, label: 'Done', color: colors.success },
      { value: totalInProgress, label: 'Active', color: colors.info || colors.primary },
      { value: `${avgCompletionRate}%`, label: 'Avg Rate', color: colors.foreground },
      { value: unassignedJobs.length, label: 'Open', color: colors.warning },
    ];

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.periodRow}>
          {periods.map(p => {
            const active = perfPeriod === p.key;
            return (
              <PressableRow
                key={p.key}
                style={[styles.periodPill, active ? styles.periodPillActive : styles.periodPillInactive]}
                onPress={() => setPerfPeriod(p.key)}
              >
                <Text style={[styles.periodPillText, { color: active ? (colors.primaryForeground || colors.white) : colors.mutedForeground }]}>{p.label}</Text>
              </PressableRow>
            );
          })}
        </View>

        {renderStatBar(metrics.map(m => ({ value: m.value, label: m.label, color: m.color })))}

        <Text style={[styles.sectionEyebrow, { marginTop: spacing.lg }]}>Individual</Text>
        {memberStats.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="bar-chart-2" size={iconSizes['2xl']} color={colors.mutedForeground} />
            <Text style={styles.emptyText}>No performance data</Text>
          </View>
        ) : (
          memberStats.map(m => {
            const barColor = m.completionRate >= 80 ? colors.success
              : m.completionRate >= 50 ? colors.warning
              : colors.mutedForeground;
            return (
              <View key={m.id} style={styles.perfCard}>
                <View style={styles.perfHeader}>
                  <TeamAvatar
                    firstName={m.firstName}
                    lastName={m.lastName}
                    email={m.email}
                    userId={String(m.userId)}
                    profileImageUrl={m.profileImageUrl}
                    themeColor={(m as any).themeColor}
                    size={36}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.perfName} numberOfLines={1}>{m.firstName} {m.lastName}</Text>
                    {m.roleName ? <Text style={styles.perfRole} numberOfLines={1}>{m.roleName}</Text> : null}
                  </View>
                  <Text style={[styles.perfRate, { color: barColor }]}>
                    {m.totalJobs > 0 ? `${m.completionRate}%` : '0%'}
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: m.totalJobs > 0 ? `${Math.max(m.completionRate, 4)}%` : '0%', backgroundColor: barColor }]} />
                </View>
                <Text style={styles.perfStats}>
                  {m.completedJobs} done · {m.inProgressJobs} active · {m.totalJobs} total
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
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
      <View style={styles.container}>
        <View style={styles.contentShell}>
          {renderHero()}
          {renderTabs()}
        </View>
        <View style={styles.tabContent}>
          {activeTab === 'live' && renderLiveOpsTab()}
          {activeTab === 'scheduling' && renderSchedulingTab()}
          {activeTab === 'performance' && renderPerformanceTab()}
        </View>
      </View>

      {/* Time Off sheet — reachable through pending list actions */}
      <AppBottomSheet
        visible={showTimeOffModal}
        onDismiss={() => setShowTimeOffModal(false)}
        title="Request Time Off"
        showCloseButton
      >
        <View>
            <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.textInput}
              value={timeOffStart}
              onChangeText={setTimeOffStart}
              placeholder="2024-01-01"
              placeholderTextColor={colors.mutedForeground}
            />
            <Text style={styles.inputLabel}>End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.textInput}
              value={timeOffEnd}
              onChangeText={setTimeOffEnd}
              placeholder="2024-01-05"
              placeholderTextColor={colors.mutedForeground}
            />
            <Text style={styles.inputLabel}>Reason</Text>
            <View style={styles.reasonChips}>
              {['annual_leave', 'sick_leave', 'personal', 'other'].map(reason => (
                <PressableRow
                  key={reason}
                  style={[styles.reasonChip, timeOffReason === reason && { backgroundColor: colors.primary }]}
                  onPress={() => setTimeOffReason(reason)}
                >
                  <Text style={[styles.reasonChipText, { color: timeOffReason === reason ? (colors.primaryForeground || colors.white) : colors.foreground }]}>
                    {reason.replace(/_/g, ' ')}
                  </Text>
                </PressableRow>
              ))}
            </View>
            <Text style={styles.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
              value={timeOffNotes}
              onChangeText={setTimeOffNotes}
              placeholder="Additional notes..."
              placeholderTextColor={colors.mutedForeground}
              multiline
            />
            <PressableRow style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={handleRequestTimeOff}>
              <Text style={[styles.submitButtonText, { color: colors.primaryForeground || colors.white }]}>Submit Request</Text>
            </PressableRow>
        </View>
      </AppBottomSheet>

      {/* Assign Job sheet */}
      <AppBottomSheet
        visible={showAssignModal}
        onDismiss={() => { setShowAssignModal(false); setAssigningToMember(null); }}
        title={assigningToMember ? `Assign to ${assigningToMember.firstName ?? ''} ${assigningToMember.lastName ?? ''}`.trim() : 'Assign a Job'}
        showCloseButton
      >
        <View>
            {unassignedJobs.length === 0 ? (
              <View style={styles.emptyBox}>
                <Feather name="check-circle" size={40} color={colors.mutedForeground} />
                <Text style={styles.emptyText}>No unassigned jobs</Text>
              </View>
            ) : (
              unassignedJobs.map((job) => (
                <PressableRow
                  key={job.id}
                  style={styles.assignJobRow}
                  onPress={() => handleAssignJob(job)}
                  disabled={isAssigningJob}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.assignJobTitle} numberOfLines={1}>{job.title}</Text>
                    {job.clientName && <Text style={styles.assignJobMeta} numberOfLines={1}>{job.clientName}</Text>}
                  </View>
                  {isAssigningJob
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  }
                </PressableRow>
              ))
            )}
        </View>
      </AppBottomSheet>
    </>
  );
}

const createStyles = (colors: ThemeColors, contentWidth: number, responsivePadding: number, isTabletDevice: boolean, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentShell: {
    paddingHorizontal: responsivePadding,
    paddingTop: spacing.md,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: responsivePadding,
  },
  heroSection: {
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
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
    marginLeft: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
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

  // Stat bar (single compact card with dividers)
  statBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius['2xl'],
    marginBottom: spacing.md,
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
    ...typography.label,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  statBarDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.cardBorder,
  },

  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: `${colors.warning}12`,
    borderWidth: 1,
    borderColor: `${colors.warning}30`,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  alertBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBannerTitle: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  alertBannerSub: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
  },

  sectionEyebrow: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
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

  // Member cards
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    position: 'relative',
  },
  statusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  memberBody: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  memberSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusPillText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.bold,
  },

  // Activity
  activityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  activitySub: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  activityTime: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
    marginTop: 4,
  },

  // Scheduling
  weekStripRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.md,
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

  scheduleMemberRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.xs,
  },
  scheduleMemberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  scheduleMemberName: {
    flex: 1,
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  scheduleMemberCount: {
    ...typography.label,
    color: colors.mutedForeground,
  },
  jobBlockRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  jobBlock: {
    position: 'relative',
    width: 180,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
    paddingLeft: spacing.sm + 3,
    borderRadius: radius.md,
  },
  jobBlockAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
  },
  jobBlockTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.bold,
  },
  jobBlockMeta: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  jobBlockAddr: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  assignDashedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.cardBorder,
  },
  assignDashedText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
  },

  queueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.sm,
  },
  queueTitle: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  queueMeta: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  assignDashedBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
  },
  assignDashedBtnText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.bold,
  },
  smallBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Performance
  periodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  periodPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  periodPillActive: {
    backgroundColor: colors.primary,
  },
  periodPillInactive: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  periodPillText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
  },

  perfCard: {
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  perfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  perfName: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  perfRole: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  perfRate: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.bold,
  },
  barTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.cardBorder,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  barFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  perfStats: {
    ...typography.caption,
    color: colors.mutedForeground,
  },

  // Modal styles
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  modalSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  inputLabel: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  textInput: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.foreground,
  },
  reasonChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reasonChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  reasonChipText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
    textTransform: 'capitalize',
  },
  submitButton: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.bold,
  },
  assignJobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.sm,
  },
  assignJobTitle: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  assignJobMeta: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});

export default function TeamOperationsScreen() {
  return (
    <OwnerOnlyGuard>
      <TeamOperationsScreenInner />
    </OwnerOnlyGuard>
  );
}
