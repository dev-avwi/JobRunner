import { storage, db } from './storage';
import { processOverdueReminders } from './reminderService';
import { processRecurringForUser } from './recurringService';
import { checkAndExpireTrials } from './subscriptionService';
import { processTimeBasedAutomations } from './automationService';
import { runDailyBillingReminders } from './billingReminderService';
import { notifyInstallmentDue } from './notifications';
import { getProductionBaseUrl } from './urlHelper';
import { jobs, quotes, invoices, smsAutomationRules, smsAutomationLogs, paymentSchedules, paymentInstallments, automationSettings, invoiceReminderLogs, complianceDocuments, trainingRecords, notifications } from '@shared/schema';
import { and, or, eq, lt, isNull, gte, lte, not, inArray } from 'drizzle-orm';
import { getErrorMessage } from "./lib/errors";

let reminderInterval: NodeJS.Timeout | null = null;
let recurringInterval: NodeJS.Timeout | null = null;
let trialInterval: NodeJS.Timeout | null = null;
let automationInterval: NodeJS.Timeout | null = null;
let archiveInterval: NodeJS.Timeout | null = null;
let smsAutomationInterval: NodeJS.Timeout | null = null;
let billingReminderInterval: NodeJS.Timeout | null = null;
let installmentReminderInterval: NodeJS.Timeout | null = null;
let complianceExpiryInterval: NodeJS.Timeout | null = null;
let sheetSyncInterval: NodeJS.Timeout | null = null;

const REMINDER_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const RECURRING_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const TRIAL_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const AUTOMATION_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const ARCHIVE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours (daily)
const SMS_AUTOMATION_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const BILLING_REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours (daily)
const INSTALLMENT_REMINDER_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours (twice daily)
const COMPLIANCE_EXPIRY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours (daily)
const SHEET_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes (poll for due one-way spreadsheet syncs)

async function processAllUserReminders(): Promise<void> {
  console.log('[Scheduler] Processing automatic reminders...');
  
  try {
    const results = await processOverdueReminders();
    
    if (results.length > 0) {
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      console.log(`[Scheduler] Reminders processed: ${successful} sent, ${failed} failed`);
    } else {
      console.log('[Scheduler] No reminders to send');
    }
  } catch (error) {
    console.error('[Scheduler] Error processing reminders:', error);
  }
}

async function processAllRecurring(): Promise<void> {
  console.log('[Scheduler] Processing recurring jobs/invoices...');
  
  try {
    const usersWithRecurring = await storage.getUsersWithRecurringItems();
    let totalJobs = 0;
    let totalInvoices = 0;
    
    for (const user of usersWithRecurring) {
      const results = await processRecurringForUser(user.id);
      totalJobs += results.jobs.filter(r => r.success).length;
      totalInvoices += results.invoices.filter(r => r.success).length;
    }
    
    if (totalJobs > 0 || totalInvoices > 0) {
      console.log(`[Scheduler] Recurring processed: ${totalJobs} jobs, ${totalInvoices} invoices`);
    } else if (usersWithRecurring.length === 0) {
      console.log('[Scheduler] No users with recurring items');
    }
  } catch (error) {
    console.error('[Scheduler] Error processing recurring:', error);
  }
}

async function processTrialExpirations(): Promise<void> {
  console.log('[Scheduler] Checking trial expirations...');
  
  try {
    const expiredCount = await checkAndExpireTrials();
    
    if (expiredCount > 0) {
      console.log(`[Scheduler] ${expiredCount} trials expired`);
    }
  } catch (error) {
    console.error('[Scheduler] Error checking trial expirations:', error);
  }
}

export function startReminderScheduler(): void {
  console.log('[Scheduler] Starting automatic reminder scheduler...');
  
  if (reminderInterval) {
    clearInterval(reminderInterval);
  }
  
  processAllUserReminders();
  
  reminderInterval = setInterval(processAllUserReminders, REMINDER_INTERVAL_MS);
  
  console.log(`[Scheduler] Reminder scheduler running every ${REMINDER_INTERVAL_MS / 60000} minutes`);
}

export function startRecurringScheduler(): void {
  console.log('[Scheduler] Starting recurring jobs/invoices scheduler...');
  
  if (recurringInterval) {
    clearInterval(recurringInterval);
  }
  
  processAllRecurring();
  
  recurringInterval = setInterval(processAllRecurring, RECURRING_INTERVAL_MS);
  
  console.log(`[Scheduler] Recurring scheduler running every ${RECURRING_INTERVAL_MS / 60000} minutes`);
}

export function startTrialScheduler(): void {
  console.log('[Scheduler] Starting trial expiration scheduler...');
  
  if (trialInterval) {
    clearInterval(trialInterval);
  }
  
  processTrialExpirations();
  
  trialInterval = setInterval(processTrialExpirations, TRIAL_CHECK_INTERVAL_MS);
  
  console.log(`[Scheduler] Trial scheduler running every ${TRIAL_CHECK_INTERVAL_MS / 60000} minutes`);
}

async function processAllAutomations(): Promise<void> {
  console.log('[Scheduler] Processing automation rules...');
  
  try {
    const { processed, errors } = await processTimeBasedAutomations();
    
    if (processed > 0 || errors > 0) {
      console.log(`[Scheduler] Automations processed: ${processed} successful, ${errors} failed`);
    } else {
      console.log('[Scheduler] No automation rules to process');
    }
  } catch (error) {
    console.error('[Scheduler] Error processing automations:', error);
  }
}

