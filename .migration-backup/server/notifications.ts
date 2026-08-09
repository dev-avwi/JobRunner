/**
 * Notification Service - Centralized notification creation
 * This is the hub where all events in the app create notifications
 * 
 * Priority Levels:
 * - urgent: Money events (payments, quotes accepted) - need immediate attention
 * - important: Job events, assignments, scheduling changes
 * - info: Confirmations, reminders, general updates
 */

type NotificationPriority = 'urgent' | 'important' | 'info';

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedType?: string;
  relatedId?: string;
  priority?: NotificationPriority;
  actionUrl?: string;
  actionLabel?: string;
}

/**
 * Create a notification in the database
 * This is called whenever an important event happens in the system
 */
export async function createNotification(
  storage: any,
  params: CreateNotificationParams
): Promise<void> {
  try {
    await storage.createNotification({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      relatedType: params.relatedType || null,
      relatedId: params.relatedId || null,
      priority: params.priority || 'info',
      actionUrl: params.actionUrl || null,
      actionLabel: params.actionLabel || null,
      read: false,
      dismissed: false,
    });
    
    console.log(`[Notify] ${params.priority || 'info'}: ${params.type} for user ${params.userId}`);
  } catch (error) {
    console.error('[Notify] Failed to create notification:', error);
  }
}

/**
 * Event-driven notification creators
 * These are helper functions that create standardized notifications for common events
 */

// ===== JOB EVENTS =====

export async function notifyJobAssigned(
  storage: any,
  assignedUserId: string,
  job: any,
  assignedBy: any
) {
  await createNotification(storage, {
    userId: assignedUserId,
    type: 'job_assigned',
    title: 'New Job Assigned',
    message: `${assignedBy.firstName || assignedBy.username} assigned you to: ${job.title}`,
    relatedType: 'job',
    relatedId: job.id,
    priority: 'important',
    actionUrl: `/jobs/${job.id}`,
    actionLabel: 'View Job',
  });
}

export async function notifyJobCompleted(
  storage: any,
  ownerId: string,
  job: any,
  completedBy: any
) {
  await createNotification(storage, {
    userId: ownerId,
    type: 'job_completed',
    title: 'Job Completed',
    message: `${completedBy.firstName || completedBy.username} completed: ${job.title}`,
    relatedType: 'job',
    relatedId: job.id,
    priority: 'important',
    actionUrl: `/jobs/${job.id}`,
    actionLabel: 'View Job',
  });
}

export async function notifyUpcomingJob(
  storage: any,
  userId: string,
  job: any,
  hoursUntil: number
) {
  await createNotification(storage, {
    userId,
    type: 'job_reminder',
    title: 'Upcoming Job',
    message: `"${job.title}" scheduled in ${hoursUntil} hours`,
    relatedType: 'job',
    relatedId: job.id,
    priority: 'important',
    actionUrl: `/jobs/${job.id}`,
    actionLabel: 'View Job',
  });
}

export async function notifyJobScheduled(
  storage: any,
  userId: string,
  job: any,
  clientName: string
) {
  const scheduledDate = job.scheduledAt ? new Date(job.scheduledAt).toLocaleDateString('en-AU') : 'soon';
  await createNotification(storage, {
    userId,
    type: 'job_scheduled',
    title: 'Job Scheduled',
    message: `"${job.title}" for ${clientName} scheduled for ${scheduledDate}`,
    relatedType: 'job',
    relatedId: job.id,
    priority: 'info',
    actionUrl: `/jobs/${job.id}`,
    actionLabel: 'View Job',
  });
}

export async function notifyJobStarted(
  storage: any,
  userId: string,
  job: any,
  clientName: string
) {
  await createNotification(storage, {
    userId,
    type: 'job_started',
    title: 'Job Started',
    message: `"${job.title}" for ${clientName} is now in progress`,
    relatedType: 'job',
    relatedId: job.id,
    priority: 'info',
    actionUrl: `/jobs/${job.id}`,
    actionLabel: 'View Job',
  });
}

