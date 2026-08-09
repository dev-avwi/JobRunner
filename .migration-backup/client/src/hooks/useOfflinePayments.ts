import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  saveDraftPayment,
  getAllDraftPayments,
  getPendingDraftPayments,
  deleteDraftPayment,
  addToSyncQueue,
  generateOfflineId,
  isOnline,
  type DraftPayment,
} from '@/lib/offlineStorage';
import { safeInvalidateQueries } from '@/lib/queryClient';
import { useNetwork } from '@/contexts/NetworkContext';
import { syncManager } from '@/lib/syncManager';

export type PaymentMethod = 'cash' | 'eftpos' | 'bank_transfer' | 'card' | 'cheque' | 'other';

export interface RecordPaymentParams {
  invoiceId?: number;
  clientId?: number;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate?: string;
  reference?: string;
  notes?: string;
}

export interface UseOfflinePaymentsReturn {
  draftPayments: DraftPayment[];
  pendingPayments: DraftPayment[];
  isLoading: boolean;
  error: string | null;
  recordPayment: (params: RecordPaymentParams) => Promise<DraftPayment>;
  getPendingPayments: () => Promise<DraftPayment[]>;
  syncPayment: (paymentId: string | number) => Promise<boolean>;
  syncAllPayments: () => Promise<{ synced: number; failed: number }>;
  deleteDraft: (paymentId: string | number) => Promise<void>;
  refreshPayments: () => Promise<void>;
}

const PAYMENTS_QUERY_KEY = ['offline', 'payments'] as const;

export function useOfflinePayments(): UseOfflinePaymentsReturn {
  const queryClient = useQueryClient();
  const { isOnline: networkOnline } = useNetwork();

  const query = useQuery<DraftPayment[], Error>({
    queryKey: PAYMENTS_QUERY_KEY,
    queryFn: () => getAllDraftPayments(),
    staleTime: 60_000,
  });

  const draftPayments = query.data ?? [];
  const pendingPayments = draftPayments.filter(
    (p) => p.status === 'draft' || p.status === 'pending'
  );
  const error = query.error ? query.error.message : null;

  const refreshPayments = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
  }, [queryClient]);

  useEffect(() => {
    if (networkOnline && pendingPayments.length > 0) {
      syncManager.triggerSync();
    }
  }, [networkOnline, pendingPayments.length]);

  useEffect(() => {
    const unsubscribe = syncManager.on('syncComplete', () => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
    });
    return unsubscribe;
  }, [queryClient]);

  const recordPayment = useCallback(async (params: RecordPaymentParams): Promise<DraftPayment> => {
    const paymentId = generateOfflineId();
    const now = new Date().toISOString();

    const payment: DraftPayment = {
      id: paymentId,
      invoiceId: params.invoiceId,
      clientId: params.clientId,
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      paymentDate: params.paymentDate || now,
      reference: params.reference,
      notes: params.notes,
      status: 'pending',
      createdAt: now,
    };

    const savedPayment = await saveDraftPayment(payment);

    await addToSyncQueue({
      type: 'create',
      storeName: 'payments',
      data: savedPayment,
      endpoint: '/api/payments',
      method: 'POST',
    });

    queryClient.setQueryData<DraftPayment[]>(PAYMENTS_QUERY_KEY, (old) =>
      old ? [...old, savedPayment] : [savedPayment]
    );
    safeInvalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });

    if (isOnline()) {
      syncManager.triggerSync();
    }

    return savedPayment;
  }, [queryClient]);

  const getPendingPaymentsAsync = useCallback(async (): Promise<DraftPayment[]> => {
    return getPendingDraftPayments();
  }, []);

  const syncPayment = useCallback(async (_paymentId: string | number): Promise<boolean> => {
    if (!isOnline()) {
      return false;
    }

    try {
      await syncManager.triggerSync();
      await refreshPayments();
      return true;
    } catch {
      return false;
    }
  }, [refreshPayments]);

  const syncAllPayments = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    if (!isOnline()) {
      return { synced: 0, failed: 0 };
    }

    const pendingBefore = await getPendingDraftPayments();
    await syncManager.triggerSync();
    const pendingAfter = await getPendingDraftPayments();

    const synced = pendingBefore.length - pendingAfter.length;
    const failed = pendingAfter.length;

    await refreshPayments();
    return { synced: Math.max(0, synced), failed };
  }, [refreshPayments]);

  const deleteDraft = useCallback(async (paymentId: string | number): Promise<void> => {
    await deleteDraftPayment(paymentId);
    queryClient.setQueryData<DraftPayment[]>(PAYMENTS_QUERY_KEY, (old) =>
      old ? old.filter((p) => p.id !== paymentId) : []
    );
    safeInvalidateQueries({ queryKey: PAYMENTS_QUERY_KEY });
  }, [queryClient]);

  return {
    draftPayments,
    pendingPayments,
    isLoading: query.isLoading,
    error,
    recordPayment,
    getPendingPayments: getPendingPaymentsAsync,
    syncPayment,
    syncAllPayments,
    deleteDraft,
    refreshPayments,
  };
}

export default useOfflinePayments;
