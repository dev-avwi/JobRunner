import { storage } from "./storage";

export type TeamActivityType = 
  | 'team_join'           // Team member joined/accepted invite
  | 'team_invite'         // Team member invited
  | 'team_leave'          // Team member left/removed
  | 'job_started'         // Job was started
  | 'job_completed'       // Job marked as complete
  | 'job_assigned'        // Job assigned to team member
  | 'job_created'         // New job created
  | 'quote_sent'          // Quote sent to client
  | 'quote_accepted'      // Quote accepted by client
  | 'quote_created'       // New quote created
  | 'quote_viewed'        // Quote viewed by client in portal
  | 'invoice_sent'        // Invoice sent to client
  | 'invoice_paid'        // Invoice paid
  | 'invoice_created'     // New invoice created
  | 'invoice_viewed'      // Invoice viewed by client in portal
  | 'payment_received'    // Payment received
  | 'client_added'        // New client added
  | 'milestone'           // Milestone reached (e.g., 100 jobs completed)
  | 'check_in'            // Team member checked in at job site
  | 'check_out'           // Team member checked out from job site
  | 'message_sent'        // Team chat message
  | 'website_change_submitted'     // Website change request submitted
  | 'ai_receptionist_provisioned'  // AI receptionist provisioned (pending approval)
  | 'impersonation_started';       // Admin started impersonation session

interface LogActivityOptions {
  businessOwnerId: string;
  actorUserId?: string;
  actorName?: string;
  teamMemberId?: string;
  activityType: TeamActivityType;
  entityType?: 'job' | 'quote' | 'invoice' | 'client' | 'team_member' | null;
  entityId?: string;
  entityTitle?: string;
  description?: string;
  metadata?: Record<string, any>;
  isImportant?: boolean;
}

export async function logTeamActivity(options: LogActivityOptions): Promise<void> {
  try {
    await storage.createActivity({
      businessOwnerId: options.businessOwnerId,
      actorUserId: options.actorUserId || null,
      actorName: options.actorName || null,
      teamMemberId: options.teamMemberId || null,
      activityType: options.activityType,
      entityType: options.entityType || null,
      entityId: options.entityId || null,
      entityTitle: options.entityTitle || null,
      description: options.description || null,
      metadata: options.metadata || null,
      isImportant: options.isImportant || false,
    });
  } catch (error) {
    console.error('Failed to log team activity:', error);
  }
}

export async function logTeamMemberJoined(
  businessOwnerId: string,
  memberUserId: string,
  memberName: string,
  teamMemberId: string
): Promise<void> {
  await logTeamActivity({
    businessOwnerId,
    actorUserId: memberUserId,
    actorName: memberName,
    teamMemberId,
    activityType: 'team_join',
    entityType: 'team_member',
    entityId: teamMemberId,
    entityTitle: memberName,
    description: `${memberName} joined the team`,
    isImportant: true,
  });
}

export async function logTeamMemberInvited(
  businessOwnerId: string,
  inviterUserId: string,
  inviterName: string,
  inviteeName: string,
  teamMemberId: string
): Promise<void> {
  await logTeamActivity({
    businessOwnerId,
    actorUserId: inviterUserId,
    actorName: inviterName,
    teamMemberId,
    activityType: 'team_invite',
    entityType: 'team_member',
    entityId: teamMemberId,
    entityTitle: inviteeName,
    description: `${inviterName} invited ${inviteeName} to the team`,
  });
}

export async function logJobCompleted(
  businessOwnerId: string,
  actorUserId: string,
  actorName: string,
  jobId: string,
  jobTitle: string,
  teamMemberId?: string
): Promise<void> {
  await logTeamActivity({
    businessOwnerId,
    actorUserId,
    actorName,
    teamMemberId,
    activityType: 'job_completed',
    entityType: 'job',
    entityId: jobId,
    entityTitle: jobTitle,
    description: `${actorName} completed "${jobTitle}"`,
    isImportant: true,
  });
}

