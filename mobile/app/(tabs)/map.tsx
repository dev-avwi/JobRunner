import { useEffect, useState, useCallback, useMemo, useRef, Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Dimensions,
  Modal,
  Linking,
  ScrollView,
  Animated,
} from 'react-native';
import { Alert } from '@/lib/alert';
import MapView, { Marker, Callout, Polyline, PROVIDER_GOOGLE, Region, MapStyleElement, Camera } from 'react-native-maps';

// Error boundary to catch map-related crashes
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

class MapErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[MapScreen] Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../src/lib/store';
import { useLocationStore } from '../../src/lib/location-store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserRole } from '../../src/hooks/use-user-role';
import { api, API_URL } from '../../src/lib/api';
import { statusColors, spacing, radius, shadows, typography, fontWeights } from '../../src/lib/design-tokens';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { TeamAvatar } from '../../src/components/TeamAvatar';

// Real-time polling interval for team locations (10 seconds)
const LOCATION_POLL_INTERVAL = 10000;

// Movement threshold in meters - only update marker if moved more than this
const MOVEMENT_THRESHOLD_METERS = 5;

// Haversine formula to calculate distance between two coordinates in meters
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const DARK_MAP_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#64779e' }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#334e87' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#023e58' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
  { featureType: 'poi', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#3C7680' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#b0d5ce' }] },
  { featureType: 'road.highway', elementType: 'labels.text.stroke', stylers: [{ color: '#023e58' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'transit', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'transit.line', elementType: 'geometry.fill', stylers: [{ color: '#283d6a' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#3a4762' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  done: 'Done',
  invoiced: 'Invoiced',
};

interface JobWithLocation {
  id: string;
  title: string;
  status: string;
  address?: string;
  clientId?: string;
  clientName?: string;
  latitude?: number;
  longitude?: number;
  assignedTo?: string;
}

interface TeamMember {
  id: string;
  userId: string;
  role: string;
  themeColor?: string | null;
  user?: {
    firstName: string;
    lastName: string;
  };
  lastLocation?: {
    latitude: number;
    longitude: number;
    timestamp: string;
    speed?: number;
    battery?: number;
  };
  activityStatus?: 'online' | 'driving' | 'working' | 'offline' | 'busy' | 'unavailable';
  isSubcontractor?: boolean;
  activeJobName?: string;
}

type StatusFilter = 'all' | 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

interface GeofenceAlert {
  id: string;
  userId: string;
  jobId: string;
  userName: string;
  userAvatar?: string | null;
  jobTitle: string;
  alertType: 'arrival' | 'departure' | 'late' | 'speed_warning';
  dwellSeconds?: number | null;
  address?: string | null;
  createdAt: string;
  isRead: boolean;
}

const DEFAULT_REGION: Region = {
  latitude: -16.9186,
  longitude: 145.7781,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

const createStyles = (colors: ThemeColors) => {
  const ACTIVITY_CONFIG: Record<string, { label: string; color: string; icon: keyof typeof Feather.glyphMap }> = {
    on_job: { label: 'On Job', color: colors.success, icon: 'briefcase' },
    working: { label: 'Working', color: colors.primary, icon: 'tool' },
    driving: { label: 'Driving', color: colors.info, icon: 'truck' },
    online: { label: 'Online', color: colors.success, icon: 'check-circle' },
    busy: { label: 'Busy', color: colors.warning, icon: 'clock' },
    unavailable: { label: 'Unavailable', color: colors.mutedForeground, icon: 'x-circle' },
    idle: { label: 'Idle', color: colors.warning, icon: 'clock' },
    offline: { label: 'Offline', color: colors.mutedForeground, icon: 'moon' },
  };
  
  return {
    activityConfig: ACTIVITY_CONFIG,
    styles: StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: colors.background,
      },
      map: {
        ...StyleSheet.absoluteFillObject,
      },
      headerCard: {
        position: 'absolute',
        left: spacing.md,
        right: spacing.md,
        backgroundColor: colors.card,
        borderRadius: radius['2xl'],
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.lg,
        zIndex: 30,
      },
      headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
      },
      headerIconContainer: {
        width: 40,
        height: 40,
        borderRadius: radius.lg,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
      },
      headerContent: {
        flex: 1,
        marginLeft: spacing.md,
      },
      headerTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: fontWeights.semibold,
        color: colors.foreground,
      },
      headerSubtitle: {
        fontSize: typography.sizes.sm,
        color: colors.mutedForeground,
        marginTop: 2,
      },
      headerButton: {
        width: 36,
        height: 36,
        borderRadius: radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: spacing.sm,
        backgroundColor: colors.muted,
      },
      controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.md,
        gap: spacing.sm,
        flexWrap: 'wrap',
      },
      filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.muted,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.xs,
      },
      filterButtonText: {
        fontSize: typography.sizes.sm,
        fontWeight: fontWeights.medium,
        color: colors.foreground,
      },
      toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        gap: spacing.xs,
        borderWidth: 1,
        borderColor: colors.border,
      },
      toggleButtonActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
      },
      toggleButtonInactive: {
        backgroundColor: colors.muted,
      },
      toggleButtonText: {
        fontSize: typography.sizes.sm,
        fontWeight: fontWeights.medium,
        color: colors.foreground,
      },
      toggleButtonTextActive: {
        color: colors.primaryForeground,
      },
      legendButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginLeft: 'auto',
      },
      legendButtonText: {
        fontSize: typography.sizes.sm,
        color: colors.mutedForeground,
      },
      filterDropdown: {
        marginTop: spacing.sm,
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
      },
      filterOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        gap: spacing.sm,
      },
      filterOptionActive: {
        backgroundColor: colors.primaryLight,
      },
      filterDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
      },
      filterOptionText: {
        flex: 1,
        fontSize: typography.button.fontSize,
        color: colors.foreground,
      },
      filterOptionTextActive: {
        fontWeight: fontWeights.semibold,
        color: colors.primary,
      },
      legendCard: {
        position: 'absolute',
        right: spacing.md,
        backgroundColor: colors.card,
        borderRadius: radius['2xl'],
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.lg,
        minWidth: 130,
        zIndex: 25,
      },
      legendTitle: {
        fontSize: typography.captionSmall.fontSize,
        fontWeight: fontWeights.semibold,
        color: colors.mutedForeground,
        marginBottom: spacing.sm,
      },
      legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.xs,
      },
      legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
      },
      legendLabel: {
        fontSize: typography.sizes.sm,
        color: colors.foreground,
      },
      markerContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.card,
        ...shadows.md,
      },
      teamMarker: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        ...shadows.md,
      },
      // Life360-style team marker - compact bubble with subtle shadow
      teamMarkerOuter: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2.5,
        borderColor: colors.card,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
      },
      teamMarkerSelected: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 3,
        borderColor: colors.card,
      },
      // Life360-style activity indicator - small dot at bottom right
      activityDot: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 11,
        height: 11,
        borderRadius: 5.5,
        borderWidth: 2,
        borderColor: colors.card,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 1,
        elevation: 2,
      },
      teamMarkerText: {
        fontSize: typography.sizes.sm,
        fontWeight: fontWeights.bold,
        color: colors.white,
        textShadowColor: 'rgba(0,0,0,0.15)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1,
      },
      callout: {
        backgroundColor: colors.card,
        borderRadius: radius.md,
        padding: spacing.md,
        minWidth: 160,
        maxWidth: 220,
        ...shadows.lg,
      },
      calloutTitle: {
        fontSize: typography.button.fontSize,
        fontWeight: fontWeights.semibold,
        color: colors.foreground,
        marginBottom: spacing.xs,
      },
      calloutSubtitle: {
        fontSize: typography.captionSmall.fontSize,
        color: colors.mutedForeground,
        marginBottom: spacing.sm,
      },
      calloutBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: radius.xs,
        marginBottom: spacing.xs,
      },
      calloutBadgeText: {
        fontSize: typography.sizes.xs,
        fontWeight: fontWeights.semibold,
        color: colors.white,
      },
      calloutHint: {
        fontSize: typography.sizes.xs,
        color: colors.mutedForeground,
        fontStyle: 'italic',
        marginTop: spacing.xs,
      },
      calloutDetail: {
        fontSize: typography.sizes.xs,
        color: colors.mutedForeground,
        marginTop: 2,
      },
      activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.xs,
      },
      batteryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: 2,
      },
      fabContainer: {
        position: 'absolute',
        right: spacing.lg,
        gap: spacing.md,
        zIndex: 20,
      },
      fabPrimary: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.lg,
      },
      fabSecondary: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.md,
        borderWidth: 1,
        borderColor: colors.border,
      },
      loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
      },
      assignModeBanner: {
        position: 'absolute',
        left: spacing.md,
        right: spacing.md,
        backgroundColor: colors.primary,
        borderRadius: radius.xl,
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...shadows.lg,
        zIndex: 25,
      },
      assignModeBannerText: {
        color: colors.primaryForeground,
        fontSize: typography.button.fontSize,
        fontWeight: fontWeights.semibold,
        flex: 1,
      },
      assignModeBannerSubtext: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: typography.captionSmall.fontSize,
        marginTop: 2,
      },
      cancelButton: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: spacing.md + 2,
        paddingVertical: spacing.sm + 2,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
      },
      cancelButtonText: {
        color: colors.primaryForeground,
        fontWeight: fontWeights.semibold,
        fontSize: typography.button.fontSize,
      },
      modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
      },
      modalContent: {
        backgroundColor: colors.card,
        borderRadius: radius['2xl'],
        padding: spacing.xl,
        width: '100%',
        maxWidth: 340,
        ...shadows.xl,
      },
      modalTitle: {
        fontSize: typography.sizes.lg,
        fontWeight: fontWeights.bold,
        color: colors.foreground,
        textAlign: 'center',
        marginBottom: spacing.md,
      },
      modalText: {
        fontSize: typography.button.fontSize,
        color: colors.mutedForeground,
        textAlign: 'center',
        marginBottom: spacing.lg,
        lineHeight: 20,
      },
      modalHighlight: {
        color: colors.foreground,
        fontWeight: fontWeights.semibold,
      },
      modalButtons: {
        flexDirection: 'row',
        gap: spacing.md,
      },
      modalButton: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
      },
      modalButtonCancel: {
        backgroundColor: colors.muted,
      },
      modalButtonConfirm: {
        backgroundColor: colors.primary,
      },
      modalButtonText: {
        fontSize: typography.sizes.md,
        fontWeight: fontWeights.semibold,
      },
      modalButtonTextCancel: {
        color: colors.foreground,
      },
      modalButtonTextConfirm: {
        color: colors.primaryForeground,
      },
      // Life360-style name label - compact pill below marker
      nameLabel: {
        position: 'absolute',
        bottom: -18,
        left: '50%',
        transform: [{ translateX: -32 }],
        backgroundColor: colors.card,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 8,
        minWidth: 64,
        alignItems: 'center',
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1.5,
        elevation: 2,
      },
      nameLabelText: {
        fontSize: typography.sizes.xs,
        fontWeight: fontWeights.semibold,
        color: colors.foreground,
        textAlign: 'center',
      },
    }),
  };
};

