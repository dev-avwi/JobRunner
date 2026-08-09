import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAllItems, saveItem, getItem, deleteItem, addToSyncQueue, generateOfflineId, isOnline as checkOnline, type SyncOperation, type OfflineStoreName } from "./offlineStorage";
import { syncManager } from "./syncManager";

export function getStoreNameFromEndpoint(endpoint: string): OfflineStoreName | null {
  if (endpoint.includes('/api/clients')) return 'clients';
  if (endpoint.includes('/api/jobs')) return 'jobs';
  if (endpoint.includes('/api/quotes')) return 'quotes';
  if (endpoint.includes('/api/invoices')) return 'invoices';
  if (endpoint.includes('/api/time-entries')) return 'timeEntries';
  if (endpoint.includes('/api/payments')) return 'payments';
  if (endpoint.includes('/api/templates')) return 'templates';
  return null;
}

function getStoreNameFromUrl(url: string): OfflineStoreName | null {
  return getStoreNameFromEndpoint(url);
}

async function getCachedDataForEndpoint<T>(url: string): Promise<T[] | null> {
  const storeName = getStoreNameFromUrl(url);
  if (!storeName) return null;
  
  try {
    return await getAllItems<T>(storeName);
  } catch {
    return null;
  }
}

async function cacheApiResponse<T extends { id: string | number }>(url: string, data: T | T[]): Promise<void> {
  const storeName = getStoreNameFromUrl(url);
  if (!storeName) return;
  
  try {
    const items = Array.isArray(data) ? data : [data];
    const validItems = items.filter(item => item && typeof item === 'object' && 'id' in item && item.id != null && (typeof item.id === 'string' ? item.id.length > 0 : typeof item.id === 'number'));
    if (validItems.length === 0) return;
    for (const item of validItems) {
      await saveItem(storeName, item);
    }
  } catch {
  }
}

// Helper to get single item from offline storage for detail queries
async function getItemFromEndpoint(endpoint: string, id: string): Promise<any> {
  const storeName = getStoreNameFromEndpoint(endpoint);
  if (storeName) {
    return await getItem(storeName, id);
  }
  return null;
}

// Session token storage key for iOS/Safari fallback
const SESSION_TOKEN_KEY = 'jobrunner_session_token';

// Track local changes to prevent WebSocket invalidation flicker
// Maps query key patterns to their last local change timestamp
const localChangeTimestamps = new Map<string, number>();

/**
 * Record a local change timestamp for a query key pattern.
 * This prevents WebSocket events from re-invalidating data we just changed.
 */
export function recordLocalChange(queryKeyPattern: string): void {
  localChangeTimestamps.set(queryKeyPattern, Date.now());
}

/**
 * Check if a WebSocket event timestamp is from a remote device.
 * Returns true if we should invalidate (remote change), false if local (already have data).
 * Uses a 5-second window to account for network latency.
 */
export function isRemoteChange(queryKeyPattern: string, eventTimestamp: number): boolean {
  const localTimestamp = localChangeTimestamps.get(queryKeyPattern);
  if (!localTimestamp) {
    // No local change recorded - this is a remote change
    return true;
  }
  
  // If the event timestamp is within 5 seconds of our local change, it's likely our own change
  const timeDiff = Math.abs(eventTimestamp - localTimestamp);
  const isLocal = timeDiff < 5000;
  
  // Clean up old entries after 10 seconds
  if (Date.now() - localTimestamp > 10000) {
    localChangeTimestamps.delete(queryKeyPattern);
  }
  
  return !isLocal;
}

// Get session token from localStorage
export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

// Set session token in localStorage
export function setSessionToken(token: string): void {
  try {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    console.warn('Failed to save session token to localStorage');
  }
}

// Clear session token from localStorage
export function clearSessionToken(): void {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    console.warn('Failed to clear session token from localStorage');
  }
}

// Auth-only headers (Bearer token) for custom queryFn/fetch calls.
// The web app authenticates via a Bearer token in localStorage; cookie-only
// requests (credentials: 'include' with no Authorization header) can silently
// return empty data or 401 in some sessions. Use this on any hand-rolled fetch.
export function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {};
  const token = getSessionToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Build headers with session token for iOS/Safari fallback
function buildHeaders(hasData: boolean): HeadersInit {
  const headers: HeadersInit = {};
  
  if (hasData) {
    headers['Content-Type'] = 'application/json';
  }
  
  // Add Authorization header with session token for iOS/Safari fallback
  const token = getSessionToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // 403 = authenticated but NOT permitted. Never clear the session token here:
    // a worker/subcontractor legitimately hits owner-only endpoints (quotes,
    // invoices, reports, team locations) and those return 403. Wiping the token
    // would silently log them out on the next reload. Surface the error instead.
    if (res.status === 403) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.isDemo) {
          throw new Error(`demo_readonly: ${parsed.error}`);
        }
        // Subscription/plan gating (e.g. team_plan_required) — surface the
        // friendly error to the user without clearing their session.
        if (parsed.requiresTeamPlan || parsed.code === 'team_plan_required') {
          throw new Error(`team_plan_required: ${parsed.error || 'A Team or Business plan is required for this action.'}`);
        }
      } catch (e) {
        if (e instanceof Error && (e.message.startsWith('demo_readonly:') || e.message.startsWith('team_plan_required:'))) throw e;
      }
      throw new Error(`403: ${text}`);
    }
    
    // Handle session expiry (401)
    if (res.status === 401) {
      clearSessionToken();
      throw new Error(`session_expired: Your session has expired. Please log in again.`);
    }
    
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: buildHeaders(!!data),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

