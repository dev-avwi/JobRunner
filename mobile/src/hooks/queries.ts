/**
 * Central react-query hooks for server reads.
 *
 * The ApiClient returns `{ data, error }` instead of throwing; react-query
 * needs throws to drive its error/retry machinery, so apiQueryFn adapts one
 * to the other. Query keys live in `queryKeys` so invalidations stay typo-safe.
 *
 * Screen-level polling: pass `refetchInterval` gated on `useIsFocused()` so
 * unfocused tabs stop polling (focusManager only pauses on app background).
 */
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export class ApiQueryError extends Error {
  isOffline: boolean;
  constructor(message: string, isOffline?: boolean) {
    super(message);
    this.isOffline = !!isOffline;
  }
}

export async function apiQueryFn<T>(path: string): Promise<T> {
  const res = await api.get<T>(path);
  if (res.error) throw new ApiQueryError(res.error, res.isOffline);
  return res.data as T;
}

export const queryKeys = {
  dashboard: ['time-tracking', 'dashboard'] as const,
  todaysJobs: ['jobs', 'today'] as const,
  teamTimers: ['time-entries', 'active-team'] as const,
  jobs: ['jobs'] as const,
};

// These three back a live dashboard widget (running timer, today's jobs,
// who's-clocked-in). A short staleTime — well under the global 5 min default
// — keeps them eligible for react-query's refetch-on-refocus, so returning
// to the app foreground refreshes them immediately rather than waiting out
// the global staleTime.
export function useDashboardQuery(options?: { enabled?: boolean; refetchInterval?: number | false }) {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => apiQueryFn<any>('/api/time-tracking/dashboard'),
    staleTime: 10_000,
    ...options,
  });
}

export function useTodaysJobsQuery(options?: { enabled?: boolean; refetchInterval?: number | false }) {
  return useQuery({
    queryKey: queryKeys.todaysJobs,
    queryFn: () => apiQueryFn<any[]>('/api/jobs/today'),
    staleTime: 10_000,
    ...options,
  });
}

export function useTeamTimersQuery(options?: { enabled?: boolean; refetchInterval?: number | false }) {
  return useQuery({
    queryKey: queryKeys.teamTimers,
    queryFn: () => apiQueryFn<any[]>('/api/time-entries/active/team'),
    staleTime: 20_000,
    ...options,
  });
}

export function useJobsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.jobs,
    queryFn: () => apiQueryFn<any[]>('/api/jobs'),
    ...options,
  });
}

/** Per-job task-cost rollup (estimated/actual hours + material cost per task). */
export function useJobTasksQuery<T = any>(jobId: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['jobs', jobId, 'tasks'],
    queryFn: () => apiQueryFn<T[]>(`/api/jobs/${jobId}/tasks`),
    enabled: !!jobId && (options?.enabled ?? true),
  });
}
