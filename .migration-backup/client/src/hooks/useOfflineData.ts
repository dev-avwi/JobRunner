import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  saveItem,
  getAllItems,
  getItem,
  deleteItem,
  addToSyncQueue,
  generateOfflineId,
  isOnline,
  saveFileAttachment,
  type OfflineFileAttachment,
} from '@/lib/offlineStorage';
import { processSyncQueue, resolveId } from '@/lib/syncService';
import { apiRequest, safeInvalidateQueries } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type StoreName = 'clients' | 'jobs' | 'quotes' | 'invoices';

export interface OfflineAttachmentInput {
  file: File;
  type: 'photo' | 'signature' | 'voice_note' | 'document';
  description?: string;
}

interface UseOfflineDataOptions<T> {
  storeName: StoreName;
  apiEndpoint: string;
  queryKey: string[];
  idField?: keyof T;
}

interface UseOfflineDataResult<T> {
  data: T[] | undefined;
  isLoading: boolean;
  isOffline: boolean;
  isSyncing: boolean;
  pendingSyncs: number;
  create: (item: Omit<T, 'id'>, attachments?: OfflineAttachmentInput[]) => Promise<T>;
  update: (id: string | number, updates: Partial<T>, attachments?: OfflineAttachmentInput[]) => Promise<T>;
  remove: (id: string | number) => Promise<void>;
  sync: () => Promise<void>;
  refetch: () => void;
}