export function startAutomationScheduler(): void {
  console.log('[Scheduler] Starting automation rules scheduler...');
  
  if (automationInterval) {
    clearInterval(automationInterval);
  }
  
  // Run first time after a short delay to allow server startup
  setTimeout(processAllAutomations, 5000);
  
  automationInterval = setInterval(processAllAutomations, AUTOMATION_INTERVAL_MS);
  
  console.log(`[Scheduler] Automation scheduler running every ${AUTOMATION_INTERVAL_MS / 60000} minutes`);
}

async function processAutoArchive(): Promise<void> {
  console.log('[Scheduler] Processing auto-archive for old completed items...');
  
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Archive jobs that are done/invoiced and updated more than 30 days ago
    const archivedJobs = await db
      .update(jobs)
      .set({ archivedAt: new Date() })
      .where(
        and(
          isNull(jobs.archivedAt),
          or(eq(jobs.status, 'done'), eq(jobs.status, 'invoiced')),
          lt(jobs.updatedAt, thirtyDaysAgo)
        )
      )
      .returning();
    
    // Archive invoices that are paid and updated more than 30 days ago
    const archivedInvoices = await db
      .update(invoices)
      .set({ archivedAt: new Date() })
      .where(
        and(
          isNull(invoices.archivedAt),
          eq(invoices.status, 'paid'),
          lt(invoices.updatedAt, thirtyDaysAgo)
        )
      )
      .returning();
    
    // Archive quotes that are accepted/declined/expired and updated more than 30 days ago
    const archivedQuotes = await db
      .update(quotes)
      .set({ archivedAt: new Date() })
      .where(
        and(
          isNull(quotes.archivedAt),
          or(
            eq(quotes.status, 'accepted'),
            eq(quotes.status, 'declined'),
            eq(quotes.status, 'expired')
          ),
          lt(quotes.updatedAt, thirtyDaysAgo)
        )
      )
      .returning();
    
    const totalArchived = archivedJobs.length + archivedInvoices.length + archivedQuotes.length;
    if (totalArchived > 0) {
      console.log(`[Scheduler] Auto-archived: ${archivedJobs.length} jobs, ${archivedInvoices.length} invoices, ${archivedQuotes.length} quotes`);
    } else {
      console.log('[Scheduler] No items to auto-archive');
    }
  } catch (error) {
    console.error('[Scheduler] Error auto-archiving:', error);
  }
}

export function startArchiveScheduler(): void {
  console.log('[Scheduler] Starting auto-archive scheduler...');
  
  if (archiveInterval) {
    clearInterval(archiveInterval);
  }
  
  // Run first time after a delay
  setTimeout(processAutoArchive, 10000);
  
  archiveInterval = setInterval(processAutoArchive, ARCHIVE_INTERVAL_MS);
  
  console.log(`[Scheduler] Archive scheduler running every ${ARCHIVE_INTERVAL_MS / 3600000} hours`);
}

async function processSmsAutomations(): Promise<void> {
  console.log('[Scheduler] Processing SMS automation rules...');
  
  try {
    const now = new Date();
    let processed = 0;
    let errors = 0;
    
    // Get all active SMS automation rules
    const allRules = await db.select().from(smsAutomationRules)
      .where(eq(smsAutomationRules.isActive, true));
    
    for (const rule of allRules) {
      try {
        switch (rule.triggerType) {
          case 'quote_follow_up': {
            // Process quotes sent 3+ days ago without response
            const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
            const userQuotes = await db.select().from(quotes)
              .where(and(
                eq(quotes.userId, rule.userId),
                eq(quotes.status, 'sent'),
                lt(quotes.sentAt, threeDaysAgo)
              ));
            
            for (const quote of userQuotes) {
              const alreadyProcessed = await storage.getSmsAutomationLog(rule.id, 'quote', quote.id);
              if (!alreadyProcessed) {
                await processQuoteFollowUp(rule, quote);
                processed++;
              }
            }
            break;
          }
          
          case 'invoice_overdue': {
            // Process invoices 1+ days past due date
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const overdueInvoices = await db.select().from(invoices)
              .where(and(
                eq(invoices.userId, rule.userId),
                or(eq(invoices.status, 'sent'), eq(invoices.status, 'overdue')),
                lt(invoices.dueDate, yesterday)
              ));
            
            for (const invoice of overdueInvoices) {
              const alreadyProcessed = await storage.getSmsAutomationLog(rule.id, 'invoice', invoice.id);
              if (!alreadyProcessed) {
                await processInvoiceOverdue(rule, invoice);
                processed++;
              }
            }
            break;
          }
          
          case 'job_day_before': {
            // Process jobs scheduled for tomorrow
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
            const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000);
            
            const upcomingJobs = await db.select().from(jobs)
              .where(and(
                eq(jobs.userId, rule.userId),
                or(eq(jobs.status, 'scheduled'), eq(jobs.status, 'confirmed')),
                gte(jobs.scheduledAt, tomorrowStart),
                lt(jobs.scheduledAt, tomorrowEnd)
              ));
            
            for (const job of upcomingJobs) {
              const alreadyProcessed = await storage.getSmsAutomationLog(rule.id, 'job', job.id);
              if (!alreadyProcessed) {
                await processJobDayBefore(rule, job);
                processed++;
              }
            }
            break;
          }
        }
      } catch (ruleError) {
        console.error(`[SMS Automation] Error processing rule ${rule.id}:`, ruleError);
        errors++;
      }
    }
    
    if (processed > 0 || errors > 0) {
      console.log(`[Scheduler] SMS automations processed: ${processed} successful, ${errors} failed`);
    } else {
      console.log('[Scheduler] No SMS automations to process');
    }
    
    await processAutoQuoteFollowUps();
    await processAutoInvoiceReminders();
  } catch (error) {
    console.error('[Scheduler] Error processing SMS automations:', error);
  }
}