function getBaseUrlFromUrl(url: string): string {
  // Extract base URL from /api/clients/123 -> /api/clients
  const match = url.match(/^(\/api\/[^\/]+)/);
  return match ? match[1] : url;
}

export async function offlineAwareApiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<Response> {
  if (!checkOnline()) {
    const storeName = getStoreNameFromUrl(url);
    
    let responseData: unknown = { success: true, offline: true };
    
    if (method.toUpperCase() === 'POST' && storeName && data) {
      const offlineId = generateOfflineId();
      const offlineData = { ...data as object, id: offlineId };
      
      await saveItem(storeName, offlineData as any);
      
      await addToSyncQueue({
        type: 'create',
        storeName,
        data: offlineData,
        endpoint: url,
        method: 'POST',
      });
      
      // Update React Query list cache optimistically
      updateQueryCacheOptimistically([url], 'create', offlineData);
      // Also set detail cache for the new item
      queryClient.setQueryData([url, offlineId], offlineData);
      
      responseData = offlineData;
    } else if ((method.toUpperCase() === 'PATCH' || method.toUpperCase() === 'PUT') && storeName && data) {
      const idMatch = url.match(/\/([^\/]+)$/);
      const id = idMatch ? idMatch[1] : null;
      
      if (id) {
        const existingItem = await getItem(storeName, id);
        const updatedData = existingItem 
          ? { ...existingItem, ...data as object, id }
          : { ...data as object, id };
        
        await saveItem(storeName, updatedData as any);
        
        await addToSyncQueue({
          type: 'update',
          storeName,
          data: updatedData,
          endpoint: url,
          method: method.toUpperCase() as 'PATCH',
        });
        
        // Update React Query cache optimistically using base URL
        const baseUrl = getBaseUrlFromUrl(url);
        updateQueryCacheOptimistically([baseUrl], 'update', updatedData);
        // Also set detail cache for the updated item
        queryClient.setQueryData([baseUrl, id], updatedData);
        
        responseData = updatedData;
      }
    } else if (method.toUpperCase() === 'DELETE' && storeName) {
      const idMatch = url.match(/\/([^\/]+)$/);
      const id = idMatch ? idMatch[1] : null;
      
      if (id) {
        await deleteItem(storeName, id);
        
        await addToSyncQueue({
          type: 'delete',
          storeName,
          data: { id },
          endpoint: url,
          method: 'DELETE',
        });
        
        // Update React Query cache optimistically using base URL
        const baseUrl = getBaseUrlFromUrl(url);
        updateQueryCacheOptimistically([baseUrl], 'delete', { id });
        // Remove from detail cache
        queryClient.removeQueries({ queryKey: [baseUrl, id] });
        
        responseData = { success: true, id };
      }
    }
    
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return apiRequest(method, url, data);
}


type UnauthorizedBehavior = "returnNull" | "throw";

// Build URL from query key segments
// Supports: ["/api/jobs"] or ["/api/jobs", { archived: true }]
function buildUrlFromQueryKey(queryKey: readonly unknown[]): string {
  const segments = [...queryKey];
  const lastSegment = segments[segments.length - 1];
  
  // Check if last segment is an object (query params)
  if (lastSegment && typeof lastSegment === 'object' && !Array.isArray(lastSegment)) {
    segments.pop();
    const basePath = segments.join("/");
    const params = new URLSearchParams();
    
    for (const [key, value] of Object.entries(lastSegment as Record<string, unknown>)) {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    }
    
    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  }
  
  return segments.join("/");
}

export const getQueryFn = <T,>(options: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> => {
  const { on401: unauthorizedBehavior } = options;
  return async ({ queryKey }) => {
    const url = buildUrlFromQueryKey(queryKey);
    
    // Detect if this is a detail query (exactly [endpoint, id]). Keys with
    // more segments (e.g. ['/api/jobs', id, 'variations']) are SUB-RESOURCE
    // LIST queries — returning a single cached job object for those crashes
    // callers that expect an array (".filter is not a function").
    const isDetailQuery = queryKey.length === 2 && 
      typeof queryKey[1] === 'string' && 
      !queryKey[1].startsWith('/');
    // Sub-resource lists have no offline store of their own — fall back to [].
    const isSubResourceQuery = queryKey.length > 2 &&
      typeof queryKey[1] === 'string' &&
      !queryKey[1].startsWith('/');
    
    if (!checkOnline()) {
      const storeName = getStoreNameFromEndpoint(queryKey[0] as string);
      
      if (isSubResourceQuery) {
        return [] as T;
      }
      if (isDetailQuery && storeName) {
        // Detail query - try to get single item, return null if not found
        const item = await getItemFromEndpoint(queryKey[0] as string, queryKey[1] as string);
        return (item || null) as T;
      }
      
      // List query - return array
      if (storeName) {
        const cached = await getAllItems(storeName);
        return (cached || []) as T;
      }
      return [] as T;
    }

    try {
      const res = await fetch(url, {
        credentials: "include",
        headers: buildHeaders(false),
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      const data = await res.json();
      
      await cacheApiResponse(url, data);
      
      return data;
    } catch (error) {
      if (!checkOnline() || (error instanceof Error && error.message.includes('Failed to fetch'))) {
        const storeName = getStoreNameFromEndpoint(queryKey[0] as string);
        
        if (isSubResourceQuery) {
          return [] as T;
        }
        if (isDetailQuery && storeName) {
          // Detail query - try to get single item, return null if not found
          const item = await getItemFromEndpoint(queryKey[0] as string, queryKey[1] as string);
          return (item || null) as T;
        }
        
        // List query - return array
        if (storeName) {
          const cached = await getAllItems(storeName);
          return (cached || []) as T;
        }
        return [] as T;
      }
      throw error;
    }
  };
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      networkMode: 'offlineFirst',
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error) => {
        if (!checkOnline()) return false;
        if (failureCount >= 1) return false;
        const errorMsg = error?.message || '';
        if (errorMsg.includes('session_expired')) return false;
        if (errorMsg.includes('500') || errorMsg.includes('502') || errorMsg.includes('503')) return true;
        if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Network')) return true;
        return false;
      },
      retryDelay: 1000,
      placeholderData: (previousData: any) => previousData,
      gcTime: 30 * 60 * 1000,
    },
    mutations: {
      retry: false,
      networkMode: 'offlineFirst',
    },
  },
});

