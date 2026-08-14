import JobPicker from "@/components/JobPicker";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useOfflineTimeTracking } from "@/hooks/useOfflineTimeTracking";
import { 
  Play, 
  Pause, 
  Square, 
  Clock, 
  Calendar,
  DollarSign,
  Users,
  AlertCircle,
  ExternalLink,
  Briefcase,
  MapPin,
  CheckCircle2,
  Timer,
  Coffee,
  WifiOff,
  RefreshCw,
  CircleDollarSign,
  Car,
  Clipboard,
  GraduationCap,
  Plus,
  Download
} from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";

// Time entry categories for billable/non-billable tracking
const TIME_CATEGORY_LABELS: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  work:      { label: 'Site Work',       icon: Briefcase,    color: '#2563EB' },
  travel:    { label: 'Driving / Travel', icon: Car,         color: '#7C3AED' },
  materials: { label: 'Supplies Run',    icon: Clipboard,    color: '#D97706' },
  admin:     { label: 'Admin / Office',  icon: Clipboard,    color: '#0891B2' },
  training:  { label: 'Training',        icon: GraduationCap, color: '#DB2777' },
  meeting:   { label: 'Meeting',         icon: Users,        color: '#059669' },
  other:     { label: 'Other',           icon: Clock,        color: '#6B7280' },
};

const TIME_CATEGORY_OPTIONS = [
  { value: 'work',      label: '🔨 Site Work' },
  { value: 'travel',    label: '🚗 Driving / Travel' },
  { value: 'materials', label: '🛒 Supplies Run' },
  { value: 'admin',     label: '🖥️ Admin / Office' },
  { value: 'meeting',   label: '📋 Meeting' },
  { value: 'training',  label: '🎓 Training' },
  { value: 'other',     label: '⚙️ Other' },
];

// Types for time tracking
interface TimeEntry {
  id: string;
  description: string;
  startTime: string;
  endTime?: string;
  jobId?: string;
  hourlyRate?: number;
  breakTime?: number;
  isBreak?: boolean;
  isBillable?: boolean;
  timeCategory?: string;
  distanceKm?: string | number | null;
  userId: string;
  jobTitle?: string;
  clientName?: string;
  userName?: string;
}

interface ActiveTimer {
  id: string;
  description: string;
  startTime: string;
  jobId?: string;
  elapsedSeconds: number;
}

