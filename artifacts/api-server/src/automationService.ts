import { getErrorMessage } from "./lib/errors";
import { storage } from './storage';
import { sendEmail } from './emailService';
import { getTemplateById } from './automationTemplates';

interface AutomationTrigger {
  type: 'status_change' | 'time_delay' | 'no_response' | 'payment_received';
  entityType: 'job' | 'quote' | 'invoice';
  fromStatus?: string;
  toStatus?: string;
  delayDays?: number;
}

interface AutomationAction {
  type: 'send_email' | 'send_sms' | 'create_job' | 'create_invoice' | 'notification' | 'update_status';
  template?: string;
  message?: string;
  newStatus?: string;
}

interface Automation {
  id: string;
  userId: string;
  name: string;
  isActive: boolean;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
}

export async function processTimeBasedAutomations(): Promise<{ processed: number; errors: number }> {
  console.log('[Automations] Processing time-based automation rules...');
  
  let processed = 0;
  let errors = 0;
  
  try {
    const allUsers = await storage.getAllUsersWithAutomations();
    
    for (const userId of allUsers) {
      try {
        const automations = await storage.getAutomations(userId);
        const activeAutomations = automations.filter((a: any) => a.isActive);
        
        for (const automation of activeAutomations) {
          const trigger = automation.trigger as AutomationTrigger;
          
          if (trigger.type === 'no_response') {
            const result = await processNoResponseAutomation(userId, automation as Automation);
            processed += result.processed;
            errors += result.errors;
          } else if (trigger.type === 'time_delay') {
            const result = await processTimeDelayAutomation(userId, automation as Automation);
            processed += result.processed;
            errors += result.errors;
          }
        }
      } catch (userError) {
        console.error(`[Automations] Error processing user ${userId}:`, userError);
        errors++;
      }
    }
    
  } catch (error) {
    console.error('[Automations] Error in time-based processing:', error);
    errors++;
  }
  
  return { processed, errors };
}

