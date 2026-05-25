import { db } from './storage';
import { emailIntegrations, emailDeliveryLogs, type EmailIntegration, type InsertEmailIntegration } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { sendEmail as sendPlatformEmail, sendEmailWithAttachment } from './emailService';
import { encrypt, decrypt, isEncryptionEnabled } from './cryptoHelper';
import { isGmailConnected, sendViaGmailAPI, getGmailProfile } from './gmailClient';
import { isOutlookConnected, sendViaOutlookAPI, getOutlookProfile } from './outlookClient';
import { getErrorMessage } from "./lib/errors";

// Email Integration Service - Manages tradie email connections
// Tradies can connect their own Gmail, Outlook, or SMTP email to send quotes/invoices
// Security: SMTP passwords are encrypted at rest using AES-256-GCM when EMAIL_ENCRYPTION_KEY is set
// Gmail: Uses Replit's managed OAuth connector - NOTE: This is a platform-level connection
// that applies to the entire application, not per-user. See getGmailConnectionStatus for details.
// Outlook: Uses Microsoft Graph API with per-user OAuth tokens stored in businessSettings

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  userId: string;
  type: 'quote' | 'invoice' | 'receipt' | 'reminder' | 'payment_link';
  relatedId?: string;
  fromName?: string; // Custom sender name (e.g., business name)
  replyTo?: string; // Business email for client replies
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  sentVia?: string;
  error?: string;
}

// Get user's email integration
export async function getEmailIntegration(userId: string): Promise<EmailIntegration | null> {
  const [integration] = await db
    .select()
    .from(emailIntegrations)
    .where(and(
      eq(emailIntegrations.userId, userId),
      eq(emailIntegrations.status, 'connected')
    ))
    .limit(1);
  
  return integration || null;
}

// Get all email integrations for a user
export async function getUserEmailIntegrations(userId: string): Promise<EmailIntegration[]> {
  return db
    .select()
    .from(emailIntegrations)
    .where(eq(emailIntegrations.userId, userId));
}

// Create or update SMTP integration
export async function connectSmtpEmail(
  userId: string,
  config: {
    host: string;
    port: number;
    user: string;
    password: string;
    secure: boolean;
    emailAddress: string;
    displayName: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Test the SMTP connection first
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });

    await transporter.verify();

    // Encrypt the password before storing
    const encryptedPassword = encrypt(config.password);
    
    if (isEncryptionEnabled()) {
      console.log(`🔐 SMTP password encrypted for user ${userId}`);
    }

    // Check if user already has an integration
    const existing = await db
      .select()
      .from(emailIntegrations)
      .where(eq(emailIntegrations.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing integration
      await db
        .update(emailIntegrations)
        .set({
          provider: 'smtp',
          status: 'connected',
          smtpHost: config.host,
          smtpPort: config.port,
          smtpUser: config.user,
          smtpPassword: encryptedPassword,
          smtpSecure: config.secure,
          emailAddress: config.emailAddress,
          displayName: config.displayName,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(emailIntegrations.id, existing[0].id));
    } else {
      // Create new integration
      await db.insert(emailIntegrations).values({
        userId,
        provider: 'smtp',
        status: 'connected',
        smtpHost: config.host,
        smtpPort: config.port,
        smtpUser: config.user,
        smtpPassword: encryptedPassword,
        smtpSecure: config.secure,
        emailAddress: config.emailAddress,
        displayName: config.displayName,
      });
    }

    console.log(`✅ SMTP email connected for user ${userId}: ${config.emailAddress}`);
    return { success: true };
  } catch (error: unknown) {
    console.error('Failed to connect SMTP email:', error);
    return { success: false, error: getErrorMessage(error) || 'Failed to connect email' };
  }
}

