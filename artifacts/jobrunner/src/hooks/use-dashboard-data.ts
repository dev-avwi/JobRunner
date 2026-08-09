import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getSessionToken, queryClient as appQueryClient } from "@/lib/queryClient";

interface DashboardKPIs {
  jobsToday: number;
  unpaidInvoicesTotal: number;
  unpaidInvoicesCount: number;
  quotesAwaiting: number;
  monthlyEarnings: number;
  weeklyEarnings: number;
  jobsToInvoice: number;
  activeJobs: number;
}

interface RecentActivity {
  id: number;
  action: string;
  time: string;
  type: "success" | "info" | "warning";
}

type SectionError = { error: string };
type Section<T> = T | SectionError;

export interface UnifiedDashboard {
  user: Section<any>;
  businessSettings: Section<any>;
  kpis: Section<DashboardKPIs>;
  jobsToday: Section<any[]>;
  teamPresence: Section<any[]>;
  unassignedJobs: Section<any[]>;
  allJobs: Section<any[]>;
  activityFeed: Section<any[]>;
  integrationsHealth: Section<any>;
  integrationsHealthFull: Section<any>;
  subscriptionUsage: Section<any>;
  cashflow: Section<any>;
  profitSnapshot: Section<any>;
  actionCenter: Section<any>;
  teamMyRole: Section<any>;
  teamMembers: Section<any[]>;
  myJobs: Section<any[]>;
  availableJobs: Section<any[]>;
  activeTimeEntry: Section<any>;
  timeTrackingDashboard: Section<any>;
}

export const UNIFIED_DASHBOARD_QUERY_KEY = ["/api/dashboard/unified"] as const;

export function isSectionError<T>(v: Section<T> | undefined | null): v is SectionError {
  return !!v && typeof v === "object" && "error" in (v as any);
}

export function unwrapSection<T>(v: Section<T> | undefined | null, fallback: T): T {
  if (v == null || isSectionError(v)) return fallback;
  return v as T;
}

/**
 * Keys hydrated from the unified response. We register a non-zero
 * staleTime via setQueryDefaults so child useQuery() consumers with
 * default staleTime don't refetch on mount despite the cache being
 * populated. (React Query treats data as fresh when
 * `now - dataUpdatedAt < staleTime`.)
 */
const HYDRATED_QUERY_KEY_PREFIXES: unknown[][] = [
  ["/api/auth/me"],
  ["/api/business-settings"],
  ["/api/team/my-role"],
  ["/api/team/members"],
  ["/api/dashboard/kpis"],
  ["/api/jobs/today"],
  ["/api/team/presence"],
  ["/api/jobs"],
  ["/api/activity-feed"],
  ["/api/subscription/usage"],
  ["/api/integrations/health"],
  ["/api/dashboard/cashflow"],
  ["/api/dashboard/profit-snapshot"],
  ["/api/bi/action-center"],
  ["/api/jobs/my-jobs"],
  ["/api/jobs/available"],
  ["/api/time-entries/active/current"],
  ["/api/time-tracking/dashboard"],
];

let _defaultsRegistered = false;
function ensureQueryDefaults(qc: QueryClient) {
  if (_defaultsRegistered) return;
  _defaultsRegistered = true;
  for (const key of HYDRATED_QUERY_KEY_PREFIXES) {
    qc.setQueryDefaults(key, { staleTime: 60 * 1000 });
  }
}

// Register defaults at module load against the app's shared queryClient so
// that even queries mounted before useDashboardUnified runs (e.g. App-level)
// pick up the non-stale-on-mount semantics.
ensureQueryDefaults(appQueryClient);

/**
 * Hydrate per-section query caches from a unified response so legacy
 * useQuery consumers read from cache and never fire their own network
 * request on cold start.
 */
function hydrateSubCaches(qc: QueryClient, d: UnifiedDashboard) {
  const set = (key: unknown[], section: any) => {
    if (section && !isSectionError(section)) {
      qc.setQueryData(key, section);
    }
  };
  set(["/api/auth/me"], d.user);
  set(["/api/business-settings"], d.businessSettings);
  set(["/api/dashboard/kpis"], d.kpis);
  set(["/api/jobs/today"], d.jobsToday);
  set(["/api/team/presence"], d.teamPresence);
  set(["/api/jobs"], d.allJobs);
  set(["/api/jobs", { filter: "unassigned" }], d.unassignedJobs);
  set(["/api/activity-feed", { limit: 5 }], d.activityFeed);
  set(["/api/subscription/usage"], d.subscriptionUsage);
  set(["/api/integrations/health"], d.integrationsHealthFull);
  set(["/api/dashboard/cashflow"], d.cashflow);
  set(["/api/dashboard/profit-snapshot"], d.profitSnapshot);
  set(["/api/bi/action-center"], d.actionCenter);
  set(["/api/team/my-role"], d.teamMyRole);
  set(["/api/team/members"], d.teamMembers);
  set(["/api/jobs/my-jobs"], d.myJobs);
  set(["/api/jobs/available"], d.availableJobs);
  set(["/api/time-entries/active/current"], d.activeTimeEntry);
  set(["/api/time-tracking/dashboard"], d.timeTrackingDashboard);
}

/**
 * Single aggregate dashboard fetch — collapses cold-start fan-out
 * (formerly ~15 independent calls fired by Dashboard + role hooks +
 * owner/staff/activity child components) into one request.
 *
 * Hydration runs INSIDE the `queryFn` (synchronously, before resolution)
 * so that by the time the unified query's `data` becomes truthy and the
 * Dashboard re-renders, every sub-cache is already populated. Children
 * gated behind `data` mount with cache hits and never fire the legacy
 * endpoints on cold start. Combined with `setQueryDefaults` above, even
 * sub-queries with default staleTime treat the hydrated data as fresh.
 */
export function useDashboardUnified() {
  const queryClient = useQueryClient();
  ensureQueryDefaults(queryClient);
  const query = useQuery<UnifiedDashboard>({
    queryKey: UNIFIED_DASHBOARD_QUERY_KEY,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const token = getSessionToken();
      const res = await fetch("/api/dashboard/unified", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`Unified dashboard failed: ${res.status}`);
      const data = (await res.json()) as UnifiedDashboard;
      hydrateSubCaches(queryClient, data);
      return data;
    },
  });

  return query;
}

export function useDashboardKPIs() {
  return useQuery<DashboardKPIs>({
    queryKey: ["/api/dashboard/kpis"],
    staleTime: 5 * 60 * 1000,
  });
}

export function useTodaysJobs() {
  return useQuery<any[]>({
    queryKey: ["/api/jobs/today"],
    staleTime: 2 * 60 * 1000,
  });
}

export function useRecentActivity() {
  return useQuery<RecentActivity[]>({
    queryKey: ["/api/dashboard/activity"],
    staleTime: 5 * 60 * 1000,
  });
}
