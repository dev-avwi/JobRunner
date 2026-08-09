export const OFFLINE_QUEUE_KEY = 'jobrunner_offline_queue';

export interface OfflineMutation {
  id: string;
  timestamp: number;
  type: string;
  endpoint: string;
  method: string;
  data: unknown;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getOfflineQueue(): OfflineMutation[] {
  try {
    const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as OfflineMutation[];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: OfflineMutation[]): void {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.warn('Failed to save offline queue to localStorage:', error);
  }
}

export function addToOfflineQueue(
  type: string,
  endpoint: string,
  method: string,
  data: unknown
): OfflineMutation {
  const mutation: OfflineMutation = {
    id: generateId(),
    timestamp: Date.now(),
    type,
    endpoint,
    method,
    data,
  };

  const queue = getOfflineQueue();
  queue.push(mutation);
  saveOfflineQueue(queue);

  return mutation;
}

export function removeFromOfflineQueue(id: string): void {
  const queue = getOfflineQueue();
  const filtered = queue.filter((m) => m.id !== id);
  saveOfflineQueue(filtered);
}

export function getOfflinePendingCount(): number {
  return getOfflineQueue().length;
}

export function clearOfflineQueue(): void {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch {
    console.warn('Failed to clear offline queue');
  }
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: Array<{ mutation: OfflineMutation; error: string }>;
}

export async function syncOfflineQueue(
  fetchFn: (endpoint: string, method: string, data: unknown) => Promise<Response>
): Promise<SyncResult> {
  const queue = getOfflineQueue();
  
  if (queue.length === 0) {
    return { success: true, synced: 0, failed: 0, errors: [] };
  }

  const results: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    errors: [],
  };

  for (const mutation of queue) {
    try {
      const response = await fetchFn(mutation.endpoint, mutation.method, mutation.data);
      
      if (response.ok) {
        removeFromOfflineQueue(mutation.id);
        results.synced++;
      } else {
        const errorText = await response.text().catch(() => response.statusText);
        results.failed++;
        results.errors.push({
          mutation,
          error: `${response.status}: ${errorText}`,
        });
        results.success = false;
      }
    } catch (error) {
      results.failed++;
      results.errors.push({
        mutation,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      results.success = false;
    }
  }

  return results;
}

export function isOnline(): boolean {
  return navigator.onLine;
}