export async function notifyRecurringJobCreated(
  storage: any,
  userId: string,
  job: any,
  clientName: string
) {
  await createNotification(storage, {
    userId,
    type: 'recurring_job_created',
    title: 'Recurring Job Created',
    message: `New recurring job "${job.title}" created for ${clientName}`,
    relatedType: 'job',
    relatedId: job.id,
    priority: 'info',
    actionUrl: `/jobs/${job.id}`,
    actionLabel: 'View Job',
  });
}

export async function notifyJobAssignmentRequest(
  storage: any,
  ownerId: string,
  job: any,
  requestedBy: any
) {
  await createNotification(storage, {
    userId: ownerId,
    type: 'job_assignment_request',
    title: 'Job Assignment Request',
    message: `${requestedBy.firstName || requestedBy.username} requested to be assigned to: ${job.title}`,
    relatedType: 'job',
    relatedId: job.id,
    priority: 'important',
    actionUrl: '/team/assignment-requests',
    actionLabel: 'Review Request',
  });
}

// ===== QUOTE EVENTS =====

export async function notifyQuoteSent(
  storage: any,
  userId: string,
  quote: any,
  clientName: string
) {
  await createNotification(storage, {
    userId,
    type: 'quote_sent',
    title: 'Quote Sent',
    message: `Quote "${quote.title || 'Untitled'}" sent to ${clientName} for $${Number(quote.total || 0).toFixed(2)}`,
    relatedType: 'quote',
    relatedId: quote.id,
    priority: 'info',
    actionUrl: `/quotes/${quote.id}`,
    actionLabel: 'View Quote',
  });
}

export async function notifyQuoteAccepted(
  storage: any,
  userId: string,
  quote: any,
  clientName: string
) {
  await createNotification(storage, {
    userId,
    type: 'quote_accepted',
    title: 'Quote Accepted!',
    message: `${clientName} accepted your quote for $${Number(quote.total || 0).toFixed(2)}`,
    relatedType: 'quote',
    relatedId: quote.id,
    priority: 'urgent',
    actionUrl: `/quotes/${quote.id}`,
    actionLabel: 'View Quote',
  });
}

export async function notifyQuoteRejected(
  storage: any,
  userId: string,
  quote: any,
  clientName: string
) {
  await createNotification(storage, {
    userId,
    type: 'quote_rejected',
    title: 'Quote Declined',
    message: `${clientName} declined your quote for $${Number(quote.total || 0).toFixed(2)}`,
    relatedType: 'quote',
    relatedId: quote.id,
    priority: 'important',
    actionUrl: `/quotes/${quote.id}`,
    actionLabel: 'View Quote',
  });
}

export async function notifyQuoteExpiring(
  storage: any,
  userId: string,
  quote: any,
  clientName: string,
  daysUntilExpiry: number
) {
  await createNotification(storage, {
    userId,
    type: 'quote_expiring',
    title: 'Quote Expiring Soon',
    message: `Quote for ${clientName} expires in ${daysUntilExpiry} days ($${Number(quote.total || 0).toFixed(2)})`,
    relatedType: 'quote',
    relatedId: quote.id,
    priority: 'important',
    actionUrl: `/quotes/${quote.id}`,
    actionLabel: 'Follow Up',
  });
}

// ===== INVOICE & PAYMENT EVENTS =====

export async function notifyInvoiceSent(
  storage: any,
  userId: string,
  invoice: any,
  clientName: string
) {
  await createNotification(storage, {
    userId,
    type: 'invoice_sent',
    title: 'Invoice Sent',
    message: `Invoice "${invoice.title || 'Untitled'}" sent to ${clientName} for $${Number(invoice.total || 0).toFixed(2)}`,
    relatedType: 'invoice',
    relatedId: invoice.id,
    priority: 'info',
    actionUrl: `/invoices/${invoice.id}`,
    actionLabel: 'View Invoice',
  });
}

