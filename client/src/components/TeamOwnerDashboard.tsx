import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import GettingStartedChecklist from "./GettingStartedChecklist";
import TodayScheduleCard from "./TodayScheduleCard";
import ActivityFeed from "./ActivityFeed";
import FirstQuoteCta, { useIsBrandNewOwner } from "./FirstQuoteCta";
import FloatingActionButton from "./FloatingActionButton";
import AIScheduleOptimizer from "./AIScheduleOptimizer";
import { useFeatureAccess } from "@/hooks/use-subscription";
import { useDashboardKPIs, useTodaysJobs } from "@/hooks/use-dashboard-data";
import { useUpdateJob } from "@/hooks/use-jobs";
import { useAppMode } from "@/hooks/use-app-mode";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getAuthHeaders} from "@/lib/queryClient";
import { useState, useRef, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Briefcase, 
  DollarSign, 
  FileText, 
  Clock,
  User,
  Users,
  MapPin,
  Plus,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  TrendingUp,
  AlertCircle,
  Play,
  CheckCircle,
  Phone,
  MessageSquare,
  Navigation,
  GripVertical,
  UserPlus,
  ArrowRight,
  Map,
  Loader2,
  X,
  Zap,
  Sparkles,
  Timer,
  Receipt,
  CreditCard,
  Search,
  WifiOff
} from "lucide-react";

interface TeamOwnerDashboardProps {
  userName?: string;
  businessName?: string;
  onCreateJob?: () => void;
  onCreateQuote?: () => void;
  onCreateInvoice?: () => void;
  onViewJobs?: () => void;
  onViewInvoices?: () => void;
  onViewQuotes?: () => void;
  onNavigate?: (path: string) => void;
}

interface Job {
  id: string;
  title: string;
  status: string;
  scheduledAt?: string;
  clientName?: string;
  clientPhone?: string;
  address?: string;
  assignedTo?: string;
  assignedToName?: string;
}

interface TeamMember {
  id: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  inviteStatus: string;
}

function ConnectionBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="mb-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-center gap-3">
      <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">You're offline</p>
        <p className="text-xs text-amber-600 dark:text-amber-400">Data may be out of date. Changes will sync when you're back online.</p>
      </div>
    </div>
  );
}

