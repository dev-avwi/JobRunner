import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
import L from "leaflet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAppMode } from "@/hooks/use-app-mode";
import { useTheme } from "@/components/ThemeProvider";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useLocationSocket } from "@/hooks/use-location-socket";
import { 
  MapPin, 
  Navigation, 
  Phone, 
  Calendar, 
  User, 
  Briefcase,
  RefreshCw,
  Filter,
  Users,
  MessageSquare,
  ExternalLink,
  AlertCircle,
  AlertTriangle,
  Map as MapIcon,
  Battery,
  BatteryCharging,
  BatteryLow,
  Car,
  Wrench,
  Clock,
  Gauge,
  Bell,
  X,
  Zap,
  ChevronDown,
  ChevronUp,
  ArrowDown,
  Navigation2,
  Wifi,
  WifiOff,
  Eye,
  FileText,
  CheckCircle2,
  CalendarCheck,
  Play,
  ArrowRight,
  Plus,
  Check,
  Save,
  FolderOpen,
  Trash2,
  Search
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import "leaflet/dist/leaflet.css";
import { getInitials, getAvatarColor } from "@/lib/avatar";
import { UserAvatar } from "@/components/UserAvatar";

interface JobMapData {
  id: string;
  title: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  scheduledAt: string | null;
  assignedTo: string | null;
  clientName: string;
  clientPhone?: string;
}

interface TeamMemberLocation {
  id: string;
  name: string;
  email: string;
  profileImageUrl?: string | null;
  themeColor?: string | null;
  latitude: number;
  longitude: number;
  lastSeenAt?: string;
  activityStatus: 'online' | 'driving' | 'working' | 'offline' | 'idle';
  isActive: boolean;
  isDriving: boolean;
  speed: number;
  heading?: number | null;
  batteryLevel?: number | null;
  isCharging?: boolean;
  currentJobId?: string;
  currentJobTitle?: string;
  currentAddress?: string | null;
}

interface GeofenceAlert {
  id: string;
  userId: string;
  jobId: string;
  userName: string;
  userAvatar?: string | null;
  jobTitle: string;
  alertType: 'arrival' | 'departure' | 'late' | 'speed_warning';
  address?: string | null;
  createdAt: string;
  isRead: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#6B7280",
  scheduled: "#3B82F6",
  in_progress: "#F59E0B",
  done: "#10B981",
  invoiced: "#8B5CF6",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  done: "Completed",
  invoiced: "Invoiced",
};

const ACTIVITY_COLORS = {
  online: '#22C55E',
  driving: '#3B82F6',
  working: '#F59E0B',
  idle: '#6B7280',
  offline: '#4B5563',
};

function getJobStatusIcon(status: string): string {
  switch (status) {
    case 'pending':
      return `<svg style="transform: rotate(45deg); width: 16px; height: 16px;" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>`;
    case 'scheduled':
      return `<svg style="transform: rotate(45deg); width: 16px; height: 16px;" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>`;
    case 'in_progress':
      return `<svg style="transform: rotate(45deg); width: 16px; height: 16px;" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>`;
    case 'done':
      return `<svg style="transform: rotate(45deg); width: 16px; height: 16px;" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>`;
    case 'invoiced':
      return `<svg style="transform: rotate(45deg); width: 16px; height: 16px;" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>`;
    default:
      return `<svg style="transform: rotate(45deg); width: 16px; height: 16px;" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>`;
  }
}

function createJobIcon(status: string, isDark: boolean) {
  const color = STATUS_COLORS[status] || '#6B7280';
  const borderColor = isDark ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,1)';
  const shadowColor = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)';
  const glowColor = color + '60';
  
  return L.divIcon({
    className: 'custom-job-marker',
    html: `
      <div style="
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%);
        border: 3px solid ${borderColor};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 16px ${shadowColor}, 0 0 20px ${glowColor};
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        ${getJobStatusIcon(status)}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });
}

function createTeamMemberIcon(member: TeamMemberLocation, isDark: boolean) {
  const initials = getInitials(member.name, member.email);
  
  // Identity colour stays constant regardless of work status (themeColor wins,
  // else deterministic by stable id). Live status shows on the activity dot only.
  const memberColor = getAvatarColor(member.id, member.themeColor);
  
  const activityColor = member.isActive 
    ? (member.isDriving ? ACTIVITY_COLORS.driving : member.activityStatus === 'working' ? ACTIVITY_COLORS.working : ACTIVITY_COLORS.online)
    : ACTIVITY_COLORS.offline;
  
  const borderColor = isDark ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,1)';
  const shadowColor = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.25)';
  
  const pulseAnimation = member.isActive ? `
    <div style="
      position: absolute;
      width: 48px;
      height: 48px;
      top: -4px;
      left: -4px;
      border-radius: 50%;
      background: ${memberColor};
      opacity: 0.3;
      animation: life360-pulse 2s ease-out infinite;
    "></div>
  ` : '';
  
  const activityDot = `
    <div style="
      position: absolute;
      top: -1px;
      left: -1px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: ${activityColor};
      border: 2px solid ${borderColor};
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    "></div>
  `;
  
  const batteryIndicator = member.batteryLevel !== null && member.batteryLevel !== undefined && member.batteryLevel <= 30 ? `
    <div style="
      position: absolute;
      top: -4px;
      right: -4px;
      background: ${member.batteryLevel <= 20 ? '#EF4444' : '#F59E0B'};
      border-radius: 50%;
      width: 14px;
      height: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid ${borderColor};
    ">
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
        <rect x="2" y="7" width="18" height="10" rx="2"/>
        <line x1="22" y1="11" x2="22" y2="13"/>
      </svg>
    </div>
  ` : '';
  
  const speedBadge = member.isDriving && member.speed > 0 ? `
    <div style="
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      background: ${memberColor};
      color: white;
      font-size: 8px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 8px;
      white-space: nowrap;
      border: 2px solid ${borderColor};
    ">
      ${Math.round(member.speed)} km/h
    </div>
  ` : '';

  const headingArrow = member.isDriving && member.heading !== null && member.heading !== undefined ? `
    <div style="
      position: absolute;
      top: -14px;
      left: 50%;
      transform: translateX(-50%) rotate(${member.heading}deg);
      transform-origin: center bottom;
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-bottom: 10px solid ${memberColor};
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
    "></div>
  ` : '';
  
  const avatarContent = member.profileImageUrl 
    ? `background-image: url('${member.profileImageUrl}'); background-size: cover; background-position: center;`
    : `background: linear-gradient(135deg, ${memberColor} 0%, ${memberColor}dd 100%);`;
  
  return L.divIcon({
    className: 'custom-team-marker',
    html: `
      <div style="position: relative; width: 40px; height: 40px;">
        ${pulseAnimation}
        <div style="
          position: relative;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 3px solid ${memberColor};
          box-shadow: 0 3px 15px ${shadowColor}, 0 0 20px ${memberColor}40;
          ${avatarContent}
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 14px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          letter-spacing: 0.5px;
        ">
          ${!member.profileImageUrl ? initials : ''}
        </div>
        ${activityDot}
        ${batteryIndicator}
        ${speedBadge}
        ${headingArrow}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
  });
}

function FitBoundsController({ 
  jobs, 
  teamLocations,
  showTeamMembers 
}: { 
  jobs: JobMapData[], 
  teamLocations: TeamMemberLocation[],
  showTeamMembers: boolean 
}) {
  const map = useMap();
  const hasFittedRef = useRef(false);
  
  useEffect(() => {
    if (hasFittedRef.current) return;
    
    const allPoints: [number, number][] = [];
    
    jobs.forEach(job => {
      if (job.latitude && job.longitude) {
        allPoints.push([job.latitude, job.longitude]);
      }
    });
    
    if (showTeamMembers) {
      teamLocations.forEach(member => {
        allPoints.push([member.latitude, member.longitude]);
      });
    }
    
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      hasFittedRef.current = true;
    }
  }, [map, jobs, teamLocations, showTeamMembers]);
  
  return null;
}

