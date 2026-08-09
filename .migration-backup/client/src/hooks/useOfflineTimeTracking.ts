import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  saveTimeEntry,
  getAllTimeEntries,
  getTimeEntriesForJob,
  deleteTimeEntry,
  getTimeEntry,
  addToSyncQueue,
  generateOfflineId,
  isOnline,
  getSyncQueue,
  type TimeEntry as BaseTimeEntry,
} from '@/lib/offlineStorage';
import { syncManager } from '@/lib/syncManager';
import { apiRequest, safeInvalidateQueries } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const ACTIVE_TIMER_KEY = 'jobrunner_active_timer';
const HEARTBEAT_INTERVAL_MS = 30000;

export interface OfflineTimeEntry extends BaseTimeEntry {
  pendingSync?: boolean;
  syncStatus?: 'pending' | 'synced' | 'failed';
  isBreak?: boolean;
  breakTime?: number;
}

interface ActiveTimer {
  id: string;
  jobId?: number | string;
  userId?: number;
  startTime: string;
  description?: string;
  hourlyRate?: number;
  isBreak?: boolean;
  lastHeartbeat?: number;
}

interface UseOfflineTimeTrackingOptions {
  jobId?: number | string;
  userId?: number;
}

interface UseOfflineTimeTrackingReturn {
  entries: OfflineTimeEntry[];
  activeTimer: ActiveTimer | null;
  isLoading: boolean;
  isOffline: boolean;
  isSyncing: boolean;
  pendingSyncs: number;
  startTimer: (data: StartTimerData) => Promise<OfflineTimeEntry>;
  stopTimer: (timerId?: string) => Promise<OfflineTimeEntry | null>;
  pauseTimer: () => Promise<OfflineTimeEntry | null>;
  resumeTimer: (data?: StartTimerData) => Promise<OfflineTimeEntry>;
  getActiveTimer: () => ActiveTimer | null;
  getEntriesForJob: (jobId: number) => Promise<OfflineTimeEntry[]>;
  deleteEntry: (id: string | number) => Promise<void>;
  sync: () => Promise<void>;
  refetch: () => void;
}

interface StartTimerData {
  description?: string;
  hourlyRate?: number;
  isBreak?: boolean;
}

function getActiveTimerFromStorage(): ActiveTimer | null {
  try {
    const stored = localStorage.getItem(ACTIVE_TIMER_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to parse active timer from storage:', error);
  }
  return null;
}

function saveActiveTimerToStorage(timer: ActiveTimer | null): void {
  try {
    if (timer) {
      localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify(timer));
    } else {
      localStorage.removeItem(ACTIVE_TIMER_KEY);
    }
  } catch (error) {
    console.warn('Failed to save active timer to storage:', error);
  }
}

