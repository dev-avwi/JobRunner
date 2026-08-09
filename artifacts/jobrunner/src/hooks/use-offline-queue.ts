import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  addToOfflineQueue,
  syncOfflineQueue,
  getOfflinePendingCount,
  isOnline,
  type OfflineMutation,
  type SyncResult,
} from '@/lib/offlineQueue';
import { getSessionToken } from '@/lib/queryClient';

export function useOfflineQueue() {
  const [pendingCount, setPendingCount] = useState(getOfflinePendingCount);
  const [isSyncing, setIsSyncing] = useState(false);
  const [online, setOnline] = useState(isOnline);
  const { toast } = useToast();

  const updatePendingCount = useCallback(() => {
    setPendingCount(getOfflinePendingCount());
  }, []);

  const performSync = useCallback(async (): Promise<SyncResult | null> => {
    if (!isOnline() || isSyncing) return null;

    const count = getOfflinePendingCount();
    if (count === 0) return null;

    setIsSyncing(true);

    try {
      const result = await syncOfflineQueue(async (endpoint, method, data) => {
        const headers: HeadersInit = {};
        if (data) {
          headers['Content-Type'] = 'application/json';
        }
        const token = getSessionToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        return fetch(endpoint, {
          method,
          headers,
          body: data ? JSON.stringify(data) : undefined,
          credentials: 'include',
        });
      });

      updatePendingCount();

      if (result.synced > 0) {
        toast({
          title: 'Synced',
          description: `${result.synced} offline change${result.synced > 1 ? 's' : ''} synced successfully.`,
        });
      }

      if (result.failed > 0) {
        toast({
          title: 'Sync Issues',
          description: `${result.failed} change${result.failed > 1 ? 's' : ''} failed to sync. Please try again.`,
          variant: 'destructive',
        });
      }

      return result;
    } catch (error) {
      console.error('Offline queue sync error:', error);
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, toast, updatePendingCount]);

  const queueMutation = useCallback(
    (type: string, endpoint: string, method: string, data: unknown): OfflineMutation => {
      const mutation = addToOfflineQueue(type, endpoint, method, data);
      updatePendingCount();

      toast({
        title: 'Saved Offline',
        description: 'Your changes will sync when you reconnect.',
      });

      return mutation;
    },
    [toast, updatePendingCount]
  );

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      performSync();
    };

    const handleOffline = () => {
      setOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (isOnline()) {
      performSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [performSync]);

  return {
    pendingCount,
    isSyncing,
    online,
    queueMutation,
    syncNow: performSync,
    updatePendingCount,
  };
}