export async function notifyInvoicePaid(
  storage: any,
  userId: string,
  invoice: any,
  clientName: string
) {
  await createNotification(storage, {
    userId,
    type: 'payment_received',
    title: 'Payment Received!',
    message: `${clientName} paid invoice for $${Number(invoice.total || 0).toFixed(2)}`,
    relatedType: 'invoice',
    relatedId: invoice.id,
    priority: 'urgent',
    actionUrl: `/invoices/${invoice.id}`,
    actionLabel: 'View Invoice',
  });
}

export async function notifyInvoiceOverdue(
  storage: any,
  userId: string,
  invoice: any,
  clientName: string,
  daysOverdue: number
) {
  await createNotification(storage, {
    userId,
    type: 'overdue_invoice',
    title: 'Invoice Overdue',
    message: `Invoice to ${clientName} is ${daysOverdue} days overdue ($${Number(invoice.total || 0).toFixed(2)})`,
    relatedType: 'invoice',
    relatedId: invoice.id,
    priority: 'important',
    actionUrl: `/invoices/${invoice.id}`,
    actionLabel: 'Send Reminder',
  });
}

export async function notifyInstallmentDue(
  storage: any,
  userId: string,
  installment: any,
  schedule: any,
  clientName: string,
  daysUntilDue: number
) {
  const dueText = daysUntilDue === 0 ? 'due today' : daysUntilDue === 1 ? 'due tomorrow' : `due in ${daysUntilDue} days`;
  await createNotification(storage, {
    userId,
    type: 'installment_due',
    title: 'Installment Due',
    message: `Installment ${installment.installmentNumber} of ${schedule.numberOfInstallments} from ${clientName} is ${dueText} ($${Number(installment.amount).toFixed(2)})`,
    relatedType: 'invoice',
    relatedId: schedule.invoiceId,
    priority: 'important',
    actionUrl: `/invoices/${schedule.invoiceId}`,
    actionLabel: 'View Invoice',
  });
}

export async function notifyInstallmentReceived(
  storage: any,
  userId: string,
  installment: any,
  schedule: any,
  clientName: string
) {
  await createNotification(storage, {
    userId,
    type: 'installment_received',
    title: 'Installment Received!',
    message: `${clientName} paid installment ${installment.installmentNumber} of ${schedule.numberOfInstallments} ($${Number(installment.amount).toFixed(2)})`,
    relatedType: 'invoice',
    relatedId: schedule.invoiceId,
    priority: 'urgent',
    actionUrl: `/invoices/${schedule.invoiceId}`,
    actionLabel: 'View Invoice',
  });
}

export async function notifyPaymentPlanCompleted(
  storage: any,
  userId: string,
  schedule: any,
  clientName: string
) {
  await createNotification(storage, {
    userId,
    type: 'payment_plan_completed',
    title: 'Payment Plan Complete!',
    message: `${clientName} completed all ${schedule.numberOfInstallments} installments ($${Number(schedule.totalAmount).toFixed(2)})`,
    relatedType: 'invoice',
    relatedId: schedule.invoiceId,
    priority: 'urgent',
    actionUrl: `/invoices/${schedule.invoiceId}`,
    actionLabel: 'View Invoice',
  });
}

export async function notifyRecurringInvoiceCreated(
  storage: any,
  userId: string,
  invoice: any,
  clientName: string
) {
  await createNotification(storage, {
    userId,
    type: 'recurring_invoice_created',
    title: 'Recurring Invoice Created',
    message: `New recurring invoice for ${clientName} ($${Number(invoice.total || 0).toFixed(2)})`,
    relatedType: 'invoice',
    relatedId: invoice.id,
    priority: 'info',
    actionUrl: `/invoices/${invoice.id}`,
    actionLabel: 'View Invoice',
  });
}

// ===== GEOFENCE EVENTS =====

export async function notifyGeofenceCheckIn(
  storage: any,
  ownerId: string,
  job: any,
  teamMember: any
) {
  await createNotification(storage, {
    userId: ownerId,
    type: 'geofence_checkin',
    title: 'Team Arrived at Job',
    message: `${teamMember.firstName || teamMember.username} checked in at: ${job.title}`,
    relatedType: 'job',
    relatedId: job.id,
    priority: 'info',
    actionUrl: `/jobs/${job.id}`,
    actionLabel: 'View Job',
  });
}