export function useOfflineTimeTracking(
  options: UseOfflineTimeTrackingOptions = {}
): UseOfflineTimeTrackingReturn {
  const { jobId, userId } = options;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isOffline, setIsOffline] = useState(!isOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncs, setPendingSyncs] = useState(0);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(getActiveTimerFromStorage);

  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const queryKey = jobId ? ['/api/time-entries', jobId] : ['/api/time-entries'];

  const updatePendingCount = useCallback(async () => {
    try {
      const queue = await getSyncQueue();
      const count = queue.filter(op => op.storeName === 'timeEntries').length;
      setPendingSyncs(count);
    } catch {
      setPendingSyncs(0);
    }
  }, []);

  const performSync = useCallback(async () => {
    if (isSyncing || !isOnline()) return;

    setIsSyncing(true);
    try {
      await syncManager.triggerSync();
      await updatePendingCount();
      safeInvalidateQueries({ queryKey: ['/api/time-entries'] });
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, updatePendingCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      performSync();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribeOnline = syncManager.on('online', handleOnline);
    const unsubscribeOffline = syncManager.on('offline', handleOffline);
    const unsubscribeSyncComplete = syncManager.on('syncComplete', () => {
      updatePendingCount();
      safeInvalidateQueries({ queryKey: ['/api/time-entries'] });
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeOnline();
      unsubscribeOffline();
      unsubscribeSyncComplete();
    };
  }, [performSync, updatePendingCount]);

  useEffect(() => {
    updatePendingCount();
    const storedTimer = getActiveTimerFromStorage();
    if (storedTimer) {
      setActiveTimer(storedTimer);
    }
  }, [jobId, updatePendingCount]);

  const performHeartbeat = useCallback(async () => {
    if (!activeTimer) return;

    const updatedTimer = {
      ...activeTimer,
      lastHeartbeat: Date.now(),
    };
    saveActiveTimerToStorage(updatedTimer);
    setActiveTimer(updatedTimer);

    const entryUpdate: OfflineTimeEntry = {
      id: activeTimer.id,
      jobId: typeof activeTimer.jobId === 'string' ? parseInt(activeTimer.jobId, 10) : activeTimer.jobId,
      userId: activeTimer.userId,
      startTime: activeTimer.startTime,
      description: activeTimer.description,
      hourlyRate: activeTimer.hourlyRate,
      isBreak: activeTimer.isBreak,
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveTimeEntry(entryUpdate);
    } catch (error) {
      console.warn('Heartbeat save failed:', error);
    }

    if (isOnline() && !activeTimer.id.startsWith('offline_')) {
      try {
        await fetch(`/api/time-entries/${activeTimer.id}/heartbeat`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.debug('Server heartbeat failed (non-critical):', error);
      }
    }
  }, [activeTimer]);

  useEffect(() => {
    if (activeTimer) {
      heartbeatIntervalRef.current = setInterval(() => {
        performHeartbeat();
      }, HEARTBEAT_INTERVAL_MS);

      performHeartbeat();

      return () => {
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
      };
    } else {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    }
  }, [activeTimer?.id, performHeartbeat]);

  const offlineAwareQueryFn = useCallback(async (): Promise<OfflineTimeEntry[]> => {
    if (!isOnline()) {
      const cached = jobId
        ? await getTimeEntriesForJob(typeof jobId === 'string' ? parseInt(jobId, 10) : jobId)
        : await getAllTimeEntries();
      return cached;
    }

    try {
      const endpoint = jobId ? `/api/time-entries?jobId=${jobId}` : '/api/time-entries';
      const response = await apiRequest('GET', endpoint);
      const data: OfflineTimeEntry[] = await response.json();

      for (const item of data) {
        await saveTimeEntry({ ...item, syncStatus: 'synced' });
      }

      const allCached = await getAllTimeEntries();
      const offlineEntries = allCached.filter(e =>
        e.id.toString().startsWith('offline_') &&
        (!jobId || String(e.jobId) === String(jobId))
      );

      return [...data, ...offlineEntries];
    } catch (error) {
      const cached = jobId
        ? await getTimeEntriesForJob(typeof jobId === 'string' ? parseInt(jobId, 10) : jobId)
        : await getAllTimeEntries();
      return cached;
    }
  }, [jobId]);

  const query = useQuery<OfflineTimeEntry[]>({
    queryKey,
    queryFn: offlineAwareQueryFn,
    staleTime: 60000,
  });

  const setEntriesCache = useCallback(
    (mutator: (old: OfflineTimeEntry[] | undefined) => OfflineTimeEntry[] | undefined) => {
      queryClient.setQueryData<OfflineTimeEntry[]>(queryKey, (old) => mutator(old));
    },
    [queryClient, queryKey]
  );

  const startTimer = useCallback(async (data: StartTimerData = {}): Promise<OfflineTimeEntry> => {
    if (activeTimer) {
      throw new Error('A timer is already running. Stop it before starting a new one.');
    }

    const offlineId = generateOfflineId();
    const startTime = new Date().toISOString();

    const newEntry: OfflineTimeEntry = {
      id: offlineId,
      jobId: typeof jobId === 'string' ? parseInt(jobId, 10) : jobId,
      userId: userId,
      startTime,
      description: data.description || (data.isBreak ? 'Break' : 'Work session'),
      hourlyRate: data.hourlyRate,
      isBreak: data.isBreak || false,
      pendingSync: true,
      syncStatus: 'pending',
      createdAt: startTime,
    };

    await saveTimeEntry(newEntry);
    setEntriesCache((old) => (old ? [...old, newEntry] : [newEntry]));

    const timer: ActiveTimer = {
      id: offlineId,
      jobId,
      userId,
      startTime,
      description: newEntry.description,
      hourlyRate: data.hourlyRate,
      isBreak: data.isBreak,
      lastHeartbeat: Date.now(),
    };
    saveActiveTimerToStorage(timer);
    setActiveTimer(timer);

    if (isOnline()) {
      try {
        const response = await apiRequest('POST', '/api/time-entries', {
          jobId: newEntry.jobId,
          description: newEntry.description,
          hourlyRate: newEntry.hourlyRate?.toString(),
          isBreak: newEntry.isBreak,
        });
        const serverEntry = await response.json();

        await deleteTimeEntry(offlineId);
        await saveTimeEntry({ ...serverEntry, syncStatus: 'synced' });

        const updatedTimer = { ...timer, id: serverEntry.id };
        saveActiveTimerToStorage(updatedTimer);
        setActiveTimer(updatedTimer);

        setEntriesCache((old) =>
          old ? old.map(e => e.id === offlineId ? { ...serverEntry, syncStatus: 'synced' } : e) : [serverEntry]
        );

        safeInvalidateQueries({ queryKey: ['/api/time-entries'] });

        return serverEntry;
      } catch (error) {
        await addToSyncQueue({
          type: 'create',
          storeName: 'timeEntries',
          data: newEntry,
          endpoint: '/api/time-entries',
          method: 'POST',
        });

        await updatePendingCount();

        toast({
          title: 'Timer Started (Offline)',
          description: 'Timer will sync when you reconnect.',
        });

        return newEntry;
      }
    } else {
      await addToSyncQueue({
        type: 'create',
        storeName: 'timeEntries',
        data: newEntry,
        endpoint: '/api/time-entries',
        method: 'POST',
      });

      await updatePendingCount();

      toast({
        title: 'Timer Started (Offline)',
        description: 'Timer will sync when you reconnect.',
      });

      return newEntry;
    }
  }, [activeTimer, jobId, userId, toast, setEntriesCache, updatePendingCount]);

  const stopTimer = useCallback(async (timerId?: string): Promise<OfflineTimeEntry | null> => {
    const timerToStop = timerId ? { id: timerId } : activeTimer;
    if (!timerToStop) {
      return null;
    }

    const endTime = new Date().toISOString();
    const existingEntry = await getTimeEntry(timerToStop.id);

    const startTime = existingEntry?.startTime || activeTimer?.startTime;
    if (!startTime) {
      throw new Error('Cannot find start time for timer');
    }

    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    const duration = Math.floor(durationMs / 60000);

    const updatedEntry: OfflineTimeEntry = {
      ...existingEntry,
      id: timerToStop.id,
      startTime,
      endTime,
      duration,
      pendingSync: true,
      syncStatus: 'pending',
      updatedAt: endTime,
    };

    await saveTimeEntry(updatedEntry);
    setEntriesCache((old) =>
      old ? old.map(e => e.id === timerToStop.id ? updatedEntry : e) : [updatedEntry]
    );

    saveActiveTimerToStorage(null);
    setActiveTimer(null);

    if (isOnline() && !timerToStop.id.toString().startsWith('offline_')) {
      try {
        const response = await apiRequest('POST', `/api/time-entries/${timerToStop.id}/stop`);
        const serverEntry = await response.json();

        await saveTimeEntry({ ...serverEntry, syncStatus: 'synced' });

        setEntriesCache((old) =>
          old ? old.map(e => e.id === timerToStop.id ? { ...serverEntry, syncStatus: 'synced' } : e) : [serverEntry]
        );

        safeInvalidateQueries({ queryKey: ['/api/time-entries'] });

        return serverEntry;
      } catch (error) {
        await addToSyncQueue({
          type: 'update',
          storeName: 'timeEntries',
          data: updatedEntry,
          endpoint: `/api/time-entries/${timerToStop.id}/stop`,
          method: 'POST',
        });

        await updatePendingCount();

        toast({
          title: 'Time Saved (Offline)',
          description: 'Entry will sync when you reconnect.',
        });

        return updatedEntry;
      }
    } else {
      if (timerToStop.id.toString().startsWith('offline_')) {
        await addToSyncQueue({
          type: 'update',
          storeName: 'timeEntries',
          data: updatedEntry,
          endpoint: `/api/time-entries/${timerToStop.id}`,
          method: 'PATCH',
        });
      }

      await updatePendingCount();

      toast({
        title: 'Time Saved (Offline)',
        description: 'Entry will sync when you reconnect.',
      });

      return updatedEntry;
    }
  }, [activeTimer, toast, setEntriesCache, updatePendingCount]);

  const pauseTimer = useCallback(async (): Promise<OfflineTimeEntry | null> => {
    if (!activeTimer || activeTimer.isBreak) {
      return null;
    }

    const stoppedEntry = await stopTimer();

    if (stoppedEntry) {
      const breakEntry = await startTimer({
        description: `Break - ${activeTimer.description || 'Work session'}`,
        isBreak: true,
      });
      return breakEntry;
    }

    return null;
  }, [activeTimer, stopTimer, startTimer]);

  const resumeTimer = useCallback(async (data: StartTimerData = {}): Promise<OfflineTimeEntry> => {
    if (activeTimer && !activeTimer.isBreak) {
      throw new Error('Work timer is already running.');
    }

    if (activeTimer && activeTimer.isBreak) {
      await stopTimer();
    }

    const workEntry = await startTimer({
      description: data.description || 'Work session',
      hourlyRate: data.hourlyRate,
      isBreak: false,
    });

    return workEntry;
  }, [activeTimer, stopTimer, startTimer]);

  const getActiveTimerFn = useCallback((): ActiveTimer | null => {
    return activeTimer;
  }, [activeTimer]);

  const getEntriesForJobFn = useCallback(async (targetJobId: number): Promise<OfflineTimeEntry[]> => {
    try {
      const entries = await getTimeEntriesForJob(targetJobId);
      return entries;
    } catch (error) {
      console.error('Failed to get entries for job:', error);
      return [];
    }
  }, []);

  const deleteEntryFn = useCallback(async (id: string | number): Promise<void> => {
    await deleteTimeEntry(id);
    setEntriesCache((old) => (old ? old.filter(e => e.id !== id) : []));

    if (isOnline() && !id.toString().startsWith('offline_')) {
      try {
        await apiRequest('DELETE', `/api/time-entries/${id}`);
        safeInvalidateQueries({ queryKey: ['/api/time-entries'] });
      } catch (error) {
        await addToSyncQueue({
          type: 'delete',
          storeName: 'timeEntries',
          data: { id },
          endpoint: `/api/time-entries/${id}`,
          method: 'DELETE',
        });

        await updatePendingCount();

        toast({
          title: 'Deleted (Offline)',
          description: 'Deletion will sync when you reconnect.',
        });
      }
    } else {
      if (!id.toString().startsWith('offline_')) {
        await addToSyncQueue({
          type: 'delete',
          storeName: 'timeEntries',
          data: { id },
          endpoint: `/api/time-entries/${id}`,
          method: 'DELETE',
        });

        await updatePendingCount();
      }

      toast({
        title: 'Entry Deleted',
        description: 'Changes saved locally.',
      });
    }
  }, [toast, setEntriesCache, updatePendingCount]);

  const refetch = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    entries: query.data ?? [],
    activeTimer,
    isLoading: query.isLoading,
    isOffline,
    isSyncing,
    pendingSyncs,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    getActiveTimer: getActiveTimerFn,
    getEntriesForJob: getEntriesForJobFn,
    deleteEntry: deleteEntryFn,
    sync: performSync,
    refetch,
  };
}

export default useOfflineTimeTracking;