async function processQuoteFollowUp(rule: any, quote: any): Promise<void> {
  try {
    const { sendSmsToClient } = await import('./services/smsService');
    const client = await storage.getClientById(quote.clientId);
    if (!client?.phone) {
      await storage.createSmsAutomationLog({
        ruleId: rule.id,
        entityType: 'quote',
        entityId: quote.id,
        status: 'skipped',
        errorMessage: 'Client has no phone number',
      });
      return;
    }
    
    const quoteLink = quote.acceptanceToken 
      ? `${getProductionBaseUrl()}/portal/quote/${quote.acceptanceToken}` 
      : '';
    const message = rule.customMessage || `Hi ${client.name || 'there'}, just following up on quote #${quote.number || quote.id.slice(0, 8)} for "${quote.title || 'your project'}".${quoteLink ? ` View and accept here: ${quoteLink}` : ' Reply YES to accept or let us know if you have questions!'}`;
    
    await sendSmsToClient({
      businessOwnerId: rule.userId,
      senderUserId: rule.userId,
      clientPhone: client.phone,
      clientName: client.name,
      message,
    });
    
    await storage.createSmsAutomationLog({
      ruleId: rule.id,
      entityType: 'quote',
      entityId: quote.id,
      status: 'sent',
    });
    
    await storage.updateSmsAutomationRule(rule.id, rule.userId, {
      lastTriggeredAt: new Date(),
      triggerCount: (rule.triggerCount || 0) + 1,
    });
  } catch (error: unknown) {
    console.error(`[SMS Automation] Error sending quote follow-up:`, error);
    await storage.createSmsAutomationLog({
      ruleId: rule.id,
      entityType: 'quote',
      entityId: quote.id,
      status: 'failed',
      errorMessage: getErrorMessage(error),
    });
  }
}

async function processInvoiceOverdue(rule: any, invoice: any): Promise<void> {
  try {
    const { sendSmsToClient } = await import('./services/smsService');
    const client = await storage.getClientById(invoice.clientId);
    if (!client?.phone) {
      await storage.createSmsAutomationLog({
        ruleId: rule.id,
        entityType: 'invoice',
        entityId: invoice.id,
        status: 'skipped',
        errorMessage: 'Client has no phone number',
      });
      return;
    }
    
    const invoiceLink = invoice.paymentToken 
      ? `${getProductionBaseUrl()}/portal/invoice/${invoice.paymentToken}` 
      : '';
    const message = rule.customMessage || `Hi ${client.name || 'there'}, friendly reminder that invoice #${invoice.invoiceNumber || invoice.id} for $${invoice.total} is now overdue.${invoiceLink ? ` Pay online: ${invoiceLink}` : ' Please let us know if you have any questions.'}`;
    
    await sendSmsToClient({
      businessOwnerId: rule.userId,
      senderUserId: rule.userId,
      clientPhone: client.phone,
      clientName: client.name,
      message,
    });
    
    await storage.createSmsAutomationLog({
      ruleId: rule.id,
      entityType: 'invoice',
      entityId: invoice.id,
      status: 'sent',
    });
    
    await storage.updateSmsAutomationRule(rule.id, rule.userId, {
      lastTriggeredAt: new Date(),
      triggerCount: (rule.triggerCount || 0) + 1,
    });
  } catch (error: unknown) {
    console.error(`[SMS Automation] Error sending invoice overdue:`, error);
    await storage.createSmsAutomationLog({
      ruleId: rule.id,
      entityType: 'invoice',
      entityId: invoice.id,
      status: 'failed',
      errorMessage: getErrorMessage(error),
    });
  }
}

async function processJobDayBefore(rule: any, job: any): Promise<void> {
  try {
    const { sendSmsToClient } = await import('./services/smsService');
    const client = await storage.getClientById(job.clientId);
    if (!client?.phone) {
      await storage.createSmsAutomationLog({
        ruleId: rule.id,
        entityType: 'job',
        entityId: job.id,
        status: 'skipped',
        errorMessage: 'Client has no phone number',
      });
      return;
    }
    
    const scheduledDate = new Date(job.scheduledAt);
    const dateStr = scheduledDate.toLocaleDateString('en-AU', { weekday: 'long', month: 'long', day: 'numeric' });
    const timeStr = job.scheduledTime || 'as scheduled';
    
    const message = rule.customMessage || `Hi ${client.name || 'there'}, just a reminder about your appointment tomorrow (${dateStr}) at ${timeStr} for "${job.title || 'your job'}". See you then!`;
    
    await sendSmsToClient({
      businessOwnerId: rule.userId,
      senderUserId: rule.userId,
      clientPhone: client.phone,
      clientName: client.name,
      message,
    });
    
    await storage.createSmsAutomationLog({
      ruleId: rule.id,
      entityType: 'job',
      entityId: job.id,
      status: 'sent',
    });
    
    await storage.updateSmsAutomationRule(rule.id, rule.userId, {
      lastTriggeredAt: new Date(),
      triggerCount: (rule.triggerCount || 0) + 1,
    });
  } catch (error: unknown) {
    console.error(`[SMS Automation] Error sending job day before reminder:`, error);
    await storage.createSmsAutomationLog({
      ruleId: rule.id,
      entityType: 'job',
      entityId: job.id,
      status: 'failed',
      errorMessage: getErrorMessage(error),
    });
  }
}