export function updateQueryCacheOptimistically(
  queryKey: string[],
  operation: 'create' | 'update' | 'delete',
  data: any
) {
  if (operation === 'create') {
    queryClient.setQueryData(queryKey, (old: any[] | undefined) => 
      old ? [...old, data] : [data]
    );
  } else if (operation === 'update') {
    queryClient.setQueryData(queryKey, (old: any[] | undefined) => 
      old?.map(item => item.id === data.id ? { ...item, ...data } : item)
    );
  } else if (operation === 'delete') {
    queryClient.setQueryData(queryKey, (old: any[] | undefined) => 
      old?.filter(item => item.id !== data.id)
    );
  }
}

/**
 * Safely invalidate queries only when online.
 * Mutations shouldn't invalidate queries when offline as they'll fail.
 * Use this wrapper instead of calling queryClient.invalidateQueries directly.
 */
export async function safeInvalidateQueries(options: Parameters<typeof queryClient.invalidateQueries>[0]) {
  if (navigator.onLine) {
    await queryClient.invalidateQueries(options);
  }
}

/**
 * Initialize the SyncManager to handle background sync operations.
 * This sets up listeners for online/offline events and processes
 * the sync queue when coming back online.
 */
export function initializeSyncManager(): void {
  syncManager.initialize();

  syncManager.on('syncComplete', (result) => {
    if (result.completed > 0) {
      console.log(`Sync complete: ${result.completed} operations synced`);
    }
  });

  syncManager.on('syncError', (error) => {
    console.error('Sync error:', error);
  });

  syncManager.on('conflict', (conflict) => {
    console.warn('Sync conflict detected:', conflict.storeName, conflict.localVersion?.id);
  });
}

/**
 * Trigger a manual sync of pending operations.
 * Returns a promise that resolves when sync is complete.
 */
export async function triggerManualSync(): Promise<void> {
  return syncManager.triggerSync();
}

/**
 * Get the current sync status and progress.
 */
export function getSyncStatus() {
  return {
    isOnline: syncManager.isNetworkOnline(),
    isSyncing: syncManager.isSyncInProgress(),
    progress: syncManager.getProgress(),
    errors: syncManager.getErrors(),
    conflicts: syncManager.getConflicts(),
  };
}

/**
 * Get the number of pending sync operations.
 */
export async function getPendingSyncCount(): Promise<number> {
  return syncManager.getPendingCount();
}

/**
 * Subscribe to sync events.
 * Returns an unsubscribe function.
 */
export function onSyncEvent(
  event: 'syncStart' | 'syncComplete' | 'syncError' | 'syncProgress' | 'online' | 'offline' | 'conflict',
  callback: (data?: any) => void
): () => void {
  return syncManager.on(event, callback);
}

/**
 * Resolve a sync conflict by choosing local or server version.
 */
export async function resolveSyncConflict(conflictId: string, useLocal: boolean): Promise<void> {
  return syncManager.resolveConflict(conflictId, useLocal);
}

/**
 * Get ID mapping for offline IDs that have been synced.
 */
export function getResolvedId(offlineId: string): string | number | undefined {
  return syncManager.getIdMapping(offlineId);
}

if (typeof window !== 'undefined') {
  initializeSyncManager();
}