function FlyToSearchedJob({ 
  job, 
  onComplete 
}: { 
  job: JobMapData | null;
  onComplete?: () => void;
}) {
  const map = useMap();
  const hasFlownRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!job || !job.latitude || !job.longitude) return;
    
    // Avoid flying to the same job multiple times
    if (hasFlownRef.current === job.id) return;
    hasFlownRef.current = job.id;
    
    map.flyTo([job.latitude, job.longitude], 17, {
      duration: 1.0,
    });
    
    setTimeout(() => {
      onComplete?.();
    }, 1050);
  }, [job, map, onComplete]);
  
  // Reset when job is cleared
  useEffect(() => {
    if (!job) {
      hasFlownRef.current = null;
    }
  }, [job]);
  
  return null;
}

function FlyToClickedJob({
  position,
  onComplete,
}: {
  position: { lat: number; lng: number; id: string } | null;
  onComplete?: () => void;
}) {
  const map = useMap();
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!position) {
      lastIdRef.current = null;
      return;
    }
    if (lastIdRef.current === position.id) return;
    lastIdRef.current = position.id;

    const currentZoom = map.getZoom();
    const targetZoom = Math.max(currentZoom, 16);

    map.flyTo([position.lat, position.lng], targetZoom, {
      duration: 0.6,
    });

    setTimeout(() => {
      onComplete?.();
    }, 650);
  }, [position, map, onComplete]);

  return null;
}

function FlyToTeamMember({ 
  selectedId, 
  teamLocations,
  markersRef,
  onComplete 
}: { 
  selectedId: string | null, 
  teamLocations: TeamMemberLocation[],
  markersRef: React.MutableRefObject<Map<string, L.Marker>>,
  onComplete?: () => void
}) {
  const map = useMap();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    // Clear any pending timeout when selection changes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (!selectedId) return;
    
    const member = teamLocations.find(m => m.id === selectedId);
    if (!member) return;
    
    // Capture the current selection for the timeout callback
    const currentSelectionId = selectedId;
    
    // Fly to the team member's location
    map.flyTo([member.latitude, member.longitude], 16, {
      duration: 0.8,
    });
    
    // Open the popup after flying
    timeoutRef.current = setTimeout(() => {
      const marker = markersRef.current.get(currentSelectionId);
      if (marker) {
        marker.openPopup();
      }
      onComplete?.();
    }, 850);
    
    // Cleanup on unmount or when selectedId changes
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [selectedId, teamLocations, map, markersRef, onComplete]);
  
  return null;
}

function AccessDeniedMessage() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background z-[5]">
      <Card className="max-w-md mx-4">
        <CardContent className="py-8 px-6 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
          <h3 className="font-semibold text-lg mb-2">Access Restricted</h3>
          <p className="text-muted-foreground mb-4">
            The Job Map is only available to business owners and managers.
          </p>
          <Button onClick={() => window.location.href = '/'}>
            Return to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function JobMapPage() {
  const { isTeam, isOwner, isManager } = useAppMode();
  const canAccessMap = isOwner || isManager;

  if (!canAccessMap) {
    return <AccessDeniedMessage />;
  }

  return <FullScreenMap isTeam={isTeam} isOwner={isOwner} isManager={isManager} />;
}

interface RouteJob {
  jobId: string;
  title: string;
  clientName: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  // Per-leg drive time (min) / distance (km) from the previous stop, carried
  // over from the schedule planner so the map can show real leg estimates.
  travelTime?: number;
  travelDistance?: number;
}

interface RouteGeometryLeg {
  durationMinutes: number;
  distanceKm: number;
}

interface RouteGeometryResponse {
  coordinates: Array<[number, number]>;
  legs: RouteGeometryLeg[];
  source: 'osrm';
}

