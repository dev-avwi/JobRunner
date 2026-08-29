import JobPicker from "@/components/JobPicker";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/UserAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/ThemeProvider";
import { useLocation } from "wouter";
import { useAppMode } from "@/hooks/use-app-mode";
import { formatDistanceToNow, format, addDays, subDays, isAfter, isBefore, parseISO, startOfWeek, isWithinInterval, isSameDay } from "date-fns";
import {
  Users,
  MessageCircle,
  MapPin,
  Clock,
  CheckCircle2,
  FileText,
  CreditCard,
  Send,
  Briefcase,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Circle,
  Activity,
  Coffee,
  Wrench,
  X,
  Info,
  Phone,
  Mail,
  Navigation,
  UserCheck,
  UserX,
  Plus,
  Settings,
  Shield,
  Key,
  Edit2,
  Save,
  Calendar,
  Award,
  TrendingUp,
  AlertTriangle,
  Star,
  BarChart3,
  UserPlus,
  Eye,
  CalendarDays,
  ClipboardCheck,
  Timer,
  DollarSign,
  User,
  Navigation2,
  Car,
  MessageSquare,
  RotateCcw,
  ArrowUpRight,
  Filter,
  Sparkles,
  MoreHorizontal,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { TeamMember, UserRole, TeamMemberSkill, TeamMemberAvailability, TeamMemberTimeOff } from "@shared/schema";
import { getWorkerDisplayName } from "@shared/displayName";
import { PERMISSION_CATEGORIES, PERMISSION_LABELS, type WorkerPermission, DEFAULT_WORKER_PERMISSIONS, ALL_WORKER_PERMISSIONS, ROLE_PRESETS, WORKER_PERMISSIONS } from "@shared/permissions";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import "leaflet/dist/leaflet.css";
import { MapTeardownGuard } from "@/lib/mapSafe";

interface TeamPresenceData {
  userId: string;
  status: string;
  statusMessage?: string;
  currentJobId?: string;
  destinationJobTitle?: string;
  lastSeenAt?: string;
  lastLocationLat?: number;
  lastLocationLng?: number;
  lastLocationUpdatedAt?: string;
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
  memberId?: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  profileImageUrl?: string;
  role?: string;
  roleName?: string;
  inviteStatus?: string;
  inviteSentAt?: string;
  roleId?: string;
  hourlyRate?: string;
  customPermissions?: string[];
  useCustomPermissions?: boolean;
  themeColor?: string;
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
  scheduledTime?: string;
  estimatedDuration?: number;
}

interface MemberWithJobs extends TeamMemberData {
  assignedJobs: JobData[];
  presence?: TeamPresenceData;
  recentActivity: ActivityFeedItem[];
}

interface PermissionItem {
  key: string;
  label: string;
  category: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: any; markerBg: string; markerText: string }> = {
  online: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", icon: Circle, markerBg: "#22c55e", markerText: "#fff" },
  on_job: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", icon: Wrench, markerBg: "#3b82f6", markerText: "#fff" },
  travelling: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400", icon: Navigation2, markerBg: "#f97316", markerText: "#fff" },
  driving: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400", icon: Car, markerBg: "#f97316", markerText: "#fff" },
  busy: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", icon: Clock, markerBg: "#f59e0b", markerText: "#fff" },
  break: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400", icon: Coffee, markerBg: "#eab308", markerText: "#000" },
  offline: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-500 dark:text-gray-400", icon: Circle, markerBg: "#9ca3af", markerText: "#fff" },
};

function getStatusDisplay(status: string) {
  const config = STATUS_COLORS[status] || STATUS_COLORS.offline;
  const statusLabels: Record<string, string> = {
    online: "Available",
    on_job: "On Job",
    travelling: "Travelling",
    driving: "Driving",
    busy: "Busy",
    break: "On Break",
    offline: "Offline",
  };
  return {
    ...config,
    label: statusLabels[status] || status,
  };
}

function getInitials(firstName?: string, lastName?: string, email?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) return firstName[0].toUpperCase();
  if (email) return email[0].toUpperCase();
  return "?";
}

const TILE_LIGHT = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function TeamThemeAwareTiles() {
  const { theme } = useTheme();
  const map = useMap();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const tileUrl = isDark ? TILE_DARK : TILE_LIGHT;
  
  useEffect(() => {
    const tileLayer = L.tileLayer(tileUrl, { attribution: TILE_ATTRIBUTION });
    tileLayer.addTo(map);
    return () => { try { map.removeLayer(tileLayer); } catch {} };
  }, [tileUrl, map]);
  
  return null;
}

