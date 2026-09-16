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

export function useDashboardQuery(options?: { enabled?: boolean; refetchInterval?: number | false }) {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => apiQueryFn<any>('/api/time-tracking/dashboard'),
    ...options,
  });
}

export function useTodaysJobsQuery(options?: { enabled?: boolean; refetchInterval?: number | false }) {
  return useQuery({
    queryKey: queryKeys.todaysJobs,
    queryFn: () => apiQueryFn<any[]>('/api/jobs/today'),
    ...options,
  });
}

export function useTeamTimersQuery(options?: { enabled?: boolean; refetchInterval?: number | false }) {
  return useQuery({
    queryKey: queryKeys.teamTimers,
    queryFn: () => apiQueryFn<any[]>('/api/time-entries/active/team'),
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
