import { useUserRole } from "../hooks/use-user-role";

export type Action =
  | "job.create"
  | "job.edit"
  | "job.delete"
  | "job.assign"
  | "job.changeStatus"
  | "job.complete"
  | "client.create"
  | "client.edit"
  | "client.delete"
  | "quote.create"
  | "quote.edit"
  | "quote.delete"
  | "quote.send"
  | "invoice.create"
  | "invoice.edit"
  | "invoice.delete"
  | "invoice.send"
  | "payment.collect"
  | "team.manage"
  | "reports.view"
  | "settings.manage"
  | "billing.manage";

export interface RecordContext {
  assignedToUserId?: string | null;
  assignedUserIds?: string[] | null;
  locked?: boolean | null;
}

function isAssigned(record: RecordContext | undefined, userId?: string | null): boolean {
  if (!record || !userId) return false;
  if (record.assignedToUserId === userId) return true;
  if (record.assignedUserIds?.includes(userId)) return true;
  return false;
}

/**
 * Unified `can(action, record?)` helper for the mobile app, sourced from the
 * same backend permission map as the web `useCan()` helper.
 */
export function useCan() {
  const r = useUserRole();
  const userId: string | undefined = undefined;

  const can = (action: Action, record?: RecordContext): boolean => {
    const isOwnerLike = r.isOwner;

    if (record?.locked && !isOwnerLike) {
      if (action === "invoice.edit" || action === "invoice.delete") return false;
    }

    switch (action) {
      case "job.create": return r.canCreateJobs;
      case "job.edit": return r.canEditJobs;
      case "job.delete": return r.canDeleteJobs;
      case "job.assign": return r.canAssignJobs;
      case "job.changeStatus":
      case "job.complete":
        if (isAssigned(record, userId)) return true;
        return r.canEditJobs;

      case "client.create": return r.canCreateClients;
      case "client.edit": return r.canEditClients;
      case "client.delete": return r.canDeleteClients;

      case "quote.create": return r.canCreateQuotes;
      case "quote.edit": return r.canEditQuotes;
      case "quote.delete": return r.canDeleteQuotes;
      case "quote.send": return r.canSendQuotes;

      case "invoice.create": return r.canCreateInvoices;
      case "invoice.edit": return r.canEditInvoices;
      case "invoice.delete": return r.canDeleteInvoices;
      case "invoice.send": return r.canSendInvoices;

      case "payment.collect": return r.canCollectPayments;
      case "team.manage": return r.canManageTeam;
      case "reports.view": return r.canAccessReports;
      case "settings.manage": return r.canAccessSettings;
      case "billing.manage": return r.canAccessBilling;

      default:
        return false;
    }
  };

  return { can, role: r.role, isLoading: r.isLoading };
}
