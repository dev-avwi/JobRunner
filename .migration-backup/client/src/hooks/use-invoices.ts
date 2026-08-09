import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, offlineAwareApiRequest, safeInvalidateQueries, getSessionToken, queryClient } from "@/lib/queryClient";
import { useMemo } from "react";
import { partitionByRecent } from "@shared/dateUtils";
import { trackEvent } from "@/lib/analytics";
import { celebrate } from "@/lib/celebrate";

async function applyOptimisticInvoiceStatus(id: string, status: string) {
  await queryClient.cancelQueries({ queryKey: ["/api/invoices"] });
  const snapshots = queryClient.getQueriesData<any>({ queryKey: ["/api/invoices"] });
  for (const [key, value] of snapshots) {
    if (Array.isArray(value)) {
      queryClient.setQueryData(key, value.map((inv: any) => inv?.id === id ? { ...inv, status } : inv));
    } else if (value && typeof value === 'object' && (value as any).id === id) {
      queryClient.setQueryData(key, { ...(value as any), status });
    }
  }
  return snapshots;
}

function rollbackInvoiceSnapshots(snapshots: ReturnType<typeof queryClient.getQueriesData<any>>) {
  for (const [key, value] of snapshots) {
    queryClient.setQueryData(key, value);
  }
}

export function useInvoices(options?: { archived?: boolean }) {
  const archived = options?.archived ?? false;
  return useQuery({
    queryKey: archived ? ["/api/invoices", { archived: true }] : ["/api/invoices"],
  });
}

export function useArchiveInvoice() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/invoices/${id}/archive`);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ["/api/invoices"] });
      safeInvalidateQueries({ queryKey: ["/api/invoices", { archived: true }] });
    },
  });
}

export function useUnarchiveInvoice() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/invoices/${id}/unarchive`);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ["/api/invoices"] });
      safeInvalidateQueries({ queryKey: ["/api/invoices", { archived: true }] });
    },
  });
}

export function useRecentInvoices() {
  const { data: invoices = [], ...rest } = useInvoices();
  
  const partitioned = useMemo(() => {
    // Ensure invoices is an array with proper typing
    const invoicesArray = Array.isArray(invoices) ? invoices as any[] : [];
    return partitionByRecent(invoicesArray, 'createdAt');
  }, [invoices]);
  
  return {
    ...rest,
    data: invoices, // Keep original data for compatibility
    recent: partitioned.recent,
    older: partitioned.older,
  };
}

export function useCreateInvoice() {
  return useMutation({
    mutationFn: async (invoiceData: any) => {
      // Use offline-aware request when offline
      if (!navigator.onLine) {
        const response = await offlineAwareApiRequest("POST", "/api/invoices", invoiceData);
        return response.json();
      }
      
      const response = await apiRequest("POST", "/api/invoices", invoiceData);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ["/api/invoices"] });
    },
  });
}

export function useSendInvoice() {
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      // Always use skipEmail: true - user will send via Gmail themselves
      const response = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ skipEmail: true })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to mark invoice as sent');
      }
      return response.json();
    },
    onMutate: async (invoiceId: string) => ({ snapshots: await applyOptimisticInvoiceStatus(invoiceId, 'sent') }),
    onError: (_err, _id, ctx: any) => { if (ctx?.snapshots) rollbackInvoiceSnapshots(ctx.snapshots); },
    onSettled: () => {
      safeInvalidateQueries({ queryKey: ["/api/invoices"] });
    },
    onSuccess: () => {
      trackEvent('invoice_sent');
    },
  });
}

export function useCreatePaymentLink() {
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await apiRequest("POST", `/api/invoices/${invoiceId}/create-checkout-session`);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ["/api/invoices"] });
    },
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ["/api/invoices", id],
    enabled: !!id,
  });
}

export function useInvoiceWithDetails(id: string) {
  return useQuery({
    queryKey: ["/api/invoices", id],
    enabled: !!id,
  });
}

