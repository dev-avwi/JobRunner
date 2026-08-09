import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { safeInvalidateQueries, getAuthHeaders} from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TimeEntry {
  id: string;
  userId: string;
  jobId: string | null;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  hourlyRate: string;
  description: string | null;
  isBreak: boolean;
  isOvertime: boolean;
  approved: boolean;
}

interface UseTimeTrackingReturn {
  timeEntries: TimeEntry[];
  activeEntry: TimeEntry | null;
  totalDuration: number; // in milliseconds
  elapsedDisplay: string; // formatted like "2h 15m"
  startTimer: () => Promise<void>;
  stopTimer: () => Promise<void>;
  isStarting: boolean;
  isStopping: boolean;
  isLoading: boolean;
}

export function useTimeTracking(jobId: string): UseTimeTrackingReturn {
  const { toast } = useToast();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch time entries for this job
  const { data: timeEntries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: ['/api/time-entries', jobId],
    queryFn: async () => {
      const response = await fetch(`/api/time-entries?jobId=${jobId}`, {
        credentials: 'include',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch time entries');
      return response.json();
    },
  });

  // Derive active entry (entry without endTime)
  const activeEntry = useMemo(() => {
    return timeEntries.find(entry => !entry.endTime) || null;
  }, [timeEntries]);

  // Calculate total duration across all completed entries
  const totalDuration = useMemo(() => {
    return timeEntries.reduce((total, entry) => {
      if (entry.endTime) {
        const start = new Date(entry.startTime).getTime();
        const end = new Date(entry.endTime).getTime();
        return total + (end - start);
      }
      return total;
    }, 0);
  }, [timeEntries]);

  // Format elapsed time display
  const elapsedDisplay = useMemo(() => {
    if (!activeEntry) return "0h 0m";
    
    const startTime = new Date(activeEntry.startTime).getTime();
    const now = Date.now();
    const diffMs = now - startTime;
    const totalSeconds = Math.floor(diffMs / 1000);
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${seconds}s`;
  }, [activeEntry, elapsedSeconds]);

  // Start timer mutation
  const startMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          jobId,
          startTime: new Date().toISOString(),
          description: 'Work session',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          throw new Error(`CONFLICT: ${error.error || 'Active timer already running'}`);
        }
        throw new Error('Failed to start timer');
      }

      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ['/api/time-entries', jobId] });
      toast({
        title: "Timer started",
        description: "Time tracking has begun for this job",
      });
    },
    onError: (error: Error) => {
      if (error.message.startsWith('CONFLICT:')) {
        toast({
          title: "Timer already running",
          description: error.message.replace('CONFLICT: ', ''),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Failed to start timer",
          description: "Please try again",
          variant: "destructive",
        });
      }
    },
  });

  // Stop timer mutation
  const stopMutation = useMutation({
    mutationFn: async () => {
      if (!activeEntry) throw new Error('No active timer');

      const endTime = new Date();
      const startTime = new Date(activeEntry.startTime);
      const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));

      const response = await fetch(`/api/time-entries/${activeEntry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          endTime: endTime.toISOString(),
          duration: durationMinutes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 404) {
          throw new Error('NOTFOUND: Timer not found or already stopped');
        }
        throw new Error('Failed to stop timer');
      }

      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ['/api/time-entries', jobId] });
      toast({
        title: "Timer stopped",
        description: "Time has been recorded for this job",
      });
    },
    onError: (error: Error) => {
      if (error.message.startsWith('NOTFOUND:')) {
        toast({
          title: "Timer already stopped",
          description: "Refreshing data...",
          variant: "destructive",
        });
        safeInvalidateQueries({ queryKey: ['/api/time-entries', jobId] });
      } else {
        toast({
          title: "Failed to stop timer",
          description: "Please try again",
          variant: "destructive",
        });
      }
    },
  });

  // Manage interval for live timer updates
  useEffect(() => {
    if (activeEntry) {
      // Start interval to update elapsed time every second
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      // Clear interval when no active timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setElapsedSeconds(0);
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activeEntry]);

  return {
    timeEntries,
    activeEntry,
    totalDuration,
    elapsedDisplay,
    startTimer: async () => startMutation.mutateAsync(),
    stopTimer: async () => stopMutation.mutateAsync(),
    isStarting: startMutation.isPending,
    isStopping: stopMutation.isPending,
    isLoading,
  };
}