export async function logJobStarted(
  businessOwnerId: string,
  actorUserId: string,
  actorName: string,
  jobId: string,
  jobTitle: string,
  teamMemberId?: string
): Promise<void> {
  await logTeamActivity({
    businessOwnerId,
    actorUserId,
    actorName,
    teamMemberId,
    activityType: 'job_started',
    entityType: 'job',
    entityId: jobId,
    entityTitle: jobTitle,
    description: `${actorName} started "${jobTitle}"`,
  });
}

export async function logJobAssigned(
  businessOwnerId: string,
  assignerUserId: string,
  assignerName: string,
  assigneeName: string,
  jobId: string,
  jobTitle: string,
  teamMemberId?: string
): Promise<void> {
  await logTeamActivity({
    businessOwnerId,
    actorUserId: assignerUserId,
    actorName: assignerName,
    teamMemberId,
    activityType: 'job_assigned',
    entityType: 'job',
    entityId: jobId,
    entityTitle: jobTitle,
    description: `${assignerName} assigned "${jobTitle}" to ${assigneeName}`,
  });
}

export async function logInvoicePaid(
  businessOwnerId: string,
  invoiceId: string,
  invoiceNumber: string,
  clientName: string,
  amount: number
): Promise<void> {
  await logTeamActivity({
    businessOwnerId,
    activityType: 'invoice_paid',
    entityType: 'invoice',
    entityId: invoiceId,
    entityTitle: invoiceNumber,
    description: `Invoice #${invoiceNumber} paid by ${clientName}`,
    metadata: { amount, clientName },
    isImportant: true,
  });
}

export async function logPaymentReceived(
  businessOwnerId: string,
  invoiceId: string,
  invoiceNumber: string,
  clientName: string,
  amount: number
): Promise<void> {
  await logTeamActivity({
    businessOwnerId,
    activityType: 'payment_received',
    entityType: 'invoice',
    entityId: invoiceId,
    entityTitle: invoiceNumber,
    description: `$${amount.toFixed(2)} received from ${clientName}`,
    metadata: { amount, clientName },
    isImportant: true,
  });
}

export async function logMilestone(
  businessOwnerId: string,
  milestoneType: string,
  milestoneTitle: string,
  description: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logTeamActivity({
    businessOwnerId,
    activityType: 'milestone',
    entityTitle: milestoneTitle,
    description,
    metadata: { milestoneType, ...metadata },
    isImportant: true,
  });
}

export async function logClientAdded(
  businessOwnerId: string,
  actorUserId: string,
  actorName: string,
  clientId: string,
  clientName: string
): Promise<void> {
  await logTeamActivity({
    businessOwnerId,
    actorUserId,
    actorName,
    activityType: 'client_added',
    entityType: 'client',
    entityId: clientId,
    entityTitle: clientName,
    description: `${actorName} added new client "${clientName}"`,
  });
}

export async function logCheckIn(
  businessOwnerId: string,
  actorUserId: string,
  actorName: string,
  jobId: string,
  jobTitle: string,
  teamMemberId?: string
): Promise<void> {
  await logTeamActivity({
    businessOwnerId,
    actorUserId,
    actorName,
    teamMemberId,
    activityType: 'check_in',
    entityType: 'job',
    entityId: jobId,
    entityTitle: jobTitle,
    description: `${actorName} checked in at "${jobTitle}"`,
  });
}

export async function logCheckOut(
  businessOwnerId: string,
  actorUserId: string,
  actorName: string,
  jobId: string,
  jobTitle: string,
  teamMemberId?: string
): Promise<void> {
  await logTeamActivity({
    businessOwnerId,
    actorUserId,
    actorName,
    teamMemberId,
    activityType: 'check_out',
    entityType: 'job',
    entityId: jobId,
    entityTitle: jobTitle,
    description: `${actorName} checked out from "${jobTitle}"`,
  });
}
