import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock,
  MapPin,
  GripVertical,
  User,
  CalendarDays,
  Info,
  X,
  ArrowRight,
  Briefcase,
  Plus,
  AlertTriangle,
  LayoutGrid,
  List,
  Sparkles,
  CheckCircle2,
  Wrench,
  Navigation,
  BarChart3,
  Loader2,
  Zap
} from "lucide-react";
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  isSameDay,
  parseISO,
  isWithinInterval,
} from "date-fns";
import { useAuth } from "@/hooks/useAuth";

interface Job {
  id: string;
  title: string;
  status: string;
  scheduledAt?: string;
  scheduledTime?: string;
  estimatedDuration?: number;
  address?: string;
  clientId: string;
  assignedTo?: string | null;
}

interface TeamMember {
  id: string;
  memberId: string;
  firstName?: string;
  lastName?: string;
  email: string;
  roleName: string;
  profileImageUrl?: string;
  isActive: boolean;
}

interface Client {
  id: string;
  name: string;
}

interface TeamSchedulerProps {
  onViewJob?: (id: string) => void;
  onCreateJob?: () => void;
}

interface DraggedJob {
  job: Job;
  originMemberId: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  pending: { 
    bg: 'bg-amber-50 dark:bg-amber-900/20', 
    text: 'text-amber-700 dark:text-amber-300', 
    border: 'border-l-amber-500' 
  },
  scheduled: { 
    bg: 'bg-blue-50 dark:bg-blue-900/20', 
    text: 'text-blue-700 dark:text-blue-300', 
    border: 'border-l-blue-500' 
  },
  in_progress: { 
    bg: 'bg-orange-50 dark:bg-orange-900/20', 
    text: 'text-orange-700 dark:text-orange-300', 
    border: 'border-l-orange-500' 
  },
  done: { 
    bg: 'bg-green-50 dark:bg-green-900/20', 
    text: 'text-green-700 dark:text-green-300', 
    border: 'border-l-green-500' 
  },
  completed: { 
    bg: 'bg-green-50 dark:bg-green-900/20', 
    text: 'text-green-700 dark:text-green-300', 
    border: 'border-l-green-500' 
  },
  invoiced: { 
    bg: 'bg-purple-50 dark:bg-purple-900/20', 
    text: 'text-purple-700 dark:text-purple-300', 
    border: 'border-l-purple-500' 
  },
};

function getStatusStyle(status: string) {
  const lower = status.toLowerCase().replace(' ', '_');
  return STATUS_COLORS[lower] || STATUS_COLORS.pending;
}

function formatDuration(minutes?: number): string {
  if (!minutes) return '1h';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getInitials(firstName?: string, lastName?: string, email?: string): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) return firstName.substring(0, 2).toUpperCase();
  if (email) return email.substring(0, 2).toUpperCase();
  return 'TM';
}

function getMemberDisplayName(member: TeamMember): string {
  if (member.firstName && member.lastName) {
    return `${member.firstName} ${member.lastName}`;
  }
  if (member.firstName) return member.firstName;
  return member.email.split('@')[0];
}

function parseTimeToHour(timeStr?: string): number {
  if (!timeStr) return 9;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h)) return 9;
  return h + (isNaN(m) ? 0 : m / 60);
}

function hourToTimeStr(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}

const WORK_HOURS = Array.from({ length: 12 }, (_, i) => i + 6);
const HOUR_HEIGHT = 52;