export function useMarkInvoicePaid() {
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await apiRequest("POST", `/api/invoices/${invoiceId}/mark-paid`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to mark invoice as paid');
      }
      return response.json();
    },
    onMutate: async (invoiceId: string) => ({ snapshots: await applyOptimisticInvoiceStatus(invoiceId, 'paid') }),
    onError: (_err, _id, ctx: any) => { if (ctx?.snapshots) rollbackInvoiceSnapshots(ctx.snapshots); },
    onSettled: () => {
      safeInvalidateQueries({ queryKey: ["/api/invoices"] });
    },
    onSuccess: () => {
      trackEvent('invoice_paid');
      celebrate('invoice_paid');
    },
  });
}

export interface RecordPaymentData {
  invoiceId: string;
  amount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'cheque' | 'card' | 'other';
  reference?: string;
  notes?: string;
}

export function useRecordPayment() {
  return useMutation({
    mutationFn: async (data: RecordPaymentData) => {
      const response = await apiRequest("POST", `/api/invoices/${data.invoiceId}/record-payment`, {
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        reference: data.reference,
        notes: data.notes,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to record payment');
      }
      return response.json();
    },
    onSuccess: (data: any, variables: RecordPaymentData) => {
      safeInvalidateQueries({ queryKey: ["/api/invoices"] });
      safeInvalidateQueries({ queryKey: ["/api/invoices", variables.invoiceId, "payments"] });
      trackEvent('payment_received');
      // Only celebrate when the payment actually clears the invoice.
      const status = data?.invoice?.status ?? data?.status;
      if (status === 'paid') {
        celebrate('invoice_paid');
      }
    },
  });
}

export function usePaymentRecords(invoiceId: string) {
  return useQuery({
    queryKey: ["/api/invoices", invoiceId, "payments"],
    queryFn: async () => {
      const headers: HeadersInit = {};
      const token = getSessionToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(`/api/invoices/${invoiceId}/payments`, {
        credentials: 'include',
        headers,
      });
      if (!response.ok) throw new Error('Failed to fetch payment records');
      return response.json();
    },
    enabled: !!invoiceId,
  });
}

export function useVoidPayment() {
  return useMutation({
    mutationFn: async ({ invoiceId, paymentId }: { invoiceId: string; paymentId: string }) => {
      const response = await apiRequest("DELETE", `/api/invoices/${invoiceId}/payments/${paymentId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to void payment');
      }
      return response.json();
    },
    onSuccess: (_data: any, variables: { invoiceId: string; paymentId: string }) => {
      safeInvalidateQueries({ queryKey: ["/api/invoices"] });
      safeInvalidateQueries({ queryKey: ["/api/invoices", variables.invoiceId] });
      safeInvalidateQueries({ queryKey: ["/api/invoices", variables.invoiceId, "payments"] });
    },
  });
}

export function useUpdateMilestones() {
  return useMutation({
    mutationFn: async ({ invoiceId, milestones, retentionPercent }: { invoiceId: string; milestones?: any[]; retentionPercent?: number }) => {
      const response = await apiRequest("PATCH", `/api/invoices/${invoiceId}/milestones`, {
        milestones,
        retentionPercent,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update milestones');
      }
      return response.json();
    },
    onSuccess: (_data: any, variables: { invoiceId: string; milestones?: any[]; retentionPercent?: number }) => {
      safeInvalidateQueries({ queryKey: ["/api/invoices"] });
      safeInvalidateQueries({ queryKey: ["/api/invoices", variables.invoiceId] });
    },
  });
}

export function useCloneInvoice() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/invoices/${id}/clone`);
      return response.json();
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ["/api/invoices"] });
    },
  });
}

export function useUpdateInvoiceStatus() {
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/invoices/${id}/status`, { status });
      return response.json();
    },
    onMutate: async ({ id, status }) => ({ snapshots: await applyOptimisticInvoiceStatus(id, status) }),
    onError: (_err, _vars, ctx: any) => { if (ctx?.snapshots) rollbackInvoiceSnapshots(ctx.snapshots); },
    onSettled: (_data, _err, vars) => {
      safeInvalidateQueries({ queryKey: ["/api/invoices"] });
      safeInvalidateQueries({ queryKey: ["/api/invoices", vars.id] });
    },
  });
}

export function useDeleteInvoice() {
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/invoices/${id}`);
      return { success: true };
    },
    onSuccess: () => {
      safeInvalidateQueries({ queryKey: ["/api/invoices"] });
      safeInvalidateQueries({ queryKey: ["/api/invoices", { archived: true }] });
    },
  });
}