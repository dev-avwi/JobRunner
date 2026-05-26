import { useAppMode } from "@/hooks/use-app-mode";
import type { ActionPermissions, UserRole } from "@/lib/permissions";

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
  | "client.viewSensitive"
  | "quote.create"
  | "quote.edit"
  | "quote.delete"
  | "quote.send"
  | "quote.convert"
  | "invoice.create"
  | "invoice.edit"
  | "invoice.delete"
  | "invoice.send"
  | "invoice.markPaid"
  | "payment.collect"
  | "team.manage"
  | "team.invite"
  | "team.remove"
  | "settings.manage"
  | "billing.manage"
  | "templates.manage"
  | "automations.manage"
  | "integrations.manage"
  | "reports.view"
  | "map.view"
  | "dispatch.use"
  | "aiReceptionist.manage";

export interface RecordContext {
  ownerUserId?: string | null;
  assignedToUserId?: string | null;
  assignedUserIds?: string[] | null;
  status?: string | null;
  locked?: boolean | null;
}

export interface CanContext {
  permissions: ActionPermissions;
  role: UserRole;
  userId?: string | null;
  canCollectPayments: boolean;
}

function isAssignedToMe(record: RecordContext | undefined, userId?: string | null): boolean {
  if (!record || !userId) return false;
  if (record.assignedToUserId === userId) return true;
  if (record.assignedUserIds?.includes(userId)) return true;
  return false;
}

export function canDo(action: Action, ctx: CanContext, record?: RecordContext): boolean {
  const p = ctx.permissions;
  const isOwnerLike = ctx.role === "owner" || ctx.role === "solo_owner";

  // Locked records: only owner can override
  if (record?.locked && !isOwnerLike) {
    if (action.startsWith("invoice.edit") || action.startsWith("invoice.delete")) {
      return false;
    }
  }

  switch (action) {
    case "job.create": return p.canCreateJobs;
    case "job.edit": return p.canEditJobs;
    case "job.delete": return p.canDeleteJobs;
    case "job.assign": return p.canAssignJobs;
    case "job.complete":
      // Workers can complete jobs assigned to them
      if (isAssignedToMe(record, ctx.userId)) return true;
      return p.canEditJobs;
    case "job.changeStatus":
      if (isAssignedToMe(record, ctx.userId)) return true;
      return p.canEditJobs;

    case "client.create": return p.canCreateClients;
    case "client.edit": return p.canEditClients;
    case "client.delete": return p.canDeleteClients;
    case "client.viewSensitive": return isOwnerLike || ctx.role === "manager" || ctx.role === "office_admin";

    case "quote.create": return p.canCreateQuotes;
    case "quote.edit": return p.canEditQuotes;
    case "quote.delete": return p.canDeleteQuotes;
    case "quote.send": return p.canSendQuotes;
    case "quote.convert": return p.canCreateInvoices;

    case "invoice.create": return p.canCreateInvoices;
    case "invoice.edit": return p.canEditInvoices;
    case "invoice.delete": return p.canDeleteInvoices;
    case "invoice.send": return p.canSendInvoices;
    case "invoice.markPaid": return p.canEditInvoices;

    case "payment.collect": return ctx.canCollectPayments;

    case "team.manage": return p.canManageTeam;
    case "team.invite": return p.canInviteTeam;
    case "team.remove": return p.canRemoveTeam;

    case "settings.manage": return p.canManageSettings;
    case "billing.manage": return p.canManageBilling;
    case "templates.manage": return p.canManageTemplates;
    case "automations.manage": return p.canManageAutomations;
    case "integrations.manage": return p.canManageIntegrations;
    case "reports.view": return p.canViewReports;
    case "map.view": return p.canViewMap;
    case "dispatch.use": return p.canUseDispatch;
    case "aiReceptionist.manage": return isOwnerLike || ctx.role === "office_admin";

    default:
      return false;
  }
}

export function useCan() {
  const { actionPermissions, userRole, canCollectPayments } = useAppMode();
  const can = (action: Action, record?: RecordContext): boolean =>
    canDo(action, {
      permissions: actionPermissions,
      role: userRole,
      canCollectPayments,
    }, record);
  return { can, role: userRole, permissions: actionPermissions };
}