async function processAutoQuoteFollowUps(): Promise<void> {
  try {
    const allSettings = await db.select().from(automationSettings)
      .where(eq(automationSettings.quoteFollowUpEnabled, true));
    
    if (allSettings.length === 0) return;
    
    let processed = 0;
    const now = new Date();
    
    for (const settings of allSettings) {
      try {
        const followUpDays = settings.quoteFollowUpDays || 3;
        const cutoffDate = new Date(now.getTime() - followUpDays * 24 * 60 * 60 * 1000);
        const channelType = (settings as any).quoteFollowUpType || 'email';
        
        const existingRules = await db.select().from(smsAutomationRules)
          .where(and(
            eq(smsAutomationRules.userId, settings.userId),
            eq(smsAutomationRules.triggerType, 'quote_follow_up'),
            eq(smsAutomationRules.isActive, true)
          ));
        if (existingRules.length > 0) continue;
        
        const userQuotes = await db.select().from(quotes)
          .where(and(
            eq(quotes.userId, settings.userId),
            eq(quotes.status, 'sent'),
            lt(quotes.sentAt, cutoffDate)
          ));
        
        for (const quote of userQuotes) {
          const alreadySent = await storage.hasReminderBeenSent(quote.id, 'auto_quote_followup');
          if (alreadySent) continue;
          
          try {
            const existingAutoLogs = await db.select().from(smsAutomationLogs)
              .where(and(
                eq(smsAutomationLogs.entityType, 'quote'),
                eq(smsAutomationLogs.entityId, quote.id),
                eq(smsAutomationLogs.status, 'sent')
              ));
            if (existingAutoLogs.length > 0) continue;
          } catch (e) { /* non-critical */ }
          
          const client = await storage.getClientById(quote.clientId);
          if (!client) continue;
          
          const quoteLink = (quote as any).acceptanceToken 
            ? `${getProductionBaseUrl()}/portal/quote/${(quote as any).acceptanceToken}` 
            : '';
          const quoteNumber = (quote as any).number || quote.id.slice(0, 8);
          const quoteTitle = (quote as any).title || 'your project';
          
          let smsSent = false;
          let emailSent = false;
          
          try {
            if ((channelType === 'sms' || channelType === 'both') && client.phone) {
              const { sendSmsToClient } = await import('./services/smsService');
              const message = `Hi ${client.name || 'there'}, just following up on quote #${quoteNumber} for "${quoteTitle}".${quoteLink ? ` View and accept here: ${quoteLink}` : ' Let us know if you have questions!'}`;
              
              await sendSmsToClient({
                businessOwnerId: settings.userId,
                senderUserId: settings.userId,
                clientPhone: client.phone,
                clientName: client.name,
                message,
              });
              smsSent = true;
            }
            
            if ((channelType === 'email' || channelType === 'both') && client.email) {
              const { sendQuoteEmail } = await import('./emailService');
              const businessSettingsData = await storage.getBusinessSettings(settings.userId);
              await sendQuoteEmail(
                { ...quote, number: quoteNumber, title: quoteTitle },
                client,
                businessSettingsData || {},
                quoteLink || null
              );
              emailSent = true;
            }
            
            if (!smsSent && !emailSent) continue;
            
            await storage.createInvoiceReminderLog({
              invoiceId: quote.id,
              userId: settings.userId,
              reminderType: 'auto_quote_followup',
              daysPastDue: followUpDays,
              sentVia: channelType,
              emailSent,
              smsSent,
            });
            
            await storage.createActivityLog({
              userId: settings.userId,
              type: 'quote_sent',
              title: 'Auto follow-up sent',
              description: `Automatic follow-up sent for quote #${quoteNumber}`,
              entityType: 'quote',
              entityId: quote.id,
              metadata: {
                deliveryMethod: channelType,
                clientName: client.name,
                clientPhone: client.phone,
                clientEmail: client.email,
                automated: true,
                quoteNumber,
              },
            });
            
            processed++;
          } catch (sendError: unknown) {
            console.error(`[Auto Quote Follow-up] Error sending follow-up for quote ${quote.id}:`, getErrorMessage(sendError));
          }
        }
      } catch (userError) {
        console.error(`[Auto Quote Follow-up] Error processing user ${settings.userId}:`, userError);
      }
    }
    
    if (processed > 0) {
      console.log(`[Scheduler] Auto quote follow-ups sent: ${processed}`);
    }
  } catch (error) {
    console.error('[Scheduler] Error processing auto quote follow-ups:', error);
  }
}

