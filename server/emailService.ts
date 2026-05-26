import sgMail from '@sendgrid/mail';
import { sendViaGmailAPI, isGmailConnected } from './gmailClient';
import { logger } from './logger';
import { getErrorMessage } from "./lib/errors";

let connectorFromEmail: string | null = null;

export async function getSendGridCredentials(): Promise<{ apiKey: string; email: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (hostname && xReplitToken) {
    try {
      const res = await fetch(
        'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
        { headers: { 'Accept': 'application/json', 'X-Replit-Token': xReplitToken } }
      );
      const data = await res.json();
      const conn = data.items?.[0];
      if (conn?.settings?.api_key && conn?.settings?.from_email) {
        connectorFromEmail = conn.settings.from_email;
        console.log(`[SendGrid] Using connector credentials, from_email: ${conn.settings.from_email}, key prefix: ${conn.settings.api_key.substring(0, 10)}...`);
        return { apiKey: conn.settings.api_key, email: conn.settings.from_email };
      }
      console.log(`[SendGrid] Connector found but missing api_key or from_email:`, JSON.stringify({ hasKey: !!conn?.settings?.api_key, hasEmail: !!conn?.settings?.from_email }));
    } catch (e) {
      console.warn('⚠️ SendGrid connector fetch failed, falling back to env var');
    }
  }

  if (process.env.SENDGRID_API_KEY) {
    return { apiKey: process.env.SENDGRID_API_KEY, email: '' };
  }

  throw new Error('SendGrid not configured - no connector or API key available');
}

async function ensureSendGridReady(): Promise<boolean> {
  try {
    const { apiKey } = await getSendGridCredentials();
    sgMail.setApiKey(apiKey);
    return true;
  } catch {
    return false;
  }
}

export async function sendViaSendGrid(emailData: any): Promise<{ messageId: string | null }> {
  await ensureSendGridReady();
  if (!emailData.from?.email) {
    emailData.from = { email: PLATFORM_FROM_EMAIL, name: PLATFORM_FROM_NAME };
  }
  // Enable open + click tracking by default so the SendGrid event webhook
  // can populate openedAt/clickedAt/etc on email_delivery_logs.
  // Callers can override by setting trackingSettings explicitly (e.g. for
  // emails that should not have wrapped links like password reset codes).
  if (!emailData.trackingSettings) {
    emailData.trackingSettings = {
      clickTracking: { enable: true, enableText: false },
      openTracking: { enable: true },
      subscriptionTracking: { enable: false },
    };
  }
  // Plumb _meta through as SendGrid customArgs + categories so the event
  // webhook can correlate events back to email_delivery_logs without
  // depending on the SendGrid X-Message-Id alone.
  const meta = emailData._meta;
  if (meta) {
    emailData.customArgs = {
      ...(emailData.customArgs || {}),
      ...(meta.deliveryLogId ? { delivery_log_id: String(meta.deliveryLogId) } : {}),
      ...(meta.userId ? { user_id: String(meta.userId) } : {}),
      ...(meta.type ? { type: String(meta.type) } : {}),
      ...(meta.relatedId ? { related_id: String(meta.relatedId) } : {}),
    };
    if (meta.type) {
      const cats: string[] = Array.isArray(emailData.categories) ? emailData.categories : [];
      emailData.categories = Array.from(new Set([...cats, String(meta.type)]));
    }
  }
  // SendGrid will reject unknown top-level fields — strip _meta before sending.
  const { _meta: _omit, ...sendData } = emailData;
  console.log(`[SendGrid] Sending from: ${emailData.from?.email} (name: "${emailData.from?.name}") to: ${emailData.to}`);
  try {
    const response = await sgMail.send(sendData as any);
    // sgMail.send returns [ClientResponse, {}] — pull X-Message-Id header
    const first: any = Array.isArray(response) ? response[0] : response;
    const headerVal = first?.headers?.['x-message-id'] ?? first?.headers?.['X-Message-Id'];
    const messageId = Array.isArray(headerVal) ? headerVal[0] : (headerVal || null);
    return { messageId: messageId ? String(messageId) : null };
  } catch (err: any) {
    const statusCode = err?.code || err?.response?.statusCode;
    const body = err?.response?.body;
    console.error(`[SendGrid] Send failed - status: ${statusCode}, body:`, JSON.stringify(body || getErrorMessage(err)));
    throw err;
  }
}

// Backoff schedule for failed email retries (1m, 5m, 15m, 1h, 6h)
const EMAIL_RETRY_DELAYS_MS = [60_000, 300_000, 900_000, 3_600_000, 21_600_000];
export function scheduleEmailRetry(retryCount: number): Date {
  const idx = Math.min(retryCount, EMAIL_RETRY_DELAYS_MS.length - 1);
  return new Date(Date.now() + EMAIL_RETRY_DELAYS_MS[idx]);
}

// Detect non-retryable provider failures (invalid email, bounce, etc.).
export function isPermanentEmailFailure(err: any): boolean {
  const code = err?.code || err?.response?.statusCode;
  if (code === 400 || code === 401 || code === 403 || code === 422) return true;
  const message = String(err?.message || '').toLowerCase();
  if (message.includes('invalid email') || message.includes('does not exist') || message.includes('bounce')) {
    return true;
  }
  return false;
}

async function logEmailDelivery(
  emailData: any,
  status: 'sent' | 'failed',
  sentVia: string | null,
  errorMessage: string | null,
  permanentlyFailed = false,
  messageId: string | null = null,
): Promise<void> {
  try {
    const { db } = await import('./storage');
    const { emailDeliveryLogs } = await import('../shared/schema');
    const { eq } = await import('drizzle-orm');
    const recipient = Array.isArray(emailData.to) ? emailData.to[0] : emailData.to;
    // If the caller already created a log row (and passed its id via _meta.deliveryLogId),
    // update it instead of inserting a duplicate. This keeps the SendGrid customArgs
    // delivery_log_id in sync with the row the webhook will look up.
    const existingId = emailData._meta?.deliveryLogId;
    if (existingId) {
      const updates: Record<string, any> = {
        status,
        sentVia: sentVia ?? undefined,
        errorMessage,
        sentAt: status === 'sent' ? new Date() : null,
        permanentlyFailed,
      };
      if (messageId) updates.messageId = messageId;
      if (status === 'failed' && !permanentlyFailed) {
        updates.nextRetryAt = scheduleEmailRetry(0);
        updates.payloadJson = sanitizePayloadForRetry(emailData);
      }
      await db.update(emailDeliveryLogs).set(updates).where(eq(emailDeliveryLogs.id, existingId));
      return;
    }
    await db.insert(emailDeliveryLogs).values({
      userId: emailData._meta?.userId || null,
      recipientEmail: recipient,
      subject: emailData.subject || '(no subject)',
      type: emailData._meta?.type || 'system',
      relatedId: emailData._meta?.relatedId || null,
      status,
      sentVia,
      messageId: messageId || undefined,
      errorMessage,
      sentAt: status === 'sent' ? new Date() : null,
      permanentlyFailed,
      nextRetryAt: status === 'failed' && !permanentlyFailed ? scheduleEmailRetry(0) : null,
      payloadJson: status === 'failed' && !permanentlyFailed ? sanitizePayloadForRetry(emailData) : null,
    });
  } catch (logErr: unknown) {
    console.warn('[Email] Failed to log delivery (non-fatal):', getErrorMessage(logErr));
  }
}

function sanitizePayloadForRetry(emailData: any): any {
  // Skip massive attachments to keep DB row sane.
  const { attachments, _meta, ...rest } = emailData;
  return {
    ...rest,
    _meta,
    attachments: attachments?.map((a: any) => ({
      filename: a.filename || a.fileName,
      contentType: a.type || a.contentType,
      // store base64 only if reasonably small (<256kb)
      content: a.content && String(a.content).length < 256_000
        ? (Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content)
        : null,
    })) || [],
  };
}

export async function sendSystemEmail(emailData: any): Promise<{ messageId: string | null; sentVia: string | null }> {
  let lastError: any = null;
  let permanentSendGrid = false;

  try {
    const sgResult = await sendViaSendGrid(emailData);
    await logEmailDelivery(emailData, 'sent', 'sendgrid', null, false, sgResult.messageId);
    return { messageId: sgResult.messageId, sentVia: 'sendgrid' };
  } catch (sgError: unknown) {
    lastError = sgError;
    permanentSendGrid = isPermanentEmailFailure(sgError);
    console.warn(`⚠️ SendGrid failed for system email to ${emailData.to}, trying Gmail fallback: ${getErrorMessage(sgError)}`);
  }

  const gmailConnected = await isGmailConnected();
  if (gmailConnected) {
    try {
      const gmailOptions: any = {
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        fromName: emailData.from?.name || PLATFORM_FROM_NAME,
        replyTo: emailData.replyTo || PLATFORM_REPLY_TO_EMAIL,
      };
      if (emailData.attachments && emailData.attachments.length > 0) {
        gmailOptions.attachments = emailData.attachments.map((att: any) => ({
          filename: att.filename || att.fileName || 'attachment',
          content: Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content, 'base64'),
          contentType: att.type || att.contentType || 'application/octet-stream',
        }));
      }
      console.log(`[Gmail Fallback] Sending to ${emailData.to} with fromName: "${gmailOptions.fromName}", attachments: ${gmailOptions.attachments?.length || 0}`);
      const result = await sendViaGmailAPI(gmailOptions);
      if (result.success) {
        console.log(`✅ System email sent via Gmail fallback to ${emailData.to}`);
        await logEmailDelivery(emailData, 'sent', 'gmail', null, false, result.messageId || null);
        return { messageId: result.messageId || null, sentVia: 'gmail' };
      }
      throw new Error(result.error || 'Gmail send failed');
    } catch (gmailError: unknown) {
      lastError = gmailError;
      console.error(`❌ Gmail fallback also failed: ${getErrorMessage(gmailError)}`);
    }
  }

  // Both providers failed — log + queue for retry.
  const permanent = permanentSendGrid && isPermanentEmailFailure(lastError);
  await logEmailDelivery(
    emailData,
    'failed',
    null,
    String(lastError?.message || 'Unknown email failure'),
    permanent,
  );

  throw new Error(`All email sending methods failed for system email: ${lastError?.message || 'unknown'}`);
}

const initializeSendGrid = () => {
  ensureSendGridReady().then(ok => {
    if (ok) {
      console.log('✅ SendGrid initialized for email sending');
    } else {
      console.log('⚠️ SendGrid not configured - will attempt connector on first send');
    }
  });
  return true;
};

const isSendGridConfigured = initializeSendGrid();

const mockEmailService = {
  send: async (emailData: any) => {
    const ok = await ensureSendGridReady();
    if (ok) {
      return sgMail.send(emailData);
    }
    const errorMsg = 'Email service not configured - SendGrid connection required';
    logger.error('email', 'Email send failed - service not configured', {
      metadata: { recipient: emailData.to, subject: emailData.subject },
    });
    throw new Error(errorMsg);
  }
};

// Platform email settings
const PLATFORM_FROM_EMAIL = 'noreply@jobrunner.com.au';
const PLATFORM_REPLY_TO_EMAIL = 'admin@avwebinnovation.com';
const PLATFORM_FROM_NAME = 'JobRunner';

// Get the correct base URL for emails - prioritizes custom domain for trust.
// In production we MUST NOT emit a Replit-managed subdomain (e.g.
// `318.jobrunner.com.au` or `xxx.replit.app`) because Chrome flags the TLS
// cert as untrusted and users abandon the verify-email flow.
const HARDCODED_PRODUCTION_DOMAIN = 'jobrunner.com.au';