// Timer Widget Component - Enhanced with brand colors, animations, GPS status
export function TimerWidget({ 
  jobId, 
  jobTitle, 
  onTimerStart, 
  onTimerStop,
  compact = false
}: {
  jobId?: string;
  jobTitle?: string;
  onTimerStart?: () => void;
  onTimerStop?: () => void;
  compact?: boolean;
}) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [locationStatus, setLocationStatus] = useState<'checking' | 'captured' | 'unavailable' | 'idle'>('idle');
  const { toast } = useToast();

  const offlineTimeTracking = useOfflineTimeTracking({
    jobId: jobId ? (typeof jobId === 'string' ? parseInt(jobId, 10) : jobId) : undefined,
  });
  
  const { 
    entries: offlineEntries,
    activeTimer: offlineActiveTimer,
    isOffline,
    isSyncing,
    pendingSyncs,
    startTimer: offlineStartTimer,
    stopTimer: offlineStopTimer,
    pauseTimer: offlinePauseTimer,
    resumeTimer: offlineResumeTimer,
    sync: triggerSync,
  } = offlineTimeTracking;

  // Get active timer from server (fallback when online)
  const { data: globalActiveTimer, isLoading } = useQuery({
    queryKey: ['/api/time-entries/active/current'],
    refetchInterval: isOffline ? false : 1000,
    enabled: !isOffline,
  });

  // Get ALL time entries for this job (not just today's) to show total time
  const { data: allTimeEntries = [] } = useQuery<TimeEntry[]>({
    queryKey: ['/api/time-entries', jobId],
    enabled: !!jobId && !isOffline,
  });
  
  const effectiveEntries = isOffline ? offlineEntries : allTimeEntries;

  // Filter to get today's entries for this job
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaysJobEntries = jobId ? (effectiveEntries as any[])
    .filter((entry: any) => {
      if (String(entry.jobId) !== String(jobId)) return false;
      const entryDate = new Date(entry.startTime);
      return entryDate >= todayStart && entry.endTime;
    })
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
  : [];

  // Calculate TOTAL work time for this job (all time, excluding breaks)
  const totalWorkMinutesAllTime = jobId ? (effectiveEntries as any[])
    .filter((entry: any) => String(entry.jobId) === String(jobId) && entry.endTime && !entry.isBreak)
    .reduce((total: number, entry: any) => {
      const start = new Date(entry.startTime).getTime();
      const end = new Date(entry.endTime!).getTime();
      return total + Math.floor((end - start) / 60000);
    }, 0)
  : 0;

  // Calculate TOTAL break time for this job (all time)
  const totalBreakMinutesAllTime = jobId ? (effectiveEntries as any[])
    .filter((entry: any) => String(entry.jobId) === String(jobId) && entry.endTime && entry.isBreak)
    .reduce((total: number, entry: any) => {
      const start = new Date(entry.startTime).getTime();
      const end = new Date(entry.endTime!).getTime();
      return total + Math.floor((end - start) / 60000);
    }, 0)
  : 0;

  // Calculate work time today for this job (excluding breaks)
  const workMinutesToday = todaysJobEntries
    .filter((entry: TimeEntry) => !entry.isBreak)
    .reduce((total: number, entry: TimeEntry) => {
      if (entry.endTime) {
        const start = new Date(entry.startTime).getTime();
        const end = new Date(entry.endTime).getTime();
        return total + Math.floor((end - start) / 60000);
      }
      return total;
    }, 0);

  // Calculate break time today for this job
  const breakMinutesToday = todaysJobEntries
    .filter((entry: TimeEntry) => entry.isBreak)
    .reduce((total: number, entry: TimeEntry) => {
      if (entry.endTime) {
        const start = new Date(entry.startTime).getTime();
        const end = new Date(entry.endTime).getTime();
        return total + Math.floor((end - start) / 60000);
      }
      return total;
    }, 0);

  // Legacy: total minutes today (for backwards compatibility)
  const totalMinutesToday = workMinutesToday + breakMinutesToday;

  const latestCompletedEntry = todaysJobEntries[0];

  // Use offline timer when offline, server timer when online
  const effectiveActiveTimer = isOffline 
    ? offlineActiveTimer 
    : (offlineActiveTimer || globalActiveTimer);
    
  const activeTimer = jobId 
    ? (effectiveActiveTimer && String((effectiveActiveTimer as any).jobId) === String(jobId) ? effectiveActiveTimer : null)
    : effectiveActiveTimer;
  
  // Check if active timer is a break
  const isOnBreak = activeTimer && typeof activeTimer === 'object' && (activeTimer as any).isBreak === true;
  
  // Offline status indicator component
  const OfflineIndicator = () => {
    if (!isOffline && pendingSyncs === 0) return null;
    
    return (
      <div className="flex items-center justify-center gap-2 text-xs py-1 px-2 rounded-md bg-muted/50">
        {isOffline && (
          <>
            <WifiOff className="h-3 w-3 text-amber-500" />
            <span className="text-amber-600 dark:text-amber-400">Offline mode</span>
          </>
        )}
        {pendingSyncs > 0 && (
          <Badge variant="outline" className="text-xs h-5">
            {isSyncing ? (
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            ) : null}
            {pendingSyncs} pending
          </Badge>
        )}
        {!isOffline && pendingSyncs > 0 && !isSyncing && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-5 text-xs px-2"
            onClick={() => triggerSync()}
          >
            Sync now
          </Button>
        )}
      </div>
    );
  };

  const captureLocation = () => {
    setLocationStatus('checking');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => setLocationStatus('captured'),
        (error) => {
          setLocationStatus('unavailable');
          if (error.code === 1) {
            toast({
              title: "Location access denied",
              description: "Enable location in your browser settings to record your work location. Time tracking will continue without it.",
            });
          }
        },
        { timeout: 5000, enableHighAccuracy: true }
      );
    } else {
      setLocationStatus('unavailable');
    }
  };

  // Start timer mutation
  const startTimerMutation = useMutation({
    mutationFn: async (data: { description: string; jobId?: string; hourlyRate?: string; isBreak?: boolean }) => {
      return apiRequest('POST', '/api/time-entries', data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
        if (jobId) {
          queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
        }
      }, 300);
      captureLocation();
      onTimerStart?.();
      toast({
        title: variables.isBreak ? "Break Started" : "Timer Started",
        description: variables.isBreak ? "Taking a break. Resume when you're ready." : "Time tracking has begun for this task.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Timer Error",
        description: error?.message || "Failed to start timer",
        variant: "destructive",
      });
    },
  });

  // Stop timer mutation
  const stopTimerMutation = useMutation({
    mutationFn: async (timerId: string) => {
      return apiRequest('POST', `/api/time-entries/${timerId}/stop`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      setLocationStatus('idle');
      onTimerStop?.();
      toast({
        title: "Time Saved",
        description: "Your time has been recorded successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Timer Error",
        description: error?.message || "Failed to stop timer",
        variant: "destructive",
      });
    },
  });

  // Delete time entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      return apiRequest('DELETE', `/api/time-entries/${entryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      toast({
        title: "Entry Deleted",
        description: "Time entry removed. You can start a new timer.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Error",
        description: error?.message || "Failed to delete entry",
        variant: "destructive",
      });
    },
  });

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-save heartbeat every 30 seconds while timer is running
  // This ensures time is tracked even if the user forgets to stop
  useEffect(() => {
    if (!activeTimer || typeof activeTimer !== 'object' || !('id' in activeTimer)) {
      return;
    }

    const timerId = (activeTimer as any).id;
    
    // Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(async () => {
      try {
        await fetch(`/api/time-entries/${timerId}/heartbeat`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        // Silently fail - heartbeat is non-critical
        console.debug('Heartbeat failed:', error);
      }
    }, 30000); // 30 seconds

    // Also send an initial heartbeat when timer starts
    fetch(`/api/time-entries/${timerId}/heartbeat`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});

    return () => clearInterval(heartbeatInterval);
  }, [activeTimer]);

  // If timer is active but location wasn't captured, try now
  useEffect(() => {
    if (activeTimer && locationStatus === 'idle') {
      captureLocation();
    }
  }, [activeTimer]);

  const getElapsedTime = (startTime: string) => {
    const start = new Date(startTime);
    const now = currentTime;
    const diffMs = now.getTime() - start.getTime();
    const totalSeconds = Math.floor(diffMs / 1000);
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const handleStartTimer = async () => {
    const effectiveTimer = isOffline ? offlineActiveTimer : (offlineActiveTimer || globalActiveTimer);
    
    if (effectiveTimer) {
      if (jobId && String((effectiveTimer as any).jobId) !== String(jobId)) {
        toast({
          title: "Timer Already Running",
          description: `Stop the current timer for "${(effectiveTimer as any).description || 'another job'}" before starting a new one.`,
          variant: "destructive",
        });
        return;
      }
      if (!jobId || String((effectiveTimer as any).jobId) === String(jobId)) {
        toast({
          title: "Timer Already Running", 
          description: "A timer is already active. Stop it before starting a new one.",
          variant: "destructive",
        });
        return;
      }
    }

    const description = jobTitle ? `Working on ${jobTitle}` : 'General work';
    
    try {
      await offlineStartTimer({
        description,
        hourlyRate: 85.00,
        isBreak: false,
      });
      captureLocation();
      onTimerStart?.();
      
      if (!isOffline) {
        queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
        queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
        queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      }
      
      toast({
        title: "Timer Started",
        description: isOffline ? "Timer started (offline mode)." : "Time tracking has begun for this task.",
      });
    } catch (error: any) {
      toast({
        title: "Timer Error",
        description: error?.message || "Failed to start timer",
        variant: "destructive",
      });
    }
  };

  const handleStopTimer = async () => {
    if (activeTimer && typeof activeTimer === 'object' && 'id' in activeTimer && activeTimer.id) {
      try {
        await offlineStopTimer(activeTimer.id as string);
        setLocationStatus('idle');
        onTimerStop?.();
        
        if (!isOffline) {
          queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
          queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
          queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
        }
        
        toast({
          title: "Time Saved",
          description: isOffline ? "Time recorded (will sync when online)." : "Your time has been recorded successfully.",
        });
      } catch (error: any) {
        toast({
          title: "Timer Error",
          description: error?.message || "Failed to stop timer",
          variant: "destructive",
        });
      }
    }
  };

  // Handle taking a break - stop current work timer and start break timer
  const handleTakeBreak = async () => {
    if (!activeTimer || typeof activeTimer !== 'object' || !('id' in activeTimer)) return;
    
    try {
      if (isOffline) {
        await offlinePauseTimer();
      } else {
        await apiRequest('POST', `/api/time-entries/${(activeTimer as any).id}/stop`);
        
        await apiRequest('POST', '/api/time-entries', {
          description: `Break - ${jobTitle || 'Work session'}`,
          jobId: jobId,
          isBreak: true,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      
      toast({
        title: "Break Started",
        description: isOffline ? "Taking a break (offline mode)." : "Taking a break. Resume when you're ready.",
      });
    } catch (error: any) {
      toast({
        title: "Break Error",
        description: error?.message || "Failed to start break",
        variant: "destructive",
      });
    }
  };

  // Handle resuming work - stop break timer and start work timer
  const handleResumeWork = async () => {
    if (!activeTimer || typeof activeTimer !== 'object' || !('id' in activeTimer)) return;
    
    try {
      if (isOffline) {
        const description = jobTitle ? `Working on ${jobTitle}` : 'General work';
        await offlineResumeTimer({ description, hourlyRate: 85.00 });
      } else {
        await apiRequest('POST', `/api/time-entries/${(activeTimer as any).id}/stop`);
        
        const description = jobTitle ? `Working on ${jobTitle}` : 'General work';
        await apiRequest('POST', '/api/time-entries', {
          description,
          jobId: jobId,
          hourlyRate: '85.00',
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      
      toast({
        title: "Work Resumed",
        description: isOffline ? "Timer resumed (offline mode)." : "Timer resumed. Keep up the good work!",
      });
    } catch (error: any) {
      toast({
        title: "Resume Error",
        description: error?.message || "Failed to resume work",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEntry = (entryId: string) => {
    if (window.confirm('Delete this time entry? You can then start a new timer.')) {
      deleteEntryMutation.mutate(entryId);
    }
  };

  // GPS Location status indicator
  const LocationIndicator = () => {
    if (locationStatus === 'idle') return null;
    return (
      <div className="flex items-center justify-center gap-1 text-xs mt-2" data-testid="location-status">
        {locationStatus === 'checking' && (
          <>
            <MapPin className="h-3 w-3 text-muted-foreground animate-pulse" />
            <span className="text-muted-foreground">Capturing location...</span>
          </>
        )}
        {locationStatus === 'captured' && (
          <>
            <MapPin className="h-3 w-3 text-green-600 dark:text-green-400" />
            <span className="text-green-600 dark:text-green-400">Location captured</span>
          </>
        )}
        {locationStatus === 'unavailable' && (
          <>
            <MapPin className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Location unavailable</span>
          </>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4" data-testid="timer-loading-state">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // ACTIVE TIMER STATE - Enhanced with pulsing animation and brand colors
  if (activeTimer && typeof activeTimer === 'object' && 'startTime' in activeTimer) {
    // Determine colors based on break status
    const timerColor = isOnBreak ? '35 90% 55%' : 'var(--trade)'; // amber for break, trade color for work
    const timerLabel = isOnBreak ? 'On Break' : 'Timer Running';
    
    return (
      <div 
        className="relative rounded-xl overflow-hidden" 
        style={{ backgroundColor: isOnBreak ? 'hsl(35 90% 55% / 0.1)' : 'hsl(var(--trade) / 0.1)' }}
        data-testid={isOnBreak ? "timer-break-state" : "timer-running-state"}
      >
        {/* Pulsing border animation */}
        <div 
          className="absolute inset-0 rounded-xl animate-pulse"
          style={{ 
            border: isOnBreak ? '2px solid hsl(35 90% 55% / 0.5)' : '2px solid hsl(var(--trade) / 0.5)',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }}
        />
        
        <div className="relative p-4 px-5 space-y-3">
          {/* Live timer display */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              {isOnBreak ? (
                <Coffee className="h-4 w-4 text-amber-500 animate-pulse" />
              ) : (
                <div 
                  className="w-3 h-3 rounded-full animate-pulse" 
                  style={{ backgroundColor: 'hsl(var(--trade))' }}
                />
              )}
              <span 
                className="text-xs font-medium uppercase tracking-wide" 
                style={{ color: isOnBreak ? 'hsl(35 90% 55%)' : 'hsl(var(--trade))' }}
              >
                {timerLabel}
              </span>
            </div>
            <div 
              className="text-4xl font-mono font-bold tracking-wider" 
              style={{ color: isOnBreak ? 'hsl(35 90% 55%)' : 'hsl(var(--trade))' }}
              data-testid="text-elapsed-time"
            >
              {getElapsedTime(activeTimer.startTime as string)}
            </div>
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-timer-description">
              {(activeTimer as any).description || (isOnBreak ? 'Taking a break...' : 'Working...')}
            </p>
            <LocationIndicator />
            <OfflineIndicator />
          </div>

          {/* Work and break time totals */}
          {(totalWorkMinutesAllTime > 0 || totalBreakMinutesAllTime > 0) && (
            <div className="flex items-center justify-center gap-4 text-xs border-t border-border/50 pt-2">
              {totalWorkMinutesAllTime > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Work: {formatDuration(totalWorkMinutesAllTime)}</span>
                </div>
              )}
              {totalBreakMinutesAllTime > 0 && (
                <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Coffee className="h-3 w-3" />
                  <span>Break: {formatDuration(totalBreakMinutesAllTime)}</span>
                </div>
              )}
            </div>
          )}
          
          {/* Action buttons */}
          <div className="space-y-2">
            {isOnBreak ? (
              <>
                {/* Resume Work button when on break */}
                <Button 
                  className="w-full h-12 text-base font-semibold text-white" 
                  style={{ backgroundColor: 'hsl(var(--trade))' }}
                  onClick={handleResumeWork}
                  disabled={startTimerMutation.isPending}
                  data-testid="button-resume-work"
                >
                  <Play className="h-5 w-5 mr-2" />
                  {startTimerMutation.isPending ? 'Resuming...' : 'Resume Work'}
                </Button>
                {/* End break button */}
                <Button 
                  variant="outline" 
                  className="w-full h-10 text-sm" 
                  onClick={handleStopTimer}
                  disabled={stopTimerMutation.isPending}
                  data-testid="button-end-break"
                >
                  <Square className="h-4 w-4 mr-2" />
                  {stopTimerMutation.isPending ? 'Saving...' : 'End Break & Clock Out'}
                </Button>
              </>
            ) : (
              <>
                {/* Take Break button when working */}
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-12 text-base font-semibold" 
                    onClick={handleTakeBreak}
                    disabled={startTimerMutation.isPending}
                    data-testid="button-take-break"
                  >
                    <Coffee className="h-5 w-5 mr-2" />
                    {startTimerMutation.isPending ? 'Starting...' : 'Take Break'}
                  </Button>
                  <Button 
                    variant="destructive" 
                    className="flex-1 h-12 text-base font-semibold" 
                    onClick={handleStopTimer}
                    disabled={stopTimerMutation.isPending}
                    data-testid="button-stop-timer"
                  >
                    <Square className="h-5 w-5 mr-2" />
                    {stopTimerMutation.isPending ? 'Saving...' : 'Clock Out'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // SAVED TIME STATE - Show today's entries and allow adding more
  if (jobId && todaysJobEntries.length > 0) {
    return (
      <div className="space-y-3" data-testid="timer-saved-state">
        {/* Today's summary - Work and Break displayed separately */}
        <div 
          className="rounded-xl p-4"
          style={{ backgroundColor: 'hsl(var(--trade) / 0.08)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'hsl(var(--trade) / 0.15)' }}
              >
                <Timer className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              </div>
              <div>
                <div className="text-lg font-bold" data-testid="text-work-time-today">
                  {formatDuration(workMinutesToday)}
                </div>
                <p className="text-xs text-muted-foreground">Work Today</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Break time today */}
              {breakMinutesToday > 0 && (
                <div className="text-right">
                  <div className="flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                    <Coffee className="h-3 w-3" />
                    {formatDuration(breakMinutesToday)}
                  </div>
                  <p className="text-xs text-muted-foreground">Break</p>
                </div>
              )}
              {/* Total all time (if different from today) */}
              {totalWorkMinutesAllTime !== workMinutesToday && (
                <div className="text-right">
                  <div className="text-sm font-medium text-muted-foreground">
                    {formatDuration(totalWorkMinutesAllTime)}
                  </div>
                  <p className="text-xs text-muted-foreground">Total Work</p>
                </div>
              )}
            </div>
          </div>

          {/* Today's entries quick view */}
          <div className="border-t border-border/50 pt-2 mt-2">
            <p className="text-xs text-muted-foreground mb-1">Today's entries:</p>
            <div className="space-y-1">
              {todaysJobEntries.slice(0, 3).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {entry.isBreak ? (
                      <Coffee className="h-3 w-3 text-amber-500" />
                    ) : entry.isBillable !== false ? (
                      <span title="Billable"><CircleDollarSign className="h-3 w-3 text-green-500" /></span>
                    ) : (
                      <span title="Non-billable"><Clock className="h-3 w-3 text-muted-foreground" /></span>
                    )}
                    <span className={entry.isBreak ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                      {format(new Date(entry.startTime), 'h:mm a')} - {entry.endTime ? format(new Date(entry.endTime), 'h:mm a') : 'Now'}
                    </span>
                    {!entry.isBreak && entry.timeCategory && entry.timeCategory !== 'work' && TIME_CATEGORY_LABELS[entry.timeCategory] && (
                      <Badge variant="outline" className="h-4 text-[10px] px-1">
                        {TIME_CATEGORY_LABELS[entry.timeCategory].label}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${entry.isBreak ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                      {formatDuration(Math.floor((new Date(entry.endTime!).getTime() - new Date(entry.startTime).getTime()) / 60000))}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => handleDeleteEntry(entry.id)}
                      disabled={deleteEntryMutation.isPending}
                      data-testid={`button-delete-entry-${entry.id}`}
                    >
                      <AlertCircle className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {todaysJobEntries.length > 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{todaysJobEntries.length - 3} more entries
                </p>
              )}
            </div>
          </div>
        </div>
        
        {/* Add more time button */}
        <OfflineIndicator />
        <Button 
          className="w-full h-12 text-base font-semibold text-white" 
          style={{ backgroundColor: 'hsl(var(--trade))' }}
          onClick={handleStartTimer}
          disabled={!!effectiveActiveTimer}
          data-testid="button-start-timer"
        >
          <Play className="h-5 w-5 mr-2" />
          Clock In Again
        </Button>
        
        {!!effectiveActiveTimer && String((effectiveActiveTimer as any).jobId) !== String(jobId) && (
          <p className="text-xs text-center text-amber-600">
            Timer running on another job
          </p>
        )}
      </div>
    );
  }

  // READY TO START STATE
  return (
    <div className="space-y-3" data-testid="timer-ready-state">
      {/* Total time on job (if any previous entries exist) - shows work and break separately */}
      {(totalWorkMinutesAllTime > 0 || totalBreakMinutesAllTime > 0) && (
        <div 
          className="rounded-xl p-3 flex items-center justify-between"
          style={{ backgroundColor: 'hsl(var(--trade) / 0.08)' }}
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
            <span className="text-sm font-medium">Total work:</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold">{formatDuration(totalWorkMinutesAllTime)}</span>
            {totalBreakMinutesAllTime > 0 && (
              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-sm">
                <Coffee className="h-3 w-3" />
                <span>{formatDuration(totalBreakMinutesAllTime)}</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="text-center py-2">
        <div className="text-3xl font-mono text-muted-foreground mb-1">
          00:00:00
        </div>
        <p className="text-sm text-muted-foreground">
          Ready to track time
        </p>
        <OfflineIndicator />
      </div>
      
      <Button 
        className="w-full h-12 text-base font-semibold text-white" 
        style={{ backgroundColor: 'hsl(var(--trade))' }}
        onClick={handleStartTimer}
        disabled={!!effectiveActiveTimer}
        data-testid="button-start-timer"
      >
        <Play className="h-5 w-5 mr-2" />
        Clock In
      </Button>
      
      {!!effectiveActiveTimer && String((effectiveActiveTimer as any).jobId) !== String(jobId) && (
        <p className="text-xs text-center text-amber-600">
          Timer running on another job
        </p>
      )}
    </div>
  );
}

// Timesheet List Component
export function TimesheetList({ 
  showJobInfo = true,
  limit = 10 
}: {
  showJobInfo?: boolean;
  limit?: number;
}) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Get time entries
  const { data: timeEntries, isLoading, error } = useQuery({
    queryKey: ['/api/time-entries'],
  });

  // Manual "Add Entry" dialog state
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryJobId, setEntryJobId] = useState<string>("");
  const [entryDate, setEntryDate] = useState<string>(todayStr);
  const [entryStart, setEntryStart] = useState<string>("09:00");
  const [entryEnd, setEntryEnd] = useState<string>("17:00");
  const [entryDescription, setEntryDescription] = useState<string>("");
  const [entryBillable, setEntryBillable] = useState<boolean>(true);
  const [entryCategory, setEntryCategory] = useState<string>("work");
  const [entryDistanceKm, setEntryDistanceKm] = useState<string>("");

  // Category filter state — persisted to localStorage so returning to the page
  // restores the last-used selection.
  const CATEGORY_FILTER_KEY = 'timesheet-category-filters';
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(CATEGORY_FILTER_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed as string[];
      }
    } catch {
      // Ignore parse errors and fall back to empty selection
    }
    return [];
  });

  // Sync filter selection to localStorage whenever it changes
  useEffect(() => {
    try {
      if (selectedCategories.length === 0) {
        localStorage.removeItem(CATEGORY_FILTER_KEY);
      } else {
        localStorage.setItem(CATEGORY_FILTER_KEY, JSON.stringify(selectedCategories));
      }
    } catch {
      // localStorage may be unavailable (private browsing, quota exceeded)
    }
  }, [selectedCategories]);

  const toggleCategory = (value: string) => {
    setSelectedCategories(prev =>
      prev.includes(value) ? prev.filter(c => c !== value) : [...prev, value]
    );
  };

  // Jobs for the entry's job selector (only loaded while the dialog is open)
  const { data: jobsForEntry = [] } = useQuery<any[]>({
    queryKey: ['/api/jobs'],
    enabled: showAddEntry,
  });

  const resetEntryForm = () => {
    setEntryJobId("");
    setEntryDate(todayStr);
    setEntryStart("09:00");
    setEntryEnd("17:00");
    setEntryDescription("");
    setEntryBillable(true);
    setEntryCategory("work");
    setEntryDistanceKm("");
  };

  // Create a manual (completed) time entry
  const addEntryMutation = useMutation({
    mutationFn: async () => {
      const start = new Date(`${entryDate}T${entryStart}`);
      const end = new Date(`${entryDate}T${entryEnd}`);
      const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60000);
      const distanceKmVal = entryCategory === 'travel' && entryDistanceKm.trim() ? entryDistanceKm.trim() : undefined;
      return apiRequest('POST', '/api/time-entries', {
        jobId: entryJobId || undefined,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        duration: durationMinutes,
        description: entryDescription || undefined,
        isBillable: entryBillable,
        timeCategory: entryCategory,
        distanceKm: distanceKmVal,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      setShowAddEntry(false);
      resetEntryForm();
      toast({
        title: "Entry Added",
        description: "Your time entry has been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't Add Entry",
        description: error?.message || "Failed to add time entry",
        variant: "destructive",
      });
    },
  });

  const handleAddEntry = () => {
    if (!entryJobId) {
      toast({ title: "Select a Job", description: "Please choose a job for this entry.", variant: "destructive" });
      return;
    }
    const start = new Date(`${entryDate}T${entryStart}`);
    const end = new Date(`${entryDate}T${entryEnd}`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      toast({ title: "Invalid Time", description: "Please enter a valid date and time.", variant: "destructive" });
      return;
    }
    if (end.getTime() <= start.getTime()) {
      toast({ title: "Invalid Time", description: "End time must be after start time.", variant: "destructive" });
      return;
    }
    addEntryMutation.mutate();
  };

  // Delete time entry mutation
  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      return apiRequest('DELETE', `/api/time-entries/${entryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-entries/active/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/time-tracking/dashboard'] });
      toast({
        title: "Entry Deleted",
        description: "Time entry has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Error",
        description: error?.message || "Failed to delete entry",
        variant: "destructive",
      });
    },
  });

  const addEntryDialog = (
    <Dialog open={showAddEntry} onOpenChange={(open) => { setShowAddEntry(open); if (!open) resetEntryForm(); }}>
      <DialogContent data-testid="dialog-add-time-entry">
        <DialogHeader>
          <DialogTitle>Add Time Entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="entry-job">Job</Label>
            <JobPicker
              value={entryJobId}
              onChange={setEntryJobId}
              label={null}
              filterJobs={(job) => jobsForEntry.some((j: any) => String(j.id) === String(job.id))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="entry-date">Date</Label>
            <Input
              id="entry-date"
              type="date"
              value={entryDate}
              max={todayStr}
              onChange={(e) => setEntryDate(e.target.value)}
              data-testid="input-entry-date"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="entry-start">Start</Label>
              <Input
                id="entry-start"
                type="time"
                value={entryStart}
                onChange={(e) => setEntryStart(e.target.value)}
                data-testid="input-entry-start"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry-end">End</Label>
              <Input
                id="entry-end"
                type="time"
                value={entryEnd}
                onChange={(e) => setEntryEnd(e.target.value)}
                data-testid="input-entry-end"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="entry-description">Description (optional)</Label>
            <Textarea
              id="entry-description"
              placeholder="What did you work on?"
              value={entryDescription}
              onChange={(e) => setEntryDescription(e.target.value)}
              data-testid="input-entry-description"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="entry-billable">Billable</Label>
            <Switch
              id="entry-billable"
              checked={entryBillable}
              onCheckedChange={setEntryBillable}
              data-testid="switch-entry-billable"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="entry-category">Category</Label>
            <Select value={entryCategory} onValueChange={(v) => { setEntryCategory(v); if (v !== 'travel') setEntryDistanceKm(''); }}>
              <SelectTrigger id="entry-category" data-testid="select-entry-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_CATEGORY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {entryCategory === 'travel' && (
            <div className="space-y-2">
              <Label htmlFor="entry-distance">Distance (km)</Label>
              <Input
                id="entry-distance"
                type="number"
                step="0.1"
                min="0"
                placeholder="0.0"
                value={entryDistanceKm}
                onChange={(e) => setEntryDistanceKm(e.target.value)}
                data-testid="input-entry-distance"
              />
              {!entryDistanceKm.trim() && (
                <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400" data-testid="hint-distance-missing">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Distance not set — travel allowance will be $0
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setShowAddEntry(false); resetEntryForm(); }} data-testid="button-cancel-entry">
            Cancel
          </Button>
          <Button onClick={handleAddEntry} disabled={addEntryMutation.isPending} data-testid="button-save-entry">
            {addEntryMutation.isPending ? "Saving..." : "Save Entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const exportFilteredCSV = () => {
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const categorySlug = selectedCategories
      .map(c => TIME_CATEGORY_LABELS[c]?.label ?? c)
      .map(l => l.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
      .join('-');
    const filename = `timesheet-${categorySlug}-${dateStr}.csv`;

    const header = ['Date', 'Staff', 'Category', 'Duration (h)', 'Job', 'Description'];
    const rows = filteredEntries
      .filter((e: TimeEntry) => e.endTime && !e.isBreak)
      .map((e: TimeEntry) => {
        const durationH = e.endTime
          ? ((new Date(e.endTime).getTime() - new Date(e.startTime).getTime()) / 3600000).toFixed(2)
          : '';
        const category = TIME_CATEGORY_LABELS[e.timeCategory ?? 'work']?.label ?? (e.timeCategory ?? 'work');
        const date = format(new Date(e.startTime), 'yyyy-MM-dd');
        // Neutralise spreadsheet formula injection: prefix an apostrophe when
        // the first character is one of the formula trigger chars = + - @
        const sanitize = (v: string) => {
          const s = v ?? '';
          return /^[=+\-@]/.test(s) ? `'${s}` : s;
        };
        const escape = (v: string) => `"${sanitize(v).replace(/"/g, '""')}"`;
        return [
          escape(date),
          escape(e.userName ?? ''),
          escape(category),
          durationH,
          escape(e.jobTitle ?? ''),
          escape(e.description ?? ''),
        ].join(',');
      });

    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = diffMs / (1000 * 60 * 60);
    return `${hours.toFixed(2)}h`;
  };

  const calculateEarnings = (startTime: string, endTime?: string, hourlyRate?: number) => {
    if (!endTime || !hourlyRate) return null;
    const start = new Date(startTime);
    const end = new Date(endTime);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return hours * hourlyRate;
  };

  if (isLoading) {
    return (
      <Card className="w-full" data-testid="card-timesheet-loading">
        <CardHeader>
          <CardTitle>Recent Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" data-testid="alert-timesheet-error">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load time entries. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  const allEntries: TimeEntry[] = Array.isArray(timeEntries) ? timeEntries : [];
  const filteredEntries = selectedCategories.length === 0
    ? allEntries
    : allEntries.filter((e: any) => selectedCategories.includes(e.timeCategory || 'work'));
  const entriesToShow = filteredEntries.slice(0, limit);

  // Category breakdown for the summary strip (computed from filtered entries)
  const categoryBreakdownStrip = (() => {
    const catMap: Record<string, number> = {};
    filteredEntries.forEach((e: any) => {
      if (e.isBreak || !e.endTime) return;
      const cat = e.timeCategory || 'work';
      const hours = (new Date(e.endTime).getTime() - new Date(e.startTime).getTime()) / 3600000;
      catMap[cat] = (catMap[cat] || 0) + hours;
    });
    return Object.entries(catMap)
      .filter(([, h]) => h > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, hours]) => ({
        cat,
        hours,
        label: TIME_CATEGORY_LABELS[cat]?.label ?? cat,
        color: TIME_CATEGORY_LABELS[cat]?.color ?? '#6B7280',
      }));
  })();

  return (
    <Card className="w-full" data-testid="card-timesheet-list">
      {addEntryDialog}
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Recent Time Entries
        </CardTitle>
        <div className="flex items-center gap-2">
          {selectedCategories.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={exportFilteredCSV}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowAddEntry(true)} data-testid="button-add-entry">
            <Plus className="h-4 w-4 mr-1" />
            Add Entry
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Category filter chips */}
        <div className="flex flex-wrap gap-2 mb-4" data-testid="category-filter-chips">
          {TIME_CATEGORY_OPTIONS.map(opt => {
            const meta = TIME_CATEGORY_LABELS[opt.value];
            const active = selectedCategories.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleCategory(opt.value)}
                data-testid={`chip-category-${opt.value}`}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium border transition-all"
                style={
                  active
                    ? { backgroundColor: meta?.color ?? '#6B7280', color: '#fff', borderColor: meta?.color ?? '#6B7280' }
                    : { backgroundColor: 'transparent', color: meta?.color ?? '#6B7280', borderColor: (meta?.color ?? '#6B7280') + '60' }
                }
              >
                {meta?.label ?? opt.label}
              </button>
            );
          })}
          {selectedCategories.length > 0 && (
            <button
              onClick={() => setSelectedCategories([])}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-dashed text-muted-foreground hover:text-foreground transition-colors"
              data-testid="chip-clear-categories"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category breakdown summary strip */}
        {categoryBreakdownStrip.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-lg bg-muted/40" data-testid="category-breakdown-strip">
            {categoryBreakdownStrip.map(({ cat, label, hours, color }) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ backgroundColor: color + '18', color }}
              >
                {label} <span className="font-bold">{hours.toFixed(1)}h</span>
              </span>
            ))}
          </div>
        )}

        {entriesToShow.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="text-no-entries">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            {selectedCategories.length > 0 ? (
              <>
                <p>No entries match the selected {selectedCategories.length === 1 ? 'category' : 'categories'}</p>
                <p className="text-sm">Try clearing the filter or selecting a different category</p>
              </>
            ) : (
              <>
                <p>No time entries yet</p>
                <p className="text-sm">Start a timer to begin tracking your work</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {entriesToShow.map((entry: TimeEntry) => (
              <div 
                key={entry.id} 
                className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                data-testid={`row-time-entry-${entry.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-medium truncate" data-testid={`text-entry-description-${entry.id}`}>
                      {entry.description}
                    </h4>
                    {!entry.endTime && (
                      <Badge variant="outline" className="text-success border-success">
                        Active
                      </Badge>
                    )}
                    {entry.userName && (
                      <Badge variant="secondary" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {entry.userName}
                      </Badge>
                    )}
                    {!entry.isBreak && entry.timeCategory && entry.timeCategory !== 'work' && TIME_CATEGORY_LABELS[entry.timeCategory] && (
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{ borderColor: TIME_CATEGORY_LABELS[entry.timeCategory].color + '60', color: TIME_CATEGORY_LABELS[entry.timeCategory].color }}
                      >
                        {TIME_CATEGORY_LABELS[entry.timeCategory].label}
                      </Badge>
                    )}
                    {!entry.isBreak && entry.timeCategory === 'travel' && !entry.distanceKm && (
                      <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-400/60 gap-1" title="Distance not set — travel allowance will be $0">
                        <AlertCircle className="h-2.5 w-2.5" />
                        No km
                      </Badge>
                    )}
                  </div>
                  
                  {showJobInfo && entry.jobTitle && (
                    <div className="flex items-center gap-1 mb-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-sm text-muted-foreground hover:text-primary"
                        onClick={() => entry.jobId && setLocation(`/jobs/${entry.jobId}`)}
                        data-testid={`button-view-job-${entry.id}`}
                      >
                        <Briefcase className="h-3 w-3 mr-1" />
                        Job: {entry.jobTitle}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                      {entry.clientName && (
                        <span className="text-sm text-muted-foreground">• {entry.clientName}</span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span data-testid={`text-start-time-${entry.id}`}>
                      {format(new Date(entry.startTime), 'MMM d, h:mm a')}
                    </span>
                    {entry.endTime && (
                      <>
                        <span>→</span>
                        <span data-testid={`text-end-time-${entry.id}`}>
                          {format(new Date(entry.endTime), 'h:mm a')}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3 ml-4">
                  <div className="text-right">
                    <div className="font-medium" data-testid={`text-duration-${entry.id}`}>
                      {formatDuration(entry.startTime, entry.endTime)}
                    </div>
                    {entry.endTime && entry.hourlyRate && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1" data-testid={`text-earnings-${entry.id}`}>
                        <DollarSign className="h-3 w-3" />
                        ${calculateEarnings(entry.startTime, entry.endTime, entry.hourlyRate)?.toFixed(2)}
                      </div>
                    )}
                  </div>
                  
                  {entry.endTime && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteEntryMutation.mutate(entry.id)}
                      disabled={deleteEntryMutation.isPending}
                      data-testid={`button-delete-entry-${entry.id}`}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Time Tracking Dashboard Component
export function TimeTrackingDashboard() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['/api/time-tracking/dashboard'],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card border rounded-md p-4" data-testid="card-dashboard-loading">
            <div className="animate-pulse space-y-2">
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-8 w-12 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const safeDashboard = dashboard as any || {};
  const todayData = safeDashboard.today || {};
  const weekData = safeDashboard.week || {};

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card 
        className="hover-elevate cursor-pointer transition-all duration-200 group"
        data-testid="kpi-today-hours"
      >
        <CardContent className="p-4 md:p-6">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div 
                className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105"
                style={{ 
                  backgroundColor: 'hsl(var(--trade) / 0.15)',
                  border: '2px solid hsl(var(--trade) / 0.3)'
                }}
              >
                <Clock 
                  className="h-5 w-5 sm:h-7 sm:w-7 transition-colors duration-200" 
                  style={{ color: 'hsl(var(--trade))' }}
                />
              </div>
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <div className="text-xl sm:text-3xl font-bold tracking-tight leading-none tabular-nums">
                {typeof todayData.totalHours === 'number' ? todayData.totalHours.toFixed(1) : '0.0'}h
              </div>
              <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground leading-tight">
                Today
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card 
        className="hover-elevate cursor-pointer transition-all duration-200 group"
        data-testid="kpi-week-hours"
      >
        <CardContent className="p-4 md:p-6">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div 
                className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105"
                style={{ 
                  backgroundColor: 'hsl(var(--trade) / 0.15)',
                  border: '2px solid hsl(var(--trade) / 0.3)'
                }}
              >
                <Calendar 
                  className="h-5 w-5 sm:h-7 sm:w-7 transition-colors duration-200" 
                  style={{ color: 'hsl(var(--trade))' }}
                />
              </div>
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <div className="text-xl sm:text-3xl font-bold tracking-tight leading-none tabular-nums">
                {typeof weekData.totalHours === 'number' ? weekData.totalHours.toFixed(1) : '0.0'}h
              </div>
              <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground leading-tight">
                This Week
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card 
        className="hover-elevate cursor-pointer transition-all duration-200 group"
        data-testid="kpi-active-jobs"
      >
        <CardContent className="p-4 md:p-6">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div 
                className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105"
                style={{ 
                  backgroundColor: 'hsl(var(--trade) / 0.15)',
                  border: '2px solid hsl(var(--trade) / 0.3)'
                }}
              >
                <Users 
                  className="h-5 w-5 sm:h-7 sm:w-7 transition-colors duration-200" 
                  style={{ color: 'hsl(var(--trade))' }}
                />
              </div>
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <div className="text-xl sm:text-3xl font-bold tracking-tight leading-none tabular-nums">
                {safeDashboard.activeJobs || 0}
              </div>
              <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground leading-tight">
                Active Jobs
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card 
        className="hover-elevate cursor-pointer transition-all duration-200 group"
        data-testid="kpi-avg-rate"
      >
        <CardContent className="p-4 md:p-6">
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between">
              <div 
                className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105"
                style={{ 
                  backgroundColor: 'hsl(var(--trade) / 0.15)',
                  border: '2px solid hsl(var(--trade) / 0.3)'
                }}
              >
                <DollarSign 
                  className="h-5 w-5 sm:h-7 sm:w-7 transition-colors duration-200" 
                  style={{ color: 'hsl(var(--trade))' }}
                />
              </div>
            </div>
            <div className="space-y-0.5 sm:space-y-1">
              <div className="text-xl sm:text-3xl font-bold tracking-tight leading-none tabular-nums">
                ${typeof safeDashboard.averageRate === 'number' ? safeDashboard.averageRate.toFixed(0) : '0'}/hr
              </div>
              <div className="text-[10px] sm:text-xs font-medium uppercase tracking-wide text-muted-foreground leading-tight">
                Avg Rate
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}