async function processNoResponseAutomation(
  userId: string, 
  automation: Automation
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;
  
  const trigger = automation.trigger;
  const delayDays = trigger.delayDays || 3;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - delayDays);
  
  try {
    if (trigger.entityType === 'quote') {
      const quotes = await storage.getQuotes(userId);
      
      for (const quote of quotes) {
        const status = (quote as any).status?.toLowerCase();
        const sentDate = (quote as any).sentAt ? new Date((quote as any).sentAt) : 
                        ((quote as any).createdAt ? new Date((quote as any).createdAt) : null);
        
        if ((status === 'sent' || status === 'viewed') && sentDate && sentDate < cutoffDate) {
          const alreadyProcessed = await storage.hasAutomationProcessed(automation.id, 'quote', quote.id);
          
          if (!alreadyProcessed) {
            try {
              await executeAutomationActions(userId, automation.actions, { quote });
              await storage.logAutomationProcessed(automation.id, 'quote', quote.id, 'success');
              processed++;
              console.log(`[Automations] Processed quote ${quote.id} with automation ${automation.name}`);
            } catch (actionError: unknown) {
              console.error(`[Automations] Error executing actions for quote ${quote.id}:`, actionError);
              await storage.logAutomationProcessed(automation.id, 'quote', quote.id, 'error', getErrorMessage(actionError));
              errors++;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[Automations] Error in no_response processing:', error);
    errors++;
  }
  
  return { processed, errors };
}

async function processTimeDelayAutomation(
  userId: string,
  automation: Automation
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;
  
  const trigger = automation.trigger;
  const delayDays = trigger.delayDays || 1;
  
  try {
    if (trigger.entityType === 'job') {
      const jobs = await storage.getJobs(userId);
      
      if (delayDays < 0) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + Math.abs(delayDays));
        targetDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        for (const job of jobs) {
          if (!(job as any).scheduledAt) continue;
          const scheduledDate = new Date((job as any).scheduledAt);
          scheduledDate.setHours(0, 0, 0, 0);
          
          if (scheduledDate >= targetDate && scheduledDate < nextDay && (job as any).status === 'scheduled') {
            const alreadyProcessed = await storage.hasAutomationProcessed(automation.id, 'job', job.id);
            
            if (!alreadyProcessed) {
              try {
                await executeAutomationActions(userId, automation.actions, { job });
                await storage.logAutomationProcessed(automation.id, 'job', job.id, 'success');
                processed++;
                console.log(`[Automations] Processed upcoming job ${job.id} with automation ${automation.name}`);
              } catch (actionError: unknown) {
                console.error(`[Automations] Error executing actions for job ${job.id}:`, actionError);
                await storage.logAutomationProcessed(automation.id, 'job', job.id, 'error', getErrorMessage(actionError));
                errors++;
              }
            }
          }
        }
      } else {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - delayDays);
        
        for (const job of jobs) {
          if (!(job as any).scheduledAt) continue;
          const scheduledDate = new Date((job as any).scheduledAt);
          const status = (job as any).status;
          
          if (scheduledDate < cutoffDate && (status === 'scheduled' || status === 'in_progress')) {
            const alreadyProcessed = await storage.hasAutomationProcessed(automation.id, 'job', job.id);
            
            if (!alreadyProcessed) {
              try {
                await executeAutomationActions(userId, automation.actions, { job });
                await storage.logAutomationProcessed(automation.id, 'job', job.id, 'success');
                processed++;
                console.log(`[Automations] Processed overdue job ${job.id} with automation ${automation.name}`);
              } catch (actionError: unknown) {
                console.error(`[Automations] Error executing actions for job ${job.id}:`, actionError);
                await storage.logAutomationProcessed(automation.id, 'job', job.id, 'error', getErrorMessage(actionError));
                errors++;
              }
            }
          }
        }
      }
    } else if (trigger.entityType === 'invoice') {
      const invoices = await storage.getInvoices(userId);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - delayDays);
      
      for (const invoice of invoices) {
        const dueDate = (invoice as any).dueDate ? new Date((invoice as any).dueDate) : null;
        const status = (invoice as any).status;
        
        if (dueDate && dueDate < cutoffDate && 
            (status === 'sent' || status === 'viewed' || status === 'overdue') && 
            status !== 'paid') {
          const alreadyProcessed = await storage.hasAutomationProcessed(automation.id, 'invoice', invoice.id);
          
          if (!alreadyProcessed) {
            try {
              await executeAutomationActions(userId, automation.actions, { invoice });
              await storage.logAutomationProcessed(automation.id, 'invoice', invoice.id, 'success');
              processed++;
              console.log(`[Automations] Processed overdue invoice ${invoice.id} with automation ${automation.name}`);
            } catch (actionError: unknown) {
              console.error(`[Automations] Error executing actions for invoice ${invoice.id}:`, actionError);
              await storage.logAutomationProcessed(automation.id, 'invoice', invoice.id, 'error', getErrorMessage(actionError));
              errors++;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[Automations] Error in time_delay processing:', error);
    errors++;
  }
  
  return { processed, errors };
}

async function executeAutomationActions(
  userId: string,
  actions: AutomationAction[],
  context: { quote?: any; job?: any; invoice?: any },
  automationTemplateId?: string
): Promise<void> {
  const user = await storage.getUser(userId);
  const businessSettings = await storage.getBusinessSettings(userId);
  const businessName = businessSettings?.businessName || user?.firstName || 'Your Tradie';
  
  let client = null;
  const clientId = context.quote?.clientId || context.job?.clientId || context.invoice?.clientId;
  if (clientId) {
    client = await storage.getClient(clientId, userId);
  }
  
  // Get template for email content if available
  const template = automationTemplateId ? getTemplateById(automationTemplateId) : null;
  
  for (const action of actions) {
    try {
      switch (action.type) {
        case 'notification':
          await createNotification(userId, action.message || 'Automation triggered', context);
          break;
          
        case 'send_email':
          if (client?.email) {
            // Build email content from template or generate based on context
            let emailSubject = '';
            let emailBody = '';
            
            if (template) {
              emailSubject = template.emailSubject || '';
              emailBody = template.emailBody || '';
            } else {
              // Generate email content based on context
              if (context.quote) {
                emailSubject = `Following up on your quote - ${context.quote.number || ''}`;
                emailBody = `G'day ${client.name || 'there'},\n\nJust checking in on the quote I sent through. Let me know if you have any questions.\n\nCheers,\n${businessName}`;
              } else if (context.invoice) {
                emailSubject = `Payment Reminder - Invoice ${context.invoice.number || ''}`;
                emailBody = `Hi ${client.name || 'there'},\n\nThis is a friendly reminder about invoice ${context.invoice.number}.\n\nAmount Due: $${context.invoice.total || '0'}\n\nPlease arrange payment at your earliest convenience.\n\nThanks,\n${businessName}`;
              } else if (context.job) {
                emailSubject = `Job Update - ${context.job.title || ''}`;
                emailBody = `G'day ${client.name || 'there'},\n\nJust a quick update on your job: ${context.job.title}.\n\nCheers,\n${businessName}`;
              }
            }
            
            // Replace variables in email content
            emailSubject = replaceVariables(emailSubject, context, client, businessName);
            emailBody = replaceVariables(emailBody, context, client, businessName);
            
            // Convert plain text body to HTML
            const emailHtml = `
              <!DOCTYPE html>
              <html>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
                  ${emailBody.split('\n').map(line => `<p style="margin: 8px 0;">${line}</p>`).join('')}
                </div>
              </body>
              </html>
            `;
            
            const result = await sendEmail({
              to: client.email,
              subject: emailSubject,
              text: emailBody,
              html: emailHtml,
            });
            
            if (result.success) {
              console.log(`[Automations] Sent email to ${client.email} - ${emailSubject}`);
            } else {
              console.error(`[Automations] Failed to send email: ${result.error}`);
            }
          } else {
            console.log(`[Automations] Skipped email - no client email address`);
          }
          break;
          
        case 'send_sms':
          if (client?.phone) {
            const smsMessage = replaceVariables(action.message || '', context, client, businessName);
            console.log(`[Automations] SMS automation not yet enabled. Would send to ${client.phone}: ${smsMessage}`);
          }
          break;
          
        case 'create_job':
          if (context.quote && context.quote.clientId) {
            // Create job from accepted quote
            const jobData = {
              userId,
              clientId: context.quote.clientId,
              title: context.quote.title || `Job from Quote ${context.quote.number}`,
              description: context.quote.description || '',
              status: 'pending',
              quoteId: context.quote.id,
            };
            const newJob = await storage.createJob(jobData as any);
            // Note: job number is auto-generated inside storage.createJob when a prefix is configured.
            console.log(`[Automations] Created job ${newJob.id} from quote ${context.quote.id}`);
          }
          break;
          
        case 'create_invoice':
          if (context.job && context.job.clientId) {
            const invoiceNumber = await storage.generateInvoiceNumber(userId);
            const invoiceData = {
              userId,
              clientId: context.job.clientId,
              jobId: context.job.id,
              number: invoiceNumber,
              status: 'draft',
              issueDate: new Date(),
              dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
              subtotal: '0',
              gstAmount: '0',
              total: '0',
            };
            const newInvoice = await storage.createInvoice(invoiceData as any);
            console.log(`[Automations] Created invoice ${newInvoice.id} from job ${context.job.id}`);
          }
          break;
          
        case 'update_status':
          if (action.newStatus) {
            if (context.invoice) {
              await storage.updateInvoice(context.invoice.id, userId, { status: action.newStatus });
              console.log(`[Automations] Updated invoice ${context.invoice.id} status to ${action.newStatus}`);
            } else if (context.job) {
              await storage.updateJob(context.job.id, userId, { status: action.newStatus });
              console.log(`[Automations] Updated job ${context.job.id} status to ${action.newStatus}`);
            } else if (context.quote) {
              await storage.updateQuote(context.quote.id, userId, { status: action.newStatus });
              console.log(`[Automations] Updated quote ${context.quote.id} status to ${action.newStatus}`);
            }
          }
          break;
      }
    } catch (actionError) {
      console.error(`[Automations] Error executing action ${action.type}:`, actionError);
    }
  }
}

function replaceVariables(template: string, context: any, client: any, businessName?: string): string {
  let result = template;
  
  // Business variables
  result = result.replace(/{business_name}/g, businessName || 'Your Tradie');
  
  if (client) {
    result = result.replace(/{client_name}/g, client.name || 'there');
    result = result.replace(/{client_email}/g, client.email || '');
  }
  
  if (context.quote) {
    result = result.replace(/{quote_number}/g, context.quote.number || context.quote.quoteNumber || '');
    result = result.replace(/{quote_total}/g, formatMoney(context.quote.total));
  }
  
  if (context.invoice) {
    result = result.replace(/{invoice_number}/g, context.invoice.number || context.invoice.invoiceNumber || '');
    result = result.replace(/{invoice_total}/g, formatMoney(context.invoice.total));
  }
  
  if (context.job) {
    result = result.replace(/{job_title}/g, context.job.title || '');
    result = result.replace(/{job_address}/g, context.job.siteAddress || context.job.address || '');
    result = result.replace(/{scheduled_date}/g, context.job.scheduledAt ? new Date(context.job.scheduledAt).toLocaleDateString('en-AU') : '');
  }
  
  return result;
}

function formatMoney(value: any): string {
  if (!value) return '$0.00';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '$0.00';
  return `$${numValue.toFixed(2)}`;
}

async function createNotification(
  userId: string,
  message: string,
  context: any
): Promise<void> {
  const client = context.quote?.clientId || context.job?.clientId || context.invoice?.clientId
    ? await storage.getClient(context.quote?.clientId || context.job?.clientId || context.invoice?.clientId, userId)
    : null;
  
  const formattedMessage = replaceVariables(message, context, client);
  
  await storage.createNotification({
    userId,
    type: 'automation',
    title: 'Automation Alert',
    message: formattedMessage,
    relatedType: context.quote ? 'quote' : context.job ? 'job' : 'invoice',
    relatedId: context.quote?.id || context.job?.id || context.invoice?.id,
  });
}

export async function processReviewRequestAutomation(
  userId: string,
  jobId: string
): Promise<void> {
  try {
    const automationSettings = await storage.getAutomationSettings(userId);
    if (!automationSettings?.autoReviewRequest) return;

    const job = await storage.getJob(jobId, userId);
    if (!job?.clientId) return;

    const client = await storage.getClient(job.clientId, userId);
    if (!client) return;

    const businessSettings = await storage.getBusinessSettings(userId);
    const businessName = businessSettings?.businessName || 'Your Tradie';
    const googleReviewUrl = (businessSettings as any)?.googleReviewUrl;

    if (googleReviewUrl && !/^https?:\/\//i.test(googleReviewUrl)) {
      console.warn('[Automations] Invalid googleReviewUrl, skipping review link');
    }
    const safeReviewUrl = googleReviewUrl && /^https?:\/\//i.test(googleReviewUrl)
      ? googleReviewUrl.replace(/[<>"']/g, '') : '';

    const defaultMessage = `Hi {client_name}, thanks for choosing {business_name}! We'd love to hear how we did. Your feedback helps us improve!`;
    let message = automationSettings.reviewRequestMessage || defaultMessage;
    message = message.replace(/{client_name}/g, client.name || 'there')
      .replace(/{client}/g, client.name || 'there')
      .replace(/{business_name}/g, businessName)
      .replace(/{business}/g, businessName);

    if (safeReviewUrl) {
      message += `\n\nLeave a review: ${safeReviewUrl}`;
    }

    const channel = automationSettings.autoReviewRequestType || 'email';

    const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    if ((channel === 'email' || channel === 'both') && client.email) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f8f9fa; padding: 24px; border-radius: 8px; text-align: center;">
            <h2 style="color: #1a1a1a; margin-bottom: 16px;">How did we do?</h2>
            ${message.split('\n').map((line: string) => `<p style="margin: 8px 0;">${escHtml(line)}</p>`).join('')}
            ${safeReviewUrl ? `<a href="${escHtml(safeReviewUrl)}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #2563EB; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Leave a Google Review</a>` : ''}
          </div>
        </body>
        </html>
      `;

      const { sendEmail } = await import('./emailService');
      await sendEmail({
        to: client.email,
        subject: `How was your experience with ${businessName}?`,
        text: message,
        html: emailHtml,
      });
      console.log(`[Automations] Sent review request email to ${client.email} for job ${jobId}`);
    }

    if ((channel === 'sms' || channel === 'both') && client.phone) {
      const { sendCustomerReply } = await import('./services/smsService');
      await sendCustomerReply(client.phone, message, userId);
      console.log(`[Automations] Sent review request SMS to ${client.phone} for job ${jobId}`);
    }
  } catch (error) {
    console.error('[Automations] Error processing review request:', error);
  }
}

export async function processStatusChangeAutomation(
  userId: string,
  entityType: 'job' | 'quote' | 'invoice',
  entityId: string,
  fromStatus: string,
  toStatus: string
): Promise<void> {
  try {
    const automations = await storage.getAutomations(userId);
    const matchingAutomations = automations.filter((a: any) => {
      if (!a.isActive) return false;
      const trigger = a.trigger as AutomationTrigger;
      return trigger.type === 'status_change' &&
             trigger.entityType === entityType &&
             (!trigger.fromStatus || trigger.fromStatus === fromStatus) &&
             (!trigger.toStatus || trigger.toStatus === toStatus);
    });
    
    for (const automation of matchingAutomations) {
      const context: any = {};
      
      if (entityType === 'quote') {
        context.quote = await storage.getQuote(entityId, userId);
      } else if (entityType === 'job') {
        context.job = await storage.getJob(entityId, userId);
      } else if (entityType === 'invoice') {
        context.invoice = await storage.getInvoice(entityId, userId);
      }
      
      await executeAutomationActions(userId, automation.actions as AutomationAction[], context);
    }
  } catch (error) {
    console.error('[Automations] Error processing status change:', error);
  }
}

export async function processPaymentReceivedAutomation(
  userId: string,
  invoiceId: string
): Promise<void> {
  try {
    const automations = await storage.getAutomations(userId);
    const matchingAutomations = automations.filter((a: any) => {
      if (!a.isActive) return false;
      const trigger = a.trigger as AutomationTrigger;
      return trigger.type === 'payment_received' && trigger.entityType === 'invoice';
    });
    
    const invoice = await storage.getInvoice(invoiceId, userId);
    
    for (const automation of matchingAutomations) {
      await executeAutomationActions(userId, automation.actions as AutomationAction[], { invoice });
    }
  } catch (error) {
    console.error('[Automations] Error processing payment received:', error);
  }
}
