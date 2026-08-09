import { useAuthStore } from '../lib/store';

export const WORKER_PERMISSION_KEYS = {
  COLLECT_PAYMENTS: 'collect_payments',
  CREATE_QUOTES: 'create_quotes',
  CREATE_INVOICES: 'create_invoices',
  VIEW_INVOICES: 'view_invoices',
  VIEW_QUOTES: 'view_quotes',
} as const;

export function useWorkerPermission() {
  const { workerPermissions, isWorker, hasWorkerPermission, isOwner } = useAuthStore();
  
  return {
    workerPermissions,
    isWorker,
    hasWorkerPermission,
    
    canCollectPayments: hasWorkerPermission(WORKER_PERMISSION_KEYS.COLLECT_PAYMENTS),
    canCreateQuotes: hasWorkerPermission(WORKER_PERMISSION_KEYS.CREATE_QUOTES),
    canCreateInvoices: hasWorkerPermission(WORKER_PERMISSION_KEYS.CREATE_INVOICES),
    canViewInvoices: hasWorkerPermission(WORKER_PERMISSION_KEYS.VIEW_INVOICES),
    canViewQuotes: hasWorkerPermission(WORKER_PERMISSION_KEYS.VIEW_QUOTES),
    canViewDocuments: hasWorkerPermission(WORKER_PERMISSION_KEYS.VIEW_INVOICES) || 
                       hasWorkerPermission(WORKER_PERMISSION_KEYS.VIEW_QUOTES),
    isOwner: isOwner(),
  };
}