export function useOfflineData<T extends { id: string | number }>(
  options: UseOfflineDataOptions<T>
): UseOfflineDataResult<T> {
  const { storeName, apiEndpoint, queryKey } = options;
  const queryClientInstance = useQueryClient();
  const { toast } = useToast();

  const [isOffline, setIsOffline] = useState(!isOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncs, setPendingSyncs] = useState(0);

  const updatePendingCount = useCallback(async () => {
    try {
      const queue = await getAllItems<any>('syncQueue');
      const count = queue.filter(op => op.storeName === storeName).length;
      setPendingSyncs(count);
    } catch {
      setPendingSyncs(0);
    }
  }, [storeName]);

  const performSync = useCallback(async () => {
    if (isSyncing || !isOnline()) return;

    setIsSyncing(true);
    try {
      const result = await processSyncQueue();

      if (result.synced > 0) {
        toast({
          title: 'Synced',
          description: `${result.synced} offline change${result.synced > 1 ? 's' : ''} synced.`,
        });
        safeInvalidateQueries({ queryKey });
      }

      if (result.failed > 0) {
        toast({
          title: 'Sync Issues',
          description: `${result.failed} change${result.failed > 1 ? 's' : ''} failed to sync.`,
          variant: 'destructive',
        });
      }

      await updatePendingCount();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, queryKey, toast, updatePendingCount]);

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

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [performSync]);

  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  const offlineAwareQueryFn = useCallback(async (): Promise<T[]> => {
    if (!isOnline()) {
      const cached = await getAllItems<T>(storeName);
      return cached;
    }

    try {
      const response = await apiRequest('GET', apiEndpoint);
      const data = await response.json();

      for (const item of data) {
        await saveItem(storeName, item);
      }

      return data;
    } catch (error) {
      const cached = await getAllItems<T>(storeName);
      if (cached.length > 0) {
        return cached;
      }
      throw error;
    }
  }, [storeName, apiEndpoint]);

  const query = useQuery<T[]>({
    queryKey,
    queryFn: offlineAwareQueryFn,
    staleTime: 5 * 60 * 1000,
  });

  const setListCache = useCallback(
    (mutator: (old: T[] | undefined) => T[] | undefined) => {
      queryClientInstance.setQueryData<T[]>(queryKey, (old) => mutator(old));
    },
    [queryClientInstance, queryKey]
  );

  const persistAttachments = async (
    entityId: string | number,
    attachments: OfflineAttachmentInput[]
  ): Promise<string[]> => {
    const attachmentIds: string[] = [];
    for (const a of attachments) {
      const id = generateOfflineId();
      const attachment: OfflineFileAttachment = {
        id,
        entityType: storeName === 'clients' ? 'client' : storeName === 'jobs' ? 'job' : storeName === 'quotes' ? 'quote' : 'invoice',
        entityId,
        type: a.type,
        filename: a.file.name,
        mimeType: a.file.type,
        blob: a.file,
        fileSize: a.file.size,
        description: a.description,
        createdAt: Date.now(),
        synced: false,
      };
      await saveFileAttachment(attachment);
      attachmentIds.push(id);
    }
    return attachmentIds;
  };

  const create = useCallback(async (itemData: Omit<T, 'id'>, attachments?: OfflineAttachmentInput[]): Promise<T> => {
    const offlineId = generateOfflineId();
    const newItem = { ...itemData, id: offlineId } as T;

    await saveItem(storeName, newItem);
    setListCache((old) => (old ? [...old, newItem] : [newItem]));

    const fileAttachmentIds = attachments?.length
      ? await persistAttachments(offlineId, attachments)
      : undefined;

    if (isOnline()) {
      try {
        const response = await apiRequest('POST', apiEndpoint, itemData);
        const serverItem = await response.json();

        await deleteItem(storeName, offlineId);
        await saveItem(storeName, serverItem);

        setListCache((old) =>
          old ? old.map((item) => (item.id === offlineId ? serverItem : item)) : [serverItem]
        );

        safeInvalidateQueries({ queryKey });

        if (fileAttachmentIds?.length) {
          await addToSyncQueue({
            type: 'update',
            storeName,
            data: serverItem,
            endpoint: `${apiEndpoint}/${serverItem.id}`,
            method: 'PATCH',
            fileAttachmentIds,
          });
          await updatePendingCount();
        }

        return serverItem;
      } catch (error) {
        await addToSyncQueue({
          type: 'create',
          storeName,
          data: newItem,
          endpoint: apiEndpoint,
          method: 'POST',
          fileAttachmentIds,
        });

        await updatePendingCount();

        toast({
          title: 'Saved Offline',
          description: 'Changes will sync when you reconnect.',
        });

        return newItem;
      }
    } else {
      await addToSyncQueue({
        type: 'create',
        storeName,
        data: newItem,
        endpoint: apiEndpoint,
        method: 'POST',
        fileAttachmentIds,
      });

      await updatePendingCount();

      toast({
        title: 'Saved Offline',
        description: 'Changes will sync when you reconnect.',
      });

      return newItem;
    }
  }, [storeName, apiEndpoint, queryKey, setListCache, toast, updatePendingCount]);

  const update = useCallback(async (id: string | number, updates: Partial<T>, attachments?: OfflineAttachmentInput[]): Promise<T> => {
    const resolvedId = resolveId(id);
    const existingItem = await getItem<T>(storeName, id) || await getItem<T>(storeName, resolvedId);

    if (!existingItem) {
      throw new Error(`Item with id ${id} not found`);
    }

    const updatedItem = { ...existingItem, ...updates } as T;

    await saveItem(storeName, updatedItem);
    setListCache((old) =>
      old ? old.map((item) => (item.id === id || item.id === resolvedId ? updatedItem : item)) : [updatedItem]
    );

    const fileAttachmentIds = attachments?.length
      ? await persistAttachments(resolvedId, attachments)
      : undefined;

    if (isOnline()) {
      try {
        const response = await apiRequest('PATCH', `${apiEndpoint}/${resolvedId}`, updates);
        const serverItem = await response.json();

        await saveItem(storeName, serverItem);
        setListCache((old) =>
          old ? old.map((item) => (item.id === id || item.id === resolvedId ? serverItem : item)) : [serverItem]
        );

        safeInvalidateQueries({ queryKey });

        if (fileAttachmentIds?.length) {
          await addToSyncQueue({
            type: 'update',
            storeName,
            data: serverItem,
            endpoint: `${apiEndpoint}/${serverItem.id}`,
            method: 'PATCH',
            fileAttachmentIds,
          });
          await updatePendingCount();
        }

        return serverItem;
      } catch (error) {
        await addToSyncQueue({
          type: 'update',
          storeName,
          data: updatedItem,
          endpoint: `${apiEndpoint}/${resolvedId}`,
          method: 'PATCH',
          fileAttachmentIds,
        });

        await updatePendingCount();

        toast({
          title: 'Saved Offline',
          description: 'Changes will sync when you reconnect.',
        });

        return updatedItem;
      }
    } else {
      await addToSyncQueue({
        type: 'update',
        storeName,
        data: updatedItem,
        endpoint: `${apiEndpoint}/${resolvedId}`,
        method: 'PATCH',
        fileAttachmentIds,
      });

      await updatePendingCount();

      toast({
        title: 'Saved Offline',
        description: 'Changes will sync when you reconnect.',
      });

      return updatedItem;
    }
  }, [storeName, apiEndpoint, queryKey, setListCache, toast, updatePendingCount]);

  const remove = useCallback(async (id: string | number): Promise<void> => {
    const resolvedId = resolveId(id);

    await deleteItem(storeName, id);
    setListCache((old) =>
      old ? old.filter((item) => item.id !== id && item.id !== resolvedId) : []
    );

    if (isOnline()) {
      try {
        await apiRequest('DELETE', `${apiEndpoint}/${resolvedId}`);
        safeInvalidateQueries({ queryKey });
      } catch (error) {
        await addToSyncQueue({
          type: 'delete',
          storeName,
          data: { id: resolvedId },
          endpoint: `${apiEndpoint}/${resolvedId}`,
          method: 'DELETE',
        });

        await updatePendingCount();

        toast({
          title: 'Saved Offline',
          description: 'Changes will sync when you reconnect.',
        });
      }
    } else {
      await addToSyncQueue({
        type: 'delete',
        storeName,
        data: { id: resolvedId },
        endpoint: `${apiEndpoint}/${resolvedId}`,
        method: 'DELETE',
      });

      await updatePendingCount();

      toast({
        title: 'Saved Offline',
        description: 'Changes will sync when you reconnect.',
      });
    }
  }, [storeName, apiEndpoint, queryKey, setListCache, toast, updatePendingCount]);

  const refetch = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    data: query.data,
    isLoading: query.isLoading,
    isOffline,
    isSyncing,
    pendingSyncs,
    create,
    update,
    remove,
    sync: performSync,
    refetch,
  };
}

export function useOfflineClients() {
  return useOfflineData<any>({
    storeName: 'clients',
    apiEndpoint: '/api/clients',
    queryKey: ['/api/clients'],
  });
}

export function useOfflineJobs() {
  return useOfflineData<any>({
    storeName: 'jobs',
    apiEndpoint: '/api/jobs',
    queryKey: ['/api/jobs'],
  });
}

export function useOfflineQuotes() {
  return useOfflineData<any>({
    storeName: 'quotes',
    apiEndpoint: '/api/quotes',
    queryKey: ['/api/quotes'],
  });
}

export function useOfflineInvoices() {
  return useOfflineData<any>({
    storeName: 'invoices',
    apiEndpoint: '/api/invoices',
    queryKey: ['/api/invoices'],
  });
}
