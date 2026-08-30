import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, offlineAwareApiRequest, safeInvalidateQueries, queryClient } from "@/lib/queryClient";
import { useMemo } from "react";
import { partitionByRecent } from "@shared/dateUtils";
import { trackEvent } from "@/lib/analytics";
import { celebrate } from "@/lib/celebrate";
import { useToast } from "@/hooks/use-toast";

// Apply an optimistic status update across every cached quote list/detail
// containing the given id, returning rollback snapshots for onError.
async function applyOptimisticQuoteStatus(id: string, status: string) {
  await queryClient.cancelQueries({ queryKey: ["/api/quotes"] });
  const snapshots = queryClient.getQueriesData<any>({ queryKey: ["/api/quotes"] });
  for (const [key, value] of snapshots) {
    if (Array.isArray(value)) {
      queryClient.setQueryData(key, value.map((q: any) => q?.id === id ? { ...q, status } : q));
    } else if (value && typeof value === 'object' && (value as any).id === id) {
      queryClient.setQueryData(key, { ...(value as any), status });
    }
  }
  return snapshots;
}

function rollbackQuoteSnapshots(snapshots: ReturnType<typeof queryClient.getQueriesData<any>>) {
  for (const [key, value] of snapshots) {
    queryClient.setQueryData(key, value);
  }
}

export function useQuotes(options?: { archived?: boolean }) {
  const archived = options?.archived ?? false;
  return useQuery({
    queryKey: archived ? ["/api/quotes", { archived: true }] : ["/api/quotes"],
  });
}

export function useArchiveQuote() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/quotes/${id}/archive`);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ["/api/quotes"] });
      safeInvalidateQueries({ queryKey: ["/api/quotes", { archived: true }] });
    },
  });
}

export function useUnarchiveQuote() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/quotes/${id}/unarchive`);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ["/api/quotes"] });
      safeInvalidateQueries({ queryKey: ["/api/quotes", { archived: true }] });
    },
  });
}

export function useRecentQuotes() {
  const { data: quotes = [], ...rest } = useQuotes();
  
  const partitioned = useMemo(() => {
    // Ensure quotes is an array with proper typing
    const quotesArray = Array.isArray(quotes) ? quotes as any[] : [];
    return partitionByRecent(quotesArray, 'createdAt');
  }, [quotes]);
  
  return {
    ...rest,
    data: quotes, // Keep original data for compatibility
    recent: partitioned.recent,
    older: partitioned.older,
  };
}

export function useCreateQuote() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (quoteData: any) => {
      // Use offline-aware request when offline
      if (!navigator.onLine) {
        const response = await offlineAwareApiRequest("POST", "/api/quotes", quoteData);
        return response.json();
      }
      
      const response = await apiRequest("POST", "/api/quotes", quoteData);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ["/api/quotes"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Failed to create quote", description: error?.message ?? "Please try again." });
    },
  });
}

export function useSendQuote() {
  return useMutation({
    mutationFn: async (quoteId: string) => {
      // Always use skipEmail: true - user will send via Gmail themselves
      const response = await fetch(`/api/quotes/${quoteId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ skipEmail: true })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to mark quote as sent');
      }
      return response.json();
    },
    onMutate: async (quoteId: string) => ({ snapshots: await applyOptimisticQuoteStatus(quoteId, 'sent') }),
    onError: (_err, _id, ctx: any) => { if (ctx?.snapshots) rollbackQuoteSnapshots(ctx.snapshots); },
    onSettled: () => {
      safeInvalidateQueries({ queryKey: ["/api/quotes"] });
    },
    onSuccess: () => {
      trackEvent('quote_sent');
    },
  });
}

export function useGenerateQuoteFromJob() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/generate-quote`);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ["/api/quotes"] });
      safeInvalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Failed to generate quote from job", description: error?.message ?? "Please try again." });
    },
  });
}

export function useQuote(id: string) {
  return useQuery({
    queryKey: ["/api/quotes", id],
    enabled: !!id,
  });
}

export function useQuoteWithDetails(id: string) {
  return useQuery({
    queryKey: ["/api/quotes", id],
    enabled: !!id,
  });
}

export function useConvertQuoteToInvoice() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (quoteId: string) => {
      const response = await apiRequest("POST", `/api/quotes/${quoteId}/convert-to-invoice`);
      return response.json();
    },
    onSuccess: (_data, quoteId) => {
      safeInvalidateQueries({ queryKey: ["/api/quotes"] });
      safeInvalidateQueries({ queryKey: ["/api/invoices"] });
      safeInvalidateQueries({ queryKey: ["/api/invoices", { quoteId }] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Failed to convert quote to invoice", description: error?.message ?? "Please try again." });
    },
  });
}

export function useCloneQuote() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/quotes/${id}/clone`);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ["/api/quotes"] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Failed to clone quote", description: error?.message ?? "Please try again." });
    },
  });
}

export function useConvertQuotePreview(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["/api/quotes", id, "convert-preview"],
    enabled: !!id && enabled,
  });
}

export function useDeclineQuote() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/quotes/${id}/reject`);
      return response.json();
    },
    onMutate: async (id: string) => ({ snapshots: await applyOptimisticQuoteStatus(id, 'declined') }),
    onError: (_err, _id, ctx: any) => {
      if (ctx?.snapshots) rollbackQuoteSnapshots(ctx.snapshots);
      toast({ variant: "destructive", title: "Failed to decline quote", description: _err?.message ?? "Please try again." });
    },
    onSettled: (_data, _err, id) => {
      safeInvalidateQueries({ queryKey: ["/api/quotes"] });
      safeInvalidateQueries({ queryKey: ["/api/quotes", id] });
    },
  });
}

export function useUpdateQuoteStatus() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/quotes/${id}`, { status });
      return response.json();
    },
    onMutate: async ({ id, status }) => ({ snapshots: await applyOptimisticQuoteStatus(id, status) }),
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.snapshots) rollbackQuoteSnapshots(ctx.snapshots);
      toast({ variant: "destructive", title: "Failed to update quote status", description: _err?.message ?? "Please try again." });
    },
    onSuccess: (_data, vars) => {
      if (vars.status === 'accepted') celebrate('quote_accepted');
    },
    onSettled: (_data, _err, vars) => {
      safeInvalidateQueries({ queryKey: ["/api/quotes"] });
      safeInvalidateQueries({ queryKey: ["/api/quotes", vars.id] });
    },
  });
}

export function useAcceptQuote() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/quotes/${id}/accept`);
      return response.json();
    },
    onMutate: async (id: string) => ({ snapshots: await applyOptimisticQuoteStatus(id, 'accepted') }),
    onError: (_err, _id, ctx: any) => {
      if (ctx?.snapshots) rollbackQuoteSnapshots(ctx.snapshots);
      toast({ variant: "destructive", title: "Failed to accept quote", description: _err?.message ?? "Please try again." });
    },
    onSuccess: () => {
      celebrate('quote_accepted');
    },
    onSettled: (_data, _err, id) => {
      safeInvalidateQueries({ queryKey: ["/api/quotes"] });
      safeInvalidateQueries({ queryKey: ["/api/quotes", id] });
    },
  });
}

export function useDeleteQuote() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/quotes/${id}`);
      return { success: true };
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ["/api/quotes"] });
      safeInvalidateQueries({ queryKey: ["/api/quotes", { archived: true }] });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Failed to delete quote", description: error?.message ?? "Please try again." });
    },
  });
}