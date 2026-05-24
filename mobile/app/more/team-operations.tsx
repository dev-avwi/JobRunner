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
  TextInput,
  Linking,
} from 'react-native';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import MapView, { Marker, Region, PROVIDER_DEFAULT, MapStyleElement } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, sizes, iconSizes, usePageShell, pageShell, componentStyles } from '../../src/lib/design-tokens';
import { getAvatarColor } from '../../src/lib/avatar-colors';
import { TeamAvatar } from '../../src/components/TeamAvatar';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { formatDistanceToNow, format, isAfter } from 'date-fns';
import { useIsTablet, useContentWidth } from '../../src/lib/device';
import { useUserRole } from '../../src/hooks/use-user-role';

const DARK_MAP_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    profileImageUrl?: string;
  };
  currentJob?: {
    id: string;
    title: string;
  };
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
type LiveViewMode = 'status' | 'activity' | 'map';

// Cairns-area default to match demo data, but will dynamically center on team members
const DEFAULT_REGION: Region = {
  latitude: -16.9203,
  longitude: 145.7710,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

function getInitials(firstName?: string, lastName?: string, email?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) return firstName[0].toUpperCase();
  if (email) return email[0].toUpperCase();
  return '?';
}

function formatLastSeen(dateStr?: string): string {
  if (!dateStr) return 'Unknown';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Unknown';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  } catch { return 'Unknown'; }
}

function safeDateFormat(dateStr: string | undefined | null, formatStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return format(d, formatStr);
  } catch { return ''; }
}

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

