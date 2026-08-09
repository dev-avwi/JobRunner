/**
 * Pre-built Automation Templates for JobRunner
 * 
 * These templates provide one-click automation setup for common trade workflows.
 * Users can enable these templates from the Automations page.
 */

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'quote' | 'invoice' | 'job' | 'payment';
  trigger: {
    type: 'status_change' | 'time_delay' | 'no_response' | 'payment_received';
    entityType: 'job' | 'quote' | 'invoice';
    fromStatus?: string;
    toStatus?: string;
    delayDays?: number;
  };
  actions: Array<{
    type: 'send_email' | 'send_sms' | 'create_job' | 'create_invoice' | 'notification' | 'update_status';
    template?: string;
    message?: string;
    newStatus?: string;
  }>;
  emailSubject?: string;
  emailBody?: string;
  smsBody?: string;
  popular?: boolean;
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  // ============ QUOTE FOLLOW-UPS ============
  {
    id: 'quote-follow-up-3-days',
    name: 'Quote Follow-up (3 Days)',
    description: 'Send a friendly follow-up email 3 days after sending a quote',
    category: 'quote',
    trigger: {
      type: 'no_response',
      entityType: 'quote',
      delayDays: 3,
    },
    actions: [
      { type: 'send_email', template: 'quote_follow_up' },
      { type: 'notification', message: 'Quote follow-up sent to {client_name}' },
    ],
    emailSubject: 'Following up on your quote - {quote_number}',
    emailBody: `G'day {client_name},

Just wanted to follow up on the quote I sent through a few days ago.

If you have any questions or would like to discuss the quote further, I'm happy to chat.

Quote Details:
- Quote Number: {quote_number}
- Total: {quote_total} (inc. GST)

Let me know if there's anything I can help with.

Cheers,
{business_name}`,
    popular: true,
  },
  {
    id: 'quote-follow-up-7-days',
    name: 'Quote Follow-up (7 Days)',
    description: 'Send a second follow-up 7 days after the quote was sent',
    category: 'quote',
    trigger: {
      type: 'no_response',
      entityType: 'quote',
      delayDays: 7,
    },
    actions: [
      { type: 'send_email', template: 'quote_follow_up_2' },
      { type: 'notification', message: 'Second quote follow-up sent to {client_name}' },
    ],
    emailSubject: 'Just checking in - Quote {quote_number}',
    emailBody: `Hi {client_name},

I wanted to check in about the quote I sent through last week.

Is there anything holding you back or any questions I can answer? I'm happy to make adjustments if needed.

Quote Number: {quote_number}
Total: {quote_total}

Looking forward to hearing from you.

Regards,
{business_name}`,
  },
  {
    id: 'quote-accepted-confirmation',
    name: 'Quote Accepted Confirmation',
    description: 'Send confirmation when a quote is accepted',
    category: 'quote',
    trigger: {
      type: 'status_change',
      entityType: 'quote',
      fromStatus: 'sent',
      toStatus: 'accepted',
    },
    actions: [
      { type: 'send_email', template: 'quote_accepted' },
      { type: 'create_job' },
      { type: 'notification', message: 'Quote {quote_number} accepted by {client_name}' },
    ],
    emailSubject: 'Thanks! Quote {quote_number} Accepted',
    emailBody: `G'day {client_name},

Thanks for accepting the quote! I'll be in touch shortly to schedule the work.

Quote Number: {quote_number}
Total: {quote_total}

Looking forward to getting started.

Cheers,
{business_name}`,
    popular: true,
  },

  // ============ INVOICE REMINDERS ============
  {
    id: 'invoice-reminder-7-days',
    name: 'Invoice Reminder (7 Days Overdue)',
    description: 'Send a gentle reminder 7 days after invoice due date',
    category: 'invoice',
    trigger: {
      type: 'time_delay',
      entityType: 'invoice',
      delayDays: 7,
    },
    actions: [
      { type: 'send_email', template: 'invoice_reminder' },
      { type: 'update_status', newStatus: 'overdue' },
      { type: 'notification', message: 'Invoice reminder sent to {client_name}' },
    ],
    emailSubject: 'Payment Reminder - Invoice {invoice_number}',
    emailBody: `Hi {client_name},

Just a friendly reminder that invoice {invoice_number} is now overdue.

Invoice Details:
- Invoice Number: {invoice_number}
- Amount Due: {invoice_total}

If you've already paid, no worries - just ignore this email.

If you have any questions, please get in touch.

Thanks,
{business_name}`,
    popular: true,
  },
  {
    id: 'invoice-reminder-14-days',
    name: 'Invoice Reminder (14 Days Overdue)',
    description: 'Send a firmer reminder 14 days after due date',
    category: 'invoice',
    trigger: {
      type: 'time_delay',
      entityType: 'invoice',
      delayDays: 14,
    },
    actions: [
      { type: 'send_email', template: 'invoice_reminder_2' },
      { type: 'send_sms', message: 'Hi {client_name}, invoice {invoice_number} for {invoice_total} is now 2 weeks overdue. Please pay ASAP. Thanks - {business_name}' },
      { type: 'notification', message: 'Second invoice reminder sent to {client_name}' },
    ],
    emailSubject: 'URGENT: Invoice {invoice_number} - Payment Required',
    emailBody: `Hi {client_name},

This is a reminder that invoice {invoice_number} is now 14 days overdue.

Please arrange payment as soon as possible to avoid any disruption to our service.

Invoice Details:
- Invoice Number: {invoice_number}
- Amount Due: {invoice_total}
- Days Overdue: 14

If there's an issue with payment, please contact me to discuss.

Regards,
{business_name}`,
  },
  {
    id: 'invoice-payment-received',
    name: 'Payment Thank You',
    description: 'Send a thank you email when payment is received',
    category: 'payment',
    trigger: {
      type: 'payment_received',
      entityType: 'invoice',
    },
    actions: [
      { type: 'send_email', template: 'payment_thanks' },
      { type: 'notification', message: 'Payment received from {client_name}' },
    ],
    emailSubject: 'Payment Received - Thanks!',
    emailBody: `G'day {client_name},

Thanks for the payment! Invoice {invoice_number} is now marked as paid.

Amount Received: {invoice_total}

Really appreciate your business. Looking forward to working with you again.

Cheers,
{business_name}`,
    popular: true,
  },

  // ============ JOB NOTIFICATIONS ============
  {
    id: 'job-scheduled-reminder',
    name: 'Job Reminder (Day Before)',
    description: 'Remind client about their scheduled job the day before',
    category: 'job',
    trigger: {
      type: 'time_delay',
      entityType: 'job',
      delayDays: -1, // Negative = days BEFORE scheduled date
    },
    actions: [
      { type: 'send_email', template: 'job_reminder' },
      { type: 'send_sms', message: 'Hi {client_name}, just a reminder I\'ll be there tomorrow for {job_title}. See you then! - {business_name}' },
      { type: 'notification', message: 'Job reminder sent to {client_name}' },
    ],
    emailSubject: 'Reminder: Appointment Tomorrow - {job_title}',
    emailBody: `G'day {client_name},

Just a quick reminder that I'll be at your place tomorrow for the following job:

Job: {job_title}
Address: {job_address}
Date: {scheduled_date}

If you need to reschedule, please let me know ASAP.

See you tomorrow!
{business_name}`,
    popular: true,
  },
  {
    id: 'job-completed-followup',
    name: 'Job Completed Follow-up',
    description: 'Send a follow-up email after job is marked as done',
    category: 'job',
    trigger: {
      type: 'status_change',
      entityType: 'job',
      fromStatus: 'in_progress',
      toStatus: 'done',
    },
    actions: [
      { type: 'send_email', template: 'job_completed' },
      { type: 'notification', message: 'Job completion email sent to {client_name}' },
    ],
    emailSubject: 'Job Completed - {job_title}',
    emailBody: `G'day {client_name},

Just to let you know the job is all done!

Job: {job_title}
Address: {job_address}

If you notice any issues, please get in touch and I'll sort it out.

Thanks for your business - I really appreciate it. If you were happy with the work, I'd love a review on Google!

Cheers,
{business_name}`,
  },
  {
    id: 'job-started-notification',
    name: 'Job Started Notification',
    description: 'Notify client when work begins',
    category: 'job',
    trigger: {
      type: 'status_change',
      entityType: 'job',
      fromStatus: 'scheduled',
      toStatus: 'in_progress',
    },
    actions: [
      { type: 'send_sms', message: 'Hi {client_name}, I\'ve just started work on {job_title}. I\'ll let you know when it\'s done. - {business_name}' },
      { type: 'notification', message: 'Job started notification sent to {client_name}' },
    ],
    smsBody: 'Hi {client_name}, I\'ve just started work on {job_title}. I\'ll let you know when it\'s done. - {business_name}',
  },

  // ============ SMS-ONLY TEMPLATES ============
  {
    id: 'quote-sms-follow-up',
    name: 'Quote SMS Follow-up',
    description: 'Quick SMS follow-up for quotes',
    category: 'quote',
    trigger: {
      type: 'no_response',
      entityType: 'quote',
      delayDays: 5,
    },
    actions: [
      { type: 'send_sms', message: 'Hi {client_name}, just checking in on quote {quote_number} for {quote_total}. Any questions? - {business_name}' },
      { type: 'notification', message: 'Quote SMS follow-up sent to {client_name}' },
    ],
    smsBody: 'Hi {client_name}, just checking in on quote {quote_number} for {quote_total}. Any questions? - {business_name}',
  },
  {
    id: 'invoice-sms-reminder',
    name: 'Invoice SMS Reminder',
    description: 'Quick SMS for overdue invoices',
    category: 'invoice',
    trigger: {
      type: 'time_delay',
      entityType: 'invoice',
      delayDays: 10,
    },
    actions: [
      { type: 'send_sms', message: 'Hi {client_name}, friendly reminder that invoice {invoice_number} ({invoice_total}) is overdue. Please pay when you can. Thanks! - {business_name}' },
      { type: 'notification', message: 'Invoice SMS reminder sent to {client_name}' },
    ],
    smsBody: 'Hi {client_name}, friendly reminder that invoice {invoice_number} ({invoice_total}) is overdue. Please pay when you can. Thanks! - {business_name}',
  },
];

/**
 * Get all automation templates
 */
export function getAllTemplates(): AutomationTemplate[] {
  return AUTOMATION_TEMPLATES;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): AutomationTemplate[] {
  return AUTOMATION_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get popular templates (recommended for new users)
 */
export function getPopularTemplates(): AutomationTemplate[] {
  return AUTOMATION_TEMPLATES.filter(t => t.popular);
}

/**
 * Get a specific template by ID
 */
export function getTemplateById(id: string): AutomationTemplate | undefined {
  return AUTOMATION_TEMPLATES.find(t => t.id === id);
}

/**
 * Convert a template to an automation object for storage
 */
export function templateToAutomation(template: AutomationTemplate, userId: string): {
  userId: string;
  name: string;
  description: string;
  isActive: boolean;
  trigger: any;
  actions: any[];
} {
  return {
    userId,
    name: template.name,
    description: template.description,
    isActive: true,
    trigger: template.trigger,
    actions: template.actions,
  };
}
