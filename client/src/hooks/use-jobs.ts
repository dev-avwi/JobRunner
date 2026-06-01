import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, offlineAwareApiRequest, safeInvalidateQueries, queryClient } from "@/lib/queryClient";
import { useMemo, useCallback, useRef } from "react";
import { partitionByRecent } from "@shared/dateUtils";
import { useToast } from "@/hooks/use-toast";
import { UsageCounts } from "./use-subscription";
import { trackEvent } from "@/lib/analytics";
import { celebrate } from "@/lib/celebrate";

export interface SubscriptionLimitError {
  error: string;
  type: 'SUBSCRIPTION_LIMIT';
  usageInfo: UsageCounts;
}

// Next Action types
export interface NextAction {
  action: string;
  priority: 'high' | 'medium' | 'low';
  actionType: string;
  reason: string;
}

export function useJobs(options?: { archived?: boolean }) {
  const archived = options?.archived ?? false;
  return useQuery({
    queryKey: archived ? ["/api/jobs", { archived: true }] : ["/api/jobs"],
  });
}

export function useArchiveJob() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/jobs/${id}/archive`);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ["/api/jobs"] });
      safeInvalidateQueries({ queryKey: ["/api/jobs", { archived: true }] });
    },
  });
}

export function useUnarchiveJob() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/jobs/${id}/unarchive`);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ["/api/jobs"] });
      safeInvalidateQueries({ queryKey: ["/api/jobs", { archived: true }] });
    },
  });
}