export default function TeamOperationsScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const responsiveShell = usePageShell();
  const contentWidth = useContentWidth();
  const isTabletDevice = useIsTablet();
  const styles = useMemo(() => createStyles(colors, contentWidth, responsiveShell.paddingHorizontal, isTabletDevice), [colors, contentWidth, responsiveShell.paddingHorizontal, isTabletDevice]);
  const { user } = useAuthStore();
  const mapRef = useRef<MapView | null>(null);
  
  // Subscription-aware access control
  const { hasTeamSubscription, hasProSubscription, subscriptionTier } = useUserRole();
  const needsUpgradeBase = false;

  const [activeTab, setActiveTab] = useState<TabType>('live');
  const [liveViewMode, setLiveViewMode] = useState<LiveViewMode>('status');
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

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const isOwnerOrManager = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'manager';

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

  const fetchData = useCallback(async () => {
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedMemberId) {
      fetchAvailability(selectedMemberId);
    }
  }, [selectedMemberId, fetchAvailability]);

  const selectedMemberAvailability = useMemo(() => {
    if (!selectedMemberId) return [];
    return availabilityMap.get(selectedMemberId) || [];
  }, [selectedMemberId, availabilityMap]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setAvailabilityMap(new Map());
    await fetchData();
    if (selectedMemberId) {
      await fetchAvailability(selectedMemberId);
    }
    setRefreshing(false);
  }, [fetchData, fetchAvailability, selectedMemberId]);

  const acceptedMembers = useMemo(() => 
    teamMembers.filter(m => m.inviteStatus === 'accepted'),
    [teamMembers]
  );

  const needsUpgrade = needsUpgradeBase && acceptedMembers.length === 0;

  const membersWithDetails = useMemo(() => {
    return acceptedMembers.map(member => {
      const presence = teamPresence.find(p => p.userId === member.userId);
      const assignedJobs = jobs.filter(j => j.assignedTo === member.userId);
      return { ...member, presence, assignedJobs };
    });
  }, [acceptedMembers, teamPresence, jobs]);

  // Animate map to center on team members when they have locations
  useEffect(() => {
    if (liveViewMode !== 'map') return;
    
    const membersWithLocations = membersWithDetails.filter(
      m => m.presence?.lastLocationLat && m.presence?.lastLocationLng
    );
    
    if (membersWithLocations.length > 0 && mapRef.current) {
      const lats = membersWithLocations.map(m => m.presence!.lastLocationLat!);
      const lngs = membersWithLocations.map(m => m.presence!.lastLocationLng!);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;
      const latDelta = Math.max(0.05, (maxLat - minLat) * 1.5);
      const lngDelta = Math.max(0.05, (maxLng - minLng) * 1.5);
      
      mapRef.current.animateToRegion({
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta: latDelta,
        longitudeDelta: lngDelta,
      }, 500);
    }
  }, [membersWithDetails, liveViewMode]);

  const memberStats = useMemo(() => {
    return acceptedMembers.map(member => {
      const memberJobs = jobs.filter(j => j.assignedTo === member.userId);
      const completedJobs = memberJobs.filter(j => j.status === 'completed');
      const inProgressJobs = memberJobs.filter(j => j.status === 'in_progress');
      const scheduledJobs = memberJobs.filter(j => j.status === 'scheduled');

      return {
        ...member,
        totalJobs: memberJobs.length,
        completedJobs: completedJobs.length,
        inProgressJobs: inProgressJobs.length,
        scheduledJobs: scheduledJobs.length,
        completionRate: memberJobs.length > 0 ? Math.round((completedJobs.length / memberJobs.length) * 100) : 0,
      };
    }).sort((a, b) => b.completedJobs - a.completedJobs);
  }, [acceptedMembers, jobs]);

  const totalCompleted = memberStats.reduce((sum, m) => sum + m.completedJobs, 0);
  const totalInProgress = memberStats.reduce((sum, m) => sum + m.inProgressJobs, 0);
  const avgCompletionRate = memberStats.length > 0
    ? Math.round(memberStats.reduce((sum, m) => sum + m.completionRate, 0) / memberStats.length)
    : 0;

  const pendingTimeOff = (timeOffRequests || []).filter(t => t.status === 'pending');
  const upcomingTimeOff = (timeOffRequests || []).filter(t => {
    try {
      return t.status === 'approved' && t.startDate && isAfter(new Date(t.startDate), new Date());
    } catch { return false; }
  });

  const onlineCount = useMemo(() => {
    return teamPresence.filter(p => p.status === 'online' || p.status === 'on_job').length;
  }, [teamPresence]);

  const onJobCount = useMemo(() => {
    return teamPresence.filter(p => p.status === 'on_job').length;
  }, [teamPresence]);

  const unassignedJobs = useMemo(() => {
    return jobs.filter(j => !j.assignedTo && (j.status === 'pending' || j.status === 'scheduled' || j.status === 'in_progress'));
  }, [jobs]);

  const handleUpdateAvailability = async (dayOfWeek: number, isAvailable: boolean, startTime?: string, endTime?: string) => {
    if (!selectedMemberId) return;
    
    const newAvailabilityItem: TeamMemberAvailability = {
      id: `temp-${dayOfWeek}`,
      teamMemberId: selectedMemberId,
      dayOfWeek,
      isAvailable,
      startTime: startTime || '08:00',
      endTime: endTime || '17:00',
    };
    
    setAvailabilityMap(prev => {
      const newMap = new Map(prev);
      const memberAvailability = [...(newMap.get(selectedMemberId) || [])];
      const existingIndex = memberAvailability.findIndex(a => a.dayOfWeek === dayOfWeek);
      if (existingIndex >= 0) {
        memberAvailability[existingIndex] = newAvailabilityItem;
      } else {
        memberAvailability.push(newAvailabilityItem);
      }
      newMap.set(selectedMemberId, memberAvailability);
      return newMap;
    });
    
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
          const newMap = new Map(prev);
          const memberAvailability = [...(newMap.get(selectedMemberId) || [])];
          const idx = memberAvailability.findIndex(a => a.dayOfWeek === dayOfWeek);
          if (idx >= 0) {
            memberAvailability[idx] = res.data!;
          } else {
            memberAvailability.push(res.data!);
          }
          newMap.set(selectedMemberId, memberAvailability);
          return newMap;
        });
      }
    } catch (error) {
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
        setTimeOffStart('');
        setTimeOffEnd('');
        setTimeOffReason('annual_leave');
        setTimeOffNotes('');
        await fetchData();
        Alert.alert('Success', 'Time off requested');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to request time off');
    }
  };

  const handleApproveTimeOff = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await api.patch<TeamMemberTimeOff>(`/api/team/time-off/${id}`, { status });
      if (res.data && !res.error) {
        await fetchData();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update time off request');
    }
  };

  const tabIconSize = isTabletDevice ? 18 : 16;
  
  const renderTabs = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
      {[
        { key: 'live' as TabType, icon: 'activity' as const, label: 'Live Ops' },
        { key: 'scheduling' as TabType, icon: 'calendar' as const, label: 'Scheduling' },
        { key: 'performance' as TabType, icon: 'trending-up' as const, label: 'Performance' },
      ].map(tab => {
        const isActive = activeTab === tab.key;
        return (
          <PressableRow key={tab.key} style={[styles.tabButton, isActive && styles.tabButtonActive]} onPress={() => setActiveTab(tab.key)} >
            <Feather name={tab.icon} size={tabIconSize} color={isActive ? colors.white : colors.mutedForeground} />
            <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>{tab.label}</Text>
          </PressableRow>
        );
      })}
    </ScrollView>
  );

  const renderLiveViewToggle = () => (
    <View style={styles.liveViewToggle}>
      <PressableRow style={[styles.liveViewButton, liveViewMode === 'status' && styles.liveViewButtonActive]} onPress={() => setLiveViewMode('status')} >
        <Feather name="users" size={14} color={liveViewMode === 'status' ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.liveViewText, liveViewMode === 'status' && styles.liveViewTextActive]}>Status</Text>
      </PressableRow>
      <PressableRow style={[styles.liveViewButton, liveViewMode === 'activity' && styles.liveViewButtonActive]} onPress={() => setLiveViewMode('activity')} >
        <Feather name="clock" size={14} color={liveViewMode === 'activity' ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.liveViewText, liveViewMode === 'activity' && styles.liveViewTextActive]}>Activity</Text>
      </PressableRow>
      <PressableRow style={[styles.liveViewButton, liveViewMode === 'map' && styles.liveViewButtonActive]} onPress={() => setLiveViewMode('map')} >
        <Feather name="map" size={14} color={liveViewMode === 'map' ? colors.primary : colors.mutedForeground} />
        <Text style={[styles.liveViewText, liveViewMode === 'map' && styles.liveViewTextActive]}>Map</Text>
      </PressableRow>
    </View>
  );

  const renderMemberCard = (member: MemberWithDetails) => {
    const ws = workerStates.find((w: any) => w.userId === member.userId);
    const wsState = ws?.state || 'available';
    const wsConfig = STATUS_CONFIG[wsState] || STATUS_CONFIG.available;
    const presenceStatus = member.presence?.status || 'offline';
    const presenceConfig = STATUS_CONFIG[presenceStatus] || STATUS_CONFIG.offline;

    return (
      <PressableRow key={member.id} style={styles.memberCard} onPress={() => router.push(`/more/team-management?memberId=${member.id}`)} >
        <View style={styles.avatarContainer}>
          <TeamAvatar
            firstName={member.firstName}
            lastName={member.lastName}
            email={member.email}
            userId={String(member.userId)}
            profileImageUrl={member.profileImageUrl}
            themeColor={(member as any).themeColor}
            size={40}
          />
          <View style={[styles.statusDot, { backgroundColor: wsConfig.color }]} />
        </View>
        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <Text style={styles.memberName}>{member.firstName} {member.lastName}</Text>
            <View style={[styles.roleBadge, { backgroundColor: `${wsConfig.color}15` }]}>
              <Feather name={wsConfig.icon} size={10} color={wsConfig.color} style={{ marginRight: 3 }} />
              <Text style={[styles.roleBadgeText, { color: wsConfig.color }]}>{wsConfig.label}</Text>
            </View>
            {member.roleName && (
              <View style={[styles.roleBadge, { backgroundColor: `${presenceConfig.color}15`, marginLeft: 4 }]}>
                <Text style={[styles.roleBadgeText, { color: presenceConfig.color }]}>{member.roleName}</Text>
              </View>
            )}
          </View>
          <Text style={styles.memberStatus}>
            {presenceConfig.label} · {formatLastSeen(member.presence?.lastSeenAt)}
          </Text>
        </View>
        <View style={styles.memberCardActions}>
          {isOwnerOrManager && unassignedJobs.length > 0 && (
            <PressableRow style={styles.assignButton} onPress={() => { setAssigningToMember(member); setShowAssignModal(true); }} >
              <Feather name="plus-circle" size={16} color={colors.primary} />
            </PressableRow>
          )}
          <PressableRow style={styles.messageButton} onPress={() => router.push(`/more/direct-messages?userId=${member.userId}`)} >
            <Feather name="message-circle" size={18} color={colors.mutedForeground} />
          </PressableRow>
        </View>
      </PressableRow>
    );
  };

  const getSubbieStatus = (member: MemberWithDetails): { label: string; color: string; icon: keyof typeof Feather.glyphMap } => {
    const hasActiveJob = member.assignedJobs.some(j => j.status === 'in_progress');
    if (hasActiveJob) {
      const activeJob = member.assignedJobs.find(j => j.status === 'in_progress');
      return { label: `On your job: ${activeJob?.title || 'Active'}`, color: '#3b82f6', icon: 'tool' };
    }
    const isOnline = member.presence?.status === 'online' || member.presence?.status === 'on_job';
    if (isOnline) {
      return { label: 'Available', color: '#22c55e', icon: 'check-circle' };
    }
    return { label: 'Unavailable', color: '#6b7280', icon: 'circle' };
  };

  const renderSubbieCard = (member: MemberWithDetails) => {
    const subbieStatus = getSubbieStatus(member);

    return (
      <PressableRow key={member.id} style={styles.memberCard} onPress={() => router.push(`/more/team-management?memberId=${member.id}`)} >
        <View style={styles.avatarContainer}>
          <TeamAvatar
            firstName={member.firstName}
            lastName={member.lastName}
            email={member.email}
            userId={String(member.userId)}
            profileImageUrl={member.profileImageUrl}
            themeColor={(member as any).themeColor}
            size={40}
          />
          <View style={[styles.statusDot, { backgroundColor: subbieStatus.color }]} />
        </View>
        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <Text style={styles.memberName}>{member.firstName} {member.lastName}</Text>
            <View style={[styles.roleBadge, { backgroundColor: '#8B5CF615' }]}>
              <Text style={[styles.roleBadgeText, { color: '#8B5CF6' }]}>Subcontractor</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Feather name={subbieStatus.icon} size={12} color={subbieStatus.color} />
            <Text style={[styles.memberStatus, { color: subbieStatus.color }]} numberOfLines={1}>
              {subbieStatus.label}
            </Text>
          </View>
        </View>
        <View style={styles.memberCardActions}>
          <PressableRow style={styles.messageButton} onPress={() => router.push(`/more/direct-messages?userId=${member.userId}`)} >
            <Feather name="message-circle" size={18} color={colors.mutedForeground} />
          </PressableRow>
        </View>
      </PressableRow>
    );
  };

  const renderActivityItem = (item: ActivityFeedItem) => {
    const config = ACTIVITY_CONFIG[item.activityType] || { icon: 'activity', color: colors.mutedForeground, bgColor: colors.muted };

    return (
      <View key={item.id} style={styles.activityItem}>
        <View style={[styles.activityIcon, { backgroundColor: config.bgColor }]}>
          <Feather name={config.icon} size={16} color={config.color} />
        </View>
        <View style={styles.activityContent}>
          <Text style={styles.activityTitle}>{item.description || (typeof item.activityType === 'string' ? item.activityType.replace(/_/g, ' ') : 'Activity')}</Text>
          {item.actorName && <Text style={styles.activityDescription}>{item.actorName}</Text>}
          <Text style={styles.activityTime}>{safeDateDistance(item.createdAt)}</Text>
        </View>
        {item.isImportant && (
          <View style={styles.importantBadge}>
            <Text style={styles.importantBadgeText}>Important</Text>
          </View>
        )}
      </View>
    );
  };

  const renderLiveOpsTab = () => {
    if (liveViewMode === 'map') {
      const membersWithLocations = membersWithDetails.filter(m => {
        if (!m.presence?.lastLocationLat || !m.presence?.lastLocationLng) return false;
        const rl = (m.roleName || '').toLowerCase();
        const isSub = rl.includes('subcontractor') || rl.includes('sub_contractor');
        if (isSub) {
          return m.assignedJobs.some(j => j.status === 'in_progress');
        }
        return true;
      });
      
      let mapRegion = DEFAULT_REGION;
      if (membersWithLocations.length > 0) {
        const lats = membersWithLocations.map(m => m.presence!.lastLocationLat!);
        const lngs = membersWithLocations.map(m => m.presence!.lastLocationLng!);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
        const latDelta = Math.max(0.05, (maxLat - minLat) * 1.5);
        const lngDelta = Math.max(0.05, (maxLng - minLng) * 1.5);
        mapRegion = {
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        };
      }
      
      return (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            initialRegion={mapRegion}
            region={mapRegion}
            mapType="standard"
            userInterfaceStyle={isDark ? 'dark' : 'light'}
          >
            {membersWithLocations.map(member => {
              const statusConfig = STATUS_CONFIG[member.presence?.status || 'offline'];
              const firstName = member.firstName || '';
              const lastName = member.lastName || '';
              const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '?';
              const rl2 = (member.roleName || '').toLowerCase();
              const isSub = rl2.includes('subcontractor') || rl2.includes('sub_contractor');
              const activeJob = isSub ? member.assignedJobs.find(j => j.status === 'in_progress') : null;
              const shortName = isSub && activeJob
                ? `On job: ${activeJob.title}`
                : (firstName || member.email?.split('@')[0] || 'Team');
              const memberColor = isSub ? '#9B7BDB' : ((member as any).themeColor || getAvatarColor(`${firstName} ${lastName}`).bg);
              
              return (
                <Marker
                  key={member.id}
                  coordinate={{
                    latitude: member.presence!.lastLocationLat!,
                    longitude: member.presence!.lastLocationLng!,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                >
                  <View style={{ alignItems: 'center' }}>
                    <View style={[styles.teamMarkerOuter, { backgroundColor: memberColor }, isSub && { borderColor: '#8B5CF6', borderWidth: 2 }]}>
                      <Text style={styles.teamMarkerText}>{initials}</Text>
                      <View style={[styles.activityDot, { backgroundColor: statusConfig?.color || '#9ca3af' }]} />
                    </View>
                    <View style={styles.nameLabel}>
                      <Text style={styles.nameLabelText} numberOfLines={1}>{shortName}</Text>
                    </View>
                  </View>
                </Marker>
              );
            })}
          </MapView>
          <View style={[styles.mapOverlay, { top: insets.top + spacing.md }]}>
            {renderLiveViewToggle()}
          </View>
          {membersWithLocations.length === 0 && (
            <View style={styles.mapEmptyState}>
              <View style={styles.mapEmptyIcon}>
                <Feather name="map-pin" size={32} color={colors.mutedForeground} />
              </View>
              <Text style={styles.mapEmptyTitle}>No Team Locations</Text>
              <Text style={styles.mapEmptyText}>
                Team members will appear here when they share their location
              </Text>
            </View>
          )}
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statCardIcon, { backgroundColor: `${colors.success}15` }]}>
              <Feather name="circle" size={20} color={colors.success} />
            </View>
            <Text style={styles.statCardValue}>{onlineCount}</Text>
            <Text style={styles.statCardLabel}>Online Now</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statCardIcon, { backgroundColor: `${colors.primary}15` }]}>
              <Feather name="users" size={20} color={colors.primary} />
            </View>
            <Text style={styles.statCardValue}>{acceptedMembers.length}</Text>
            <Text style={styles.statCardLabel}>Team</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statCardIcon, { backgroundColor: `${colors.info || colors.primary}15` }]}>
              <Feather name="tool" size={20} color={colors.info || colors.primary} />
            </View>
            <Text style={styles.statCardValue}>{onJobCount}</Text>
            <Text style={styles.statCardLabel}>On Job</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statCardIcon, { backgroundColor: `${colors.warning}15` }]}>
              <Feather name="briefcase" size={20} color={colors.warning} />
            </View>
            <Text style={styles.statCardValue}>{unassignedJobs.length}</Text>
            <Text style={styles.statCardLabel}>Unassigned</Text>
          </View>
        </View>

        {renderLiveViewToggle()}

        {liveViewMode === 'status' && (() => {
          const isSub = (rn?: string) => { const r = (rn || '').toLowerCase(); return r.includes('subcontractor') || r.includes('sub_contractor'); };
          const employees = membersWithDetails.filter(m => !isSub(m.roleName));
          const subbies = membersWithDetails.filter(m => isSub(m.roleName));
          return (
            <>
              <Text style={styles.sectionTitle}>Your Team ({employees.length})</Text>
              {employees.length > 0 ? employees.map(renderMemberCard) : (
                <View style={{ paddingVertical: spacing.md, alignItems: 'center' }}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>No employees</Text>
                </View>
              )}

              {subbies.length > 0 && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.sm }}>
                    <Text style={styles.sectionTitle}>Your Subbies ({subbies.length})</Text>
                  </View>
                  {subbies.map(renderSubbieCard)}
                </>
              )}
            </>
          );
        })()}

        {liveViewMode === 'activity' && (
          <>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {activityFeed.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Feather name="clock" size={40} color={colors.mutedForeground} />
                </View>
                <Text style={styles.emptyStateTitle}>No Recent Activity</Text>
                <Text style={styles.emptyStateText}>Team activity will appear here as your team works</Text>
              </View>
            ) : (
              activityFeed.slice(0, 20).map(renderActivityItem)
            )}
          </>
        )}
      </ScrollView>
    );
  };


  const renderSchedulingTab = () => (
    <ScrollView
      style={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Weekly Availability</Text>
        </View>

        <View style={styles.selectContainer}>
          <Text style={styles.selectLabel}>Select Team Member</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.memberChips}>
              {acceptedMembers.map(member => (
                <PressableRow key={member.id} style={[styles.memberChip, selectedMemberId === member.id && styles.memberChipActive]} onPress={() => setSelectedMemberId(member.id)} >
                  <Text style={[styles.memberChipText, selectedMemberId === member.id && styles.memberChipTextActive]}>
                    {member.firstName} {member.lastName}
                  </Text>
                </PressableRow>
              ))}
            </View>
          </ScrollView>
        </View>

        {selectedMemberId ? (
          availabilityLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.emptyStateText}>Loading availability...</Text>
            </View>
          ) : (
          <View style={styles.availabilityList}>
            {DAY_NAMES.map((day, index) => {
              const dayAvailability = selectedMemberAvailability.find(a => a.dayOfWeek === index);
              const isAvailable = dayAvailability?.isAvailable ?? (index > 0 && index < 6);
              const startTime = dayAvailability?.startTime || '08:00';
              const endTime = dayAvailability?.endTime || '17:00';

              return (
                <PressableRow key={day} style={styles.availabilityRow} onPress={() => handleUpdateAvailability(index, !isAvailable, startTime, endTime)} >
                  <View style={styles.availabilityLeft}>
                    <View style={[styles.availabilityDot, { backgroundColor: isAvailable ? '#22c55e' : colors.muted }]} />
                    <Text style={[styles.availabilityDay, !isAvailable && { color: colors.mutedForeground }]}>{day}</Text>
                  </View>
                  <Text style={styles.availabilityTime}>
                    {isAvailable ? `${startTime} - ${endTime}` : 'Not available'}
                  </Text>
                </PressableRow>
              );
            })}
          </View>
          )
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Feather name="calendar" size={40} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyStateTitle}>View Availability</Text>
            <Text style={styles.emptyStateText}>Select a team member to view their availability</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Time Off Requests</Text>
          <PressableRow style={styles.addButton} onPress={() => setShowTimeOffModal(true)} >
            <Feather name="plus" size={18} color={colors.primaryForeground} />
          </PressableRow>
        </View>

        {pendingTimeOff.length > 0 ? (
          pendingTimeOff.map(request => {
            const member = teamMembers.find(m => m.id === request.teamMemberId);
            return (
              <View key={request.id} style={styles.timeOffCard}>
                <View style={styles.timeOffHeader}>
                  <Text style={styles.timeOffName}>{member?.firstName} {member?.lastName}</Text>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>Pending</Text>
                  </View>
                </View>
                <Text style={styles.timeOffDates}>
                  {safeDateFormat(request.startDate, 'MMM d')} - {safeDateFormat(request.endDate, 'MMM d, yyyy')}
                </Text>
                <Text style={styles.timeOffReason}>{typeof request.reason === 'string' ? request.reason.replace(/_/g, ' ') : '-'}</Text>
                {isOwnerOrManager && (
                  <View style={styles.timeOffActions}>
                    <PressableRow style={[styles.timeOffButton, { backgroundColor: colors.success }]} onPress={() => handleApproveTimeOff(request.id, 'approved')} >
                      <Text style={styles.timeOffButtonText}>Approve</Text>
                    </PressableRow>
                    <PressableRow style={[styles.timeOffButton, { backgroundColor: colors.destructive }]} onPress={() => handleApproveTimeOff(request.id, 'rejected')} >
                      <Text style={styles.timeOffButtonText}>Reject</Text>
                    </PressableRow>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Feather name="calendar" size={40} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyStateTitle}>No Pending Requests</Text>
            <Text style={styles.emptyStateText}>Time off requests will appear here</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderPerformanceTab = () => (
    <ScrollView
      style={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.sectionTitle}>Team Performance</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.statCardIcon, { backgroundColor: `${colors.success}15` }]}>
            <Feather name="check-circle" size={20} color={colors.success} />
          </View>
          <Text style={styles.statCardValue}>{totalCompleted}</Text>
          <Text style={styles.statCardLabel}>Jobs Completed</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statCardIcon, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name="clock" size={20} color={colors.primary} />
          </View>
          <Text style={styles.statCardValue}>{totalInProgress}</Text>
          <Text style={styles.statCardLabel}>In Progress</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statCardIcon, { backgroundColor: `${colors.success}15` }]}>
            <Feather name="trending-up" size={20} color={colors.success} />
          </View>
          <Text style={styles.statCardValue}>{avgCompletionRate}%</Text>
          <Text style={styles.statCardLabel}>Avg Completion</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statCardIcon, { backgroundColor: `${colors.warning}15` }]}>
            <Feather name="briefcase" size={20} color={colors.warning} />
          </View>
          <Text style={styles.statCardValue}>{unassignedJobs.length}</Text>
          <Text style={styles.statCardLabel}>Unassigned</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Individual Performance</Text>
      {memberStats.map((member, index) => {
        const rankColor = index === 0 ? colors.warning : index === 1 ? colors.mutedForeground : index === 2 ? '#cd7f32' : colors.mutedForeground;
        return (
        <View key={member.id} style={styles.performanceCard}>
          <View style={[styles.performanceRank, index < 3 && { backgroundColor: `${rankColor}20` }]}>
            <Text style={[styles.performanceRankText, index < 3 && { color: rankColor }]}>{index + 1}</Text>
          </View>
          <TeamAvatar
            firstName={member.firstName}
            lastName={member.lastName}
            email={member.email}
            userId={String(member.userId || member.id)}
            profileImageUrl={member.profileImageUrl}
            themeColor={(member as any).themeColor}
            size={36}
          />
          <View style={styles.performanceInfo}>
            <Text style={styles.performanceName}>{member.firstName} {member.lastName}</Text>
            <Text style={styles.performanceStats}>{member.completedJobs} done | {member.inProgressJobs} active | {member.scheduledJobs} upcoming</Text>
          </View>
          <View style={[styles.performanceRate, {
            backgroundColor: member.completionRate >= 75 ? `${colors.success}15` :
              member.completionRate >= 50 ? `${colors.warning}15` : colors.muted,
          }]}>
            <Text style={[styles.performanceRateText, {
              color: member.completionRate >= 75 ? colors.success :
                member.completionRate >= 50 ? colors.warning : colors.foreground,
            }]}>{member.completionRate}%</Text>
          </View>
        </View>
        );
      })}

      {memberStats.length === 0 && (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Feather name="bar-chart-2" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyStateTitle}>No Performance Data</Text>
          <Text style={styles.emptyStateText}>Team performance metrics will appear here</Text>
        </View>
      )}
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.pageHeader}>
          <PressableRow onPress={() => router.back()} style={styles.backButton}>
            <Feather name="chevron-left" size={22} color={colors.foreground} />
          </PressableRow>
          <View style={styles.headerLeft}>
            <Text style={styles.pageTitle}>Team Operations</Text>
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
            {refreshing ? 'Syncing…' : `Updated ${formatRelativeAgo(lastSyncedAt)} · ${acceptedMembers.length} team member${acceptedMembers.length === 1 ? '' : 's'}`}
          </Text>
        </View>
        
        {/* Upgrade banner for non-team subscribers */}
        {needsUpgrade && (
          <PressableRow style={[styles.upgradeBanner, { backgroundColor: colors.primary + '15' }]} onPress={() => router.push('/more/subscription')} >
            <Feather name="star" size={18} color={colors.primary} />
            <View style={styles.upgradeBannerContent}>
              <Text style={[styles.upgradeBannerTitle, { color: colors.foreground }]}>
                Upgrade to Team Plan
              </Text>
              <Text style={[styles.upgradeBannerText, { color: colors.mutedForeground }]}>
                Unlock team management, live tracking, and dispatch features
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.primary} />
          </PressableRow>
        )}
        
        {renderTabs()}
        {activeTab === 'live' && renderLiveOpsTab()}
        {activeTab === 'scheduling' && renderSchedulingTab()}
        {activeTab === 'performance' && renderPerformanceTab()}
      </View>

      <Modal
        visible={showTimeOffModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTimeOffModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Time Off</Text>
            <PressableRow onPress={() => setShowTimeOffModal(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </PressableRow>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Team Member</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              <View style={styles.memberChips}>
                {acceptedMembers.map(member => (
                  <PressableRow key={member.id} style={[styles.memberChip, selectedMemberId === member.id && styles.memberChipActive]} onPress={() => setSelectedMemberId(member.id)} >
                    <Text style={[styles.memberChipText, selectedMemberId === member.id && styles.memberChipTextActive]}>
                      {member.firstName} {member.lastName}
                    </Text>
                  </PressableRow>
                ))}
              </View>
            </ScrollView>

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
                <PressableRow key={reason} style={[styles.reasonChip, timeOffReason === reason && styles.reasonChipActive]} onPress={() => setTimeOffReason(reason)} >
                  <Text style={[styles.reasonChipText, timeOffReason === reason && styles.reasonChipTextActive]}>
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

            <PressableRow style={styles.submitButton} onPress={handleRequestTimeOff} >
              <Text style={styles.submitButtonText}>Submit Request</Text>
            </PressableRow>
          </ScrollView>
        </View>
      </Modal>

      {/* Assign Job Modal */}
      <Modal
        visible={showAssignModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { setShowAssignModal(false); setAssigningToMember(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.assignModalContainer, { paddingBottom: 24 + insets.bottom }]}>
            <View style={styles.assignModalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Assign a Job</Text>
                {assigningToMember && (
                  <Text style={styles.modalSubtitle}>
                    To {assigningToMember.firstName} {assigningToMember.lastName}
                  </Text>
                )}
              </View>
              <PressableRow onPress={() => { setShowAssignModal(false); setAssigningToMember(null); }}>
                <Feather name="x" size={24} color={colors.foreground} />
              </PressableRow>
            </View>
            <ScrollView style={styles.assignJobList} showsVerticalScrollIndicator={false}>
              {unassignedJobs.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="check-circle" size={40} color={colors.mutedForeground} />
                  <Text style={styles.emptyStateTitle}>No Unassigned Jobs</Text>
                  <Text style={styles.emptyStateText}>All current jobs have been assigned.</Text>
                </View>
              ) : (
                unassignedJobs.map((job: JobData) => (
                  <PressableRow key={job.id} style={styles.assignJobRow} onPress={() => handleAssignJob(job)} disabled={isAssigningJob} >
                    <View style={styles.assignJobInfo}>
                      <Text style={styles.assignJobTitle} numberOfLines={1}>{job.title}</Text>
                      {job.clientName && (
                        <Text style={styles.assignJobClient} numberOfLines={1}>{job.clientName}</Text>
                      )}
                      {job.scheduledAt && (
                        <Text style={styles.assignJobDate}>
                          {safeDateFormat(job.scheduledAt, 'EEE d MMM')}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: job.status === 'in_progress' ? '#3b82f620' : '#f59e0b20' }]}>
                      <Text style={[styles.statusBadgeText, { color: job.status === 'in_progress' ? '#3b82f6' : '#f59e0b' }]}>
                        {job.status === 'in_progress' ? 'In Progress' : 'Scheduled'}
                      </Text>
                    </View>
                    {isAssigningJob ? (
                      <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
                    ) : (
                      <Feather name="chevron-right" size={18} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
                    )}
                  </PressableRow>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: ThemeColors, contentWidth: number, responsivePadding: number, isTabletDevice: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: isTabletDevice ? spacing.lg : 0,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: responsivePadding,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  headerLeft: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  pageTitle: {
    ...typography.largeTitle,
    color: colors.foreground,
  },
  headerDatePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
  },
  headerDatePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.foreground,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  syncStampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: responsivePadding,
    paddingBottom: spacing.sm,
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
  // Legacy aliases (kept to avoid touching every reference)
  tabletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: responsivePadding,
    paddingTop: 0,
    paddingBottom: spacing.sm,
  },
  tabletTitle: {
    ...typography.largeTitle,
    color: colors.foreground,
  },
  tabletSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  tabBar: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: spacing.sm,
    paddingHorizontal: isTabletDevice ? spacing.sm : responsivePadding,
  },
  tabBarContent: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
    height: sizes.filterChipHeight,
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabButtonText: {
    ...typography.caption,
    color: colors.mutedForeground,
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: isTabletDevice ? spacing.sm : responsivePadding,
  },
  liveViewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius['2xl'],
    padding: spacing.xs,
    marginVertical: spacing.sm,
  },
  liveViewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
  },
  liveViewButtonActive: {
    backgroundColor: colors.card,
    ...shadows.sm,
  },
  liveViewText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  liveViewTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  heroIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.foreground,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
    marginTop: spacing.xs,
    letterSpacing: 0.3,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.sm,
    ...shadows.sm,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: sizes.avatarMd,
    height: sizes.avatarMd,
    borderRadius: sizes.avatarMd / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.card,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  memberName: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
  },
  roleBadgeText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  memberStatus: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  memberCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assignButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    backgroundColor: `${colors.primary}15`,
  },
  messageButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  assignJobList: {
    maxHeight: 400,
    paddingHorizontal: spacing.md,
  },
  assignJobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  assignJobInfo: {
    flex: 1,
  },
  assignJobTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  assignJobClient: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  assignJobDate: {
    ...typography.caption,
    color: colors.primary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xl,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.md,
    ...shadows.sm,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  activityDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  activityTime: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  importantBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  importantBadgeText: {
    ...typography.captionSmall,
    color: '#f59e0b',
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapOverlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
  },
  mapEmptyState: {
    position: 'absolute',
    top: '40%',
    left: spacing.md,
    right: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    ...shadows.md,
  },
  mapEmptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  mapEmptyTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  mapEmptyText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  teamMarkerOuter: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  teamMarkerText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  activityDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 2.5,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  nameLabel: {
    marginTop: spacing.xs,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.md,
    minWidth: 64,
    alignItems: 'center' as const,
    ...shadows.sm,
  },
  nameLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.foreground,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing['2xl'],
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
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
    marginTop: spacing.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    marginTop: spacing.sm,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  statItem: {
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.statValue,
    color: colors.foreground,
  },
  statLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  actionRow: {
    marginTop: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  actionButtonText: {
    ...typography.cardTitle,
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  selectContainer: {
    marginBottom: spacing.sm,
  },
  selectLabel: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  memberChips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  memberChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
    height: sizes.filterChipHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberChipActive: {
    backgroundColor: colors.primary,
  },
  memberChipText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  memberChipTextActive: {
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  availabilityList: {
    marginTop: spacing.sm,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  availabilityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  availabilityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  availabilityDay: {
    ...typography.body,
    color: colors.foreground,
  },
  availabilityTime: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.xs,
  },
  timeOffCard: {
    padding: spacing.md,
    borderRadius: radius['2xl'],
    backgroundColor: colors.muted,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeOffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  timeOffName: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  pendingBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  pendingBadgeText: {
    ...typography.captionSmall,
    color: '#f59e0b',
    fontWeight: '600',
  },
  timeOffDates: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  timeOffReason: {
    ...typography.caption,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  timeOffActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  timeOffButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    alignItems: 'center',
  },
  timeOffButtonText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    flexBasis: '48%',
    flexGrow: 0,
    flexShrink: 0,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    ...shadows.sm,
  },
  statCardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statCardValue: {
    ...typography.statValue,
    color: colors.foreground,
  },
  statCardLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  performanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.sm,
    ...shadows.sm,
  },
  performanceRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  performanceRankText: {
    ...typography.caption,
    color: colors.mutedForeground,
    fontWeight: '700',
  },
  performanceInfo: {
    flex: 1,
  },
  performanceName: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  performanceStats: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  performanceRate: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
  },
  performanceRateText: {
    ...typography.caption,
    color: colors.foreground,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  assignModalContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    maxHeight: '70%',
  },
  assignModalHandle: {
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
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.sectionTitle,
    color: colors.foreground,
  },
  modalContent: {
    padding: spacing.md,
  },
  inputLabel: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.muted,
    borderRadius: radius.xl,
    padding: spacing.md,
    color: colors.foreground,
    ...typography.body,
    height: sizes.inputHeight,
  },
  reasonChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reasonChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
  },
  reasonChipActive: {
    backgroundColor: colors.primary,
  },
  reasonChipText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  reasonChipTextActive: {
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius['2xl'],
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitButtonText: {
    ...typography.button,
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  kpiStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  kpiStatItem: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  kpiStatIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  kpiStatValue: {
    ...typography.statValue,
    color: colors.foreground,
  },
  kpiStatLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginHorizontal: isTabletDevice ? spacing.sm : responsivePadding,
    marginVertical: spacing.xs,
    borderRadius: radius['2xl'],
    gap: spacing.sm,
  },
  upgradeBannerContent: {
    flex: 1,
  },
  upgradeBannerTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  upgradeBannerText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
});
