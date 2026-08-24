import { storage } from './storage';
import { sendSystemEmail, sendInvoiceEmail } from './emailService';
import { notifyInvoiceOverdue } from './pushNotifications';
import { notifyInvoiceOverdue as notifyInvoiceOverdueDB } from './notifications';
import { sendSMS } from './twilioClient';
import { sendCustomerReply } from './services/smsService';
import { getProductionBaseUrl } from './urlHelper';
import { getErrorMessage } from "./lib/errors";

interface ReminderResult {
  invoiceId: string;
  success: boolean;
  emailSent: boolean;
  smsSent: boolean;
  error?: string;
}

// Validate Australian mobile number format
function isValidAustralianMobile(phone: string): boolean {
  if (!phone) return false;
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  // Australian mobiles: 04xx xxx xxx or +614xx xxx xxx
  return /^(04\d{8}|614\d{8})$/.test(cleaned);
}

// Format phone to E.164 for SMS
function formatPhoneForSMS(phone: string): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('04') && cleaned.length === 10) {
    return '+61' + cleaned.substring(1);
  }
  if (cleaned.startsWith('614') && cleaned.length === 11) {
    return '+' + cleaned;
  }
  return null;
}

export const REMINDER_TEMPLATES = {
  friendly: {
    7: (clientName: string, invoiceNumber: string, amount: string, businessName: string, paymentLink: string) => ({
      subject: `Friendly Reminder: Invoice ${invoiceNumber} from ${businessName}`,
      emailBody: `Hi ${clientName},\n\nJust a friendly reminder that invoice ${invoiceNumber} for $${amount} was due a week ago. If you've already paid, thank you and please disregard this message!${paymentLink ? `\n\nPay online: ${paymentLink}` : ''}\n\nIf you have any questions, just reply to this email.\n\nCheers,\n${businessName}`,
      smsBody: `Hi ${clientName}, friendly reminder that invoice ${invoiceNumber} for $${amount} is now overdue. Thanks! - ${businessName}${paymentLink ? `\nPay here: ${paymentLink}` : ''}`
    }),
    14: (clientName: string, invoiceNumber: string, amount: string, businessName: string, paymentLink: string) => ({
      subject: `Payment Reminder: Invoice ${invoiceNumber} - 2 Weeks Overdue`,
      emailBody: `Hi ${clientName},\n\nThis is a reminder that invoice ${invoiceNumber} for $${amount} is now 2 weeks overdue. We'd appreciate it if you could arrange payment at your earliest convenience.${paymentLink ? `\n\nPay online: ${paymentLink}` : ''}\n\nIf there are any issues or you'd like to discuss payment options, please get in touch.\n\nThanks,\n${businessName}`,
      smsBody: `Hi ${clientName}, invoice ${invoiceNumber} for $${amount} is 2 weeks overdue. Please arrange payment. Thanks - ${businessName}${paymentLink ? `\nPay here: ${paymentLink}` : ''}`
    }),
    30: (clientName: string, invoiceNumber: string, amount: string, businessName: string, paymentLink: string) => ({
      subject: `Urgent: Invoice ${invoiceNumber} - 30 Days Overdue`,
      emailBody: `Hi ${clientName},\n\nInvoice ${invoiceNumber} for $${amount} is now 30 days overdue. Please arrange payment as soon as possible to avoid any further action.${paymentLink ? `\n\nPay online: ${paymentLink}` : ''}\n\nIf you're experiencing difficulties, please contact us immediately to discuss options.\n\nRegards,\n${businessName}`,
      smsBody: `URGENT: Invoice ${invoiceNumber} for $${amount} is 30 days overdue. Please contact us immediately. - ${businessName}${paymentLink ? `\nPay here: ${paymentLink}` : ''}`
    }),
  },
  professional: {
    7: (clientName: string, invoiceNumber: string, amount: string, businessName: string, paymentLink: string) => ({
      subject: `Payment Reminder: Invoice ${invoiceNumber}`,
      emailBody: `Dear ${clientName},\n\nPlease be advised that invoice ${invoiceNumber} for $${amount} is now 7 days past due. We kindly request payment at your earliest convenience.${paymentLink ? `\n\nPay online: ${paymentLink}` : ''}\n\nShould you have any queries regarding this invoice, please do not hesitate to contact us.\n\nKind regards,\n${businessName}`,
      smsBody: `Payment reminder: Invoice ${invoiceNumber} for $${amount} is 7 days overdue. - ${businessName}${paymentLink ? `\nPay here: ${paymentLink}` : ''}`
    }),
    14: (clientName: string, invoiceNumber: string, amount: string, businessName: string, paymentLink: string) => ({
      subject: `Second Notice: Invoice ${invoiceNumber} - Payment Required`,
      emailBody: `Dear ${clientName},\n\nThis is a second notice regarding invoice ${invoiceNumber} for $${amount}, which is now 14 days past due.\n\nImmediate attention to this matter would be appreciated.${paymentLink ? `\n\nPay online: ${paymentLink}` : ''}\n\nRegards,\n${businessName}`,
      smsBody: `Second notice: Invoice ${invoiceNumber} for $${amount} is 14 days overdue. Immediate payment requested. - ${businessName}${paymentLink ? `\nPay here: ${paymentLink}` : ''}`
    }),
    30: (clientName: string, invoiceNumber: string, amount: string, businessName: string, paymentLink: string) => ({
      subject: `Final Notice: Invoice ${invoiceNumber} - Immediate Payment Required`,
      emailBody: `Dear ${clientName},\n\nThis is a final notice regarding invoice ${invoiceNumber} for $${amount}, which is now 30 days past due.\n\nImmediate payment is required to avoid escalation of this matter.${paymentLink ? `\n\nPay online: ${paymentLink}` : ''}\n\nPlease contact us immediately if there are circumstances preventing payment.\n\nRegards,\n${businessName}`,
      smsBody: `FINAL NOTICE: Invoice ${invoiceNumber} for $${amount} is 30 days overdue. Immediate payment required. - ${businessName}${paymentLink ? `\nPay here: ${paymentLink}` : ''}`
    }),
  },
  firm: {
    7: (clientName: string, invoiceNumber: string, amount: string, businessName: string, paymentLink: string) => ({
      subject: `Overdue Notice: Invoice ${invoiceNumber}`,
      emailBody: `${clientName},\n\nInvoice ${invoiceNumber} for $${amount} is now overdue. Payment is required within 7 days.${paymentLink ? `\n\nPay online: ${paymentLink}` : ''}\n\n${businessName}`,
      smsBody: `Invoice ${invoiceNumber} for $${amount} is overdue. Payment required. - ${businessName}${paymentLink ? `\nPay here: ${paymentLink}` : ''}`
    }),
    14: (clientName: string, invoiceNumber: string, amount: string, businessName: string, paymentLink: string) => ({
      subject: `Second Overdue Notice: Invoice ${invoiceNumber}`,
      emailBody: `${clientName},\n\nInvoice ${invoiceNumber} for $${amount} is now 14 days overdue. Immediate payment is required.\n\nFailure to pay may result in late fees or suspension of services.${paymentLink ? `\n\nPay online: ${paymentLink}` : ''}\n\n${businessName}`,
      smsBody: `Invoice ${invoiceNumber} - $${amount} - 14 days overdue. Pay immediately. - ${businessName}${paymentLink ? `\nPay here: ${paymentLink}` : ''}`
    }),
    30: (clientName: string, invoiceNumber: string, amount: string, businessName: string, paymentLink: string) => ({
      subject: `Final Demand: Invoice ${invoiceNumber}`,
      emailBody: `${clientName},\n\nFINAL DEMAND: Invoice ${invoiceNumber} for $${amount} is 30 days overdue.\n\nUnless payment is received within 7 days, this matter will be escalated for collection.${paymentLink ? `\n\nPay online: ${paymentLink}` : ''}\n\n${businessName}`,
      smsBody: `FINAL DEMAND: Invoice ${invoiceNumber} - $${amount} - 30 days overdue. Collection action pending. - ${businessName}${paymentLink ? `\nPay here: ${paymentLink}` : ''}`
    }),
  },
};

