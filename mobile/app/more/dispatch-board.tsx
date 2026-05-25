import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { PressableRow } from '../../src/components/ui/PressableRow';
let MapView: any;
let Marker: any;
type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
}
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography, shadows, usePageShell, iconSizes, sizes } from '../../src/lib/design-tokens';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { useIsTablet, useContentWidth } from '../../src/lib/device';
import { format, isToday, parseISO, isBefore, startOfDay, isSameDay } from 'date-fns';
import { TeamAvatar } from '../../src/components/TeamAvatar';

type ViewMode = 'schedule' | 'kanban' | 'map';

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

export default function DispatchBoardScreen() {
  const { colors, isDark } = useTheme();
  const responsiveShell = usePageShell();
  const contentWidth = useContentWidth();
  const isTabletDevice = useIsTablet();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, contentWidth, responsiveShell.paddingHorizontal, isTabletDevice, isDark), [colors, contentWidth, responsiveShell.paddingHorizontal, isTabletDevice, isDark]);
  const [viewMode, setViewMode] = useState<ViewMode>('schedule');
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
  const mapRef = useRef<any>(null);

  const safeFmt = (iso: string | null | undefined, pattern: string) => {
    if (!iso) return '';
    try {
      return format(parseISO(iso), pattern);
    } catch {
      return '';
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const [membersRes, jobsRes, presenceRes] = await Promise.all([
        api.get<TeamMember[]>('/api/team/members'),
        api.get<JobData[]>('/api/jobs'),
        api.get<TeamPresence[]>('/api/team/presence'),
      ]);
      if (membersRes.data) setTeamMembers(membersRes.data.filter(m => m.inviteStatus === 'accepted'));
      if (jobsRes.data) setJobs(jobsRes.data);
      if (presenceRes.data) setPresence(presenceRes.data);
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

  const activeJobs = useMemo(() =>
    jobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled' && j.status !== 'done'),
    [jobs]
  );

  const todayJobs = useMemo(() =>
    jobs.filter(j => {
      if (!j.scheduledAt) return false;
      try { return isToday(parseISO(j.scheduledAt)); } catch { return false; }
    }),
    [jobs]
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

    let conflicts = 0;
    for (let i = 0; i < slots.length; i++) {
      for (let k = i + 1; k < slots.length; k++) {
        if (slots[i].userId === slots[k].userId &&
            slots[i].start < slots[k].end && slots[k].start < slots[i].end) {
          conflicts++;
        }
      }
    }

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

  const scheduleJobs = useMemo(() => {
    const list = jobs.filter(j => {
      if (!j.scheduledAt) return false;
      try { return isSameDay(parseISO(j.scheduledAt), selectedDate); } catch { return false; }
    });
    list.sort((a, b) => {
      const at = a.scheduledAt ? parseISO(a.scheduledAt).getTime() : 0;
      const bt = b.scheduledAt ? parseISO(b.scheduledAt).getTime() : 0;
      return at - bt;
    });
    return list;
  }, [jobs, selectedDate]);

  const kanbanData = useMemo(() => {
    const unassigned = activeJobs.filter(j => !j.assignedTo);
    const inProgress = activeJobs.filter(j => j.status === 'in_progress' || j.status === 'working');
    const inProgressIds = new Set(inProgress.map(j => j.id));
    const assigned = activeJobs.filter(j => j.assignedTo && !inProgressIds.has(j.id));
    const completed = jobs.filter(j => j.status === 'completed' || j.status === 'done').slice(0, 20);
    return { unassigned, assigned, in_progress: inProgress, completed };
  }, [activeJobs, jobs]);

  const geocodedJobs = useMemo((): GeocodedJob[] => {
    return activeJobs
      .filter(j => {
        const lat = j.latitude != null ? Number(j.latitude) : NaN;
        const lng = j.longitude != null ? Number(j.longitude) : NaN;
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
      })
      .map(j => ({ job: j, lat: Number(j.latitude), lng: Number(j.longitude) }));
  }, [activeJobs]);

  const mapRegion = useMemo((): Region => {
    const points = geocodedJobs.map(g => ({ lat: g.lat, lng: g.lng }));
    if (points.length === 0) {
      return { latitude: -16.9186, longitude: 145.7781, latitudeDelta: 0.15, longitudeDelta: 0.15 };
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
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.4, 0.02),
      longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.02),
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
      Alert.alert('Assigned', `Job assigned to ${member ? getMemberName(member) : 'team member'}`);
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

  const openAssignModal = (job: JobData) => {
    setAssigningJob(job);
    setShowAssignModal(true);
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try { return format(parseISO(dateStr), 'h:mm a'); } catch { return ''; }
  };

  const getStatusColor = (status: string, scheduledAt?: string): string => {
    if (scheduledAt) {
      try {
        if (isBefore(parseISO(scheduledAt), startOfDay(new Date())) && status !== 'completed' && status !== 'done') {
          return colors.warning;
        }
      } catch { /* ignore */ }
    }
    switch (status) {
      case 'in_progress': case 'working': return colors.success;
      case 'completed': case 'done': return colors.mutedForeground;
      case 'en_route': case 'on_my_way': return colors.info || colors.primary;
      case 'pending': return colors.warning;
      case 'scheduled': case 'assigned': default: return colors.info || colors.primary;
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

  // -- RENDER PARTS --

  const renderHero = () => (
    <View style={styles.heroSection}>
      <Text style={styles.pageTitle}>Dispatch Board</Text>
      <Text style={styles.pageSubtitle}>Manage job assignments and scheduling</Text>
      <View style={styles.subtitleRow}>
        <View style={[styles.syncDot, { backgroundColor: refreshing ? colors.warning : colors.success }]} />
        <Text style={styles.pageSubtitle}>{refreshing ? ' Syncing…' : ` Updated ${formatRelativeAgo(lastSyncedAt)}`}</Text>
      </View>
    </View>
  );

  const renderTabs = () => {
    const tabs: { key: ViewMode; icon: keyof typeof Feather.glyphMap; label: string }[] = [
      { key: 'schedule', icon: 'list', label: 'Schedule' },
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
              <Feather name={t.icon} size={iconSizes.sm} color={active ? (colors.primaryForeground || colors.white) : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: active ? (colors.primaryForeground || colors.white) : colors.mutedForeground }]}>{t.label}</Text>
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

  const renderJobCard = (job: JobData) => {
    const sc = getStatusColor(job.status, job.scheduledAt);
    const assigned = job.assignedTo ? teamMembers.find(m => m.userId === job.assignedTo) : null;
    return (
      <PressableRow
        key={job.id}
        style={styles.jobCard}
        onPress={() => router.push(`/job/${job.id}` as any)}
      >
        <View style={[styles.cardAccentXL, { backgroundColor: sc }]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.jobCardTitle} numberOfLines={1}>{job.title}</Text>
          {job.scheduledAt && (
            <View style={styles.jobCardRow}>
              <Feather name="clock" size={12} color={colors.mutedForeground} />
              <Text style={styles.jobCardMeta} numberOfLines={1}>{formatTime(job.scheduledAt)}</Text>
              <Feather name="chevron-right" size={12} color={colors.mutedForeground} />
            </View>
          )}
          {job.address && (
            <View style={styles.jobCardRow}>
              <Feather name="map-pin" size={12} color={colors.mutedForeground} />
              <Text style={styles.jobCardMeta} numberOfLines={1}>{job.address.split(',')[0]}</Text>
            </View>
          )}
          <View style={styles.jobCardFooter}>
            {assigned ? (
              <PressableRow
                style={styles.assignedMini}
                onPress={() => openAssignModal(job)}
              >
                <TeamAvatar
                  firstName={assigned.firstName}
                  lastName={assigned.lastName}
                  userId={String(assigned.userId)}
                  themeColor={(assigned as any).themeColor}
                  size={20}
                />
                <Text style={styles.assignedMiniName} numberOfLines={1}>{getMemberName(assigned).split(' ')[0]}</Text>
              </PressableRow>
            ) : (
              <PressableRow
                style={[styles.assignDashedBtn, { borderColor: colors.primary }]}
                onPress={() => openAssignModal(job)}
              >
                <Feather name="user-plus" size={12} color={colors.primary} />
                <Text style={[styles.assignDashedBtnText, { color: colors.primary }]}>Assign</Text>
              </PressableRow>
            )}
            {assigned && (
              <PressableRow
                style={styles.assignSolidBtn}
                onPress={() => openAssignModal(job)}
              >
                <Text style={[styles.assignSolidBtnText, { color: colors.primary }]}>Reassign</Text>
              </PressableRow>
            )}
          </View>
        </View>
      </PressableRow>
    );
  };

  const renderScheduleView = () => (
    <View>
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

      <View style={styles.scheduleHeaderRow}>
        <Text style={styles.scheduleHeaderTitle}>{format(selectedDate, 'EEEE, d MMM')}</Text>
        <Text style={styles.scheduleHeaderCount}>{scheduleJobs.length} job{scheduleJobs.length === 1 ? '' : 's'}</Text>
      </View>

      {scheduleJobs.length === 0 ? (
        <View style={styles.emptyBox}>
          <Feather name="calendar" size={iconSizes['2xl']} color={colors.mutedForeground} />
          <Text style={styles.emptyText}>No jobs scheduled for this day</Text>
        </View>
      ) : (
        scheduleJobs.map(renderJobCard)
      )}
    </View>
  );

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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.kanbanScrollContent}
      >
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
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={mapRegion}
          showsUserLocation
        >
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

    // Nearby workers via haversine, requires job lat/lng & worker presence locations
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
      <Modal
        visible
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedMapJob(null)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{job.title}</Text>
            <PressableRow onPress={() => setSelectedMapJob(null)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </PressableRow>
          </View>
          <ScrollView style={styles.modalContent}>
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
              <Feather name="eye" size={16} color={colors.primaryForeground || colors.white} />
              <Text style={[styles.sheetPrimaryBtnText, { color: colors.primaryForeground || colors.white }]}>View Job</Text>
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
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const renderAssignModal = () => (
    <Modal
      visible={showAssignModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => { setShowAssignModal(false); setAssigningJob(null); }}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{assigningJob?.assignedTo ? 'Reassign Job' : 'Assign Job'}</Text>
          <PressableRow onPress={() => { setShowAssignModal(false); setAssigningJob(null); }}>
            <Feather name="x" size={24} color={colors.foreground} />
          </PressableRow>
        </View>
        <ScrollView style={styles.modalContent}>
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
                <Feather name="user-x" size={16} color={colors.destructiveForeground || colors.white} />
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
        </ScrollView>
      </View>
    </Modal>
  );

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
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomNavHeight + spacing['2xl'] }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {renderHero()}
          {renderTabs()}
          {renderOpsHealth()}
          {viewMode === 'schedule' && renderScheduleView()}
          {viewMode === 'kanban' && renderKanbanView()}
          {viewMode === 'map' && renderMapView()}
        </ScrollView>
        {renderAssignModal()}
        {renderMapSheet()}
      </View>
    </>
  );
}

const createStyles = (colors: ThemeColors, contentWidth: number, responsivePadding: number, isTabletDevice: boolean, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: responsivePadding,
    paddingTop: spacing.md,
  },
  heroSection: {
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
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
    fontWeight: '600',
  },

  // Ops Health stat bar
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
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statBarLabel: {
    fontSize: 12,
    fontWeight: '600',
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
    fontSize: 12,
    fontWeight: '700',
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

  // Schedule
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
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dayPillNum: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  todayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  scheduleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  scheduleHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  scheduleHeaderCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
  },
  // Inner left accent strips (avoid borderLeftWidth on rounded cards)
  cardAccentXL: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
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

  // Job card
  jobCard: {
    position: 'relative',
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    paddingLeft: spacing.md + 3,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  jobCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  jobCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  jobCardMeta: {
    ...typography.caption,
    color: colors.mutedForeground,
    flexShrink: 1,
  },
  jobCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  assignedMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
  },
  assignedMiniName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.foreground,
  },
  assignDashedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  assignDashedBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  assignSolidBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
  },
  assignSolidBtnText: {
    fontSize: 12,
    fontWeight: '700',
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
    fontWeight: '700',
  },
  kanbanCountBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    minWidth: 24,
    alignItems: 'center',
  },
  kanbanCountText: {
    fontSize: 11,
    fontWeight: '700',
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
  kanbanMiniTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.foreground,
  },
  kanbanMiniTime: {
    fontSize: 11,
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
    fontSize: 11,
    fontWeight: '600',
    color: colors.foreground,
  },

  // Map
  mapCard: {
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },

  // Modal / sheet
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
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    flex: 1,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },

  statusPillSheet: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  statusPillSheetText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sheetMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sheetMetaText: {
    fontSize: 13,
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
    fontSize: 12,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  nearbyKm: {
    fontSize: 11,
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
    fontSize: 15,
    fontWeight: '700',
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
    fontSize: 15,
    fontWeight: '600',
  },

  // Assign modal pieces
  assignJobInfo: {
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.md,
  },
  assignJobInfoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  assignJobInfoMeta: {
    fontSize: 12,
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
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  assignMemberRole: {
    fontSize: 12,
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