function LiveOpsTab() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [statusBoardOpen, setStatusBoardOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(true);
  const [mapOpen, setMapOpen] = useState(true);
  const [selectedMember, setSelectedMember] = useState<MemberWithJobs | null>(null);
  const [selectedMemberIdForMap, setSelectedMemberIdForMap] = useState<string | null>(null);
  const [assignJobDialogOpen, setAssignJobDialogOpen] = useState(false);
  const [selectedJobToAssign, setSelectedJobToAssign] = useState<string>("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteHourlyRate, setInviteHourlyRate] = useState("");

  const { data: presence = [], isLoading: presenceLoading } = useQuery<TeamPresenceData[]>({
    queryKey: ["/api/team/presence"],
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<TeamMemberData[]>({
    queryKey: ["/api/team/members"],
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<ActivityFeedItem[]>({
    queryKey: ["/api/activity-feed", { limit: 30 }],
  });

  const { data: allJobs = [] } = useQuery<JobData[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: roles = [] } = useQuery<UserRole[]>({
    queryKey: ['/api/team/roles'],
  });

  const { data: workerStates = [] } = useQuery<{ userId: string; state: string; note: string | null; jobId: string | null }[]>({
    queryKey: ['/api/team/worker-states'],
  });

  const workerStateMap = useMemo(() => {
    const map: Record<string, { state: string; note: string | null }> = {};
    for (const ws of workerStates) {
      map[ws.userId] = { state: ws.state, note: ws.note };
    }
    return map;
  }, [workerStates]);

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; firstName: string; lastName: string; roleId: string; phone?: string; hourlyRate?: number }) => {
      const response = await apiRequest('POST', '/api/team/members/invite', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/members'] });
      toast({ title: "Invite sent", description: "Team member invitation has been sent." });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteFirstName("");
      setInviteLastName("");
      setInviteRoleId("");
      setInvitePhone("");
      setInviteHourlyRate("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to send invite", description: error.message, variant: "destructive" });
    },
  });

  const acceptedMembers = useMemo(() => {
    return members.filter(m => m.inviteStatus === 'accepted');
  }, [members]);

  // Sort accepted members: active/on-job first, then online, then offline
  const sortedAcceptedMembers = useMemo(() => {
    return [...acceptedMembers].sort((a, b) => {
      const aPresence = presence.find(p => p.userId === a.userId);
      const bPresence = presence.find(p => p.userId === b.userId);
      
      const statusPriority: Record<string, number> = {
        'on_job': 0,
        'online': 1,
        'busy': 2,
        'break': 3,
        'offline': 4,
      };
      
      const aStatus = aPresence?.status || 'offline';
      const bStatus = bPresence?.status || 'offline';
      const aPriority = statusPriority[aStatus] ?? 5;
      const bPriority = statusPriority[bStatus] ?? 5;
      
      return aPriority - bPriority;
    });
  }, [acceptedMembers, presence]);

  const jobs = useMemo(() => {
    return allJobs.filter((j) => j.status === "in_progress" || j.status === "scheduled");
  }, [allJobs]);

  const unassignedJobs = useMemo(() => {
    return allJobs.filter(j => !j.assignedTo && (j.status === "pending" || j.status === "scheduled"));
  }, [allJobs]);

  const assignJobMutation = useMutation({
    mutationFn: async ({ jobId, userId }: { jobId: string; userId: string }) => {
      const response = await apiRequest('PATCH', `/api/jobs/${jobId}`, { assignedTo: userId });
      return response.json();
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/team/presence'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/activity-feed'] });
      toast({ title: "Job assigned successfully" });
      setAssignJobDialogOpen(false);
      setSelectedJobToAssign("");
      // Refresh selected member to show the newly assigned job
      if (selectedMember) {
        const updatedJobs = await queryClient.fetchQuery({ queryKey: ['/api/jobs'] }) as JobData[];
        const assignedJobs = updatedJobs.filter((j: JobData) => j.assignedTo === selectedMember.userId);
        setSelectedMember({
          ...selectedMember,
          assignedJobs,
        });
      }
    },
    onError: (error: any) => {
      toast({ title: "Failed to assign job", description: error.message, variant: "destructive" });
    },
  });

  const handleMemberClick = (member: TeamMemberData) => {
    const memberPresence = presence.find(p => p.userId === member.userId);
    const assignedJobs = allJobs.filter(j => j.assignedTo === member.userId);
    const memberActivity = activities.filter(a => a.actorUserId === member.userId);

    const memberWithJobs: MemberWithJobs = {
      ...member,
      assignedJobs,
      presence: memberPresence,
      recentActivity: memberActivity,
    };

    setSelectedMember(memberWithJobs);
    setSelectedMemberIdForMap(member.userId);
  };

  const onlineCount = useMemo(() => {
    return presence.filter(p => p.status === 'online' || p.status === 'on_job').length;
  }, [presence]);

  const onJobCount = useMemo(() => {
    return presence.filter(p => p.status === 'on_job').length;
  }, [presence]);

  const isLoading = presenceLoading || membersLoading;

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Inline action bar — page-level header already shows the live stats */}
      <div className="flex items-center justify-end gap-2 px-4 sm:px-5 pt-3 pb-1">
        <Button onClick={() => setInviteDialogOpen(true)} size="sm" data-testid="button-add-team-member">
          <UserPlus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Add Member</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-5 pt-2 sm:pt-2 section-gap">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="space-y-4">
            <Collapsible open={statusBoardOpen} onOpenChange={setStatusBoardOpen}>
              <Card>
              <CollapsibleTrigger asChild>
                <div className="cursor-pointer py-3 px-4 flex items-center justify-between gap-2 hover:bg-muted/30 transition-colors rounded-[calc(var(--radius)-1px)]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Team Status</span>
                    <Badge variant="secondary" className="text-xs">{sortedAcceptedMembers.length}</Badge>
                  </div>
                  {statusBoardOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t px-4 pb-4 pt-3">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-1">
                      {sortedAcceptedMembers.map((member, index) => {
                        const memberPresence = presence.find(p => p.userId === member.userId);
                        const status = memberPresence?.status || 'offline';
                        const statusDisplay = getStatusDisplay(status);
                        const StatusIcon = statusDisplay.icon;
                        const lastSeen = memberPresence?.lastSeenAt
                          ? formatDistanceToNow(new Date(memberPresence.lastSeenAt), { addSuffix: true })
                          : null;

                        return (
                          <div
                            key={member.id}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors animate-fade-up stagger-delay-${Math.min(index + 1, 8)}`}
                            onClick={() => handleMemberClick(member)}
                            data-testid={`member-status-${member.id}`}
                          >
                            <div className="relative">
                              <UserAvatar
                                className="h-10 w-10"
                                user={{
                                  id: member.userId || member.id,
                                  firstName: member.firstName,
                                  lastName: member.lastName,
                                  email: member.email,
                                  photoUrl: member.profileImageUrl,
                                  themeColor: member.themeColor,
                                }}
                              />
                              {(status === 'online' || status === 'on_job') && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-card" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">
                                {getWorkerDisplayName(member)}
                              </p>
                              <div className="flex items-center gap-1.5">
                                <StatusIcon className={`h-3 w-3 ${statusDisplay.text} ${status === 'online' || status === 'on_job' ? 'fill-current' : ''}`} />
                                <span className={`text-xs ${statusDisplay.text}`}>
                                  {statusDisplay.label}
                                </span>
                                {status === 'offline' && lastSeen && (
                                  <span className="text-xs text-muted-foreground">{lastSeen}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {(() => {
                                const ws = workerStateMap[member.memberId || member.id];
                                const stateConfig: Record<string, { label: string; color: string }> = {
                                  on_job: { label: 'On Job', color: '#f97316' },
                                  travelling: { label: 'Travelling', color: '#3b82f6' },
                                  break: { label: 'Break', color: '#9ca3af' },
                                  delayed: { label: 'Delayed', color: '#eab308' },
                                  needs_help: { label: 'Needs Help', color: '#ef4444' },
                                };
                                if (ws && ws.state !== 'available') {
                                  const cfg = stateConfig[ws.state];
                                  if (cfg) return (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                      style={{ backgroundColor: `${cfg.color}20`, color: cfg.color, borderColor: `${cfg.color}30` }}
                                      title={ws.note || undefined}
                                    >
                                      <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: cfg.color }} />
                                      {cfg.label}
                                    </Badge>
                                  );
                                }
                                return member.roleName ? (
                                  <span className="text-xs text-muted-foreground hidden sm:inline">{member.roleName}</span>
                                ) : null;
                              })()}
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); }}>
                                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      {sortedAcceptedMembers.length === 0 && (
                        <div className="text-center py-12">
                          <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                            <Users className="h-10 w-10" style={{ color: 'hsl(var(--trade) / 0.4)' }} />
                          </div>
                          <p className="font-medium mb-1">No team members yet</p>
                          <p className="text-xs text-muted-foreground">Invite your first team member to get started</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>

            <Collapsible open={mapOpen} onOpenChange={setMapOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <div className="cursor-pointer py-3 px-4 flex items-center justify-between gap-2 hover:bg-muted/30 transition-colors rounded-[calc(var(--radius)-1px)]">
                    <span className="text-sm font-semibold">Team Map</span>
                    {mapOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t px-4 pb-4 pt-3">
                    <div className="h-[450px] rounded-lg overflow-hidden border" data-testid="team-map-container">
                      {presence.some(p => p.lastLocationLat && p.lastLocationLng) ? (
                        <MapContainer
                          center={(() => {
                            const withLocation = presence.filter(p => {
                              const lat = Number(p.lastLocationLat);
                              const lng = Number(p.lastLocationLng);
                              return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
                            });
                            if (withLocation.length === 0) return [-16.92, 145.77] as [number, number];
                            const avgLat = withLocation.reduce((s, p) => s + Number(p.lastLocationLat), 0) / withLocation.length;
                            const avgLng = withLocation.reduce((s, p) => s + Number(p.lastLocationLng), 0) / withLocation.length;
                            return [avgLat, avgLng] as [number, number];
                          })()}
                          zoom={13}
                          className="h-full w-full"
                          scrollWheelZoom={true}
                        >
                          <TeamThemeAwareTiles />
                          <MapTeardownGuard />
                          {presence.filter(p => {
                            const lat = Number(p.lastLocationLat);
                            const lng = Number(p.lastLocationLng);
                            return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
                          }).map((p) => {
                            const member = acceptedMembers.find(m => m.userId === p.userId);
                            const statusDisplay = getStatusDisplay(p.status);
                            const initials = getInitials(member?.firstName, member?.lastName, member?.email);
                            const memberJobs = allJobs.filter(j => j.assignedTo === p.userId);
                            const currentJob = memberJobs.find(j => j.status === 'in_progress');
                            const nextJob = memberJobs.find(j => j.status === 'scheduled');
                            const lastSeenTime = p.lastLocationUpdatedAt 
                              ? new Date(p.lastLocationUpdatedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
                              : null;
                            return (
                              <Marker
                                key={p.userId}
                                position={[Number(p.lastLocationLat), Number(p.lastLocationLng)]}
                                icon={(() => {
                                  const bg = member?.themeColor || statusDisplay.markerBg;
                                  const isActive = p.status === 'online' || p.status === 'on_job';
                                  return L.divIcon({
                                    className: '',
                                    html: `<div style="
                                      position: relative;
                                      display: flex;
                                      align-items: center;
                                      justify-content: center;
                                      width: 38px;
                                      height: 38px;
                                      border-radius: 50%;
                                      background: ${bg};
                                      border: 3px solid white;
                                      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
                                      font-family: system-ui, -apple-system, sans-serif;
                                      cursor: pointer;
                                      --pulse-color: ${bg}80;
                                      ${isActive ? `animation: team-pulse 2s ease-out infinite;` : ''}
                                    ">
                                      <span style="
                                        color: #fff;
                                        font-size: 12px;
                                        font-weight: 700;
                                        letter-spacing: 0.3px;
                                      ">${initials}</span>
                                      <div style="
                                        position: absolute;
                                        bottom: -1px;
                                        right: -1px;
                                        width: 10px;
                                        height: 10px;
                                        border-radius: 50%;
                                        background: ${p.status === 'online' ? '#22c55e' : p.status === 'on_job' ? '#f59e0b' : p.status === 'break' ? '#eab308' : '#94a3b8'};
                                        border: 2px solid white;
                                      "></div>
                                    </div>`,
                                    iconSize: [38, 38],
                                    iconAnchor: [19, 19],
                                  });
                                })()}
                                eventHandlers={{
                                  click: () => {
                                    if (member) {
                                      handleMemberClick(member);
                                    }
                                  }
                                }}
                              >
                                <Popup>
                                  <div className="min-w-[220px] max-w-[280px]" data-testid={`map-popup-${member?.id}`}>
                                    <div className="flex items-center gap-3 mb-3">
                                      <div 
                                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base border-2 border-white shadow-md"
                                        style={{ background: member?.themeColor || statusDisplay.markerBg }}
                                      >
                                        {initials}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm">{getWorkerDisplayName(member)}</p>
                                        <Badge 
                                          className={`text-xs ${
                                            p.status === 'on_job' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                                            p.status === 'online' ? 'bg-green-500/20 text-green-600 dark:text-green-400' :
                                            p.status === 'break' ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400' :
                                            'bg-gray-500/20 text-gray-600 dark:text-gray-400'
                                          } border-0`}
                                        >
                                          {p.status === 'on_job' && <Wrench className="h-3 w-3 mr-1" />}
                                          {p.status === 'online' && <Circle className="h-2 w-2 mr-1 fill-current" />}
                                          {p.status === 'break' && <Coffee className="h-3 w-3 mr-1" />}
                                          {statusDisplay.label}
                                        </Badge>
                                      </div>
                                    </div>
                                    
                                    {p.statusMessage && (
                                      <p className="text-xs text-muted-foreground mb-2 italic">"{p.statusMessage}"</p>
                                    )}

                                    {p.status === 'travelling' && p.destinationJobTitle && (
                                      <div className="flex items-center gap-2 text-sm mb-2 text-orange-600 dark:text-orange-400">
                                        <Navigation2 className="h-4 w-4" />
                                        <span className="truncate">Heading to: {p.destinationJobTitle}</span>
                                      </div>
                                    )}
                                    
                                    {currentJob && p.status !== 'travelling' && (
                                      <div className="flex items-center gap-2 text-sm mb-2">
                                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                                        <span className="truncate">{currentJob.title}</span>
                                      </div>
                                    )}
                                    
                                    {!currentJob && p.status !== 'travelling' && nextJob && (
                                      <div className="flex items-center gap-2 text-sm mb-2 text-muted-foreground">
                                        <Clock className="h-4 w-4" />
                                        <span className="truncate">Next: {nextJob.title}</span>
                                      </div>
                                    )}
                                    
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                                      <Clock className="h-3 w-3" />
                                      {lastSeenTime ? `Active ${lastSeenTime}` : 'Active now'}
                                    </div>
                                    
                                    <div className="flex gap-2 mb-2">
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="flex-1"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (member?.email) {
                                            window.location.href = `mailto:${member.email}`;
                                          }
                                        }}
                                        data-testid={`button-message-${member?.id}`}
                                      >
                                        <MessageSquare className="h-3 w-3 mr-1" />
                                        Message
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="default"
                                        className="flex-1"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (p.lastLocationLat && p.lastLocationLng) {
                                            window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.lastLocationLat},${p.lastLocationLng}`, '_blank');
                                          }
                                        }}
                                        data-testid={`button-navigate-${member?.id}`}
                                      >
                                        <Navigation2 className="h-3 w-3 mr-1" />
                                        Navigate
                                      </Button>
                                    </div>
                                    
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      className="w-full"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (member) handleMemberClick(member);
                                      }}
                                      data-testid={`button-view-profile-${member?.id}`}
                                    >
                                      <User className="h-3 w-3 mr-1" />
                                      View Full Profile
                                    </Button>
                                  </div>
                                </Popup>
                              </Marker>
                            );
                          })}
                        </MapContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center bg-muted/50">
                          <div className="text-center text-muted-foreground">
                            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No location data available</p>
                            <p className="text-xs">Team members will appear here when they share their location</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>

          <Collapsible open={activityOpen} onOpenChange={setActivityOpen}>
            <Card className="h-full">
              <CollapsibleTrigger asChild>
                <div className="cursor-pointer py-3 px-4 flex items-center justify-between gap-2 hover:bg-muted/30 transition-colors rounded-[calc(var(--radius)-1px)]">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Recent Activity</span>
                    <Badge variant="secondary" className="text-xs">{activities.length}</Badge>
                  </div>
                  {activityOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border-t px-4 pb-4 pt-3">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-1">
                      {activities.slice(0, 15).map((activity, index) => (
                        <div
                          key={activity.id}
                          className={`flex items-start gap-3 p-2.5 rounded-xl animate-fade-up stagger-delay-${Math.min(index + 1, 8)} ${
                            activity.isImportant ? 'bg-primary/5' : ''
                          }`}
                          data-testid={`activity-${activity.id}`}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              activity.activityType === 'job_completed' ? 'bg-green-100 dark:bg-green-900/30' :
                              activity.activityType === 'invoice_sent' ? 'bg-blue-100 dark:bg-blue-900/30' :
                              'bg-muted'
                            }`}>
                              {activity.activityType === 'job_completed' ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : activity.activityType === 'invoice_sent' ? (
                                <Send className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Activity className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="font-semibold">{activity.actorName || 'System'}</span>
                              {' '}
                              <span className="text-muted-foreground">{activity.description}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                      {activities.length === 0 && (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center bg-muted">
                            <Activity className="h-7 w-7 text-muted-foreground" />
                          </div>
                          <p className="font-medium mb-1">No recent activity</p>
                          <p className="text-xs text-muted-foreground">Activity will appear here as your team works</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </div>

      <Sheet open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          {selectedMember && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <UserAvatar
                      className="h-16 w-16"
                      fallbackClassName="text-lg"
                      user={{
                        id: selectedMember.userId || selectedMember.id,
                        firstName: selectedMember.firstName,
                        lastName: selectedMember.lastName,
                        email: selectedMember.email,
                        photoUrl: selectedMember.profileImageUrl,
                        themeColor: selectedMember.themeColor,
                      }}
                    />
                    {selectedMember.presence && (
                      <div 
                        className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-background ${
                          selectedMember.presence.status === 'online' || selectedMember.presence.status === 'on_job' 
                            ? 'bg-green-500' 
                            : selectedMember.presence.status === 'busy' 
                              ? 'bg-amber-500' 
                              : 'bg-gray-400'
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <SheetTitle>
                      {getWorkerDisplayName(selectedMember)}
                    </SheetTitle>
                    <p className="text-sm text-muted-foreground">{selectedMember.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedMember.roleName && (
                        <Badge variant="secondary">{selectedMember.roleName}</Badge>
                      )}
                      {selectedMember.presence && (
                        <Badge variant="outline" className={getStatusDisplay(selectedMember.presence.status).text}>
                          {getStatusDisplay(selectedMember.presence.status).label}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Quick Actions */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {selectedMember.phone && (
                    <Button variant="outline" size="sm" className="flex-col h-auto py-3" asChild data-testid="button-call-member">
                      <a href={`tel:${selectedMember.phone}`}>
                        <Phone className="h-5 w-5 mb-1" />
                        <span className="text-xs">Call</span>
                      </a>
                    </Button>
                  )}
                  {selectedMember.phone && (
                    <Button variant="outline" size="sm" className="flex-col h-auto py-3" asChild data-testid="button-sms-member">
                      <a href={`sms:${selectedMember.phone}`}>
                        <MessageCircle className="h-5 w-5 mb-1" />
                        <span className="text-xs">Text</span>
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="flex-col h-auto py-3" asChild data-testid="button-email-member">
                    <a href={`mailto:${selectedMember.email}`}>
                      <Mail className="h-5 w-5 mb-1" />
                      <span className="text-xs">Email</span>
                    </a>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-col h-auto py-3"
                    onClick={() => navigate(`/chat?to=${selectedMember.userId}&type=dm`)}
                    data-testid="button-dm-member"
                  >
                    <Send className="h-5 w-5 mb-1" />
                    <span className="text-xs">Message</span>
                  </Button>
                </div>

                {/* Assign Job Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Assigned Jobs ({selectedMember.assignedJobs.length})</h4>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setAssignJobDialogOpen(true)}
                      disabled={unassignedJobs.length === 0}
                      data-testid="button-assign-job"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Assign Job
                    </Button>
                  </div>
                  <ScrollArea className="h-[180px]">
                    <div className="space-y-2">
                      {selectedMember.assignedJobs.map((job) => (
                        <div
                          key={job.id}
                          className="p-3 border rounded-lg hover-elevate cursor-pointer"
                          onClick={() => navigate(`/jobs/${job.id}`)}
                          data-testid={`member-job-${job.id}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium truncate">{job.title}</p>
                            <Badge variant={job.status === 'in_progress' ? 'default' : 'secondary'}>
                              {job.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          {job.address && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {job.address}
                            </p>
                          )}
                          {job.scheduledAt && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(job.scheduledAt), 'EEE, d MMM h:mm a')}
                            </p>
                          )}
                        </div>
                      ))}
                      {selectedMember.assignedJobs.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">
                          No assigned jobs
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                {/* Recent Activity */}
                <div>
                  <h4 className="font-medium mb-3">Recent Activity</h4>
                  <ScrollArea className="h-[180px]">
                    <div className="space-y-2 pr-3">
                      {selectedMember.recentActivity.slice(0, 5).map((activity) => (
                        <div key={activity.id} className="text-sm p-3 rounded-lg border bg-muted/30">
                          <p className="text-foreground">{activity.description}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      ))}
                      {selectedMember.recentActivity.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">
                          No recent activity
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Assign Job Dialog */}
      <Dialog open={assignJobDialogOpen} onOpenChange={setAssignJobDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Job to {selectedMember?.firstName}</DialogTitle>
            <DialogDescription>
              Select a job to assign to this team member.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Select Job</Label>
            <div className="mt-2">
              <JobPicker
                value={selectedJobToAssign}
                onChange={setSelectedJobToAssign}
                label={null}
                placeholder="Search unassigned jobs..."
                filterJobs={(job) => unassignedJobs.some((j: any) => j.id === job.id)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignJobDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedMember && selectedJobToAssign) {
                  assignJobMutation.mutate({
                    jobId: selectedJobToAssign,
                    userId: selectedMember.userId,
                  });
                }
              }}
              disabled={!selectedJobToAssign || assignJobMutation.isPending}
              data-testid="button-confirm-assign-job"
            >
              {assignJobMutation.isPending ? "Assigning..." : "Assign Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your team
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                  placeholder="John"
                  data-testid="input-invite-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                  placeholder="Smith"
                  data-testid="input-invite-last-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="john@example.com"
                data-testid="input-invite-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value)}
                placeholder="0412 345 678"
                data-testid="input-phone"
              />
              {invitePhone.trim() && (
                <p className="text-xs text-primary">
                  Invite will also be sent via SMS with a smart link to download the app
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Hourly Rate</Label>
              <Input
                id="hourlyRate"
                type="number"
                value={inviteHourlyRate}
                onChange={(e) => setInviteHourlyRate(e.target.value)}
                placeholder="e.g. 85"
                data-testid="input-invite-hourlyrate"
              />
              <p className="text-xs text-muted-foreground">Used for time tracking and invoice labour calculations</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                <SelectTrigger data-testid="select-invite-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id} data-testid={`option-role-${role.name.toLowerCase()}`}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (inviteEmail && inviteFirstName && inviteLastName && inviteRoleId) {
                  inviteMutation.mutate({
                    email: inviteEmail,
                    firstName: inviteFirstName,
                    lastName: inviteLastName,
                    roleId: inviteRoleId,
                    phone: invitePhone.trim() || undefined,
                    hourlyRate: inviteHourlyRate ? parseFloat(inviteHourlyRate) : undefined,
                  });
                }
              }}
              disabled={!inviteEmail || !inviteFirstName || !inviteLastName || !inviteRoleId || inviteMutation.isPending}
              data-testid="button-send-invite"
            >
              {inviteMutation.isPending ? "Sending..." : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ROLE_DESCRIPTION_MAP: Record<string, { description: string; permissions: readonly string[] }> = {
  'WORKER': { description: 'Can view assigned jobs, log time, upload photos, and check in at sites. Cannot create quotes or invoices unless granted extra permissions.', permissions: [...ROLE_PRESETS.worker.permissions] },
  'OFFICE_ADMIN': { description: 'Manages quotes, invoices, and client communication from the office. No field capabilities like GPS or time tracking.', permissions: [...ROLE_PRESETS.office_admin.permissions] },
  'MANAGER': { description: 'Full operational access including all jobs, team scheduling, and financial documents. Cannot manage billing or subscription.', permissions: [...ALL_WORKER_PERMISSIONS] },
  'SUBCONTRACTOR': { description: 'External sub who can only see their assigned jobs. No access to financial data or other team members\' work.', permissions: [...ROLE_PRESETS.subcontractor.permissions] },
};

function getRoleInfo(roleName?: string): { description: string; permissions: string[] } | null {
  if (!roleName) return null;
  const upper = roleName.toUpperCase();
  const info = ROLE_DESCRIPTION_MAP[upper];
  if (info) return { description: info.description, permissions: [...info.permissions] };
  return null;
}

function getMemberPermissionCount(member: TeamMemberData, roleName?: string): { granted: number; total: number } {
  const total = ALL_WORKER_PERMISSIONS.length;
  if (member.useCustomPermissions && member.customPermissions) {
    return { granted: member.customPermissions.length, total };
  }
  const roleInfo = getRoleInfo(roleName);
  if (roleInfo) {
    return { granted: roleInfo.permissions.length, total };
  }
  return { granted: DEFAULT_WORKER_PERMISSIONS.length, total };
}

function getActivePermissionsList(member: TeamMemberData, roleName?: string): string[] {
  if (member.useCustomPermissions && member.customPermissions) {
    return member.customPermissions;
  }
  const roleInfo = getRoleInfo(roleName);
  if (roleInfo) return roleInfo.permissions;
  return [...DEFAULT_WORKER_PERMISSIONS];
}

function TeamAdminTab() {
  const { toast } = useToast();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");
  const [inviteHourlyRate, setInviteHourlyRate] = useState("");
  const [memberToDelete, setMemberToDelete] = useState<TeamMemberData | null>(null);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedMemberForPermissions, setSelectedMemberForPermissions] = useState<TeamMemberData | null>(null);
  const [editedPermissions, setEditedPermissions] = useState<string[]>([]);
  const [useCustomPermissions, setUseCustomPermissions] = useState(false);
  const [expandedPermissionMembers, setExpandedPermissionMembers] = useState<Set<string>>(new Set());

  const { data: teamMembers, isLoading: membersLoading } = useQuery<TeamMemberData[]>({
    queryKey: ['/api/team/members'],
  });

  const { data: roles, isLoading: rolesLoading } = useQuery<UserRole[]>({
    queryKey: ['/api/team/roles'],
  });

  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ['/api/jobs'],
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      firstName: string;
      lastName: string;
      roleId: string;
      hourlyRate?: number;
    }) => {
      const response = await apiRequest('POST', '/api/team/members/invite', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/members'] });
      toast({
        title: "Invite sent",
        description: "Team member invitation has been sent successfully.",
      });
      setInviteDialogOpen(false);
      resetInviteForm();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send invite",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await apiRequest('DELETE', `/api/team/members/${memberId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/members'] });
      toast({
        title: "Member removed",
        description: "The team member has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove member",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, roleId }: { memberId: string; roleId: string }) => {
      const response = await apiRequest('PATCH', `/api/team/members/${memberId}`, { roleId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/members'] });
      toast({
        title: "Role updated",
        description: "Team member's role has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update role",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await apiRequest('POST', `/api/team/members/${memberId}/resend-invite`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/members'] });
      toast({
        title: "Invite resent",
        description: "The invitation has been resent successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to resend invite",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ memberId, permissions, useCustomPermissions }: { memberId: string; permissions: string[]; useCustomPermissions: boolean }) => {
      const response = await apiRequest('PATCH', `/api/team/members/${memberId}/permissions`, { 
        permissions, 
        useCustomPermissions 
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/members'] });
      toast({
        title: "Permissions updated",
        description: "Team member's permissions have been updated.",
      });
      setPermissionsDialogOpen(false);
      setSelectedMemberForPermissions(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update permissions",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const openPermissionsDialog = (member: TeamMemberData) => {
    setSelectedMemberForPermissions(member);
    setUseCustomPermissions(member.useCustomPermissions ?? false);
    setEditedPermissions(member.customPermissions || [...DEFAULT_WORKER_PERMISSIONS]);
    setPermissionsDialogOpen(true);
  };

  const togglePermission = (permission: string) => {
    setEditedPermissions(prev => 
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const resetInviteForm = () => {
    setInviteEmail("");
    setInviteFirstName("");
    setInviteLastName("");
    setInviteRoleId("");
    setInviteHourlyRate("");
  };

  const handleInvite = () => {
    if (!inviteEmail || !inviteFirstName || !inviteLastName || !inviteRoleId) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    inviteMutation.mutate({
      email: inviteEmail,
      firstName: inviteFirstName,
      lastName: inviteLastName,
      roleId: inviteRoleId,
      hourlyRate: inviteHourlyRate ? parseFloat(inviteHourlyRate) : undefined,
    });
  };

  const filteredMembers = useMemo(() => {
    if (!teamMembers) return [];
    return teamMembers.filter((member) => {
      const matchesSearch = searchQuery === "" ||
        member.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Handle 'pending' filter to also match legacy 'invited' status
      const matchesStatus = statusFilter === "all" || 
        member.inviteStatus === statusFilter ||
        (statusFilter === "pending" && member.inviteStatus === "invited");
      
      return matchesSearch && matchesStatus;
    });
  }, [teamMembers, searchQuery, statusFilter]);

  const pendingCount = teamMembers?.filter(m => m.inviteStatus === 'pending' || m.inviteStatus === 'invited').length || 0;
  const activeCount = teamMembers?.filter(m => m.inviteStatus === 'accepted').length || 0;

  const acceptedMembers = useMemo(() => {
    return teamMembers?.filter(m => m.inviteStatus === 'accepted') || [];
  }, [teamMembers]);

  const getMemberCurrentJob = (memberId: string) => {
    const now = new Date();
    return jobs.find((j: any) => {
      if (j.assignedTo !== memberId) return false;
      if (j.status === 'in_progress') return true;
      if (j.status === 'scheduled' && j.scheduledAt) {
        return isSameDay(new Date(j.scheduledAt), now);
      }
      return false;
    });
  };

  const onJobCount = useMemo(() => {
    const now = new Date();
    return acceptedMembers.filter(m =>
      jobs.some((j: any) => {
        if (j.assignedTo !== m.userId) return false;
        if (j.status === 'in_progress') return true;
        if (j.status === 'scheduled' && j.scheduledAt) {
          return isSameDay(new Date(j.scheduledAt), now);
        }
        return false;
      })
    ).length;
  }, [acceptedMembers, jobs]);

  const totalHourlyCost = useMemo(() => {
    return acceptedMembers.reduce((sum, m) => sum + (parseFloat(m.hourlyRate || '0') || 0), 0);
  }, [acceptedMembers]);

  if (membersLoading || rolesLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 section-gap">
      <div className="flex gap-2.5 flex-wrap">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-muted/50 border animate-fade-up stagger-delay-1">
          <div className="text-2xl font-bold tabular-nums text-success">{activeCount}</div>
          <div className="text-xs text-muted-foreground leading-tight font-medium">Active members</div>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-muted/50 border animate-fade-up stagger-delay-2">
          <div className="text-2xl font-bold tabular-nums text-warning">{pendingCount}</div>
          <div className="text-xs text-muted-foreground leading-tight font-medium">Pending invites</div>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-muted/50 border animate-fade-up stagger-delay-3">
          <div className="text-2xl font-bold tabular-nums">{onJobCount}</div>
          <div className="text-xs text-muted-foreground leading-tight font-medium">On job today</div>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-muted/50 border animate-fade-up stagger-delay-4">
          <div className="text-2xl font-bold tabular-nums">${totalHourlyCost.toFixed(0)}</div>
          <div className="text-xs text-muted-foreground leading-tight font-medium">$/hr total</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 flex-1">
          <Input
            placeholder="Search team members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:max-w-xs"
            data-testid="input-search-members"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-status-filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({teamMembers?.length || 0})</SelectItem>
              <SelectItem value="accepted">Active ({activeCount})</SelectItem>
              <SelectItem value="pending">Pending ({pendingCount})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => setRolesDialogOpen(true)} data-testid="button-manage-roles">
            <Shield className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Manage Roles</span>
            <span className="sm:hidden">Roles</span>
          </Button>
          <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setInviteDialogOpen(true)} data-testid="button-invite-member">
            <UserPlus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Invite Member</span>
            <span className="sm:hidden">Invite</span>
          </Button>
        </div>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Members ({filteredMembers.length})</p>
      <div className="grid gap-3">
        {filteredMembers.map((member, index) => {
          const role = roles?.find(r => r.id === member.roleId);
          const isPending = member.inviteStatus === 'pending' || member.inviteStatus === 'invited';
          const currentJob = member.userId ? getMemberCurrentJob(member.userId) : null;
          return (
            <Card 
              key={member.id} 
              data-testid={`member-card-${member.id}`}
              className={`animate-fade-up stagger-delay-${Math.min(index + 1, 8)} ${isPending ? 'border-amber-200 dark:border-amber-800' : ''}`}
            >
              <div className="p-4">
                {isPending && (
                  <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                      <Clock className="h-4 w-4" />
                      <span>Invitation pending</span>
                      {member.inviteSentAt && (
                        <span className="text-xs text-muted-foreground">
                          (sent {formatDistanceToNow(new Date(member.inviteSentAt), { addSuffix: true })})
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resendInviteMutation.mutate(member.id)}
                      disabled={resendInviteMutation.isPending}
                      className="text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-700"
                      data-testid={`button-resend-${member.id}`}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Resend
                    </Button>
                  </div>
                )}
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    {isPending ? (
                      <UserAvatar
                        className="h-11 w-11 sm:h-12 sm:w-12 shrink-0 opacity-70"
                        user={{
                          id: member.userId || member.id,
                          firstName: member.firstName,
                          lastName: member.lastName,
                          email: member.email,
                          photoUrl: member.profileImageUrl,
                          themeColor: '#f59e0b',
                        }}
                      />
                    ) : (
                      <UserAvatar
                        className="h-11 w-11 sm:h-12 sm:w-12 shrink-0"
                        user={{
                          id: member.userId || member.id,
                          firstName: member.firstName,
                          lastName: member.lastName,
                          email: member.email,
                          photoUrl: member.profileImageUrl,
                          themeColor: member.themeColor,
                        }}
                      />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-base truncate">
                        {getWorkerDisplayName(member)}
                      </p>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        <Badge variant="secondary" className="text-xs">{role?.name || 'No Role'}</Badge>
                        <Badge 
                          variant={member.inviteStatus === 'accepted' ? 'default' : 'secondary'} 
                          className={`text-xs ${isPending ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}`}
                        >
                          {member.inviteStatus === 'accepted' ? 'Active' : 'Pending'}
                        </Badge>
                        {member.hourlyRate && (
                          <Badge variant="outline" className="text-xs">${member.hourlyRate}/hr</Badge>
                        )}
                        {(() => {
                          const { granted, total } = getMemberPermissionCount(member, role?.name);
                          const pct = Math.round((granted / total) * 100);
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className="text-xs gap-1 cursor-help">
                                  <Key className="h-2.5 w-2.5" />
                                  {granted}/{total}
                                  {member.useCustomPermissions && <span className="text-[9px] opacity-70">custom</span>}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="text-xs">{granted} of {total} permissions granted ({pct}%)</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1 pl-0 lg:pl-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {currentJob ? (
                        <span className="truncate font-medium">{currentJob.title}</span>
                      ) : (
                        <span className="text-muted-foreground truncate">No active job</span>
                      )}
                    </div>
                    {member.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <a href={`tel:${member.phone}`} className="text-muted-foreground truncate hover:underline">
                          {member.phone}
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <a href={`mailto:${member.email}`} className="text-muted-foreground truncate hover:underline">
                        {member.email}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-auto lg:ml-0">
                    <Select
                      value={member.roleId || ""}
                      onValueChange={(value) => updateRoleMutation.mutate({ memberId: member.id, roleId: value })}
                    >
                      <SelectTrigger className="w-[120px] sm:w-[140px]" data-testid={`select-role-${member.id}`}>
                        <SelectValue placeholder="Change role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roles?.filter(r => r.name !== 'OWNER').map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openPermissionsDialog(member)}
                      title="Edit permissions"
                      data-testid={`button-permissions-${member.id}`}
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMemberToDelete(member)}
                      data-testid={`button-remove-${member.id}`}
                    >
                      <UserX className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-border/50">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedPermissionMembers(prev => {
                        const next = new Set(prev);
                        if (next.has(member.id)) {
                          next.delete(member.id);
                        } else {
                          next.add(member.id);
                        }
                        return next;
                      });
                    }}
                    data-testid={`button-what-can-do-${member.id}`}
                  >
                    <Eye className="h-3 w-3" />
                    <span>What can they do?</span>
                    {expandedPermissionMembers.has(member.id) ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                  {expandedPermissionMembers.has(member.id) && (() => {
                    const activePerms = getActivePermissionsList(member, role?.name);
                    return (
                      <div className="mt-2 space-y-1.5">
                        {Object.entries(PERMISSION_CATEGORIES).map(([catKey, category]) => {
                          const catPerms = category.permissions.filter(p => activePerms.includes(p));
                          const allDenied = catPerms.length === 0;
                          return (
                            <div key={catKey} className="flex items-start gap-1.5">
                              {allDenied ? (
                                <X className="h-3 w-3 text-muted-foreground/50 shrink-0 mt-0.5" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0 mt-0.5" />
                              )}
                              <div className="min-w-0">
                                <span className={`text-xs ${allDenied ? 'text-muted-foreground/50 line-through' : 'font-medium'}`}>
                                  {category.label}
                                </span>
                                {!allDenied && (
                                  <span className="text-[11px] text-muted-foreground ml-1">
                                    ({catPerms.map(p => PERMISSION_LABELS[p as WorkerPermission] || p).join(', ')})
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </Card>
          );
        })}

        {filteredMembers.length === 0 && (
          <Card className="p-8 text-center">
            <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
              <Users className="h-10 w-10" style={{ color: 'hsl(var(--trade) / 0.4)' }} />
            </div>
            <p className="font-medium mb-1">
              {searchQuery || statusFilter !== 'all'
                ? 'No team members match your filters'
                : 'No team members yet'}
            </p>
            <p className="text-xs text-muted-foreground">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Invite your first team member to get started!'}
            </p>
          </Card>
        )}
      </div>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent data-testid="dialog-invite-member">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                  placeholder="John"
                  data-testid="input-invite-firstname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                  placeholder="Smith"
                  data-testid="input-invite-lastname"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="john@example.com"
                data-testid="input-invite-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                <SelectTrigger data-testid="select-invite-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles?.filter(r => r.name !== 'OWNER').map((role) => {
                    const info = getRoleInfo(role.name);
                    return (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{role.name}</span>
                          {info && (
                            <span className="text-xs text-muted-foreground leading-tight">{info.description.split('.')[0]}.</span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {inviteRoleId && (() => {
                const selectedRole = roles?.find(r => r.id === inviteRoleId);
                const info = getRoleInfo(selectedRole?.name);
                if (!info) return null;
                return (
                  <div className="p-3 rounded-md border bg-muted/30 space-y-2">
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <p className="text-xs text-muted-foreground leading-tight">{info.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {info.permissions.slice(0, 6).map(p => (
                        <Badge key={p} variant="secondary" className="text-[10px]">
                          {PERMISSION_LABELS[p as WorkerPermission] || p}
                        </Badge>
                      ))}
                      {info.permissions.length > 6 && (
                        <Badge variant="outline" className="text-[10px]">+{info.permissions.length - 6} more</Badge>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Hourly Rate</Label>
              <Input
                id="hourlyRate"
                type="number"
                value={inviteHourlyRate}
                onChange={(e) => setInviteHourlyRate(e.target.value)}
                placeholder="e.g. 85"
                data-testid="input-invite-hourlyrate"
              />
              <p className="text-xs text-muted-foreground">Used for time tracking and invoice labour calculations</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviteMutation.isPending} data-testid="button-send-invite">
              {inviteMutation.isPending ? "Sending..." : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rolesDialogOpen} onOpenChange={setRolesDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-manage-roles">
          <DialogHeader>
            <DialogTitle>Manage Roles</DialogTitle>
            <DialogDescription>
              View team roles and their included permissions.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {roles?.map((role) => {
                const info = getRoleInfo(role.name);
                const isOwnerRole = role.name === 'OWNER';
                return (
                  <div key={role.id} className="border rounded-lg overflow-hidden" data-testid={`role-${role.id}`}>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-semibold">{role.name}</h4>
                        {isOwnerRole && (
                          <Badge variant="secondary" className="text-xs">System</Badge>
                        )}
                        {info && (
                          <Badge variant="outline" className="text-xs ml-auto">
                            {info.permissions.length} of {ALL_WORKER_PERMISSIONS.length} permissions
                          </Badge>
                        )}
                        {isOwnerRole && (
                          <Badge variant="outline" className="text-xs ml-auto">Full Access</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {info?.description || role.description || 'No description'}
                      </p>
                    </div>
                    {info && (
                      <div className="px-4 pb-4">
                        <div className="space-y-2">
                          {Object.entries(PERMISSION_CATEGORIES).map(([catKey, category]) => {
                            const catPerms = category.permissions.filter(p => info.permissions.includes(p));
                            if (catPerms.length === 0) return null;
                            return (
                              <div key={catKey} className="flex items-start gap-2">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-xs font-medium">{category.label}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {catPerms.map(p => PERMISSION_LABELS[p as WorkerPermission] || p).join(', ')}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                          {(() => {
                            const deniedCategories = Object.entries(PERMISSION_CATEGORIES).filter(([, category]) =>
                              category.permissions.every(p => !info.permissions.includes(p))
                            );
                            if (deniedCategories.length === 0) return null;
                            return deniedCategories.map(([catKey, category]) => (
                              <div key={catKey} className="flex items-start gap-2 opacity-50">
                                <X className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                <p className="text-xs text-muted-foreground">{category.label}</p>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                    {isOwnerRole && (
                      <div className="px-4 pb-4">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                          <p className="text-xs text-muted-foreground">All permissions including team management and billing</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!memberToDelete} onOpenChange={(open) => !open && setMemberToDelete(null)}>
        <AlertDialogContent data-testid="dialog-confirm-remove">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{getWorkerDisplayName(memberToDelete)}</strong> from your team? 
              This action cannot be undone and they will lose access to your business.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (memberToDelete) {
                  removeMemberMutation.mutate(memberToDelete.id);
                  setMemberToDelete(null);
                }
              }}
              data-testid="button-confirm-remove"
            >
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={permissionsDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setPermissionsDialogOpen(false);
          setSelectedMemberForPermissions(null);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col" data-testid="dialog-permissions">
          <DialogHeader className="shrink-0">
            <DialogTitle>Edit Permissions</DialogTitle>
            <DialogDescription>
              {selectedMemberForPermissions ? (
                <>Manage permissions for <strong>{getWorkerDisplayName(selectedMemberForPermissions)}</strong></>
              ) : (
                'Configure team member permissions'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label htmlFor="use-custom-permissions" className="text-base font-medium">Use Custom Permissions</Label>
                  <p className="text-sm text-muted-foreground">
                    Override role-based permissions with custom settings
                  </p>
                </div>
                <Switch
                  id="use-custom-permissions"
                  checked={useCustomPermissions}
                  onCheckedChange={setUseCustomPermissions}
                  data-testid="switch-use-custom-permissions"
                />
              </div>

              {!useCustomPermissions ? (
                <div className="p-6 border rounded-lg bg-muted/50 text-center">
                  <Shield className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="font-medium">Using Default Permissions</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This team member is using the default permissions assigned to their role.
                    Enable custom permissions above to override.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Quick Presets</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start gap-2"
                        onClick={() => {
                          setEditedPermissions([
                            WORKER_PERMISSIONS.UPDATE_JOB_STATUS,
                            WORKER_PERMISSIONS.TIME_TRACKING,
                            WORKER_PERMISSIONS.GPS_CHECKIN,
                          ]);
                          setUseCustomPermissions(true);
                        }}
                        data-testid="preset-field-worker"
                      >
                        <Wrench className="h-4 w-4 shrink-0" />
                        <span className="truncate">Field Worker</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start gap-2"
                        onClick={() => {
                          setEditedPermissions([
                            WORKER_PERMISSIONS.UPDATE_JOB_STATUS,
                            WORKER_PERMISSIONS.TIME_TRACKING,
                            WORKER_PERMISSIONS.GPS_CHECKIN,
                            WORKER_PERMISSIONS.CREATE_QUOTES,
                            WORKER_PERMISSIONS.VIEW_QUOTES,
                            WORKER_PERMISSIONS.COLLECT_PAYMENTS,
                            WORKER_PERMISSIONS.VIEW_CLIENTS,
                            WORKER_PERMISSIONS.TEAM_CHAT,
                          ]);
                          setUseCustomPermissions(true);
                        }}
                        data-testid="preset-senior-tradie"
                      >
                        <Award className="h-4 w-4 shrink-0" />
                        <span className="truncate">Senior Tradie</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start gap-2"
                        onClick={() => {
                          setEditedPermissions([
                            WORKER_PERMISSIONS.VIEW_ALL_JOBS,
                            WORKER_PERMISSIONS.CREATE_QUOTES,
                            WORKER_PERMISSIONS.VIEW_QUOTES,
                            WORKER_PERMISSIONS.CREATE_INVOICES,
                            WORKER_PERMISSIONS.VIEW_INVOICES,
                            WORKER_PERMISSIONS.EDIT_DOCUMENTS,
                            WORKER_PERMISSIONS.SEND_QUOTES,
                            WORKER_PERMISSIONS.SEND_INVOICES,
                            WORKER_PERMISSIONS.VIEW_CLIENTS,
                            WORKER_PERMISSIONS.CREATE_CLIENTS,
                            WORKER_PERMISSIONS.EDIT_CLIENTS,
                            WORKER_PERMISSIONS.TEAM_CHAT,
                            WORKER_PERMISSIONS.CLIENT_SMS,
                          ]);
                          setUseCustomPermissions(true);
                        }}
                        data-testid="preset-office-staff"
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate">Office Staff</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="justify-start gap-2"
                        onClick={() => {
                          setEditedPermissions([...ALL_WORKER_PERMISSIONS]);
                          setUseCustomPermissions(true);
                        }}
                        data-testid="preset-full-access"
                      >
                        <Key className="h-4 w-4 shrink-0" />
                        <span className="truncate">Full Access</span>
                      </Button>
                    </div>
                  </div>
                  <Separator />
                  {Object.entries(PERMISSION_CATEGORIES).map(([categoryKey, category]) => (
                    <div key={categoryKey} className="border rounded-lg">
                      <div className="p-3 bg-muted/30 border-b">
                        <h4 className="font-medium text-sm">{category.label}</h4>
                        <p className="text-xs text-muted-foreground">{category.description}</p>
                      </div>
                      <div className="divide-y">
                        {category.permissions.map((permission) => (
                          <div key={permission} className="flex items-center justify-between p-3">
                            <Label htmlFor={`perm-${permission}`} className="text-sm cursor-pointer flex-1">
                              {PERMISSION_LABELS[permission as WorkerPermission] || permission}
                            </Label>
                            <Switch
                              id={`perm-${permission}`}
                              checked={editedPermissions.includes(permission)}
                              onCheckedChange={() => togglePermission(permission)}
                              data-testid={`switch-permission-${permission}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setPermissionsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (selectedMemberForPermissions) {
                  updatePermissionsMutation.mutate({
                    memberId: selectedMemberForPermissions.id,
                    permissions: editedPermissions,
                    useCustomPermissions,
                  });
                }
              }}
              disabled={updatePermissionsMutation.isPending}
              data-testid="button-save-permissions"
            >
              {updatePermissionsMutation.isPending ? "Saving..." : "Save Permissions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SchedulingTab() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [timeOffDialogOpen, setTimeOffDialogOpen] = useState(false);
  const [timeOffStart, setTimeOffStart] = useState("");
  const [timeOffEnd, setTimeOffEnd] = useState("");
  const [timeOffReason, setTimeOffReason] = useState("annual_leave");
  const [timeOffNotes, setTimeOffNotes] = useState("");
  const [timeOffSectionOpen, setTimeOffSectionOpen] = useState(true);
  const [availabilitySectionOpen, setAvailabilitySectionOpen] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [quickAssignCell, setQuickAssignCell] = useState<{ memberId: string; memberUserId: string; memberName: string; dayKey: string; dayLabel: string } | null>(null);
  const [quickAssignSearch, setQuickAssignSearch] = useState("");
  const [schedulingTipDismissed, setSchedulingTipDismissed] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('team-scheduler-onboarding-dismissed') === 'true'
  );

  const { data: teamMembers = [] } = useQuery<TeamMemberData[]>({
    queryKey: ['/api/team/members'],
  });

  const { data: jobs = [] } = useQuery<JobData[]>({
    queryKey: ['/api/jobs'],
  });

  const { data: timeOff = [] } = useQuery<TeamMemberTimeOff[]>({
    queryKey: ['/api/team/time-off'],
  });

  const { data: availability = [] } = useQuery<TeamMemberAvailability[]>({
    queryKey: ['/api/team/availability', selectedMember],
    enabled: !!selectedMember,
  });

  const updateAvailabilityMutation = useMutation({
    mutationFn: async (data: { teamMemberId: string; dayOfWeek: number; isAvailable: boolean; startTime?: string; endTime?: string }) => {
      const response = await apiRequest('POST', '/api/team/availability', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/availability'] });
      toast({ title: "Availability updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const requestTimeOffMutation = useMutation({
    mutationFn: async (data: { teamMemberId: string; startDate: string; endDate: string; reason: string; notes?: string }) => {
      const response = await apiRequest('POST', '/api/team/time-off', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/time-off'] });
      toast({ title: "Time off requested" });
      setTimeOffDialogOpen(false);
      setTimeOffStart("");
      setTimeOffEnd("");
      setTimeOffReason("annual_leave");
      setTimeOffNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to request time off", description: error.message, variant: "destructive" });
    },
  });

  const approveTimeOffMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      const response = await apiRequest('PATCH', `/api/team/time-off/${id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/time-off'] });
      toast({ title: "Time off updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const acceptedMembers = teamMembers.filter(m => m.inviteStatus === 'accepted');

  const today = new Date();
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekStart = addDays(currentWeekStart, weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const isCurrentWeek = weekOffset === 0;

  const isWeekday = (date: Date) => {
    const day = date.getDay();
    return day >= 1 && day <= 5;
  };

  const isWeekend = (date: Date) => !isWeekday(date);

  const getMemberTimeOffForDay = (memberId: string, date: Date) => {
    return timeOff.filter(t => {
      if (t.teamMemberId !== memberId) return false;
      if (t.status !== 'approved' && t.status !== 'pending') return false;
      const start = new Date(t.startDate);
      const end = new Date(t.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      const checkDate = new Date(date);
      checkDate.setHours(12, 0, 0, 0);
      return checkDate >= start && checkDate <= end;
    });
  };

  const getMemberJobsForDay = (userId: string | undefined, date: Date) => {
    if (!userId) return [];
    return jobs.filter(j => {
      if (j.assignedTo !== userId) return false;
      if (j.status === 'completed' || j.status === 'cancelled') return false;
      if (j.scheduledAt) {
        const jobDate = new Date(j.scheduledAt);
        return isSameDay(jobDate, date);
      }
      if (j.status === 'in_progress') {
        return isSameDay(date, today);
      }
      return false;
    });
  };

  const isMemberAvailableDay = (memberId: string, date: Date) => {
    const dayTimeOff = getMemberTimeOffForDay(memberId, date);
    const hasApprovedTimeOff = dayTimeOff.some(t => t.status === 'approved');
    return !hasApprovedTimeOff;
  };

  const todaySummary = useMemo(() => {
    let workingToday = 0;
    let offToday = 0;
    let onJob = 0;
    let available = 0;

    acceptedMembers.forEach(member => {
      const isAvail = isMemberAvailableDay(member.id, today);
      const memberJobs = getMemberJobsForDay(member.userId, today);
      const hasJob = memberJobs.length > 0;

      if (isAvail) {
        workingToday++;
        if (hasJob) {
          onJob++;
        } else {
          available++;
        }
      } else {
        offToday++;
      }
    });

    return { workingToday, offToday, onJob, available };
  }, [acceptedMembers, timeOff, jobs, today]);

  const pendingTimeOff = timeOff.filter(t => t.status === 'pending');
  const upcomingTimeOff = timeOff.filter(t =>
    t.status === 'approved' && isAfter(new Date(t.endDate), new Date())
  );

  const todayUnassignedJobs = useMemo(() => {
    return jobs.filter(j => {
      if (j.assignedTo) return false;
      if (j.status === 'completed' || j.status === 'cancelled') return false;
      if (j.scheduledAt) {
        return isSameDay(new Date(j.scheduledAt), today);
      }
      return j.status === 'pending' || j.status === 'scheduled';
    });
  }, [jobs, today]);


  const [peopleControlTab, setPeopleControlTab] = useState<'timeoff' | 'availability'>('timeoff');
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  const assignJobMutation = useMutation({
    mutationFn: async ({ jobId, assignedTo, scheduledAt }: { jobId: string; assignedTo?: string | null; scheduledAt?: string }) => {
      const response = await apiRequest('PATCH', `/api/jobs/${jobId}`, { assignedTo, ...(scheduledAt ? { scheduledAt } : {}) });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({ title: "Job assignment updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update assignment", description: error.message, variant: "destructive" });
    },
  });

  const weekJobs = useMemo(() => {
    const grouped: Record<string, JobData[]> = {};
    weekDays.forEach((day) => {
      const key = format(day, 'yyyy-MM-dd');
      grouped[key] = [];
    });
    jobs.filter(j => j.status !== 'completed' && j.status !== 'cancelled' && j.scheduledAt).forEach(j => {
      const jobDate = new Date(j.scheduledAt!);
      const key = format(jobDate, 'yyyy-MM-dd');
      if (grouped[key]) {
        grouped[key].push(j);
      }
    });
    return grouped;
  }, [jobs, weekDays]);

  const backlogJobs = useMemo(() => {
    return jobs.filter(j =>
      !j.scheduledAt &&
      (j.status === 'pending' || j.status === 'scheduled')
    );
  }, [jobs]);

  const allUnassignedJobs = useMemo(() => {
    return jobs.filter(j => !j.assignedTo && j.status !== 'completed' && j.status !== 'cancelled');
  }, [jobs]);

  const getJobTime = (job: JobData) => {
    if (job.scheduledTime) return job.scheduledTime;
    if (job.scheduledAt) {
      const d = new Date(job.scheduledAt);
      const hours = d.getHours();
      const mins = d.getMinutes();
      if (hours !== 0 || mins !== 0) return format(d, 'h:mm a');
    }
    return null;
  };

  const getJobStatusStyle = (status: string) => {
    switch (status) {
      case 'in_progress':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'scheduled':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
      case 'pending':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getJobStatusLabel = (status: string) => {
    switch (status) {
      case 'in_progress': return 'In Progress';
      case 'scheduled': return 'Scheduled';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  const handleDragStart = (e: React.DragEvent, type: 'job' | 'member', id: string, sourceDay?: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type, id, sourceDay }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget(targetId);
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDropOnJob = (e: React.DragEvent, jobId: string) => {
    e.preventDefault();
    setDragOverTarget(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.type === 'member') {
        assignJobMutation.mutate({ jobId, assignedTo: data.id });
      }
    } catch {}
  };

  const handleDropOnDayColumn = (e: React.DragEvent, dayDate: string) => {
    e.preventDefault();
    setDragOverTarget(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.type === 'job') {
        const scheduledAt = new Date(dayDate + 'T09:00:00').toISOString();
        assignJobMutation.mutate({ jobId: data.id, scheduledAt });
      }
    } catch {}
  };

  const handleDropOnTeamCell = (e: React.DragEvent, memberId: string, dayDate: string) => {
    e.preventDefault();
    setDragOverTarget(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.type === 'job') {
        const scheduledAt = new Date(dayDate + 'T09:00:00').toISOString();
        assignJobMutation.mutate({ jobId: data.id, assignedTo: memberId, scheduledAt });
      }
    } catch {}
  };

  const getMemberById = (userId: string) => {
    return acceptedMembers.find(m => m.userId === userId);
  };

  const getSuburb = (address?: string | null) => {
    if (!address) return null;
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 2) return parts[parts.length - 2];
    return parts[0]?.length > 25 ? parts[0].substring(0, 22) + '...' : parts[0];
  };

  const getMemberWeeklyJobCount = (userId: string | undefined) => {
    if (!userId) return 0;
    return weekDays.reduce((total, day) => total + getMemberJobsForDay(userId, day).length, 0);
  };

  const dailyTotals = useMemo(() => {
    return weekDays.map(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      let totalJobs = 0;
      acceptedMembers.forEach(member => {
        totalJobs += getMemberJobsForDay(member.userId, day).length;
      });
      return { dayKey, totalJobs };
    });
  }, [weekDays, acceptedMembers, jobs]);

  const urgentUnassignedJobs = useMemo(() => {
    return allUnassignedJobs.filter(j => {
      if (j.status === 'in_progress') return true;
      if (j.scheduledAt && isBefore(new Date(j.scheduledAt), today)) return true;
      if (j.scheduledAt && isSameDay(new Date(j.scheduledAt), today)) return true;
      return false;
    });
  }, [allUnassignedJobs, today]);

  const regularUnassignedJobs = useMemo(() => {
    return allUnassignedJobs.filter(j => !urgentUnassignedJobs.includes(j));
  }, [allUnassignedJobs, urgentUnassignedJobs]);

  const renderJobCard = (job: JobData, options?: { draggable?: boolean; compact?: boolean; showUrgent?: boolean }) => {
    const isDraggable = options?.draggable !== false;
    const isCompact = options?.compact;
    const isUnassigned = !job.assignedTo;
    const assignedMember = job.assignedTo ? getMemberById(job.assignedTo) : null;
    const jobTime = getJobTime(job);
    const isDropTarget = dragOverTarget === `job-${job.id}`;
    const suburb = getSuburb(job.address);
    const isOverdue = job.scheduledAt && isBefore(new Date(job.scheduledAt), today) && !isSameDay(new Date(job.scheduledAt), today);
    const isToday = job.scheduledAt && isSameDay(new Date(job.scheduledAt), today);

    return (
      <div
        key={job.id}
        draggable={isDraggable}
        onDragStart={isDraggable ? (e) => handleDragStart(e, 'job', job.id, job.scheduledAt ? format(new Date(job.scheduledAt), 'yyyy-MM-dd') : undefined) : undefined}
        onDragOver={isUnassigned ? (e) => handleDragOver(e, `job-${job.id}`) : undefined}
        onDragLeave={isUnassigned ? handleDragLeave : undefined}
        onDrop={isUnassigned ? (e) => handleDropOnJob(e, job.id) : undefined}
        className={`p-2 rounded-md border text-left ${
          options?.showUrgent && isOverdue
            ? 'bg-red-50/50 dark:bg-red-900/10 border-red-300/50 dark:border-red-800/30'
            : options?.showUrgent && isToday
              ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-300/50 dark:border-amber-800/30'
              : isUnassigned
                ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-800/30'
                : job.status === 'in_progress'
                  ? 'bg-green-50/30 dark:bg-green-900/5 border-green-200/50 dark:border-green-800/30'
                  : 'border-border'
        } ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''} ${
          isDropTarget ? 'ring-2 ring-dashed ring-primary/50 bg-primary/5' : ''
        }`}
        data-testid={`job-card-${job.id}`}
      >
        <div className="flex items-start gap-1.5">
          <div className="flex-1 min-w-0">
            <p className={`font-medium truncate ${isCompact ? 'text-[11px]' : 'text-xs'}`}>{job.title}</p>
            {!isCompact && (
              <div className="flex flex-col gap-0.5 mt-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {jobTime && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {jobTime}
                    </span>
                  )}
                  {job.estimatedDuration && (
                    <span className="text-[10px] text-muted-foreground">
                      {job.estimatedDuration >= 60 ? `${Math.floor(job.estimatedDuration / 60)}h${job.estimatedDuration % 60 ? ` ${job.estimatedDuration % 60}m` : ''}` : `${job.estimatedDuration}m`}
                    </span>
                  )}
                  {job.clientName && (
                    <span className="text-[10px] text-muted-foreground truncate">{job.clientName}</span>
                  )}
                </div>
                {suburb && (
                  <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5 truncate">
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    {suburb}
                  </span>
                )}
                {isUnassigned && job.scheduledAt && (
                  <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground/70'}`}>
                    <Calendar className="h-2.5 w-2.5 shrink-0" />
                    {isOverdue ? 'Overdue: ' : ''}{format(new Date(job.scheduledAt), 'MMM d')}
                  </span>
                )}
              </div>
            )}
          </div>
          {assignedMember && (
            <UserAvatar
              className="h-5 w-5 shrink-0"
              fallbackClassName="text-[8px]"
              user={{
                id: assignedMember.userId || assignedMember.id,
                firstName: assignedMember.firstName,
                lastName: assignedMember.lastName,
                email: assignedMember.email,
                photoUrl: assignedMember.profileImageUrl,
                themeColor: assignedMember.themeColor,
              }}
            />
          )}
          {isUnassigned && isOverdue && (
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
          )}
          {isUnassigned && !isOverdue && (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
          )}
        </div>
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          <Badge
            variant="secondary"
            className={`text-[9px] px-1 py-0 border-0 ${getJobStatusStyle(job.status)}`}
          >
            {getJobStatusLabel(job.status)}
          </Badge>
          {isCompact && job.clientName && (
            <span className="text-[9px] text-muted-foreground truncate">{job.clientName}</span>
          )}
          {isCompact && jobTime && (
            <span className="text-[9px] text-muted-foreground">{jobTime}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-3">
      {!schedulingTipDismissed && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/20 bg-primary/5">
          <Info className="h-4 w-4 text-primary flex-shrink-0" />
          <p className="text-xs flex-1">
            <span className="font-medium">Tip:</span> Drag unassigned jobs onto a team member's day to assign and schedule them.
          </p>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              localStorage.setItem('team-scheduler-onboarding-dismissed', 'true');
              setSchedulingTipDismissed(true);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs gap-1">
            <UserCheck className="h-3 w-3" />
            {todaySummary.workingToday} Working
          </Badge>
          <Badge variant="secondary" className="text-xs gap-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-0">
            <UserX className="h-3 w-3" />
            {todaySummary.offToday} Off
          </Badge>
          <Badge variant="secondary" className="text-xs gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-0">
            <Briefcase className="h-3 w-3" />
            {todaySummary.onJob} On Job
          </Badge>
          <Badge variant="secondary" className="text-xs gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-0">
            <Clock className="h-3 w-3" />
            {todaySummary.available} Available
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          {allUnassignedJobs.length > 0 && (
            <Badge variant="secondary" className="text-xs gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-0">
              <AlertTriangle className="h-3 w-3" />
              {allUnassignedJobs.length} unassigned
            </Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Team Schedule Board
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWeekOffset(prev => prev - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {!isCurrentWeek && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWeekOffset(0)}
                    className="text-xs"
                  >
                    Today
                  </Button>
                )}
                <span className="text-xs font-medium min-w-[120px] text-center">
                  {format(weekDays[0], 'MMM d')} - {format(weekDays[6], 'MMM d, yyyy')}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWeekOffset(prev => prev + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/dispatch-board')}
                className="text-xs"
              >
                <Navigation className="h-3 w-3 mr-1" />
                Dispatch Board
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
            <div className="space-y-3">
              {acceptedMembers.length > 0 ? (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="min-w-[700px] px-4 sm:px-0">
                    <div className="grid grid-cols-[140px_repeat(7,1fr)] gap-px bg-border rounded-md overflow-hidden">
                      <div className="bg-muted/50 p-2 text-xs font-medium text-muted-foreground">
                        Team Member
                      </div>
                      {weekDays.map((day, i) => {
                        const isCurrentDay = isSameDay(day, today);
                        const isWeekendDay = isWeekend(day);
                        return (
                          <div
                            key={i}
                            className={`p-1.5 text-center text-xs font-medium ${
                              isCurrentDay
                                ? 'bg-primary/10'
                                : isWeekendDay
                                  ? 'bg-muted/60'
                                  : 'bg-muted/50'
                            } text-muted-foreground`}
                          >
                            <div>{format(day, 'EEE')}</div>
                            <div className={isCurrentDay ? 'font-bold text-foreground' : ''}>{format(day, 'd')}</div>
                          </div>
                        );
                      })}

                      {acceptedMembers.flatMap((member) => {
                        const weeklyCount = getMemberWeeklyJobCount(member.userId);
                        return [
                          <div key={`name-${member.id}`} className="bg-card p-2 flex items-center gap-2 border-t border-border">
                            <UserAvatar
                              className="h-6 w-6 shrink-0"
                              fallbackClassName="text-[10px]"
                              user={{
                                id: member.userId || member.id,
                                firstName: member.firstName,
                                lastName: member.lastName,
                                email: member.email,
                                photoUrl: member.profileImageUrl,
                                themeColor: member.themeColor,
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium truncate block">{member.firstName}</span>
                              {weeklyCount > 0 && (
                                <span className="text-[10px] text-muted-foreground">{weeklyCount} job{weeklyCount !== 1 ? 's' : ''} this week</span>
                              )}
                            </div>
                          </div>,
                          ...weekDays.map((day, dayIndex) => {
                            const dayKey = format(day, 'yyyy-MM-dd');
                            const dayTimeOff = getMemberTimeOffForDay(member.id, day);
                            const hasApprovedTimeOff = dayTimeOff.some(t => t.status === 'approved');
                            const hasPendingTimeOff = dayTimeOff.some(t => t.status === 'pending');
                            const memberJobs = getMemberJobsForDay(member.userId, day);
                            const isAvail = !hasApprovedTimeOff;
                            const isCurrentDay = isSameDay(day, today);
                            const isWeekendDay = isWeekend(day);
                            const cellId = `team-${member.userId}-${dayKey}`;
                            const isDropZone = dragOverTarget === cellId;

                            let cellBg = 'bg-card';
                            if (hasApprovedTimeOff) {
                              cellBg = 'bg-red-50 dark:bg-red-900/10';
                            } else if (isWeekendDay && memberJobs.length === 0) {
                              cellBg = 'bg-muted/20';
                            } else if (memberJobs.length > 0) {
                              cellBg = 'bg-blue-50/30 dark:bg-blue-900/5';
                            } else if (isAvail) {
                              cellBg = 'bg-green-50/30 dark:bg-green-900/5';
                            }

                            return (
                              <div
                                key={`${member.id}-${dayIndex}`}
                                className={`${cellBg} p-1 border-t border-border flex flex-col items-start justify-start gap-0.5 min-h-[60px] group relative ${
                                  isCurrentDay ? 'ring-1 ring-inset ring-primary/20' : ''
                                } ${isDropZone ? 'ring-2 ring-dashed ring-primary/50 bg-primary/5' : ''} ${
                                  isAvail && !hasPendingTimeOff ? 'hover:bg-primary/5 transition-colors cursor-pointer' : ''
                                }`}
                                onClick={() => {
                                  if (!isAvail || hasApprovedTimeOff) return;
                                  setQuickAssignCell({
                                    memberId: member.id,
                                    memberUserId: member.userId,
                                    memberName: member.firstName || 'Team Member',
                                    dayKey,
                                    dayLabel: format(day, 'EEE, MMM d'),
                                  });
                                  setQuickAssignSearch("");
                                }}
                                onDragOver={isAvail ? (e) => handleDragOver(e, cellId) : undefined}
                                onDragLeave={isAvail ? handleDragLeave : undefined}
                                onDrop={isAvail ? (e) => handleDropOnTeamCell(e, member.userId, dayKey) : undefined}
                                data-testid={`roster-cell-${member.id}-${dayIndex}`}
                              >
                                {hasApprovedTimeOff && (
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-0">
                                    Off
                                  </Badge>
                                )}
                                {hasPendingTimeOff && !hasApprovedTimeOff && (
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-0">
                                    Pending
                                  </Badge>
                                )}
                                {!hasApprovedTimeOff && !hasPendingTimeOff && memberJobs.length === 0 && (
                                  <div className="group/cell w-full h-full flex items-center justify-center">
                                    <Plus className="h-3 w-3 text-muted-foreground/0 group-hover/cell:text-muted-foreground/40 transition-colors" />
                                  </div>
                                )}
                                {memberJobs.length > 0 && (
                                  <div className="w-full space-y-0.5">
                                    {memberJobs.slice(0, 3).map((job) => {
                                      const jTime = getJobTime(job);
                                      const jobSuburb = getSuburb(job.address);
                                      const statusDot = job.status === 'in_progress' ? 'bg-green-500' : job.status === 'scheduled' ? 'bg-blue-500' : 'bg-muted-foreground';
                                      return (
                                        <div
                                          key={job.id}
                                          draggable
                                          onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, 'job', job.id, dayKey); }}
                                          className="px-1.5 py-0.5 rounded bg-blue-100/80 dark:bg-blue-900/30 cursor-grab active:cursor-grabbing"
                                        >
                                          <div className="flex items-center gap-1">
                                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDot}`} />
                                            <p className="text-[10px] font-medium text-blue-700 dark:text-blue-400 truncate">{job.title}</p>
                                          </div>
                                          <div className="flex items-center gap-1 text-[9px] text-blue-600/70 dark:text-blue-400/70">
                                            {jTime && <span>{jTime}</span>}
                                            {job.clientName && <span className="truncate">{job.clientName}</span>}
                                          </div>
                                          {jobSuburb && (
                                            <p className="text-[8px] text-blue-600/50 dark:text-blue-400/50 truncate flex items-center gap-0.5">
                                              <MapPin className="h-2 w-2 shrink-0" />{jobSuburb}
                                            </p>
                                          )}
                                        </div>
                                      );
                                    })}
                                    {memberJobs.length > 3 && (
                                      <p className="text-[9px] text-center text-muted-foreground font-medium">
                                        +{memberJobs.length - 3} more
                                      </p>
                                    )}
                                    {isAvail && (
                                      <div className="group/add w-full flex items-center justify-center pt-0.5">
                                        <Plus className="h-2.5 w-2.5 text-muted-foreground/0 group-hover/add:text-muted-foreground/40 transition-colors" />
                                      </div>
                                    )}
                                  </div>
                                )}
                                {memberJobs.length > 0 && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); navigate(`/dispatch-board?date=${dayKey}`); }}
                                    className="absolute bottom-0.5 right-0.5 text-[8px] text-primary/0 group-hover:text-primary/60 transition-colors hover:underline cursor-pointer"
                                  >
                                    View
                                  </button>
                                )}
                              </div>
                            );
                          })
                        ];
                      })}

                      <div className="bg-muted/30 p-2 text-xs font-medium text-muted-foreground border-t border-border flex items-center">
                        Total
                      </div>
                      {dailyTotals.map((dt, i) => (
                        <div key={`total-${i}`} className="bg-muted/30 p-1.5 text-center border-t border-border">
                          <span className={`text-xs font-semibold ${dt.totalJobs > 0 ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                            {dt.totalJobs > 0 ? `${dt.totalJobs} job${dt.totalJobs !== 1 ? 's' : ''}` : '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No team members yet</p>
              )}

              {allUnassignedJobs.length > 0 && (
                <div className="mt-3 pt-3 border-t space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <span className="text-amber-700 dark:text-amber-400">Unassigned Jobs ({allUnassignedJobs.length})</span>
                      <span className="text-xs text-muted-foreground font-normal ml-1">drag into a team member's day</span>
                    </p>
                    {(() => {
                      const totalHours = allUnassignedJobs.reduce((sum, j) => sum + (j.estimatedDuration || 0), 0);
                      return totalHours > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {totalHours >= 60 ? `${Math.floor(totalHours / 60)}h ${totalHours % 60}m` : `${totalHours}m`} estimated
                        </span>
                      ) : null;
                    })()}
                  </div>

                  {urgentUnassignedJobs.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Urgent / Overdue ({urgentUnassignedJobs.length})
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {urgentUnassignedJobs.map((job) => renderJobCard(job, { showUrgent: true }))}
                      </div>
                    </div>
                  )}

                  {regularUnassignedJobs.length > 0 && (
                    <div>
                      {urgentUnassignedJobs.length > 0 && (
                        <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                          Ready to Assign ({regularUnassignedJobs.length})
                        </p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {regularUnassignedJobs.map((job) => renderJobCard(job))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                People & Time
              </CardTitle>
              {pendingTimeOff.length > 0 && (
                <Badge variant="secondary" className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-0">
                  {pendingTimeOff.length} pending
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => setTimeOffDialogOpen(true)}
              data-testid="button-request-timeoff"
            >
              <Plus className="h-4 w-4 mr-1" />
              Request
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-1 mb-3">
            <Button
              size="sm"
              variant={peopleControlTab === 'timeoff' ? 'default' : 'ghost'}
              onClick={() => setPeopleControlTab('timeoff')}
              className="text-xs"
            >
              <Calendar className="h-3 w-3 mr-1" />
              Time Off
            </Button>
            <Button
              size="sm"
              variant={peopleControlTab === 'availability' ? 'default' : 'ghost'}
              onClick={() => setPeopleControlTab('availability')}
              className="text-xs"
            >
              <Clock className="h-3 w-3 mr-1" />
              Availability
            </Button>
          </div>

          {peopleControlTab === 'timeoff' && (
            <div className="space-y-3">
              {pendingTimeOff.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending Approval</p>
                  {pendingTimeOff.map((request) => {
                    const member = teamMembers.find(m => m.id === request.teamMemberId);
                    return (
                      <div
                        key={request.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 border rounded-md bg-amber-50/30 dark:bg-amber-900/5 border-amber-200/50 dark:border-amber-800/30"
                        data-testid={`timeoff-${request.id}`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <UserAvatar
                            className="h-7 w-7 shrink-0"
                            fallbackClassName="text-xs"
                            user={{
                              id: member?.userId || member?.id || null,
                              firstName: member?.firstName,
                              lastName: member?.lastName,
                              email: member?.email,
                              photoUrl: member?.profileImageUrl,
                              themeColor: member?.themeColor,
                            }}
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {getWorkerDisplayName(member)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(request.startDate), 'MMM d')} - {format(new Date(request.endDate), 'MMM d, yyyy')}
                              <span className="ml-1.5 capitalize">{request.reason.replace('_', ' ')}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => approveTimeOffMutation.mutate({ id: request.id, status: 'approved' })}
                            data-testid={`button-approve-${request.id}`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approveTimeOffMutation.mutate({ id: request.id, status: 'rejected' })}
                            data-testid={`button-reject-${request.id}`}
                          >
                            <X className="h-3.5 w-3.5 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {upcomingTimeOff.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upcoming Approved</p>
                  {upcomingTimeOff.map((leave) => {
                    const member = teamMembers.find(m => m.id === leave.teamMemberId);
                    return (
                      <div key={leave.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                        <UserAvatar
                          className="h-6 w-6 shrink-0"
                          fallbackClassName="text-[10px]"
                          user={{
                            id: member?.userId || member?.id || null,
                            firstName: member?.firstName,
                            lastName: member?.lastName,
                            email: member?.email,
                            photoUrl: member?.profileImageUrl,
                            themeColor: member?.themeColor,
                          }}
                        />
                        <span className="text-sm flex-1 truncate">{getWorkerDisplayName(member)}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {format(new Date(leave.startDate), 'MMM d')} - {format(new Date(leave.endDate), 'MMM d')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {pendingTimeOff.length === 0 && upcomingTimeOff.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">No time off requests</p>
              )}
            </div>
          )}

          {peopleControlTab === 'availability' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground shrink-0">Member:</Label>
                <Select value={selectedMember || ""} onValueChange={setSelectedMember}>
                  <SelectTrigger className="flex-1 sm:w-[200px] sm:flex-none" data-testid="select-member-availability">
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {acceptedMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {getWorkerDisplayName(member)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedMember ? (
                <div className="space-y-1.5">
                  {DAY_NAMES.map((day, index) => {
                    const dayAvailability = availability.find(a => a.dayOfWeek === index);
                    const isAvailable = dayAvailability?.isAvailable ?? (index > 0 && index < 6);
                    const startTime = dayAvailability?.startTime || '08:00';
                    const endTime = dayAvailability?.endTime || '17:00';

                    return (
                      <div
                        key={day}
                        className="flex items-center gap-2 p-2 border rounded-md"
                        data-testid={`availability-${index}`}
                      >
                        <Switch
                          checked={isAvailable}
                          onCheckedChange={(checked) => {
                            updateAvailabilityMutation.mutate({
                              teamMemberId: selectedMember,
                              dayOfWeek: index,
                              isAvailable: checked,
                            });
                          }}
                          data-testid={`switch-available-${index}`}
                        />
                        <span className={`text-sm font-medium w-12 shrink-0 ${!isAvailable ? 'text-muted-foreground' : ''}`}>
                          {day.slice(0, 3)}
                        </span>
                        {isAvailable ? (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
                            <Input
                              type="time"
                              value={startTime}
                              onChange={(e) => {
                                updateAvailabilityMutation.mutate({
                                  teamMemberId: selectedMember,
                                  dayOfWeek: index,
                                  isAvailable: true,
                                  startTime: e.target.value,
                                  endTime,
                                });
                              }}
                              className="w-[100px]"
                              data-testid={`input-start-${index}`}
                            />
                            <span className="text-xs text-muted-foreground">-</span>
                            <Input
                              type="time"
                              value={endTime}
                              onChange={(e) => {
                                updateAvailabilityMutation.mutate({
                                  teamMemberId: selectedMember,
                                  dayOfWeek: index,
                                  isAvailable: true,
                                  startTime,
                                  endTime: e.target.value,
                                });
                              }}
                              className="w-[100px]"
                              data-testid={`input-end-${index}`}
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Off</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Select a member to edit availability
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={timeOffDialogOpen} onOpenChange={setTimeOffDialogOpen}>
        <DialogContent data-testid="dialog-request-timeoff">
          <DialogHeader>
            <DialogTitle>Request Time Off</DialogTitle>
            <DialogDescription>Submit a time off request for a team member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Team Member</Label>
              <Select value={selectedMember || ""} onValueChange={setSelectedMember}>
                <SelectTrigger data-testid="select-timeoff-member">
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {acceptedMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {getWorkerDisplayName(member)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={timeOffStart}
                  onChange={(e) => setTimeOffStart(e.target.value)}
                  data-testid="input-timeoff-start"
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={timeOffEnd}
                  onChange={(e) => setTimeOffEnd(e.target.value)}
                  data-testid="input-timeoff-end"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={timeOffReason} onValueChange={setTimeOffReason}>
                <SelectTrigger data-testid="select-timeoff-reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual_leave">Annual Leave</SelectItem>
                  <SelectItem value="sick_leave">Sick Leave</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="public_holiday">Public Holiday</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={timeOffNotes}
                onChange={(e) => setTimeOffNotes(e.target.value)}
                placeholder="Additional details..."
                data-testid="input-timeoff-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTimeOffDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedMember && timeOffStart && timeOffEnd) {
                  requestTimeOffMutation.mutate({
                    teamMemberId: selectedMember,
                    startDate: timeOffStart,
                    endDate: timeOffEnd,
                    reason: timeOffReason,
                    notes: timeOffNotes || undefined,
                  });
                }
              }}
              disabled={requestTimeOffMutation.isPending || !selectedMember || !timeOffStart || !timeOffEnd}
              data-testid="button-submit-timeoff"
            >
              {requestTimeOffMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!quickAssignCell} onOpenChange={(open) => { if (!open) setQuickAssignCell(null); }}>
        <DialogContent className="max-w-md overflow-hidden flex flex-col" style={{ maxHeight: 'min(80vh, 600px)' }} data-testid="dialog-quick-assign">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Assign Job
            </DialogTitle>
            <DialogDescription>
              {quickAssignCell && (
                <>Assign a job to <strong>{quickAssignCell.memberName}</strong> on <strong>{quickAssignCell.dayLabel}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="shrink-0">
            <Input
              placeholder="Search jobs..."
              value={quickAssignSearch}
              onChange={(e) => setQuickAssignSearch(e.target.value)}
              data-testid="input-quick-assign-search"
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6" style={{ maxHeight: 'min(50vh, 380px)' }}>
            <div className="space-y-1.5 pb-2">
              {(() => {
                const searchLower = quickAssignSearch.toLowerCase();
                const filteredJobs = allUnassignedJobs.filter(j => {
                  if (!searchLower) return true;
                  return (
                    j.title.toLowerCase().includes(searchLower) ||
                    (j.clientName && j.clientName.toLowerCase().includes(searchLower)) ||
                    (j.address && j.address.toLowerCase().includes(searchLower))
                  );
                });

                if (filteredJobs.length === 0) {
                  return (
                    <div className="py-8 text-center">
                      <Briefcase className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        {allUnassignedJobs.length === 0 ? 'No unassigned jobs' : 'No jobs match your search'}
                      </p>
                    </div>
                  );
                }

                return filteredJobs.map(job => {
                  const suburb = getSuburb(job.address);
                  const hasDate = job.scheduledAt ? (() => { try { return format(parseISO(job.scheduledAt), 'EEE, MMM d'); } catch { return null; } })() : null;
                  const duration = job.estimatedDuration
                    ? (job.estimatedDuration >= 60 ? `${Math.floor(job.estimatedDuration / 60)}h${job.estimatedDuration % 60 ? ` ${job.estimatedDuration % 60}m` : ''}` : `${job.estimatedDuration}m`)
                    : null;
                  return (
                    <button
                      key={job.id}
                      className="w-full text-left p-3 rounded-md border hover:bg-primary/5 transition-colors cursor-pointer"
                      onClick={() => {
                        if (!quickAssignCell) return;
                        const scheduledAt = new Date(quickAssignCell.dayKey + 'T09:00:00').toISOString();
                        assignJobMutation.mutate({
                          jobId: job.id,
                          assignedTo: quickAssignCell.memberUserId,
                          scheduledAt,
                        });
                        setQuickAssignCell(null);
                      }}
                      data-testid={`quick-assign-job-${job.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{job.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {job.clientName && (
                              <span className="text-xs text-muted-foreground">{job.clientName}</span>
                            )}
                            {hasDate && (
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <Calendar className="h-2.5 w-2.5" />{hasDate}
                              </span>
                            )}
                            {duration && (
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />{duration}
                              </span>
                            )}
                          </div>
                          {suburb && (
                            <p className="text-xs text-muted-foreground/70 mt-0.5 flex items-center gap-0.5">
                              <MapPin className="h-2.5 w-2.5 shrink-0" />{suburb}
                            </p>
                          )}
                        </div>
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 border-0 shrink-0 ${getJobStatusStyle(job.status)}`}>
                          {getJobStatusLabel(job.status)}
                        </Badge>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
          {allUnassignedJobs.length > 0 && (
            <div className="shrink-0 pt-2 border-t text-xs text-muted-foreground text-center">
              {allUnassignedJobs.length} unassigned job{allUnassignedJobs.length !== 1 ? 's' : ''} available
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmergencyContactsTab() {
  const { toast } = useToast();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formRelationship, setFormRelationship] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formSecondaryPhone, setFormSecondaryPhone] = useState("");
  const [formIsPrimary, setFormIsPrimary] = useState(false);
  const [formNotes, setFormNotes] = useState("");

  const { data: teamMembers = [] } = useQuery<TeamMemberData[]>({ queryKey: ['/api/team/members'] });

  const { data: contacts = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/team/emergency-contacts', selectedMemberId],
    queryFn: async () => {
      if (!selectedMemberId) return [];
      const r = await apiRequest('GET', `/api/team/emergency-contacts?teamMemberId=${selectedMemberId}`);
      return r.json();
    },
    enabled: !!selectedMemberId,
  });

  const acceptedMembers = teamMembers.filter((m) => m.inviteStatus === 'accepted');

  function openAdd() {
    setEditingContact(null);
    setFormName(""); setFormRelationship(""); setFormPhone("");
    setFormSecondaryPhone(""); setFormIsPrimary(contacts.length === 0); setFormNotes("");
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditingContact(c);
    setFormName(c.name || ""); setFormRelationship(c.relationship || "");
    setFormPhone(c.phone || ""); setFormSecondaryPhone(c.secondaryPhone || "");
    setFormIsPrimary(!!c.isPrimary); setFormNotes(c.notes || "");
    setDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        teamMemberId: selectedMemberId,
        name: formName.trim(),
        relationship: formRelationship.trim(),
        phone: formPhone.trim(),
        secondaryPhone: formSecondaryPhone.trim() || null,
        isPrimary: formIsPrimary,
        notes: formNotes.trim() || null,
      };
      if (editingContact) {
        const r = await apiRequest('PATCH', `/api/team/emergency-contacts/${editingContact.id}`, body);
        return r.json();
      }
      const r = await apiRequest('POST', '/api/team/emergency-contacts', body);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/emergency-contacts', selectedMemberId] });
      toast({ title: editingContact ? "Contact updated" : "Contact added" });
      setDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await apiRequest('DELETE', `/api/team/emergency-contacts/${id}`);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/emergency-contacts', selectedMemberId] });
      toast({ title: "Contact removed" });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const selectedMember = acceptedMembers.find((m) => m.id === selectedMemberId);

  return (
    <div className="p-4 sm:p-5 section-gap overflow-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold">Emergency Contacts</h3>
          <p className="text-sm text-muted-foreground">Who to call if a worker needs help on site</p>
        </div>
        <Select value={selectedMemberId || ""} onValueChange={(v) => setSelectedMemberId(v || null)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Select worker…" />
          </SelectTrigger>
          <SelectContent>
            {acceptedMembers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.firstName} {m.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedMemberId ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-muted-foreground">
              {selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : ''}
            </p>
            <Button size="sm" onClick={openAdd} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Contact
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : contacts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="text-sm font-medium text-muted-foreground">No emergency contacts</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add at least one emergency contact so supervisors can reach them on site
                </p>
                <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={openAdd}>
                  <Plus className="h-3.5 w-3.5" />
                  Add First Contact
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {contacts.map((c) => (
                <Card key={c.id} className={c.isPrimary ? "border-destructive/40 bg-destructive/5" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-destructive/15 flex items-center justify-center shrink-0 mt-0.5">
                          <User className="h-4 w-4 text-destructive" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{c.name}</p>
                            {c.isPrimary && (
                              <Badge variant="destructive" className="text-[10px] py-0">Primary</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground capitalize">{c.relationship}</p>
                          <a href={`tel:${c.phone}`} className="text-sm text-green-600 font-medium flex items-center gap-1 mt-1 hover:underline">
                            <Phone className="h-3 w-3" />
                            {c.phone}
                          </a>
                          {c.secondaryPhone && (
                            <a href={`tel:${c.secondaryPhone}`} className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 hover:underline">
                              <Phone className="h-3 w-3" />
                              {c.secondaryPhone}
                            </a>
                          )}
                          {c.notes && <p className="text-xs text-muted-foreground mt-1 italic">{c.notes}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c.id)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <User className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">Select a worker to view or add emergency contacts</p>
          </CardContent>
        </Card>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContact ? "Edit" : "Add"} Emergency Contact</DialogTitle>
            <DialogDescription>
              {selectedMember ? `For ${selectedMember.firstName} ${selectedMember.lastName}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Full Name *</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Jane Smith" />
              </div>
              <div className="space-y-1.5">
                <Label>Relationship *</Label>
                <Input value={formRelationship} onChange={(e) => setFormRelationship(e.target.value)} placeholder="Spouse, Parent…" />
              </div>
              <div className="space-y-1.5">
                <Label>Primary Phone *</Label>
                <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="04xx xxx xxx" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Secondary Phone</Label>
                <Input value={formSecondaryPhone} onChange={(e) => setFormSecondaryPhone(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Notes</Label>
                <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Any additional information…" rows={2} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formIsPrimary} onCheckedChange={setFormIsPrimary} id="is-primary" />
              <Label htmlFor="is-primary" className="cursor-pointer">Mark as primary contact</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !formName.trim() || !formRelationship.trim() || !formPhone.trim()}
            >
              {saveMutation.isPending ? "Saving…" : editingContact ? "Save Changes" : "Add Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove contact?</AlertDialogTitle>
            <AlertDialogDescription>This emergency contact will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              {deleteMutation.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SkillsTab() {
  const { toast } = useToast();
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [addSkillDialogOpen, setAddSkillDialogOpen] = useState(false);
  const [skillName, setSkillName] = useState("");
  const [skillType, setSkillType] = useState("certification");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [skillNotes, setSkillNotes] = useState("");

  const { data: teamMembers = [] } = useQuery<TeamMemberData[]>({
    queryKey: ['/api/team/members'],
  });

  const { data: skills = [] } = useQuery<TeamMemberSkill[]>({
    queryKey: ['/api/team/skills'],
  });

  const addSkillMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/team/skills', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/skills'] });
      toast({ title: "Skill added successfully" });
      setAddSkillDialogOpen(false);
      resetSkillForm();
    },
    onError: (error: any) => {
      toast({ title: "Failed to add skill", description: error.message, variant: "destructive" });
    },
  });

  const verifySkillMutation = useMutation({
    mutationFn: async ({ id, isVerified }: { id: string; isVerified: boolean }) => {
      const response = await apiRequest('PATCH', `/api/team/skills/${id}`, { isVerified });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/skills'] });
      toast({ title: "Skill verification updated" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
    },
  });

  const deleteSkillMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/team/skills/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/skills'] });
      toast({ title: "Skill removed" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to remove", description: error.message, variant: "destructive" });
    },
  });

  const resetSkillForm = () => {
    setSkillName("");
    setSkillType("certification");
    setLicenseNumber("");
    setIssueDate("");
    setExpiryDate("");
    setSkillNotes("");
  };

  const acceptedMembers = teamMembers.filter(m => m.inviteStatus === 'accepted');

  const expiringSkills = skills.filter(s => {
    if (!s.expiryDate) return false;
    const expiry = new Date(s.expiryDate);
    const thirtyDaysFromNow = addDays(new Date(), 30);
    return isBefore(expiry, thirtyDaysFromNow) && isAfter(expiry, new Date());
  });

  const expiredSkills = skills.filter(s => {
    if (!s.expiryDate) return false;
    return isBefore(new Date(s.expiryDate), new Date());
  });

  const memberSkills = selectedMember ? skills.filter(s => s.teamMemberId === selectedMember) : [];

  const COMMON_SKILLS = [
    "White Card (Construction Induction)",
    "Electrical License",
    "Plumbing License",
    "Gas Fitting License",
    "First Aid Certificate",
    "Working at Heights",
    "Confined Space Entry",
    "Forklift License",
    "EWP License",
    "Asbestos Awareness",
  ];

  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <Award className="h-4 w-4 sm:h-5 sm:w-5" />
            Skills & Certifications
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Track qualifications, licenses, and training for your team</p>
        </div>
        <Button size="sm" onClick={() => setAddSkillDialogOpen(true)} data-testid="button-add-skill">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Add Skill</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {(expiringSkills.length > 0 || expiredSkills.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {expiredSkills.length > 0 && (
            <Card className="border-destructive">
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Expired ({expiredSkills.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {expiredSkills.slice(0, 3).map((skill) => {
                    const member = teamMembers.find(m => m.id === skill.teamMemberId);
                    return (
                      <div key={skill.id} className="flex items-center justify-between text-sm">
                        <span>{member?.firstName} - {skill.skillName}</span>
                        <span className="text-destructive text-xs">
                          Expired {format(new Date(skill.expiryDate!), 'MMM d')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {expiringSkills.length > 0 && (
            <Card className="border-yellow-500">
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2 text-yellow-600">
                  <Clock className="h-4 w-4" />
                  Expiring Soon ({expiringSkills.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {expiringSkills.slice(0, 3).map((skill) => {
                    const member = teamMembers.find(m => m.id === skill.teamMemberId);
                    return (
                      <div key={skill.id} className="flex items-center justify-between text-sm">
                        <span>{member?.firstName} - {skill.skillName}</span>
                        <span className="text-yellow-600 text-xs">
                          Expires {format(new Date(skill.expiryDate!), 'MMM d')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2">
            <CardTitle className="text-sm sm:text-base">Team Member Skills</CardTitle>
            <Select value={selectedMember || ""} onValueChange={setSelectedMember}>
              <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-member-skills">
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {acceptedMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {getWorkerDisplayName(member)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {selectedMember ? (
              memberSkills.length > 0 ? (
                <div className="space-y-3">
                  {memberSkills.map((skill) => {
                    const isExpired = skill.expiryDate && isBefore(new Date(skill.expiryDate), new Date());
                    const isExpiring = skill.expiryDate && !isExpired && isBefore(new Date(skill.expiryDate), addDays(new Date(), 30));

                    return (
                      <div
                        key={skill.id}
                        className={`p-4 border rounded-lg ${isExpired ? 'border-destructive bg-destructive/5' : isExpiring ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10' : ''}`}
                        data-testid={`skill-${skill.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{skill.skillName}</h4>
                              <Badge variant="secondary" className="text-xs capitalize">
                                {skill.skillType}
                              </Badge>
                              {skill.isVerified && (
                                <Badge variant="default" className="text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Verified
                                </Badge>
                              )}
                            </div>
                            {skill.licenseNumber && (
                              <p className="text-sm text-muted-foreground mt-1">
                                License: {skill.licenseNumber}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              {skill.issueDate && (
                                <span>Issued: {format(new Date(skill.issueDate), 'MMM d, yyyy')}</span>
                              )}
                              {skill.expiryDate && (
                                <span className={isExpired ? 'text-destructive' : isExpiring ? 'text-yellow-600' : ''}>
                                  {isExpired ? 'Expired' : 'Expires'}: {format(new Date(skill.expiryDate), 'MMM d, yyyy')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!skill.isVerified && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => verifySkillMutation.mutate({ id: skill.id, isVerified: true })}
                                data-testid={`button-verify-${skill.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Verify
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteSkillMutation.mutate(skill.id)}
                              data-testid={`button-delete-${skill.id}`}
                            >
                              <X className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No skills recorded for this team member</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setAddSkillDialogOpen(true)}
                  >
                    Add First Skill
                  </Button>
                </div>
              )
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a team member to view their skills and certifications</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team Compliance</CardTitle>
            <CardDescription>Overview of team qualifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {COMMON_SKILLS.slice(0, 5).map((skillName) => {
              const membersWithSkill = skills.filter(s => s.skillName === skillName && s.isVerified);
              const percentage = acceptedMembers.length > 0
                ? Math.round((membersWithSkill.length / acceptedMembers.length) * 100)
                : 0;

              return (
                <div key={skillName} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{skillName}</span>
                    <span className="text-muted-foreground">{membersWithSkill.length}/{acceptedMembers.length}</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Dialog open={addSkillDialogOpen} onOpenChange={setAddSkillDialogOpen}>
        <DialogContent data-testid="dialog-add-skill">
          <DialogHeader>
            <DialogTitle>Add Skill or Certification</DialogTitle>
            <DialogDescription>Record a qualification for a team member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Team Member</Label>
              <Select value={selectedMember || ""} onValueChange={setSelectedMember}>
                <SelectTrigger data-testid="select-skill-member">
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {acceptedMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {getWorkerDisplayName(member)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Skill/Certification</Label>
              <Select value={skillName} onValueChange={setSkillName}>
                <SelectTrigger data-testid="select-skill-name">
                  <SelectValue placeholder="Select or type..." />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_SKILLS.map((skill) => (
                    <SelectItem key={skill} value={skill}>{skill}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={skillType} onValueChange={setSkillType}>
                <SelectTrigger data-testid="select-skill-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="certification">Certification</SelectItem>
                  <SelectItem value="license">License</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="skill">Skill</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>License/Certificate Number (optional)</Label>
              <Input
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="ABC123456"
                data-testid="input-license-number"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  data-testid="input-issue-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  data-testid="input-expiry-date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={skillNotes}
                onChange={(e) => setSkillNotes(e.target.value)}
                placeholder="Additional details..."
                data-testid="input-skill-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSkillDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedMember && skillName) {
                  addSkillMutation.mutate({
                    teamMemberId: selectedMember,
                    skillName,
                    skillType,
                    licenseNumber: licenseNumber || undefined,
                    issueDate: issueDate || undefined,
                    expiryDate: expiryDate || undefined,
                    notes: skillNotes || undefined,
                  });
                }
              }}
              disabled={addSkillMutation.isPending || !selectedMember || !skillName}
              data-testid="button-submit-skill"
            >
              {addSkillMutation.isPending ? "Adding..." : "Add Skill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PerformanceTab() {
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('month');

  const { data: teamMembers = [] } = useQuery<TeamMemberData[]>({
    queryKey: ['/api/team/members'],
  });

  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ['/api/jobs'],
  });

  const { data: timeEntries = [] } = useQuery<any[]>({
    queryKey: ['/api/time-entries'],
  });

  const acceptedMembers = teamMembers.filter(m => m.inviteStatus === 'accepted');

  const getPeriodStart = () => {
    const now = new Date();
    if (period === 'week') return startOfWeek(now, { weekStartsOn: 1 });
    if (period === 'month') {
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return new Date(0);
  };

  const periodStart = getPeriodStart();

  const filteredJobs = useMemo(() => {
    return jobs.filter(j => {
      if (period === 'all') return true;
      const jobDate = j.completedAt || j.updatedAt || j.createdAt;
      return jobDate && new Date(jobDate) >= periodStart;
    });
  }, [jobs, period, periodStart]);

  const filteredTimeEntries = useMemo(() => {
    if (period === 'all') return timeEntries;
    return timeEntries.filter(te => {
      const entryDate = te.startTime || te.createdAt;
      return entryDate && new Date(entryDate) >= periodStart;
    });
  }, [timeEntries, period, periodStart]);

  const memberStats = useMemo(() => {
    return acceptedMembers.map((member) => {
      const memberJobs = filteredJobs.filter(j => j.assignedTo === member.userId);
      const completedJobs = memberJobs.filter(j => j.status === 'completed');
      const inProgressJobs = jobs.filter(j => j.assignedTo === member.userId && j.status === 'in_progress');
      const totalJobs = memberJobs.length;

      const memberTimeEntries = filteredTimeEntries.filter(te => te.userId === member.userId);
      const totalSeconds = memberTimeEntries.reduce((sum: number, te: any) => sum + (te.duration || 0), 0);
      const hours = totalSeconds / 3600;

      const rate = member.hourlyRate ? parseFloat(member.hourlyRate) : 0;
      const revenue = hours * rate;

      const completionRate = totalJobs > 0
        ? Math.round((completedJobs.length / totalJobs) * 100)
        : 0;

      return {
        ...member,
        totalJobs,
        completedJobs: completedJobs.length,
        inProgressJobs: inProgressJobs.length,
        hours,
        revenue,
        completionRate,
      };
    }).sort((a, b) => b.completedJobs - a.completedJobs);
  }, [acceptedMembers, filteredJobs, jobs, filteredTimeEntries]);

  const totalCompleted = memberStats.reduce((sum, m) => sum + m.completedJobs, 0);
  const totalInProgress = memberStats.reduce((sum, m) => sum + m.inProgressJobs, 0);
  const totalHours = memberStats.reduce((sum, m) => sum + m.hours, 0);
  const totalRevenue = memberStats.reduce((sum, m) => sum + m.revenue, 0);

  const formatRevenue = (val: number) => {
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
    return `$${Math.round(val)}`;
  };

  return (
    <div className="p-4 sm:p-5 section-gap">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            Team Performance
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Track productivity and job completion metrics</p>
        </div>
        <div className="rounded-lg border bg-muted/50 p-1 flex gap-0.5">
          <Button
            variant={period === 'week' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-xl"
            onClick={() => setPeriod('week')}
          >
            This Week
          </Button>
          <Button
            variant={period === 'month' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-xl"
            onClick={() => setPeriod('month')}
          >
            This Month
          </Button>
          <Button
            variant={period === 'all' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-xl"
            onClick={() => setPeriod('all')}
          >
            All Time
          </Button>
        </div>
      </div>

      <div className="flex gap-2.5 flex-wrap">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-muted/50 border animate-fade-up stagger-delay-1">
          <div className="text-2xl sm:text-3xl font-bold tabular-nums text-success">{totalCompleted}</div>
          <div className="text-xs text-muted-foreground leading-tight font-medium">Jobs done</div>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-muted/50 border animate-fade-up stagger-delay-2">
          <div className="text-2xl font-bold tabular-nums">{totalInProgress}</div>
          <div className="text-xs text-muted-foreground leading-tight font-medium">Active</div>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-muted/50 border animate-fade-up stagger-delay-3">
          <div className="text-2xl font-bold tabular-nums">{totalHours.toFixed(1)}</div>
          <div className="text-xs text-muted-foreground leading-tight font-medium">Hours tracked</div>
        </div>
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-muted/50 border animate-fade-up stagger-delay-4">
          <div className="text-2xl font-bold tabular-nums">{formatRevenue(totalRevenue)}</div>
          <div className="text-xs text-muted-foreground leading-tight font-medium">Revenue</div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Individual Performance</p>
        <div className="space-y-3">
          {memberStats.map((member, index) => {
            const jobShare = totalCompleted > 0 ? (member.completedJobs / totalCompleted) * 100 : 0;

            return (
              <Card
                key={member.id}
                data-testid={`performance-${member.id}`}
                className={`animate-fade-up stagger-delay-${Math.min(index + 1, 8)}`}
              >
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <UserAvatar
                      className="h-9 w-9 sm:h-10 sm:w-10 shrink-0"
                      fallbackClassName="text-xs sm:text-sm"
                      user={{
                        id: member.userId || member.id,
                        firstName: member.firstName,
                        lastName: member.lastName,
                        email: member.email,
                        photoUrl: member.profileImageUrl,
                        themeColor: member.themeColor,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm sm:text-base truncate">{getWorkerDisplayName(member)}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.roleName || member.role || 'Team Member'}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {member.completionRate}%
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3">
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      <span className="text-muted-foreground">Done:</span>
                      <span className="font-medium">{member.completedJobs}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                      <Briefcase className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span className="text-muted-foreground">Active:</span>
                      <span className="font-medium">{member.inProgressJobs}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                      <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-muted-foreground">Hours:</span>
                      <span className="font-medium">{member.hours.toFixed(1)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                      <DollarSign className="h-3.5 w-3.5 text-yellow-600 shrink-0" />
                      <span className="text-muted-foreground">Rev:</span>
                      <span className="font-medium">{formatRevenue(member.revenue)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${jobShare}%`,
                          backgroundColor: member.themeColor || 'hsl(var(--primary))',
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right shrink-0">
                      {Math.round(jobShare)}%
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}

          {memberStats.length === 0 && (
            <Card className="p-8 text-center">
              <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}>
                <BarChart3 className="h-10 w-10" style={{ color: 'hsl(var(--trade) / 0.4)' }} />
              </div>
              <p className="font-medium mb-1">No performance data yet</p>
              <p className="text-xs text-muted-foreground">Team member stats will appear here as jobs are completed</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniSpark({ color = "hsl(217 91% 53%)" }: { color?: string }) {
  return (
    <svg viewBox="0 0 60 24" className="w-12 h-4">
      <polyline
        points="0,18 10,14 20,16 30,8 40,11 50,5 60,7"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatCard({
  label,
  value,
  delta,
  deltaPositive,
  sparkColor,
  testId,
}: {
  label: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
  sparkColor?: string;
  testId?: string;
}) {
  return (
    <Card className="flex-1 min-w-[140px]" data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold truncate">
            {label}
          </div>
          {delta && (
            <span
              className={`text-[10px] font-semibold flex items-center gap-0.5 whitespace-nowrap ${
                deltaPositive ? "text-success" : "text-muted-foreground"
              }`}
            >
              <ArrowUpRight className="w-2.5 h-2.5" />
              {delta}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <div className="text-[26px] font-bold tracking-tight tabular-nums">{value}</div>
          <MiniSpark color={sparkColor} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function TeamOperations() {
  const { isOwner, isManager } = useAppMode();
  const [, headerNavigate] = useLocation();
  const canManageTeam = isOwner || isManager;
  const [activeTab, setActiveTab] = useState<"live" | "admin" | "scheduling" | "performance" | "hr">("live");

  // Lightweight stats for the header strip
  const { data: presence = [] } = useQuery<TeamPresenceData[]>({ queryKey: ["/api/team/presence"] });
  const { data: members = [] } = useQuery<TeamMemberData[]>({ queryKey: ["/api/team/members"] });
  const { data: allJobs = [] } = useQuery<JobData[]>({ queryKey: ["/api/jobs"] });

  const accepted = members.filter((m) => m.inviteStatus === "accepted");
  const onlineCount = presence.filter((p) => p.status === "online" || p.status === "on_job").length;
  const onJobCount = presence.filter((p) => p.status === "on_job").length;
  // Match the historical LiveOps definition: actionable unassigned jobs only
  const unassignedCount = allJobs.filter(
    (j) => !j.assignedTo && (j.status === "pending" || j.status === "scheduled"),
  ).length;

  const tabs = [
    { id: "live" as const, label: "Live Ops", short: "Live", icon: Activity, gated: false },
    { id: "admin" as const, label: "Team Admin", short: "Admin", icon: Users, gated: !canManageTeam },
    { id: "scheduling" as const, label: "Scheduling", short: "Schedule", icon: CalendarDays, gated: false },
    { id: "performance" as const, label: "Performance", short: "Stats", icon: TrendingUp, gated: false },
    { id: "hr" as const, label: "HR & Licences", short: "HR", icon: Shield, gated: !canManageTeam },
  ].filter((t) => !t.gated);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as typeof activeTab)}
      className="flex flex-col h-full min-h-0"
      data-testid="page-team-operations"
    >
      <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-3 max-w-[1400px] mx-auto w-full shrink-0">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-team-ops-title">
                Team Operations
              </h1>
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-success/10 text-success flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-success animate-pulse" />
                {onlineCount} active now
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Live presence, dispatch, scheduling and performance — your control center.
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => headerNavigate("/insights")}
              data-testid="button-team-ops-insights"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Insights
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/team/presence"] });
                queryClient.invalidateQueries({ queryKey: ["/api/team/members"] });
                queryClient.invalidateQueries({ queryKey: ["/api/activity-feed"] });
                queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
                queryClient.invalidateQueries({ queryKey: ["/api/dashboard/unified"] });
              }}
              data-testid="button-refresh-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <StatCard
            label="Team size"
            value={accepted.length}
            delta={accepted.length > 0 ? "All accepted" : "No members yet"}
            deltaPositive={accepted.length > 0}
            testId="stat-team-size"
          />
          <StatCard
            label="Online now"
            value={onlineCount}
            delta={onlineCount > 0 ? "Live" : "Nobody on"}
            deltaPositive={onlineCount > 0}
            sparkColor="hsl(145 65% 42%)"
            testId="stat-online"
          />
          <StatCard
            label="On a job"
            value={onJobCount}
            delta={onJobCount > 0 ? "Working" : "Idle"}
            deltaPositive={onJobCount > 0}
            sparkColor="hsl(217 91% 53%)"
            testId="stat-on-job"
          />
          <StatCard
            label="Unassigned"
            value={unassignedCount}
            delta={unassignedCount === 0 ? "All assigned" : "Needs attention"}
            deltaPositive={unassignedCount === 0}
            sparkColor="hsl(35 90% 50%)"
            testId="stat-unassigned"
          />
        </div>

        {/* Underline tab bar — sits in the shrink-0 header section */}
        <div className="border-b flex items-center flex-wrap gap-y-1">
          {tabs.map(({ id, label, short, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                data-testid={`tab-${id}`}
                className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
                  active
                    ? "text-foreground border-foreground"
                    : "text-muted-foreground border-transparent hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{short}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content — flex-1 region; each tab keeps its own internal scroll */}
      <div className="flex-1 min-h-0 flex flex-col">
        <TabsContent value="live" className="m-0 flex-1 min-h-0 data-[state=inactive]:hidden">
          <LiveOpsTab />
        </TabsContent>
        {canManageTeam && (
          <TabsContent value="admin" className="m-0 flex-1 min-h-0 data-[state=inactive]:hidden">
            <TeamAdminTab />
          </TabsContent>
        )}
        <TabsContent value="scheduling" className="m-0 flex-1 min-h-0 data-[state=inactive]:hidden">
          <SchedulingTab />
        </TabsContent>
        <TabsContent value="performance" className="m-0 flex-1 min-h-0 data-[state=inactive]:hidden">
          <PerformanceTab />
        </TabsContent>
        {canManageTeam && (
          <TabsContent value="hr" className="m-0 flex-1 min-h-0 data-[state=inactive]:hidden overflow-auto">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-0 divide-y xl:divide-y-0 xl:divide-x divide-border h-full">
              <div className="overflow-auto">
                <EmergencyContactsTab />
              </div>
              <div className="overflow-auto">
                <SkillsTab />
              </div>
            </div>
          </TabsContent>
        )}
      </div>
    </Tabs>
  );
}