export async function notifyGeofenceCheckOut(
  storage: any,
  ownerId: string,
  job: any,
  teamMember: any,
  duration: string
) {
  await createNotification(storage, {
    userId: ownerId,
    type: 'geofence_checkout',
    title: 'Team Left Job Site',
    message: `${teamMember.firstName || teamMember.username} checked out of ${job.title} (${duration})`,
    relatedType: 'job',
    relatedId: job.id,
    priority: 'info',
    actionUrl: `/jobs/${job.id}`,
    actionLabel: 'View Job',
  });
}

// ===== TEAM EVENTS =====

export async function notifyTeamMemberInvited(
  storage: any,
  invitedUserId: string,
  businessName: string,
  roleName: string
) {
  await createNotification(storage, {
    userId: invitedUserId,
    type: 'team_invite',
    title: 'Team Invitation',
    message: `You've been invited to join ${businessName} as ${roleName}`,
    relatedType: 'team',
    relatedId: invitedUserId,
    priority: 'important',
    actionUrl: '/team',
    actionLabel: 'View Team',
  });
}

export async function notifyTimesheetSubmitted(
  storage: any,
  ownerId: string,
  teamMember: any,
  timesheet: any
) {
  await createNotification(storage, {
    userId: ownerId,
    type: 'timesheet_submitted',
    title: 'Timesheet Submitted',
    message: `${teamMember.firstName || teamMember.username} submitted timesheet for review`,
    relatedType: 'timesheet',
    relatedId: timesheet.id,
    priority: 'important',
    actionUrl: '/team/timesheets',
    actionLabel: 'Review',
  });
}

// ===== SMS/CHAT EVENTS =====

export async function notifySmsReceived(
  storage: any,
  userId: string,
  clientName: string,
  messagePreview: string,
  conversationId: string
) {
  await createNotification(storage, {
    userId,
    type: 'sms_received',
    title: 'SMS from Customer',
    message: `${clientName}: "${messagePreview.substring(0, 50)}${messagePreview.length > 50 ? '...' : ''}"`,
    relatedType: 'sms',
    relatedId: conversationId,
    priority: 'important',
    actionUrl: '/chat',
    actionLabel: 'Reply',
  });
}

export async function notifyChatMessage(
  storage: any,
  userId: string,
  senderName: string,
  messagePreview: string,
  conversationId: string
) {
  await createNotification(storage, {
    userId,
    type: 'chat_message',
    title: 'New Message',
    message: `${senderName}: "${messagePreview.substring(0, 50)}${messagePreview.length > 50 ? '...' : ''}"`,
    relatedType: 'chat',
    relatedId: conversationId,
    priority: 'info',
    actionUrl: '/chat',
    actionLabel: 'Open Chat',
  });
}

// ===== SUBSCRIPTION/BILLING EVENTS =====

export async function notifyTrialExpiring(
  storage: any,
  userId: string,
  daysRemaining: number
) {
  await createNotification(storage, {
    userId,
    type: 'trial_expiring',
    title: 'Trial Ending Soon',
    message: `Your free trial ends in ${daysRemaining} days. Upgrade to keep all features.`,
    relatedType: 'subscription',
    relatedId: userId,
    priority: 'important',
    actionUrl: '/settings/billing',
    actionLabel: 'Upgrade Now',
  });
}

export async function notifyPaymentFailed(
  storage: any,
  userId: string
) {
  await createNotification(storage, {
    userId,
    type: 'payment_failed',
    title: 'Payment Failed',
    message: 'We couldn\'t process your subscription payment. Please update your payment method.',
    relatedType: 'subscription',
    relatedId: userId,
    priority: 'urgent',
    actionUrl: '/settings/billing',
    actionLabel: 'Update Payment',
  });
}