// Disconnect email integration
export async function disconnectEmail(userId: string): Promise<{ success: boolean }> {
  try {
    await db
      .update(emailIntegrations)
      .set({
        status: 'disconnected',
        accessToken: null,
        refreshToken: null,
        smtpPassword: null,
        updatedAt: new Date(),
      })
      .where(eq(emailIntegrations.userId, userId));

    console.log(`✅ Email disconnected for user ${userId}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to disconnect email:', error);
    return { success: false };
  }
}

// Send email through tradie's connected account or fallback to platform
// Cascade: User SMTP → Outlook → SendGrid (supports custom From name) → Gmail (fallback only)
// Note: Gmail connector has OAuth limitations that prevent custom From name display,
// so we prioritize SendGrid for proper business branding in emails
export async function sendEmailViaIntegration(options: SendEmailOptions): Promise<EmailResult> {
  const { to, subject, html, text, attachments, userId, type, relatedId, fromName, replyTo } = options;

  // Get user's email integration from database (SMTP only for now)
  const integration = await getEmailIntegration(userId);
  
  // Check if Gmail is connected via Replit connector
  const gmailConnected = await isGmailConnected();
  
  // Check if Outlook is connected for this user
  const outlookConnected = await isOutlookConnected(userId);

  // Log the email attempt
  const [logEntry] = await db.insert(emailDeliveryLogs).values({
    userId,
    emailIntegrationId: integration?.id || null,
    recipientEmail: to,
    subject,
    type,
    relatedId,
    status: 'pending',
  }).returning();

  // Helper to attempt sending with fallback cascade
  // Priority: User SMTP → Outlook → SendGrid (supports custom From name) → Gmail (doesn't support custom From name)
  const attemptSendWithFallback = async (): Promise<EmailResult> => {
    // 1. Try user's SMTP integration first (if connected)
    if (integration && integration.status === 'connected' && integration.provider === 'smtp') {
      const smtpResult = await sendViaSMTP(integration, { to, subject, html, text, attachments });
      if (smtpResult.success) {
        return smtpResult;
      }
      console.warn(`SMTP sending failed, trying fallback: ${smtpResult.error}`);
    }

    // 2. Try Outlook via Microsoft Graph API (if connected for this user)
    if (outlookConnected) {
      console.log('Attempting Outlook via Microsoft Graph API');
      const outlookResult = await sendViaOutlookAPI(userId, { to, subject, html, text, attachments });
      if (outlookResult.success) {
        return { ...outlookResult, sentVia: 'outlook' };
      }
      console.warn(`Outlook sending failed, trying fallback: ${outlookResult.error}`);
    }

    // 3. Try SendGrid platform email FIRST (properly displays business name in From header)
    // Gmail connector has OAuth limitations that prevent custom From name display
    console.log('Using SendGrid platform email (supports custom From name)');
    const sendgridResult = await sendViaPlatform({
      to, subject, html, text, fromName, attachments,
      _meta: { deliveryLogId: logEntry.id, userId, type, relatedId },
    });
    if (sendgridResult.success) {
      return sendgridResult;
    }
    console.warn(`SendGrid failed, trying Gmail fallback: ${sendgridResult.error}`);

    // 4. Final fallback - Gmail via Replit connector
    // Note: Gmail connector with send-only OAuth cannot display custom From names
    if (gmailConnected) {
      console.log('Attempting Gmail via Replit connector (fallback - limited From name support)');
      const gmailResult = await sendViaGmailDirect({ to, subject, html, text, attachments, fromName, replyTo });
      if (gmailResult.success) {
        return gmailResult;
      }
      console.warn(`Gmail connector also failed: ${gmailResult.error}`);
    }

    return { success: false, error: 'All email sending methods failed' };
  };

  try {
    const result = await attemptSendWithFallback();

    // Update log entry
    await db
      .update(emailDeliveryLogs)
      .set({
        status: result.success ? 'sent' : 'failed',
        sentVia: result.sentVia,
        messageId: result.messageId,
        errorMessage: result.error,
        sentAt: result.success ? new Date() : null,
      })
      .where(eq(emailDeliveryLogs.id, logEntry.id));

    // Update last used time on integration
    if (integration && result.success && result.sentVia === 'smtp') {
      await db
        .update(emailIntegrations)
        .set({ lastUsedAt: new Date() })
        .where(eq(emailIntegrations.id, integration.id));
    }

    return result;
  } catch (error: unknown) {
    // Update log entry with error
    await db
      .update(emailDeliveryLogs)
      .set({
        status: 'failed',
        errorMessage: getErrorMessage(error),
      })
      .where(eq(emailDeliveryLogs.id, logEntry.id));

    return { success: false, error: getErrorMessage(error) };
  }
}

// Send email via SMTP
async function sendViaSMTP(
  integration: EmailIntegration,
  options: { to: string; subject: string; html: string; text?: string; attachments?: any[] }
): Promise<EmailResult> {
  try {
    // Decrypt the password before using it
    const decryptedPassword = decrypt(integration.smtpPassword!);
    
    const transporter = nodemailer.createTransport({
      host: integration.smtpHost!,
      port: integration.smtpPort!,
      secure: integration.smtpSecure ?? true,
      auth: {
        user: integration.smtpUser!,
        pass: decryptedPassword,
      },
    });

    const mailOptions: any = {
      from: {
        name: integration.displayName || 'Business',
        address: integration.emailAddress!,
      },
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    if (options.attachments && options.attachments.length > 0) {
      mailOptions.attachments = options.attachments;
    }

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent via SMTP (${integration.emailAddress}) to ${options.to}`);

    return {
      success: true,
      messageId: result.messageId,
      sentVia: 'smtp',
    };
  } catch (error: any) {
    console.error('SMTP send error:', error);
    
    // Update integration status if there's an auth error
    if (error.code === 'EAUTH') {
      await db
        .update(emailIntegrations)
        .set({
          status: 'error',
          lastError: 'Authentication failed. Please reconnect your email.',
          updatedAt: new Date(),
        })
        .where(eq(emailIntegrations.id, integration.id));
    }

    return {
      success: false,
      error: getErrorMessage(error),
      sentVia: 'smtp',
    };
  }
}