function FullScreenMap({ isTeam, isOwner, isManager }: { isTeam: boolean; isOwner: boolean; isManager: boolean }) {
  const { theme } = useTheme();
  // Handle 'system' theme by checking actual system preference
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showTeamMembers, setShowTeamMembers] = useState(true);
  const [showJobs, setShowJobs] = useState(true);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [jobSearch, setJobSearch] = useState("");
  const [showJobSearchResults, setShowJobSearchResults] = useState(false);
  const [selectedSearchJob, setSelectedSearchJob] = useState<JobMapData | null>(null);
  const [clickedJobPosition, setClickedJobPosition] = useState<{ lat: number; lng: number; id: string } | null>(null);
  
  // Selected team member - when clicking a chip, fly to this member and show their info
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<string | null>(null);
  const teamMemberMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  
  // Worker assignment mode - when a worker is selected, show jobs to assign
  const [selectedWorkerForAssignment, setSelectedWorkerForAssignment] = useState<TeamMemberLocation | null>(null);
  // Use refs for synchronous operations (avoids race conditions from batched state updates)
  const assignmentVisibilityRef = useRef<{ showTeam: boolean; showJobs: boolean } | null>(null);
  const isEnteringAssignmentRef = useRef(false); // Prevents rapid double-click from re-entering
  
  // Route planning state from URL params
  const [routeJobs, setRouteJobs] = useState<RouteJob[]>([]);
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [routeParsed, setRouteParsed] = useState(false);
  // Real road geometry (OSRM) for the current route; null until fetched / on failure.
  const [roadGeometry, setRoadGeometry] = useState<RouteGeometryResponse | null>(null);

  const defaultCenter: [number, number] = [-16.9186, 145.7781];
  const defaultZoom = 11;

  // Data queries - define before useEffects that use them
  const { data: jobsData = [], isLoading: jobsLoading, refetch: refetchJobs } = useQuery<JobMapData[]>({
    queryKey: ["/api/map/jobs"],
  });
  
  // Parse route from URL params once when data is available
  useEffect(() => {
    if (routeParsed) return; // Only parse once
    
    const urlParams = new URLSearchParams(window.location.search);
    const routeParam = urlParams.get('route');
    if (routeParam && jobsData.length > 0) {
      try {
        const parsedRoute = JSON.parse(decodeURIComponent(routeParam)) as RouteJob[];
        if (Array.isArray(parsedRoute) && parsedRoute.length > 0) {
          setRouteJobs(parsedRoute);
          setShowRoutePanel(true);
          setRouteParsed(true);
        }
      } catch (e) {
        console.error('Failed to parse route param:', e);
      }
    }
  }, [jobsData, routeParsed]);

  // Compute enriched route jobs with coordinates from loaded job data
  // This updates whenever routeJobs or jobsData changes
  const enrichedRouteJobs = useMemo(() => {
    if (routeJobs.length === 0 || jobsData.length === 0) return routeJobs;
    
    return routeJobs.map(routeJob => {
      const fullJob = jobsData.find(j => String(j.id) === String(routeJob.jobId));
      if (fullJob) {
        return {
          ...routeJob,
          address: routeJob.address || fullJob.address || undefined,
          latitude: fullJob.latitude || undefined,
          longitude: fullJob.longitude || undefined,
        };
      }
      return routeJob;
    });
  }, [routeJobs, jobsData]);

  // Compute validation warning based on current enriched route jobs
  const routeValidationWarning = useMemo(() => {
    const jobsMissingAddresses = enrichedRouteJobs.filter(j => !j.address);
    if (jobsMissingAddresses.length > 0) {
      return `${jobsMissingAddresses.length} job(s) missing addresses`;
    }
    return null;
  }, [enrichedRouteJobs]);

  const { data: teamLocations = [], isLoading: teamLoading, refetch: refetchTeam } = useQuery<TeamMemberLocation[]>({
    queryKey: ["/api/map/team-locations"],
    enabled: isTeam,
  });

  const { data: geofenceAlerts = [], refetch: refetchAlerts } = useQuery<GeofenceAlert[]>({
    queryKey: ["/api/map/geofence-alerts"],
    enabled: isTeam,
  });

  const { data: currentUser } = useQuery<any>({
    queryKey: ["/api/auth/me"],
  });

  const [liveLocationOverrides, setLiveLocationOverrides] = useState<Map<string, { latitude: number; longitude: number; speed: number; heading: number | null; batteryLevel: number | null; isCharging: boolean; activityStatus: string; timestamp: number }>>(new Map());

  const { isConnected: locationSocketConnected } = useLocationSocket({
    userId: currentUser?.id || '',
    businessId: currentUser?.businessId || '',
    isTradie: false,
    enabled: isTeam && !!currentUser?.id && !!currentUser?.businessId,
    onLocationUpdate: useCallback((update: any) => {
      setLiveLocationOverrides(prev => {
        const next = new Map(prev);
        next.set(update.userId, {
          latitude: update.latitude,
          longitude: update.longitude,
          speed: update.speed || 0,
          heading: update.heading ?? null,
          batteryLevel: update.batteryLevel ?? null,
          isCharging: update.isCharging || false,
          activityStatus: update.activityStatus || 'online',
          timestamp: update.timestamp,
        });
        return next;
      });
    }, []),
  });

  const mergedTeamLocations = useMemo(() => {
    return teamLocations.map(member => {
      const override = liveLocationOverrides.get(member.id);
      if (override) {
        return {
          ...member,
          latitude: override.latitude,
          longitude: override.longitude,
          speed: override.speed,
          heading: override.heading,
          batteryLevel: override.batteryLevel !== null ? override.batteryLevel : member.batteryLevel,
          isCharging: override.isCharging,
          activityStatus: override.activityStatus as any,
          isDriving: override.activityStatus === 'driving' || override.speed > 5,
          isActive: true,
        };
      }
      return member;
    });
  }, [teamLocations, liveLocationOverrides]);

  useEffect(() => {
    if (teamLocations.length > 0) {
      setLiveLocationOverrides(prev => {
        if (prev.size === 0) return prev;
        const now = Date.now();
        const next = new Map(prev);
        let changed = false;
        next.forEach((val, key) => {
          if (now - val.timestamp > 60000) {
            next.delete(key);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [teamLocations]);
  
  // Saved routes state and queries
  const [showSavedRoutes, setShowSavedRoutes] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  interface SavedRoute {
    id: string;
    name: string;
    jobIds: string[];
    createdAt: string;
    status: string;
  }
  
  const { data: savedRoutes = [], refetch: refetchSavedRoutes } = useQuery<SavedRoute[]>({
    queryKey: ["/api/saved-routes"],
  });
  
  // Save route mutation
  const saveRouteMutation = useMutation({
    mutationFn: async (name: string) => {
      const jobIds = routeJobs.map(j => j.jobId);
      return apiRequest('POST', '/api/saved-routes', { name, jobIds });
    },
    onSuccess: () => {
      setIsSaving(false);
      setRouteName("");
      refetchSavedRoutes();
    },
    onError: () => {
      setIsSaving(false);
    }
  });
  
  // Delete route mutation
  const deleteRouteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/saved-routes/${id}`);
    },
    onSuccess: () => {
      refetchSavedRoutes();
    },
  });

  // Optimize route mutation
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [routeStats, setRouteStats] = useState<{ totalDistance: number; estimatedDuration: number } | null>(null);
  
  const optimizeRouteMutation = useMutation({
    mutationFn: async () => {
      const jobIds = routeJobs.map(j => j.jobId);
      const response = await fetch('/api/routes/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobIds }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to optimize route');
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      setIsOptimizing(false);
      // Reorder route jobs based on optimized order
      const optimizedOrder = data.optimizedOrder as string[];
      const reorderedJobs = optimizedOrder.map(id => 
        routeJobs.find(j => j.jobId === id)
      ).filter(Boolean) as RouteJob[];
      setRouteJobs(reorderedJobs);
      setRouteStats({ totalDistance: data.totalDistance, estimatedDuration: data.estimatedDuration });
      toast({
        title: "Route Optimized",
        description: "Jobs reordered for shortest travel distance",
      });
    },
    onError: (error: Error) => {
      setIsOptimizing(false);
      toast({
        title: "Could not optimize route",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    }
  });

  const handleOptimizeRoute = () => {
    // Guard: need at least 2 stops to optimize
    if (routeJobs.length < 2) {
      toast({
        title: "Not enough stops",
        description: "Add at least 2 jobs to optimize the route",
        variant: "destructive",
      });
      return;
    }
    // Guard: need at least 2 stops with coordinates
    const jobsWithCoords = routeJobs.filter(j => {
      const enriched = enrichedRouteJobs.find(ej => ej.jobId === j.jobId);
      return enriched?.latitude && enriched?.longitude;
    });
    if (jobsWithCoords.length < 2) {
      toast({
        title: "Cannot optimize route",
        description: "At least 2 jobs need valid addresses to optimize",
        variant: "destructive",
      });
      return;
    }
    setIsOptimizing(true);
    optimizeRouteMutation.mutate();
  };
  
  // Load a saved route
  const loadSavedRoute = (savedRoute: SavedRoute) => {
    const loadedRouteJobs: RouteJob[] = (savedRoute.jobIds || []).map(jobId => {
      const job = jobsData.find(j => String(j.id) === String(jobId));
      return {
        jobId: String(jobId),
        title: job?.title || 'Unknown Job',
        clientName: job?.clientName || 'Unknown Client',
        address: job?.address,
        latitude: job?.latitude ?? undefined,
        longitude: job?.longitude ?? undefined,
      };
    }).filter(j => j.title !== 'Unknown Job'); // Filter out jobs that no longer exist
    
    if (loadedRouteJobs.length > 0) {
      setRouteJobs(loadedRouteJobs);
      setShowRoutePanel(true);
      setShowSavedRoutes(false);
    }
  };
  
  // Handle save route
  const handleSaveRoute = () => {
    if (!routeName.trim() || routeJobs.length === 0) return;
    setIsSaving(true);
    saveRouteMutation.mutate(routeName.trim());
  };
  
  const markAlertReadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      await apiRequest("POST", `/api/map/geofence-alerts/${alertId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/map/geofence-alerts"] });
    },
  });

  // Centralized exit from assignment mode - restores visibility state (idempotent)
  const exitAssignmentMode = useCallback(() => {
    // Clear the entering flag
    isEnteringAssignmentRef.current = false;
    
    setSelectedWorkerForAssignment(null);
    // Restore previous visibility state from ref
    if (assignmentVisibilityRef.current) {
      setShowTeamMembers(assignmentVisibilityRef.current.showTeam);
      setShowJobs(assignmentVisibilityRef.current.showJobs);
      assignmentVisibilityRef.current = null;
    } else {
      setShowTeamMembers(true);
    }
  }, []);

  // Assign job to worker mutation
  const assignJobToWorkerMutation = useMutation({
    mutationFn: async ({ jobId, userId }: { jobId: string; userId: string }) => {
      return apiRequest('PATCH', `/api/jobs/${jobId}`, { assignedTo: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/map/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: "Job assigned successfully" });
      exitAssignmentMode();
    },
    onError: (error: any) => {
      toast({ title: "Failed to assign job", description: error.message, variant: "destructive" });
    },
  });

  // Enter worker assignment mode - save current state and show only jobs
  const enterWorkerAssignmentMode = useCallback((worker: TeamMemberLocation) => {
    // Synchronous guard: prevent rapid double-clicks from re-entering
    if (isEnteringAssignmentRef.current) return;
    isEnteringAssignmentRef.current = true;
    
    // Capture current visibility state synchronously before any state updates
    // Only capture if we haven't already (prevents overwriting on race conditions)
    if (!assignmentVisibilityRef.current) {
      assignmentVisibilityRef.current = { showTeam: showTeamMembers, showJobs: showJobs };
    }
    setSelectedWorkerForAssignment(worker);
    setShowTeamMembers(false); // Hide workers during assignment
    setShowJobs(true); // Ensure jobs are visible for selection
  }, [showTeamMembers, showJobs]);

  // Cancel worker assignment mode - calls centralized exit
  const cancelWorkerAssignment = useCallback(() => {
    exitAssignmentMode();
  }, [exitAssignmentMode]);

  // Assign selected worker to a job
  const assignWorkerToJob = (jobId: string) => {
    if (!selectedWorkerForAssignment) return;
    assignJobToWorkerMutation.mutate({ 
      jobId, 
      userId: selectedWorkerForAssignment.id 
    });
  };
  
  const unreadAlerts = useMemo(() => {
    return geofenceAlerts.filter(a => !a.isRead);
  }, [geofenceAlerts]);

  const filteredJobs = useMemo(() => {
    if (statusFilter === "all") return jobsData;
    return jobsData.filter(job => job.status === statusFilter);
  }, [jobsData, statusFilter]);

  const jobsWithCoords = useMemo(() => {
    return filteredJobs.filter(job => job.latitude && job.longitude);
  }, [filteredJobs]);

  // Job search results - filter by title, client name, or address (only jobs with coordinates)
  const jobSearchResults = useMemo(() => {
    if (!jobSearch.trim()) return [];
    const searchLower = jobSearch.toLowerCase();
    return jobsData
      .filter(job => 
        job.latitude && job.longitude && (
          job.title.toLowerCase().includes(searchLower) ||
          job.clientName?.toLowerCase().includes(searchLower) ||
          job.address?.toLowerCase().includes(searchLower)
        )
      )
      .slice(0, 8); // Limit to 8 results
  }, [jobsData, jobSearch]);

  // Compute route polyline coordinates from enriched route jobs
  const routeCoordinates = useMemo(() => {
    return enrichedRouteJobs
      .filter(job => job.latitude && job.longitude)
      .map(job => [job.latitude!, job.longitude!] as [number, number]);
  }, [enrichedRouteJobs]);

  // Check how many jobs have valid coordinates for route display
  const routeJobsWithCoords = useMemo(() => {
    return enrichedRouteJobs.filter(job => job.latitude && job.longitude);
  }, [enrichedRouteJobs]);

  // Check how many jobs have valid addresses for Google Maps routing
  const routeJobsWithAddresses = useMemo(() => {
    return enrichedRouteJobs.filter(job => job.address);
  }, [enrichedRouteJobs]);

  // Stable signature of the route stop coordinates, so we only refetch the road
  // geometry when the actual stops (or their order) change.
  const routeCoordsKey = useMemo(
    () => routeCoordinates.map(([lat, lng]) => `${lat},${lng}`).join('|'),
    [routeCoordinates]
  );

  // Per-stop leg info (drive from the previous stop), aligned to enrichedRouteJobs.
  // Prefers real OSRM road legs from the fetched geometry; falls back to the
  // per-leg estimates carried over from the schedule planner.
  const routeLegInfo = useMemo(() => {
    const legsMatchStops =
      roadGeometry?.legs &&
      roadGeometry.legs.length === Math.max(0, routeJobsWithCoords.length - 1);

    let coordStopSeen = 0;
    return enrichedRouteJobs.map((job, index) => {
      const hasCoords = !!(job.latitude && job.longitude);
      if (hasCoords) coordStopSeen += 1;

      // Real road geometry leg (only when geometry legs line up with coord stops).
      if (legsMatchStops && hasCoords && coordStopSeen > 1) {
        const leg = roadGeometry!.legs[coordStopSeen - 2];
        if (leg) {
          return { minutes: leg.durationMinutes, km: leg.distanceKm };
        }
      }

      // Fallback: planner-provided per-leg estimate carried in the route param.
      if (index > 0 && typeof job.travelTime === 'number') {
        return {
          minutes: job.travelTime,
          km: typeof job.travelDistance === 'number' ? job.travelDistance : undefined,
        };
      }
      return null;
    });
  }, [enrichedRouteJobs, roadGeometry, routeJobsWithCoords.length]);

  // Fetch the real road geometry (OSRM) for the current route stops. Falls back
  // to straight-line segments (roadGeometry === null) if the request fails.
  useEffect(() => {
    if (!showRoutePanel || routeCoordinates.length < 2) {
      setRoadGeometry(null);
      return;
    }

    let cancelled = false;
    const stops = routeCoordinates.map(([lat, lng]) => ({ lat, lng }));

    (async () => {
      try {
        const res = await apiRequest('POST', '/api/routes/geometry', { stops });
        const data = (await res.json()) as RouteGeometryResponse;
        if (!cancelled && data?.coordinates?.length >= 2) {
          setRoadGeometry(data);
        } else if (!cancelled) {
          setRoadGeometry(null);
        }
      } catch {
        if (!cancelled) setRoadGeometry(null);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeCoordsKey, showRoutePanel]);

  // Sort team members: active members first, then by activity type (working > driving > online > offline)
  const sortedTeamLocations = useMemo(() => {
    return [...mergedTeamLocations].sort((a, b) => {
      // Active members first
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      
      // Within active members, prioritize by activity status
      if (a.isActive && b.isActive) {
        const activityPriority: Record<string, number> = {
          'working': 0,
          'driving': 1,
          'online': 2,
          'idle': 3,
          'offline': 4,
        };
        const aPriority = activityPriority[a.activityStatus] ?? 5;
        const bPriority = activityPriority[b.activityStatus] ?? 5;
        return aPriority - bPriority;
      }
      
      return 0;
    });
  }, [mergedTeamLocations]);

  const handleRefresh = () => {
    refetchJobs();
    if (isTeam) {
      refetchTeam();
      refetchAlerts();
    }
  };

  const isAppleDevice = /iPhone|iPad|iPod|Mac/i.test(navigator.userAgent);

  const navigateTo = (lat: number, lng: number) => {
    if (isAppleDevice) {
      const url = `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
      window.open(url, '_blank');
    } else {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      window.open(url, '_blank');
    }
  };

  const openMultiStopRoute = () => {
    if (enrichedRouteJobs.length === 0) return;

    const jobsWithAddress = enrichedRouteJobs.filter(job => job.address);
    if (jobsWithAddress.length === 0) return;

    if (isAppleDevice) {
      const addresses = jobsWithAddress.map(job => encodeURIComponent(job.address!));
      const appleMapsUrl = `https://maps.apple.com/?` + addresses.map((addr, i) => {
        if (i === 0) return `saddr=${addr}`;
        if (i === addresses.length - 1) return `daddr=${addr}`;
        return `daddr=${addr}`;
      }).join('&');

      if (addresses.length <= 2) {
        window.open(appleMapsUrl, '_blank');
      } else {
        const url = `https://maps.apple.com/?dirflg=d&saddr=${addresses[0]}&daddr=${addresses.slice(1).join('+to:')}`;
        window.open(url, '_blank');
      }
    } else {
      const addresses = jobsWithAddress.map(job => encodeURIComponent(job.address!));
      if (addresses.length === 1) {
        const url = `https://www.google.com/maps/dir/?api=1&destination=${addresses[0]}`;
        window.open(url, '_blank');
      } else {
        const origin = addresses[0];
        const destination = addresses[addresses.length - 1];
        const waypoints = addresses.slice(1, -1).join('|');
        let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
        if (waypoints) {
          url += `&waypoints=${waypoints}`;
        }
        window.open(url, '_blank');
      }
    }
  };
  
  const clearRoute = () => {
    setRouteJobs([]);
    setShowRoutePanel(false);
    setRouteParsed(false);
    // Clear URL params
    window.history.replaceState({}, '', window.location.pathname);
  };
  
  const removeFromRoute = (jobId: string) => {
    setRouteJobs(prev => {
      const newJobs = prev.filter(j => j.jobId !== jobId);
      // Auto-close panel if no jobs left
      if (newJobs.length === 0) {
        setShowRoutePanel(false);
        setRouteParsed(false);
        window.history.replaceState({}, '', window.location.pathname);
      }
      return newJobs;
    });
  };
  
  // Add a job to the current route
  const addJobToRoute = (job: JobMapData) => {
    const isAlreadyInRoute = routeJobs.some(r => r.jobId === job.id);
    if (isAlreadyInRoute) return;
    
    const routeJob: RouteJob = {
      jobId: job.id,
      title: job.title,
      clientName: job.clientName,
      address: job.address,
      latitude: job.latitude ? parseFloat(job.latitude.toString()) : undefined,
      longitude: job.longitude ? parseFloat(job.longitude.toString()) : undefined,
    };
    
    setRouteJobs(prev => [...prev, routeJob]);
    setShowRoutePanel(true);
  };
  
  // Check if a job is already in the route
  const isJobInRoute = (jobId: string) => {
    return routeJobs.some(r => r.jobId === jobId);
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleStartJob = (jobId: string) => {
    navigate(`/jobs/${jobId}`);
  };

  // Life360-style map tiles with theme adaptation
  // Using muted, uniform land colors with visible water distinction
  // Light mode: CartoDB Positron (tan/cream land, blue water - clean and professional)
  // Dark mode: CartoDB Dark Matter (dark theme with visible features)
  
  // For light mode: CartoDB Positron - muted cream/tan land, light blue water
  const lightTileUrl = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
  
  // For dark mode: CartoDB Dark Matter (dark theme with visible features)
  const darkTileUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  
  // Select based on theme
  const tileUrl = isDark ? darkTileUrl : lightTileUrl;

  if (jobsLoading) {
    return (
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-blue-500 to-blue-700">
          <div className="text-center text-white">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-blue-200">Loading map...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 relative overflow-hidden z-0" style={{ minHeight: 'calc(100vh - 64px)' }}>
      {/* Global styles for the map */}
      <style>{`
        @keyframes life360-pulse {
          0% {
            transform: scale(1);
            opacity: 0.4;
          }
          100% {
            transform: scale(1.8);
            opacity: 0;
          }
        }
        .custom-job-marker, .custom-team-marker {
          background: transparent !important;
          border: none !important;
        }
        .custom-team-marker {
          transition: transform 0.8s ease-out !important;
        }
        .custom-team-marker > div {
          transition: all 0.5s ease-out;
        }
        .leaflet-popup-content-wrapper {
          background: ${isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)'} !important;
          color: ${isDark ? '#ffffff' : '#1f2937'} !important;
          border-radius: 16px !important;
          box-shadow: 0 10px 40px ${isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.15)'} !important;
          backdrop-filter: blur(12px) !important;
        }
        .leaflet-popup-tip {
          background: ${isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)'} !important;
        }
        .leaflet-popup-close-button {
          color: ${isDark ? '#9ca3af' : '#6b7280'} !important;
        }
        .leaflet-popup-close-button:hover {
          color: ${isDark ? '#ffffff' : '#1f2937'} !important;
        }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 4px 20px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.15)'} !important;
          border-radius: 12px !important;
          overflow: hidden;
        }
        .leaflet-control-zoom a {
          background: ${isDark ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)'} !important;
          color: ${isDark ? '#ffffff' : '#1f2937'} !important;
          border: none !important;
          backdrop-filter: blur(8px) !important;
        }
        .leaflet-control-zoom a:hover {
          background: ${isDark ? 'rgba(55, 65, 81, 0.95)' : 'rgba(243, 244, 246, 0.95)'} !important;
        }
        .leaflet-control-attribution {
          background: ${isDark ? 'rgba(17, 24, 39, 0.7)' : 'rgba(255,255,255,0.7)'} !important;
          color: ${isDark ? '#9ca3af' : '#6b7280'} !important;
          backdrop-filter: blur(4px) !important;
          padding: 2px 8px !important;
          border-radius: 8px 0 0 0 !important;
        }
        .leaflet-control-attribution a {
          color: ${isDark ? '#60a5fa' : '#3b82f6'} !important;
        }
        /* Hide leaflet container outline */
        .leaflet-container {
          outline: none !important;
        }
        /* Life360-style gradient overlay - adds warmth and depth */
        .ocean-overlay {
          background: ${isDark 
            ? `linear-gradient(
                180deg, 
                rgba(15, 23, 42, 0.3) 0%,
                rgba(15, 23, 42, 0.15) 30%,
                transparent 60%,
                rgba(30, 64, 175, 0.08) 100%
              )`
            : `linear-gradient(
                180deg, 
                rgba(241, 245, 249, 0.4) 0%,
                rgba(241, 245, 249, 0.2) 20%,
                transparent 50%,
                rgba(59, 130, 246, 0.06) 100%
              )`
          };
          pointer-events: none;
        }
      `}</style>

      {/* Full-screen map that fills the page content area */}
      <div className="absolute inset-0">
        <MapContainer
          center={defaultCenter}
          zoom={defaultZoom}
          className="h-full w-full"
          zoomControl={false}
          attributionControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url={tileUrl}
            key={isDark ? 'dark' : 'light'}
          />
          
          <FitBoundsController 
            jobs={jobsWithCoords} 
            teamLocations={mergedTeamLocations}
            showTeamMembers={showTeamMembers}
          />
          
          <FlyToTeamMember
            selectedId={selectedTeamMemberId}
            teamLocations={mergedTeamLocations}
            markersRef={teamMemberMarkersRef}
            onComplete={() => setSelectedTeamMemberId(null)}
          />
          
          <FlyToSearchedJob
            job={selectedSearchJob}
            onComplete={() => {}}
          />
          
          <FlyToClickedJob
            position={clickedJobPosition}
            onComplete={() => setClickedJobPosition(null)}
          />
          
          {/* Route polyline - follow real roads (OSRM) when available, else
              fall back to dashed straight segments between stops */}
          {showRoutePanel && roadGeometry && roadGeometry.coordinates.length >= 2 && (
            <Polyline
              positions={roadGeometry.coordinates}
              pathOptions={{
                color: 'hsl(var(--trade))',
                weight: 5,
                opacity: 0.85,
              }}
            />
          )}
          {showRoutePanel && !roadGeometry && routeCoordinates.length >= 2 && (
            <Polyline
              positions={routeCoordinates}
              pathOptions={{
                color: 'hsl(var(--trade))',
                weight: 4,
                opacity: 0.8,
                dashArray: '10, 10',
              }}
            />
          )}
          
          {/* Route stop markers with numbered badges */}
          {showRoutePanel && routeJobsWithCoords.map((job, index) => (
            <Marker
              key={`route-${job.jobId}`}
              position={[job.latitude!, job.longitude!]}
              icon={L.divIcon({
                className: 'custom-route-marker',
                html: `
                  <div style="
                    width: 32px;
                    height: 32px;
                    background: hsl(var(--trade));
                    border: 3px solid white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-weight: bold;
                    font-size: 14px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                  ">
                    ${index + 1}
                  </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
              })}
            >
              <Popup>
                <div className="p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold">Stop {index + 1}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="font-medium">{job.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{job.clientName}</p>
                  {job.address && (
                    <p className="text-xs text-muted-foreground mt-1">{job.address}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
          
          {showJobs && jobsWithCoords.map((job) => (
            <Marker
              key={job.id}
              position={[job.latitude!, job.longitude!]}
              icon={createJobIcon(job.status, isDark)}
              eventHandlers={{
                click: () => {
                  setClickedJobPosition({
                    lat: job.latitude!,
                    lng: job.longitude!,
                    id: job.id + '-' + Date.now(),
                  });
                },
              }}
            >
              <Popup>
                <div className="min-w-[260px] p-2">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-semibold text-base">{job.title}</h3>
                    <Badge 
                      variant="secondary" 
                      className="text-xs shrink-0"
                      style={{ 
                        backgroundColor: STATUS_COLORS[job.status] + '30',
                        color: STATUS_COLORS[job.status],
                      }}
                    >
                      {STATUS_LABELS[job.status]}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>{job.clientName}</span>
                    </div>
                    {job.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{job.address}</span>
                      </div>
                    )}
                    {job.scheduledAt && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(job.scheduledAt), 'PPp')}</span>
                      </div>
                    )}
                    {job.assignedTo && (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{job.assignedTo}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    {/* Primary action button based on status */}
                    {job.status === 'scheduled' ? (
                      <Button 
                        size="sm" 
                        onClick={() => handleStartJob(job.id)}
                        className="w-full bg-green-600 hover:bg-green-700"
                        data-testid={`button-start-job-${job.id}`}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Start Job
                      </Button>
                    ) : job.status === 'in_progress' ? (
                      <Button 
                        size="sm" 
                        onClick={() => navigate(`/jobs/${job.id}`)}
                        className="w-full bg-orange-500 hover:bg-orange-600"
                        data-testid={`button-continue-job-${job.id}`}
                      >
                        <ArrowRight className="h-4 w-4 mr-1" />
                        Continue Job
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        onClick={() => navigate(`/jobs/${job.id}`)}
                        className="w-full"
                        style={{ backgroundColor: STATUS_COLORS[job.status] }}
                        data-testid={`button-view-job-${job.id}`}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Job
                      </Button>
                    )}
                    
                    <div className="flex gap-2">
                      {job.clientPhone && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleCall(job.clientPhone!)}
                          className="flex-1"
                        >
                          <Phone className="h-4 w-4 mr-1" />
                          Call
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => navigateTo(job.latitude!, job.longitude!)}
                        className="flex-1"
                      >
                        <Navigation2 className="h-4 w-4 mr-1" />
                        Navigate
                      </Button>
                    </div>
                    
                    {/* Assign to Worker button - shown when in assignment mode */}
                    {selectedWorkerForAssignment && (
                      <Button 
                        size="sm" 
                        className="w-full text-white"
                        style={{ backgroundColor: '#22c55e' }}
                        onClick={() => assignWorkerToJob(job.id)}
                        disabled={assignJobToWorkerMutation.isPending}
                        data-testid={`button-assign-worker-${job.id}`}
                      >
                        <User className="h-4 w-4 mr-1" />
                        Assign to {selectedWorkerForAssignment.name.split(' ')[0]}
                      </Button>
                    )}
                    
                    {/* Add to Route button - hidden in assignment mode */}
                    {!selectedWorkerForAssignment && (
                      <Button 
                        size="sm" 
                        variant={isJobInRoute(job.id) ? "secondary" : "outline"}
                        onClick={() => isJobInRoute(job.id) ? removeFromRoute(job.id) : addJobToRoute(job)}
                        className="w-full"
                        style={!isJobInRoute(job.id) ? { 
                          borderColor: 'hsl(var(--trade))',
                          color: 'hsl(var(--trade))'
                        } : undefined}
                        data-testid={`button-add-to-route-${job.id}`}
                      >
                        {isJobInRoute(job.id) ? (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            In Route
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-1" />
                            Add to Route
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

          {showTeamMembers && mergedTeamLocations.map((member) => (
            <Marker
              key={member.id}
              position={[member.latitude, member.longitude]}
              icon={createTeamMemberIcon(member, isDark)}
              ref={(markerRef) => {
                if (markerRef) {
                  teamMemberMarkersRef.current.set(member.id, markerRef);
                }
              }}
            >
              <Popup>
                <div className="min-w-[260px] p-2">
                  <div className="flex items-center gap-3 mb-4">
                    <UserAvatar
                      className="h-14 w-14 text-lg"
                      showStatus
                      statusColor={member.isActive 
                        ? (member.isDriving ? ACTIVITY_COLORS.driving : member.activityStatus === 'working' ? ACTIVITY_COLORS.working : ACTIVITY_COLORS.online)
                        : ACTIVITY_COLORS.offline}
                      user={{
                        id: member.id,
                        name: member.name,
                        email: member.email,
                        photoUrl: member.profileImageUrl,
                        themeColor: member.themeColor,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{member.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {member.isActive ? (
                          member.isDriving ? (
                            <Badge className="bg-blue-600/30 text-blue-600 dark:text-blue-400 border-0">
                              <Car className="h-3 w-3 mr-1" />
                              Driving
                            </Badge>
                          ) : member.activityStatus === 'working' ? (
                            <Badge className="bg-orange-500/30 text-orange-600 dark:text-orange-400 border-0">
                              <Wrench className="h-3 w-3 mr-1" />
                              Working
                            </Badge>
                          ) : (
                            <Badge className="bg-green-600/30 text-green-600 dark:text-green-400 border-0">
                              <Wifi className="h-3 w-3 mr-1" />
                              Online
                            </Badge>
                          )
                        ) : (
                          <Badge className="bg-gray-500/30 text-gray-500 dark:text-gray-400 border-0">
                            <WifiOff className="h-3 w-3 mr-1" />
                            Offline
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm mb-4">
                    {member.isDriving && member.speed > 0 && (
                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                        <Gauge className="h-4 w-4" />
                        <span className="font-medium">{Math.round(member.speed)} km/h</span>
                      </div>
                    )}
                    
                    {member.currentJobTitle && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span>{member.currentJobTitle}</span>
                      </div>
                    )}

                    {member.isDriving && member.currentJobTitle && (
                      <div className="flex items-center gap-2 text-xs font-medium" style={{ color: ACTIVITY_COLORS.driving }}>
                        <Navigation2 className="h-3.5 w-3.5" />
                        <span>En route to job</span>
                        {member.speed > 0 && <span>• {Math.round(member.speed)} km/h</span>}
                      </div>
                    )}
                    
                    {member.currentAddress && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                        <span className="text-xs">{member.currentAddress}</span>
                      </div>
                    )}
                    
                    {member.batteryLevel !== null && member.batteryLevel !== undefined && (
                      <div className="flex items-center gap-2">
                        {member.isCharging ? (
                          <BatteryCharging className="h-4 w-4 text-green-500" />
                        ) : member.batteryLevel <= 20 ? (
                          <BatteryLow className="h-4 w-4 text-red-500" />
                        ) : (
                          <Battery className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={member.batteryLevel <= 20 ? 'text-red-500' : ''}>
                          {member.batteryLevel}%
                          {member.isCharging && ' (Charging)'}
                        </span>
                      </div>
                    )}
                    
                    {member.lastSeenAt && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {member.isActive ? 'Active now' : `Last seen ${formatDistanceToNow(new Date(member.lastSeenAt), { addSuffix: true })}`}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => navigate(`/chat?to=${member.id}&type=direct`)}
                        data-testid={`button-message-${member.id}`}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Message
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => navigateTo(member.latitude, member.longitude)}
                      >
                        <Navigation2 className="h-4 w-4 mr-1" />
                        Navigate
                      </Button>
                    </div>
                    {(isOwner || isManager) && (
                      <Button
                        size="sm"
                        variant="default"
                        className="w-full"
                        style={{ backgroundColor: 'hsl(var(--trade))' }}
                        onClick={() => enterWorkerAssignmentMode(member)}
                        data-testid={`button-assign-jobs-${member.id}`}
                      >
                        <Briefcase className="h-4 w-4 mr-1" />
                        Assign Jobs
                      </Button>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        
        {/* Ocean color overlay gradient */}
        <div className="ocean-overlay absolute inset-0 pointer-events-none" />
      </div>

      {/* Floating controls - positioned at top of map area, above Leaflet layers */}
      <div className="absolute left-0 right-0 top-0 z-[1000] pointer-events-none">
        <div className="p-3 md:p-4">
          {/* Header controls bar */}
          <div 
            className={`${isDark ? 'bg-gray-900/90' : 'bg-white/90'} backdrop-blur-xl rounded-2xl shadow-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} p-3 pointer-events-auto`}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'hsl(var(--trade) / 0.15)' }}
                >
                  <MapIcon className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                </div>
                <div>
                  <h1 className="text-base font-bold leading-tight">Job Map</h1>
                  <p className="text-xs text-muted-foreground">
                    {jobsWithCoords.length} jobs{isTeam ? ` • ${mergedTeamLocations.filter(t => t.isActive).length} active` : ''}
                    {locationSocketConnected && isTeam && (
                      <span className="inline-flex items-center ml-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                      </span>
                    )}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {isTeam && unreadAlerts.length > 0 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="relative h-9 w-9"
                    onClick={() => setShowAlerts(!showAlerts)}
                    data-testid="button-alerts"
                  >
                    <Bell className="h-5 w-5" />
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center font-bold">
                      {unreadAlerts.length}
                    </span>
                  </Button>
                )}
                
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  onClick={handleRefresh}
                  data-testid="button-refresh-map"
                >
                  <RefreshCw className="h-5 w-5" />
                </Button>
                
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9"
                  onClick={() => setShowControls(!showControls)}
                >
                  {showControls ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </Button>
              </div>
            </div>
            
            {showControls && (
              <div className="flex flex-wrap items-center gap-2">
                {/* Job Search Input */}
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Find job on map..."
                      value={jobSearch}
                      onChange={(e) => {
                        setJobSearch(e.target.value);
                        setShowJobSearchResults(e.target.value.length > 0);
                      }}
                      onFocus={() => setShowJobSearchResults(jobSearch.length > 0)}
                      onBlur={() => setTimeout(() => setShowJobSearchResults(false), 200)}
                      className="pl-9 h-9 w-[180px] lg:w-[220px] text-sm"
                      data-testid="input-job-search"
                    />
                    {jobSearch && (
                      <span
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setJobSearch("");
                          setShowJobSearchResults(false);
                          setSelectedSearchJob(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                  {showJobSearchResults && jobSearchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-lg z-50 max-h-[300px] overflow-y-auto bg-background border-border">
                      {jobSearchResults.map((job) => (
                        <div
                          key={job.id}
                          className="p-3 cursor-pointer border-b last:border-b-0 border-border hover-elevate overflow-visible"
                          onClick={() => {
                            setSelectedSearchJob(job);
                            setJobSearch(job.title);
                            setShowJobSearchResults(false);
                          }}
                          data-testid={`search-result-${job.id}`}
                        >
                          <div className="flex items-start gap-2">
                            <div 
                              className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                              style={{ backgroundColor: STATUS_COLORS[job.status] || '#6B7280' }}
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{job.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{job.clientName}</p>
                              {job.address && (
                                <p className="text-xs text-muted-foreground truncate">{job.address}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {showJobSearchResults && jobSearch && jobSearchResults.length === 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-lg z-50 p-3 text-sm text-muted-foreground bg-background border-border">
                      No jobs found
                    </div>
                  )}
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px] text-sm h-9" data-testid="select-status-filter">
                    <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Jobs</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="done">Completed</SelectItem>
                    <SelectItem value="invoiced">Invoiced</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  variant={showJobs ? "default" : "outline"}
                  className="h-9"
                  onClick={() => setShowJobs(!showJobs)}
                  data-testid="button-toggle-jobs"
                >
                  <Briefcase className="h-4 w-4 mr-1" />
                  Jobs
                </Button>

                {isTeam && (isOwner || isManager) && (
                  <Button
                    size="sm"
                    variant={showTeamMembers ? "default" : "outline"}
                    className={`h-9 ${showTeamMembers ? "bg-green-600 hover:bg-green-700" : ""}`}
                    onClick={() => setShowTeamMembers(!showTeamMembers)}
                    data-testid="button-toggle-team"
                  >
                    <Users className="h-4 w-4 mr-1" />
                    Team
                  </Button>
                )}
                
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9"
                  onClick={() => setShowLegend(!showLegend)}
                >
                  {showLegend ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <span className="ml-1">Legend</span>
                </Button>
              </div>
            )}
            
            {showLegend && showControls && (
              <div className={`mt-3 pt-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                  <div className="flex flex-wrap gap-3">
                    <span className="text-muted-foreground font-medium">Jobs:</span>
                    {Object.entries(STATUS_COLORS).map(([status, color]) => (
                      <div key={status} className="flex items-center gap-1.5">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}60` }}
                        />
                        <span>{STATUS_LABELS[status]}</span>
                      </div>
                    ))}
                  </div>
                  
                  {isTeam && (
                    <div className="flex flex-wrap gap-3">
                      <span className="text-muted-foreground font-medium">Team:</span>
                      {Object.entries(ACTIVITY_COLORS).map(([status, color]) => (
                        <div key={status} className="flex items-center gap-1.5">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: color }}
                          />
                          <span className="capitalize">{status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Worker Assignment Mode Banner */}
      {selectedWorkerForAssignment && (
        <div className="absolute left-3 right-3 md:left-4 md:right-4 top-32 z-[1002] pointer-events-none">
          <div 
            className={`${isDark ? 'bg-green-900/95' : 'bg-green-50/95'} backdrop-blur-xl rounded-xl shadow-xl border ${isDark ? 'border-green-700' : 'border-green-200'} p-3 pointer-events-auto`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shrink-0"
                  style={{ backgroundColor: '#22c55e' }}
                >
                  {selectedWorkerForAssignment.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div>
                  <p className={`font-semibold text-sm ${isDark ? 'text-green-100' : 'text-green-900'}`}>
                    Assigning jobs to {selectedWorkerForAssignment.name}
                  </p>
                  <p className={`text-xs ${isDark ? 'text-green-300' : 'text-green-700'}`}>
                    Tap a job on the map to assign it
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className={`shrink-0 ${isDark ? 'border-green-600 text-green-200 hover:bg-green-800' : 'border-green-300 text-green-700 hover:bg-green-100'}`}
                onClick={cancelWorkerAssignment}
                data-testid="button-cancel-assignment"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Route Planning Panel - Compact tab style */}
      {showRoutePanel && enrichedRouteJobs.length > 0 && !selectedWorkerForAssignment && (
        <div className="absolute left-3 md:left-4 top-32 z-[1001] pointer-events-none">
          <div 
            className={`${isDark ? 'bg-gray-900/95' : 'bg-white/95'} backdrop-blur-xl rounded-xl shadow-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} p-2.5 w-56 max-w-[calc(100vw-24px)] pointer-events-auto`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div 
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'hsl(var(--trade) / 0.15)' }}
                >
                  <Navigation2 className="h-3.5 w-3.5" style={{ color: 'hsl(var(--trade))' }} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Route</h3>
                  <p className="text-xs text-muted-foreground">
                    {enrichedRouteJobs.length} stop{enrichedRouteJobs.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={clearRoute}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            {/* Validation warning */}
            {routeValidationWarning && (
              <div className={`px-2 py-1.5 rounded-lg mb-2 text-xs flex items-center gap-1.5 ${isDark ? 'bg-amber-900/30 text-amber-400' : 'bg-amber-100 text-amber-700'}`}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{routeValidationWarning}</span>
              </div>
            )}
            
            <div className="space-y-1.5 mb-2 max-h-40 overflow-y-auto">
              {enrichedRouteJobs.map((job, index) => (
                <div key={job.jobId}>
                  {/* Per-leg drive time / distance from the previous stop */}
                  {routeLegInfo[index] && (
                    <div className="flex items-center gap-1 pl-1.5 mb-1 text-[10px] text-muted-foreground">
                      <ArrowDown className="h-2.5 w-2.5 shrink-0" />
                      <Clock className="h-2.5 w-2.5 shrink-0" />
                      <span className="font-medium">{routeLegInfo[index]!.minutes} min</span>
                      {typeof routeLegInfo[index]!.km === 'number' && (
                        <>
                          <span>·</span>
                          <span>{routeLegInfo[index]!.km!.toFixed(1)} km</span>
                        </>
                      )}
                    </div>
                  )}
                <div 
                  className={`flex items-center gap-1.5 p-1.5 rounded-lg ${
                    !job.address 
                      ? (isDark ? 'bg-amber-900/20 border border-amber-700/50' : 'bg-amber-50 border border-amber-200')
                      : (isDark ? 'bg-gray-800/50' : 'bg-gray-100/50')
                  }`}
                >
                  <div 
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white"
                    style={{ backgroundColor: job.address ? 'hsl(var(--trade))' : '#9CA3AF' }}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs truncate">{job.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{job.clientName}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 shrink-0"
                    onClick={() => removeFromRoute(job.jobId)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                </div>
              ))}
            </div>

            {/* Route Stats */}
            {routeStats && (
              <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg mb-2 ${isDark ? 'bg-green-900/30' : 'bg-green-50'}`}>
                <div className="flex items-center gap-1 text-xs">
                  <Navigation2 className="h-3 w-3 text-green-600" />
                  <span className="font-medium">{routeStats.totalDistance} km</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3 text-green-600" />
                  <span className="font-medium">
                    {Math.floor(routeStats.estimatedDuration / 60)}h {routeStats.estimatedDuration % 60}m
                  </span>
                </div>
              </div>
            )}
            
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={handleOptimizeRoute}
                disabled={routeJobsWithCoords.length < 2 || isOptimizing}
                title="Optimize route order"
                data-testid="button-optimize-route"
              >
                {isOptimizing ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                size="sm"
                className="flex-1 h-8 text-white text-xs"
                style={{ 
                  backgroundColor: routeJobsWithAddresses.length > 0 ? 'hsl(var(--trade))' : undefined,
                }}
                variant={routeJobsWithAddresses.length > 0 ? 'default' : 'secondary'}
                onClick={openMultiStopRoute}
                disabled={routeJobsWithAddresses.length === 0}
              >
                <Navigation2 className="h-3.5 w-3.5 mr-1.5" />
                {routeJobsWithAddresses.length > 0 
                  ? 'Open Maps'
                  : 'No addresses'}
                {routeJobsWithAddresses.length > 0 && <ExternalLink className="h-3 w-3 ml-1" />}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setShowSavedRoutes(!showSavedRoutes)}
                title="Saved Routes"
              >
                <FolderOpen className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            {/* Save/Load Route Section */}
            {showSavedRoutes && (
              <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} pt-3 mt-1`}>
                {/* Save current route */}
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Route name..."
                    value={routeName}
                    onChange={(e) => setRouteName(e.target.value)}
                    className="h-8 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveRoute()}
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveRoute}
                    disabled={!routeName.trim() || routeJobs.length === 0 || isSaving}
                    className="shrink-0"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                </div>
                
                {/* Saved routes list */}
                {savedRoutes.length > 0 ? (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    <p className="text-xs text-muted-foreground font-medium">Saved Routes:</p>
                    {savedRoutes.map((route) => (
                      <div 
                        key={route.id}
                        className={`flex items-center justify-between p-2 rounded-lg ${isDark ? 'bg-gray-800/50 hover:bg-gray-800' : 'bg-gray-100/50 hover:bg-gray-100'} cursor-pointer`}
                        onClick={() => loadSavedRoute(route)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{route.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(route.jobIds || []).length} stops
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteRouteMutation.mutate(route.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No saved routes yet
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alerts panel */}
      {showAlerts && unreadAlerts.length > 0 && (
        <div className="absolute left-0 right-0 top-32 z-[1000] px-3 md:px-4 pointer-events-none">
          <div 
            className={`${isDark ? 'bg-gray-900/95' : 'bg-white/95'} backdrop-blur-xl rounded-2xl shadow-xl border ${isDark ? 'border-gray-700' : 'border-gray-200'} p-4 max-h-80 overflow-y-auto pointer-events-auto`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4 text-red-500" />
                Recent Alerts
              </h3>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setShowAlerts(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-2">
              {unreadAlerts.slice(0, 5).map((alert) => {
                const initials = alert.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                return (
                  <div 
                    key={alert.id} 
                    className={`p-3 rounded-xl ${isDark ? 'bg-gray-800/80' : 'bg-gray-100/80'} flex items-start gap-3`}
                    onClick={() => markAlertReadMutation.mutate(alert.id)}
                  >
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0"
                      style={{
                        backgroundColor: alert.alertType === 'arrival' ? '#22C55E' : 
                                        alert.alertType === 'departure' ? '#EF4444' : '#F59E0B',
                        backgroundImage: alert.userAvatar ? `url(${alert.userAvatar})` : undefined,
                        backgroundSize: 'cover',
                      }}
                    >
                      {!alert.userAvatar && initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold">{alert.userName}</span>
                        <span className="text-muted-foreground mx-1">
                          {alert.alertType === 'arrival' ? 'arrived at' : 
                           alert.alertType === 'departure' ? 'left' : 'alert'}
                        </span>
                        <span className="font-medium">{alert.jobTitle}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      {/* Team member chips at bottom - above mobile nav (sorted: active first) */}
      {isTeam && sortedTeamLocations.length > 0 && showTeamMembers && (
        <div className="absolute bottom-24 md:bottom-4 left-0 right-0 z-[1000] px-3 md:px-4 pointer-events-none">
          <div className="overflow-x-auto pb-2 scrollbar-hide pointer-events-auto">
            <div className="flex gap-2 w-max">
              {sortedTeamLocations.map((member) => {
                const activityFallback = member.isActive 
                  ? (member.isDriving ? ACTIVITY_COLORS.driving : member.activityStatus === 'working' ? ACTIVITY_COLORS.working : ACTIVITY_COLORS.online)
                  : ACTIVITY_COLORS.offline;
                
                return (
                  <div
                    key={member.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full ${isDark ? 'bg-gray-900/95' : 'bg-white/95'} backdrop-blur-xl shadow-lg border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
                  >
                    <button
                      onClick={() => setSelectedTeamMemberId(member.id)}
                      className="flex items-center gap-2 hover-elevate transition-all rounded-full"
                      data-testid={`button-team-member-${member.id}`}
                    >
                      <UserAvatar
                        className="h-8 w-8"
                        fallbackClassName="text-xs"
                        showStatus
                        statusColor={activityFallback}
                        user={{
                          id: member.id,
                          name: member.name,
                          email: member.email,
                          photoUrl: member.profileImageUrl,
                          themeColor: member.themeColor,
                        }}
                      />
                      <div className="text-left">
                        <p className="text-sm font-medium leading-tight">
                          {member.name.split(' ')[0]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {member.isDriving && member.speed > 0 
                            ? `${Math.round(member.speed)} km/h`
                            : member.isActive 
                              ? (member.activityStatus === 'working' ? 'Working' : 'Online')
                              : 'Offline'}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/chat?to=${member.id}&type=direct`);
                      }}
                      className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border-l pl-2 ml-1"
                      style={{ borderColor: isDark ? '#374151' : '#e5e7eb' }}
                      data-testid={`button-message-chip-${member.id}`}
                      title="Send message"
                    >
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      {/* Empty state */}
      {jobsData.length === 0 && mergedTeamLocations.length === 0 && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center pointer-events-none">
          <Card className="backdrop-blur-xl bg-background/90 pointer-events-auto max-w-sm mx-4">
            <CardContent className="py-8 px-6 text-center">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No locations to show</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add jobs with addresses or invite team members to see them on the map.
              </p>
              <Button onClick={() => navigate('/jobs/new')}>
                <Briefcase className="h-4 w-4 mr-2" />
                Create a Job
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
