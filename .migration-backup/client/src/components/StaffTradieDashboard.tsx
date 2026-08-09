import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useState, useEffect, useRef } from "react";
import TodayScheduleCard from "./TodayScheduleCard";
import { 
  Briefcase, 
  MapPin,
  Clock,
  Phone,
  MessageSquare,
  Calendar,
  CalendarDays,
  Play,
  Square,
  Timer,
  CheckCircle2,
  Navigation,
  Wrench,
  ChevronRight,
  Users,
  Target,
  Award,
  DollarSign,
  FileText,
  Receipt,
  FolderOpen,
  Zap,
  WifiOff,
  ShieldCheck,
  Wallet
} from "lucide-react";

interface StaffTradieDashboardProps {
  userName?: string;
  onViewJob?: (id: string) => void;
  onViewJobs?: () => void;
  onOpenTeamChat?: () => void;
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
  description?: string;
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
    <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-2.5 flex items-center gap-3">
      <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">You're offline</p>
        <p className="text-xs text-amber-600 dark:text-amber-400">Your changes will sync when you're back online</p>
      </div>
    </div>
  );
}

export default function StaffTradieDashboard({
  userName = "there",
  onViewJob,
  onViewJobs,
  onOpenTeamChat,
  onNavigate
}: StaffTradieDashboardProps) {
  const { toast } = useToast();
  const [, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch user session data including worker permissions
  const { data: userSession } = useQuery<{
    workerPermissions?: string[];
    role?: string;
  }>({
    queryKey: ["/api/auth/me"],
    staleTime: 300000,
  });

  // Helper function to check if user has a specific permission
  const hasPermission = (permission: string): boolean => {
    if (!userSession?.workerPermissions) return false;
    // Handle wildcard "*" permission (Administrator and other full-access roles)
    if (userSession.workerPermissions.includes('*')) return true;
    return userSession.workerPermissions.includes(permission);
  };

  // Fetch only jobs assigned to this user
  const { data: myJobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs/my-jobs"],
    staleTime: 60000,
  });

  // Fetch available jobs for assignment (if user has permission)
  const { data: availableJobs = [] } = useQuery<Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    scheduledAt: string | null;
    scheduledEndAt: string | null;
    estimatedDuration: number | null;
    priority: string | null;
    suburb: string | null;
    createdAt: string;
  }>>({
    queryKey: ["/api/jobs/available"],
    staleTime: 60000,
    enabled: hasPermission('request_job_assignment'),
  });

  // Request job assignment mutation
  const requestAssignment = useMutation({
    mutationFn: async ({ jobId, reason }: { jobId: string; reason?: string }) => {
      const response = await fetch(`/api/jobs/${jobId}/request-assignment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to request assignment');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Request Submitted",
        description: "Your job assignment request has been sent to the business owner.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs/available"] });
      queryClient.invalidateQueries({ queryKey: ["/api/job-assignment-requests"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Request Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch active time entry
  const { data: activeTimeEntry } = useQuery<any>({
    queryKey: ["/api/time-entries/active/current"],
  });

  // Fetch today's time tracking data
  const { data: timeTrackingData } = useQuery<any>({
    queryKey: ["/api/time-tracking/dashboard"],
    staleTime: 60000,
  });

  const todaysTimeEntries = timeTrackingData?.recentEntries || [];
  const totalMinutesToday = todaysTimeEntries.reduce((total: number, entry: any) => {
    if (entry.duration) return total + entry.duration;
    if (entry.endTime) {
      const start = new Date(entry.startTime).getTime();
      const end = new Date(entry.endTime).getTime();
      return total + Math.floor((end - start) / 60000);
    }
    return total;
  }, 0);

  // Calculate weekly stats from jobs
  const getWeeklyStats = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    
    // Count jobs scheduled this week that are completed
    const completedThisWeek = myJobs.filter(job => {
      if (job.status !== 'done' && job.status !== 'invoiced') return false;
      // Filter by scheduled date being this week (best proxy for completion date)
      if (!job.scheduledAt) return false;
      const jobDate = new Date(job.scheduledAt);
      return jobDate >= startOfWeek && jobDate < endOfWeek;
    });
    
    // Count all jobs scheduled this week (regardless of status)
    const scheduledThisWeek = myJobs.filter(job => {
      if (!job.scheduledAt) return false;
      const jobDate = new Date(job.scheduledAt);
      return jobDate >= startOfWeek && jobDate < endOfWeek;
    });
    
    // Use actual time tracking data
    const hoursWorked = Math.floor(totalMinutesToday / 60);
    
    return {
      completedCount: completedThisWeek.length,
      scheduledCount: scheduledThisWeek.length,
      weeklyHours: hoursWorked,
    };
  };
  
  const weeklyStats = getWeeklyStats();

  // Format elapsed time
  const formatElapsedTime = () => {
    if (!activeTimeEntry) return "00:00:00";
    const startTime = new Date(activeTimeEntry.startTime).getTime();
    const elapsed = Date.now() - startTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Update timer every second
  useEffect(() => {
    if (activeTimeEntry) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setElapsedSeconds(0);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeTimeEntry]);

  // Start work mutation
  const startWork = useMutation({
    mutationFn: async (job: Job) => {
      // Start timer
      const timerResponse = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobId: job.id, startTime: new Date().toISOString() }),
      });
      if (!timerResponse.ok) {
        const error = await timerResponse.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to start timer');
      }
      
      // Update job status (use staff-specific status endpoint)
      const statusResponse = await fetch(`/api/jobs/${job.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'in_progress' }),
      });
      
      if (!statusResponse.ok) {
        const error = await statusResponse.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to update job status');
      }
      
      return job;
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs/my-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      toast({ title: "Work started!", description: `Timer running for: ${job.title}` });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to start", description: error.message, variant: "destructive" });
    },
  });

  // Stop timer mutation
  const stopTimer = useMutation({
    mutationFn: async () => {
      if (!activeTimeEntry) throw new Error('No active timer');
      const endTime = new Date();
      const startTime = new Date(activeTimeEntry.startTime);
      const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
      
      const response = await fetch(`/api/time-entries/${activeTimeEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endTime: endTime.toISOString(), duration: durationMinutes }),
      });
      if (!response.ok) throw new Error('Failed to stop timer');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      toast({ title: "Timer stopped", description: "Time has been recorded" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to stop", description: error.message, variant: "destructive" });
    },
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-AU', { 
      hour: '2-digit', 
      minute: '2-digit' 
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

  // Filter jobs by status
  const activeJobs = myJobs.filter(job => job.status !== 'done' && job.status !== 'invoiced');
  const todaysJobs = activeJobs.filter(job => {
    if (!job.scheduledAt) return false;
    const jobDate = new Date(job.scheduledAt);
    const today = new Date();
    return jobDate.toDateString() === today.toDateString();
  });
  
  // This week's jobs (next 7 days, excluding today)
  const thisWeeksJobs = activeJobs.filter(job => {
    if (!job.scheduledAt) return false;
    const jobDate = new Date(job.scheduledAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    return jobDate > today && jobDate <= endOfWeek && jobDate.toDateString() !== today.toDateString();
  });

  const nextJob = activeJobs.find(job => job.status === 'in_progress') || 
                  todaysJobs.find(job => job.status === 'scheduled') ||
                  todaysJobs[0];

  const isStartable = (status: string) => status === 'scheduled' || status === 'pending';

  const getStatusBadge = (status: string) => {
    if (status === 'done') {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Complete</Badge>;
    } else if (status === 'in_progress') {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
          In Progress
        </Badge>
      );
    }
    return <Badge variant="outline" className="text-xs">Scheduled</Badge>;
  };

  // Friendly today date for the header
  const todayLabel = new Date().toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const heroSubtitle = activeTimeEntry
    ? `On the clock — keep it up`
    : todaysJobs.length > 0
      ? `${todaysJobs.length} job${todaysJobs.length > 1 ? 's' : ''} on your plate today`
      : activeJobs.length > 0
        ? `${activeJobs.length} job${activeJobs.length > 1 ? 's' : ''} coming up`
        : `Your day is clear. Enjoy it.`;

  // Quick actions (permission gated) — uniform, formal rows (no rainbow chips)
  const quickActions: { key: string; label: string; description: string; icon: typeof Timer; onClick: () => void }[] = [
    { key: 'log-hours', label: 'Log Hours', description: 'Track time on a job', icon: Timer, onClick: () => onNavigate?.('/time-tracking') },
    ...(hasPermission('collect_payments') ? [{ key: 'collect-payment', label: 'Collect Payment', description: 'Take a customer payment', icon: DollarSign, onClick: () => onNavigate?.('/payments') }] : []),
    ...(hasPermission('create_quotes') ? [{ key: 'create-quote', label: 'New Quote', description: 'Quote a customer', icon: FileText, onClick: () => onNavigate?.('/quotes/new') }] : []),
    ...(hasPermission('create_invoices') ? [{ key: 'create-invoice', label: 'New Invoice', description: 'Bill for work done', icon: Receipt, onClick: () => onNavigate?.('/invoices/new') }] : []),
    { key: 'log-expense', label: 'Log Expense', description: 'Record a cost', icon: Wallet, onClick: () => onNavigate?.('/expenses') },
    { key: 'safety-forms', label: 'Safety Forms', description: 'SWMS & checklists', icon: ShieldCheck, onClick: () => onNavigate?.('/whs') },
    ...((hasPermission('view_invoices') || hasPermission('view_quotes')) ? [{ key: 'view-documents', label: 'Documents', description: 'Quotes & invoices', icon: FolderOpen, onClick: () => onNavigate?.('/documents') }] : []),
  ];

  return (
    <div className="w-full px-4 sm:px-6 py-4 pb-28 md:pb-6 space-y-3" data-testid="staff-tradie-dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
            {todayLabel}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {getGreeting()}, {userName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{heroSubtitle}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" onClick={() => onNavigate?.('/time-tracking')} data-testid="button-header-log-hours">
            <Timer className="h-3.5 w-3.5 mr-1" />
            Log Hours
          </Button>
          {onOpenTeamChat && (
            <Button variant="outline" size="sm" onClick={onOpenTeamChat} data-testid="button-header-team-chat">
              <Users className="h-3.5 w-3.5 mr-1" />
              Chat
            </Button>
          )}
        </div>
      </div>

      <ConnectionBanner />

      {/* Time Tracking */}
      <Card
        className="overflow-hidden"
        style={activeTimeEntry ? {
          background: `linear-gradient(135deg, hsl(var(--trade) / 0.10), hsl(var(--trade) / 0.02))`,
          borderColor: 'hsl(var(--trade) / 0.35)',
        } : undefined}
        data-testid="time-tracking-widget"
      >
        <CardContent className="py-3.5 px-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-10 w-10 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: activeTimeEntry ? 'hsl(var(--trade) / 0.16)' : 'hsl(var(--muted))' }}
              >
                {activeTimeEntry ? (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'hsl(var(--trade))' }} />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: 'hsl(var(--trade))' }} />
                  </span>
                ) : (
                  <Timer className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                {activeTimeEntry ? (
                  <>
                    <p className="text-2xl font-bold font-mono tabular-nums tracking-tight leading-none" style={{ color: 'hsl(var(--trade))' }}>
                      {formatElapsedTime()}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1">{activeTimeEntry.jobTitle || 'On the clock'}</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold tabular-nums tracking-tight leading-none">
                      {Math.floor(totalMinutesToday / 60)}<span className="text-base font-semibold text-muted-foreground">h </span>
                      {totalMinutesToday % 60}<span className="text-base font-semibold text-muted-foreground">m</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Logged today</p>
                  </>
                )}
              </div>
            </div>

            {activeTimeEntry ? (
              <Button variant="destructive" onClick={() => stopTimer.mutate()} disabled={stopTimer.isPending} data-testid="button-stop-timer">
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            ) : nextJob && isStartable(nextJob.status) ? (
              <Button
                className="text-white font-medium"
                style={{ backgroundColor: 'hsl(var(--trade))' }}
                onClick={() => startWork.mutate(nextJob)}
                disabled={startWork.isPending}
                data-testid="button-start-next"
              >
                <Play className="h-4 w-4 mr-2" />
                Start
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { key: 'today', label: 'Today', icon: CalendarDays, value: <>{todaysJobs.length}</>, onClick: () => onNavigate?.('/work?filter=today') },
          { key: 'this-week', label: 'This Week', icon: Calendar, value: <>{weeklyStats.scheduledCount}</>, onClick: () => onNavigate?.('/work') },
          { key: 'completed', label: 'Done', icon: CheckCircle2, value: <>{weeklyStats.completedCount}</>, onClick: () => onNavigate?.('/work?filter=done') },
          { key: 'hours', label: 'Logged', icon: Clock, value: (
            <>{Math.floor(totalMinutesToday / 60)}<span className="text-base font-semibold text-muted-foreground">h </span>{totalMinutesToday % 60}<span className="text-base font-semibold text-muted-foreground">m</span></>
          ), onClick: () => onNavigate?.('/time-tracking') },
        ].map((kpi) => (
          <Card key={kpi.key} className="cursor-pointer hover-elevate" onClick={kpi.onClick} data-testid={`kpi-${kpi.key}`}>
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{kpi.label}</p>
                <kpi.icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              </div>
              <p className="text-[26px] leading-none font-bold tabular-nums tracking-tight mt-2.5 truncate">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two-column work surface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
        {/* MAIN COLUMN — primary work surface */}
        <div className="lg:col-span-2 min-w-0 space-y-3">

          {/* No jobs assigned */}
          {!jobsLoading && activeJobs.length === 0 && (
            <Card data-testid="no-jobs-assigned">
              <CardContent className="py-10 px-6 text-center">
                <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center mx-auto mb-3">
                  <Award className="h-6 w-6" style={{ color: 'hsl(var(--trade))' }} />
                </div>
                <h3 className="font-semibold text-base mb-1">All clear for now</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-4 leading-relaxed">
                  No jobs assigned yet. Your manager will send work your way and it'll show up right here.
                </p>
                {onOpenTeamChat && (
                  <Button variant="outline" size="sm" onClick={onOpenTeamChat} data-testid="button-open-team-chat">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Message the team
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Current / Next Job */}
          {nextJob && (
            <Card
              data-testid="current-job-card"
              style={nextJob.status === 'in_progress' ? { borderColor: 'hsl(var(--trade) / 0.5)' } : undefined}
            >
              <CardHeader className="flex flex-row items-center justify-between gap-4 py-3 px-4">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Wrench className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
                  {nextJob.status === 'in_progress' ? 'Current Job' : 'Next Job'}
                </CardTitle>
                {getStatusBadge(nextJob.status)}
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-lg leading-tight">{nextJob.title}</h3>
                  {nextJob.scheduledAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(nextJob.scheduledAt)} · {formatTime(nextJob.scheduledAt)}
                    </p>
                  )}
                </div>

                {(nextJob.clientName || nextJob.address) && (
                  <div className="space-y-1.5">
                    {nextJob.clientName && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Briefcase className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{nextJob.clientName}</span>
                      </div>
                    )}
                    {nextJob.address && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span className="line-clamp-1">{nextJob.address}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Contact / navigate */}
                {(nextJob.clientPhone || nextJob.address) && (
                  <div className="flex flex-wrap gap-2">
                    {nextJob.clientPhone && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => window.location.href = `tel:${nextJob.clientPhone}`} data-testid="button-call-client">
                          <Phone className="h-4 w-4 mr-1.5" />
                          Call
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => window.location.href = `sms:${nextJob.clientPhone}`} data-testid="button-sms-client">
                          <MessageSquare className="h-4 w-4 mr-1.5" />
                          SMS
                        </Button>
                      </>
                    )}
                    {nextJob.address && (
                      <Button variant="outline" size="sm" onClick={() => window.open(`https://maps.google.com/maps?q=${encodeURIComponent(nextJob.address!)}`, '_blank')} data-testid="button-navigate">
                        <Navigation className="h-4 w-4 mr-1.5" />
                        Navigate
                      </Button>
                    )}
                  </div>
                )}

                {/* Primary action */}
                {isStartable(nextJob.status) ? (
                  <Button
                    className="w-full text-white font-semibold"
                    style={{ backgroundColor: 'hsl(var(--trade))' }}
                    onClick={() => startWork.mutate(nextJob)}
                    disabled={startWork.isPending}
                    data-testid="button-start-work"
                  >
                    <Wrench className="h-4 w-4 mr-2" />
                    Start Work
                  </Button>
                ) : nextJob.status === 'in_progress' ? (
                  <Button
                    className="w-full text-white font-semibold"
                    style={{ backgroundColor: 'hsl(142.1 76.2% 36.3%)' }}
                    onClick={() => onViewJob?.(nextJob.id)}
                    data-testid="button-go-complete-job"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Go Complete Job
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => onViewJob?.(nextJob.id)} data-testid="button-view-job">
                    View Details
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Today's Schedule */}
          <TodayScheduleCard
            jobs={todaysJobs}
            smartEmptyEnabled
            onViewJob={(id) => onViewJob?.(id)}
            onNavigate={onNavigate}
            renderRowActions={(job) => (
              activeTimeEntry?.jobId === job.id ? (
                <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); stopTimer.mutate(); }}>
                  <Square className="w-3 h-3 mr-1" />
                  {formatElapsedTime()}
                </Button>
              ) : (
                <>
                  {getStatusBadge(job.status)}
                  {isStartable(job.status) && (
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); startWork.mutate(job); }}>
                      <Play className="w-3 h-3 mr-1" />
                      Start
                    </Button>
                  )}
                </>
              )
            )}
          />

        </div>
        {/* end MAIN COLUMN */}

        {/* SIDE COLUMN — quick actions + at-a-glance lists */}
        <div className="min-w-0 space-y-3">

          {/* Quick Actions */}
          <Card data-testid="quick-actions-section">
            <CardHeader className="flex flex-row items-center justify-between gap-4 py-3 px-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-2 pb-2">
              <div className="flex flex-col">
                {quickActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className="group flex items-center gap-3 w-full text-left rounded-md px-2 py-2.5 hover-elevate active-elevate-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={action.onClick}
                    data-testid={`button-${action.key}`}
                  >
                    <span className="w-9 h-9 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <action.icon className="h-[18px] w-[18px] text-foreground" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-tight truncate">{action.label}</span>
                      <span className="block text-xs text-muted-foreground leading-tight truncate">{action.description}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* This Week */}
          {thisWeeksJobs.length > 0 && (
            <Card data-testid="this-week-section">
              <CardHeader className="flex flex-row items-center justify-between gap-4 py-3 px-4">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  This Week
                </CardTitle>
                <Badge variant="secondary" className="text-xs">{thisWeeksJobs.length}</Badge>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="space-y-1">
                  {thisWeeksJobs.slice(0, 5).map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between gap-3 p-2 rounded-md cursor-pointer hover-elevate"
                      onClick={() => onViewJob?.(job.id)}
                      data-testid={`week-job-${job.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate text-sm">{job.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {job.scheduledAt && formatDate(job.scheduledAt)}
                          {job.clientName && ` · ${job.clientName}`}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  ))}
                  {thisWeeksJobs.length > 5 && (
                    <Button variant="ghost" size="sm" className="w-full text-xs mt-1" onClick={onViewJobs} data-testid="button-view-all-week">
                      View all {thisWeeksJobs.length} jobs
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Available Jobs */}
          {hasPermission('request_job_assignment') && availableJobs.length > 0 && (
            <Card data-testid="available-jobs-section">
              <CardHeader className="flex flex-row items-center justify-between gap-4 py-3 px-4">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Available Jobs
                </CardTitle>
                <Badge variant="outline" className="text-xs">{availableJobs.length}</Badge>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-4">
                <div className="space-y-2">
                  {availableJobs.slice(0, 5).map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-md border bg-muted/30"
                      data-testid={`available-job-${job.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate text-sm">{job.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {job.scheduledAt && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(job.scheduledAt).toLocaleDateString()}
                            </span>
                          )}
                          {job.suburb && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 flex-shrink-0" />
                              {job.suburb}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => requestAssignment.mutate({ jobId: job.id })}
                        disabled={requestAssignment.isPending}
                        data-testid={`request-job-${job.id}`}
                      >
                        {requestAssignment.isPending ? (
                          <Clock className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Zap className="h-3 w-3 mr-1" />
                            Request
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                  {availableJobs.length > 5 && (
                    <p className="text-xs text-center text-muted-foreground pt-1">
                      And {availableJobs.length - 5} more available
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Team Chat */}
          {onOpenTeamChat && (
            <Button variant="outline" className="w-full" onClick={onOpenTeamChat} data-testid="button-team-chat">
              <Users className="h-4 w-4 mr-2" />
              Team Chat
            </Button>
          )}

        </div>
        {/* end SIDE COLUMN */}
      </div>
      {/* end two-column grid */}
    </div>
  );
}