// Send email via Gmail using Replit's managed OAuth connector (with integration record)
async function sendViaGmail(
  integration: EmailIntegration,
  options: { to: string; subject: string; html: string; text?: string; attachments?: any[] }
): Promise<EmailResult> {
  try {
    const result = await sendViaGmailAPI({
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      fromName: integration.displayName || undefined,
      attachments: options.attachments,
    });

    if (result.success) {
      console.log(`✅ Email sent via Gmail (${integration.emailAddress}) to ${options.to}`);
      return {
        success: true,
        messageId: result.messageId,
        sentVia: 'gmail',
      };
    } else {
      console.error('Gmail send failed:', result.error);
      // Update integration status if there's an error
      await db
        .update(emailIntegrations)
        .set({
          lastError: result.error || 'Failed to send via Gmail',
          updatedAt: new Date(),
        })
        .where(eq(emailIntegrations.id, integration.id));

      return {
        success: false,
        error: result.error,
        sentVia: 'gmail',
      };
    }
  } catch (error: unknown) {
    console.error('Gmail send error:', error);
    return {
      success: false,
      error: getErrorMessage(error),
      sentVia: 'gmail',
    };
  }
}

// Send email via Gmail directly (without integration record - uses Replit connector)
async function sendViaGmailDirect(
  options: { to: string; subject: string; html: string; text?: string; attachments?: any[]; fromName?: string; replyTo?: string }
): Promise<EmailResult> {
  try {
    const result = await sendViaGmailAPI({
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
      fromName: options.fromName,
      replyTo: options.replyTo,
    });

    if (result.success) {
      console.log(`✅ Email sent via Gmail (Replit connector) to ${options.to}`);
      return {
        success: true,
        messageId: result.messageId,
        sentVia: 'gmail_connector',
      };
    } else {
      console.error('Gmail connector send failed:', result.error);
      return {
        success: false,
        error: result.error,
        sentVia: 'gmail_connector',
      };
    }
  } catch (error: unknown) {
    console.error('Gmail connector send error:', error);
    return {
      success: false,
      error: getErrorMessage(error),
      sentVia: 'gmail_connector',
    };
  }
}

// Send email via Outlook OAuth (placeholder for future implementation)
async function sendViaOutlook(
  integration: EmailIntegration,
  options: { to: string; subject: string; html: string; text?: string; attachments?: any[] }
): Promise<EmailResult> {
  console.log('[Email] Outlook/Microsoft Graph API sending not yet available, falling back to platform email');
  return sendViaPlatform(options);
}