export default function MapScreen() {
  const { colors, isDark } = useTheme();
  const { styles, activityConfig } = useMemo(() => createStyles(colors), [colors]);
  const confirm = useConfirmDialog();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  // One-tap "share my location with the team" lives right on the map so workers
  // and subbies don't have to dig into App Settings to be seen on the team map.
  const locShareEnabled = useLocationStore((s) => s.isEnabled);
  const locShareStatus = useLocationStore((s) => s.status);
  const enableLocationSharing = useLocationStore((s) => s.enableTracking);
  const disableLocationSharing = useLocationStore((s) => s.disableTracking);
  const [locShareBusy, setLocShareBusy] = useState(false);

  const handleToggleLocationShare = async () => {
    if (locShareBusy) return;
    setLocShareBusy(true);
    try {
      if (locShareEnabled) {
        await disableLocationSharing();
      } else {
        const ok = await enableLocationSharing();
        if (!ok) {
          Alert.alert(
            'Location sharing',
            useLocationStore.getState().errorMessage ||
              'Could not start location sharing. Check location permissions in Settings.',
          );
        }
      }
    } finally {
      setLocShareBusy(false);
    }
  };
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  
  const { user } = useAuthStore();
  const { isStaff, isSubcontractor, teamMemberId, canAccessMap, isLoading: roleLoading, isSolo, isOwner, isManager } = useUserRole();
  
  const isAuthenticated = !!user;
  const hasMapAccess = isAuthenticated;
  const showTeamToggle = isAuthenticated && !isSubcontractor && (isOwner || isManager || canAccessMap);
  const canViewTeamMode = isAuthenticated && !isSubcontractor && (isOwner || isManager || canAccessMap);
  const canAssignJobs = !isSubcontractor && (isOwner || isManager);
  // Mirrors the server VIEW_ALL gate: only owners/managers/solo see every job.
  // Staff tradies and subcontractors are restricted to their assigned jobs.
  const canViewAllJobs = isOwner || isManager || isSolo;
  
  // Map jobs state - uses /api/map/jobs which geocodes addresses
  const [mapJobs, setMapJobs] = useState<JobWithLocation[]>([]);
  const [mapJobsLoading, setMapJobsLoading] = useState(false);
  
  // Filter states - both can be active simultaneously
  const [showJobs, setShowJobs] = useState(true);
  const [showTeamMembers, setShowTeamMembers] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showLegend, setShowLegend] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamMarkersReady, setTeamMarkersReady] = useState(false);
  // Android: custom-view markers must have tracksViewChanges=true while the view
  // lays out, otherwise the marker never paints (Android react-native-maps bug).
  // We keep it on briefly after data/selection changes, then turn it off for perf.
  const [trackTeamChanges, setTrackTeamChanges] = useState(true);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  
  // Tap-to-assign state
  const [selectedWorker, setSelectedWorker] = useState<TeamMember | null>(null);
  const [pendingAssignment, setPendingAssignment] = useState<{ worker: TeamMember; job: JobWithLocation } | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  
  // Job action sheet and route planning state
  const [selectedJob, setSelectedJob] = useState<JobWithLocation | null>(null);
  const [showJobActionSheet, setShowJobActionSheet] = useState(false);
  const [routeJobs, setRouteJobs] = useState<JobWithLocation[]>([]);
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  // Real road geometry (OSRM) for the planned route; null = fall back to straight lines
  const [routeGeometry, setRouteGeometry] = useState<{
    coordinates: { latitude: number; longitude: number }[];
    legs: { durationMinutes: number; distanceKm: number }[];
  } | null>(null);
  // Straight-line coords between stops, used as a fallback when OSRM geometry is unavailable
  const routeStraightCoords = useMemo(
    () =>
      routeJobs
        .filter((j) => j.latitude != null && j.longitude != null)
        .map((j) => ({ latitude: j.latitude as number, longitude: j.longitude as number })),
    [routeJobs]
  );
  // Total drive time/distance across all legs (shown in the route panel header)
  const routeTotals = useMemo(() => {
    if (!routeGeometry?.legs?.length) return null;
    const minutes = routeGeometry.legs.reduce((s, l) => s + (l.durationMinutes || 0), 0);
    const km = routeGeometry.legs.reduce((s, l) => s + (l.distanceKm || 0), 0);
    return { minutes, km };
  }, [routeGeometry]);

  // Fetch real road geometry (OSRM) whenever the planned route changes.
  // Falls back to straight lines (routeGeometry stays null) when unavailable.
  useEffect(() => {
    const stops = routeJobs
      .filter((j) => j.latitude != null && j.longitude != null)
      .map((j) => ({ lat: j.latitude as number, lng: j.longitude as number }));

    if (stops.length < 2) {
      setRouteGeometry(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await api.post('/api/routes/geometry', { stops });
        if (cancelled) return;
        const data = res.data as {
          coordinates?: [number, number][];
          legs?: { durationMinutes: number; distanceKm: number }[];
        } | undefined;
        if (!res.error && data?.coordinates && data.coordinates.length >= 2) {
          setRouteGeometry({
            coordinates: data.coordinates.map((c) => ({ latitude: c[0], longitude: c[1] })),
            legs: Array.isArray(data.legs) ? data.legs : [],
          });
        } else {
          setRouteGeometry(null);
        }
      } catch {
        if (!cancelled) setRouteGeometry(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [routeJobs]);
  
  // Geofence alerts state
  const [geofenceAlerts, setGeofenceAlerts] = useState<GeofenceAlert[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  
  // Real-time location tracking state
  const [isLive, setIsLive] = useState(true);
  const [lastLocationUpdate, setLastLocationUpdate] = useState<Date | null>(null);
  const locationPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Map ready state - prevents rendering markers until MapView is ready
  const [isMapReady, setIsMapReady] = useState(false);
  
  // Initial data loading state - shows overlay until both jobs and team data are loaded
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const initialDataLoadedRef = useRef({ jobsLoaded: false, teamLoaded: false });
  
  // Track if user has manually interacted with map (to prevent auto-zoom)
  const userHasInteractedRef = useRef(false);
  const isInitialFitDoneRef = useRef(false);
  
  // Track last known positions for movement threshold (prevents marker jitter)
  const lastKnownPositionsRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  
  // Track previously selected worker to enable view tracking during deselection
  // This prevents the iOS bug where markers flash at (0,0) when selection changes
  const prevSelectedWorkerIdRef = useRef<string | null>(null);
  
  // Animation state for smooth marker transitions
  const markerScaleAnim = useRef(new Animated.Value(1)).current;
  
  // Update previous selected worker ref when selection changes
  useEffect(() => {
    // Store the current selection for next render cycle
    const timeoutId = setTimeout(() => {
      prevSelectedWorkerIdRef.current = selectedWorker?.id || null;
    }, 300); // Clear after animation completes
    
    return () => clearTimeout(timeoutId);
  }, [selectedWorker]);

  // Fetch jobs from /api/map/jobs which geocodes addresses on-the-fly
  const fetchMapJobs = useCallback(async () => {
    try {
      setMapJobsLoading(true);
      if (__DEV__) console.log('[Map] Fetching geocoded jobs from /api/map/jobs...');
      const response = await api.get<any[]>('/api/map/jobs');
      
      if (response.error) {
        if (__DEV__) console.log('[Map] Map jobs API error:', response.error);
        setMapJobs([]);
        return false;
      }
      
      const data = response.data;
      if (!Array.isArray(data)) {
        if (__DEV__) console.log('[Map] Map jobs response is not an array:', data);
        setMapJobs([]);
        return false;
      }
      
      // Transform API response to JobWithLocation format
      const transformedJobs: JobWithLocation[] = data.map((job: any) => ({
        id: job.id,
        title: job.title,
        status: job.status,
        address: job.address,
        clientName: job.clientName,
        latitude: job.latitude,
        longitude: job.longitude,
        assignedTo: job.assignedTo,
      }));
      
      if (__DEV__) console.log(`[Map] Loaded ${transformedJobs.length} geocoded jobs`);
      setMapJobs(transformedJobs);
      return true;
    } catch (error) {
      if (__DEV__) console.log('[Map] Failed to fetch map jobs:', error);
      setMapJobs([]);
      return false;
    } finally {
      setMapJobsLoading(false);
    }
  }, []);

  const filteredJobs = useMemo(() => {
    let jobs = mapJobs;
    // Defense in depth: the server already restricts non-VIEW_ALL team members to
    // their assigned jobs, but mirror it client-side for any worker (not just
    // subcontractors) so the map can never show jobs they aren't assigned to.
    if (!canViewAllJobs && user?.id) {
      jobs = jobs.filter(job => job.assignedTo === user.id || (teamMemberId && job.assignedTo === teamMemberId));
    }
    if (statusFilter === 'all') return jobs;
    return jobs.filter(job => job.status === statusFilter);
  }, [mapJobs, statusFilter, canViewAllJobs, user?.id, teamMemberId]);

  const fetchTeamLocations = useCallback(async () => {
    try {
      if (__DEV__) console.log('[Map] Fetching team locations...');
      const response = await api.get<any[]>('/api/team/locations');
      // API returns { data, error } - not a raw fetch response
      if (response.error) {
        if (__DEV__) console.log('[Map] Team locations API error:', response.error);
        setTeamMembers([]);
        return;
      }
      const data = response.data;
      if (__DEV__) console.log('[Map] Team locations response:', Array.isArray(data) ? `${data.length} members` : 'not an array');
      // Defensive check for array response
      if (!Array.isArray(data)) {
        if (__DEV__) console.log('[Map] Team locations response is not an array:', data);
        setTeamMembers([]);
        return;
      }
      // Transform API response to match TeamMember interface
      // API returns: { id, name, email, latitude, longitude, lastUpdated, currentJobId, currentJobTitle }
      // We need: { id, userId, role, user: { firstName, lastName }, lastLocation: { latitude, longitude, timestamp }, activityStatus }
      type RawTeamMember = { id: string; name?: string; latitude?: number | string; longitude?: number | string; isSubcontractor?: boolean; currentJobId?: string; currentJobTitle?: string; userId?: string; role?: string; themeColor?: string | null; lastUpdated?: string; speed?: number | null; batteryLevel?: number | null; activityStatus?: string | null; workerState?: string | null; activeJobName?: string | null };
      const transformedMembers: TeamMember[] = (data as RawTeamMember[])
        .map((m): TeamMember | null => {
          const nameParts = (m.name || '').trim().split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          const newLat = Number(m.latitude);
          const newLng = Number(m.longitude);
          
          // Check if new coordinates are valid and within reasonable geographic bounds
          // Australia bounds: lat -45 to -10, lng 110 to 155 (with some buffer)
          const isWithinBounds = newLat >= -50 && newLat <= 0 && newLng >= 100 && newLng <= 180;
          const hasValidNewCoords = Number.isFinite(newLat) && Number.isFinite(newLng) && isWithinBounds;
          
          // Subcontractors without valid coords from API should never show (privacy)
          // Do not fall back to cached positions for inactive subbies
          if (m.isSubcontractor && !hasValidNewCoords) {
            lastKnownPositionsRef.current.delete(m.id);
            return null;
          }

          // Get last known position from cache
          const lastKnown = lastKnownPositionsRef.current.get(m.id);
          let useLat: number;
          let useLng: number;
          
          if (hasValidNewCoords) {
            // New coordinates are valid - check movement threshold
            if (lastKnown) {
              const distance = calculateDistance(lastKnown.lat, lastKnown.lng, newLat, newLng);
              if (distance < MOVEMENT_THRESHOLD_METERS) {
                // Use last known position to prevent jitter
                useLat = lastKnown.lat;
                useLng = lastKnown.lng;
              } else {
                // Significant movement - update last known position
                useLat = newLat;
                useLng = newLng;
                lastKnownPositionsRef.current.set(m.id, { lat: newLat, lng: newLng });
              }
            } else {
              // First time seeing this member - save position
              useLat = newLat;
              useLng = newLng;
              lastKnownPositionsRef.current.set(m.id, { lat: newLat, lng: newLng });
            }
          } else if (lastKnown) {
            // API returned invalid coords - use last known good position
            if (__DEV__) console.log(`[Map] Using cached position for ${m.name} (API returned invalid coords)`);
            useLat = lastKnown.lat;
            useLng = lastKnown.lng;
          } else {
            // No valid coords and no cache - skip this member
            if (__DEV__) console.log(`[Map] Skipping ${m.name} - no valid coordinates available`);
            return null;
          }
          
          return {
            id: m.id,
            userId: m.id,
            role: 'worker',
            themeColor: m.themeColor || null,
            user: {
              firstName,
              lastName,
            },
            lastLocation: {
              latitude: useLat,
              longitude: useLng,
              timestamp: m.lastUpdated || new Date().toISOString(),
              speed: m.speed != null ? Number(m.speed) : undefined,
              battery: m.batteryLevel != null ? Number(m.batteryLevel) : undefined,
            },
            activityStatus: (() => {
              // The worker's explicitly-set availability (Busy/Unavailable) always wins
              // over the location-derived activity, so the map matches Team Operations.
              const ws = (m.workerState || '').toLowerCase();
              if (ws === 'busy' || ws === 'unavailable') return ws as TeamMember['activityStatus'];
              return ((m.activityStatus as TeamMember['activityStatus']) || (m.currentJobId ? 'working' : 'online'));
            })(),
            isSubcontractor: m.isSubcontractor || false,
            activeJobName: m.activeJobName || m.currentJobTitle || undefined,
          };
        })
        .filter((m: TeamMember | null): m is TeamMember => m !== null);
      
      // Deduplicate by name to prevent multiple markers for the same person
      // (e.g. an owner who also has a self-membership row). When the same person
      // appears twice, keep the most meaningful status so an explicit Busy/On Job
      // wins over a generic Online — matching what Team Operations shows.
      const STATUS_PRIORITY: Record<string, number> = {
        on_job: 6, working: 6, busy: 5, unavailable: 5, driving: 4, online: 2, idle: 2, offline: 1,
      };
      const statusRank = (s?: string) => STATUS_PRIORITY[s || 'offline'] ?? 0;
      const uniqueMembers = transformedMembers.reduce((acc, member) => {
        const name = `${member.user?.firstName} ${member.user?.lastName}`.trim();
        const idx = acc.findIndex(m => 
          `${m.user?.firstName} ${m.user?.lastName}`.trim() === name
        );
        if (idx === -1) {
          acc.push(member);
        } else if (statusRank(member.activityStatus) > statusRank(acc[idx].activityStatus)) {
          acc[idx] = member;
        }
        return acc;
      }, [] as TeamMember[]);
      
      setTeamMembers(uniqueMembers);
    } catch (error) {
      if (__DEV__) console.log('Failed to fetch team locations:', error);
    }
  }, []);

  const fetchGeofenceAlerts = useCallback(async () => {
    if (!canViewTeamMode) return;
    try {
      const response = await api.get<GeofenceAlert[]>('/api/map/geofence-alerts');
      // API returns { data, error } - not a raw fetch response
      if (response.error) {
        if (__DEV__) console.log('Geofence alerts API error:', response.error);
        setGeofenceAlerts([]);
        return;
      }
      if (response.data && Array.isArray(response.data)) {
        setGeofenceAlerts(response.data);
      } else {
        setGeofenceAlerts([]);
      }
    } catch (error) {
      if (__DEV__) console.log('Failed to fetch geofence alerts:', error);
      setGeofenceAlerts([]);
    }
  }, [canViewTeamMode]);

  const markAlertRead = async (alertId: string) => {
    try {
      await api.post(`/api/map/geofence-alerts/${alertId}/read`);
      setGeofenceAlerts(prev => prev.map(a => 
        a.id === alertId ? { ...a, isRead: true } : a
      ));
    } catch (error) {
      if (__DEV__) console.log('Failed to mark alert read:', error);
    }
  };

  const unreadAlerts = useMemo(() => {
    return geofenceAlerts.filter(a => !a.isRead);
  }, [geofenceAlerts]);

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      if (__DEV__) console.log('Location error:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchMapJobs();
    if (showTeamMembers && canViewTeamMode) {
      await Promise.all([fetchTeamLocations(), fetchGeofenceAlerts()]);
    }
    setIsRefreshing(false);
  };

  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 500);
    }
  };

  const fitToMarkers = useCallback(() => {
    if (!mapRef.current) return;
    
    let coordinates: { latitude: number; longitude: number }[] = [];
    
    if (showJobs) {
      coordinates = coordinates.concat(
        filteredJobs
          .filter(job => job.latitude && job.longitude)
          .map(job => ({ latitude: job.latitude!, longitude: job.longitude! }))
      );
    }
    
    if (showTeamMembers && canViewTeamMode) {
      coordinates = coordinates.concat(
        teamMembers
          .filter(member => member.lastLocation)
          .map(member => ({
            latitude: member.lastLocation!.latitude,
            longitude: member.lastLocation!.longitude,
          }))
      );
    }
    
    if (coordinates.length > 0) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { 
          top: headerCollapsed ? 100 : 200, 
          right: 60, 
          bottom: bottomNavHeight + 100, 
          left: 60 
        },
        animated: true,
      });
    }
  }, [showJobs, showTeamMembers, filteredJobs, teamMembers, bottomNavHeight, headerCollapsed, canViewTeamMode]);

  useEffect(() => {
    fetchMapJobs().then(() => {
      initialDataLoadedRef.current.jobsLoaded = true;
      if (initialDataLoadedRef.current.jobsLoaded && initialDataLoadedRef.current.teamLoaded) {
        setInitialDataLoaded(true);
      }
    }).catch(err => {
      if (__DEV__) console.warn('[Map] Failed to fetch map jobs:', err);
      initialDataLoadedRef.current.jobsLoaded = true;
      if (initialDataLoadedRef.current.teamLoaded) {
        setInitialDataLoaded(true);
      }
    });
    requestLocation();
  }, [fetchMapJobs]);

  // Real-time team location polling - Life360 style live updates
  useEffect(() => {
    // Always clean up existing interval first to prevent overlap
    if (locationPollRef.current) {
      clearInterval(locationPollRef.current);
      locationPollRef.current = null;
    }
    
    // Reset markers ready state when turning off team view
    if (!showTeamMembers || !canViewTeamMode) {
      setTeamMarkersReady(false);
      // Mark team as loaded since we won't be fetching it
      initialDataLoadedRef.current.teamLoaded = true;
      if (initialDataLoadedRef.current.jobsLoaded && initialDataLoadedRef.current.teamLoaded) {
        setInitialDataLoaded(true);
      }
    }
    
    if (showTeamMembers && canViewTeamMode && isLive) {
      // Initial fetch with delayed marker rendering to prevent top-left flash
      fetchTeamLocations().then(() => {
        setLastLocationUpdate(new Date());
        // Mark team data as loaded for initial data tracking
        initialDataLoadedRef.current.teamLoaded = true;
        if (initialDataLoadedRef.current.jobsLoaded && initialDataLoadedRef.current.teamLoaded) {
          setInitialDataLoaded(true);
        }
        // Delay setting markers ready to ensure coordinates are fully processed
        // This prevents the iOS react-native-maps bug where markers flash at (0,0)
        setTimeout(() => {
          setTeamMarkersReady(true);
        }, 150);
      }).catch(err => {
        if (__DEV__) console.log('[Map] Initial location fetch failed:', err);
      });
      
      // Set up frequent polling for live tracking (every 10 seconds)
      locationPollRef.current = setInterval(() => {
        fetchTeamLocations().then(() => {
          setLastLocationUpdate(new Date());
          if (__DEV__) console.log('[Map] Live location update received');
        }).catch(err => {
          if (__DEV__) console.log('[Map] Live location poll failed:', err);
        });
      }, LOCATION_POLL_INTERVAL);
    }
    
    return () => {
      if (locationPollRef.current) {
        clearInterval(locationPollRef.current);
        locationPollRef.current = null;
      }
    };
  }, [showTeamMembers, fetchTeamLocations, canViewTeamMode, isLive]);

  // Android only: re-enable marker view tracking briefly whenever the team data
  // or selection changes so the custom marker views actually render, then turn it
  // back off to avoid the iOS-style (0,0) flash and keep the map performant.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    setTrackTeamChanges(true);
    const t = setTimeout(() => setTrackTeamChanges(false), 800);
    return () => clearTimeout(t);
  }, [teamMembers, selectedWorker, teamMarkersReady]);

  // WebSocket for real-time location updates - Life360 style instant updates
  useEffect(() => {
    if (!showTeamMembers || !canViewTeamMode || !isLive) return;
    
    let ws: WebSocket | null = null;
    
    try {
      // Construct WebSocket URL from API base URL (React Native compatible)
      // Convert http(s) protocol to ws(s) protocol
      const wsProtocol = API_URL.startsWith('https') ? 'wss:' : 'ws:';
      const wsHost = API_URL.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}//${wsHost}/ws/location?businessId=${user?.id}&isTradie=false`;
      
      if (__DEV__) console.log('[Map] WebSocket connecting to:', wsUrl.replace(/businessId=[^&]*/, 'businessId=***'));
      
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        if (__DEV__) console.log('[Map] WebSocket connected for real-time location updates');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'team_location_update') {
            if (__DEV__) console.log('[Map] Real-time location update received:', data.userId);
            // Refresh team locations on any update
            fetchTeamLocations();
          }
        } catch (e) {
          console.error('[Map] WebSocket message parse error:', e);
        }
      };
      
      ws.onerror = () => {
        if (__DEV__) console.warn('[Map] WebSocket unavailable — using polling for location updates');
      };
      
      ws.onclose = () => {
        if (__DEV__) console.log('[Map] WebSocket closed');
      };
    } catch (error) {
      if (__DEV__) console.warn('[Map] WebSocket connection failed (using polling):', error instanceof Error ? error.message : String(error));
    }
    
    return () => {
      if (ws) {
        try {
          ws.close();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [showTeamMembers, canViewTeamMode, isLive, user?.id, fetchTeamLocations]);

  // Fetch geofence alerts for owners/managers
  useEffect(() => {
    if (canViewTeamMode) {
      fetchGeofenceAlerts();
      const interval = setInterval(fetchGeofenceAlerts, 60000);
      return () => clearInterval(interval);
    }
  }, [canViewTeamMode, fetchGeofenceAlerts]);

  // Auto-fit map to markers ONLY when user explicitly toggles filters (not on polling)
  // The effect is gated by filter changes, not data changes
  useEffect(() => {
    // Skip if user has interacted with map or has a worker selected
    if (userHasInteractedRef.current || selectedWorker) {
      return;
    }
    
    // Check if we have data to fit to
    const hasData = (showJobs && filteredJobs.length > 0) || (showTeamMembers && teamMembers.length > 0);
    
    // Only auto-fit when filters change and we haven't already done initial fit
    if (hasData && mapRef.current && !isInitialFitDoneRef.current) {
      const timeout = setTimeout(() => {
        fitToMarkers();
        isInitialFitDoneRef.current = true;
      }, 300);
      return () => clearTimeout(timeout);
    }
    // Note: Intentionally NOT including fitToMarkers, teamMembers.length, or filteredJobs.length
    // in dependencies to prevent re-running on polling updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showJobs, showTeamMembers, statusFilter, selectedWorker]);
  
  // Reset interaction flag when user explicitly toggles jobs/team visibility (via buttons)
  // This is a separate effect to avoid circular dependencies
  const prevFiltersRef = useRef({ showJobs, showTeamMembers, statusFilter });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    // Only reset if filters actually changed (not on initial mount)
    if (prev.showJobs !== showJobs || prev.showTeamMembers !== showTeamMembers || prev.statusFilter !== statusFilter) {
      userHasInteractedRef.current = false;
      isInitialFitDoneRef.current = false;
      prevFiltersRef.current = { showJobs, showTeamMembers, statusFilter };
    }
  }, [showJobs, showTeamMembers, statusFilter]);
  
  // Handle map interaction to prevent auto-zoom after user pans/zooms
  const handleMapPanDrag = useCallback(() => {
    userHasInteractedRef.current = true;
  }, []);

  const navigateToJob = (jobId: string) => {
    router.push(`/job/${jobId}`);
  };

  const getMarkerColor = (status: string) => {
    return statusColors[status as keyof typeof statusColors]?.dot || colors.mutedForeground;
  };

  const getActivityColor = (status?: string) => {
    return activityConfig[status || 'offline']?.color || colors.mutedForeground;
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatLastSeen = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  };

  // Convert zoom level to region deltas (iOS uses deltas, not zoom)
  const zoomToDeltas = useCallback((zoom: number) => {
    // Approximate conversion: delta = 360 / (2^zoom)
    // zoom 15 ≈ 0.01, zoom 16 ≈ 0.005, zoom 17 ≈ 0.0025
    const delta = 360 / Math.pow(2, zoom);
    return { latitudeDelta: delta, longitudeDelta: delta };
  }, []);

  // Animate camera to a specific location with smooth zoom - Life360 style
  // Uses animateToRegion for iOS compatibility (zoom param is ignored on Apple Maps)
  const animateCameraToLocation = useCallback((
    latitude: number, 
    longitude: number, 
    options: { zoom?: number; duration?: number } = {}
  ) => {
    if (!mapRef.current) return;
    
    const { zoom = 15, duration = 600 } = options;
    
    // Use animateToRegion which works on both iOS and Android
    // iOS ignores zoom param in animateCamera, so we must use deltas
    const { latitudeDelta, longitudeDelta } = zoomToDeltas(zoom);
    
    mapRef.current.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta,
        longitudeDelta,
      },
      duration
    );
  }, [zoomToDeltas]);

  // Handle worker selection for assignment - with smooth camera animation
  const handleWorkerTap = useCallback((member: TeamMember) => {
    // Provide haptic feedback for tap
    Haptics.selectionAsync().catch(() => {});
    
    const memberLat = member.lastLocation?.latitude;
    const memberLng = member.lastLocation?.longitude;
    
    if (selectedWorker?.id === member.id) {
      // Deselect if tapping same worker - stay at current zoom (don't zoom out)
      setSelectedWorker(null);
      markerScaleAnim.setValue(1); // Reset scale
      // Mark as interacted to prevent auto-fit from triggering
      userHasInteractedRef.current = true;
    } else {
      // Mark as interacted to prevent any auto-fit from triggering
      userHasInteractedRef.current = true;
      
      // Determine animation speed - faster when switching between members (already zoomed in)
      const isSwitching = selectedWorker !== null;
      const animDuration = isSwitching ? 400 : 700; // Faster for member-to-member
      const targetZoom = 17; // Street-level zoom for close-up view
      
      // Set selected immediately when switching between members for snappier feel
      if (isSwitching) {
        setSelectedWorker(member);
      }
      
      if (memberLat && memberLng) {
        animateCameraToLocation(memberLat, memberLng, { 
          zoom: targetZoom, 
          duration: animDuration 
        });
      }
      
      // For initial selection (not switching), delay state update
      if (!isSwitching) {
        setTimeout(() => {
          setSelectedWorker(member);
        }, animDuration * 0.4);
      }
      
      // Pulse animation for selected marker
      markerScaleAnim.setValue(1);
      Animated.sequence([
        Animated.spring(markerScaleAnim, {
          toValue: 1.15,
          friction: 5,
          tension: 150,
          useNativeDriver: true,
        }),
        Animated.spring(markerScaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [selectedWorker, animateCameraToLocation, fitToMarkers, markerScaleAnim]);

  // Handle job tap when worker is selected
  const handleJobTapForAssignment = (job: JobWithLocation) => {
    if (!selectedWorker || !canAssignJobs) {
      navigateToJob(job.id);
      return;
    }
    
    // Show confirmation modal
    setPendingAssignment({ worker: selectedWorker, job });
  };

  // Confirm assignment
  const confirmAssignment = async () => {
    if (!pendingAssignment) return;
    
    setIsAssigning(true);
    
    try {
      const response = await api.post(`/api/jobs/${pendingAssignment.job.id}/assign`, {
        assignedTo: pendingAssignment.worker.userId,
      });
      
      if (response.data && !response.error) {
        Alert.alert(
          'Job Assigned',
          `${pendingAssignment.job.title} has been assigned to ${pendingAssignment.worker.user?.firstName} ${pendingAssignment.worker.user?.lastName}`,
          [{ text: 'OK' }]
        );
        // Refresh jobs to reflect the assignment
        await fetchMapJobs();
      } else {
        Alert.alert('Assignment Failed', response.error || 'Failed to assign job. Please try again.');
      }
    } catch (error) {
      console.error('Assignment error:', error);
      Alert.alert('Error', 'An error occurred while assigning the job.');
    } finally {
      setIsAssigning(false);
      setPendingAssignment(null);
      setSelectedWorker(null);
    }
  };

  const cancelAssignment = () => {
    setPendingAssignment(null);
  };

  const clearWorkerSelection = () => {
    setSelectedWorker(null);
  };

  // Handle job marker press - shows action sheet instead of navigating directly
  const handleJobMarkerPress = (job: JobWithLocation) => {
    // If a worker is selected for assignment, use the assignment flow
    if (selectedWorker && canAssignJobs) {
      handleJobTapForAssignment(job);
      return;
    }
    // Otherwise show action sheet
    setSelectedJob(job);
    setShowJobActionSheet(true);
  };

  // Check if job is already in route
  const isJobInRoute = useCallback((jobId: string) => {
    return routeJobs.some(j => j.id === jobId);
  }, [routeJobs]);

  // Action sheet handlers
  const handleViewJob = () => {
    if (selectedJob) {
      setShowJobActionSheet(false);
      router.push(`/job/${selectedJob.id}`);
    }
  };

  const handleAddToRoute = () => {
    if (selectedJob && !isJobInRoute(selectedJob.id)) {
      setRouteJobs(prev => [...prev, selectedJob]);
      setShowRoutePanel(true);
      Alert.alert('Added to Route', `${selectedJob.title} has been added to your route.`);
    } else if (selectedJob) {
      Alert.alert('Already in Route', 'This job is already in your route.');
    }
    setShowJobActionSheet(false);
  };

  const handleGetDirections = () => {
    if (selectedJob?.latitude && selectedJob?.longitude) {
      const { openMapsWithPreference } = require('../../src/lib/maps-store');
      openMapsWithPreference(selectedJob.latitude, selectedJob.longitude, selectedJob.address);
    }
    setShowJobActionSheet(false);
  };

  // Route panel handlers
  const handleRemoveFromRoute = (jobId: string) => {
    setRouteJobs(prev => prev.filter(j => j.id !== jobId));
  };

  const handleClearRoute = async () => {
    const ok = await confirm({ title: 'Clear Route', message: 'Are you sure you want to clear all jobs from your route?', confirmText: 'Clear', cancelText: 'Cancel', destructive: true });
    if (ok) {
      setRouteJobs([]);
      setShowRoutePanel(false);
    }
  };

  const handleOptimizeRoute = async () => {
    if (routeJobs.length < 2) {
      Alert.alert('Not Enough Stops', 'Add at least 2 jobs to optimize your route.');
      return;
    }
    
    setIsOptimizing(true);
    try {
      const response = await api.post('/api/routes/optimize', {
        jobIds: routeJobs.map(j => j.id),
        userLatitude: userLocation?.latitude,
        userLongitude: userLocation?.longitude,
      });
      
      if (!response.error) {
        const data = response.data as any;
        if (data.optimizedJobIds) {
          // Reorder routeJobs based on optimized order
          const optimizedJobs = data.optimizedJobIds
            .map((id: string) => routeJobs.find(j => j.id === id))
            .filter(Boolean) as JobWithLocation[];
          setRouteJobs(optimizedJobs);
          Alert.alert('Route Optimized', 'Your route has been optimized for the shortest distance.');
        }
      } else {
        Alert.alert('Optimization Failed', 'Could not optimize route. Please try again.');
      }
    } catch (error) {
      console.error('Route optimization error:', error);
      Alert.alert('Error', 'An error occurred while optimizing the route.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleStartRoute = () => {
    if (routeJobs.length === 0) return;
    
    const jobsWithCoords = routeJobs.filter(j => j.latitude && j.longitude);
    if (jobsWithCoords.length === 0) return;

    if (Platform.OS === 'ios') {
      const jobsWithAddress = jobsWithCoords.filter(j => j.address);
      if (jobsWithAddress.length > 0) {
        const addresses = jobsWithAddress.map(j => encodeURIComponent(j.address!));
        let url: string;
        if (addresses.length === 1) {
          url = `maps://maps.apple.com/?daddr=${addresses[0]}&dirflg=d`;
        } else {
          url = `https://maps.apple.com/?dirflg=d&saddr=Current+Location&daddr=${addresses.join('+to:')}`;
        }
        Linking.openURL(url).catch(() => {
          const fallback = `https://www.google.com/maps/dir/?api=1&destination=${jobsWithCoords[jobsWithCoords.length - 1].latitude},${jobsWithCoords[jobsWithCoords.length - 1].longitude}&waypoints=${encodeURIComponent(jobsWithCoords.slice(0, -1).map(j => `${j.latitude},${j.longitude}`).join('|'))}&travelmode=driving`;
          Linking.openURL(fallback).catch(() => {
            Alert.alert('Navigation Error', 'Unable to open maps for navigation.');
          });
        });
      } else {
        const coords = jobsWithCoords.map(j => `${j.latitude},${j.longitude}`);
        const url = `https://maps.apple.com/?dirflg=d&saddr=Current+Location&daddr=${coords.join('+to:')}`;
        Linking.openURL(url).catch(() => {
          Alert.alert('Navigation Error', 'Unable to open maps for navigation.');
        });
      }
    } else {
      const waypoints = jobsWithCoords.map(j => `${j.latitude},${j.longitude}`);
      const destination = waypoints[waypoints.length - 1];
      const waypointsParam = waypoints.slice(0, -1).join('|');
      const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&waypoints=${encodeURIComponent(waypointsParam)}&travelmode=driving`;
      Linking.openURL(url).catch(err => {
        if (__DEV__) console.warn('[Map] Failed to open navigation URL:', err);
        Alert.alert('Navigation Error', 'Unable to open maps for navigation.');
      });
    }
  };

  // Show restricted view for staff without map access
  if (!hasMapAccess && !roleLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: spacing.xl }]}>
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <View style={{ 
            width: 80, 
            height: 80, 
            borderRadius: 40, 
            backgroundColor: colors.muted, 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <Feather name="map" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={{ fontSize: typography.sizes.xl, fontWeight: fontWeights.semibold, color: colors.foreground, textAlign: 'center' }}>
            Map Access Restricted
          </Text>
          <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground, textAlign: 'center', lineHeight: 20 }}>
            Team tracking is available for managers and owners.{'\n'}You can view your assigned jobs on the Jobs screen.
          </Text>
          <TouchableOpacity
            style={{ 
              backgroundColor: colors.primary, 
              paddingHorizontal: spacing.xl, 
              paddingVertical: spacing.md, 
              borderRadius: radius.md,
              marginTop: spacing.md
            }}
            onPress={() => router.push('/(tabs)/jobs')}
            activeOpacity={0.8}
          >
            <Text style={{ color: colors.primaryForeground, fontWeight: fontWeights.semibold }}>View My Jobs</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const activeTeamCount = teamMembers.filter(m => m.activityStatus !== 'offline').length;

  // Map error fallback UI
  const mapErrorFallback = (
    <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: spacing.xl }]}>
      <View style={{ 
        width: 80, 
        height: 80, 
        borderRadius: 40, 
        backgroundColor: colors.muted, 
        alignItems: 'center', 
        justifyContent: 'center',
        marginBottom: spacing.lg
      }}>
        <Feather name="map-pin" size={36} color={colors.mutedForeground} />
      </View>
      <Text style={{ fontSize: typography.sizes.lg, fontWeight: fontWeights.semibold, color: colors.foreground, textAlign: 'center', marginBottom: spacing.sm }}>
        Map Unavailable
      </Text>
      <Text style={{ fontSize: typography.button.fontSize, color: colors.mutedForeground, textAlign: 'center', lineHeight: 20, marginBottom: spacing.lg }}>
        The map couldn't load. You can still view your jobs from the Jobs screen.
      </Text>
      <TouchableOpacity
        style={{ 
          backgroundColor: colors.primary, 
          paddingHorizontal: spacing.xl, 
          paddingVertical: spacing.md, 
          borderRadius: radius.md,
        }}
        onPress={() => router.push('/(tabs)/jobs')}
        activeOpacity={0.8}
      >
        <Text style={{ color: colors.primaryForeground, fontWeight: fontWeights.semibold }}>View Jobs</Text>
      </TouchableOpacity>
    </View>
  );


  return (
    <View style={styles.container}>
      <MapErrorBoundary fallback={mapErrorFallback}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={DEFAULT_REGION}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          mapType="standard"
          customMapStyle={Platform.OS === 'android' && isDark ? DARK_MAP_STYLE : undefined}
          userInterfaceStyle={isDark ? 'dark' : 'light'}
          onPanDrag={handleMapPanDrag}
          onMapReady={() => {
            // Mark map as ready so markers can be rendered safely
            setIsMapReady(true);
            // Only fit to markers on initial map ready if not already done
            if (!isInitialFitDoneRef.current && (filteredJobs.length > 0 || teamMembers.length > 0)) {
              // Small delay to ensure map is fully initialized before fitting
              setTimeout(() => {
                fitToMarkers();
                isInitialFitDoneRef.current = true;
              }, 100);
            }
          }}
        >
        {/* Job Markers - only render when map is ready to prevent iPad crashes */}
        {isMapReady && showJobs && filteredJobs.map((job) => {
          const jobInRoute = isJobInRoute(job.id);
          return job.latitude && job.longitude && (
            <Marker
              key={`job-${job.id}`}
              coordinate={{ latitude: job.latitude, longitude: job.longitude }}
              onPress={() => handleJobMarkerPress(job)}
              stopPropagation={!!selectedWorker}
            >
              <View style={{ alignItems: 'center' }}>
                <View style={[
                  styles.markerContainer, 
                  { backgroundColor: getMarkerColor(job.status) },
                  selectedWorker && { opacity: 0.9 },
                  jobInRoute && { 
                    borderWidth: 3, 
                    borderColor: colors.primary,
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                  }
                ]}>
                  <Feather name="file-text" size={14} color={colors.white} />
                </View>
                {jobInRoute && (
                  <View style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: colors.white,
                  }}>
                    <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: colors.primaryForeground }}>
                      {routeJobs.findIndex(j => j.id === job.id) + 1}
                    </Text>
                  </View>
                )}
              </View>
            </Marker>
          );
        })}

        {/* Team Member Markers - Life360 Style */}
        {/* Note: Members are pre-filtered at transformation time - all members in state have valid coords */}
        {/* isMapReady + teamMarkersReady delays rendering until fully stable to prevent iPad crashes */}
        {isMapReady && showTeamMembers && canViewTeamMode && teamMarkersReady && teamMembers.map((member) => {
          // Safety check - validate coordinates are within Australia bounds
          const lat = member.lastLocation?.latitude;
          const lng = member.lastLocation?.longitude;
          if (!member.lastLocation || !lat || !lng || 
              lat < -50 || lat > 0 || lng < 100 || lng > 180) {
            return null;
          }
          
          // Use member's theme color as base, fallback to a nice blue
          const memberColor = member.isSubcontractor ? '#9B7BDB' : (member.themeColor || '#5B8DEF');
          const activityColor = getActivityColor(member.activityStatus);
          const initials = `${member.user?.firstName?.[0] || '?'}${member.user?.lastName?.[0] || '?'}`;
          const isSelected = selectedWorker?.id === member.id;
          const fullName = `${member.user?.firstName || ''} ${member.user?.lastName || ''}`.trim();
          const shortName = member.isSubcontractor && member.activeJobName
            ? `On job: ${member.activeJobName}`
            : (member.user?.firstName || fullName.split(' ')[0] || 'Unknown');
          
          // Double-check coordinates are valid numbers before creating marker
          const coordLat = Number(member.lastLocation.latitude);
          const coordLng = Number(member.lastLocation.longitude);
          if (!Number.isFinite(coordLat) || !Number.isFinite(coordLng)) {
            if (__DEV__) console.log('[Map] Skipping team marker with non-finite coordinates');
            return null;
          }
          
          // Use coordinate-based key to force full re-render when position changes
          // This prevents stale state issues that cause markers to appear at screen (0,0)
          const markerKey = `team-${member.id}-${coordLat.toFixed(4)}-${coordLng.toFixed(4)}`;
          
          // IMPORTANT: Keep marker appearance 100% static to avoid iOS react-native-maps bug
          // where markers flash at (0,0) when their view content changes.
          // Selection is shown ONLY through the name label below the marker.
          
          return (
            <Marker
              key={markerKey}
              coordinate={{
                latitude: coordLat,
                longitude: coordLng,
              }}
              onPress={() => handleWorkerTap(member)}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={Platform.OS === 'android' ? trackTeamChanges : false}
            >
              <View 
                style={{ 
                  alignItems: 'center', 
                  paddingBottom: 20,
                }}
              >
                {/* Main bubble - Life360 style compact circle */}
                {/* STATIC appearance - never changes based on selection to avoid iOS glitch */}
                <View style={[
                  styles.teamMarkerOuter, 
                  { backgroundColor: memberColor },
                  member.isSubcontractor && { borderColor: colors.invoiced, borderWidth: 2 },
                ]}>
                  <Text style={styles.teamMarkerText}>{initials}</Text>
                  <View style={[styles.activityDot, { backgroundColor: activityColor }]} />
                </View>
                {/* Name label - this is where selection is shown */}
                {/* Only color changes, no size/transform changes to avoid triggering iOS glitch */}
                <View style={[
                  styles.nameLabel,
                  isSelected && { backgroundColor: colors.primary }
                ]}>
                  <Text style={[
                    styles.nameLabelText,
                    isSelected && { color: colors.primaryForeground }
                  ]} numberOfLines={1}>
                    {shortName}
                  </Text>
                </View>
              </View>
              <Callout tooltip>
                <View style={styles.callout}>
                  <Text style={styles.calloutTitle}>
                    {member.user?.firstName} {member.user?.lastName}
                  </Text>
                  {member.isSubcontractor && (
                    <View style={[styles.calloutBadge, { backgroundColor: colors.invoiced }]}>
                      <Text style={styles.calloutBadgeText}>Subcontractor</Text>
                    </View>
                  )}
                  {member.isSubcontractor && member.activeJobName && (
                    <Text style={[styles.calloutDetail, { color: colors.foreground, fontWeight: fontWeights.medium }]}>
                      On job: {member.activeJobName}
                    </Text>
                  )}
                  <View style={styles.activityRow}>
                    <Feather 
                      name={activityConfig[member.activityStatus || 'offline']?.icon || 'circle'} 
                      size={12} 
                      color={getActivityColor(member.activityStatus)} 
                    />
                    <Text style={[styles.calloutSubtitle, { color: getActivityColor(member.activityStatus), marginBottom: 0 }]}>
                      {activityConfig[member.activityStatus || 'offline']?.label || 'Unknown'}
                    </Text>
                  </View>
                  {member.lastLocation.speed !== undefined && member.lastLocation.speed > 0 && (
                    <Text style={styles.calloutDetail}>
                      {Math.round(member.lastLocation.speed * 3.6)} km/h
                    </Text>
                  )}
                  {member.lastLocation.battery !== undefined && (
                    <View style={styles.batteryRow}>
                      <Feather 
                        name={member.lastLocation.battery > 20 ? 'battery' : 'battery-charging'} 
                        size={12} 
                        color={member.lastLocation.battery > 20 ? colors.mutedForeground : colors.warning} 
                      />
                      <Text style={styles.calloutDetail}>{member.lastLocation.battery}%</Text>
                    </View>
                  )}
                  <Text style={styles.calloutHint}>
                    Last updated: {formatTime(member.lastLocation.timestamp)}
                  </Text>
                  {canAssignJobs && (
                    <Text style={[styles.calloutHint, { color: colors.primary, marginTop: spacing.xs }]}>
                      Tap to select for assignment
                    </Text>
                  )}
                </View>
              </Callout>
            </Marker>
          );
        })}

        {/* Planned route line - real OSRM road geometry, with straight-line fallback */}
        {isMapReady && routeGeometry && routeGeometry.coordinates.length >= 2 && (
          <Polyline
            coordinates={routeGeometry.coordinates}
            strokeColor={colors.primary}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}
        {isMapReady && !routeGeometry && routeStraightCoords.length >= 2 && (
          <Polyline
            coordinates={routeStraightCoords}
            strokeColor={colors.primary}
            strokeWidth={4}
            lineDashPattern={[8, 8]}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapView>
      </MapErrorBoundary>

      {/* Floating Header Card */}
      <View style={[styles.headerCard, { top: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerIconContainer}>
            <Feather name="map" size={20} color={colors.primary} />
          </View>
          <View style={styles.headerContent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={styles.headerTitle}>Job Map</Text>
              {/* Live indicator - shows when real-time tracking is active */}
              {isLive && showTeamMembers && canViewTeamMode && (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: colors.success + '26',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 10,
                }}>
                  <View style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.success,
                  }} />
                  <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: colors.success }}>LIVE</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerSubtitle}>
              {filteredJobs.length} jobs
              {showTeamMembers && canViewTeamMode && ` • ${activeTeamCount} active`}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={handleRefresh} 
            style={styles.headerButton}
            disabled={isRefreshing}
            activeOpacity={0.7}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="refresh-cw" size={18} color={colors.foreground} />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setHeaderCollapsed(!headerCollapsed)}
            style={styles.headerButton}
            activeOpacity={0.7}
          >
            <Feather 
              name={headerCollapsed ? "chevron-down" : "chevron-up"} 
              size={18} 
              color={colors.foreground} 
            />
          </TouchableOpacity>
        </View>

        {/* One-tap team location sharing — always visible so it's discoverable */}
        {!locShareEnabled ? (
          <TouchableOpacity
            onPress={handleToggleLocationShare}
            activeOpacity={0.85}
            disabled={locShareBusy}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              marginTop: spacing.sm,
              backgroundColor: colors.primary,
              borderRadius: radius.lg,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              opacity: locShareBusy ? 0.7 : 1,
            }}
          >
            {locShareBusy ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Feather name="radio" size={16} color={colors.primaryForeground} />
            )}
            <Text style={{ flex: 1, fontWeight: fontWeights.semibold, fontSize: typography.sizes.sm, color: colors.primaryForeground }}>
              Share my location with the team
            </Text>
            <Feather name="chevron-right" size={16} color={colors.primaryForeground} />
          </TouchableOpacity>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              marginTop: spacing.sm,
              backgroundColor: locShareStatus === 'paused' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              borderRadius: radius.lg,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
            }}
          >
            {locShareStatus === 'starting' || locShareBusy ? (
              <ActivityIndicator size="small" color={colors.success} />
            ) : (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: locShareStatus === 'paused' ? colors.warning : colors.success,
                }}
              />
            )}
            <Text style={{ flex: 1, fontWeight: fontWeights.semibold, fontSize: typography.sizes.sm, color: colors.foreground }}>
              {locShareStatus === 'starting'
                ? 'Starting location sharing…'
                : locShareStatus === 'paused'
                ? 'Sharing on — paused outside work hours'
                : "You're sharing your location"}
            </Text>
            <TouchableOpacity
              onPress={handleToggleLocationShare}
              activeOpacity={0.7}
              disabled={locShareBusy}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ fontWeight: fontWeights.bold, fontSize: typography.sizes.sm, color: colors.destructive }}>Stop</Text>
            </TouchableOpacity>
          </View>
        )}

        {!headerCollapsed && (
          <View style={styles.controlsRow}>
            <TouchableOpacity 
              style={styles.filterButton}
              onPress={() => setShowFilters(!showFilters)}
              activeOpacity={0.7}
            >
              <Feather name="filter" size={16} color={colors.foreground} />
              <Text style={styles.filterButtonText}>
                {statusFilter === 'all' ? 'All Jobs' : STATUS_LABELS[statusFilter]}
              </Text>
              <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>

            {/* Toggle Buttons - Both can be active */}
            <TouchableOpacity
              style={[
                styles.toggleButton, 
                showJobs ? styles.toggleButtonActive : styles.toggleButtonInactive
              ]}
              onPress={() => setShowJobs(!showJobs)}
              activeOpacity={0.7}
            >
              <Feather 
                name="briefcase" 
                size={14} 
                color={showJobs ? colors.primaryForeground : colors.foreground} 
              />
              <Text style={[
                styles.toggleButtonText,
                showJobs && styles.toggleButtonTextActive
              ]}>Jobs</Text>
            </TouchableOpacity>

            {showTeamToggle && (
              <TouchableOpacity
                style={[
                  styles.toggleButton, 
                  showTeamMembers ? styles.toggleButtonActive : styles.toggleButtonInactive,
                  showTeamMembers && { backgroundColor: colors.success }
                ]}
                onPress={() => setShowTeamMembers(!showTeamMembers)}
                activeOpacity={0.7}
              >
                <Feather 
                  name="users" 
                  size={14} 
                  color={showTeamMembers ? colors.white : colors.foreground} 
                />
                <Text style={[
                  styles.toggleButtonText,
                  showTeamMembers && styles.toggleButtonTextActive
                ]}>Team</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={styles.legendButton}
              onPress={() => setShowLegend(!showLegend)}
              activeOpacity={0.7}
            >
              <Text style={styles.legendButtonText}>Legend</Text>
              <Feather 
                name={showLegend ? "chevron-up" : "chevron-down"} 
                size={14} 
                color={colors.mutedForeground} 
              />
            </TouchableOpacity>

            {/* Alerts Button - Owners/Managers only */}
            {canViewTeamMode && (
              <TouchableOpacity 
                style={[
                  styles.legendButton,
                  unreadAlerts.length > 0 && { backgroundColor: `${colors.destructive}15` }
                ]}
                onPress={() => setShowAlerts(!showAlerts)}
                activeOpacity={0.7}
              >
                <Feather 
                  name="bell" 
                  size={14} 
                  color={unreadAlerts.length > 0 ? colors.destructive : colors.mutedForeground} 
                />
                {unreadAlerts.length > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -2,
                    right: -4,
                    backgroundColor: colors.destructive,
                    borderRadius: 7,
                    minWidth: 14,
                    height: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 3,
                  }}>
                    <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: colors.destructiveForeground }}>
                      {unreadAlerts.length > 9 ? '9+' : unreadAlerts.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {showFilters && (
          <View style={styles.filterDropdown}>
            {(['all', 'pending', 'scheduled', 'in_progress', 'done', 'invoiced'] as const).map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterOption,
                  statusFilter === status && styles.filterOptionActive
                ]}
                onPress={() => {
                  setStatusFilter(status);
                  setShowFilters(false);
                }}
                activeOpacity={0.7}
              >
                {status !== 'all' && (
                  <View style={[styles.filterDot, { backgroundColor: statusColors[status]?.dot }]} />
                )}
                <Text style={[
                  styles.filterOptionText,
                  statusFilter === status && styles.filterOptionTextActive
                ]}>
                  {status === 'all' ? 'All Jobs' : STATUS_LABELS[status]}
                </Text>
                {statusFilter === status && (
                  <Feather name="check" size={16} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Legend Card */}
      {showLegend && (
        <View style={[styles.legendCard, { top: insets.top + (headerCollapsed ? 80 : 180) }]}>
          <Text style={styles.legendTitle}>Job Status</Text>
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <View key={status} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: statusColors[status as keyof typeof statusColors]?.dot }]} />
              <Text style={styles.legendLabel}>{label}</Text>
            </View>
          ))}
          {showTeamMembers && canViewTeamMode && (
            <>
              <Text style={[styles.legendTitle, { marginTop: spacing.md }]}>Team Status</Text>
              {Object.entries(activityConfig).map(([status, config]) => (
                <View key={status} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: config.color }]} />
                  <Text style={styles.legendLabel}>{config.label}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {/* Geofence Alerts Panel */}
      {showAlerts && unreadAlerts.length > 0 && (() => {
        const formatAlertTime = (dateStr: string) => {
          const date = new Date(dateStr);
          const now = new Date();
          const diffMs = now.getTime() - date.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMs / 3600000);
          if (diffMins < 1) return 'Just now';
          if (diffMins < 60) return `${diffMins}m ago`;
          if (diffHours < 24) return `${diffHours}h ago`;
          return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
        };

        const grouped = unreadAlerts.reduce((acc, alert) => {
          const key = `${alert.userName}-${alert.alertType}`;
          if (!acc[key]) {
            acc[key] = { ...alert, count: 1, latestTime: alert.createdAt, ids: [alert.id] };
          } else {
            acc[key].count++;
            acc[key].ids.push(alert.id);
            if (new Date(alert.createdAt) > new Date(acc[key].latestTime)) {
              acc[key].latestTime = alert.createdAt;
              acc[key].jobTitle = alert.jobTitle;
              acc[key].address = alert.address;
            }
          }
          return acc;
        }, {} as Record<string, GeofenceAlert & { count: number; latestTime: string; ids: string[] }>);

        const groupedAlerts = Object.values(grouped).sort(
          (a, b) => new Date(b.latestTime).getTime() - new Date(a.latestTime).getTime()
        );

        const alertTypeConfig = {
          arrival: { icon: 'log-in' as const, color: colors.success, label: 'Arrivals' },
          departure: { icon: 'log-out' as const, color: colors.warning, label: 'Departures' },
          late: { icon: 'clock' as const, color: colors.destructive, label: 'Late' },
          speed_warning: { icon: 'alert-triangle' as const, color: colors.destructive, label: 'Speed' },
        };

        const typeCounts = unreadAlerts.reduce((acc, a) => {
          acc[a.alertType] = (acc[a.alertType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return (
          <View style={[styles.legendCard, { top: insets.top + (headerCollapsed ? 80 : 180), maxHeight: 320, width: 280 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Feather name="bell" size={14} color={colors.foreground} />
                <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.bold, color: colors.foreground }}>Activity</Text>
                <View style={{ backgroundColor: colors.destructive, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 2 }}>
                  <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.bold, color: colors.destructiveForeground }}>{unreadAlerts.length}</Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={() => setShowAlerts(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm }}>
              {Object.entries(typeCounts).map(([type, count]) => {
                const config = alertTypeConfig[type as keyof typeof alertTypeConfig];
                if (!config) return null;
                return (
                  <View key={type} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: `${config.color}12`, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 }}>
                    <Feather name={config.icon} size={10} color={config.color} />
                    <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: config.color }}>{count}</Text>
                  </View>
                );
              })}
            </View>
          
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {groupedAlerts.slice(0, 8).map((alert) => {
                const firstName = alert.userName.split(' ')[0];
                const config = alertTypeConfig[alert.alertType as keyof typeof alertTypeConfig] || alertTypeConfig.departure;
                const actionText = alert.alertType === 'arrival' ? 'arrived at' :
                                   alert.alertType === 'departure' ? 'left' :
                                   alert.alertType === 'late' ? 'late for' : 'speeding near';
                
                return (
                  <PressableRow
                    key={alert.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: spacing.sm,
                      paddingVertical: 6,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: colors.border,
                    }}
                    onPress={() => {
                      alert.ids.forEach(id => markAlertRead(id));
                    }}
                  >
                    <View style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: `${config.color}15`,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 1,
                    }}>
                      <Feather name={config.icon} size={12} color={config.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.foreground, lineHeight: 16 }} numberOfLines={2}>
                        <Text style={{ fontWeight: fontWeights.semibold }}>{firstName}</Text>
                        <Text style={{ color: colors.mutedForeground }}> {actionText} </Text>
                        <Text style={{ fontWeight: fontWeights.medium }}>{alert.jobTitle || 'job site'}</Text>
                        {alert.alertType === 'departure' && alert.dwellSeconds && alert.dwellSeconds > 0 && (
                          <Text style={{ color: colors.mutedForeground, fontSize: typography.sizes.xs }}>
                            {` · ${(() => {
                              const s = alert.dwellSeconds!;
                              const h = Math.floor(s / 3600);
                              const m = Math.floor((s % 3600) / 60);
                              return h > 0 ? `${h}h ${m}m on site` : `${m}m on site`;
                            })()}`}
                          </Text>
                        )}
                        {alert.count > 1 && (
                          <Text style={{ color: colors.mutedForeground, fontSize: typography.sizes.xs }}> ({alert.count}x)</Text>
                        )}
                      </Text>
                      <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: 2 }}>
                        {formatAlertTime(alert.latestTime)}
                        {alert.address ? ` \u00B7 ${alert.address.split(',')[0]}` : ''}
                      </Text>
                    </View>
                  </PressableRow>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={{ marginTop: spacing.sm, paddingVertical: 6, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}
              onPress={() => {
                unreadAlerts.forEach(a => markAlertRead(a.id));
                setShowAlerts(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: colors.primary }}>Mark All Read</Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* Selected Worker Banner */}
      {selectedWorker && (
        <View style={[styles.assignModeBanner, { bottom: bottomNavHeight + spacing.md }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.assignModeBannerText}>
              {selectedWorker.user?.firstName} {selectedWorker.user?.lastName} selected
            </Text>
            <Text style={styles.assignModeBannerSubtext}>
              Tap a job to assign
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.cancelButton, { minWidth: 70, alignItems: 'center' }]}
            onPress={() => {
              if (__DEV__) console.log('[Map] Cancel button pressed - clearing selection');
              setSelectedWorker(null);
            }}
            activeOpacity={0.6}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FAB Container */}
      <View style={[styles.fabContainer, { bottom: bottomNavHeight + spacing.lg }]}>
        <TouchableOpacity 
          style={styles.fabSecondary}
          onPress={fitToMarkers}
          activeOpacity={0.7}
        >
          <Feather name="maximize-2" size={20} color={colors.foreground} />
        </TouchableOpacity>
        
        {userLocation && (
          <TouchableOpacity 
            style={styles.fabSecondary}
            onPress={centerOnUser}
            activeOpacity={0.7}
          >
            <Feather name="navigation" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Team Member Chips - Life360 Style compact horizontal scroll */}
      {/* Only show when teamMarkersReady to sync with map markers and prevent flash */}
      {canViewTeamMode && showTeamMembers && teamMarkersReady && teamMembers.length > 0 && !selectedWorker && routeJobs.length === 0 && (
        <View style={{
          position: 'absolute',
          bottom: bottomNavHeight + spacing.sm,
          left: 0,
          right: 64,
          paddingHorizontal: spacing.sm,
          zIndex: 15,
        }}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.sm }}
          >
            {teamMembers.map((member) => {
              const activityColor = getActivityColor(member.activityStatus);
              const firstName = member.user?.firstName || 'Unknown';
              const isWorking = member.activityStatus === 'working';
              const isDriving = member.activityStatus === 'driving';
              const isOnline = member.activityStatus === 'online';
              const speed = member.lastLocation?.speed;
              
              return (
                <PressableRow
                  key={member.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.xs + 2,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs + 2,
                    backgroundColor: colors.card,
                    borderRadius: 20,
                    shadowColor: colors.shadow,
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.12,
                    shadowRadius: 3,
                    elevation: 3,
                  }}
                  onPress={() => handleWorkerTap(member)}
                >
                  {/* Compact avatar with activity dot */}
                  <View style={{ position: 'relative' }}>
                    <TeamAvatar
                      firstName={member.user?.firstName}
                      lastName={member.user?.lastName}
                      userId={String(member.userId || member.id)}
                      themeColor={member.themeColor}
                      size={30}
                    />
                    {/* Activity indicator dot */}
                    <View style={{
                      position: 'absolute',
                      bottom: -1,
                      right: -1,
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: activityColor,
                      borderWidth: 1.5,
                      borderColor: colors.card,
                    }} />
                  </View>
                  <View>
                    <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.foreground }} numberOfLines={1}>
                      {firstName}
                    </Text>
                    <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, fontWeight: fontWeights.medium }}>
                      {isDriving && speed && speed > 0
                        ? `${Math.round(speed * 3.6)} km/h`
                        : isWorking 
                          ? 'Working' 
                          : formatLastSeen(member.lastLocation?.timestamp)}
                    </Text>
                  </View>
                </PressableRow>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Loading Overlay - shows until initial data is loaded */}
      {!initialDataLoaded && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10,
        }}>
          <View style={{ alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{
              marginTop: spacing.lg,
              fontSize: typography.subtitle.fontSize,
              fontWeight: fontWeights.semibold,
              color: colors.foreground,
            }}>
              Loading team...
            </Text>
          </View>
        </View>
      )}

      {/* Assignment Confirmation Modal */}
      <Modal
        visible={!!pendingAssignment}
        transparent
        animationType="fade"
        onRequestClose={cancelAssignment}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign Job?</Text>
            <Text style={styles.modalText}>
              Assign{' '}
              <Text style={styles.modalHighlight}>{pendingAssignment?.job.title}</Text>
              {'\n'}to{' '}
              <Text style={styles.modalHighlight}>
                {pendingAssignment?.worker.user?.firstName} {pendingAssignment?.worker.user?.lastName}
              </Text>
              ?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={cancelAssignment}
                disabled={isAssigning}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextCancel]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={confirmAssignment}
                disabled={isAssigning}
                activeOpacity={0.7}
              >
                {isAssigning ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>Assign</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Job Action Sheet Modal */}
      <Modal
        visible={showJobActionSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowJobActionSheet(false)}
      >
        <TouchableOpacity 
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
          activeOpacity={1}
          onPress={() => setShowJobActionSheet(false)}
        >
          <View style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: radius['2xl'],
            borderTopRightRadius: radius['2xl'],
            padding: spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
            ...shadows.xl,
          }}>
            {/* Handle bar */}
            <View style={{
              width: 40,
              height: 4,
              backgroundColor: colors.border,
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: spacing.lg,
            }} />
            
            {/* Job Info Header */}
            {selectedJob && (
              <View style={{
                marginBottom: spacing.lg,
                paddingBottom: spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}>
                <Text style={{
                  fontSize: typography.sizes.lg,
                  fontWeight: fontWeights.bold,
                  color: colors.foreground,
                  marginBottom: spacing.xs,
                }}>
                  {selectedJob.title}
                </Text>
                {selectedJob.clientName && (
                  <Text style={{
                    fontSize: typography.button.fontSize,
                    color: colors.mutedForeground,
                    marginBottom: spacing.xs,
                  }}>
                    {selectedJob.clientName}
                  </Text>
                )}
                {selectedJob.address && (
                  <Text style={{
                    fontSize: typography.sizes.sm,
                    color: colors.mutedForeground,
                  }} numberOfLines={2}>
                    {selectedJob.address}
                  </Text>
                )}
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: spacing.sm,
                  gap: spacing.sm,
                }}>
                  <View style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs,
                    borderRadius: radius.sm,
                    backgroundColor: getMarkerColor(selectedJob.status),
                  }}>
                    <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: colors.white }}>
                      {STATUS_LABELS[selectedJob.status]}
                    </Text>
                  </View>
                  {isJobInRoute(selectedJob.id) && (
                    <View style={{
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs,
                      borderRadius: radius.sm,
                      backgroundColor: colors.primary,
                    }}>
                      <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: colors.primaryForeground }}>
                        In Route
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
            
            {/* Action Buttons */}
            <View style={{ gap: spacing.sm }}>
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.muted,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  gap: spacing.md,
                }}
                onPress={handleViewJob}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Feather name="file-text" size={20} color={colors.primaryForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                    View Job
                  </Text>
                  <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground }}>
                    See full job details and journey
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.muted,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  gap: spacing.md,
                  opacity: selectedJob && isJobInRoute(selectedJob.id) ? 0.5 : 1,
                }}
                onPress={handleAddToRoute}
                activeOpacity={0.7}
                disabled={selectedJob ? isJobInRoute(selectedJob.id) : false}
              >
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: colors.success,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Feather name="plus-circle" size={20} color={colors.successForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                    {selectedJob && isJobInRoute(selectedJob.id) ? 'Already in Route' : 'Add to Route'}
                  </Text>
                  <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground }}>
                    Plan multi-stop navigation
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.muted,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  gap: spacing.md,
                }}
                onPress={handleGetDirections}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  backgroundColor: colors.info,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Feather name="navigation" size={20} color={colors.infoForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                    Get Directions
                  </Text>
                  <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground }}>
                    Open in Maps app
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            
            {/* Cancel Button */}
            <TouchableOpacity
              style={{
                alignItems: 'center',
                padding: spacing.md,
                marginTop: spacing.md,
              }}
              onPress={() => setShowJobActionSheet(false)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.semibold, color: colors.mutedForeground }}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Route Panel (Bottom Sheet) - Matches header card design */}
      {routeJobs.length > 0 && (
        <View style={{
          position: 'absolute',
          left: spacing.md,
          right: spacing.md,
          bottom: bottomNavHeight + spacing.sm,
          backgroundColor: colors.card,
          borderRadius: radius['2xl'],
          maxHeight: showRoutePanel ? SCREEN_HEIGHT * 0.45 : 56,
          ...shadows.lg,
          borderWidth: 1,
          borderColor: colors.border,
          zIndex: 18,
        }}>
          {/* Collapsed Header - Matches header card style */}
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: spacing.md,
            }}
            onPress={() => setShowRoutePanel(!showRoutePanel)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: radius.lg,
                backgroundColor: colors.primaryLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Feather name="navigation" size={18} color={colors.primary} />
              </View>
              <View>
                <Text style={{ fontSize: typography.sizes.md, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                  Route: {routeJobs.length} stop{routeJobs.length !== 1 ? 's' : ''}
                </Text>
                <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground }}>
                  {routeTotals
                    ? `${routeTotals.minutes} min · ${routeTotals.km.toFixed(1)} km`
                    : `Tap to ${showRoutePanel ? 'collapse' : 'expand'}`}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <TouchableOpacity
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.lg,
                }}
                onPress={handleStartRoute}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.primaryForeground }}>Start</Text>
              </TouchableOpacity>
              <View style={{
                width: 32,
                height: 32,
                borderRadius: radius.lg,
                backgroundColor: colors.muted,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Feather 
                  name={showRoutePanel ? "chevron-down" : "chevron-up"} 
                  size={18} 
                  color={colors.mutedForeground} 
                />
              </View>
            </View>
          </TouchableOpacity>
          
          {/* Expanded Content */}
          {showRoutePanel && (
            <View style={{ flex: 1 }}>
              {/* Subtle divider */}
              <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md }} />
              <ScrollView 
                style={{ flex: 1, padding: spacing.md, paddingTop: spacing.sm }}
                showsVerticalScrollIndicator={false}
              >
                {routeJobs.map((job, index) => {
                  const leg = routeGeometry?.legs?.[index];
                  return (
                  <View key={job.id}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.muted,
                        padding: spacing.sm,
                        borderRadius: radius.md,
                        marginBottom: spacing.sm,
                        gap: spacing.sm,
                      }}
                    >
                      <View style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: colors.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.bold, color: colors.primaryForeground }}>
                          {index + 1}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.medium, color: colors.foreground }} numberOfLines={1}>
                          {job.title}
                        </Text>
                        {job.address && (
                          <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }} numberOfLines={1}>
                            {job.address}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRemoveFromRoute(job.id)}
                        style={{ padding: spacing.xs }}
                        activeOpacity={0.7}
                      >
                        <Feather name="x" size={18} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                    {index < routeJobs.length - 1 && leg && (
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.xs,
                        paddingLeft: spacing.md + 2,
                        marginTop: -spacing.xs,
                        marginBottom: spacing.sm,
                      }}>
                        <Feather name="corner-down-right" size={12} color={colors.mutedForeground} />
                        <Feather name="clock" size={11} color={colors.mutedForeground} />
                        <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.medium, color: colors.mutedForeground }}>
                          {leg.durationMinutes} min
                        </Text>
                        {typeof leg.distanceKm === 'number' && (
                          <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>
                            · {leg.distanceKm.toFixed(1)} km
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                  );
                })}
              </ScrollView>
              
              {/* Route Actions - Compact button row */}
              <View style={{
                flexDirection: 'row',
                gap: spacing.sm,
                padding: spacing.md,
                paddingTop: spacing.sm,
              }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.muted,
                    paddingVertical: spacing.sm + 2,
                    borderRadius: radius.lg,
                    gap: spacing.xs,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  onPress={handleClearRoute}
                  activeOpacity={0.7}
                >
                  <Feather name="trash-2" size={14} color={colors.destructive} />
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.destructive }}>
                    Clear
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.muted,
                    paddingVertical: spacing.sm + 2,
                    borderRadius: radius.lg,
                    gap: spacing.xs,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: (isOptimizing || routeJobs.length < 2) ? 0.5 : 1,
                  }}
                  onPress={handleOptimizeRoute}
                  disabled={isOptimizing || routeJobs.length < 2}
                  activeOpacity={0.7}
                >
                  {isOptimizing ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Feather name="zap" size={14} color={colors.primary} />
                      <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.primary }}>
                        Optimize
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={{
                    flex: 1.2,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.primary,
                    paddingVertical: spacing.sm + 2,
                    borderRadius: radius.lg,
                    gap: spacing.xs,
                  }}
                  onPress={handleStartRoute}
                  activeOpacity={0.7}
                >
                  <Feather name="navigation" size={14} color={colors.primaryForeground} />
                  <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, color: colors.primaryForeground }}>
                    Start
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