export async function processOverdueReminders(): Promise<ReminderResult[]> {
  const results: ReminderResult[] = [];
  
  try {
    const allUsers = await storage.getAllUsersWithSettings();
    
    for (const user of allUsers) {
      if (!user.businessSettings?.autoRemindersEnabled) {
        continue;
      }

      const reminderDays = (user.businessSettings.reminderDays as number[]) || [7, 14, 30];
      const tone = (user.businessSettings.reminderTone as keyof typeof REMINDER_TEMPLATES) || 'friendly';
      
      const overdueInvoices = await storage.getOverdueInvoicesForReminders(user.id);
      
      for (const invoice of overdueInvoices) {
        if (!invoice.dueDate) continue;
        
        const daysPastDue = Math.floor(
          (Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        const applicableDay = reminderDays.find(d => daysPastDue >= d && daysPastDue < d + 1);
        if (!applicableDay) continue;
        
        const alreadySent = await storage.hasReminderBeenSent(invoice.id, `${applicableDay}day`);
        if (alreadySent) continue;
        
        const client = await storage.getClient(invoice.clientId, user.id);
        if (!client) continue;
        
        const template = REMINDER_TEMPLATES[tone]?.[applicableDay as 7 | 14 | 30];
        if (!template) continue;
        
        const amount = Number(invoice.total).toFixed(2);
        const paymentLink = (invoice as any).paymentToken 
          ? `${getProductionBaseUrl()}/portal/invoice/${(invoice as any).paymentToken}`
          : '';
        const content = template(
          client.name.split(' ')[0],
          invoice.number,
          amount,
          user.businessSettings.businessName || 'Your Service Provider',
          paymentLink
        );
        
        let emailSent = false;
        let smsSent = false;
        let error: string | undefined;
        
        if (client.email) {
          try {
            await sendInvoiceEmail(
              { ...invoice, lineItems: [] },
              client,
              user.businessSettings,
              null
            );
            emailSent = true;
          } catch (e: unknown) {
            error = getErrorMessage(e);
          }
        }
        
        // Only send SMS if client has valid Australian mobile and hasn't opted out
        if (client.phone && isValidAustralianMobile(client.phone)) {
          const formattedPhone = formatPhoneForSMS(client.phone);
          if (formattedPhone) {
            try {
              await sendCustomerReply(formattedPhone, content.smsBody, user.id);
              smsSent = true;
            } catch (e: unknown) {
              if (!error) error = getErrorMessage(e);
            }
          }
        }
        
        await storage.createInvoiceReminderLog({
          invoiceId: invoice.id,
          userId: user.id,
          reminderType: `${applicableDay}day`,
          daysPastDue,
          sentVia: emailSent && smsSent ? 'both' : emailSent ? 'email' : smsSent ? 'sms' : null,
          emailSent,
          smsSent,
        });
        
        // Send push notification for overdue invoice
        try {
          await notifyInvoiceOverdue(user.id, invoice.number, invoice.id, daysPastDue);
          console.log(`[PushNotification] Sent overdue invoice notification for invoice ${invoice.number} to user ${user.id}`);
        } catch (pushError) {
          console.error('[PushNotification] Error sending overdue invoice notification:', pushError);
        }
        
        // Create in-app notification for the owner's notification center
        try {
          await notifyInvoiceOverdueDB(storage, user.id, invoice, client.name, daysPastDue);
        } catch (dbNotifyError) {
          console.error('[Reminder] Error creating DB notification:', dbNotifyError);
        }
        
        results.push({
          invoiceId: invoice.id,
          success: emailSent || smsSent,
          emailSent,
          smsSent,
          error,
        });
      }
    }
  } catch (error: unknown) {
    console.error('Error processing overdue reminders:', error);
  }
  
  return results;
}

function generateReminderContent(
  invoice: any,
  client: any,
  businessSettings: any,
  tone: 'friendly' | 'professional' | 'firm'
) {
  const daysPastDue = invoice.dueDate
    ? Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const templateDay = daysPastDue >= 30 ? 30 : daysPastDue >= 14 ? 14 : 7;
  const template = REMINDER_TEMPLATES[tone][templateDay];
  const amount = Number(invoice.total).toFixed(2);
  const paymentLink = (invoice as any).paymentToken
    ? `${getProductionBaseUrl()}/portal/invoice/${(invoice as any).paymentToken}`
    : '';
  return template(
    client.name.split(' ')[0],
    invoice.number,
    amount,
    businessSettings.businessName || 'Your Service Provider',
    paymentLink
  );
}

export async function previewReminder(
  invoiceId: string,
  userId: string,
  tone: 'friendly' | 'professional' | 'firm' = 'friendly'
): Promise<{ subject: string; emailBody: string; smsBody: string; clientName: string; clientEmail: string | null; clientPhone: string | null; hasValidMobile: boolean } | { error: string }> {
  try {
    const invoice = await storage.getInvoice(invoiceId, userId);
    if (!invoice) return { error: 'Invoice not found' };
    const client = await storage.getClient(invoice.clientId, userId);
    if (!client) return { error: 'Client not found' };
    const businessSettings = await storage.getBusinessSettings(userId);
    if (!businessSettings) return { error: 'Business settings not found' };

    const content = generateReminderContent(invoice, client, businessSettings, tone);
    return {
      ...content,
      clientName: client.name,
      clientEmail: client.email || null,
      clientPhone: client.phone || null,
      hasValidMobile: !!(client.phone && isValidAustralianMobile(client.phone)),
    };
  } catch (error: unknown) {
    return { error: getErrorMessage(error) };
  }
}

export async function sendManualReminder(
  invoiceId: string,
  userId: string,
  tone: 'friendly' | 'professional' | 'firm' = 'friendly',
  customSubject?: string,
  customMessage?: string
): Promise<ReminderResult> {
  try {
    const invoice = await storage.getInvoice(invoiceId, userId);
    if (!invoice) {
      return { invoiceId, success: false, emailSent: false, smsSent: false, error: 'Invoice not found' };
    }
    
    const client = await storage.getClient(invoice.clientId, userId);
    if (!client) {
      return { invoiceId, success: false, emailSent: false, smsSent: false, error: 'Client not found' };
    }
    
    const businessSettings = await storage.getBusinessSettings(userId);
    if (!businessSettings) {
      return { invoiceId, success: false, emailSent: false, smsSent: false, error: 'Business settings not found' };
    }
    
    const daysPastDue = invoice.dueDate
      ? Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const content = generateReminderContent(invoice, client, businessSettings, tone);
    if (customSubject) content.subject = customSubject;
    if (customMessage) content.emailBody = customMessage;
    
    let emailSent = false;
    let smsSent = false;
    let error: string | undefined;
    
    if (client.email) {
      try {
        const htmlBody = content.emailBody.replace(/\n/g, '<br>');
        await sendSystemEmail({
          to: client.email,
          subject: content.subject,
          html: htmlBody,
          from: { name: businessSettings.businessName || 'Your Service Provider' },
          replyTo: businessSettings.email || undefined,
        });
        emailSent = true;
      } catch (e: unknown) {
        error = getErrorMessage(e);
      }
    }
    
    // Only send SMS if client has valid Australian mobile
    if (client.phone && isValidAustralianMobile(client.phone)) {
      const formattedPhone = formatPhoneForSMS(client.phone);
      if (formattedPhone) {
        try {
          await sendCustomerReply(formattedPhone, content.smsBody, userId);
          smsSent = true;
        } catch (e: unknown) {
          if (!error) error = getErrorMessage(e);
        }
      }
    }
    
    await storage.createInvoiceReminderLog({
      invoiceId,
      userId,
      reminderType: 'manual',
      daysPastDue,
      sentVia: emailSent && smsSent ? 'both' : emailSent ? 'email' : smsSent ? 'sms' : null,
      emailSent,
      smsSent,
    });
    
    return { invoiceId, success: emailSent || smsSent, emailSent, smsSent, error };
  } catch (error: unknown) {
    return { invoiceId, success: false, emailSent: false, smsSent: false, error: getErrorMessage(error) };
  }
}