export default function TeamScheduler({ onViewJob, onCreateJob }: TeamSchedulerProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [draggedJob, setDraggedJob] = useState<DraggedJob | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [teamOnboardingDismissed, setTeamOnboardingDismissed] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem('team-scheduler-onboarding-dismissed') === 'true'
  );
  const [suggestJobId, setSuggestJobId] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<{
    jobId: string;
    scheduledAt: string;
    scheduledTime: string;
    assignedTo: string;
    memberName: string;
    existingJobs: string[];
  } | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ['/api/jobs'],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['/api/team/members'],
  });

  interface SuggestionScore {
    score: number;
    weight: number;
    details: string[];
  }

  interface AssigneeSuggestion {
    teamMemberId: string;
    memberId: string;
    name: string;
    isOwner: boolean;
    totalScore: number;
    scores: {
      availability: SuggestionScore;
      skills: SuggestionScore;
      proximity: SuggestionScore;
      workload: SuggestionScore;
    };
  }

  const { data: suggestions, isLoading: suggestionsLoading } = useQuery<{ suggestions: AssigneeSuggestion[] }>({
    queryKey: ['/api/jobs', suggestJobId, 'suggest-assignee'],
    enabled: !!suggestJobId,
  });

  const autoAssignMutation = useMutation({
    mutationFn: async ({ jobId, assignedTo }: { jobId: string; assignedTo: string }) => {
      return apiRequest('PATCH', `/api/jobs/${jobId}`, {
        assignedTo,
        status: 'scheduled',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      setSuggestJobId(null);
      toast({
        title: "Job assigned",
        description: "The best-fit team member has been assigned",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to assign",
        description: error.message || "Could not assign the job",
        variant: "destructive",
      });
    },
  });

  const clientsMap = useMemo(() => 
    new Map(clients.map(c => [c.id, c])), 
    [clients]
  );

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(currentWeekStart, i));
    }
    return days;
  }, [currentWeekStart]);

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });

  const weekJobs = useMemo(() => {
    return jobs.filter(job => {
      if (!job.scheduledAt) return false;
      const jobDate = parseISO(job.scheduledAt);
      return isWithinInterval(jobDate, { start: currentWeekStart, end: weekEnd });
    });
  }, [jobs, currentWeekStart, weekEnd]);

  const unassignedJobs = useMemo(() => {
    return jobs.filter(job => 
      !job.assignedTo && 
      !job.scheduledAt &&
      ['pending', 'scheduled'].includes(job.status.toLowerCase())
    );
  }, [jobs]);

  const ownerId = user?.id;
  
  const allMembers = useMemo(() => {
    const activeMembers = teamMembers.filter(m => m.isActive);
    
    if (ownerId) {
      const ownerMember: TeamMember = {
        id: ownerId,
        memberId: ownerId,
        firstName: user?.firstName || 'Me',
        lastName: user?.lastName || '(Owner)',
        email: user?.email || '',
        roleName: 'Owner',
        profileImageUrl: user?.profileImageUrl,
        isActive: true,
      };
      return [ownerMember, ...activeMembers];
    }
    
    return activeMembers;
  }, [teamMembers, user, ownerId]);

  const rescheduleJobMutation = useMutation({
    mutationFn: async ({ 
      jobId, 
      scheduledAt, 
      scheduledTime,
      assignedTo 
    }: { 
      jobId: string; 
      scheduledAt: string;
      scheduledTime?: string;
      assignedTo: string | null;
    }) => {
      return apiRequest('PATCH', `/api/jobs/${jobId}`, {
        scheduledAt,
        scheduledTime,
        assignedTo,
        status: 'scheduled'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Job scheduled",
        description: "The job has been scheduled and assigned",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to assign job",
        description: error.message || "Could not assign the job",
        variant: "destructive",
      });
    },
  });

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => 
      addDays(prev, direction === 'next' ? 7 : -7)
    );
  };

  const goToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
    setSelectedDay(new Date());
  };

  const handleDragStart = (e: React.DragEvent, job: Job, memberId: string | null) => {
    setDraggedJob({ job, originMemberId: memberId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', job.id);
  };

  const handleDragOver = (e: React.DragEvent, cellId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCell(cellId);
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const getJobsForMemberAndDay = useCallback((memberId: string, date: Date): Job[] => {
    return weekJobs.filter(job => {
      const jobDate = parseISO(job.scheduledAt!);
      const matchesDate = isSameDay(jobDate, date);
      const isOwnerRow = memberId === ownerId;
      const matchesMember = isOwnerRow 
        ? (!job.assignedTo || job.assignedTo === ownerId)
        : job.assignedTo === memberId;
      return matchesDate && matchesMember;
    });
  }, [weekJobs, ownerId]);

  const getMemberDisplayName = useCallback((memberId: string): string => {
    const member = allMembers.find(m => m.memberId === memberId);
    if (!member) return 'Team Member';
    if (member.firstName && member.lastName) {
      return `${member.firstName} ${member.lastName}`;
    }
    if (member.firstName) return member.firstName;
    return member.email.split('@')[0];
  }, [allMembers]);

  const checkAndSchedule = useCallback((jobId: string, memberId: string, date: Date, hour: number, jobDurationMinutes?: number) => {
    const scheduledDate = new Date(date);
    scheduledDate.setHours(hour, 0, 0, 0);
    const timeStr = hourToTimeStr(hour);

    const existingJobs = getJobsForMemberAndDay(memberId, date);
    const dropDuration = Math.max(1, Math.ceil((jobDurationMinutes || 60) / 60));
    const conflicting = existingJobs.filter(j => {
      if (j.id === jobId) return false;
      const jStart = parseTimeToHour(j.scheduledTime);
      const jDuration = Math.ceil((j.estimatedDuration || 60) / 60);
      const jEnd = jStart + jDuration;
      return hour < jEnd && (hour + dropDuration) > jStart;
    });

    if (conflicting.length > 0) {
      setConflictWarning({
        jobId,
        scheduledAt: scheduledDate.toISOString(),
        scheduledTime: timeStr,
        assignedTo: memberId,
        memberName: getMemberDisplayName(memberId),
        existingJobs: conflicting.map(j => j.title || 'Untitled Job'),
      });
      return;
    }

    rescheduleJobMutation.mutate({
      jobId,
      scheduledAt: scheduledDate.toISOString(),
      scheduledTime: timeStr,
      assignedTo: memberId,
    });
  }, [getJobsForMemberAndDay, getMemberDisplayName, rescheduleJobMutation]);

  const handleDropOnHour = (e: React.DragEvent, memberId: string, date: Date, hour: number) => {
    e.preventDefault();
    setDragOverCell(null);
    if (!draggedJob) return;
    checkAndSchedule(draggedJob.job.id, memberId, date, hour, draggedJob.job.estimatedDuration);
    setDraggedJob(null);
  };

  const handleDropOnDay = (e: React.DragEvent, memberId: string, date: Date) => {
    e.preventDefault();
    setDragOverCell(null);
    if (!draggedJob) return;
    checkAndSchedule(draggedJob.job.id, memberId, date, 9, draggedJob.job.estimatedDuration);
    setDraggedJob(null);
  };

  const handleDragEnd = () => {
    setDraggedJob(null);
    setDragOverCell(null);
  };

  const getConflictsForMemberAndDay = useCallback((memberId: string, date: Date): { hour: number; count: number }[] => {
    const dayJobs = getJobsForMemberAndDay(memberId, date);
    const hourCounts = new Map<number, number>();
    
    dayJobs.forEach(job => {
      const startHour = parseTimeToHour(job.scheduledTime);
      const durationHours = Math.ceil((job.estimatedDuration || 60) / 60);
      const firstHour = Math.floor(startHour);
      for (let h = firstHour; h < firstHour + durationHours; h++) {
        hourCounts.set(h, (hourCounts.get(h) || 0) + 1);
      }
    });

    const conflicts: { hour: number; count: number }[] = [];
    hourCounts.forEach((count, hour) => {
      if (count > 1) {
        conflicts.push({ hour, count });
      }
    });
    return conflicts;
  }, [getJobsForMemberAndDay]);

  const isToday = (date: Date) => isSameDay(date, new Date());

  return (
    <div className="flex flex-col h-full" data-testid="team-scheduler">
      {!teamOnboardingDismissed && (
        <div className="flex items-center gap-3 p-3 rounded-md border border-primary/20 bg-primary/5 mb-4">
          <Info className="h-5 w-5 text-primary flex-shrink-0" />
          <p className="text-sm flex-1">
            <span className="font-medium">Tip:</span> Drag unassigned jobs onto time slots to assign and schedule them. Switch to Timeline view for hourly precision.
          </p>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              localStorage.setItem('team-scheduler-onboarding-dismissed', 'true');
              setTeamOnboardingDismissed(true);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateWeek('prev')} data-testid="button-prev-week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday} data-testid="button-today-scheduler">
            <CalendarDays className="h-4 w-4 mr-1" />
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateWeek('next')} data-testid="button-next-week">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <h3 className="text-lg font-semibold">
          {format(currentWeekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
        </h3>

        <div className="flex items-center gap-1 border rounded-md p-0.5">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Week
          </Button>
          <Button
            variant={viewMode === 'timeline' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('timeline')}
          >
            <List className="h-4 w-4 mr-1" />
            Timeline
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-3 text-sm flex-wrap">
        <div className="flex items-center gap-1.5">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {weekJobs.length} job{weekJobs.length !== 1 ? 's' : ''} this week
          </span>
        </div>
        <Badge
          variant="secondary"
          className="text-xs"
          style={unassignedJobs.length > 0 ? {
            backgroundColor: 'hsl(45 93% 47% / 0.15)',
            color: 'hsl(45 93% 37%)',
          } : {}}
        >
          {unassignedJobs.length} unassigned
        </Badge>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <Card className={`w-52 flex-shrink-0 ${unassignedJobs.length > 0 ? 'ring-2 ring-amber-400/50' : ''}`}>
          <CardContent className="p-3">
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <GripVertical className="h-4 w-4" />
              Unassigned
              {unassignedJobs.length > 0 && <ArrowRight className="h-3.5 w-3.5 text-amber-500" />}
              <Badge variant="secondary" className="ml-auto text-[10px]"
                style={unassignedJobs.length > 0 ? { backgroundColor: 'hsl(45 93% 47% / 0.15)', color: 'hsl(45 93% 37%)' } : {}}
              >
                {unassignedJobs.length}
              </Badge>
            </h4>
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-2 pr-2">
                {unassignedJobs.length === 0 ? (
                  <div className="text-center py-4">
                    <Briefcase className="h-6 w-6 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">All jobs assigned</p>
                  </div>
                ) : (
                  unassignedJobs.map(job => {
                    const client = clientsMap.get(job.clientId);
                    const statusStyle = getStatusStyle(job.status);
                    return (
                      <div
                        key={job.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, job, null)}
                        onDragEnd={handleDragEnd}
                        className={`p-2 rounded-md border-l-4 cursor-grab active:cursor-grabbing hover-elevate active-elevate-2 transition-all ${statusStyle.bg} ${statusStyle.border} ${draggedJob?.job.id === job.id ? 'opacity-50' : ''}`}
                        data-testid={`unassigned-job-${job.id}`}
                      >
                        <div onClick={() => onViewJob?.(job.id)}>
                          <p className={`text-xs font-medium truncate ${statusStyle.text}`}>{job.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{client?.name || 'Unknown client'}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">{formatDuration(job.estimatedDuration)}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-1.5 text-[10px] gap-1"
                          onClick={(e) => { e.stopPropagation(); setSuggestJobId(job.id); }}
                          data-testid={`suggest-assignee-${job.id}`}
                        >
                          <Sparkles className="h-3 w-3" />
                          Auto-suggest
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {viewMode === 'grid' ? (
          <WeekGridView
            allMembers={allMembers}
            weekDays={weekDays}
            clientsMap={clientsMap}
            draggedJob={draggedJob}
            dragOverCell={dragOverCell}
            ownerId={ownerId}
            weekJobs={weekJobs}
            unassignedJobs={unassignedJobs}
            isToday={isToday}
            getJobsForMemberAndDay={getJobsForMemberAndDay}
            getConflictsForMemberAndDay={getConflictsForMemberAndDay}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDropOnDay}
            onDragEnd={handleDragEnd}
            onViewJob={onViewJob}
          />
        ) : (
          <TimelineView
            allMembers={allMembers}
            weekDays={weekDays}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            clientsMap={clientsMap}
            draggedJob={draggedJob}
            dragOverCell={dragOverCell}
            ownerId={ownerId}
            weekJobs={weekJobs}
            isToday={isToday}
            getJobsForMemberAndDay={getJobsForMemberAndDay}
            getConflictsForMemberAndDay={getConflictsForMemberAndDay}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDropOnHour={handleDropOnHour}
            onDragEnd={handleDragEnd}
            onViewJob={onViewJob}
          />
        )}
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-md bg-amber-100 dark:bg-amber-900/30 border-l-2 border-amber-500" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-md bg-blue-100 dark:bg-blue-900/30 border-l-2 border-blue-500" />
            <span>Scheduled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-md bg-orange-100 dark:bg-orange-900/30 border-l-2 border-orange-500" />
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-md bg-green-100 dark:bg-green-900/30 border-l-2 border-green-500" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3 w-3 text-red-500" />
            <span>Conflict</span>
          </div>
        </div>
      </div>

      {suggestJobId && (
        <SuggestionPanel
          jobId={suggestJobId}
          jobTitle={jobs.find(j => j.id === suggestJobId)?.title || 'Job'}
          suggestions={suggestions?.suggestions || []}
          isLoading={suggestionsLoading}
          isPending={autoAssignMutation.isPending}
          onAssign={(memberId: string) => {
            autoAssignMutation.mutate({ jobId: suggestJobId, assignedTo: memberId });
          }}
          onAutoAssign={() => {
            const top = suggestions?.suggestions?.[0];
            if (top) {
              autoAssignMutation.mutate({ jobId: suggestJobId, assignedTo: top.memberId });
            }
          }}
          onClose={() => setSuggestJobId(null)}
        />
      )}

      <AlertDialog open={!!conflictWarning} onOpenChange={() => setConflictWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Schedule Conflict Detected
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  <span className="font-medium text-foreground">{conflictWarning?.memberName}</span> already has {conflictWarning?.existingJobs.length === 1 ? 'a job' : 'jobs'} scheduled at this time:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {conflictWarning?.existingJobs.map((name, i) => (
                    <li key={i} className="text-sm font-medium text-foreground">{name}</li>
                  ))}
                </ul>
                <p className="text-sm">Do you want to schedule this job anyway? This will create a double-booking.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (conflictWarning) {
                  rescheduleJobMutation.mutate({
                    jobId: conflictWarning.jobId,
                    scheduledAt: conflictWarning.scheduledAt,
                    scheduledTime: conflictWarning.scheduledTime,
                    assignedTo: conflictWarning.assignedTo,
                  });
                }
                setConflictWarning(null);
              }}
            >
              Schedule Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-blue-600 dark:text-blue-400';
  if (score >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

const SCORE_ICONS: Record<string, any> = {
  availability: CheckCircle2,
  skills: Wrench,
  proximity: Navigation,
  workload: BarChart3,
};

const SCORE_LABELS: Record<string, string> = {
  availability: 'Availability',
  skills: 'Skill Match',
  proximity: 'Proximity',
  workload: 'Workload',
};

function SuggestionPanel({
  jobId,
  jobTitle,
  suggestions,
  isLoading,
  isPending,
  onAssign,
  onAutoAssign,
  onClose,
}: {
  jobId: string;
  jobTitle: string;
  suggestions: any[];
  isLoading: boolean;
  isPending: boolean;
  onAssign: (memberId: string) => void;
  onAutoAssign: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <Card className="w-full max-w-lg mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-4 flex flex-col gap-3 overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold truncate">Smart Assignment</h3>
                <p className="text-xs text-muted-foreground truncate">{jobTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {suggestions.length > 0 && (
                <Button
                  size="sm"
                  onClick={onAutoAssign}
                  disabled={isPending}
                  data-testid="button-auto-assign"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-1" />
                  )}
                  Auto-assign
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analyzing team...</p>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-8">
                <User className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No team members available</p>
              </div>
            ) : (
              <div className="space-y-2 pr-2">
                {suggestions.map((s, idx) => (
                  <div
                    key={s.teamMemberId}
                    className={`rounded-md border p-3 transition-colors ${idx === 0 ? 'border-primary/30 bg-primary/5' : ''}`}
                    data-testid={`suggestion-${s.teamMemberId}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {idx === 0 && (
                          <Badge variant="default" className="text-[10px] flex-shrink-0">Best Match</Badge>
                        )}
                        <span className="text-sm font-medium truncate">{s.name}</span>
                        {s.isOwner && (
                          <Badge variant="secondary" className="text-[10px] flex-shrink-0">Owner</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-lg font-bold ${getScoreColor(s.totalScore)}`}>
                          {s.totalScore}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAssign(s.memberId)}
                          disabled={isPending}
                        >
                          Assign
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {Object.entries(s.scores).map(([key, val]: [string, any]) => {
                        const Icon = SCORE_ICONS[key] || CheckCircle2;
                        return (
                          <div key={key} className="flex items-center gap-1.5">
                            <Icon className={`h-3 w-3 flex-shrink-0 ${getScoreColor(val.score)}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] text-muted-foreground">{SCORE_LABELS[key]}</span>
                                <span className={`text-[10px] font-medium ${getScoreColor(val.score)}`}>{val.score}</span>
                              </div>
                              <div className="h-1 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${getScoreBarColor(val.score)}`}
                                  style={{ width: `${val.score}%` }}
                                />
                              </div>
                              {val.details?.[0] && (
                                <p className="text-[9px] text-muted-foreground/70 truncate mt-0.5">{val.details[0]}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function WeekGridView({
  allMembers, weekDays, clientsMap, draggedJob, dragOverCell, ownerId, weekJobs, unassignedJobs,
  isToday, getJobsForMemberAndDay, getConflictsForMemberAndDay,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd, onViewJob,
}: any) {
  const hasAnyScheduledJobs = weekJobs.length > 0;

  return (
    <Card className="flex-1 overflow-hidden">
      <CardContent className="p-0 h-full">
        <ScrollArea className="h-full">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-8 border-b bg-muted/30 sticky top-0 z-10">
              <div className="p-3 border-r font-medium text-sm text-muted-foreground">Team Member</div>
              {weekDays.map((day: Date, idx: number) => (
                <div key={idx} className={`p-3 text-center border-r last:border-r-0 ${isToday(day) ? 'bg-primary/5' : ''}`}>
                  <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                  <div className={`text-sm font-medium ${isToday(day) ? 'text-primary' : ''}`}>{format(day, 'd')}</div>
                </div>
              ))}
            </div>

            {allMembers.length > 0 && !hasAnyScheduledJobs && (
              <div className="p-6 text-center border-b bg-muted/5">
                {unassignedJobs.length > 0 ? (
                  <>
                    <CalendarDays className="h-10 w-10 mx-auto text-amber-400/60 mb-2" />
                    <p className="text-sm text-muted-foreground font-medium">
                      You have {unassignedJobs.length} unassigned job{unassignedJobs.length !== 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Drag them onto a team member's day to schedule.</p>
                  </>
                ) : (
                  <>
                    <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground font-medium">No jobs yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Create your first job to start scheduling your team.</p>
                  </>
                )}
              </div>
            )}

            {allMembers.map((member: TeamMember) => (
              <div key={member.id} className="grid grid-cols-8 border-b last:border-b-0" data-testid={`team-row-${member.id}`}>
                <div className="p-3 border-r flex items-start gap-2 bg-muted/10">
                  <UserAvatar
                    className="h-8 w-8 flex-shrink-0"
                    fallbackClassName="text-xs"
                    user={{ id: member.memberId, firstName: member.firstName, lastName: member.lastName, email: member.email, photoUrl: member.profileImageUrl }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{getMemberDisplayName(member)}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.roleName}</p>
                  </div>
                </div>

                {weekDays.map((day: Date, dayIdx: number) => {
                  const cellId = `${member.id}-${format(day, 'yyyy-MM-dd')}`;
                  const cellJobs = getJobsForMemberAndDay(member.memberId, day);
                  const conflicts = getConflictsForMemberAndDay(member.memberId, day);
                  const isDragOver = dragOverCell === cellId;
                  const hasConflict = conflicts.length > 0;

                  return (
                    <div
                      key={dayIdx}
                      className={`p-2 border-r last:border-r-0 min-h-[100px] transition-colors group relative
                        ${isToday(day) ? 'bg-primary/5' : ''}
                        ${isDragOver ? 'bg-primary/10 ring-2 ring-primary ring-inset' : ''}
                        ${hasConflict ? 'bg-red-50/50 dark:bg-red-900/10' : ''}
                      `}
                      onDragOver={(e: React.DragEvent) => onDragOver(e, cellId)}
                      onDragLeave={onDragLeave}
                      onDrop={(e: React.DragEvent) => onDrop(e, member.memberId, day)}
                      data-testid={`cell-${cellId}`}
                    >
                      {hasConflict && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="absolute top-1 right-1">
                              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Schedule conflict: overlapping jobs at {conflicts.map((c: { hour: number; count: number }) => `${c.hour}:00`).join(', ')}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <div className="space-y-1 h-full">
                        {cellJobs.map((job: Job) => {
                          const client = clientsMap.get(job.clientId);
                          const statusStyle = getStatusStyle(job.status);
                          return (
                            <Tooltip key={job.id}>
                              <TooltipTrigger asChild>
                                <div
                                  draggable
                                  onDragStart={(e: React.DragEvent) => onDragStart(e, job, member.memberId)}
                                  onDragEnd={onDragEnd}
                                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); onViewJob?.(job.id); }}
                                  className={`p-1.5 rounded-md border-l-2 cursor-grab active:cursor-grabbing hover-elevate transition-all text-left w-full ${statusStyle.bg} ${statusStyle.border} ${draggedJob?.job.id === job.id ? 'opacity-50' : ''}`}
                                  data-testid={`scheduled-job-${job.id}`}
                                >
                                  <p className={`text-[11px] font-medium truncate ${statusStyle.text}`}>{job.title}</p>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <Clock className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                                    <span className="text-[10px] text-muted-foreground">{job.scheduledTime || '9:00'} · {formatDuration(job.estimatedDuration)}</span>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <div className="space-y-1">
                                  <p className="font-medium">{job.title}</p>
                                  <p className="text-xs text-muted-foreground">{client?.name || 'Unknown client'}</p>
                                  {job.address && (
                                    <div className="flex items-center gap-1 text-xs">
                                      <MapPin className="h-3 w-3" />
                                      <span className="truncate">{job.address}</span>
                                    </div>
                                  )}
                                  <Badge variant="secondary" className="text-[10px]">{job.status}</Badge>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                        {cellJobs.length === 0 && isDragOver && (
                          <div className="h-12 border-2 border-dashed border-primary/40 rounded-md flex items-center justify-center">
                            <span className="text-xs text-primary/60">Drop here</span>
                          </div>
                        )}
                        {cellJobs.length === 0 && !isDragOver && (
                          <div className="h-full min-h-[80px] border border-dashed border-transparent group-hover:border-muted-foreground/20 rounded-md flex items-center justify-center transition-colors">
                            <Plus className="h-4 w-4 text-muted-foreground/0 group-hover:text-muted-foreground/25 transition-colors" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {allMembers.length === 0 && (
              <div className="p-8 text-center">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No team members found. Add team members to start scheduling.</p>
              </div>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function parseDropCellHour(cellId: string | null, memberPrefix: string): number | null {
  if (!cellId || !cellId.startsWith(memberPrefix)) return null;
  const parts = cellId.split('-');
  const hourStr = parts[parts.length - 1];
  const hour = parseInt(hourStr);
  return isNaN(hour) ? null : hour;
}

function TimelineView({
  allMembers, weekDays, selectedDay, setSelectedDay, clientsMap, draggedJob, dragOverCell,
  ownerId, weekJobs, isToday, getJobsForMemberAndDay, getConflictsForMemberAndDay,
  onDragStart, onDragOver, onDragLeave, onDropOnHour, onDragEnd, onViewJob,
}: any) {
  return (
    <Card className="flex-1 overflow-hidden">
      <CardContent className="p-0 h-full flex flex-col">
        <div className="flex border-b bg-muted/30 p-1 gap-1 overflow-x-auto">
          {weekDays.map((day: Date, idx: number) => {
            const isSelected = isSameDay(day, selectedDay);
            const dayJobCount = allMembers.reduce((acc: number, m: TeamMember) => 
              acc + getJobsForMemberAndDay(m.memberId, day).length, 0
            );
            return (
              <Button
                key={idx}
                variant={isSelected ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedDay(day)}
                className="flex-shrink-0 min-w-[80px]"
              >
                <div className="text-center">
                  <div className="text-xs">{format(day, 'EEE')}</div>
                  <div className={`text-sm font-bold ${isToday(day) && !isSelected ? 'text-primary' : ''}`}>{format(day, 'd')}</div>
                  {dayJobCount > 0 && (
                    <Badge variant="secondary" className="text-[9px] mt-0.5 no-default-hover-elevate no-default-active-elevate">{dayJobCount}</Badge>
                  )}
                </div>
              </Button>
            );
          })}
        </div>

        <ScrollArea className="flex-1">
          <div className="flex min-w-[600px]">
            <div className="w-16 flex-shrink-0 border-r bg-muted/10">
              <div className="h-10 border-b" />
              {WORK_HOURS.map(hour => (
                <div key={hour} className="border-b flex items-start justify-end pr-2 pt-1" style={{ height: HOUR_HEIGHT }}>
                  <span className="text-[10px] text-muted-foreground">{hour.toString().padStart(2, '0')}:00</span>
                </div>
              ))}
            </div>

            <div className="flex-1 flex">
              {allMembers.map((member: TeamMember, mIdx: number) => {
                const dayJobs = getJobsForMemberAndDay(member.memberId, selectedDay);
                const conflicts = getConflictsForMemberAndDay(member.memberId, selectedDay);
                const conflictHours = new Set(conflicts.map((c: any) => c.hour));

                return (
                  <div key={member.id} className={`flex-1 min-w-[140px] ${mIdx < allMembers.length - 1 ? 'border-r' : ''}`}>
                    <div className="h-10 border-b flex items-center justify-center gap-1 px-1 bg-muted/10">
                      <UserAvatar
                        className="h-5 w-5 flex-shrink-0"
                        fallbackClassName="text-[8px]"
                        user={{ id: member.memberId, firstName: member.firstName, lastName: member.lastName, email: member.email, photoUrl: member.profileImageUrl }}
                      />
                      <span className="text-xs font-medium truncate">{getMemberDisplayName(member)}</span>
                    </div>

                    <div className="relative">
                      {(() => {
                        const dropHour = parseDropCellHour(dragOverCell, `timeline-${member.memberId}-`);
                        const dragDuration = draggedJob?.job.estimatedDuration || 60;
                        const dragSlots = Math.max(1, Math.ceil(dragDuration / 60));
                        return (
                          <>
                          {WORK_HOURS.map(hour => {
                            const cellId = `timeline-${member.memberId}-${hour}`;
                            const isInDropRange = dropHour !== null && hour >= dropHour && hour < dropHour + dragSlots;
                            const hasConflict = conflictHours.has(hour);

                            return (
                              <div
                                key={hour}
                                className={`border-b transition-colors
                                  ${isInDropRange ? 'bg-primary/10' : ''}
                                  ${hasConflict ? 'bg-red-50/60 dark:bg-red-900/15' : ''}
                                `}
                                style={{ height: HOUR_HEIGHT }}
                                onDragOver={(e: React.DragEvent) => onDragOver(e, cellId)}
                                onDragLeave={onDragLeave}
                                onDrop={(e: React.DragEvent) => onDropOnHour(e, member.memberId, selectedDay, hour)}
                              />
                            );
                          })}

                          {dropHour !== null && (
                            <div
                              className="absolute left-0 right-0 mx-0.5 border-2 border-dashed border-primary/40 rounded-md flex items-center justify-center pointer-events-none"
                              style={{
                                top: (dropHour - WORK_HOURS[0]) * HOUR_HEIGHT + 1,
                                height: Math.min(dragSlots * HOUR_HEIGHT - 2, (WORK_HOURS.length * HOUR_HEIGHT) - ((dropHour - WORK_HOURS[0]) * HOUR_HEIGHT) - 2),
                                zIndex: 5,
                                backgroundColor: 'hsl(var(--primary) / 0.08)',
                              }}
                            >
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] text-primary/60">{hourToTimeStr(dropHour)}</span>
                                <span className="text-[9px] text-primary/50">{Math.round(dragDuration / 60)}h</span>
                              </div>
                            </div>
                          )}
                          </>
                        );
                      })()}

                      {dayJobs.map((job: Job) => {
                        const startHour = parseTimeToHour(job.scheduledTime);
                        const durationHours = Math.max(1, Math.ceil((job.estimatedDuration || 60) / 60));
                        const topOffset = (startHour - 6) * HOUR_HEIGHT;
                        const blockHeight = durationHours * HOUR_HEIGHT - 4;
                        const client = clientsMap.get(job.clientId);
                        const statusStyle = getStatusStyle(job.status);

                        if (startHour < 6 || startHour >= 18) return null;

                        return (
                          <Tooltip key={job.id}>
                            <TooltipTrigger asChild>
                              <div
                                draggable
                                onDragStart={(e: React.DragEvent) => onDragStart(e, job, member.memberId)}
                                onDragEnd={onDragEnd}
                                onClick={() => onViewJob?.(job.id)}
                                className={`absolute left-1 right-1 rounded-md border-l-4 p-1.5 cursor-grab active:cursor-grabbing hover-elevate overflow-hidden z-[5]
                                  ${statusStyle.bg} ${statusStyle.border}
                                  ${draggedJob?.job.id === job.id ? 'opacity-50' : ''}
                                `}
                                style={{ top: topOffset + 2, height: Math.max(blockHeight, 28) }}
                              >
                                <p className={`text-[11px] font-medium truncate ${statusStyle.text}`}>{job.title}</p>
                                {blockHeight > 36 && (
                                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{client?.name || 'Unknown'}</p>
                                )}
                                {blockHeight > 52 && job.address && (
                                  <div className="flex items-center gap-0.5 mt-0.5">
                                    <MapPin className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                                    <span className="text-[9px] text-muted-foreground truncate">{job.address}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-0.5 mt-0.5">
                                  <Clock className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                                  <span className="text-[10px] text-muted-foreground">
                                    {job.scheduledTime || '09:00'} · {formatDuration(job.estimatedDuration)}
                                  </span>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <div className="space-y-1">
                                <p className="font-medium">{job.title}</p>
                                <p className="text-xs text-muted-foreground">{client?.name || 'Unknown client'}</p>
                                {job.address && (
                                  <div className="flex items-center gap-1 text-xs">
                                    <MapPin className="h-3 w-3" />
                                    <span>{job.address}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1 text-xs">
                                  <Clock className="h-3 w-3" />
                                  <span>{job.scheduledTime || '09:00'} - {formatDuration(job.estimatedDuration)}</span>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {allMembers.length === 0 && (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center">
                    <User className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">No team members</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
