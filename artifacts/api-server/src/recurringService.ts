import { getErrorMessage } from "./lib/errors";
import { storage } from './storage';
import type { Job, Invoice } from '@workspace/db';

export interface RecurringResult {
  type: 'job' | 'invoice';
  originalId: string;
  newId?: string;
  success: boolean;
  error?: string;
}

function calculateNextRecurrence(
  currentDate: Date,
  pattern: string,
  interval: number = 1
): Date {
  const next = new Date(currentDate);
  
  switch (pattern) {
    case 'daily':
      next.setDate(next.getDate() + interval);
      break;
    case 'weekly':
      next.setDate(next.getDate() + (7 * interval));
      break;
    case 'fortnightly':
      next.setDate(next.getDate() + (14 * interval));
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + interval);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + (3 * interval));
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + interval);
      break;
    default:
      next.setMonth(next.getMonth() + interval);
  }
  
  return next;
}

function generateInvoiceNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `INV-${timestamp}-${random}`;
}

export async function processRecurringJobsForUser(userId: string): Promise<RecurringResult[]> {
  const results: RecurringResult[] = [];
  
  try {
    const recurringJobs = await storage.getRecurringJobsDueForUser(userId);
    
    for (const job of recurringJobs) {
      try {
        if (!job.recurrencePattern || !job.isRecurring) continue;
        
        if (job.recurrenceEndDate && new Date(job.recurrenceEndDate) < new Date()) {
          await storage.updateJob(job.id, job.userId, { 
            isRecurring: false,
            recurrencePattern: null,
            recurrenceInterval: null,
            recurrenceEndDate: null,
            nextRecurrenceDate: null,
          });
          continue;
        }
        
        const nextDate = calculateNextRecurrence(
          new Date(job.nextRecurrenceDate || new Date()),
          job.recurrencePattern,
          job.recurrenceInterval || 1
        );
        
        await storage.updateJob(job.id, job.userId, {
          nextRecurrenceDate: nextDate,
        });
        
        const newJob = await storage.createJob({
          userId: job.userId,
          clientId: job.clientId,
          title: job.title,
          description: job.description,
          status: 'pending',
          scheduledAt: job.nextRecurrenceDate,
          assignedTo: job.assignedTo,
          notes: job.notes,
          address: job.address,
          photos: [],
          parentJobId: job.id,
          isRecurring: false,
        });

        // Note: job number is auto-generated inside storage.createJob when a prefix is configured.
        results.push({
          type: 'job',
          originalId: job.id,
          newId: newJob.id,
          success: true,
        });
      } catch (error: unknown) {
        console.error(`Error processing recurring job ${job.id}:`, error);
        results.push({
          type: 'job',
          originalId: job.id,
          success: false,
          error: getErrorMessage(error),
        });
      }
    }
  } catch (error) {
    console.error('Error fetching recurring jobs:', error);
  }
  
  return results;
}

export async function processRecurringInvoicesForUser(userId: string): Promise<RecurringResult[]> {
  const results: RecurringResult[] = [];
  
  try {
    const recurringInvoices = await storage.getRecurringInvoicesDueForUser(userId);
    
    for (const invoice of recurringInvoices) {
      try {
        if (!invoice.recurrencePattern || !invoice.isRecurring) continue;
        
        if (invoice.recurrenceEndDate && new Date(invoice.recurrenceEndDate) < new Date()) {
          await storage.updateInvoice(invoice.id, invoice.userId, { 
            isRecurring: false,
            recurrencePattern: null,
            recurrenceInterval: null,
            recurrenceEndDate: null,
            nextRecurrenceDate: null,
          });
          continue;
        }
        
        const nextDate = calculateNextRecurrence(
          new Date(invoice.nextRecurrenceDate || new Date()),
          invoice.recurrencePattern,
          invoice.recurrenceInterval || 1
        );
        
        await storage.updateInvoice(invoice.id, invoice.userId, {
          nextRecurrenceDate: nextDate,
        });
        
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);
        
        const lineItems = await storage.getInvoiceLineItems(invoice.id);
        
        const newInvoice = await storage.createInvoice({
          userId: invoice.userId,
          clientId: invoice.clientId,
          jobId: invoice.jobId,
          quoteId: invoice.quoteId,
          number: generateInvoiceNumber(),
          title: invoice.title,
          description: invoice.description,
          dueDate,
          subtotal: invoice.subtotal,
          gstAmount: invoice.gstAmount,
          total: invoice.total,
          status: 'draft',
          notes: invoice.notes,
          parentInvoiceId: invoice.id,
          isRecurring: false,
        });
        
        for (const item of lineItems) {
          await storage.createInvoiceLineItem({
            invoiceId: newInvoice.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            sortOrder: item.sortOrder,
          });
        }
        
        results.push({
          type: 'invoice',
          originalId: invoice.id,
          newId: newInvoice.id,
          success: true,
        });
      } catch (error: unknown) {
        console.error(`Error processing recurring invoice ${invoice.id}:`, error);
        results.push({
          type: 'invoice',
          originalId: invoice.id,
          success: false,
          error: getErrorMessage(error),
        });
      }
    }
  } catch (error) {
    console.error('Error fetching recurring invoices:', error);
  }
  
  return results;
}

export async function processRecurringForUser(userId: string): Promise<{
  jobs: RecurringResult[];
  invoices: RecurringResult[];
}> {
  const [jobs, invoices] = await Promise.all([
    processRecurringJobsForUser(userId),
    processRecurringInvoicesForUser(userId),
  ]);
  
  return { jobs, invoices };
}

export async function createRecurringJob(
  jobData: Parameters<typeof storage.createJob>[0] & {
    recurrencePattern: string;
    recurrenceInterval?: number;
    recurrenceEndDate?: Date;
  }
): Promise<Job> {
  const nextRecurrence = calculateNextRecurrence(
    new Date(jobData.scheduledAt || new Date()),
    jobData.recurrencePattern,
    jobData.recurrenceInterval || 1
  );
  
  const job = await storage.createJob({
    ...jobData,
    isRecurring: true,
    nextRecurrenceDate: nextRecurrence,
  });

  // Note: job number is auto-generated inside storage.createJob when a prefix is configured.
  return job;
}

export async function createRecurringInvoice(
  invoiceData: Parameters<typeof storage.createInvoice>[0] & {
    recurrencePattern: string;
    recurrenceInterval?: number;
    recurrenceEndDate?: Date;
  }
): Promise<Invoice> {
  const nextRecurrence = calculateNextRecurrence(
    new Date(),
    invoiceData.recurrencePattern,
    invoiceData.recurrenceInterval || 1
  );
  
  const invoice = await storage.createInvoice({
    ...invoiceData,
    isRecurring: true,
    nextRecurrenceDate: nextRecurrence,
  });
  
  return invoice;
}

export async function stopRecurring(
  type: 'job' | 'invoice',
  id: string,
  userId: string
): Promise<boolean> {
  try {
    if (type === 'job') {
      await storage.updateJob(id, userId, {
        isRecurring: false,
        recurrencePattern: null,
        recurrenceInterval: null,
        recurrenceEndDate: null,
        nextRecurrenceDate: null,
      });
    } else {
      await storage.updateInvoice(id, userId, {
        isRecurring: false,
        recurrencePattern: null,
        recurrenceInterval: null,
        recurrenceEndDate: null,
        nextRecurrenceDate: null,
      });
    }
    return true;
  } catch (error) {
    console.error(`Error stopping recurring ${type}:`, error);
    return false;
  }
}