// Normalize a value that may be either a bare host ("jobrunner.com.au") or a
// full URL ("https://jobrunner.com.au/"). Returns a canonical
// "https://<host>" with no trailing slash. Defends against the
// `https://https://jobrunner.com.au` bug when APP_DOMAIN is set as a URL.
const toCanonicalUrl = (raw: string): string => {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const getBaseUrl = () => {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT;

  // Priority 1: Custom production domain (jobrunner.com.au)
  if (process.env.APP_DOMAIN) {
    return toCanonicalUrl(process.env.APP_DOMAIN);
  }

  // Priority 2: Explicitly set app URL
  if (process.env.VITE_APP_URL) {
    return toCanonicalUrl(process.env.VITE_APP_URL);
  }

  // In development mode, use Replit dev domain so verification links work
  if (!isProduction && process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }

  // PRODUCTION FALLBACK: never use a Replit subdomain — hardcode the public
  // marketing domain. This protects against the case where APP_DOMAIN has
  // been deleted in the deployment env by accident.
  if (isProduction) {
    console.warn(
      '[emailService] APP_DOMAIN/VITE_APP_URL unset in production — falling back to ' +
        `https://${HARDCODED_PRODUCTION_DOMAIN}. Set APP_DOMAIN to silence this warning.`
    );
    return `https://${HARDCODED_PRODUCTION_DOMAIN}`;
  }

  // Non-production fallback chains (dev-only paths below)
  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  
  // Fallback to localhost
  return 'http://localhost:5000';
};

// Simple footer for transactional emails (quote/invoice emails are transactional, not marketing)
const UNSUBSCRIBE_FOOTER = `
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px;">
    <p style="margin: 0;">Powered by <strong>JobRunner</strong> | The business management platform for Australian tradies</p>
    <p style="margin: 10px 0 0 0; font-size: 11px; color: #888;">
      This is a transactional email regarding your quote or invoice request.
    </p>
  </div>
`;

// Email template for quotes
const createQuoteEmail = (quote: any, client: any, business: any, acceptanceUrl?: string | null) => {
  const lineItemsHtml = quote.lineItems?.map((item: any) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.description}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${Number(item.quantity).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.unitPrice).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.total).toFixed(2)}</td>
    </tr>
  `).join('');

  // Use persisted totals from the database instead of recalculating
  const subtotal = Number(quote.subtotal);
  const gstAmount = Number(quote.gstAmount);
  const totalAmount = Number(quote.total);
  const brandColor = business.brandColor || '#2563EB';
  
  // Get logo URL - use business logo if available, otherwise JobRunner logo
  const baseUrl = getBaseUrl();
  const defaultLogoUrl = `${baseUrl}/logo.png`;
  const logoUrl = business.logoUrl || defaultLogoUrl;

  // Platform sends from noreply@jobrunner.com.au, but reply-to goes to the tradie's business email
  return {
    to: client.email,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: business.businessName || PLATFORM_FROM_NAME
    },
    replyTo: business.email || PLATFORM_REPLY_TO_EMAIL,
    subject: `Quote #${quote.number || quote.id?.substring(0, 8).toUpperCase()} from ${business.businessName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Quote - ${quote.title}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%); padding: 24px; border-radius: 12px; margin-bottom: 24px; text-align: center;">
          <div style="background: white; display: inline-block; padding: 12px 20px; border-radius: 8px; margin-bottom: 12px;">
            <img src="${logoUrl}" alt="${business.businessName || 'JobRunner'}" style="max-height: 48px; max-width: 160px; display: block;" />
          </div>
          <h1 style="color: white; margin: 0; font-size: 22px;">${business.businessName}</h1>
          ${business.abn ? `<p style="margin: 4px 0 0 0; color: rgba(255,255,255,0.85); font-size: 12px;">ABN: ${business.abn}</p>` : ''}
          <p style="margin: 6px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Quote #${quote.number || quote.id?.substring(0, 8).toUpperCase()}</p>
        </div>

        <div style="margin-bottom: 20px;">
          <p style="font-size: 16px;">Hi ${client.name},</p>
          <p>Thanks for getting in touch! Here's your quote for the work we discussed.</p>
        </div>
        
        ${acceptanceUrl ? `
        <div style="text-align: center; margin: 30px 0; padding: 24px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; border: 1px solid #86efac;">
          <p style="margin: 0 0 16px 0; color: #166534; font-weight: 600; font-size: 16px;">Ready to view your quote?</p>
          <a href="${acceptanceUrl}" style="background-color: ${brandColor}; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 18px; font-weight: bold;">
            View & Accept Quote
          </a>
          <p style="margin-top: 16px; color: #374151; font-size: 13px;">Or copy this link into your browser:</p>
          <p style="margin: 8px 0 0 0; word-break: break-all;"><a href="${acceptanceUrl}" style="color: ${brandColor}; font-size: 12px;">${acceptanceUrl}</a></p>
        </div>
        ` : ''}

        <div style="margin-bottom: 20px;">
          <h2 style="color: #333; border-bottom: 2px solid ${brandColor}; padding-bottom: 10px;">Quote Summary</h2>
          <p><strong>Job:</strong> ${quote.title}</p>
          ${quote.description ? `<p><strong>Description:</strong> ${quote.description}</p>` : ''}
          <p><strong>Date:</strong> ${new Date(quote.createdAt).toLocaleDateString('en-AU')}</p>
          ${quote.validUntil ? `<p><strong>Valid Until:</strong> ${new Date(quote.validUntil).toLocaleDateString('en-AU')}</p>` : ''}
        </div>

        ${quote.lineItems?.length ? `
        <div style="margin-bottom: 20px;">
          <h3 style="color: #333;">Line Items</h3>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Description</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Unit Price</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHtml}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          ${business.gstEnabled ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>Subtotal:</span>
              <span>$${subtotal.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>GST (10%):</span>
              <span>$${gstAmount.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 2px solid #2563EB; padding-top: 10px; font-size: 20px; font-weight: bold; color: #2563EB;">
              <span>Total Amount:</span>
              <span>$${totalAmount.toFixed(2)}</span>
            </div>
          ` : `
            <h3 style="margin: 0 0 10px 0; color: #333;">Total Amount</h3>
            <p style="font-size: 24px; font-weight: bold; color: #2563EB; margin: 0;">$${totalAmount.toFixed(2)}</p>
          `}
        </div>

        ${quote.notes ? `
        <div style="margin-bottom: 20px;">
          <h3 style="color: #333;">Notes</h3>
          <p style="background: #f8f9fa; padding: 15px; border-radius: 8px;">${quote.notes}</p>
        </div>
        ` : ''}

        ${acceptanceUrl ? `
        <div style="text-align: center; margin: 30px 0; padding: 20px; background: linear-gradient(135deg, ${brandColor}15, ${brandColor}05); border-radius: 12px; border: 1px solid ${brandColor}30;">
          <p style="margin: 0 0 15px 0; font-size: 16px; color: #333;">Ready to go ahead?</p>
          <a href="${acceptanceUrl}" style="background-color: ${brandColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold;">
            Accept This Quote
          </a>
        </div>
        ` : ''}

        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid ${brandColor};">
          <p style="margin: 0; color: #333; font-weight: 500;">Questions about this quote?</p>
          <p style="margin: 10px 0 0 0; color: #666;">Just reply to this email or give us a call - we're happy to help.</p>
          ${business.phone ? `<p style="margin: 10px 0 0 0;"><strong>Phone:</strong> <a href="tel:${business.phone}" style="color: ${brandColor}; text-decoration: none;">${business.phone}</a></p>` : ''}
          ${business.email ? `<p style="margin: 5px 0 0 0;"><strong>Email:</strong> <a href="mailto:${business.email}" style="color: ${brandColor}; text-decoration: none;">${business.email}</a></p>` : ''}
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
          <p style="margin: 0; color: #999; font-size: 12px;">
            This quote was sent by ${business.businessName}${business.abn ? ` (ABN: ${business.abn})` : ''}
          </p>
          ${business.address ? `<p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">${business.address}</p>` : ''}
        </div>
        
        ${UNSUBSCRIBE_FOOTER}
      </body>
      </html>
    `
  };
};

// Email template for invoices
const createInvoiceEmail = (invoice: any, client: any, business: any, paymentUrl?: string | null) => {
  const lineItemsHtml = invoice.lineItems?.map((item: any) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.description}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${Number(item.quantity).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.unitPrice).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.total).toFixed(2)}</td>
    </tr>
  `).join('');

  // Use persisted totals from the database
  const subtotal = Number(invoice.subtotal);
  const gstAmount = Number(invoice.gstAmount);
  const totalAmount = Number(invoice.total);
  const brandColor = business.brandColor || '#2563EB';
  const dueDateStr = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-AU') : null;
  
  // Get logo URL - use business logo if available, otherwise JobRunner logo
  const baseUrl = getBaseUrl();
  const defaultLogoUrl = `${baseUrl}/logo.png`;
  const logoUrl = business.logoUrl || defaultLogoUrl;

  // Platform sends from noreply@jobrunner.com.au, but reply-to goes to the tradie's business email
  return {
    to: client.email,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: business.businessName || PLATFORM_FROM_NAME
    },
    replyTo: business.email || PLATFORM_REPLY_TO_EMAIL,
    subject: `Invoice #${invoice.number || invoice.id?.substring(0, 8).toUpperCase()} from ${business.businessName}${dueDateStr ? ` - Due ${dueDateStr}` : ''}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice - ${invoice.title}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%); padding: 24px; border-radius: 12px; margin-bottom: 24px; text-align: center;">
          <div style="background: white; display: inline-block; padding: 12px 20px; border-radius: 8px; margin-bottom: 12px;">
            <img src="${logoUrl}" alt="${business.businessName || 'JobRunner'}" style="max-height: 48px; max-width: 160px; display: block;" />
          </div>
          <p style="margin: 0 0 4px 0; color: rgba(255,255,255,0.85); font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">TAX INVOICE</p>
          <h1 style="color: white; margin: 0; font-size: 22px;">${business.businessName}</h1>
          ${business.abn ? `<p style="margin: 4px 0 0 0; color: rgba(255,255,255,0.85); font-size: 12px;">ABN: ${business.abn}</p>` : ''}
          <p style="margin: 6px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Invoice #${invoice.number || invoice.id?.substring(0, 8).toUpperCase()}</p>
        </div>

        <div style="margin-bottom: 20px;">
          <p style="font-size: 16px;">Hi ${client.name},</p>
          <p>Here's your invoice for the completed work. ${dueDateStr ? `Payment is due by <strong>${dueDateStr}</strong>.` : ''}</p>
        </div>
        
        ${paymentUrl ? `
        <div style="text-align: center; margin: 30px 0; padding: 24px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; border: 1px solid #E8862E;">
          <p style="margin: 0 0 16px 0; color: #92400e; font-weight: 600; font-size: 16px;">Ready to pay your invoice?</p>
          <a href="${paymentUrl}" style="background-color: ${brandColor}; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 18px; font-weight: bold;">
            Pay Now - $${totalAmount.toFixed(2)}
          </a>
          <p style="margin-top: 16px; color: #374151; font-size: 13px;">Secure payment via card</p>
          <p style="margin: 8px 0 0 0; color: #666; font-size: 12px;">Or copy this link into your browser:</p>
          <p style="margin: 8px 0 0 0; word-break: break-all;"><a href="${paymentUrl}" style="color: ${brandColor}; font-size: 12px;">${paymentUrl}</a></p>
        </div>
        ` : ''}

        <div style="margin-bottom: 20px;">
          <h2 style="color: #333; border-bottom: 2px solid ${brandColor}; padding-bottom: 10px;">Invoice Summary</h2>
          <p><strong>Job:</strong> ${invoice.title}</p>
          ${invoice.description ? `<p><strong>Description:</strong> ${invoice.description}</p>` : ''}
          <p><strong>Date:</strong> ${new Date(invoice.createdAt).toLocaleDateString('en-AU')}</p>
          ${dueDateStr ? `<p><strong>Due Date:</strong> ${dueDateStr}</p>` : ''}
        </div>

        ${invoice.lineItems?.length ? `
        <div style="margin-bottom: 20px;">
          <h3 style="color: #333;">Line Items</h3>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Description</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Unit Price</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHtml}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          ${business.gstEnabled ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>Subtotal:</span>
              <span>$${subtotal.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>GST (10%):</span>
              <span>$${gstAmount.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 2px solid #ddd; padding-top: 10px; font-size: 20px; font-weight: bold; color: #2563EB;">
              <span>Total Amount:</span>
              <span>$${totalAmount.toFixed(2)}</span>
            </div>
          ` : `
            <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: bold; color: #2563EB;">
              <span>Total Amount:</span>
              <span>$${totalAmount.toFixed(2)}</span>
            </div>
          `}
        </div>

        ${invoice.notes ? `
        <div style="margin-bottom: 20px;">
          <h3 style="color: #333;">Notes</h3>
          <p style="background: #f8f9fa; padding: 15px; border-radius: 8px;">${invoice.notes}</p>
        </div>
        ` : ''}

        ${paymentUrl ? `
        <div style="text-align: center; margin: 30px 0; padding: 20px; background: linear-gradient(135deg, ${brandColor}15, ${brandColor}05); border-radius: 12px; border: 1px solid ${brandColor}30;">
          <p style="margin: 0 0 15px 0; font-size: 16px; color: #333;">Ready to pay?</p>
          <a href="${paymentUrl}" style="background-color: ${brandColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold;">
            Pay $${totalAmount.toFixed(2)} Now
          </a>
        </div>
        ` : `
        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid ${brandColor};">
          <p style="margin: 0; color: #333; font-weight: 500;">Payment Methods</p>
          <p style="margin: 10px 0 0 0; color: #666;">Please contact us for payment options including bank transfer or card payment.</p>
          ${business.bankName ? `<p style="margin: 10px 0 0 0;"><strong>Bank:</strong> ${business.bankName}</p>` : ''}
          ${business.bsb ? `<p style="margin: 5px 0 0 0;"><strong>BSB:</strong> ${business.bsb}</p>` : ''}
          ${business.accountNumber ? `<p style="margin: 5px 0 0 0;"><strong>Account:</strong> ${business.accountNumber}</p>` : ''}
        </div>
        `}

        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid ${brandColor};">
          <p style="margin: 0; color: #333; font-weight: 500;">Questions about this invoice?</p>
          <p style="margin: 10px 0 0 0; color: #666;">Just reply to this email or give us a call.</p>
          ${business.phone ? `<p style="margin: 10px 0 0 0;"><strong>Phone:</strong> <a href="tel:${business.phone}" style="color: ${brandColor}; text-decoration: none;">${business.phone}</a></p>` : ''}
          ${business.email ? `<p style="margin: 5px 0 0 0;"><strong>Email:</strong> <a href="mailto:${business.email}" style="color: ${brandColor}; text-decoration: none;">${business.email}</a></p>` : ''}
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
          <p style="margin: 0; color: #999; font-size: 12px;">
            This is a tax invoice from ${business.businessName}${business.abn ? ` (ABN: ${business.abn})` : ''}
          </p>
          ${business.address ? `<p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">${business.address}</p>` : ''}
        </div>
        
        ${UNSUBSCRIBE_FOOTER}
      </body>
      </html>
    `
  };
};

// Email template for receipts (when invoice is marked as paid)
const createReceiptEmail = (invoice: any, client: any, business: any) => {
  const lineItemsHtml = invoice.lineItems?.map((item: any) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.description}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${Number(item.quantity).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.unitPrice).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.total).toFixed(2)}</td>
    </tr>
  `).join('');

  // Use persisted totals from the database
  const subtotal = Number(invoice.subtotal);
  const gstAmount = Number(invoice.gstAmount);
  const totalAmount = Number(invoice.total);
  
  // Get logo URL - use business logo if available, otherwise JobRunner logo
  const baseUrl = getBaseUrl();
  const defaultLogoUrl = `${baseUrl}/logo.png`;
  const logoUrl = business.logoUrl || defaultLogoUrl;

  // Platform sends from noreply@jobrunner.com.au, but reply-to goes to the tradie's business email
  return {
    to: client.email,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: business.businessName || PLATFORM_FROM_NAME
    },
    replyTo: business.email || PLATFORM_REPLY_TO_EMAIL,
    subject: `Receipt: ${invoice.title}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt - ${invoice.title}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #2563EB; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
          <div style="background: white; display: inline-block; padding: 12px 20px; border-radius: 8px; margin-bottom: 12px;">
            <img src="${logoUrl}" alt="${business.businessName || 'JobRunner'}" style="max-height: 48px; max-width: 160px; display: block;" />
          </div>
          <h1 style="margin: 0;">Payment Received</h1>
          <h2 style="margin: 10px 0 0 0;">${business.businessName}</h2>
          <p style="margin: 5px 0; opacity: 0.9;">Receipt #${invoice.id?.substring(0, 8).toUpperCase()}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h2 style="color: #333; border-bottom: 2px solid #2563EB; padding-bottom: 10px;">Payment Details</h2>
          <p><strong>Service:</strong> ${invoice.title}</p>
          ${invoice.description ? `<p><strong>Description:</strong> ${invoice.description}</p>` : ''}
          <p><strong>Client:</strong> ${client.name}</p>
          <p><strong>Payment Date:</strong> ${new Date(invoice.paidAt || Date.now()).toLocaleDateString()}</p>
          <p><strong>Status:</strong> <span style="background: #2563EB; color: white; padding: 2px 8px; border-radius: 4px;">PAID</span></p>
        </div>

        ${invoice.lineItems?.length ? `
        <div style="margin-bottom: 20px;">
          <h3 style="color: #333;">Services Provided</h3>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Description</th>
                <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Unit Price</th>
                <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ddd;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHtml}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          ${business.gstEnabled ? `
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>Subtotal:</span>
              <span>$${subtotal.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>GST (10%):</span>
              <span>$${gstAmount.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; border-top: 2px solid #2563EB; padding-top: 10px; font-size: 20px; font-weight: bold; color: #2563EB;">
              <span>Amount Paid:</span>
              <span>$${totalAmount.toFixed(2)}</span>
            </div>
          ` : `
            <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: bold; color: #2563EB;">
              <span>Amount Paid:</span>
              <span>$${totalAmount.toFixed(2)}</span>
            </div>
          `}
        </div>

        ${invoice.notes ? `
        <div style="margin-bottom: 20px;">
          <h3 style="color: #333;">Notes</h3>
          <p style="background: #f8f9fa; padding: 15px; border-radius: 8px;">${invoice.notes}</p>
        </div>
        ` : ''}

        <div style="margin-top: 30px; padding: 20px; background: #f0fdf4; border-radius: 8px; text-align: center;">
          <p style="margin: 0; color: #059669; font-weight: bold;">Thank you for your business!</p>
          <p style="margin: 10px 0 0 0;">This receipt confirms that payment has been received in full.</p>
          ${business.phone ? `<p style="margin: 10px 0 0 0;"><strong>Phone:</strong> ${business.phone}</p>` : ''}
          ${business.email ? `<p style="margin: 5px 0 0 0;"><strong>Email:</strong> ${business.email}</p>` : ''}
        </div>
        
        ${UNSUBSCRIBE_FOOTER}
      </body>
      </html>
    `
  };
};

// Export HTML template creators for use by email integration service
export const createQuoteEmailHtml = (quote: any, client: any, business: any, acceptanceUrl?: string | null) => {
  const emailData = createQuoteEmail(quote, client, business, acceptanceUrl);
  return {
    to: emailData.to,
    subject: emailData.subject,
    html: emailData.html,
  };
};

export const createInvoiceEmailHtml = (invoice: any, client: any, business: any, paymentUrl?: string | null) => {
  const emailData = createInvoiceEmail(invoice, client, business, paymentUrl);
  return {
    to: emailData.to,
    subject: emailData.subject,
    html: emailData.html,
  };
};

export const createReceiptEmailHtml = (invoice: any, client: any, business: any) => {
  const emailData = createReceiptEmail(invoice, client, business);
  return {
    to: emailData.to,
    subject: emailData.subject,
    html: emailData.html,
  };
};

// Send quote email
export const sendQuoteEmail = async (quote: any, client: any, business: any = {}, acceptanceUrl?: string | null, pdfBuffer?: Buffer) => {


  if (!client.email) {
    throw new Error('Client email address is required');
  }

  try {
    const emailData = createQuoteEmail(quote, client, business, acceptanceUrl);
    
    // Add PDF attachment if provided
    if (pdfBuffer) {
      (emailData as any).attachments = [{
        content: pdfBuffer.toString('base64'),
        filename: `Quote-${quote.number || quote.id?.substring(0, 8).toUpperCase()}.pdf`,
        type: 'application/pdf',
        disposition: 'attachment'
      }];
    }
    
    await sendSystemEmail(emailData);
    
    return { success: true, message: 'Quote sent successfully' };
  } catch (error: any) {
    console.error('Error sending quote email:', error);
    // Sanitize error message for client response
    if (getErrorMessage(error)?.includes('SendGrid') || error.response?.body) {
      throw new Error('Email service error. Please check your configuration.');
    }
    throw new Error('Email sending failed. Please try again.');
  }
};

// Send invoice email
export const sendInvoiceEmail = async (invoice: any, client: any, business: any = {}, paymentUrl?: string | null, pdfBuffer?: Buffer) => {


  if (!client.email) {
    throw new Error('Client email address is required');
  }

  try {
    const emailData = createInvoiceEmail(invoice, client, business, paymentUrl);
    
    // Add PDF attachment if provided
    if (pdfBuffer) {
      (emailData as any).attachments = [{
        content: pdfBuffer.toString('base64'),
        filename: `Invoice-${invoice.number || invoice.id?.substring(0, 8).toUpperCase()}.pdf`,
        type: 'application/pdf',
        disposition: 'attachment'
      }];
    }
    
    await sendSystemEmail(emailData);
    
    return { success: true, message: 'Invoice sent successfully' };
  } catch (error: any) {
    console.error('Error sending invoice email:', error);
    // Sanitize error message for client response
    if (getErrorMessage(error)?.includes('SendGrid') || error.response?.body) {
      throw new Error('Email service error. Please check your configuration.');
    }
    throw new Error('Email sending failed. Please try again.');
  }
};

/**
 * @deprecated Use `sendReceiptEmailWithPdf` instead for consistent PDF generation and attachment.
 * This legacy function is kept for backwards compatibility but new code should use
 * `sendReceiptEmailWithPdf` which handles PDF generation internally.
 */
export const sendReceiptEmail = async (invoice: any, client: any, business: any = {}, pdfBuffer?: Buffer, receiptNumber?: string) => {


  if (!client.email) {
    throw new Error('Client email address is required');
  }

  try {
    const emailData = createReceiptEmail(invoice, client, business);
    
    // Add PDF attachment if provided
    if (pdfBuffer) {
      const filename = receiptNumber 
        ? `Receipt-${receiptNumber}.pdf`
        : `Receipt-${invoice.number || invoice.id?.substring(0, 8).toUpperCase()}.pdf`;
      (emailData as any).attachments = [{
        content: pdfBuffer.toString('base64'),
        filename,
        type: 'application/pdf',
        disposition: 'attachment'
      }];
    }
    
    await sendSystemEmail(emailData);
    
    return { success: true, message: 'Receipt sent successfully' };
  } catch (error: any) {
    console.error('Error sending receipt email:', error);
    // Sanitize error message for client response
    if (getErrorMessage(error)?.includes('SendGrid') || error.response?.body) {
      throw new Error('Email service error. Please check your configuration.');
    }
    throw new Error('Email sending failed. Please try again.');
  }
};

/**
 * Unified function to send receipt emails with PDF attachment.
 * This function:
 * 1. Looks up or creates a receipt record if not provided
 * 2. Always generates the receipt PDF internally
 * 3. Always attaches the PDF to the email
 * 4. Uses consistent email templating
 * 
 * @param storage - The storage interface for database operations
 * @param invoice - The invoice that was paid
 * @param client - The client receiving the receipt
 * @param business - Business settings for branding
 * @param receipt - Optional existing receipt record (will be looked up/created if not provided)
 * @param userId - The user ID for storage operations
 * @returns Promise with success status and message
 */
export async function sendReceiptEmailWithPdf(
  storage: any,
  invoice: any,
  client: any,
  business: any,
  receipt?: any,
  userId?: string
): Promise<{ success: boolean; message: string }> {
  // Check SendGrid is initialized before attempting to send
  if (!initializeSendGrid()) {
    throw new Error('SendGrid API key not configured. Please set SENDGRID_API_KEY environment variable.');
  }
  
  if (!client?.email) {
    throw new Error('Client email address is required');
  }
  
  // Determine the user ID for storage operations
  const effectiveUserId = userId || invoice.userId;
  if (!effectiveUserId) {
    throw new Error('User ID is required for receipt operations');
  }
  
  // Import PDF service functions (lazy import to avoid circular dependencies)
  const { generatePaymentReceiptPDF, generatePDFBuffer, resolveBusinessLogoForPdf } = await import('./pdfService');
  
  // Helper function to safely parse amounts (handles both string and number inputs)
  const safeParseAmount = (value: any): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return isNaN(value) ? 0 : value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };
  
  // Look up or create receipt if not provided
  let receiptRecord = receipt;
  if (!receiptRecord) {
    receiptRecord = await storage.getReceiptByInvoiceId(invoice.id, effectiveUserId);
    
    // Verify the receipt matches the invoice and client - if mismatch, create new receipt
    if (receiptRecord && (receiptRecord.invoiceId !== invoice.id || receiptRecord.clientId !== invoice.clientId)) {
      console.log(`⚠️ Receipt mismatch detected for invoice ${invoice.id}, creating new receipt`);
      receiptRecord = null;
    }
  }
  
  // If no receipt exists, create one
  if (!receiptRecord) {
    const receiptNumber = await storage.generateReceiptNumber(effectiveUserId);
    const invoiceTotal = safeParseAmount(invoice.total);
    const gstAmount = safeParseAmount(invoice.gstAmount);
    const subtotal = invoiceTotal - gstAmount;
    
    receiptRecord = await storage.createReceipt({
      userId: effectiveUserId,
      receiptNumber,
      amount: invoiceTotal.toFixed(2),
      gstAmount: gstAmount.toFixed(2),
      subtotal: subtotal.toFixed(2),
      paymentMethod: invoice.paymentMethod || 'manual',
      invoiceId: invoice.id,
      clientId: invoice.clientId,
      jobId: invoice.jobId || undefined,
      paidAt: invoice.paidAt ? new Date(invoice.paidAt) : new Date(),
      paymentReference: invoice.stripePaymentIntentId || undefined,
      description: `Payment for Invoice #${invoice.number || invoice.id?.substring(0, 8).toUpperCase()}`,
    });
    console.log(`✅ Receipt ${receiptNumber} auto-created for invoice ${invoice.number || invoice.id?.substring(0, 8).toUpperCase()}`);
  }
  
  // Resolve logo URL to base64 for PDF rendering
  const businessWithLogo = business ? await resolveBusinessLogoForPdf(business) : null;
  
  // Get job data if available
  let job = null;
  if (receiptRecord.jobId) {
    try {
      job = await storage.getJob(receiptRecord.jobId, effectiveUserId);
    } catch (e) {
      // Job lookup is optional, don't fail if not found
    }
  }
  
  // Generate receipt PDF with error handling
  let pdfBuffer: Buffer;
  try {
    const pdfHtml = generatePaymentReceiptPDF({
      payment: {
        id: receiptRecord.id,
        amount: safeParseAmount(receiptRecord.amount),
        gstAmount: safeParseAmount(receiptRecord.gstAmount),
        subtotal: safeParseAmount(receiptRecord.subtotal || receiptRecord.amount),
        paymentMethod: receiptRecord.paymentMethod || 'card',
        paymentReference: receiptRecord.paymentReference,
        paidAt: receiptRecord.paidAt,
        receiptNumber: receiptRecord.receiptNumber,
        description: receiptRecord.description,
      },
      client: client ? {
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address,
      } : null,
      business: {
        businessName: businessWithLogo?.businessName || 'Business',
        abn: businessWithLogo?.abn,
        address: businessWithLogo?.address,
        phone: businessWithLogo?.phone,
        email: businessWithLogo?.email,
        logoUrl: businessWithLogo?.logoUrl,
        brandColor: businessWithLogo?.brandColor || '#2563EB',
      },
      invoice: invoice ? {
        id: invoice.id,
        number: invoice.number,
      } : null,
      job: job ? {
        id: job.id,
        title: job.title,
      } : null,
    });
    
    pdfBuffer = await generatePDFBuffer(pdfHtml);
    
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error('PDF generation returned empty buffer');
    }
  } catch (pdfError: unknown) {
    console.error(`❌ Failed to generate receipt PDF for invoice ${invoice.id}:`, pdfError);
    throw new Error(`Failed to generate receipt PDF: ${getErrorMessage(pdfError) || 'Unknown error'}`);
  }
  
  // Get email content using existing template
  const emailContent = createReceiptEmailHtml(invoice, client, business);
  
  // Send email with PDF attachment
  await sendEmailWithAttachment({
    to: client.email,
    subject: emailContent.subject,
    html: emailContent.html,
    fromName: business?.businessName || 'JobRunner',
    replyTo: business?.email,
    attachments: [{
      filename: `Receipt-${receiptRecord.receiptNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }],
  });
  
  console.log(`✅ Receipt email with PDF sent to ${client.email} for invoice ${invoice.number || invoice.id?.substring(0, 8).toUpperCase()}`);
  
  return { success: true, message: `Receipt sent to ${client.email}` };
}

// Email template for job confirmation/scheduling
const createJobConfirmationEmail = (job: any, client: any, business: any) => {
  const brandColor = business.brandColor || '#2563EB';
  const scheduledDate = job.scheduledAt ? new Date(job.scheduledAt).toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'To be confirmed';
  
  const scheduledTime = job.scheduledAt ? new Date(job.scheduledAt).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit'
  }) : '';

  // Get logo URL - use business logo if available, otherwise JobRunner logo
  const baseUrl = getBaseUrl();
  const defaultLogoUrl = `${baseUrl}/logo.png`;
  const logoUrl = business.logoUrl || defaultLogoUrl;

  return {
    to: client.email,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: business.businessName || PLATFORM_FROM_NAME
    },
    replyTo: business.email || PLATFORM_REPLY_TO_EMAIL,
    subject: `Job Confirmed: ${job.title} - ${business.businessName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job Confirmation - ${job.title}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${brandColor}; padding: 25px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
          <div style="background: white; display: inline-block; padding: 12px 20px; border-radius: 8px; margin-bottom: 12px;">
            <img src="${logoUrl}" alt="${business.businessName || 'JobRunner'}" style="max-height: 48px; max-width: 160px; display: block;" />
          </div>
          <h1 style="color: white; margin: 0; font-size: 24px;">${business.businessName}</h1>
          ${business.abn ? `<p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.8); font-size: 12px;">ABN: ${business.abn}</p>` : ''}
        </div>

        <div style="background: #2563EB; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 22px;">Job Confirmed</h2>
          <p style="margin: 8px 0 0 0; opacity: 0.9;">Your appointment has been scheduled</p>
        </div>

        <div style="margin-bottom: 20px;">
          <p style="font-size: 16px;">Hi ${client.name?.split(' ')[0] || 'there'},</p>
          <p>Great news! We've confirmed your job booking. Here are the details:</p>
        </div>

        <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 15px 0; color: ${brandColor}; font-size: 18px;">${job.title}</h3>
          
          ${job.description ? `<p style="color: #666; margin: 0 0 20px 0;">${job.description}</p>` : ''}
          
          <div style="border-left: 4px solid ${brandColor}; padding-left: 15px; margin: 15px 0;">
            <div style="margin-bottom: 12px;">
              <p style="margin: 0; color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Scheduled Date</p>
              <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: bold; color: #333;">${scheduledDate}</p>
              ${scheduledTime ? `<p style="margin: 2px 0 0 0; color: #666;">${scheduledTime}</p>` : ''}
            </div>
            
            ${job.address ? `
            <div>
              <p style="margin: 0; color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Location</p>
              <p style="margin: 4px 0 0 0; font-size: 14px; color: #333;">${job.address}</p>
            </div>
            ` : ''}
          </div>
        </div>

        <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            <strong>Need to reschedule?</strong><br>
            Please contact us at least 24 hours before your appointment if you need to make changes.
          </p>
        </div>

        <div style="border-top: 2px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
          <h4 style="margin: 0 0 10px 0; color: #333;">Contact Us</h4>
          ${business.phone ? `<p style="margin: 5px 0; color: #666;"><strong>Phone:</strong> ${business.phone}</p>` : ''}
          ${business.email ? `<p style="margin: 5px 0; color: #666;"><strong>Email:</strong> ${business.email}</p>` : ''}
          ${business.address ? `<p style="margin: 5px 0; color: #666;"><strong>Address:</strong> ${business.address}</p>` : ''}
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="margin: 0; color: #999; font-size: 12px;">
            This confirmation was sent by ${business.businessName}${business.abn ? ` (ABN: ${business.abn})` : ''}
          </p>
          <p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">Powered by JobRunner</p>
        </div>
        
        ${UNSUBSCRIBE_FOOTER}
      </body>
      </html>
    `
  };
};

// Send job confirmation email
export const sendJobConfirmationEmail = async (job: any, client: any, business: any = {}) => {


  if (!client.email) {
    throw new Error('Client email address is required');
  }

  try {
    const emailData = createJobConfirmationEmail(job, client, business);
    
    await sendSystemEmail(emailData);
    
    return { success: true, message: 'Job confirmation sent successfully' };
  } catch (error: any) {
    console.error('Error sending job confirmation email:', error);
    if (getErrorMessage(error)?.includes('SendGrid') || error.response?.body) {
      throw new Error('Email service error. Please check your configuration.');
    }
    throw new Error('Email sending failed. Please try again.');
  }
};

// Export job confirmation HTML creator
export const createJobConfirmationEmailHtml = (job: any, client: any, business: any) => {
  const emailData = createJobConfirmationEmail(job, client, business);
  return {
    to: emailData.to,
    subject: emailData.subject,
    html: emailData.html,
  };
};

// Email template for email verification
const createEmailVerificationEmail = (user: any, verificationToken: string) => {
  const baseUrl = getBaseUrl();
  // Direct https Universal Link / App Link — opens the app on iOS/Android if
  // installed (verified via /.well-known/{apple-app-site-association,assetlinks.json}),
  // otherwise the web /verify-email page handles it.
  const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
  const logoUrl = `${baseUrl}/logo.png`;

  return {
    to: user.email,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: 'JobRunner'
    },
    replyTo: PLATFORM_REPLY_TO_EMAIL,
    subject: 'Verify Your Email Address - JobRunner',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - JobRunner</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f4f5f7;">
        <div style="max-width: 560px; margin: 0 auto; padding: 32px 16px;">
          <div style="background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e5e7eb;">
            <div style="padding: 36px 32px 12px 32px; text-align: center; background: #ffffff;">
              <img src="${logoUrl}" alt="JobRunner" style="max-width: 132px; height: auto; display: inline-block;" />
            </div>
            <div style="height: 3px; background: #F59E0B; margin: 0 32px;"></div>

            <div style="padding: 28px 32px 8px 32px;">
              <h1 style="color: #111827; margin: 0 0 8px 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">Verify your email</h1>
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 15px;">Hi ${user.firstName || 'there'}, thanks for signing up. Tap the button below to confirm this is you and finish setting up your JobRunner account.</p>

              <div style="text-align: center; margin: 28px 0 8px 0;">
                <a href="${verificationUrl}" style="background: #2563EB; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 10px; display: inline-block; font-weight: 600; font-size: 15px;">Verify email</a>
              </div>

              <p style="margin: 24px 0 0 0; font-size: 13px; color: #6b7280; text-align: center;">This link expires in 24 hours.</p>
            </div>

            <div style="padding: 20px 32px 28px 32px; border-top: 1px solid #f1f2f4; margin-top: 20px;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                If you didn't create a JobRunner account, you can safely ignore this email.
              </p>
            </div>
          </div>

          <p style="margin: 20px 0 0 0; text-align: center; color: #9ca3af; font-size: 12px;">
            <strong style="color: #6b7280;">JobRunner</strong> &bull; Built for Australian tradies
          </p>
          ${UNSUBSCRIBE_FOOTER}
        </div>
      </body>
      </html>
    `
  };
};

// Generic email interface for notification service
export interface EmailMeta {
  deliveryLogId?: string;
  userId?: string;
  type?: string;
  relatedId?: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  fromName?: string; // Custom sender name (e.g., business name)
  _meta?: EmailMeta; // Tracking metadata - propagates to SendGrid customArgs
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  notConfigured?: boolean;
}

// Send a generic email - used by notification service
export const sendEmail = async (options: EmailOptions): Promise<EmailResult> => {
  const { to, subject, text, html, replyTo, fromName, _meta } = options;
  
  const sendGridReady = await ensureSendGridReady();
  if (!sendGridReady) {
    const errorMsg = 'Email service not configured. Please set up SendGrid in Settings > Integrations.';
    console.error(`❌ EMAIL NOT SENT: ${errorMsg}`);
    return { success: false, error: errorMsg, notConfigured: true };
  }
  
  const plainText = text || (html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : 'Please view this email in an HTML-capable email client.');
  const senderName = fromName || PLATFORM_FROM_NAME;
  const fromEmail = PLATFORM_FROM_EMAIL;
  
  const emailData: any = {
    to,
    from: { email: fromEmail, name: senderName },
    subject,
    text: plainText,
    html: html || text || plainText,
    replyTo: replyTo || undefined,
    _meta,
  };

  try {
    const result = await sendSystemEmail(emailData);
    return { success: true, messageId: result.messageId || undefined };
  } catch (error: any) {
    if (error.response) {
      console.error('Email send error - Status:', error.code);
      console.error('Email send error - Body:', JSON.stringify(error.response.body, null, 2));
    } else {
      console.error('Email send error:', getErrorMessage(error));
    }
    return { success: false, error: getErrorMessage(error) || 'Failed to send email' };
  }
};

// Send login code email for passwordless authentication
export const sendLoginCodeEmail = async (email: string, code: string) => {

  
  const emailData = {
    to: email,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: 'JobRunner'
    },
    replyTo: PLATFORM_REPLY_TO_EMAIL,
    subject: 'Your JobRunner Login Code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Login Code</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #2563EB; margin: 0;">JobRunner</h1>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h2 style="color: #333;">Your Login Code</h2>
          <p>Use this code to log in to your JobRunner account:</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563EB; margin: 0;">${code}</p>
          </div>
          <p><strong>This code will expire in 10 minutes.</strong></p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
          <p>This is an automated email from JobRunner. Please do not reply to this message.</p>
          ${UNSUBSCRIBE_FOOTER}
        </div>
      </body>
      </html>
    `,
    text: `Your JobRunner Login Code: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`
  };
  
  try {
    await sendSystemEmail(emailData);
    console.log(`✅ Login code email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send login code email:', error);
    throw error;
  }
};

// Send email verification email
export const sendEmailVerificationEmail = async (user: any, verificationToken: string) => {
  if (!user.email) {
    throw new Error('User email address is required');
  }

  try {
    const emailData = createEmailVerificationEmail(user, verificationToken);
    await sendSystemEmail(emailData);
    return { success: true, message: 'Verification email sent successfully' };
  } catch (error: unknown) {
    console.error('Error sending verification email:', error);
    throw new Error('Email sending failed. Please try again.');
  }
};

export const sendPasswordResetEmail = async (user: any, resetToken: string) => {
  if (!user.email) {
    throw new Error('User email address is required');
  }

  const baseUrl = getBaseUrl();
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  const logoUrl = `${baseUrl}/logo.png`;

  const emailData = {
    to: user.email,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: 'JobRunner'
    },
    replyTo: PLATFORM_REPLY_TO_EMAIL,
    subject: 'Reset Your Password - JobRunner',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - JobRunner</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f4f5f7;">
        <div style="max-width: 560px; margin: 0 auto; padding: 32px 16px;">
          <div style="background: #ffffff; border-radius: 14px; overflow: hidden; border: 1px solid #e5e7eb;">
            <div style="padding: 36px 32px 12px 32px; text-align: center; background: #ffffff;">
              <img src="${logoUrl}" alt="JobRunner" style="max-width: 132px; height: auto; display: inline-block;" />
            </div>
            <div style="height: 3px; background: #F59E0B; margin: 0 32px;"></div>

            <div style="padding: 28px 32px 8px 32px;">
              <h1 style="color: #111827; margin: 0 0 8px 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">Reset your password</h1>
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 15px;">Hi ${user.firstName || 'there'}, we got a request to reset your JobRunner password. Tap the button below to create a new one.</p>

              <div style="text-align: center; margin: 28px 0 8px 0;">
                <a href="${resetUrl}" style="background: #2563EB; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 10px; display: inline-block; font-weight: 600; font-size: 15px;">Reset password</a>
              </div>

              <p style="margin: 24px 0 0 0; font-size: 13px; color: #6b7280; text-align: center;">This link expires in 1 hour.</p>
            </div>

            <div style="padding: 20px 32px 28px 32px; border-top: 1px solid #f1f2f4; margin-top: 20px;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
                Didn't ask for this? You can safely ignore this email — your password won't change until you create a new one.
              </p>
            </div>
          </div>

          <p style="margin: 20px 0 0 0; text-align: center; color: #9ca3af; font-size: 12px;">
            <strong style="color: #6b7280;">JobRunner</strong> &bull; Built for Australian tradies
          </p>
          ${UNSUBSCRIBE_FOOTER}
        </div>
      </body>
      </html>
    `,
    text: `Password Reset Request\n\nHi ${user.firstName || 'there'},\n\nWe received a request to reset the password for your JobRunner account.\n\nClick this link to reset your password: ${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this reset, you can safely ignore this email.\n\n- The JobRunner Team`
  };

  try {
    await sendSystemEmail(emailData);
    console.log('Password reset email sent successfully to:', user.email);
    return { success: true, message: 'Password reset email sent successfully' };
  } catch (error: unknown) {
    console.error('Error sending password reset email:', error);
    throw new Error('Email sending failed. Please try again.');
  }
};

// Payment success email
export async function sendPaymentSuccessEmail(user: any, businessSettings: any, plan: string): Promise<void> {


  const emailData = {
    to: user.email || businessSettings.email,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: 'JobRunner'
    },
    replyTo: PLATFORM_REPLY_TO_EMAIL,
    subject: `Payment Successful - ${plan} Plan Activated`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Successful</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%); padding: 30px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Payment Successful! 🎉</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <p>Hi ${user.firstName || user.username},</p>
          <p>Thank you for subscribing to JobRunner ${plan}! Your payment has been processed successfully.</p>
          
          <div style="background: white; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2563EB;">Your ${plan} Plan is Active</h3>
            <p style="margin: 0;">You now have access to all ${plan} features.</p>
          </div>
          
          <p>If you have any questions, our support team is here to help.</p>
        </div>
        
        ${UNSUBSCRIBE_FOOTER}
      </body>
      </html>
    `
  };

  try {
    await sendSystemEmail(emailData);
    console.log('✅ Payment success email sent to:', user.email);
  } catch (error) {
    console.error('❌ Failed to send payment success email:', error);
    throw error;
  }
}

// Payment failed email
export async function sendPaymentFailedEmail(user: any, businessSettings: any): Promise<void> {


  const emailData = {
    to: user.email || businessSettings.email,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: 'JobRunner'
    },
    replyTo: PLATFORM_REPLY_TO_EMAIL,
    subject: 'Payment Failed - Action Required',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Failed</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #dc2626; padding: 30px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Payment Failed</h1>
        </div>
        
        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
          <p>Hi ${user.firstName || user.username},</p>
          <p><strong>We were unable to process your subscription payment.</strong></p>
          
          <p>Please update your payment method to continue using JobRunner Pro features.</p>
        </div>
        
        ${UNSUBSCRIBE_FOOTER}
      </body>
      </html>
    `
  };

  try {
    await sendSystemEmail(emailData);
    console.log('✅ Payment failed email sent to:', user.email);
  } catch (error) {
    console.error('❌ Failed to send payment failed email:', error);
    throw error;
  }
}

// Payment request email function (for phone-to-phone payments)
interface PaymentRequestEmailParams {
  to: string;
  businessName: string;
  businessEmail?: string; // Tradie's business email for reply-to
  amount: number;
  description: string;
  paymentUrl: string;
  reference?: string;
}

export async function sendPaymentRequestEmail(params: PaymentRequestEmailParams): Promise<void> {
  const { to, businessName, businessEmail, amount, description, paymentUrl, reference } = params;


  const emailData = {
    to,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: businessName || PLATFORM_FROM_NAME
    },
    replyTo: businessEmail || PLATFORM_REPLY_TO_EMAIL,
    subject: `Payment Request from ${businessName} - $${amount.toFixed(2)}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Request</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%); padding: 30px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">${businessName}</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Payment Request</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 20px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <p style="font-size: 14px; color: #666; margin: 0 0 5px 0;">Amount Due</p>
            <p style="font-size: 36px; font-weight: bold; color: #111; margin: 0;">$${amount.toFixed(2)} AUD</p>
            <p style="font-size: 12px; color: #666; margin: 5px 0 0 0;">Includes GST</p>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 15px;">
            <p style="margin: 0 0 10px 0;"><strong>For:</strong> ${description}</p>
            ${reference ? `<p style="margin: 0;"><strong>Reference:</strong> ${reference}</p>` : ''}
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${paymentUrl}" style="background-color: #2563EB; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 18px; font-weight: bold;">
            Pay Now Securely
          </a>
          <p style="margin-top: 12px; color: #666; font-size: 14px;">Click the button above to pay with your card</p>
        </div>
        
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #E8862E;">
          <p style="margin: 0; font-size: 14px; color: #92400e;">
            <strong>Secure Payment:</strong> Your payment is processed securely through Stripe. We never store your card details.
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p style="margin: 0;">This payment request was sent by ${businessName}</p>
          <p style="margin: 5px 0 0 0;">Powered by JobRunner</p>
        </div>
      </body>
      </html>
    `
  };

  try {
    await sendSystemEmail(emailData);
    console.log('✅ Payment request email sent to:', to);
  } catch (error) {
    console.error('❌ Failed to send payment request email:', error);
    throw error;
  }
}

// Welcome email for new user signups
export async function sendWelcomeEmail(
  user: { email: string; firstName?: string | null; lastName?: string | null },
  businessName?: string,
  baseUrl?: string
): Promise<{ success: boolean; error?: string; mock?: boolean }> {

  const userName = user.firstName || user.email.split('@')[0];
  const displayBusinessName = businessName || 'your business';
  const effectiveBaseUrl = baseUrl || getBaseUrl();
  const logoUrl = `${effectiveBaseUrl}/logo.png`;

  const emailData = {
    to: user.email,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: PLATFORM_FROM_NAME
    },
    replyTo: PLATFORM_REPLY_TO_EMAIL,
    subject: 'Welcome to JobRunner - Let\'s get your business sorted!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to JobRunner</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.7; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f9fafb;">
        <div style="background: linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%); padding: 44px 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <img src="${logoUrl}" alt="JobRunner" style="max-width: 140px; height: auto; margin-bottom: 20px;" />
          <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 600; letter-spacing: -0.5px;">Welcome to JobRunner!</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 12px 0 0 0; font-size: 15px; font-weight: 400;">The business management platform built for Australian tradies</p>
        </div>
        
        <div style="background: white; padding: 32px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          <p style="font-size: 18px; margin: 0 0 20px 0; font-weight: 500; color: #111827;">G'day ${userName}!</p>
          
          <p style="margin: 0 0 20px 0; color: #4b5563;">Thanks for signing up to JobRunner. You've just taken the first step towards running a more organised, professional trade business.</p>
          
          <div style="background: #eff6ff; padding: 28px; border-radius: 12px; margin: 28px 0;">
            <h3 style="margin: 0 0 24px 0; color: #2563EB; text-align: center; font-size: 17px; font-weight: 600; letter-spacing: -0.3px;">Quick Start Guide</h3>
            
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse;">
              <tr>
                <td style="padding-bottom: 18px; vertical-align: top; width: 44px;">
                  <div style="background: linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%); color: white; width: 26px; height: 26px; border-radius: 50%; text-align: center; line-height: 26px; font-weight: 600; font-size: 13px; display: inline-block;">1</div>
                </td>
                <td style="padding-bottom: 18px; vertical-align: top;">
                  <strong style="color: #2563EB; font-size: 14px; font-weight: 600;">Set up your business profile</strong>
                  <p style="margin: 6px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.5;">Add your ABN, logo, and business details for professional quotes and invoices</p>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom: 18px; vertical-align: top; width: 44px;">
                  <div style="background: linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%); color: white; width: 26px; height: 26px; border-radius: 50%; text-align: center; line-height: 26px; font-weight: 600; font-size: 13px; display: inline-block;">2</div>
                </td>
                <td style="padding-bottom: 18px; vertical-align: top;">
                  <strong style="color: #2563EB; font-size: 14px; font-weight: 600;">Add your first client</strong>
                  <p style="margin: 6px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.5;">Store customer details and job history in one place</p>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom: 18px; vertical-align: top; width: 44px;">
                  <div style="background: linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%); color: white; width: 26px; height: 26px; border-radius: 50%; text-align: center; line-height: 26px; font-weight: 600; font-size: 13px; display: inline-block;">3</div>
                </td>
                <td style="padding-bottom: 18px; vertical-align: top;">
                  <strong style="color: #2563EB; font-size: 14px; font-weight: 600;">Create a quote</strong>
                  <p style="margin: 6px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.5;">Use our templates to send professional quotes with one click</p>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom: 18px; vertical-align: top; width: 44px;">
                  <div style="background: linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%); color: white; width: 26px; height: 26px; border-radius: 50%; text-align: center; line-height: 26px; font-weight: 600; font-size: 13px; display: inline-block;">4</div>
                </td>
                <td style="padding-bottom: 18px; vertical-align: top;">
                  <strong style="color: #2563EB; font-size: 14px; font-weight: 600;">Convert quote to job</strong>
                  <p style="margin: 6px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.5;">Once accepted, turn it into a trackable job with scheduling</p>
                </td>
              </tr>
              <tr>
                <td style="vertical-align: top; width: 44px;">
                  <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; width: 26px; height: 26px; border-radius: 50%; text-align: center; line-height: 26px; font-weight: 600; font-size: 13px; display: inline-block;">5</div>
                </td>
                <td style="vertical-align: top;">
                  <strong style="color: #047857; font-size: 14px; font-weight: 600;">Invoice & get paid</strong>
                  <p style="margin: 6px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.5;">Send invoices with Stripe payment links - get paid online instantly</p>
                </td>
              </tr>
            </table>
          </div>
          
          <div style="background: #fef3c7; padding: 16px 18px; border-radius: 10px; margin: 24px 0; border-left: 4px solid #E8862E;">
            <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
              <strong>Pro tip:</strong> Download our mobile app to manage your jobs on the go. Same account, synced data!
            </p>
          </div>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${effectiveBaseUrl}" style="background: linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%); color: white; padding: 14px 36px; text-decoration: none; border-radius: 10px; display: inline-block; font-size: 15px; font-weight: 600; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);">
              Get Started Now
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 13px; margin-top: 28px;">
            Need help? Just reply to this email and we'll get back to you.
          </p>
          
          <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; color: #374151; font-size: 14px;">
              Cheers,<br>
              <strong>The JobRunner Team</strong>
            </p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 24px; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;"><strong style="color: #6b7280;">JobRunner</strong> &bull; Built for Australian tradies</p>
          <p style="margin: 8px 0 0 0;">Questions? Visit jobrunner.com.au for support</p>
        </div>
      </body>
      </html>
    `
  };

  try {
    await sendSystemEmail(emailData);
    console.log('✅ Welcome email sent to:', user.email);
    return { success: true, mock: !isSendGridConfigured };
  } catch (error: unknown) {
    console.error('❌ Failed to send welcome email:', error);
    return { 
      success: false, 
      error: getErrorMessage(error) || 'Failed to send welcome email',
      mock: !isSendGridConfigured
    };
  }
}