async function processAutoInvoiceReminders(): Promise<void> {
  try {
    const allSettings = await db.select().from(automationSettings)
      .where(eq(automationSettings.invoiceReminderEnabled, true));
    
    if (allSettings.length === 0) return;
    
    let processed = 0;
    const now = new Date();
    
    for (const settings of allSettings) {
      try {
        const daysBeforeDue = settings.invoiceReminderDaysBeforeDue || 3;
        const targetDate = new Date(now.getTime() + daysBeforeDue * 24 * 60 * 60 * 1000);
        const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const targetEnd = new Date(targetStart.getTime() + 24 * 60 * 60 * 1000);
        const channelType = (settings as any).invoiceReminderType || 'email';
        
        const upcomingInvoices = await db.select().from(invoices)
          .where(and(
            eq(invoices.userId, settings.userId),
            or(eq(invoices.status, 'sent'), eq(invoices.status, 'viewed')),
            gte(invoices.dueDate, targetStart),
            lt(invoices.dueDate, targetEnd)
          ));
        
        for (const invoice of upcomingInvoices) {
          const alreadySent = await storage.hasReminderBeenSent(invoice.id, 'auto_predue_reminder');
          if (alreadySent) continue;
          
          const client = await storage.getClientById(invoice.clientId);
          if (!client) continue;
          
          const invoiceNumber = (invoice as any).invoiceNumber || invoice.id;
          const invoiceLink = (invoice as any).paymentToken 
            ? `${getProductionBaseUrl()}/portal/invoice/${(invoice as any).paymentToken}` 
            : '';
          
          let smsSent = false;
          let emailSent = false;
          
          try {
            if ((channelType === 'sms' || channelType === 'both') && client.phone) {
              const { sendSmsToClient } = await import('./services/smsService');
              const message = `Hi ${client.name || 'there'}, friendly reminder that invoice #${invoiceNumber} for $${invoice.total} is due in ${daysBeforeDue} days.${invoiceLink ? ` Pay online: ${invoiceLink}` : ''}`;
              
              await sendSmsToClient({
                businessOwnerId: settings.userId,
                senderUserId: settings.userId,
                clientPhone: client.phone,
                clientName: client.name,
                message,
              });
              smsSent = true;
            }
            
            if ((channelType === 'email' || channelType === 'both') && client.email) {
              const { sendInvoiceEmail } = await import('./emailService');
              const businessSettingsData = await storage.getBusinessSettings(settings.userId);
              await sendInvoiceEmail(
                { ...invoice, invoiceNumber },
                client,
                businessSettingsData || {},
                invoiceLink || null
              );
              emailSent = true;
            }
            
            if (!smsSent && !emailSent) continue;
            
            await storage.createInvoiceReminderLog({
              invoiceId: invoice.id,
              userId: settings.userId,
              reminderType: 'auto_predue_reminder',
              daysPastDue: -daysBeforeDue,
              sentVia: channelType,
              emailSent,
              smsSent,
            });
            
            await storage.createActivityLog({
              userId: settings.userId,
              type: 'invoice_sent',
              title: 'Auto reminder sent',
              description: `Automatic reminder sent for invoice #${invoiceNumber}`,
              entityType: 'invoice',
              entityId: invoice.id,
              metadata: {
                deliveryMethod: channelType,
                clientName: client.name,
                clientPhone: client.phone,
                clientEmail: client.email,
                automated: true,
                invoiceNumber,
              },
            });
            
            processed++;
          } catch (sendError: unknown) {
            console.error(`[Auto Invoice Reminder] Error sending reminder for invoice ${invoice.id}:`, getErrorMessage(sendError));
          }
        }
      } catch (userError) {
        console.error(`[Auto Invoice Reminder] Error processing user ${settings.userId}:`, userError);
      }
    }
    
    if (processed > 0) {
      console.log(`[Scheduler] Auto invoice pre-due reminders sent: ${processed}`);
    }
  } catch (error) {
    console.error('[Scheduler] Error processing auto invoice reminders:', error);
  }
}

export function startSmsAutomationScheduler(): void {
  console.log('[Scheduler] Starting SMS automation scheduler...');
  
  if (smsAutomationInterval) {
    clearInterval(smsAutomationInterval);
  }
  
  // Run first time after a short delay
  setTimeout(processSmsAutomations, 10000);
  
  smsAutomationInterval = setInterval(processSmsAutomations, SMS_AUTOMATION_INTERVAL_MS);
  
  console.log(`[Scheduler] SMS automation scheduler running every ${SMS_AUTOMATION_INTERVAL_MS / 60000} minutes`);
}

export function startBillingReminderScheduler(): void {
  console.log('[Scheduler] Starting billing reminder scheduler...');
  
  if (billingReminderInterval) {
    clearInterval(billingReminderInterval);
  }
  
  // Run first time after a delay
  setTimeout(async () => {
    console.log('[Scheduler] Processing billing reminders...');
    try {
      const stats = await runDailyBillingReminders();
      console.log(`[Scheduler] Billing reminders: ${stats.emailsSent} emails, ${stats.smsSent} SMS, ${stats.errors} errors`);
    } catch (error) {
      console.error('[Scheduler] Error processing billing reminders:', error);
    }
  }, 15000);
  
  billingReminderInterval = setInterval(async () => {
    console.log('[Scheduler] Processing billing reminders...');
    try {
      const stats = await runDailyBillingReminders();
      console.log(`[Scheduler] Billing reminders: ${stats.emailsSent} emails, ${stats.smsSent} SMS, ${stats.errors} errors`);
    } catch (error) {
      console.error('[Scheduler] Error processing billing reminders:', error);
    }
  }, BILLING_REMINDER_INTERVAL_MS);
  
  console.log(`[Scheduler] Billing reminder scheduler running every ${BILLING_REMINDER_INTERVAL_MS / 3600000} hours`);
}

