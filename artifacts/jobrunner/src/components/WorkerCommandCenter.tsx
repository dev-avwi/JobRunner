import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getAuthHeaders} from "@/lib/queryClient";
import { format, formatDistanceToNow } from "date-fns";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Briefcase,
  MessageSquare,
  User,
  Activity,
  Calendar,
  Battery,
  Navigation2,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Timer,
  Shield,
  Car,
  Zap,
  TrendingUp,
  Signal,
  SignalLow,
  SignalZero,
  MapPinOff,
  ChevronRight,
  Coffee,
  AlertTriangle,
  HelpCircle,
  CircleDot
} from "lucide-react";
import XeroRibbon from "./XeroRibbon";
import "leaflet/dist/leaflet.css";

interface WorkerCommandCenterProps {
  memberId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandCenterData {
  member: {
    id: string;
    memberId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    profileImageUrl: string | null;
    themeColor: string | null;
    role: string;
    roleId: string;
    isActive: boolean;
    inviteStatus: string;
    hourlyRate: number | null;
    locationEnabledByOwner: boolean;
    locationEnabledByUser: boolean;
  };
  location: {
    latitude: number | null;
    longitude: number | null;
    lastUpdated: string | null;
    status: string;
    currentActivity: string | null;
    batteryLevel: number | null;
  } | null;
  stats: {
    todayHours: number;
    activeTimeEntry: any;
    totalAssignedJobs: number;
    activeJobs: number;
    completedJobs: number;
  };
  assignedJobs: Array<{
    id: string;
    title: string;
    status: string;
    address: string | null;
    scheduledDate: string | null;
    priority: string | null;
    clientId: string | null;
    isXeroImport?: boolean;
  }>;
  unassignedJobs: Array<{
    id: string;
    title: string;
    status: string;
    address: string | null;
    scheduledDate: string | null;
    priority: string | null;
    clientId: string | null;
    isXeroImport?: boolean;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    description: string;
    createdAt: string;
    metadata: any;
  }>;
}

const WORKER_STATE_CONFIG: Record<string, { color: string; bg: string; darkBg: string; icon: any; label: string }> = {
  available: { color: 'text-green-600', bg: 'bg-green-100', darkBg: 'dark:bg-green-900/30', icon: CircleDot, label: 'Available' },
  on_job: { color: 'text-orange-600', bg: 'bg-orange-100', darkBg: 'dark:bg-orange-900/30', icon: Briefcase, label: 'On Job' },
  travelling: { color: 'text-blue-600', bg: 'bg-blue-100', darkBg: 'dark:bg-blue-900/30', icon: Car, label: 'Travelling' },
  break: { color: 'text-gray-500', bg: 'bg-gray-100', darkBg: 'dark:bg-gray-800', icon: Coffee, label: 'On Break' },
  delayed: { color: 'text-yellow-600', bg: 'bg-yellow-100', darkBg: 'dark:bg-yellow-900/30', icon: AlertTriangle, label: 'Delayed' },
  needs_help: { color: 'text-red-600', bg: 'bg-red-100', darkBg: 'dark:bg-red-900/30', icon: HelpCircle, label: 'Needs Help' },
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-500",
  scheduled: "bg-blue-500",
  in_progress: "bg-amber-500",
  done: "bg-emerald-500",
  invoiced: "bg-violet-500",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  scheduled: "Scheduled",
  in_progress: "In Progress",
  done: "Completed",
  invoiced: "Invoiced",
};

function createWorkerMarkerIcon(color: string) {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 40px;
        height: 40px;
        background: ${color || '#3B82F6'};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 3px 12px rgba(0,0,0,0.25);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

export default function WorkerCommandCenter({ memberId, open, onOpenChange }: WorkerCommandCenterProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("jobs");

  const { data, isLoading, error } = useQuery<CommandCenterData>({
    queryKey: ['/api/team/members', memberId, 'command-center'],
    queryFn: async () => {
      const response = await fetch(`/api/team/members/${memberId}/command-center`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch worker details');
      return response.json();
    },
    enabled: open && !!memberId,
  });

  const { data: workerStates } = useQuery<any[]>({
    queryKey: ['/api/team/worker-states'],
    enabled: open && !!memberId,
  });

  const workerState = workerStates?.find((ws: any) => ws.userId === data?.member?.memberId);
  const currentWorkerState = workerState?.state || 'available';
  const stateConfig = WORKER_STATE_CONFIG[currentWorkerState] || WORKER_STATE_CONFIG.available;

  const assignJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest('POST', `/api/jobs/${jobId}/assign`, {
        assignedTo: data?.member.memberId || memberId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team/members', memberId, 'command-center'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Job assigned",
        description: `Job has been assigned to ${data?.member.firstName}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Assignment failed",
        description: error.message || "Couldn't assign the job",
        variant: "destructive",
      });
    },
  });

  const handleCall = () => {
    if (data?.member.phone) {
      window.location.href = `tel:${data.member.phone}`;
    }
  };

  const handleSMS = () => {
    if (data?.member.phone) {
      window.location.href = `sms:${data.member.phone}`;
    }
  };

  const handleEmail = () => {
    if (data?.member.email) {
      window.location.href = `mailto:${data.member.email}`;
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getActivityIcon = (status: string) => {
    switch (status) {
      case 'working': return <Briefcase className="h-3 w-3" />;
      case 'driving': return <Car className="h-3 w-3" />;
      case 'idle': return <Clock className="h-3 w-3" />;
      default: return <Signal className="h-3 w-3" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
      working: { color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Working' },
      driving: { color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Driving' },
      idle: { color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30', label: 'Idle' },
      online: { color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Online' },
      offline: { color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800', label: 'Offline' },
    };
    const config = statusConfig[status] || statusConfig.offline;
    return (
      <Badge variant="secondary" className={`${config.bg} ${config.color} gap-1`}>
        {getActivityIcon(status)}
        {config.label}
      </Badge>
    );
  };

  if (!open) return null;

  const hasLocation = data?.location?.latitude && data?.location?.longitude;
  const locationEnabled = data?.member.locationEnabledByOwner && data?.member.locationEnabledByUser;
  const themeColor = data?.member.themeColor || '#5B8DEF';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        className="w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl overflow-hidden p-0 flex flex-col" 
        data-testid="sheet-worker-command-center"
        hideClose
      >
        {isLoading ? (
          <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
            <Skeleton className="h-48" />
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Unable to Load</h3>
            <p className="text-muted-foreground text-center text-sm">
              We couldn't load this worker's details. Please try again.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : data ? (
          <>
            {/* Sticky Header Section */}
            <div 
              className="sticky top-0 z-20 border-b bg-background"
              style={{ 
                background: `linear-gradient(135deg, ${themeColor}15 0%, hsl(var(--background)) 100%)`,
              }}
            >
              {/* Close Button */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => onOpenChange(false)} 
                className="absolute top-4 right-4 z-10"
                data-testid="button-close-command-center"
              >
                <X className="h-5 w-5" />
              </Button>

              {/* Profile Section */}
              <div className="p-6 pb-4">
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <UserAvatar
                      className="h-20 w-20 border-4 shadow-lg text-xl"
                      fallbackClassName="font-bold"
                      style={{ borderColor: themeColor }}
                      user={{ id: data.member.memberId, firstName: data.member.firstName, lastName: data.member.lastName, email: data.member.email, photoUrl: data.member.profileImageUrl, themeColor: data.member.themeColor }}
                    />
                    {data.location && (
                      <div 
                        className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-3 border-background flex items-center justify-center ${
                          data.location.status === 'working' ? 'bg-emerald-500' :
                          data.location.status === 'driving' ? 'bg-blue-500' :
                          data.location.status === 'online' ? 'bg-green-400' :
                          'bg-slate-400'
                        }`}
                      >
                        {data.location.status === 'working' && <Zap className="h-3 w-3 text-white" />}
                        {data.location.status === 'driving' && <Car className="h-3 w-3 text-white" />}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <h2 className="text-xl font-bold truncate" data-testid="text-worker-name">
                      {data.member.firstName} {data.member.lastName}
                    </h2>
                    <div className="flex items-center gap-2 text-muted-foreground mt-1">
                      <Shield className="h-4 w-4 flex-shrink-0" style={{ color: themeColor }} />
                      <span className="text-sm">{data.member.role}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      <Badge variant="secondary" className={`${stateConfig.bg} ${stateConfig.darkBg} ${stateConfig.color} gap-1`}>
                        <stateConfig.icon className="h-3 w-3" />
                        {stateConfig.label}
                      </Badge>
                      {data.location && getStatusBadge(data.location.status)}
                      {data.member.hourlyRate && (
                        <Badge variant="outline" className="text-xs">
                          ${data.member.hourlyRate}/hr
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Actions Row */}
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCall}
                    disabled={!data.member.phone}
                    className="flex-1 gap-2"
                    data-testid="button-call-worker"
                  >
                    <Phone className="h-4 w-4" />
                    Call
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSMS}
                    disabled={!data.member.phone}
                    className="flex-1 gap-2"
                    data-testid="button-sms-worker"
                  >
                    <MessageSquare className="h-4 w-4" />
                    SMS
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEmail}
                    className="flex-1 gap-2"
                    data-testid="button-email-worker"
                  >
                    <Mail className="h-4 w-4" />
                    Email
                  </Button>
                </div>
              </div>
            </div>

            {/* Scrollable Content */}
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6">
                
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3">
                  <div 
                    className="rounded-xl p-4 text-center relative overflow-hidden"
                    style={{ backgroundColor: `${themeColor}10` }}
                  >
                    <div 
                      className="text-3xl font-bold" 
                      style={{ color: themeColor }}
                      data-testid="text-today-hours"
                    >
                      {data.stats.todayHours}h
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Today's Hours</div>
                    {data.stats.activeTimeEntry && (
                      <div className="absolute top-2 right-2">
                        <div 
                          className="w-2 h-2 rounded-full animate-pulse"
                          style={{ backgroundColor: themeColor }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-active-jobs">
                      {data.stats.activeJobs}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Active Jobs</div>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-completed-jobs">
                      {data.stats.completedJobs}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Completed</div>
                  </div>
                </div>

                {/* Active Timer Alert */}
                {data.stats.activeTimeEntry && (
                  <div 
                    className="rounded-xl p-4 flex items-center gap-4"
                    style={{ 
                      backgroundColor: `${themeColor}10`,
                      border: `1px solid ${themeColor}30`
                    }}
                  >
                    <div 
                      className="h-12 w-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${themeColor}20` }}
                    >
                      <Timer className="h-6 w-6" style={{ color: themeColor }} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">Timer Running</p>
                      <p className="text-sm text-muted-foreground">
                        Started {formatDistanceToNow(new Date(data.stats.activeTimeEntry.startTime), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge style={{ backgroundColor: themeColor }} className="text-white">
                      Active
                    </Badge>
                  </div>
                )}

                {/* Location Card */}
                <Card className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" style={{ color: themeColor }} />
                        Live Location
                      </div>
                      {data.location?.lastUpdated && hasLocation && (
                        <span className="text-xs text-muted-foreground font-normal">
                          {formatDistanceToNow(new Date(data.location.lastUpdated), { addSuffix: true })}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {hasLocation && locationEnabled ? (
                      <div className="relative">
                        <div className="h-48" data-testid="map-worker-location">
                          <MapContainer
                            center={[data.location!.latitude!, data.location!.longitude!]}
                            zoom={15}
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={false}
                            attributionControl={false}
                          >
                            <TileLayer
                              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                            />
                            <Marker 
                              position={[data.location!.latitude!, data.location!.longitude!]}
                              icon={createWorkerMarkerIcon(themeColor)}
                            />
                          </MapContainer>
                        </div>
                        {data.location && data.location.batteryLevel !== null && (
                          <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm shadow-lg">
                            <Battery className="h-4 w-4" />
                            <span className="font-medium">{data.location.batteryLevel}%</span>
                          </div>
                        )}
                        <Button 
                          variant="secondary"
                          size="sm"
                          className="absolute bottom-3 right-3 shadow-lg gap-2"
                          onClick={() => window.open(`https://www.google.com/maps?q=${data.location!.latitude},${data.location!.longitude}`, '_blank')}
                        >
                          <Navigation2 className="h-4 w-4" />
                          Navigate
                        </Button>
                      </div>
                    ) : (
                      <div className="h-48 flex flex-col items-center justify-center bg-muted/30 text-center px-6">
                        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                          <MapPinOff className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <p className="font-medium text-sm">Location Unavailable</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                          {!data.member.locationEnabledByOwner 
                            ? "You have disabled location tracking for this worker" 
                            : !data.member.locationEnabledByUser 
                            ? "This worker has turned off location sharing on their device"
                            : "Waiting for the worker's device to report location..."}
                        </p>
                        {/* Device Status Indicators */}
                        <div className="flex items-center gap-3 mt-4">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Signal className={`h-3.5 w-3.5 ${data.location?.status === 'online' ? 'text-green-500' : ''}`} />
                            <span>{data.location?.status === 'online' ? 'Online' : data.location?.status || 'Unknown'}</span>
                          </div>
                          {data.location?.batteryLevel !== null && data.location?.batteryLevel !== undefined && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Battery className="h-3.5 w-3.5" />
                              <span>{data.location.batteryLevel}%</span>
                            </div>
                          )}
                          {data.location?.lastUpdated && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{formatDistanceToNow(new Date(data.location.lastUpdated), { addSuffix: true })}</span>
                            </div>
                          )}
                        </div>
                        {!data.member.locationEnabledByOwner && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-4 text-xs"
                            onClick={() => {
                              toast({
                                title: "Enable Location Tracking",
                                description: "Use the Team Management page to enable location tracking for this worker.",
                              });
                            }}
                          >
                            Enable Tracking
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Tabs Section */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 h-11">
                    <TabsTrigger value="jobs" className="gap-1.5" data-testid="tab-jobs">
                      <Briefcase className="h-4 w-4" />
                      <span className="hidden sm:inline">Jobs</span>
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                        {data.stats.totalAssignedJobs}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="assign" className="gap-1.5" data-testid="tab-assign">
                      <Plus className="h-4 w-4" />
                      <span className="hidden sm:inline">Assign</span>
                      {data.unassignedJobs.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                          {data.unassignedJobs.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="gap-1.5" data-testid="tab-activity">
                      <Activity className="h-4 w-4" />
                      <span className="hidden sm:inline">Activity</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Jobs Tab */}
                  <TabsContent value="jobs" className="mt-4 space-y-3">
                    {data.assignedJobs.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                          <Briefcase className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <p className="font-medium">No jobs assigned</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Assign jobs from the "Assign" tab
                        </p>
                      </div>
                    ) : (
                      data.assignedJobs.map((job) => (
                        <Card 
                          key={job.id} 
                          className="hover-elevate cursor-pointer relative overflow-hidden" 
                          data-testid={`card-job-${job.id}`}
                        >
                          {job.isXeroImport && <XeroRibbon size="sm" />}
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-semibold truncate">{job.title}</h4>
                                  <Badge className={`${STATUS_COLORS[job.status]} text-white text-xs`}>
                                    {STATUS_LABELS[job.status] || job.status}
                                  </Badge>
                                </div>
                                {job.address && (
                                  <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-1.5 truncate">
                                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                                    {job.address}
                                  </p>
                                )}
                                {job.scheduledDate && (
                                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                                    {format(new Date(job.scheduledDate), 'EEE d MMM, h:mm a')}
                                  </p>
                                )}
                              </div>
                              <Button variant="ghost" size="icon" className="flex-shrink-0" data-testid={`button-view-job-${job.id}`}>
                                <ChevronRight className="h-5 w-5" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>

                  {/* Assign Tab */}
                  <TabsContent value="assign" className="mt-4 space-y-3">
                    <p className="text-sm text-muted-foreground mb-4">
                      Quick-assign unscheduled jobs to {data.member.firstName}
                    </p>
                    {data.unassignedJobs.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
                          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                        </div>
                        <p className="font-medium">All jobs assigned</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          There are no unassigned jobs available
                        </p>
                      </div>
                    ) : (
                      data.unassignedJobs.map((job) => (
                        <Card 
                          key={job.id} 
                          className="hover-elevate relative overflow-hidden" 
                          data-testid={`card-unassigned-job-${job.id}`}
                        >
                          {job.isXeroImport && <XeroRibbon size="sm" />}
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold truncate">{job.title}</h4>
                                {job.address && (
                                  <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-1.5 truncate">
                                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                                    {job.address}
                                  </p>
                                )}
                              </div>
                              <Button 
                                size="sm"
                                onClick={() => assignJobMutation.mutate(job.id)}
                                disabled={assignJobMutation.isPending}
                                style={{ backgroundColor: themeColor }}
                                className="text-white hover:opacity-90 gap-1.5"
                                data-testid={`button-assign-job-${job.id}`}
                              >
                                <Plus className="h-4 w-4" />
                                Assign
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>

                  {/* Activity Tab */}
                  <TabsContent value="activity" className="mt-4 space-y-3">
                    {data.recentActivity.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                          <Activity className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <p className="font-medium">No recent activity</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Activity will appear here as work is done
                        </p>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-5 top-2 bottom-2 w-px bg-border" />
                        {data.recentActivity.map((activity, index) => (
                          <div 
                            key={activity.id} 
                            className="relative pl-12 pb-4"
                            data-testid={`card-activity-${activity.id}`}
                          >
                            <div 
                              className="absolute left-3 w-4 h-4 rounded-full bg-background border-2"
                              style={{ borderColor: themeColor }}
                            />
                            <div className="bg-card rounded-lg p-3 border">
                              <p className="text-sm">{activity.description || `${activity.action} ${activity.entityType}`}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                {/* Contact Details */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" style={{ color: themeColor }} />
                      Contact Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <div 
                        className="h-8 w-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${themeColor}10` }}
                      >
                        <Mail className="h-4 w-4" style={{ color: themeColor }} />
                      </div>
                      <span className="truncate">{data.member.email}</span>
                    </div>
                    {data.member.phone && (
                      <div className="flex items-center gap-3 text-sm">
                        <div 
                          className="h-8 w-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: `${themeColor}10` }}
                        >
                          <Phone className="h-4 w-4" style={{ color: themeColor }} />
                        </div>
                        <span>{data.member.phone}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

              </div>
            </ScrollArea>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