// Test email function for integration testing
export async function sendTestEmail(
  toEmail: string, 
  businessName: string
): Promise<{ success: boolean; error?: string; mock?: boolean }> {


  const emailData = {
    to: toEmail,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: PLATFORM_FROM_NAME
    },
    replyTo: PLATFORM_REPLY_TO_EMAIL,
    subject: 'JobRunner - Test Email',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Test Email</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%); padding: 30px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Email Test Successful!</h1>
        </div>
        
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
          <p style="margin: 0;">Hi ${businessName},</p>
          <p>Your JobRunner email integration is working perfectly.</p>
          <p>Your clients will now receive professional emails for:</p>
          <ul>
            <li>Quotes and estimates</li>
            <li>Invoices and payment links</li>
            <li>Payment confirmations</li>
            <li>Job updates and reminders</li>
          </ul>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #666;">
          <p style="margin: 0; font-size: 12px;">This is a test email from JobRunner</p>
          <p style="margin: 5px 0 0 0; font-size: 12px;">Replies to your business emails will go to your registered email address</p>
        </div>
      </body>
      </html>
    `
  };

  try {
    await sendSystemEmail(emailData);
    console.log('✅ Test email sent to:', toEmail);
    return { success: true, mock: !isSendGridConfigured };
  } catch (error: unknown) {
    console.error('❌ Failed to send test email:', error);
    return { 
      success: false, 
      error: getErrorMessage(error) || 'Failed to send email',
      mock: !isSendGridConfigured
    };
  }
}

// Team invite email - sent when business owner invites a team member
export async function sendTeamInviteEmail(
  inviteeEmail: string,
  inviteeName: string | null,
  inviterName: string,
  businessName: string,
  roleName: string,
  inviteToken: string,
  baseUrl: string
): Promise<{ success: boolean; error?: string; mock?: boolean }> {

  const displayName = inviteeName || inviteeEmail.split('@')[0];
  // Direct https Universal Link / App Link — opens the app on iOS/Android if
  // installed (verified via /.well-known/{apple-app-site-association,assetlinks.json}),
  // otherwise the web /accept-invite/:token page handles it.
  const acceptUrl = `${baseUrl}/accept-invite/${inviteToken}`;
  const smartAppLink = acceptUrl;
  const logoUrl = `${baseUrl}/logo.png`;

  const emailData = {
    to: inviteeEmail,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: PLATFORM_FROM_NAME
    },
    replyTo: PLATFORM_REPLY_TO_EMAIL,
    subject: `You've been invited to join ${businessName} on JobRunner`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Team Invitation</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background: linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%); padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <img src="${logoUrl}" alt="JobRunner" style="max-width: 180px; height: auto; margin-bottom: 15px;" />
          <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited to Join ${businessName}</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">on JobRunner</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 18px; margin-bottom: 20px;">G'day ${displayName}!</p>
          
          <p><strong>${inviterName}</strong> has invited you to join <strong>${businessName}</strong> as a <strong>${roleName}</strong>.</p>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2563EB;">
            <h3 style="margin: 0 0 15px 0; color: #2563EB;">What you'll be able to do:</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 8px;">View and manage your assigned jobs</li>
              <li style="margin-bottom: 8px;">Track your time on jobs</li>
              <li style="margin-bottom: 8px;">Communicate with the team</li>
              <li>Access job details on your mobile</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${smartAppLink}" style="background-color: #22c55e; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold; margin-bottom: 12px;">
              Accept Invitation
            </a>
            <p style="color: #666; font-size: 13px; margin: 12px 0 8px 0;">
              Opens in the JobRunner app, or browser if app not installed
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 20px; text-align: center;">
            This invitation link will expire in 7 days.
          </p>
          
          <p style="margin-top: 25px;">
            Cheers,<br>
            <strong>The JobRunner Team</strong>
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p style="margin: 0;">JobRunner - The business management platform for Australian tradies</p>
          <p style="margin: 5px 0 0 0;">If you didn't expect this invitation, you can ignore this email.</p>
        </div>
      </body>
      </html>
    `
  };

  try {
    await sendSystemEmail(emailData);
    console.log('✅ Team invite email sent to:', inviteeEmail);
    return { success: true, mock: !isSendGridConfigured };
  } catch (error: unknown) {
    console.error('❌ Failed to send team invite email:', error);
    return { 
      success: false, 
      error: getErrorMessage(error) || 'Failed to send invite email',
      mock: !isSendGridConfigured
    };
  }
}

// Job assignment notification email - sent when tradie is assigned to a job
export async function sendJobAssignmentEmail(
  assigneeEmail: string,
  assigneeName: string | null,
  assignerName: string,
  businessName: string,
  jobTitle: string,
  jobAddress: string | null,
  scheduledDate: string | null,
  baseUrl: string,
  jobId: string
): Promise<{ success: boolean; error?: string; mock?: boolean }> {

  const displayName = assigneeName || assigneeEmail.split('@')[0];
  const jobUrl = `${baseUrl}/jobs/${jobId}`;
  const formattedDate = scheduledDate ? new Date(scheduledDate).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }) : 'Not scheduled yet';

  const emailData = {
    to: assigneeEmail,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: businessName
    },
    replyTo: PLATFORM_REPLY_TO_EMAIL,
    subject: `New Job Assigned: ${jobTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Job Assignment</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background: linear-gradient(135deg, #E8862E 0%, #C86B1A 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">New Job Assigned to You</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; margin-bottom: 20px;">Hey ${displayName},</p>
          
          <p><strong>${assignerName}</strong> has assigned you a new job.</p>
          
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #E8862E;">
            <h3 style="margin: 0 0 15px 0; color: #925714;">${jobTitle}</h3>
            ${jobAddress ? `<p style="margin: 0 0 8px 0;"><strong>Address:</strong> ${jobAddress}</p>` : ''}
            <p style="margin: 0;"><strong>Scheduled:</strong> ${formattedDate}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${jobUrl}" style="background-color: #E8862E; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold;">
              View Job Details
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Open JobRunner to see the full job details and get started.
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p style="margin: 0;">Powered by JobRunner</p>
        </div>
      </body>
      </html>
    `
  };

  try {
    await sendSystemEmail(emailData);
    console.log('✅ Job assignment email sent to:', assigneeEmail);
    return { success: true, mock: !isSendGridConfigured };
  } catch (error: unknown) {
    console.error('❌ Failed to send job assignment email:', error);
    return { 
      success: false, 
      error: getErrorMessage(error) || 'Failed to send job assignment email',
      mock: !isSendGridConfigured
    };
  }
}

// Job completion notification email - sent to owner when staff completes a job
export async function sendJobCompletionNotificationEmail(
  ownerEmail: string,
  ownerName: string | null,
  staffName: string,
  jobTitle: string,
  clientName: string | null,
  completedAt: Date,
  baseUrl: string,
  jobId: string
): Promise<{ success: boolean; error?: string; mock?: boolean }> {

  const displayName = ownerName || ownerEmail.split('@')[0];
  const jobUrl = `${baseUrl}/jobs/${jobId}`;
  const formattedDate = completedAt.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

  const emailData = {
    to: ownerEmail,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: PLATFORM_FROM_NAME
    },
    replyTo: PLATFORM_REPLY_TO_EMAIL,
    subject: `Job Completed: ${jobTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job Completed</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background: linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px;">Job Completed</h1>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <p style="font-size: 16px; margin-bottom: 20px;">Hey ${displayName},</p>
          
          <p><strong>${staffName}</strong> has marked a job as complete.</p>
          
          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #22c55e;">
            <h3 style="margin: 0 0 15px 0; color: #166534;">${jobTitle}</h3>
            ${clientName ? `<p style="margin: 0 0 8px 0;"><strong>Client:</strong> ${clientName}</p>` : ''}
            <p style="margin: 0;"><strong>Completed:</strong> ${formattedDate}</p>
          </div>
          
          <p style="font-size: 14px; color: #666;">
            The job includes photos, signatures, and time tracking data. Review the details and create an invoice.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${jobUrl}" style="background-color: #22c55e; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold;">
              View Job & Create Invoice
            </a>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p style="margin: 0;">Powered by JobRunner</p>
        </div>
      </body>
      </html>
    `
  };

  try {
    await sendSystemEmail(emailData);
    console.log('✅ Job completion notification sent to:', ownerEmail);
    return { success: true, mock: !isSendGridConfigured };
  } catch (error: unknown) {
    console.error('❌ Failed to send job completion notification:', error);
    return { 
      success: false, 
      error: getErrorMessage(error) || 'Failed to send notification',
      mock: !isSendGridConfigured
    };
  }
}

// Generic email with attachment - used for receipts and other documents
interface EmailWithAttachmentParams {
  to: string;
  subject: string;
  html: string;
  fromName?: string; // Business name to show as sender (defaults to JobRunner)
  replyTo?: string; // Reply-to email address (business email)
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
  _meta?: EmailMeta; // Tracking metadata - propagates to SendGrid customArgs
}

export async function sendEmailWithAttachment(params: EmailWithAttachmentParams): Promise<{ messageId: string | null }> {
  const fromEmail = PLATFORM_FROM_EMAIL;
  
  const emailData: any = {
    to: params.to,
    from: {
      email: fromEmail,
      name: params.fromName || PLATFORM_FROM_NAME
    },
    replyTo: params.replyTo || PLATFORM_REPLY_TO_EMAIL,
    subject: params.subject,
    html: params.html,
    _meta: params._meta,
  };
  
  if (params.attachments && params.attachments.length > 0) {
    emailData.attachments = params.attachments.map(att => ({
      content: att.content.toString('base64'),
      filename: att.filename,
      type: att.contentType,
      disposition: 'attachment'
    }));
  }
  
  try {
    const result = await sendSystemEmail(emailData);
    console.log('✅ Email with attachment sent to:', params.to);
    return { messageId: result.messageId };
  } catch (error: unknown) {
    console.error('❌ Failed to send email with attachment:', error);
    throw new Error(getErrorMessage(error) || 'Failed to send email');
  }
}

// ============================================================================
// BUSINESS TEMPLATE EMAIL INTEGRATION
// ============================================================================

/**
 * Replace merge fields in a template string with actual values
 * Supports fields like {client_name}, {quote_total}, etc.
 */
export function replaceMergeFields(template: string, data: Record<string, string | number | null | undefined>): string {
  if (!template) return '';
  
  return template.replace(/\{(\w+)\}/g, (match, fieldName) => {
    const value = data[fieldName];
    if (value === null || value === undefined) {
      return ''; // Return empty string for null/undefined values
    }
    return String(value);
  });
}

/**
 * Create a professional HTML email from a business template
 */
export function createEmailFromTemplate(
  template: { subject?: string | null; content: string; contentHtml?: string | null },
  data: Record<string, string | number | null | undefined>,
  business: any,
  client: any
): { to: string; from: { email: string; name: string }; replyTo: string; subject: string; html: string } {
  const brandColor = business.brandColor || '#2563EB';
  
  // Apply merge field replacement to subject and content
  const subject = replaceMergeFields(template.subject || 'Message from {business_name}', data);
  const contentText = replaceMergeFields(template.content, data);
  const contentHtml = template.contentHtml ? replaceMergeFields(template.contentHtml, data) : null;
  
  // Use HTML content if available, otherwise convert text to HTML
  const bodyContent = contentHtml || contentText.split('\n').map(line => 
    line.trim() ? `<p style="margin: 0 0 16px 0;">${line}</p>` : ''
  ).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: ${brandColor}; margin: 0;">${business.businessName || 'Business'}</h1>
        ${business.abn ? `<p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">ABN: ${business.abn}</p>` : ''}
      </div>

      <div style="margin-bottom: 20px;">
        ${bodyContent}
      </div>

      <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid ${brandColor};">
        <p style="margin: 0; color: #333; font-weight: 500;">Questions?</p>
        <p style="margin: 10px 0 0 0; color: #666;">Just reply to this email or give us a call.</p>
        ${business.phone ? `<p style="margin: 10px 0 0 0;"><strong>Phone:</strong> <a href="tel:${business.phone}" style="color: ${brandColor}; text-decoration: none;">${business.phone}</a></p>` : ''}
        ${business.email ? `<p style="margin: 5px 0 0 0;"><strong>Email:</strong> <a href="mailto:${business.email}" style="color: ${brandColor}; text-decoration: none;">${business.email}</a></p>` : ''}
      </div>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
        <p style="margin: 0; color: #999; font-size: 12px;">
          This email was sent by ${business.businessName || 'Business'}${business.abn ? ` (ABN: ${business.abn})` : ''}
        </p>
        ${business.address ? `<p style="margin: 5px 0 0 0; color: #999; font-size: 12px;">${business.address}</p>` : ''}
      </div>
      
      ${UNSUBSCRIBE_FOOTER}
    </body>
    </html>
  `;

  return {
    to: client.email,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: business.businessName || PLATFORM_FROM_NAME
    },
    replyTo: business.email || PLATFORM_REPLY_TO_EMAIL,
    subject,
    html
  };
}

/**
 * Build merge field data object for quotes
 */
function buildQuoteMergeData(
  quote: any,
  client: any,
  business: any,
  acceptanceUrl?: string | null
): Record<string, string | number | null> {
  const totalAmount = Number(quote.total);
  const depositPercent = quote.depositPercent || business.depositPercent || null;
  
  return {
    client_name: client.name || '',
    business_name: business.businessName || '',
    quote_number: quote.number || quote.id?.substring(0, 8).toUpperCase() || '',
    quote_total: `$${totalAmount.toFixed(2)}`,
    job_title: quote.title || '',
    job_address: quote.address || client.address || '',
    due_date: quote.validUntil ? new Date(quote.validUntil).toLocaleDateString('en-AU') : '',
    deposit_percent: depositPercent ? `${depositPercent}%` : '',
    acceptance_url: acceptanceUrl || '',
  };
}

/**
 * Build merge field data object for invoices
 */
function buildInvoiceMergeData(
  invoice: any,
  client: any,
  business: any,
  paymentUrl?: string | null
): Record<string, string | number | null> {
  const totalAmount = Number(invoice.total);
  
  return {
    client_name: client.name || '',
    business_name: business.businessName || '',
    invoice_number: invoice.number || invoice.id?.substring(0, 8).toUpperCase() || '',
    invoice_total: `$${totalAmount.toFixed(2)}`,
    job_title: invoice.title || '',
    job_address: invoice.address || client.address || '',
    due_date: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-AU') : '',
    payment_url: paymentUrl || '',
  };
}

/**
 * Send quote email using a business template (if available) or fall back to default
 */
export async function sendQuoteEmailWithTemplate(
  storage: { getActiveBusinessTemplateByPurpose: (userId: string, family: string, purpose: string) => Promise<any> },
  userId: string,
  quote: any,
  client: any,
  business: any,
  acceptanceUrl?: string | null,
  pdfBuffer?: Buffer
): Promise<{ success: boolean; message: string; usedTemplate?: boolean }> {


  if (!client.email) {
    throw new Error('Client email address is required');
  }

  try {
    // Try to get a custom template
    const template = await storage.getActiveBusinessTemplateByPurpose(userId, 'email', 'quote_sent');
    
    let emailData: any;
    let usedTemplate = false;

    if (template && template.content) {
      // Use custom template
      const mergeData = buildQuoteMergeData(quote, client, business, acceptanceUrl);
      emailData = createEmailFromTemplate(template, mergeData, business, client);
      usedTemplate = true;
      console.log('📧 Using custom quote email template:', template.name);
    } else {
      // Fall back to default hardcoded template
      emailData = createQuoteEmail(quote, client, business, acceptanceUrl);
      console.log('📧 Using default quote email template');
    }

    // Add PDF attachment if provided
    if (pdfBuffer) {
      emailData.attachments = [{
        content: pdfBuffer.toString('base64'),
        filename: `Quote-${quote.number || quote.id?.substring(0, 8).toUpperCase()}.pdf`,
        type: 'application/pdf',
        disposition: 'attachment'
      }];
    }

    await sendSystemEmail(emailData);
    
    return { 
      success: true, 
      message: 'Quote sent successfully',
      usedTemplate 
    };
  } catch (error: any) {
    console.error('Error sending quote email with template:', error);
    if (getErrorMessage(error)?.includes('SendGrid') || error.response?.body) {
      throw new Error('Email service error. Please check your configuration.');
    }
    throw new Error('Email sending failed. Please try again.');
  }
}

/**
 * Send invoice email using a business template (if available) or fall back to default
 */
export async function sendInvoiceEmailWithTemplate(
  storage: { getActiveBusinessTemplateByPurpose: (userId: string, family: string, purpose: string) => Promise<any> },
  userId: string,
  invoice: any,
  client: any,
  business: any,
  paymentUrl?: string | null,
  pdfBuffer?: Buffer
): Promise<{ success: boolean; message: string; usedTemplate?: boolean }> {


  if (!client.email) {
    throw new Error('Client email address is required');
  }

  try {
    // Try to get a custom template
    const template = await storage.getActiveBusinessTemplateByPurpose(userId, 'email', 'invoice_sent');
    
    let emailData: any;
    let usedTemplate = false;

    if (template && template.content) {
      // Use custom template
      const mergeData = buildInvoiceMergeData(invoice, client, business, paymentUrl);
      emailData = createEmailFromTemplate(template, mergeData, business, client);
      usedTemplate = true;
      console.log('📧 Using custom invoice email template:', template.name);
    } else {
      // Fall back to default hardcoded template
      emailData = createInvoiceEmail(invoice, client, business, paymentUrl);
      console.log('📧 Using default invoice email template');
    }

    // Add PDF attachment if provided
    if (pdfBuffer) {
      emailData.attachments = [{
        content: pdfBuffer.toString('base64'),
        filename: `Invoice-${invoice.number || invoice.id?.substring(0, 8).toUpperCase()}.pdf`,
        type: 'application/pdf',
        disposition: 'attachment'
      }];
    }

    await sendSystemEmail(emailData);
    
    return { 
      success: true, 
      message: 'Invoice sent successfully',
      usedTemplate 
    };
  } catch (error: any) {
    console.error('Error sending invoice email with template:', error);
    if (getErrorMessage(error)?.includes('SendGrid') || error.response?.body) {
      throw new Error('Email service error. Please check your configuration.');
    }
    throw new Error('Email sending failed. Please try again.');
  }
}

// ================================
// Daily Summary Email
// ================================

export interface DailySummaryData {
  date: string;
  dateFormatted: string;
  business: {
    name: string;
    email: string;
    brandColor?: string;
  };
  jobs: {
    completed: number;
    completedList: Array<{ title: string; client: string; value: number }>;
    scheduled: number;
    inProgress: number;
  };
  quotes: {
    sent: number;
    sentTotal: number;
    accepted: number;
    acceptedTotal: number;
    rejected: number;
    pending: number;
    conversionRate: number;
  };
  invoices: {
    sent: number;
    sentTotal: number;
    paid: number;
    paidTotal: number;
    overdue: number;
    overdueTotal: number;
  };
  payments: {
    received: number;
    totalAmount: number;
    paymentsList: Array<{ client: string; amount: number; invoice: string }>;
  };
  metrics: {
    totalRevenue: number;
    outstandingInvoices: number;
    quoteConversionRate: number;
  };
  actionItems: Array<{ type: 'overdue' | 'followup' | 'reminder'; message: string; priority: 'high' | 'medium' | 'low' }>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDateAustralian(date: Date): string {
  return date.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function createDailySummaryEmail(data: DailySummaryData): { to: string; from: any; subject: string; html: string } {
  const brandColor = data.business.brandColor || '#2563EB';
  const hasActivity = data.jobs.completed > 0 || data.quotes.sent > 0 || data.invoices.sent > 0 || data.payments.received > 0;

  const completedJobsHtml = data.jobs.completedList.length > 0 
    ? data.jobs.completedList.map(job => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #eee;">${job.title}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #eee;">${job.client}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(job.value)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="3" style="padding: 20px; text-align: center; color: #666;">No jobs completed today</td></tr>';

  const paymentsHtml = data.payments.paymentsList.length > 0
    ? data.payments.paymentsList.map(payment => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #eee;">${payment.client}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #eee;">${payment.invoice}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #eee; text-align: right; color: #2563EB; font-weight: 600;">${formatCurrency(payment.amount)}</td>
      </tr>
    `).join('')
    : '';

  const actionItemsHtml = data.actionItems.length > 0
    ? data.actionItems.map(item => {
        const priorityColor = item.priority === 'high' ? '#dc2626' : item.priority === 'medium' ? '#E8862E' : '#6b7280';
        const priorityBg = item.priority === 'high' ? '#fef2f2' : item.priority === 'medium' ? '#fffbeb' : '#f9fafb';
        return `
          <div style="padding: 12px 16px; margin-bottom: 8px; background: ${priorityBg}; border-left: 4px solid ${priorityColor}; border-radius: 4px;">
            <span style="color: ${priorityColor}; font-weight: 600; text-transform: uppercase; font-size: 11px;">${item.priority}</span>
            <p style="margin: 4px 0 0 0; color: #333;">${item.message}</p>
          </div>
        `;
      }).join('')
    : '<p style="color: #666; text-align: center; padding: 20px;">No action items - great job!</p>';

  return {
    to: data.business.email,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: 'JobRunner Daily Summary'
    },
    subject: `📊 Daily Summary for ${data.dateFormatted} - ${data.business.name}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Daily Summary - ${data.dateFormatted}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, ${brandColor}, ${brandColor}dd); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 600;">📊 End of Day Summary</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 16px;">${data.dateFormatted}</p>
          <p style="margin: 4px 0 0 0; opacity: 0.8; font-size: 14px;">${data.business.name}</p>
        </div>

        <!-- Main Content -->
        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          
          ${!hasActivity ? `
          <div style="text-align: center; padding: 40px 20px;">
            <p style="font-size: 48px; margin: 0;">😴</p>
            <p style="color: #666; font-size: 16px; margin-top: 16px;">Quiet day today - no activity to report!</p>
          </div>
          ` : `
          <!-- Key Metrics -->
          <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 30px;">
            <div style="flex: 1; min-width: 140px; background: #f0fdf4; padding: 20px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; color: #059669; font-size: 28px; font-weight: 700;">${formatCurrency(data.payments.totalAmount)}</p>
              <p style="margin: 4px 0 0 0; color: #047857; font-size: 13px;">Payments Received</p>
            </div>
            <div style="flex: 1; min-width: 140px; background: #eff6ff; padding: 20px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; color: #2563EB; font-size: 28px; font-weight: 700;">${data.jobs.completed}</p>
              <p style="margin: 4px 0 0 0; color: #2563EB; font-size: 13px;">Jobs Completed</p>
            </div>
            <div style="flex: 1; min-width: 140px; background: #faf5ff; padding: 20px; border-radius: 8px; text-align: center;">
              <p style="margin: 0; color: #7c3aed; font-size: 28px; font-weight: 700;">${data.quotes.conversionRate}%</p>
              <p style="margin: 4px 0 0 0; color: #6d28d9; font-size: 13px;">Quote Conversion</p>
            </div>
          </div>

          <!-- Jobs Summary -->
          <div style="margin-bottom: 30px;">
            <h2 style="color: ${brandColor}; font-size: 18px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid ${brandColor}20;">
              🔧 Jobs Summary
            </h2>
            <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
              <div style="background: #f8f9fa; padding: 12px 16px; border-radius: 6px;">
                <span style="color: #2563EB; font-weight: 600;">${data.jobs.completed}</span> Completed
              </div>
              <div style="background: #f8f9fa; padding: 12px 16px; border-radius: 6px;">
                <span style="color: #2563EB; font-weight: 600;">${data.jobs.inProgress}</span> In Progress
              </div>
              <div style="background: #f8f9fa; padding: 12px 16px; border-radius: 6px;">
                <span style="color: #8b5cf6; font-weight: 600;">${data.jobs.scheduled}</span> Scheduled
              </div>
            </div>
            ${data.jobs.completedList.length > 0 ? `
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr style="background: #f8f9fa;">
                  <th style="padding: 10px 12px; text-align: left; font-weight: 600;">Job</th>
                  <th style="padding: 10px 12px; text-align: left; font-weight: 600;">Client</th>
                  <th style="padding: 10px 12px; text-align: right; font-weight: 600;">Value</th>
                </tr>
              </thead>
              <tbody>
                ${completedJobsHtml}
              </tbody>
            </table>
            ` : ''}
          </div>

          <!-- Quotes Summary -->
          <div style="margin-bottom: 30px;">
            <h2 style="color: ${brandColor}; font-size: 18px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid ${brandColor}20;">
              📝 Quotes Summary
            </h2>
            <div style="display: flex; flex-wrap: wrap; gap: 12px;">
              <div style="background: #f8f9fa; padding: 12px 16px; border-radius: 6px;">
                <span style="color: #3b82f6; font-weight: 600;">${data.quotes.sent}</span> Sent (${formatCurrency(data.quotes.sentTotal)})
              </div>
              <div style="background: #f0fdf4; padding: 12px 16px; border-radius: 6px;">
                <span style="color: #2563EB; font-weight: 600;">${data.quotes.accepted}</span> Accepted (${formatCurrency(data.quotes.acceptedTotal)})
              </div>
              <div style="background: #fef2f2; padding: 12px 16px; border-radius: 6px;">
                <span style="color: #dc2626; font-weight: 600;">${data.quotes.rejected}</span> Rejected
              </div>
              <div style="background: #fffbeb; padding: 12px 16px; border-radius: 6px;">
                <span style="color: #E8862E; font-weight: 600;">${data.quotes.pending}</span> Pending
              </div>
            </div>
          </div>

          <!-- Invoices Summary -->
          <div style="margin-bottom: 30px;">
            <h2 style="color: ${brandColor}; font-size: 18px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid ${brandColor}20;">
              💰 Invoices Summary
            </h2>
            <div style="display: flex; flex-wrap: wrap; gap: 12px;">
              <div style="background: #f8f9fa; padding: 12px 16px; border-radius: 6px;">
                <span style="color: #3b82f6; font-weight: 600;">${data.invoices.sent}</span> Sent (${formatCurrency(data.invoices.sentTotal)})
              </div>
              <div style="background: #f0fdf4; padding: 12px 16px; border-radius: 6px;">
                <span style="color: #2563EB; font-weight: 600;">${data.invoices.paid}</span> Paid (${formatCurrency(data.invoices.paidTotal)})
              </div>
              ${data.invoices.overdue > 0 ? `
              <div style="background: #fef2f2; padding: 12px 16px; border-radius: 6px;">
                <span style="color: #dc2626; font-weight: 600;">${data.invoices.overdue}</span> Overdue (${formatCurrency(data.invoices.overdueTotal)})
              </div>
              ` : ''}
            </div>
          </div>

          <!-- Payments Received -->
          ${data.payments.paymentsList.length > 0 ? `
          <div style="margin-bottom: 30px;">
            <h2 style="color: ${brandColor}; font-size: 18px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid ${brandColor}20;">
              ✅ Payments Received
            </h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <thead>
                <tr style="background: #f0fdf4;">
                  <th style="padding: 10px 12px; text-align: left; font-weight: 600;">Client</th>
                  <th style="padding: 10px 12px; text-align: left; font-weight: 600;">Invoice</th>
                  <th style="padding: 10px 12px; text-align: right; font-weight: 600;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${paymentsHtml}
              </tbody>
              <tfoot>
                <tr style="background: #f0fdf4;">
                  <td colspan="2" style="padding: 12px; font-weight: 600;">Total Received</td>
                  <td style="padding: 12px; text-align: right; font-weight: 700; color: #2563EB; font-size: 16px;">${formatCurrency(data.payments.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          ` : ''}

          <!-- Action Items -->
          ${data.actionItems.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h2 style="color: ${brandColor}; font-size: 18px; margin: 0 0 16px 0; padding-bottom: 8px; border-bottom: 2px solid ${brandColor}20;">
              ⚡ Action Items
            </h2>
            ${actionItemsHtml}
          </div>
          ` : ''}
          `}

          <!-- Footer Stats -->
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <div style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; text-align: center;">
              <div>
                <p style="margin: 0; color: #666; font-size: 12px;">Total Revenue Today</p>
                <p style="margin: 4px 0 0 0; font-weight: 700; color: #2563EB; font-size: 18px;">${formatCurrency(data.metrics.totalRevenue)}</p>
              </div>
              <div>
                <p style="margin: 0; color: #666; font-size: 12px;">Outstanding Invoices</p>
                <p style="margin: 4px 0 0 0; font-weight: 700; color: #E8862E; font-size: 18px;">${formatCurrency(data.metrics.outstandingInvoices)}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p style="margin: 0;">This is your automated daily summary from JobRunner</p>
          <p style="margin: 8px 0 0 0;">You can manage your summary preferences in Settings → Automations</p>
        </div>
      </body>
      </html>
    `
  };
}

export async function sendDailySummaryEmail(summaryData: DailySummaryData): Promise<{ success: boolean; message: string }> {


  if (!summaryData.business.email) {
    throw new Error('Business email address is required');
  }

  try {
    const emailData = createDailySummaryEmail(summaryData);
    await sendSystemEmail(emailData);
    
    console.log(`📧 Daily summary sent to ${summaryData.business.email}`);
    
    return {
      success: true,
      message: 'Daily summary sent successfully'
    };
  } catch (error: any) {
    console.error('Error sending daily summary email:', error);
    if (getErrorMessage(error)?.includes('SendGrid') || error.response?.body) {
      throw new Error('Email service error. Please check your configuration.');
    }
    throw new Error('Email sending failed. Please try again.');
  }
}