export default function TeamOwnerDashboard({
  userName = "there",
  businessName,
  onCreateJob,
  onCreateQuote,
  onCreateInvoice,
  onViewJobs,
  onNavigate,
}: TeamOwnerDashboardProps) {
  const { data: kpis } = useDashboardKPIs();
  const { data: todaysJobs = [] } = useTodaysJobs();
  const { teamMembers, hasActiveTeam } = useAppMode();
  const updateJob = useUpdateJob();
  const { toast } = useToast();
  const { canUseAIFeatures } = useFeatureAccess();
  const { isBrandNew } = useIsBrandNewOwner();

  
  // Fetch team presence for status indicators
  interface PresenceData {
    userId: string;
    status: string;
  }
  const { data: presenceData = [] } = useQuery<PresenceData[]>({
    queryKey: ["/api/team/presence"],
    enabled: hasActiveTeam,
  });
  
  // Get presence status for a team member
  const getPresenceStatus = (userId: string | undefined): string => {
    if (!userId) return "offline";
    const presence = presenceData.find(p => p.userId === userId);
    return presence?.status || "offline";
  };
  
  const getPresenceColor = (status: string): string => {
    switch (status) {
      case "online": return "#22C55E";
      case "busy": return "#EAB308";
      case "on_job": return "#3B82F6";
      case "break": return "#F97316";
      default: return "#6B7280";
    }
  };
  
  const onlineTeamCount = presenceData.filter(p => p.status !== "offline").length;
  const [draggedJob, setDraggedJob] = useState<Job | null>(null);
  const [dragOverMember, setDragOverMember] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [teamSearch, setTeamSearch] = useState("");
  const [isTeamExpanded, setIsTeamExpanded] = useState(false);
  const schedulerRef = useRef<HTMLElement>(null);

  // Scroll to job scheduler section
  const scrollToScheduler = () => {
    schedulerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Fetch all unassigned jobs for the scheduler
  const { data: unassignedJobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs", { filter: "unassigned" }],
    queryFn: async () => {
      const response = await fetch('/api/jobs?unassigned=true', { credentials: 'include', headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to fetch unassigned jobs');
      return response.json();
    },
    staleTime: 60 * 1000,
  });

  // Fetch jobs with their assignments
  const { data: allJobs = [] } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    staleTime: 60 * 1000,
  });

  // Assign job mutation
  const assignJob = useMutation({
    mutationFn: async ({ jobId, userId }: { jobId: string; userId: string }) => {
      const response = await fetch(`/api/jobs/${jobId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assignedTo: userId }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to assign job');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/today"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/unified"] });
      setSelectedJob(null);
      toast({
        title: "Job assigned",
        description: "The job has been assigned to the team member",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Assignment failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const formatJobTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-AU', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    
    return date.toLocaleDateString('en-AU', { 
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, job: Job) => {
    setDraggedJob(job);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', job.id);
  };

  const handleDragEnd = () => {
    setDraggedJob(null);
    setDragOverMember(null);
  };

  const handleDragOver = (e: React.DragEvent, memberId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverMember(memberId);
  };

  const handleDragLeave = () => {
    setDragOverMember(null);
  };

  const handleDrop = (e: React.DragEvent, member: TeamMember) => {
    e.preventDefault();
    setDragOverMember(null);
    
    if (draggedJob && member.userId) {
      assignJob.mutate({ 
        jobId: draggedJob.id, 
        userId: member.userId 
      });
    }
    setDraggedJob(null);
  };

  // Click-based handlers for mobile support
  const handleJobClick = (job: Job) => {
    if (assignJob.isPending) return;
    setSelectedJob(selectedJob?.id === job.id ? null : job);
  };

  const handleMemberClick = (member: TeamMember) => {
    if (!selectedJob || assignJob.isPending || !member.userId) return;
    assignJob.mutate({ 
      jobId: selectedJob.id, 
      userId: member.userId 
    });
  };

  const cancelJobSelection = () => {
    setSelectedJob(null);
  };

  const getMemberName = (member: TeamMember) => {
    if (member.firstName || member.lastName) {
      return `${member.firstName || ''} ${member.lastName || ''}`.trim();
    }
    return member.email?.split('@')[0] || 'Team Member';
  };

  // Get jobs assigned to a specific member
  const getJobsForMember = (memberId: string) => {
    return allJobs.filter(job => job.assignedTo === memberId && job.status !== 'done' && job.status !== 'invoiced');
  };

  const getStatusBadge = (status: string) => {
    if (status === 'done') {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs font-medium">Complete</Badge>;
    } else if (status === 'in_progress') {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
          In Progress
        </Badge>
      );
    }
    return <Badge variant="outline" className="text-xs font-medium">Scheduled</Badge>;
  };

  // Filter pending/unassigned jobs
  const jobsToAssign = allJobs.filter(job => 
    !job.assignedTo && 
    job.status !== 'done' && 
    job.status !== 'invoiced'
  );

  return (
    <div className="w-full px-4 sm:px-5 py-5 sm:py-6 pb-28 section-gap" data-testid="team-owner-dashboard">
      {/* iOS-Style Header */}
      <div className="space-y-1">
        <h1 className="ios-title">
          {getGreeting()}, {userName}
        </h1>
        <p className="ios-caption">
          {hasActiveTeam 
            ? `Managing ${teamMembers.length} team member${teamMembers.length > 1 ? 's' : ''}`
            : businessName || "Welcome back"}
        </p>
      </div>

      <ConnectionBanner />

      {/* MONEY OWED - Most important metric for tradies */}
      {(kpis?.unpaidInvoicesTotal ?? 0) > 0 && (
        <section>
          <div 
            className="feed-card card-press cursor-pointer border-2"
            style={{ borderColor: 'hsl(var(--destructive) / 0.3)' }}
            onClick={() => onNavigate?.('/documents?tab=invoices&filter=unpaid')}
            data-testid="kpi-money-owed"
          >
            <div className="card-padding">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'hsl(var(--destructive) / 0.1)' }}
                  >
                    <DollarSign className="h-6 w-6" style={{ color: 'hsl(var(--destructive))' }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Money Owed to You</p>
                    <p className="text-3xl font-bold" style={{ color: 'hsl(var(--destructive))' }}>
                      ${(kpis?.unpaidInvoicesTotal || 0).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className="text-destructive border-destructive/30">
                    {kpis?.unpaidInvoicesCount || 0} unpaid
                  </Badge>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Quick Links - KPIs */}
      <section>
        <h2 className="ios-label mb-3">Quick Links</h2>
        <div className="grid grid-cols-2 gap-3">
          <div 
            className="feed-card card-press cursor-pointer"
            onClick={() => onNavigate?.('/work?filter=today')}
            data-testid="kpi-jobs-today"
          >
            <div className="card-padding">
              <div className="flex items-center gap-3">
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
                >
                  <Briefcase className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpis?.jobsToday || 0}</p>
                  <p className="ios-caption">Jobs Today</p>
                </div>
              </div>
            </div>
          </div>
          
          <div 
            className="feed-card card-press cursor-pointer"
            onClick={() => onNavigate?.('/work?filter=done')}
            data-testid="kpi-jobs-to-invoice"
          >
            <div className="card-padding">
              <div className="flex items-center gap-3">
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: (kpis?.jobsToInvoice ?? 0) > 0 ? 'hsl(38 92% 50% / 0.1)' : 'hsl(var(--muted) / 0.5)' }}
                >
                  <Zap className="h-5 w-5" style={{ color: (kpis?.jobsToInvoice ?? 0) > 0 ? 'hsl(38 92% 50%)' : 'hsl(var(--muted-foreground))' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{kpis?.jobsToInvoice ?? 0}</p>
                  <p className="ios-caption">To Invoice</p>
                </div>
              </div>
            </div>
          </div>

          <div 
            className="feed-card card-press cursor-pointer"
            onClick={() => onNavigate?.('/team-operations')}
            data-testid="kpi-team"
          >
            <div className="card-padding">
              <div className="flex items-center gap-3">
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center relative"
                  style={{ backgroundColor: 'hsl(217.2 91.2% 59.8% / 0.1)' }}
                >
                  <Users className="h-5 w-5" style={{ color: 'hsl(217.2, 91.2%, 59.8%)' }} />
                  {onlineTeamCount > 0 && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background" />
                  )}
                </div>
                <div>
                  <p className="text-2xl font-bold">{teamMembers.length}</p>
                  <p className="ios-caption">{onlineTeamCount > 0 ? `${onlineTeamCount} online` : 'Team Hub'}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div 
            className="feed-card card-press cursor-pointer"
            onClick={() => onNavigate?.('/insights')}
            data-testid="kpi-earnings"
          >
            <div className="card-padding">
              <div className="flex items-center gap-3">
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'hsl(142.1 76.2% 36.3% / 0.1)' }}
                >
                  <TrendingUp className="h-5 w-5" style={{ color: 'hsl(142.1, 76.2%, 36.3%)' }} />
                </div>
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'hsl(142.1, 76.2%, 36.3%)' }}>
                    ${kpis?.weeklyEarnings?.toFixed(0) || "0"}
                  </p>
                  <p className="ios-caption">This Week</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    ${kpis?.monthlyEarnings?.toFixed(0) || "0"} this month
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="ios-label mb-3">Quick Actions</h2>
        <div className="feed-card" data-testid="quick-actions-section">
          <div className="card-padding space-y-2">
            <div className="flex gap-2 flex-wrap">
              {onCreateJob && (
                <Button 
                  size="sm"
                  className="flex-1 text-white font-medium h-10 px-3 rounded-xl press-scale min-w-[80px]"
                  style={{ backgroundColor: 'hsl(var(--trade))' }}
                  onClick={onCreateJob}
                  data-testid="button-quick-create-job"
                >
                  <Briefcase className="h-4 w-4 mr-1.5" />
                  <span className="truncate">Job</span>
                </Button>
              )}
              {onCreateQuote && (
                <Button 
                  variant="outline"
                  size="sm"
                  className="flex-1 h-10 px-3 rounded-xl press-scale min-w-[80px]"
                  onClick={onCreateQuote}
                  data-testid="button-quick-create-quote"
                >
                  <FileText className="h-4 w-4 mr-1.5" />
                  <span className="truncate">Quote</span>
                </Button>
              )}
              {hasActiveTeam && jobsToAssign.length > 0 && (
                <Button 
                  variant="outline"
                  size="sm"
                  className="flex-1 h-10 px-3 rounded-xl press-scale min-w-[80px] border-primary/30 text-primary"
                  onClick={scrollToScheduler}
                  data-testid="button-assign-job"
                >
                  <UserPlus className="h-4 w-4 mr-1.5" />
                  <span className="truncate">Assign ({jobsToAssign.length})</span>
                </Button>
              )}
              <Button 
                variant="outline"
                size="sm"
                className="flex-1 h-10 px-3 rounded-xl press-scale min-w-[80px]"
                onClick={() => onNavigate?.('/map')}
                data-testid="button-view-map"
              >
                <Map className="h-4 w-4 mr-1.5" />
                <span className="truncate">Map</span>
              </Button>
              {hasActiveTeam && (
                <Button 
                  variant="outline"
                  size="sm"
                  className="flex-1 h-10 px-3 rounded-xl press-scale min-w-[80px]"
                  onClick={() => onNavigate?.('/team-dashboard')}
                  data-testid="button-team-hub"
                >
                  <Users className="h-4 w-4 mr-1.5" />
                  <span className="truncate">Team</span>
                </Button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant="outline"
                size="sm"
                className="flex-1 h-10 px-3 rounded-xl press-scale min-w-[80px]"
                onClick={() => onNavigate?.('/time-tracking')}
                data-testid="button-log-hours"
              >
                <Timer className="h-4 w-4 mr-1.5" />
                <span className="truncate">Log Hours</span>
              </Button>
              <Button 
                variant="outline"
                size="sm"
                className="flex-1 h-10 px-3 rounded-xl press-scale min-w-[80px]"
                onClick={() => onNavigate?.('/collect-payment')}
                data-testid="button-request-payment"
              >
                <CreditCard className="h-4 w-4 mr-1.5" />
                <span className="truncate">Request Payment</span>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Two-column layout: Left (Job Scheduler + AI Optimizer), Right (Today's Jobs + Activity) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
        {/* LEFT COLUMN - Job Scheduler + AI Optimizer stacking */}
        <div className="space-y-4 lg:space-y-6">
        {/* Job Scheduler - Drag & Drop */}
        {hasActiveTeam && (
          <section ref={schedulerRef} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="ios-section-title flex items-center gap-2.5">
                <div 
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'hsl(217.2 91.2% 59.8% / 0.1)' }}
                >
                  <Users className="h-4 w-4" style={{ color: 'hsl(217.2, 91.2%, 59.8%)' }} />
                </div>
                Job Scheduler
              </h2>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs h-8 px-3 rounded-xl press-scale"
                onClick={() => onNavigate?.('/team')}
                data-testid="button-manage-team"
              >
                Manage Team
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>

            <p className="ios-caption">
              Tap a job, then tap a team member to assign
            </p>

          {/* Selection Banner */}
          {selectedJob && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {assignJob.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    <span className="text-sm font-medium">
                      Assigning <span className="text-primary">"{selectedJob.title}"</span>...
                    </span>
                  </>
                ) : (
                  <>
                    <Briefcase className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">
                      Tap a team member to assign <span className="text-primary">"{selectedJob.title}"</span>
                    </span>
                  </>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={cancelJobSelection}
                disabled={assignJob.isPending}
                data-testid="button-cancel-job-selection"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          )}

          {/* Unassigned Jobs */}
          {jobsToAssign.length > 0 && (
            <Card className="border-dashed" data-testid="unassigned-jobs-card">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {jobsToAssign.length}
                  </Badge>
                  Unassigned Jobs
                </CardTitle>
              </CardHeader>
              <CardContent className="py-0 px-4 pb-4">
                <div className="overflow-x-auto scrollbar-thin" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <div className="flex gap-2 pb-2 w-max">
                    {jobsToAssign.slice(0, 8).map((job) => {
                      const isSelected = selectedJob?.id === job.id;
                      return (
                      <div
                        key={job.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, job)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleJobClick(job)}
                        className={`flex-shrink-0 w-44 p-3 rounded-xl border bg-card hover-elevate cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                        data-testid={`draggable-job-${job.id}`}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm line-clamp-1">{job.title}</p>
                            {job.scheduledAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDate(job.scheduledAt)} {formatJobTime(job.scheduledAt)}
                              </p>
                            )}
                            {job.clientName && (
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                {job.clientName}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                    })}
                    {jobsToAssign.length > 8 && (
                      <Button
                        variant="ghost"
                        className="flex-shrink-0 h-auto py-3 px-4 rounded-xl"
                        onClick={() => onNavigate?.('/work?filter=pending')}
                      >
                        +{jobsToAssign.length - 8} more
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Team Members - Compact View with Search */}
          <div className="feed-card">
            <Collapsible 
              open={isTeamExpanded || !!selectedJob} 
              onOpenChange={setIsTeamExpanded}
            >
              {/* Team Summary Header */}
              <div className="card-padding">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer hover-elevate rounded-lg -m-2 p-2">
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        {teamMembers.slice(0, 4).map((member) => (
                          <UserAvatar
                            key={member.id}
                            className="h-8 w-8 border-2 border-background"
                            fallbackClassName="text-xs font-medium"
                            user={{ id: member.userId || member.id, firstName: member.firstName, lastName: member.lastName, email: member.email, photoUrl: (member as any).profileImageUrl }}
                          />
                        ))}
                        {teamMembers.length > 4 && (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center border-2 border-background">
                            <span className="text-xs font-medium">+{teamMembers.length - 4}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{teamMembers.length} Team Members</p>
                        <p className="text-xs text-muted-foreground">
                          {onlineTeamCount > 0 ? `${onlineTeamCount} online` : 'Tap to expand'}
                        </p>
                      </div>
                    </div>
                    <ChevronDown 
                      className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
                        isTeamExpanded || !!selectedJob ? 'rotate-180' : ''
                      }`} 
                    />
                  </div>
                </CollapsibleTrigger>
              </div>

              <CollapsibleContent className="space-y-3 mt-3 px-4 pb-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search team members..."
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  className="pl-10 h-10 rounded-xl"
                  data-testid="input-team-search"
                />
              </div>

              {/* Filtered Team Members */}
              <div className="grid gap-2 max-h-[400px] overflow-y-auto">
                {teamMembers
                  .filter((member) => {
                    if (!teamSearch) return true;
                    const name = getMemberName(member).toLowerCase();
                    return name.includes(teamSearch.toLowerCase());
                  })
                  .map((member) => {
                    const memberJobs = getJobsForMember(member.userId || '');
                    const isDragOver = dragOverMember === member.id;
                    const canReceiveJobs = !!member.userId && member.inviteStatus === 'accepted';
                    const isClickable = !!selectedJob && !assignJob.isPending && canReceiveJobs;
                    
                    return (
                      <div
                        key={member.id}
                        onDragOver={(e) => handleDragOver(e, member.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, member)}
                        onClick={() => handleMemberClick(member)}
                        className={`p-3 rounded-xl border bg-card transition-all ${
                          isDragOver 
                            ? 'ring-2 ring-primary ring-offset-2' 
                            : isClickable 
                              ? 'cursor-pointer ring-1 ring-primary/30 hover:ring-2 hover:ring-primary' 
                              : 'hover-elevate'
                        }`}
                        data-testid={`team-member-drop-zone-${member.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <UserAvatar
                              className="h-9 w-9"
                              fallbackClassName="text-sm font-medium"
                              user={{ id: member.userId || member.id, firstName: member.firstName, lastName: member.lastName, email: member.email, photoUrl: (member as any).profileImageUrl }}
                            />
                            <div 
                              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background"
                              style={{ backgroundColor: getPresenceColor(getPresenceStatus(member.userId)) }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{getMemberName(member)}</p>
                            <p className="text-xs text-muted-foreground">
                              {memberJobs.length} job{memberJobs.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          {isDragOver && canReceiveJobs && (
                            <Badge size="sm" style={{ backgroundColor: 'hsl(var(--trade))' }} className="text-white text-xs">
                              Drop
                            </Badge>
                          )}
                          {isClickable && !isDragOver && (
                            <Badge variant="outline" className="text-primary border-primary text-xs">
                              Assign
                            </Badge>
                          )}
                          {!canReceiveJobs && (
                            <Badge variant="secondary" className="text-xs">
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CollapsibleContent>
            </Collapsible>
          </div>

            {/* Invite More */}
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl"
              onClick={() => onNavigate?.('/team?invite=true')}
              data-testid="button-invite-team-member"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Team Member
            </Button>
          </section>
        )}

        {/* No Team Members Yet - Prompt to Add */}
        {!hasActiveTeam && (
          <section className="lg:h-fit">
            <Card className="border-dashed" data-testid="add-team-prompt">
              <CardContent className="py-8 text-center">
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: 'hsl(217.2 91.2% 59.8% / 0.1)' }}
                >
                  <Users className="h-8 w-8" style={{ color: 'hsl(217.2, 91.2%, 59.8%)' }} />
                </div>
                <h3 className="font-semibold text-lg mb-2">Build Your Team</h3>
                <p className="text-muted-foreground text-sm mb-4 max-w-sm mx-auto">
                  Invite team members to assign jobs, track locations, and manage your business together.
                </p>
                <Button
                  className="text-white font-medium rounded-xl"
                  style={{ backgroundColor: 'hsl(217.2, 91.2%, 59.8%)' }}
                  onClick={() => onNavigate?.('/team?invite=true')}
                  data-testid="button-invite-first-member"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Your First Team Member
                </Button>
              </CardContent>
            </Card>
          </section>
        )}

        {/* AI SCHEDULE OPTIMIZER - in left column (Pro+ only) */}
        {canUseAIFeatures && (
        <AIScheduleOptimizer 
          className="shadow-lg h-full"
          onApplySchedule={(schedule) => {
            toast({
              title: "Schedule Applied",
              description: `Optimised route with ${schedule.optimizedOrder.length} jobs saved`,
            });
          }}
        />
        )}
        </div>

        {/* RIGHT COLUMN - Today's Jobs + Activity stacking */}
        <div className="space-y-4 lg:space-y-6">
        {/* TODAY'S JOBS — drag-to-reorder, weather + drive-time strip,
            smart context-aware empty state */}
        <TodayScheduleCard
          jobs={todaysJobs}
          onCreateJob={onCreateJob}
          onViewAll={onViewJobs}
          onViewJob={(id) => onNavigate?.(`/jobs/${id}`)}
          onNavigate={onNavigate}
          renderRowActions={(job) => (
            <>
              {getStatusBadge(job.status)}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </>
          )}
        />

        {/* RECENT ACTIVITY - in right column (or first-quote CTA for brand-new owners) */}
        {isBrandNew ? (
          <FirstQuoteCta onCreateQuote={onCreateQuote} />
        ) : (
          <ActivityFeed 
            limit={5}
            onViewAll={() => onNavigate?.('/communications')}
          />
        )}
        </div>
      </div>

      <GettingStartedChecklist 
        onNavigate={onNavigate}
        onCreateClient={() => onNavigate?.('/clients')}
        onCreateQuote={onCreateQuote}
      />

      <FloatingActionButton
        onCreateJob={onCreateJob}
        onCreateQuote={onCreateQuote}
        onCreateInvoice={onCreateInvoice}
        onCreateClient={() => onNavigate?.('/clients/new')}
        onCollectPayment={() => onNavigate?.('/collect-payment')}
      />
    </div>
  );
}