// Fetch next actions for all jobs (batch)
export function useJobNextActions() {
  const query = useQuery<Record<string, NextAction>>({
    queryKey: ["/api/jobs/next-actions"],
    staleTime: 5 * 60 * 1000, // 5 minutes - next actions don't change that frequently
  });
  
  return {
    ...query,
    data: query.data ?? {},
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useRecentJobs() {
  const { data: jobs = [], ...rest } = useJobs();
  
  const partitioned = useMemo(() => {
    // Ensure jobs is an array with proper typing
    const jobsArray = Array.isArray(jobs) ? jobs as any[] : [];
    return partitionByRecent(jobsArray, 'createdAt');
  }, [jobs]);
  
  return {
    ...rest,
    data: jobs, // Keep original data for compatibility
    recent: partitioned.recent,
    older: partitioned.older,
  };
}

export function useCreateJob() {
  const { toast } = useToast();

  return useMutation<any, Error, any>({
    mutationFn: async (jobData: any) => {
      // Use offline-aware request when offline
      if (!navigator.onLine) {
        const response = await offlineAwareApiRequest("POST", "/api/jobs", jobData);
        return response.json();
      }
      
      const response = await apiRequest("POST", "/api/jobs", jobData);
      
      // Handle subscription limit errors (402 status)
      if (response.status === 402) {
        const errorData = await response.json();
        const error = new Error(errorData.error) as Error & { subscriptionError: SubscriptionLimitError };
        error.subscriptionError = errorData;
        throw error;
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create job');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidate job-related queries
      safeInvalidateQueries({ queryKey: ["/api/jobs"] });
      safeInvalidateQueries({ queryKey: ["/api/jobs/today"] });
      safeInvalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      safeInvalidateQueries({ queryKey: ["/api/jobs/next-actions"] });
      safeInvalidateQueries({ queryKey: ["/api/dashboard/unified"] });
      
      // Invalidate subscription usage to update job counts
      safeInvalidateQueries({ queryKey: ["/api/subscription/usage"] });
      
      trackEvent('job_created', { source: 'web' });
      
      toast({
        title: "Job Created",
        description: "Your job has been created successfully.",
      });
    },
    onError: (error: any) => {
      // Handle subscription limit errors specially
      if (error.subscriptionError?.type === 'SUBSCRIPTION_LIMIT') {
        // Don't show toast for subscription errors - let the component handle it
        return;
      }
      
      // Show toast for other errors
      toast({
        title: "Error",
        description: error.message || "Failed to create job. Please try again.",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateJob() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PATCH", `/api/jobs/${id}`, data);
      return response.json();
    },
    onSuccess: (_data, variables) => {
      safeInvalidateQueries({ queryKey: ["/api/jobs"] });
      safeInvalidateQueries({ queryKey: ["/api/jobs/today"] });
      safeInvalidateQueries({ queryKey: ["/api/jobs/my-jobs"] });
      safeInvalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      // Refresh next actions when job status changes
      safeInvalidateQueries({ queryKey: ["/api/jobs/next-actions"] });
      safeInvalidateQueries({ queryKey: ["/api/dashboard/unified"] });
      // Celebrate when a job is marked complete
      if (variables?.data?.status === 'done') {
        celebrate('job_completed');
      }
    },
  });
}

// Assign a job to a team member
export function useAssignJob() {
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ jobId, assignedTo }: { jobId: string; assignedTo: string | null }) => {
      const response = await apiRequest("PATCH", `/api/jobs/${jobId}`, { assignedTo });
      return response.json();
    },
    onSuccess: (_data, { assignedTo }) => {
      // Invalidate all job-related queries for proper sync
      safeInvalidateQueries({ queryKey: ["/api/jobs"] });
      safeInvalidateQueries({ queryKey: ["/api/jobs/today"] });
      safeInvalidateQueries({ queryKey: ["/api/jobs/my-jobs"] });
      safeInvalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      safeInvalidateQueries({ queryKey: ["/api/jobs/next-actions"] });
      safeInvalidateQueries({ queryKey: ["/api/dashboard/unified"] });
      
      toast({
        title: assignedTo ? "Job Assigned" : "Job Unassigned",
        description: assignedTo 
          ? "Job has been assigned to team member" 
          : "Team member has been removed from this job",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update job assignment",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteJob() {
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/jobs/${id}`);
      return { success: true };
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ["/api/jobs"] });
      safeInvalidateQueries({ queryKey: ["/api/jobs", { archived: true }] });
      safeInvalidateQueries({ queryKey: ["/api/jobs/today"] });
      safeInvalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      safeInvalidateQueries({ queryKey: ["/api/dashboard/unified"] });
    },
  });
}

const prefetchedJobs = new Set<string>();

export function prefetchJobDetail(jobId: string) {
  if (prefetchedJobs.has(jobId)) return;
  prefetchedJobs.add(jobId);
  
  setTimeout(() => prefetchedJobs.delete(jobId), 60000);
  
  queryClient.prefetchQuery({
    queryKey: ['/api/jobs', jobId],
    staleTime: Infinity,
  });
  queryClient.prefetchQuery({
    queryKey: ['/api/jobs', jobId, 'linked-documents'],
    staleTime: 30000,
  });
  queryClient.prefetchQuery({
    queryKey: ['/api/jobs', jobId, 'materials'],
    staleTime: Infinity,
  });
  queryClient.prefetchQuery({
    queryKey: ['/api/jobs', jobId, 'photos'],
    staleTime: Infinity,
  });
  queryClient.prefetchQuery({
    queryKey: ['/api/jobs', jobId, 'notes'],
    staleTime: Infinity,
  });
}

export function seedJobCacheFromList(jobs: any[]) {
  if (!Array.isArray(jobs)) return;
  for (const job of jobs) {
    if (job && job.id) {
      const existing = queryClient.getQueryData(['/api/jobs', job.id]);
      if (!existing) {
        queryClient.setQueryData(['/api/jobs', job.id], job);
      }
      if (job.clientId) {
        const clientData = queryClient.getQueryData(['/api/clients', job.clientId]);
        if (!clientData && job.clientName) {
          queryClient.setQueryData(['/api/clients', job.clientId], {
            id: job.clientId,
            name: job.clientName,
            email: job.clientEmail,
            phone: job.clientPhone,
            address: job.address,
          });
        }
      }
    }
  }
}

export function usePrefetchJob() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  
  const onHover = useCallback((jobId: string) => {
    timerRef.current = setTimeout(() => {
      prefetchJobDetail(jobId);
    }, 100);
  }, []);
  
  const onLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);
  
  return { onHover, onLeave };
}