// Send email via platform (SendGrid)
async function sendViaPlatform(
  options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
    fromName?: string;
    attachments?: Array<{ filename: string; content: Buffer | string; contentType?: string }>;
    _meta?: { deliveryLogId?: string; userId?: string; type?: string; relatedId?: string };
  }
): Promise<EmailResult> {
  try {
    // If attachments are provided, use sendEmailWithAttachment
    if (options.attachments && options.attachments.length > 0) {
      // Convert attachments to proper Buffer format
      const formattedAttachments = options.attachments.map(att => ({
        filename: att.filename,
        content: Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content),
        contentType: att.contentType || 'application/pdf',
      }));
      
      const attResult = await sendEmailWithAttachment({
        to: options.to,
        subject: options.subject,
        html: options.html,
        fromName: options.fromName,
        attachments: formattedAttachments,
        _meta: options._meta,
      });
      
      console.log(`✅ SendGrid email with ${formattedAttachments.length} attachment(s) sent to ${options.to}`);
      
      return {
        success: true,
        messageId: attResult.messageId || undefined,
        sentVia: 'sendgrid',
      };
    }
    
    // No attachments - use regular sendPlatformEmail
    const result = await sendPlatformEmail({
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      fromName: options.fromName,
      _meta: options._meta,
    });

    return {
      success: result.success,
      messageId: result.messageId,
      sentVia: 'sendgrid',
      error: result.error,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: getErrorMessage(error),
      sentVia: 'sendgrid',
    };
  }
}

// Test email connection
export async function testEmailConnection(userId: string): Promise<{ success: boolean; message: string }> {
  // First check Gmail via Replit connector
  const gmailConnected = await isGmailConnected();
  if (gmailConnected) {
    try {
      const profile = await getGmailProfile();
      if (profile) {
        return { 
          success: true, 
          message: `Gmail connected as ${profile.email}. Managed by Replit.` 
        };
      }
    } catch (error) {
      return { 
        success: false, 
        message: 'Gmail connection error. Please try reconnecting your account.' 
      };
    }
  }

  const integration = await getEmailIntegration(userId);

  if (!integration) {
    return { success: false, message: 'No email integration found. Please connect your email first.' };
  }

  try {
    if (integration.provider === 'smtp') {
      // Decrypt the password before testing
      const decryptedPassword = decrypt(integration.smtpPassword!);
      
      const transporter = nodemailer.createTransport({
        host: integration.smtpHost!,
        port: integration.smtpPort!,
        secure: integration.smtpSecure ?? true,
        auth: {
          user: integration.smtpUser!,
          pass: decryptedPassword,
        },
      });

      await transporter.verify();
      return { success: true, message: 'SMTP connection verified successfully!' };
    }

    // For OAuth providers
    return { success: true, message: 'Email connection is active.' };
  } catch (error: unknown) {
    // Update integration status
    await db
      .update(emailIntegrations)
      .set({
        status: 'error',
        lastError: getErrorMessage(error),
        updatedAt: new Date(),
      })
      .where(eq(emailIntegrations.id, integration.id));

    return { success: false, message: `Connection failed: ${getErrorMessage(error)}` };
  }
}

// Check if user has connected email (SMTP or Gmail with matching email)
export async function hasConnectedEmail(userId: string): Promise<boolean> {
  const integration = await getEmailIntegration(userId);
  return integration !== null && integration.status === 'connected';
}

// Get Gmail connection status at platform level
// Note: This is platform-level, meaning the connected Gmail is shared
// Only useful for platform owner or when Gmail matches user's configured email
export async function getGmailConnectionStatus(userId: string): Promise<{
  connected: boolean;
  email?: string;
  displayName?: string;
}> {
  try {
    const gmailConnected = await isGmailConnected();
    if (!gmailConnected) {
      return { connected: false };
    }

    // Gmail connector is connected - try to get profile but don't fail if we can't
    // The connector might have send permissions but not profile read permissions
    try {
      const profile = await getGmailProfile();
      if (profile) {
        return {
          connected: true,
          email: profile.email,
          displayName: profile.displayName,
        };
      }
    } catch (profileError) {
      console.log('[Gmail] Profile fetch failed (likely scope limitation), connector still usable for sending');
    }

    // Gmail is connected even if we couldn't get the profile
    return {
      connected: true,
      email: undefined,
      displayName: 'Gmail Connector',
    };
  } catch (error) {
    console.error('Error checking Gmail status:', error);
    return { connected: false };
  }
}