async function processInstallmentReminders(): Promise<void> {
  console.log('[Scheduler] Processing installment reminders...');
  
  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    // Get all active payment schedules
    const allSchedules = await db.select().from(paymentSchedules)
      .where(eq(paymentSchedules.isActive, true));
    
    let remindersCreated = 0;
    
    for (const schedule of allSchedules) {
      // Get pending installments for this schedule
      const pendingInstallments = await db.select().from(paymentInstallments)
        .where(and(
          eq(paymentInstallments.scheduleId, schedule.id),
          eq(paymentInstallments.status, 'pending'),
          lte(paymentInstallments.dueDate, threeDaysFromNow),
          gte(paymentInstallments.dueDate, now)
        ));
      
      for (const installment of pendingInstallments) {
        // Check if we already sent a reminder today
        const existingNotifications = await storage.getNotifications(schedule.userId);
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        
        const alreadyNotified = existingNotifications.some(n => 
          n.type === 'installment_due' && 
          n.relatedId === schedule.invoiceId &&
          new Date(n.createdAt ?? 0) >= todayStart &&
          n.message.includes(`Installment ${installment.installmentNumber}`)
        );
        
        if (!alreadyNotified) {
          const daysUntilDue = Math.ceil((new Date(installment.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const client = await storage.getClient(schedule.clientId, schedule.userId);
          
          await notifyInstallmentDue(
            storage,
            schedule.userId,
            installment,
            schedule,
            client?.name || 'Customer',
            daysUntilDue
          );
          remindersCreated++;
        }
      }
    }
    
    console.log(`[Scheduler] Installment reminders: ${remindersCreated} created`);
  } catch (error) {
    console.error('[Scheduler] Error processing installment reminders:', error);
  }
}

export function startInstallmentReminderScheduler(): void {
  console.log('[Scheduler] Starting installment reminder scheduler...');
  
  if (installmentReminderInterval) {
    clearInterval(installmentReminderInterval);
  }
  
  // Run first time after a delay
  setTimeout(processInstallmentReminders, 20000);
  
  installmentReminderInterval = setInterval(processInstallmentReminders, INSTALLMENT_REMINDER_INTERVAL_MS);
  
  console.log(`[Scheduler] Installment reminder scheduler running every ${INSTALLMENT_REMINDER_INTERVAL_MS / 3600000} hours`);
}

let quoteFollowUpInterval: NodeJS.Timeout | null = null;
const QUOTE_FOLLOWUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function processQuoteFollowUps(): Promise<void> {
  console.log('[Scheduler] Processing quote follow-ups...');
  
  try {
    const allUsers = await storage.getAllUsersWithSettings();
    let sentCount = 0;
    
    for (const user of allUsers) {
      const settings = user.businessSettings;
      if (!settings?.autoQuoteFollowUp) continue;
      
      const followUpDays = settings.quoteFollowUpDays || 3;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - followUpDays);
      
      try {
        const userQuotes = await storage.getQuotes(user.id);
        const pendingQuotes = userQuotes.filter((q: any) => {
          if (q.status !== 'sent') return false;
          const sentDate = q.sentAt ? new Date(q.sentAt) : q.createdAt ? new Date(q.createdAt) : null;
          if (!sentDate) return false;
          return sentDate <= cutoffDate;
        });
        
        for (const quote of pendingQuotes) {
          // Check if we already sent a follow-up notification for this quote
          // Use notifications table to dedup - check if quote_expiring notification exists for this quote
          try {
            const existingNotifications = await storage.getNotifications(user.id);
            const alreadyNotified = existingNotifications.some((n: any) => 
              n.type === 'quote_expiring' && n.relatedId === quote.id
            );
            if (alreadyNotified) continue;
          } catch (e) {
            // If we can't check, skip this quote to be safe (prevent spam)
            console.error('[QuoteFollowUp] Error checking existing notifications:', e);
            continue;
          }
          
          try {
            const { notifyQuoteExpiring } = await import('./notifications');
            const client = quote.clientId ? await storage.getClient(quote.clientId, user.id) : null;
            await notifyQuoteExpiring(storage, user.id, quote, client?.name || 'Client', followUpDays);
          } catch (e) {
            console.error('[QuoteFollowUp] Notification error:', e);
          }
          
          sentCount++;
        }
      } catch (e) {
        console.error(`[QuoteFollowUp] Error processing quotes for user ${user.id}:`, e);
      }
    }
    
    if (sentCount > 0) {
      console.log(`[Scheduler] Quote follow-ups: ${sentCount} notifications created`);
    }
  } catch (error) {
    console.error('[Scheduler] Error processing quote follow-ups:', error);
  }
}

export function startQuoteFollowUpScheduler(): void {
  console.log('[Scheduler] Starting quote follow-up scheduler...');
  
  if (quoteFollowUpInterval) {
    clearInterval(quoteFollowUpInterval);
  }
  
  setTimeout(processQuoteFollowUps, 15000);
  
  quoteFollowUpInterval = setInterval(processQuoteFollowUps, QUOTE_FOLLOWUP_INTERVAL_MS);
  
  console.log(`[Scheduler] Quote follow-up scheduler running every ${QUOTE_FOLLOWUP_INTERVAL_MS / 60000} minutes`);
}

async function processComplianceExpiry(): Promise<void> {
  console.log('[Scheduler] Processing compliance document expiry alerts...');
  
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const expiringDocs = await db.select().from(complianceDocuments)
      .where(
        and(
          lte(complianceDocuments.expiryDate, thirtyDaysFromNow),
          not(isNull(complianceDocuments.expiryDate))
        )
      )
      .orderBy(complianceDocuments.expiryDate);
    
    if (expiringDocs.length === 0) {
      console.log('[Scheduler] No expiring compliance documents found');
      return;
    }
    
    const groupedByOwner: Record<string, typeof expiringDocs> = {};
    for (const doc of expiringDocs) {
      if (!groupedByOwner[doc.businessOwnerId]) {
        groupedByOwner[doc.businessOwnerId] = [];
      }
      groupedByOwner[doc.businessOwnerId].push(doc);
    }
    
    // Dedupe: fetch prior compliance-document expiry notifications for these
    // docs; the notifications table has no unique constraint, so relying on a
    // duplicate-key error (as before) never worked and repeated alerts daily.
    const docIds = expiringDocs.map(d => d.id);
    const priorDocNotifications = await db.select({
      relatedId: notifications.relatedId,
      priority: notifications.priority,
    }).from(notifications)
      .where(
        and(
          eq(notifications.type, 'compliance_expiry'),
          eq(notifications.relatedType, 'compliance_document'),
          inArray(notifications.relatedId, docIds)
        )
      );
    const alreadyNotified = new Set(priorDocNotifications.map(n => `${n.relatedId}:${n.priority}`));
    
    let notificationsCreated = 0;
    
    const typeLabels: Record<string, string> = {
      licence: 'Trade Licence',
      insurance: 'Insurance Certificate',
      white_card: 'White Card',
      vehicle_rego: 'Vehicle Registration',
      certification: 'Certification',
      other: 'Document',
    };
    
    for (const [businessOwnerId, docs] of Object.entries(groupedByOwner)) {
      for (const doc of docs) {
        const expiryDate = new Date(doc.expiryDate!);
        const daysUntil = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const typeLabel = typeLabels[doc.type] || 'Document';
        
        const isExpired = daysUntil <= 0;
        const isUrgent = daysUntil <= 7;
        const isWarning = daysUntil <= 30;
        
        if (!isExpired && !isUrgent && !isWarning) continue;
        
        if (isExpired && daysUntil < -30) continue;
        
        let title: string;
        let message: string;
        let priority: string;
        
        if (isExpired) {
          title = `${typeLabel} EXPIRED: ${doc.title}`;
          message = `Your ${typeLabel.toLowerCase()} "${doc.title}"${doc.documentNumber ? ` (#${doc.documentNumber})` : ''} expired on ${expiryDate.toLocaleDateString('en-AU')}. Please renew immediately to stay compliant.`;
          priority = 'urgent';
        } else if (isUrgent) {
          title = `${typeLabel} expiring in ${daysUntil} day${daysUntil === 1 ? '' : 's'}: ${doc.title}`;
          message = `Your ${typeLabel.toLowerCase()} "${doc.title}"${doc.documentNumber ? ` (#${doc.documentNumber})` : ''} expires on ${expiryDate.toLocaleDateString('en-AU')}. Renew soon to avoid compliance issues.`;
          priority = 'important';
        } else {
          title = `${typeLabel} expiring in ${daysUntil} days: ${doc.title}`;
          message = `Your ${typeLabel.toLowerCase()} "${doc.title}"${doc.documentNumber ? ` (#${doc.documentNumber})` : ''} expires on ${expiryDate.toLocaleDateString('en-AU')}. Consider starting the renewal process.`;
          priority = 'info';
        }
        
        // Dedupe per document per urgency stage — escalations (30d → 7d →
        // expired) still notify, but the same stage never repeats.
        if (alreadyNotified.has(`${doc.id}:${priority}`)) continue;
        
        try {
          await storage.createNotification({
            userId: businessOwnerId,
            type: 'compliance_expiry',
            title,
            message,
            relatedId: doc.id,
            relatedType: 'compliance_document',
            priority,
            actionUrl: '/files',
            actionLabel: 'View Documents',
          });
          alreadyNotified.add(`${doc.id}:${priority}`);
          notificationsCreated++;
        } catch (notifError: any) {
          console.error(`[Scheduler] Error creating compliance notification for doc ${doc.id}:`, notifError);
        }
      }
    }
    
    if (notificationsCreated > 0) {
      console.log(`[Scheduler] Created ${notificationsCreated} compliance expiry notifications`);
    } else {
      console.log('[Scheduler] No new compliance expiry notifications needed');
    }
  } catch (error) {
    console.error('[Scheduler] Error processing compliance expiry alerts:', error);
  }

  await processTrainingRecordExpiry();
}

// Training certificates (bulk-uploaded into training_records) also carry an
// expiry date, but were never covered by the compliance expiry pass above.
// Same daily scheduler, same notification style; deduped per record per
// urgency stage (info/important/urgent) via an explicit existing-notification
// check, since notifications has no unique constraint to rely on.
async function processTrainingRecordExpiry(): Promise<void> {
  console.log('[Scheduler] Processing training certificate expiry alerts...');

  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    // trainingRecords.expiryDate is text yyyy-mm-dd, so compare lexicographically
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().slice(0, 10);

    const expiringRecords = await db.select().from(trainingRecords)
      .where(
        and(
          not(isNull(trainingRecords.expiryDate)),
          lte(trainingRecords.expiryDate, thirtyDaysStr)
        )
      )
      .orderBy(trainingRecords.expiryDate);

    if (expiringRecords.length === 0) {
      console.log('[Scheduler] No expiring training certificates found');
      return;
    }

    // Dedupe: fetch prior training-record expiry notifications for these records
    const recordIds = expiringRecords.map(r => r.id);
    const priorNotifications = await db.select({
      relatedId: notifications.relatedId,
      priority: notifications.priority,
    }).from(notifications)
      .where(
        and(
          eq(notifications.type, 'compliance_expiry'),
          eq(notifications.relatedType, 'training_record'),
          inArray(notifications.relatedId, recordIds)
        )
      );
    const alreadyNotified = new Set(priorNotifications.map(n => `${n.relatedId}:${n.priority}`));

    let notificationsCreated = 0;

    for (const record of expiringRecords) {
      const expiryDate = new Date(`${record.expiryDate}T00:00:00`);
      if (isNaN(expiryDate.getTime())) continue;
      const daysUntil = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const isExpired = daysUntil <= 0;
      const isUrgent = daysUntil <= 7;

      // Stop re-alerting once a cert has been expired for more than 30 days
      if (isExpired && daysUntil < -30) continue;

      const certLabel = `${record.courseName}${record.workerName ? ` — ${record.workerName}` : ''}`;
      let title: string;
      let message: string;
      let priority: string;

      if (isExpired) {
        title = `Training Certificate EXPIRED: ${certLabel}`;
        message = `The training certificate "${record.courseName}"${record.certificateNumber ? ` (#${record.certificateNumber})` : ''} for ${record.workerName} expired on ${expiryDate.toLocaleDateString('en-AU')}. Arrange renewal training immediately to stay compliant.`;
        priority = 'urgent';
      } else if (isUrgent) {
        title = `Training Certificate expiring in ${daysUntil} day${daysUntil === 1 ? '' : 's'}: ${certLabel}`;
        message = `The training certificate "${record.courseName}"${record.certificateNumber ? ` (#${record.certificateNumber})` : ''} for ${record.workerName} expires on ${expiryDate.toLocaleDateString('en-AU')}. Book renewal training soon to avoid compliance issues.`;
        priority = 'important';
      } else {
        title = `Training Certificate expiring in ${daysUntil} days: ${certLabel}`;
        message = `The training certificate "${record.courseName}"${record.certificateNumber ? ` (#${record.certificateNumber})` : ''} for ${record.workerName} expires on ${expiryDate.toLocaleDateString('en-AU')}. Consider booking renewal training.`;
        priority = 'info';
      }

      // Dedupe per record per urgency stage — escalations (30d → 7d → expired)
      // still notify, but the same stage never repeats.
      if (alreadyNotified.has(`${record.id}:${priority}`)) continue;

      try {
        await storage.createNotification({
          userId: record.userId,
          type: 'compliance_expiry',
          title,
          message,
          relatedId: record.id,
          relatedType: 'training_record',
          priority,
          actionUrl: '/whs',
          actionLabel: 'View Training Records',
        });
        alreadyNotified.add(`${record.id}:${priority}`);
        notificationsCreated++;
      } catch (notifError: any) {
        console.error(`[Scheduler] Error creating training expiry notification for record ${record.id}:`, notifError);
      }
    }

    if (notificationsCreated > 0) {
      console.log(`[Scheduler] Created ${notificationsCreated} training certificate expiry notifications`);
    } else {
      console.log('[Scheduler] No new training certificate expiry notifications needed');
    }
  } catch (error) {
    console.error('[Scheduler] Error processing training certificate expiry alerts:', error);
  }
}

export function startComplianceExpiryScheduler(): void {
  console.log('[Scheduler] Starting compliance expiry alert scheduler...');
  
  if (complianceExpiryInterval) {
    clearInterval(complianceExpiryInterval);
  }
  
  setTimeout(processComplianceExpiry, 15000);
  
  complianceExpiryInterval = setInterval(processComplianceExpiry, COMPLIANCE_EXPIRY_INTERVAL_MS);
  
  console.log(`[Scheduler] Compliance expiry scheduler running every ${COMPLIANCE_EXPIRY_INTERVAL_MS / 3600000} hours`);
}

// One-way Excel/Google Sheets sync (Task #306): polls for owners whose
// scheduled export is due and pushes their data out. Strictly outbound.
async function processSheetSyncs(): Promise<void> {
  try {
    const { processDueSheetSyncs } = await import('./sheetSync');
    await processDueSheetSyncs();
  } catch (error) {
    console.error('[Scheduler] Error processing sheet syncs:', error);
  }
}

export function startSheetSyncScheduler(): void {
  console.log('[Scheduler] Starting sheet sync scheduler...');

  if (sheetSyncInterval) {
    clearInterval(sheetSyncInterval);
  }

  setTimeout(processSheetSyncs, 20000);

  sheetSyncInterval = setInterval(processSheetSyncs, SHEET_SYNC_INTERVAL_MS);

  console.log(`[Scheduler] Sheet sync scheduler running every ${SHEET_SYNC_INTERVAL_MS / 60000} minutes`);
}

export function startAllSchedulers(): void {
  startReminderScheduler();
  startRecurringScheduler();
  startTrialScheduler();
  startAutomationScheduler();
  startArchiveScheduler();
  startSmsAutomationScheduler();
  startBillingReminderScheduler();
  startInstallmentReminderScheduler();
  startQuoteFollowUpScheduler();
  startComplianceExpiryScheduler();
  startSheetSyncScheduler();
}

export function stopAllSchedulers(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
  
  if (recurringInterval) {
    clearInterval(recurringInterval);
    recurringInterval = null;
  }
  
  if (trialInterval) {
    clearInterval(trialInterval);
    trialInterval = null;
  }
  
  if (automationInterval) {
    clearInterval(automationInterval);
    automationInterval = null;
  }
  
  if (archiveInterval) {
    clearInterval(archiveInterval);
    archiveInterval = null;
  }
  
  if (smsAutomationInterval) {
    clearInterval(smsAutomationInterval);
    smsAutomationInterval = null;
  }
  
  if (billingReminderInterval) {
    clearInterval(billingReminderInterval);
    billingReminderInterval = null;
  }
  
  if (installmentReminderInterval) {
    clearInterval(installmentReminderInterval);
    installmentReminderInterval = null;
  }
  
  if (quoteFollowUpInterval) {
    clearInterval(quoteFollowUpInterval);
    quoteFollowUpInterval = null;
  }
  
  if (complianceExpiryInterval) {
    clearInterval(complianceExpiryInterval);
    complianceExpiryInterval = null;
  }
  
  if (sheetSyncInterval) {
    clearInterval(sheetSyncInterval);
    sheetSyncInterval = null;
  }
  
  console.log('[Scheduler] All schedulers stopped');
}
