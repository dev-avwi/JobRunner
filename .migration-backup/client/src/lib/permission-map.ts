import { WORKER_PERMISSIONS } from "@shared/schema";
import { type ActionPermissions } from "./permissions";

type ActionPermissionKey = keyof ActionPermissions;

interface PermissionMapping {
  workerKey: string;
}

export const ACTION_TO_WORKER_MAP: Partial<Record<ActionPermissionKey, PermissionMapping>> = {
  canCreateClients: { workerKey: WORKER_PERMISSIONS.CREATE_CLIENTS },
  canEditClients: { workerKey: WORKER_PERMISSIONS.EDIT_CLIENTS },
  canCreateQuotes: { workerKey: WORKER_PERMISSIONS.CREATE_QUOTES },
  canEditQuotes: { workerKey: WORKER_PERMISSIONS.EDIT_DOCUMENTS },
  canSendQuotes: { workerKey: WORKER_PERMISSIONS.SEND_QUOTES },
  canCreateInvoices: { workerKey: WORKER_PERMISSIONS.CREATE_INVOICES },
  canEditInvoices: { workerKey: WORKER_PERMISSIONS.EDIT_DOCUMENTS },
  canSendInvoices: { workerKey: WORKER_PERMISSIONS.SEND_INVOICES },
  canViewAllJobs: { workerKey: WORKER_PERMISSIONS.VIEW_ALL_JOBS },
  canEditJobs: { workerKey: WORKER_PERMISSIONS.EDIT_JOBS },
};

export function mergeWithCustomPermissions(
  roleBasedPermissions: ActionPermissions,
  hasPermission: (key: string) => boolean,
  hasCustomPermissions: boolean
): ActionPermissions {
  if (!hasCustomPermissions) {
    return roleBasedPermissions;
  }
  
  const merged = { ...roleBasedPermissions };
  
  for (const [actionKey, mapping] of Object.entries(ACTION_TO_WORKER_MAP)) {
    const key = actionKey as ActionPermissionKey;
    if (mapping) {
      merged[key] = hasPermission(mapping.workerKey);
    }
  }
  
  return merged;
}
