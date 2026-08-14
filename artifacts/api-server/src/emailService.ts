import sgMail from '@sendgrid/mail';
import { sendViaGmailAPI, isGmailConnected } from './gmailClient';
import { logger } from './logger';
import { getErrorMessage } from "./lib/errors";

/** HTML-escape user-controlled strings before interpolating into email templates. */
function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
      const data = await res.json() as any;
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
  // IMPORTANT: click tracking is DISABLED globally.
  // SendGrid click tracking rewrites every link in the email to route through
  // the branded link subdomain (e.g. url9318.jobrunner.com.au). That subdomain's
  // TLS certificate is not valid, so recipients clicking quote/invoice/job/invite
  // links hit Chrome's "Your connection is not private" (NET::ERR_CERT_COMMON_NAME_INVALID)
  // warning. Disabling click tracking makes every link go DIRECTLY to the genuine,
  // properly-secured JobRunner domain. Open tracking (an invisible pixel, never
  // clicked) stays on so the webhook can still populate openedAt on delivery logs.
  // Callers can still override by setting trackingSettings explicitly.
  if (!emailData.trackingSettings) {
    emailData.trackingSettings = {
      clickTracking: { enable: false, enableText: false },
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
    const { emailDeliveryLogs } = await import('@workspace/db');
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

// ============ SHARED EMAIL DESIGN SYSTEM ============
// Editorial, email-client-safe components shared across all inline emails.
// Table-based, inline CSS, system font stack — no web fonts/flexbox/grid.
const EMAIL_SYSTEM_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// One consistent primary CTA button used across every email (Outlook-safe table button).
const emailCtaButton = (text: string, url: string, brandColor: string): string => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
    <tr>
      <td align="center" style="border-radius: 8px; background-color: ${brandColor};">
        <a href="${url}" class="cta-button" style="display: inline-block; padding: 15px 36px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; line-height: 1; font-family: ${EMAIL_SYSTEM_FONT};">${text}</a>
      </td>
    </tr>
  </table>`;

// Clean editorial header: thin brand band + logo + business name + optional document label/ref.
const emailHeaderBand = (opts: {
  brandColor: string;
  logoUrl?: string | null;
  businessName?: string | null;
  abn?: string | null;
  docLabel?: string | null;
  docRef?: string | null;
}): string => {
  const { brandColor, logoUrl, businessName, abn, docLabel, docRef } = opts;
  return `
  <tr><td style="height: 4px; line-height: 4px; font-size: 0; background-color: ${brandColor};">&nbsp;</td></tr>
  <tr>
    <td class="header" style="padding: 32px 32px 0 32px;">
      ${logoUrl ? `<img src="${logoUrl}" alt="${businessName || 'JobRunner'}" style="max-height: 44px; max-width: 180px; display: block; margin-bottom: 16px;" />` : ''}
      ${businessName ? `<p style="margin: 0; color: #0f172a; font-size: 19px; font-weight: 700; line-height: 1.3;">${businessName}</p>` : ''}
      ${abn ? `<p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px;">ABN ${abn}</p>` : ''}
      ${docLabel ? `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 24px; border-top: 1px solid #e2e8f0;">
        <tr>
          <td style="padding-top: 18px; vertical-align: bottom;"><span style="color: ${brandColor}; font-size: 17px; font-weight: 700;">${docLabel}</span></td>
          ${docRef ? `<td style="padding-top: 18px; text-align: right; vertical-align: bottom;"><span style="color: #64748b; font-size: 14px;">${docRef}</span></td>` : ''}
        </tr>
      </table>` : ''}
    </td>
  </tr>`;
};

// Premium JobRunner-branded header for PLATFORM emails (NOT customer white-label
// quotes/invoices/receipts/payment-requests, which keep the business's own brand).
// Matches the team-invite header exactly: thin status accent bar + white header with
// the "Job" (blue) "Runner" (amber) wordmark and favicon. Accent defaults to brand
// blue; pass a status color (green/red) to signal success/failure while keeping look.
const jobRunnerHeader = (opts?: { accentColor?: string; baseUrl?: string }): string => {
  const accent = opts?.accentColor || '#2563EB';
  const base = opts?.baseUrl || getBaseUrl();
  return `
  <tr><td style="height: 4px; line-height: 4px; font-size: 0; background-color: ${accent};">&nbsp;</td></tr>
  <tr>
    <td style="background-color: #ffffff; padding: 32px 32px 4px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td valign="middle" style="padding-right: 10px;">
            <img src="${base}/favicon-192.png" width="32" height="32" alt="JobRunner" style="display: inline-block; border: 0; vertical-align: middle;" />
          </td>
          <td valign="middle"><span style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px; font-family: ${EMAIL_SYSTEM_FONT};"><span style="color: #2563EB;">Job</span><span style="color: #F59E0B;">Runner</span></span></td>
        </tr>
      </table>
    </td>
  </tr>`;
};

// Line item rows for the editorial line-items table.
const emailLineItemRows = (items: any[]): string => (items || []).map((item: any) => `
      <tr>
        <td style="padding: 14px 12px 14px 0; color: #1e293b; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${item.description}</td>
        <td style="padding: 14px 12px; color: #64748b; font-size: 14px; text-align: center; border-bottom: 1px solid #f1f5f9;">${Number(item.quantity).toFixed(2)}</td>
        <td style="padding: 14px 12px; color: #64748b; font-size: 14px; text-align: right; border-bottom: 1px solid #f1f5f9;">$${Number(item.unitPrice).toFixed(2)}</td>
        <td style="padding: 14px 0 14px 12px; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #f1f5f9;">$${Number(item.total).toFixed(2)}</td>
      </tr>`).join('');

// Full email shell: head reset + responsive block + white 600px container + JobRunner footer.
const renderEmailShell = (title: string, innerRows: string, footerNote?: string): string => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${title}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style type="text/css">
    :root { color-scheme: light; supported-color-schemes: light; }
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .content { padding: 24px !important; }
      .header { padding: 28px 24px 0 24px !important; }
      .line-items td { padding: 8px 4px !important; font-size: 13px !important; }
      .cta-button { padding: 14px 24px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: ${EMAIL_SYSTEM_FONT};">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table class="container" role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0;">
          ${innerRows}
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; margin-top: 20px;">
          <tr>
            <td align="center" style="padding: 8px 24px; color: #94a3b8; font-size: 12px; line-height: 1.6;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">Sent with <strong style="color: #475569;">JobRunner</strong> &mdash; built for Australian tradies</p>
              ${footerNote ? `<p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 11px;">${footerNote}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// Subcontractor invoice/quote notification to the business owner. Branded with the
// subcontractor's OWN business (logo + brand colour) so it reads like a real tax
// invoice/quote from them, with a CTA into the owner's JobRunner dashboard to review/pay.
export const createSubcontractorInvoiceEmail = (opts: {
  invoiceNumber: string;
  invoiceId?: string;
  docLabel: string;
  ownerName?: string | null;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  gstApplied: boolean;
  dueDate?: Date | string | null;
  notes?: string | null;
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  subcontractor: { businessName?: string | null; abn?: string | null; logoUrl?: string | null; brandColor?: string | null };
  ctaUrl?: string;
}): string => {
  const rawBrand = (opts.subcontractor.brandColor || '').trim();
  const brandColor = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(rawBrand) ? rawBrand : '#2563EB';
  const esc = (s: string | null | undefined): string =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const baseUrl = getBaseUrl();
  const ctaUrl = opts.ctaUrl
    || (opts.invoiceId
      ? `${baseUrl}/subcontractor-invoices?invoice=${encodeURIComponent(opts.invoiceId)}`
      : `${baseUrl}/subcontractor-invoices`);
  // Logo lands in an <img src> — only allow http(s)/data, else fall back to the JobRunner logo.
  const rawLogo = opts.subcontractor.logoUrl || '';
  let logoUrl = `${baseUrl}/logo.png`;
  if (/^https?:\/\//i.test(rawLogo) || /^data:image\//i.test(rawLogo)) {
    logoUrl = rawLogo;
  } else if (rawLogo.startsWith('/')) {
    logoUrl = `${baseUrl}${rawLogo}`;
  }
  const subName = esc(opts.subcontractor.businessName || 'A subcontractor');
  const ownerName = esc(opts.ownerName || 'there');
  const dueStr = opts.dueDate ? new Date(opts.dueDate).toLocaleDateString('en-AU') : null;
  const isQuote = opts.docLabel.toLowerCase().includes('quote');

  const totalsHtml = opts.gstApplied ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Subtotal</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; text-align: right;">$${opts.subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">GST (10%)</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; text-align: right;">$${opts.gstAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 14px 0 0 0; color: #0f172a; font-size: 17px; font-weight: 700; border-top: 2px solid #e2e8f0;">Total</td>
                <td style="padding: 14px 0 0 0; color: ${brandColor}; font-size: 17px; font-weight: 700; text-align: right; border-top: 2px solid #e2e8f0;">$${opts.totalAmount.toFixed(2)}</td>
              </tr>` : `
              <tr>
                <td style="padding: 0; color: #0f172a; font-size: 17px; font-weight: 700;">Total</td>
                <td style="padding: 0; color: ${brandColor}; font-size: 22px; font-weight: 700; text-align: right;">$${opts.totalAmount.toFixed(2)}</td>
              </tr>`;

  const itemRows = (opts.items || []).map(it => `
      <tr>
        <td style="padding: 14px 12px 14px 0; color: #1e293b; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${esc(it.description)}</td>
        <td style="padding: 14px 12px; color: #64748b; font-size: 14px; text-align: center; border-bottom: 1px solid #f1f5f9;">${Number(it.quantity).toFixed(2)}</td>
        <td style="padding: 14px 12px; color: #64748b; font-size: 14px; text-align: right; border-bottom: 1px solid #f1f5f9;">$${Number(it.unitPrice).toFixed(2)}</td>
        <td style="padding: 14px 0 14px 12px; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #f1f5f9;">$${Number(it.total).toFixed(2)}</td>
      </tr>`).join('');

  const innerRows = `
    ${emailHeaderBand({ brandColor, logoUrl, businessName: esc(opts.subcontractor.businessName), abn: esc(opts.subcontractor.abn), docLabel: esc(opts.docLabel), docRef: `No. ${esc(opts.invoiceNumber)}` })}
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <p style="margin: 0; color: #0f172a; font-size: 17px; font-weight: 600;">Hi ${ownerName},</p>
        <p style="margin: 12px 0 0 0; color: #475569; font-size: 15px; line-height: 1.65;">${subName} has sent you a ${isQuote ? 'quote' : 'tax invoice'} for <strong style="color: #0f172a;">$${opts.totalAmount.toFixed(2)}</strong>${opts.gstApplied ? ' (inc. GST)' : ''}.${dueStr && !isQuote ? ` Payment is due by <strong style="color: #0f172a;">${dueStr}</strong>.` : ''}</p>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        ${emailCtaButton(isQuote ? 'Review Quote' : `Review &amp; Pay &mdash; $${opts.totalAmount.toFixed(2)}`, ctaUrl, brandColor)}
        <p style="margin: 14px 0 0 0; color: #64748b; font-size: 13px; text-align: center;">Approve or mark as paid in your JobRunner dashboard</p>
        <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 12px; text-align: center; line-height: 1.6;">Or paste this link into your browser:<br><a href="${ctaUrl}" style="color: ${brandColor}; word-break: break-all;">${ctaUrl}</a></p>
      </td>
    </tr>
    ${itemRows ? `
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <table role="presentation" class="line-items" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding: 0 12px 10px 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Description</td>
            <td style="padding: 0 12px 10px 12px; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; text-align: center; border-bottom: 2px solid #e2e8f0;">${isQuote ? 'Qty' : 'Qty / Hrs'}</td>
            <td style="padding: 0 12px 10px 12px; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; text-align: right; border-bottom: 2px solid #e2e8f0;">${isQuote ? 'Unit' : 'Rate'}</td>
            <td style="padding: 0 0 10px 12px; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; text-align: right; border-bottom: 2px solid #e2e8f0;">Amount</td>
          </tr>
          ${itemRows}
        </table>
      </td>
    </tr>` : ''}
    <tr>
      <td class="content" style="padding: 20px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr><td><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 260px; margin-left: auto;">
            ${totalsHtml}
          </table></td></tr>
        </table>
      </td>
    </tr>
    ${opts.notes ? `
    <tr>
      <td class="content" style="padding: 24px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <tr><td style="padding: 16px 20px;">
            <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600;">Notes</p>
            <p style="margin: 8px 0 0 0; color: #475569; font-size: 14px; line-height: 1.6;">${esc(opts.notes)}</p>
          </td></tr>
        </table>
      </td>
    </tr>` : ''}
    <tr><td class="content" style="padding: 28px 32px 8px 32px;">&nbsp;</td></tr>`;

  return renderEmailShell(`${opts.docLabel} ${opts.invoiceNumber}`, innerRows, 'You can review, approve and pay this from your JobRunner dashboard.');
};

// Email template for quotes
const createQuoteEmail = (quote: any, client: any, business: any, acceptanceUrl?: string | null) => {
  // Use persisted totals from the database instead of recalculating
  const subtotal = Number(quote.subtotal);
  const gstAmount = Number(quote.gstAmount);
  const totalAmount = Number(quote.total);
  const brandColor = business.brandColor || '#2563EB';
  const quoteRef = quote.number || quote.id?.substring(0, 8).toUpperCase();

  // Get logo URL - use business logo if available, otherwise JobRunner logo
  const baseUrl = getBaseUrl();
  const defaultLogoUrl = `${baseUrl}/logo.png`;
  const logoUrl = business.logoUrl || defaultLogoUrl;

  const totalsHtml = business.gstEnabled ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Subtotal</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; text-align: right;">$${subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">GST (10%)</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; text-align: right;">$${gstAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 14px 0 0 0; color: #0f172a; font-size: 17px; font-weight: 700; border-top: 2px solid #e2e8f0;">Total</td>
                <td style="padding: 14px 0 0 0; color: ${brandColor}; font-size: 17px; font-weight: 700; text-align: right; border-top: 2px solid #e2e8f0;">$${totalAmount.toFixed(2)}</td>
              </tr>` : `
              <tr>
                <td style="padding: 0; color: #0f172a; font-size: 17px; font-weight: 700;">Total</td>
                <td style="padding: 0; color: ${brandColor}; font-size: 22px; font-weight: 700; text-align: right;">$${totalAmount.toFixed(2)}</td>
              </tr>`;

  const innerRows = `
    ${emailHeaderBand({ brandColor, logoUrl, businessName: business.businessName, abn: business.abn, docLabel: 'Quote', docRef: `No. ${quoteRef}` })}
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <p style="margin: 0; color: #0f172a; font-size: 17px; font-weight: 600;">Hi ${client.name},</p>
        <p style="margin: 12px 0 0 0; color: #475569; font-size: 15px; line-height: 1.65;">Thanks for getting in touch. Here's your quote for the work we discussed &mdash; have a read and let us know if you'd like to go ahead.</p>
      </td>
    </tr>
    ${acceptanceUrl ? `
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        ${emailCtaButton('View &amp; Accept Quote', acceptanceUrl, brandColor)}
        <p style="margin: 16px 0 0 0; color: #94a3b8; font-size: 12px; text-align: center; line-height: 1.6;">Or paste this link into your browser:<br><a href="${acceptanceUrl}" style="color: ${brandColor}; word-break: break-all;">${acceptanceUrl}</a></p>
      </td>
    </tr>
    ` : ''}
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <tr>
            <td style="padding: 18px 20px;">
              <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600;">Job</p>
              <p style="margin: 6px 0 0 0; color: #0f172a; font-size: 16px; font-weight: 600;">${quote.title}</p>
              ${quote.description ? `<p style="margin: 10px 0 0 0; color: #475569; font-size: 14px; line-height: 1.6;">${quote.description}</p>` : ''}
              <p style="margin: 14px 0 0 0; color: #64748b; font-size: 13px;">Date: ${new Date(quote.createdAt).toLocaleDateString('en-AU')}</p>
              ${quote.validUntil ? `<p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Valid until: ${new Date(quote.validUntil).toLocaleDateString('en-AU')}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${quote.lineItems?.length ? `
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <table role="presentation" class="line-items" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding: 0 12px 10px 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Description</td>
            <td style="padding: 0 12px 10px 12px; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; text-align: center; border-bottom: 2px solid #e2e8f0;">Qty</td>
            <td style="padding: 0 12px 10px 12px; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; text-align: right; border-bottom: 2px solid #e2e8f0;">Unit</td>
            <td style="padding: 0 0 10px 12px; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; text-align: right; border-bottom: 2px solid #e2e8f0;">Total</td>
          </tr>
          ${emailLineItemRows(quote.lineItems)}
        </table>
      </td>
    </tr>
    ` : ''}
    <tr>
      <td class="content" style="padding: 24px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" align="right" style="min-width: 240px;">
                ${totalsHtml}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${quote.notes ? `
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600;">Notes</p>
        <p style="margin: 8px 0 0 0; color: #475569; font-size: 14px; line-height: 1.65;">${quote.notes}</p>
      </td>
    </tr>
    ` : ''}
    ${acceptanceUrl ? `
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        ${emailCtaButton('Accept This Quote', acceptanceUrl, brandColor)}
      </td>
    </tr>
    ` : ''}
    <tr>
      <td class="content" style="padding: 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #e2e8f0;">
          <tr>
            <td style="padding-top: 24px;">
              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">Questions about this quote? Just reply to this email or give us a call&nbsp;&mdash; happy to help.</p>
              <p style="margin: 16px 0 0 0; color: #0f172a; font-size: 15px; font-weight: 600;">${business.businessName}</p>
              ${business.phone ? `<p style="margin: 4px 0 0 0;"><a href="tel:${business.phone}" style="color: ${brandColor}; text-decoration: none; font-size: 14px;">${business.phone}</a></p>` : ''}
              ${business.email ? `<p style="margin: 4px 0 0 0;"><a href="mailto:${business.email}" style="color: ${brandColor}; text-decoration: none; font-size: 14px;">${business.email}</a></p>` : ''}
              ${business.address ? `<p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">${business.address}</p>` : ''}
              ${business.abn ? `<p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 12px;">ABN ${business.abn}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  // Platform sends from noreply@jobrunner.com.au, but reply-to goes to the tradie's business email
  return {
    to: client.email,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: business.businessName || PLATFORM_FROM_NAME
    },
    replyTo: business.email || PLATFORM_REPLY_TO_EMAIL,
    subject: `Quote #${quote.number || quote.id?.substring(0, 8).toUpperCase()} from ${business.businessName}`,
    html: renderEmailShell(`Quote - ${quote.title}`, innerRows, 'This is a transactional email regarding your quote request.')
  };
};

// Email template for invoices
const createInvoiceEmail = (invoice: any, client: any, business: any, paymentUrl?: string | null) => {
  // Use persisted totals from the database
  const subtotal = Number(invoice.subtotal);
  const gstAmount = Number(invoice.gstAmount);
  const totalAmount = Number(invoice.total);
  const brandColor = business.brandColor || '#2563EB';
  const dueDateStr = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-AU') : null;
  const invoiceRef = invoice.number || invoice.id?.substring(0, 8).toUpperCase();

  // Get logo URL - use business logo if available, otherwise JobRunner logo
  const baseUrl = getBaseUrl();
  const defaultLogoUrl = `${baseUrl}/logo.png`;
  const logoUrl = business.logoUrl || defaultLogoUrl;

  const totalsHtml = business.gstEnabled ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Subtotal</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; text-align: right;">$${subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">GST (10%)</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; text-align: right;">$${gstAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 14px 0 0 0; color: #0f172a; font-size: 17px; font-weight: 700; border-top: 2px solid #e2e8f0;">Total</td>
                <td style="padding: 14px 0 0 0; color: ${brandColor}; font-size: 17px; font-weight: 700; text-align: right; border-top: 2px solid #e2e8f0;">$${totalAmount.toFixed(2)}</td>
              </tr>` : `
              <tr>
                <td style="padding: 0; color: #0f172a; font-size: 17px; font-weight: 700;">Total</td>
                <td style="padding: 0; color: ${brandColor}; font-size: 22px; font-weight: 700; text-align: right;">$${totalAmount.toFixed(2)}</td>
              </tr>`;

  const innerRows = `
    ${emailHeaderBand({ brandColor, logoUrl, businessName: business.businessName, abn: business.abn, docLabel: 'Tax Invoice', docRef: `No. ${invoiceRef}` })}
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <p style="margin: 0; color: #0f172a; font-size: 17px; font-weight: 600;">Hi ${client.name},</p>
        <p style="margin: 12px 0 0 0; color: #475569; font-size: 15px; line-height: 1.65;">Here's your invoice for the completed work.${dueDateStr ? ` Payment is due by <strong style="color: #0f172a;">${dueDateStr}</strong>.` : ''}</p>
      </td>
    </tr>
    ${paymentUrl ? `
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        ${emailCtaButton(`Pay Now &mdash; $${totalAmount.toFixed(2)}`, paymentUrl, brandColor)}
        <p style="margin: 14px 0 0 0; color: #64748b; font-size: 13px; text-align: center;">Secure payment via card</p>
        <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 12px; text-align: center; line-height: 1.6;">Or paste this link into your browser:<br><a href="${paymentUrl}" style="color: ${brandColor}; word-break: break-all;">${paymentUrl}</a></p>
      </td>
    </tr>
    ` : ''}
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <tr>
            <td style="padding: 18px 20px;">
              <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600;">Job</p>
              <p style="margin: 6px 0 0 0; color: #0f172a; font-size: 16px; font-weight: 600;">${invoice.title}</p>
              ${invoice.description ? `<p style="margin: 10px 0 0 0; color: #475569; font-size: 14px; line-height: 1.6;">${invoice.description}</p>` : ''}
              <p style="margin: 14px 0 0 0; color: #64748b; font-size: 13px;">Date: ${new Date(invoice.createdAt).toLocaleDateString('en-AU')}</p>
              ${dueDateStr ? `<p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Due date: ${dueDateStr}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${invoice.lineItems?.length ? `
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <table role="presentation" class="line-items" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding: 0 12px 10px 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Description</td>
            <td style="padding: 0 12px 10px 12px; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; text-align: center; border-bottom: 2px solid #e2e8f0;">Qty</td>
            <td style="padding: 0 12px 10px 12px; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; text-align: right; border-bottom: 2px solid #e2e8f0;">Unit</td>
            <td style="padding: 0 0 10px 12px; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; text-align: right; border-bottom: 2px solid #e2e8f0;">Total</td>
          </tr>
          ${emailLineItemRows(invoice.lineItems)}
        </table>
      </td>
    </tr>
    ` : ''}
    <tr>
      <td class="content" style="padding: 24px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" align="right" style="min-width: 240px;">
                ${totalsHtml}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${invoice.notes ? `
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600;">Notes</p>
        <p style="margin: 8px 0 0 0; color: #475569; font-size: 14px; line-height: 1.65;">${invoice.notes}</p>
      </td>
    </tr>
    ` : ''}
    ${paymentUrl ? `
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        ${emailCtaButton(`Pay $${totalAmount.toFixed(2)} Now`, paymentUrl, brandColor)}
      </td>
    </tr>
    ` : `
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <tr>
            <td style="padding: 18px 20px;">
              <p style="margin: 0; color: #0f172a; font-size: 15px; font-weight: 600;">Payment methods</p>
              <p style="margin: 10px 0 0 0; color: #475569; font-size: 14px; line-height: 1.6;">Please contact us for payment options including bank transfer or card payment.</p>
              ${business.bankName ? `<p style="margin: 12px 0 0 0; color: #475569; font-size: 14px;"><strong style="color: #0f172a;">Bank:</strong> ${business.bankName}</p>` : ''}
              ${business.bsb ? `<p style="margin: 4px 0 0 0; color: #475569; font-size: 14px;"><strong style="color: #0f172a;">BSB:</strong> ${business.bsb}</p>` : ''}
              ${business.accountNumber ? `<p style="margin: 4px 0 0 0; color: #475569; font-size: 14px;"><strong style="color: #0f172a;">Account:</strong> ${business.accountNumber}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    `}
    <tr>
      <td class="content" style="padding: 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #e2e8f0;">
          <tr>
            <td style="padding-top: 24px;">
              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">Questions about this invoice? Just reply to this email or give us a call&nbsp;&mdash; happy to help.</p>
              <p style="margin: 16px 0 0 0; color: #0f172a; font-size: 15px; font-weight: 600;">${business.businessName}</p>
              ${business.phone ? `<p style="margin: 4px 0 0 0;"><a href="tel:${business.phone}" style="color: ${brandColor}; text-decoration: none; font-size: 14px;">${business.phone}</a></p>` : ''}
              ${business.email ? `<p style="margin: 4px 0 0 0;"><a href="mailto:${business.email}" style="color: ${brandColor}; text-decoration: none; font-size: 14px;">${business.email}</a></p>` : ''}
              ${business.address ? `<p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">${business.address}</p>` : ''}
              <p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 12px;">This is a tax invoice from ${business.businessName}${business.abn ? ` (ABN ${business.abn})` : ''}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  // Platform sends from noreply@jobrunner.com.au, but reply-to goes to the tradie's business email
  return {
    to: client.email,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: business.businessName || PLATFORM_FROM_NAME
    },
    replyTo: business.email || PLATFORM_REPLY_TO_EMAIL,
    subject: `Invoice #${invoice.number || invoice.id?.substring(0, 8).toUpperCase()} from ${business.businessName}${dueDateStr ? ` - Due ${dueDateStr}` : ''}`,
    html: renderEmailShell(`Invoice - ${invoice.title}`, innerRows, 'This is a transactional email regarding your invoice.')
  };
};

// Email template for receipts (when invoice is marked as paid)
const createReceiptEmail = (invoice: any, client: any, business: any) => {
  // Use persisted totals from the database
  const subtotal = Number(invoice.subtotal);
  const gstAmount = Number(invoice.gstAmount);
  const totalAmount = Number(invoice.total);
  const brandColor = business.brandColor || '#2563EB';
  const receiptRef = invoice.id?.substring(0, 8).toUpperCase();

  // Get logo URL - use business logo if available, otherwise JobRunner logo
  const baseUrl = getBaseUrl();
  const defaultLogoUrl = `${baseUrl}/logo.png`;
  const logoUrl = business.logoUrl || defaultLogoUrl;

  const totalsHtml = business.gstEnabled ? `
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">Subtotal</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; text-align: right;">$${subtotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b; font-size: 14px;">GST (10%)</td>
                <td style="padding: 6px 0; color: #1e293b; font-size: 14px; text-align: right;">$${gstAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 14px 0 0 0; color: #0f172a; font-size: 17px; font-weight: 700; border-top: 2px solid #e2e8f0;">Amount paid</td>
                <td style="padding: 14px 0 0 0; color: ${brandColor}; font-size: 17px; font-weight: 700; text-align: right; border-top: 2px solid #e2e8f0;">$${totalAmount.toFixed(2)}</td>
              </tr>` : `
              <tr>
                <td style="padding: 0; color: #0f172a; font-size: 17px; font-weight: 700;">Amount paid</td>
                <td style="padding: 0; color: ${brandColor}; font-size: 22px; font-weight: 700; text-align: right;">$${totalAmount.toFixed(2)}</td>
              </tr>`;

  const innerRows = `
    ${emailHeaderBand({ brandColor, logoUrl, businessName: business.businessName, abn: business.abn, docLabel: 'Receipt', docRef: `No. ${receiptRef}` })}
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <p style="margin: 0; color: #0f172a; font-size: 17px; font-weight: 600;">Hi ${client.name},</p>
        <p style="margin: 12px 0 0 0; color: #475569; font-size: 15px; line-height: 1.65;">Thanks &mdash; this confirms we've received your payment in full. Here's your receipt for your records.</p>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <tr>
            <td style="padding: 18px 20px;">
              <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600;">Service</p>
              <p style="margin: 6px 0 0 0; color: #0f172a; font-size: 16px; font-weight: 600;">${invoice.title}</p>
              ${invoice.description ? `<p style="margin: 10px 0 0 0; color: #475569; font-size: 14px; line-height: 1.6;">${invoice.description}</p>` : ''}
              <p style="margin: 14px 0 0 0; color: #64748b; font-size: 13px;">Client: ${client.name}</p>
              <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Payment date: ${new Date(invoice.paidAt || Date.now()).toLocaleDateString()}</p>
              <p style="margin: 12px 0 0 0;"><span style="display: inline-block; background-color: #ecfdf5; color: #059669; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.4px;">PAID</span></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${invoice.lineItems?.length ? `
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <table role="presentation" class="line-items" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding: 0 12px 10px 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Description</td>
            <td style="padding: 0 12px 10px 12px; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; text-align: center; border-bottom: 2px solid #e2e8f0;">Qty</td>
            <td style="padding: 0 12px 10px 12px; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; text-align: right; border-bottom: 2px solid #e2e8f0;">Unit</td>
            <td style="padding: 0 0 10px 12px; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; text-align: right; border-bottom: 2px solid #e2e8f0;">Total</td>
          </tr>
          ${emailLineItemRows(invoice.lineItems)}
        </table>
      </td>
    </tr>
    ` : ''}
    <tr>
      <td class="content" style="padding: 24px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" align="right" style="min-width: 240px;">
                ${totalsHtml}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${invoice.notes ? `
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600;">Notes</p>
        <p style="margin: 8px 0 0 0; color: #475569; font-size: 14px; line-height: 1.65;">${invoice.notes}</p>
      </td>
    </tr>
    ` : ''}
    <tr>
      <td class="content" style="padding: 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #e2e8f0;">
          <tr>
            <td style="padding-top: 24px;">
              <p style="margin: 0; color: #0f172a; font-size: 15px; font-weight: 600;">Thanks for your business.</p>
              <p style="margin: 8px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">This receipt confirms that payment has been received in full.</p>
              <p style="margin: 16px 0 0 0; color: #0f172a; font-size: 15px; font-weight: 600;">${business.businessName}</p>
              ${business.phone ? `<p style="margin: 4px 0 0 0;"><a href="tel:${business.phone}" style="color: ${brandColor}; text-decoration: none; font-size: 14px;">${business.phone}</a></p>` : ''}
              ${business.email ? `<p style="margin: 4px 0 0 0;"><a href="mailto:${business.email}" style="color: ${brandColor}; text-decoration: none; font-size: 14px;">${business.email}</a></p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  // Platform sends from noreply@jobrunner.com.au, but reply-to goes to the tradie's business email
  return {
    to: client.email,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: business.businessName || PLATFORM_FROM_NAME
    },
    replyTo: business.email || PLATFORM_REPLY_TO_EMAIL,
    subject: `Receipt: ${invoice.title}`,
    html: renderEmailShell(`Receipt - ${invoice.title}`, innerRows, 'This is a transactional email regarding your payment.')
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
        paymentMethod: receiptRecord.paymentMethod || 'card',
        reference: receiptRecord.paymentReference || undefined,
        paidAt: receiptRecord.paidAt || new Date(),
      },
      client: client ? {
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address,
      } : undefined,
      business: businessWithLogo,
      invoice: invoice ? {
        number: invoice.number,
      } : undefined,
      job: job ? {
        title: job.title,
      } : undefined,
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
        <meta name="color-scheme" content="light">
        <meta name="supported-color-schemes" content="light">
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
    // Disable SendGrid click tracking so the verify link stays on the real
    // jobrunner.com.au domain (not the urlXXXX.jobrunner.com.au tracking
    // subdomain, which can fail TLS and trigger a browser security warning).
    trackingSettings: {
      clickTracking: { enable: false, enableText: false },
      openTracking: { enable: true },
      subscriptionTracking: { enable: false },
    },
    html: renderEmailShell('Verify Your Email - JobRunner', `
    ${jobRunnerHeader()}
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <h1 style="margin: 0; color: #0f172a; font-size: 22px; font-weight: 700; line-height: 1.3;">Verify your email</h1>
        <p style="margin: 14px 0 0 0; color: #475569; font-size: 15px; line-height: 1.6;">Hi ${user.firstName || 'there'}, thanks for signing up. Confirm this is you to finish setting up your JobRunner account.</p>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        ${emailCtaButton('Verify email', verificationUrl, '#2563EB')}
        <p style="margin: 18px 0 0 0; color: #94a3b8; font-size: 12px; text-align: center; line-height: 1.6;">This link expires in 24 hours. Or paste this into your browser:<br><a href="${verificationUrl}" style="color: #2563EB; word-break: break-all;">${verificationUrl}</a></p>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 32px 32px;">
        <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">If you didn't create a JobRunner account, you can safely ignore this email.</p>
      </td>
    </tr>
    `)
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
        <meta name="color-scheme" content="light">
        <meta name="supported-color-schemes" content="light">
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
    // Disable click tracking — reset links must hit jobrunner.com.au directly
    // (the SendGrid tracking subdomain can break under TLS/HSTS).
    trackingSettings: {
      clickTracking: { enable: false, enableText: false },
      openTracking: { enable: true },
      subscriptionTracking: { enable: false },
    },
    html: renderEmailShell('Reset Your Password - JobRunner', `
    ${jobRunnerHeader()}
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <h1 style="margin: 0; color: #0f172a; font-size: 22px; font-weight: 700; line-height: 1.3;">Reset your password</h1>
        <p style="margin: 14px 0 0 0; color: #475569; font-size: 15px; line-height: 1.6;">Hi ${user.firstName || 'there'}, we got a request to reset your JobRunner password. Use the button below to create a new one.</p>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        ${emailCtaButton('Reset password', resetUrl, '#2563EB')}
        <p style="margin: 18px 0 0 0; color: #94a3b8; font-size: 12px; text-align: center; line-height: 1.6;">This link expires in 1 hour. Or paste this into your browser:<br><a href="${resetUrl}" style="color: #2563EB; word-break: break-all;">${resetUrl}</a></p>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 32px 32px;">
        <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">Didn't ask for this? You can safely ignore this email &mdash; your password won't change until you create a new one.</p>
      </td>
    </tr>
    `),
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

  const baseUrl = getBaseUrl();
  const logoUrl = `${baseUrl}/logo.png`;

  const emailData = {
    to: user.email || businessSettings.email,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: 'JobRunner'
    },
    replyTo: PLATFORM_REPLY_TO_EMAIL,
    subject: `Payment Successful - ${plan} Plan Activated`,
    html: renderEmailShell('Payment Successful', `
    ${jobRunnerHeader({ accentColor: '#16a34a' })}
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <h1 style="margin: 0; color: #0f172a; font-size: 22px; font-weight: 700; line-height: 1.3;">Payment received &mdash; you're all set</h1>
        <p style="margin: 14px 0 0 0; color: #475569; font-size: 15px; line-height: 1.6;">Hi ${user.firstName || user.username}, thanks for subscribing to JobRunner ${plan}. Your payment went through and your account is good to go.</p>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <tr>
            <td style="padding: 18px 20px;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px; font-weight: 600;">Your plan</p>
              <p style="margin: 6px 0 0 0; color: #0f172a; font-size: 18px; font-weight: 700;">${plan} &mdash; active</p>
              <p style="margin: 8px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">You now have access to all ${plan} features.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 0 32px;">
        ${emailCtaButton('Go to JobRunner', baseUrl, '#2563EB')}
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 32px 32px;">
        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">If you have any questions, just reply to this email &mdash; our support team is here to help.</p>
      </td>
    </tr>
    `)
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

  const baseUrl = getBaseUrl();
  const logoUrl = `${baseUrl}/logo.png`;

  const emailData = {
    to: user.email || businessSettings.email,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: 'JobRunner'
    },
    replyTo: PLATFORM_REPLY_TO_EMAIL,
    subject: 'Payment Failed - Action Required',
    html: renderEmailShell('Payment Failed', `
    ${jobRunnerHeader({ accentColor: '#dc2626' })}
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <h1 style="margin: 0; color: #0f172a; font-size: 22px; font-weight: 700; line-height: 1.3;">We couldn't process your payment</h1>
        <p style="margin: 14px 0 0 0; color: #475569; font-size: 15px; line-height: 1.6;">Hi ${user.firstName || user.username}, your most recent subscription payment didn't go through. This usually just means your card has expired or needs updating.</p>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
          <tr>
            <td style="padding: 18px 20px;">
              <p style="margin: 0; color: #b91c1c; font-size: 14px; font-weight: 600;">Action needed</p>
              <p style="margin: 8px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">Please update your payment method to keep your JobRunner Pro features active.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 0 32px;">
        ${emailCtaButton('Update payment method', baseUrl, '#2563EB')}
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 32px 32px;">
        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">If you think this is a mistake or need a hand, just reply to this email &mdash; we're happy to help.</p>
      </td>
    </tr>
    `)
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
    html: renderEmailShell('Payment Request', `
    ${emailHeaderBand({ brandColor: '#2563EB', businessName: businessName || 'JobRunner', docLabel: 'Payment request' })}
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.6;">${businessName} has sent you a request for payment. You can pay securely online using the button below.</p>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <tr>
            <td style="padding: 24px 20px; text-align: center;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px; font-weight: 600;">Amount due</p>
              <p style="margin: 8px 0 0 0; color: #0f172a; font-size: 34px; font-weight: 700; line-height: 1.1;">$${amount.toFixed(2)} AUD</p>
              <p style="margin: 6px 0 0 0; color: #64748b; font-size: 12px;">Includes GST</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 20px 20px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #e2e8f0;">
                <tr><td style="padding-top: 16px;"><p style="margin: 0; color: #64748b; font-size: 14px;"><span style="color: #0f172a; font-weight: 600;">For:</span> ${description}</p></td></tr>
                ${reference ? `<tr><td style="padding-top: 8px;"><p style="margin: 0; color: #64748b; font-size: 14px;"><span style="color: #0f172a; font-weight: 600;">Reference:</span> ${reference}</p></td></tr>` : ''}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 0 32px;">
        ${emailCtaButton('Pay now securely', paymentUrl, '#2563EB')}
        <p style="margin: 14px 0 0 0; color: #94a3b8; font-size: 12px; text-align: center; line-height: 1.6;">Pay with your card &mdash; processed securely through Stripe. We never store your card details.</p>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 32px 32px;">
        <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.6;">This payment request was sent by ${businessName}.</p>
      </td>
    </tr>
    `)
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
    html: renderEmailShell('Welcome to JobRunner', `
    ${jobRunnerHeader()}
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <h1 style="margin: 0; color: #0f172a; font-size: 22px; font-weight: 700; line-height: 1.3;">G'day ${userName}, welcome aboard</h1>
        <p style="margin: 14px 0 0 0; color: #475569; font-size: 15px; line-height: 1.6;">Thanks for signing up to JobRunner. You've just taken the first step towards running a more organised, professional trade business. Here's a quick way to get going.</p>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
          ${[
            { n: '1', color: '#2563EB', title: 'Set up your business profile', body: 'Add your ABN, logo, and business details for professional quotes and invoices.' },
            { n: '2', color: '#2563EB', title: 'Add your first client', body: 'Store customer details and job history in one place.' },
            { n: '3', color: '#2563EB', title: 'Create a quote', body: 'Use our templates to send professional quotes with one click.' },
            { n: '4', color: '#2563EB', title: 'Convert quote to job', body: 'Once accepted, turn it into a trackable job with scheduling.' },
            { n: '5', color: '#16a34a', title: 'Invoice & get paid', body: 'Send invoices with Stripe payment links \u2014 get paid online instantly.' },
          ].map((s, i, arr) => `
          <tr>
            <td style="padding: 0 14px ${i === arr.length - 1 ? '0' : '18px'} 0; vertical-align: top; width: 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="width: 28px; height: 28px; background-color: ${s.color}; border-radius: 6px; text-align: center; color: #ffffff; font-size: 13px; font-weight: 700; line-height: 28px;">${s.n}</td></tr></table>
            </td>
            <td style="padding: 0 0 ${i === arr.length - 1 ? '0' : '18px'} 0; vertical-align: top;">
              <p style="margin: 0; color: #0f172a; font-size: 15px; font-weight: 700;">${s.title}</p>
              <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;">${s.body}</p>
            </td>
          </tr>`).join('')}
        </table>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <tr>
            <td style="padding: 16px 20px;">
              <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;"><span style="color: #F59E0B; font-weight: 700;">Tip:</span> Download our mobile app to manage your jobs on the go. Same account, synced data.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 0 32px;">
        ${emailCtaButton('Get started now', effectiveBaseUrl, '#2563EB')}
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 32px 32px;">
        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">Need help? Just reply to this email and we'll get back to you.</p>
        <p style="margin: 16px 0 0 0; color: #475569; font-size: 14px; line-height: 1.6;">Cheers,<br><strong style="color: #0f172a;">The JobRunner Team</strong></p>
      </td>
    </tr>
    `)
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
    html: renderEmailShell('Test Email', `
    ${jobRunnerHeader({ accentColor: '#16a34a' })}
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <h1 style="margin: 0; color: #0f172a; font-size: 22px; font-weight: 700; line-height: 1.3;">Your email is working</h1>
        <p style="margin: 14px 0 0 0; color: #475569; font-size: 15px; line-height: 1.6;">Hi ${businessName}, your JobRunner email integration is set up correctly. Your clients will now receive professional emails for:</p>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 20px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <tr>
            <td style="padding: 18px 22px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr><td style="padding: 4px 0; color: #475569; font-size: 14px; line-height: 1.6;">Quotes and estimates</td></tr>
                <tr><td style="padding: 4px 0; color: #475569; font-size: 14px; line-height: 1.6;">Invoices and payment links</td></tr>
                <tr><td style="padding: 4px 0; color: #475569; font-size: 14px; line-height: 1.6;">Payment confirmations</td></tr>
                <tr><td style="padding: 4px 0; color: #475569; font-size: 14px; line-height: 1.6;">Job updates and reminders</td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 32px 32px;">
        <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.6;">This is a test email from JobRunner. Replies to your business emails will go to your registered email address.</p>
      </td>
    </tr>
    `)
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

  const firstName = inviteeName ? inviteeName.trim().split(/\s+/)[0] : '';
  const greeting = firstName ? `G'day ${firstName},` : `G'day there,`;
  // Direct https Universal Link / App Link — opens the app on iOS/Android if
  // installed (verified via /.well-known/{apple-app-site-association,assetlinks.json}),
  // otherwise the web /accept-invite/:token page handles it.
  const acceptUrl = `${baseUrl}/accept-invite/${inviteToken}`;
  const smartAppLink = acceptUrl;
  const inviterInitials = (inviterName || 'JR').trim().split(/\s+/).map(w => w.charAt(0)).slice(0, 2).join('').toUpperCase() || 'JR';

  const emailData = {
    to: inviteeEmail,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: PLATFORM_FROM_NAME
    },
    replyTo: PLATFORM_REPLY_TO_EMAIL,
    subject: `You've been invited to join ${businessName} on JobRunner`,
    html: renderEmailShell('Team Invitation', `
    ${jobRunnerHeader({ baseUrl })}
    <tr>
      <td class="content" style="padding: 34px 32px 0 32px;">
        <p style="margin: 0 0 8px 0; color: #2563EB; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;">You're invited</p>
        <h1 style="margin: 0; color: #0f172a; font-size: 24px; font-weight: 800; line-height: 1.25; letter-spacing: -0.4px;">Join ${businessName}</h1>
        <p style="margin: 12px 0 0 0; color: #475569; font-size: 15px; line-height: 1.6;">${greeting} you've been invited to come on board.</p>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 22px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #edf1f7; border-radius: 12px;">
          <tr>
            <td style="padding: 16px 18px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="46" valign="middle" style="padding-right: 14px;">
                    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                      <td align="center" valign="middle" width="46" height="46" style="width: 46px; height: 46px; background-color: #2563EB; border-radius: 23px; color: #ffffff; font-size: 18px; font-weight: 700; text-align: center; font-family: ${EMAIL_SYSTEM_FONT};">${inviterInitials}</td>
                    </tr></table>
                  </td>
                  <td valign="middle">
                    <p style="margin: 0; color: #0f172a; font-size: 15px; font-weight: 700; line-height: 1.3;">${inviterName}</p>
                    <p style="margin: 3px 0 0 0; color: #64748b; font-size: 13px; line-height: 1.4;">Invited you to join as <strong style="color: #2563EB;">${roleName}</strong></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 26px 32px 0 32px;">
        ${emailCtaButton('Accept Invite', smartAppLink, '#2563EB')}
        <p style="margin: 14px 0 0 0; color: #94a3b8; font-size: 12px; text-align: center; line-height: 1.6;">Opens in the JobRunner app, or your browser if the app isn't installed &middot; Expires in 7 days</p>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 30px 32px 0 32px;">
        <p style="margin: 0 0 14px 0; color: #0f172a; font-size: 14px; font-weight: 700;">What you'll be able to do</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td width="34" valign="middle" style="padding: 6px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td align="center" valign="middle" width="22" height="22" style="width: 22px; height: 22px; background-color: #eaf1fe; border-radius: 11px; color: #2563EB; font-size: 12px; font-weight: 700; text-align: center;">&#10003;</td>
              </tr></table>
            </td>
            <td valign="middle" style="padding: 6px 0; color: #475569; font-size: 14px; line-height: 1.5;">View and manage your assigned jobs</td>
          </tr>
          <tr>
            <td width="34" valign="middle" style="padding: 6px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td align="center" valign="middle" width="22" height="22" style="width: 22px; height: 22px; background-color: #eaf1fe; border-radius: 11px; color: #2563EB; font-size: 12px; font-weight: 700; text-align: center;">&#10003;</td>
              </tr></table>
            </td>
            <td valign="middle" style="padding: 6px 0; color: #475569; font-size: 14px; line-height: 1.5;">Track your time on jobs</td>
          </tr>
          <tr>
            <td width="34" valign="middle" style="padding: 6px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td align="center" valign="middle" width="22" height="22" style="width: 22px; height: 22px; background-color: #eaf1fe; border-radius: 11px; color: #2563EB; font-size: 12px; font-weight: 700; text-align: center;">&#10003;</td>
              </tr></table>
            </td>
            <td valign="middle" style="padding: 6px 0; color: #475569; font-size: 14px; line-height: 1.5;">Communicate with the team</td>
          </tr>
          <tr>
            <td width="34" valign="middle" style="padding: 6px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td align="center" valign="middle" width="22" height="22" style="width: 22px; height: 22px; background-color: #eaf1fe; border-radius: 11px; color: #2563EB; font-size: 12px; font-weight: 700; text-align: center;">&#10003;</td>
              </tr></table>
            </td>
            <td valign="middle" style="padding: 6px 0; color: #475569; font-size: 14px; line-height: 1.5;">Access job details on your mobile</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 28px 32px 22px 32px;">
        <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.6;">Cheers,<br><strong style="color: #0f172a;">The JobRunner Team</strong></p>
        <p style="margin: 14px 0 0 0; color: #94a3b8; font-size: 12px; line-height: 1.6;">If you didn't expect this invitation, you can safely ignore this email.</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 32px;"><div style="border-top: 1px solid #edf1f7; font-size: 0; line-height: 0;">&nbsp;</div></td>
    </tr>
    <tr>
      <td style="padding: 16px 32px 26px 32px; text-align: center;">
        <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.6;"><strong style="color: #64748b;">JobRunner</strong> &mdash; Built for Australian tradies</p>
        <p style="margin: 7px 0 0 0; font-size: 11px; line-height: 1.6;"><a href="mailto:${PLATFORM_REPLY_TO_EMAIL}?subject=Unsubscribe" style="color: #94a3b8; text-decoration: underline;">Unsubscribe</a></p>
      </td>
    </tr>
    `)
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
  const logoUrl = `${baseUrl}/logo.png`;
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
    html: renderEmailShell('New Job Assignment', `
    ${jobRunnerHeader()}
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <h1 style="margin: 0; color: #0f172a; font-size: 22px; font-weight: 700; line-height: 1.3;">A new job has been assigned to you</h1>
        <p style="margin: 14px 0 0 0; color: #475569; font-size: 15px; line-height: 1.6;">Hey ${displayName}, <strong style="color: #0f172a;">${assignerName}</strong> has assigned you a new job. Here are the details.</p>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <tr>
            <td style="padding: 18px 22px;">
              <p style="margin: 0; color: #0f172a; font-size: 16px; font-weight: 700;">${jobTitle}</p>
              ${jobAddress ? `<p style="margin: 10px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;"><span style="color: #94a3b8;">Address:</span> ${jobAddress}</p>` : ''}
              <p style="margin: ${jobAddress ? '6px' : '10px'} 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;"><span style="color: #94a3b8;">Scheduled:</span> ${formattedDate}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 0 32px;">
        ${emailCtaButton('View job details', jobUrl, '#F59E0B')}
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 32px 32px;">
        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">Open JobRunner to see the full job details and get started.</p>
      </td>
    </tr>
    `)
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
  const logoUrl = `${baseUrl}/logo.png`;
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
    html: renderEmailShell('Job Completed', `
    ${jobRunnerHeader({ accentColor: '#16a34a' })}
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <h1 style="margin: 0; color: #0f172a; font-size: 22px; font-weight: 700; line-height: 1.3;">A job has been marked complete</h1>
        <p style="margin: 14px 0 0 0; color: #475569; font-size: 15px; line-height: 1.6;">Hey ${displayName}, <strong style="color: #0f172a;">${staffName}</strong> has just marked a job as complete.</p>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <tr>
            <td style="padding: 18px 22px;">
              <p style="margin: 0; color: #0f172a; font-size: 16px; font-weight: 700;">${jobTitle}</p>
              ${clientName ? `<p style="margin: 10px 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;"><span style="color: #94a3b8;">Client:</span> ${clientName}</p>` : ''}
              <p style="margin: ${clientName ? '6px' : '10px'} 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;"><span style="color: #94a3b8;">Completed:</span> ${formattedDate}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 0 32px;">
        <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">The job includes photos, signatures, and time tracking data. Review the details and create an invoice.</p>
      </td>
    </tr>
    <tr>
      <td class="content" style="padding: 24px 32px 32px 32px;">
        ${emailCtaButton('View job & create invoice', jobUrl, '#2563EB')}
      </td>
    </tr>
    `)
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
  to: string | string[]; // SendGrid accepts multiple recipients natively
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
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
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
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px;">${job.title}</td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">${job.client}</td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #0f172a; font-size: 14px; font-weight: 600;">${formatCurrency(job.value)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="3" style="padding: 20px; text-align: center; color: #94a3b8; font-size: 14px;">No jobs completed today</td></tr>';

  const paymentsHtml = data.payments.paymentsList.length > 0
    ? data.payments.paymentsList.map(payment => `
      <tr>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px;">${payment.client}</td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">${payment.invoice}</td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #16a34a; font-size: 14px; font-weight: 600;">${formatCurrency(payment.amount)}</td>
      </tr>
    `).join('')
    : '';

  const actionItemsHtml = data.actionItems.length > 0
    ? data.actionItems.map(item => {
        const priorityColor = item.priority === 'high' ? '#dc2626' : item.priority === 'medium' ? '#F59E0B' : '#64748b';
        const priorityLabel = item.priority === 'high' ? 'High priority' : item.priority === 'medium' ? 'Medium priority' : 'Low priority';
        return `
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 10px;">
            <tr>
              <td style="padding: 14px 16px;">
                <p style="margin: 0; color: ${priorityColor}; font-weight: 700; font-size: 12px;">${priorityLabel}</p>
                <p style="margin: 6px 0 0 0; color: #475569; font-size: 14px; line-height: 1.6;">${item.message}</p>
              </td>
            </tr>
          </table>
        `;
      }).join('')
    : '<p style="margin: 0; color: #94a3b8; font-size: 14px; text-align: center; padding: 16px;">No action items \u2014 nice work.</p>';

  const sectionHeading = (label: string) => `
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <h2 style="margin: 0 0 14px 0; color: #0f172a; font-size: 17px; font-weight: 700; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0;">${label}</h2>
      </td>
    </tr>`;

  const innerRows = `
    ${jobRunnerHeader()}
    <tr>
      <td class="content" style="padding: 32px 32px 0 32px;">
        <p style="margin: 0 0 8px 0; color: #2563EB; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;">Daily summary &middot; ${data.dateFormatted}</p>
        <h1 style="margin: 0; color: #0f172a; font-size: 24px; font-weight: 800; line-height: 1.25; letter-spacing: -0.4px;">${data.business.name}</h1>
      </td>
    </tr>
    ${!hasActivity ? `
    <tr>
      <td class="content" style="padding: 32px 32px;">
        <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.6; text-align: center;">Quiet day today &mdash; no activity to report.</p>
      </td>
    </tr>
    ` : `
    <tr>
      <td class="content" style="padding: 28px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td width="33%" style="padding: 0 6px 0 0; vertical-align: top;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f0fdf4; border: 1px solid #dcfce7; border-radius: 8px;">
                <tr><td style="padding: 16px 12px; text-align: center;">
                  <p style="margin: 0; color: #16a34a; font-size: 22px; font-weight: 700;">${formatCurrency(data.payments.totalAmount)}</p>
                  <p style="margin: 4px 0 0 0; color: #15803d; font-size: 12px;">Payments received</p>
                </td></tr>
              </table>
            </td>
            <td width="33%" style="padding: 0 6px; vertical-align: top;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px;">
                <tr><td style="padding: 16px 12px; text-align: center;">
                  <p style="margin: 0; color: #2563EB; font-size: 22px; font-weight: 700;">${data.jobs.completed}</p>
                  <p style="margin: 4px 0 0 0; color: #2563EB; font-size: 12px;">Jobs completed</p>
                </td></tr>
              </table>
            </td>
            <td width="33%" style="padding: 0 0 0 6px; vertical-align: top;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <tr><td style="padding: 16px 12px; text-align: center;">
                  <p style="margin: 0; color: #0f172a; font-size: 22px; font-weight: 700;">${data.quotes.conversionRate}%</p>
                  <p style="margin: 4px 0 0 0; color: #64748b; font-size: 12px;">Quote conversion</p>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    ${sectionHeading('Jobs')}
    <tr>
      <td class="content" style="padding: 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="color: #64748b; font-size: 14px; line-height: 1.8;"><span style="color: #0f172a; font-weight: 700;">${data.jobs.completed}</span> completed &nbsp;&bull;&nbsp; <span style="color: #0f172a; font-weight: 700;">${data.jobs.inProgress}</span> in progress &nbsp;&bull;&nbsp; <span style="color: #0f172a; font-weight: 700;">${data.jobs.scheduled}</span> scheduled</td>
          </tr>
        </table>
        ${data.jobs.completedList.length > 0 ? `
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 14px; border: 1px solid #e2e8f0; border-radius: 8px; border-collapse: separate; overflow: hidden;">
          <tr style="background-color: #f8fafc;">
            <td style="padding: 10px 14px; text-align: left; font-weight: 700; color: #475569; font-size: 12px;">Job</td>
            <td style="padding: 10px 14px; text-align: left; font-weight: 700; color: #475569; font-size: 12px;">Client</td>
            <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: #475569; font-size: 12px;">Value</td>
          </tr>
          ${completedJobsHtml}
        </table>
        ` : ''}
      </td>
    </tr>

    ${sectionHeading('Quotes')}
    <tr>
      <td class="content" style="padding: 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr><td style="color: #64748b; font-size: 14px; line-height: 1.8;"><span style="color: #0f172a; font-weight: 700;">${data.quotes.sent}</span> sent (${formatCurrency(data.quotes.sentTotal)}) &nbsp;&bull;&nbsp; <span style="color: #16a34a; font-weight: 700;">${data.quotes.accepted}</span> accepted (${formatCurrency(data.quotes.acceptedTotal)})</td></tr>
          <tr><td style="color: #64748b; font-size: 14px; line-height: 1.8;"><span style="color: #dc2626; font-weight: 700;">${data.quotes.rejected}</span> rejected &nbsp;&bull;&nbsp; <span style="color: #F59E0B; font-weight: 700;">${data.quotes.pending}</span> pending</td></tr>
        </table>
      </td>
    </tr>

    ${sectionHeading('Invoices')}
    <tr>
      <td class="content" style="padding: 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr><td style="color: #64748b; font-size: 14px; line-height: 1.8;"><span style="color: #0f172a; font-weight: 700;">${data.invoices.sent}</span> sent (${formatCurrency(data.invoices.sentTotal)}) &nbsp;&bull;&nbsp; <span style="color: #16a34a; font-weight: 700;">${data.invoices.paid}</span> paid (${formatCurrency(data.invoices.paidTotal)})</td></tr>
          ${data.invoices.overdue > 0 ? `<tr><td style="color: #64748b; font-size: 14px; line-height: 1.8;"><span style="color: #dc2626; font-weight: 700;">${data.invoices.overdue}</span> overdue (${formatCurrency(data.invoices.overdueTotal)})</td></tr>` : ''}
        </table>
      </td>
    </tr>

    ${data.payments.paymentsList.length > 0 ? `
    ${sectionHeading('Payments received')}
    <tr>
      <td class="content" style="padding: 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 8px; border-collapse: separate; overflow: hidden;">
          <tr style="background-color: #f8fafc;">
            <td style="padding: 10px 14px; text-align: left; font-weight: 700; color: #475569; font-size: 12px;">Client</td>
            <td style="padding: 10px 14px; text-align: left; font-weight: 700; color: #475569; font-size: 12px;">Invoice</td>
            <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: #475569; font-size: 12px;">Amount</td>
          </tr>
          ${paymentsHtml}
          <tr style="background-color: #f8fafc;">
            <td colspan="2" style="padding: 12px 14px; font-weight: 700; color: #0f172a; font-size: 14px;">Total received</td>
            <td style="padding: 12px 14px; text-align: right; font-weight: 700; color: #16a34a; font-size: 15px;">${formatCurrency(data.payments.totalAmount)}</td>
          </tr>
        </table>
      </td>
    </tr>
    ` : ''}

    ${data.actionItems.length > 0 ? `
    ${sectionHeading('Action items')}
    <tr>
      <td class="content" style="padding: 0 32px;">
        ${actionItemsHtml}
      </td>
    </tr>
    ` : ''}
    `}

    <tr>
      <td class="content" style="padding: 28px 32px 32px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #e2e8f0;">
          <tr>
            <td width="50%" style="padding: 18px 0 0 0; vertical-align: top;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">Total revenue today</p>
              <p style="margin: 4px 0 0 0; color: #0f172a; font-size: 18px; font-weight: 700;">${formatCurrency(data.metrics.totalRevenue)}</p>
            </td>
            <td width="50%" style="padding: 18px 0 0 0; vertical-align: top; text-align: right;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">Outstanding invoices</p>
              <p style="margin: 4px 0 0 0; color: #F59E0B; font-size: 18px; font-weight: 700;">${formatCurrency(data.metrics.outstandingInvoices)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  return {
    to: data.business.email,
    from: {
      email: PLATFORM_FROM_EMAIL,
      name: 'JobRunner Daily Summary'
    },
    subject: `Daily Summary for ${data.dateFormatted} - ${data.business.name}`,
    html: renderEmailShell(`Daily Summary - ${data.dateFormatted}`, innerRows, 'This is your automated daily summary from JobRunner. You can manage your summary preferences in Settings \u2192 Automations.')
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

// ── Progress Claim Submitted — client portal notification ─────────────────────

/**
 * Notify the client that a progress claim has been submitted and is ready to
 * review in the client portal.  Only called when the portal is active for the
 * job AND showFinancialsOnPortal is true.
 */
export async function sendProgressClaimSubmittedEmail(opts: {
  clientEmail: string;
  clientName: string | null;
  businessName: string | null;
  claimNumber: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  totalAmount: number;
  portalUrl: string;
  jobTitle: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const {
    clientEmail,
    clientName,
    businessName,
    claimNumber,
    periodStart,
    periodEnd,
    totalAmount,
    portalUrl,
    jobTitle,
  } = opts;

  const displayName = esc(clientName ? clientName.split(' ')[0] : 'there');
  const bizName = esc(businessName || 'Your contractor');
  const claimRef = claimNumber ? `#${esc(claimNumber)}` : '';
  const safeJobTitle = esc(jobTitle || '');

  const formatD = (ds: string | null): string => {
    if (!ds) return '';
    const d = new Date(ds);
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const periodStr =
    periodStart && periodEnd
      ? `${formatD(periodStart)} – ${formatD(periodEnd)}`
      : periodStart
      ? `From ${formatD(periodStart)}`
      : '';

  const formattedTotal = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(totalAmount);

  const emailData = {
    to: clientEmail,
    from: { email: PLATFORM_FROM_EMAIL, name: PLATFORM_FROM_NAME },
    replyTo: PLATFORM_REPLY_TO_EMAIL,
    subject: `Progress Claim ${claimRef} ready for review${safeJobTitle ? ` — ${safeJobTitle}` : ''}`,
    html: renderEmailShell(
      `Progress Claim ${claimRef}`,
      `
      ${jobRunnerHeader({ accentColor: '#2563EB' })}
      <tr>
        <td class="content" style="padding: 28px 32px 0 32px;">
          <h1 style="margin: 0; color: #0f172a; font-size: 22px; font-weight: 700; line-height: 1.3;">Progress Claim ${claimRef} submitted</h1>
          <p style="margin: 14px 0 0 0; color: #475569; font-size: 15px; line-height: 1.6;">Hi ${displayName}, <strong style="color: #0f172a;">${bizName}</strong> has submitted a progress claim for your review.</p>
        </td>
      </tr>
      <tr>
        <td class="content" style="padding: 24px 32px 0 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
            <tr>
              <td style="padding: 18px 22px;">
                ${safeJobTitle ? `<p style="margin: 0; color: #0f172a; font-size: 16px; font-weight: 700;">${safeJobTitle}</p>` : ''}
                ${periodStr ? `<p style="margin: ${safeJobTitle ? '10px' : '0'} 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;"><span style="color: #94a3b8;">Period:</span> ${periodStr}</p>` : ''}
                <p style="margin: ${periodStr || safeJobTitle ? '6px' : '0'} 0 0 0; color: #64748b; font-size: 14px; line-height: 1.6;"><span style="color: #94a3b8;">Amount claimed:</span> <strong style="color: #0f172a;">${formattedTotal}</strong></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="content" style="padding: 24px 32px 0 32px;">
          <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.6;">You can review the full schedule of values and claim details in your client portal.</p>
        </td>
      </tr>
      <tr>
        <td class="content" style="padding: 24px 32px 32px 32px;">
          ${emailCtaButton('View claim in portal', portalUrl, '#2563EB')}
        </td>
      </tr>
      `,
      'This is a transactional notification regarding your project progress claim.',
    ),
    _meta: { type: 'progress_claim_submitted' },
  };

  try {
    await sendSystemEmail(emailData);
    console.log(`✅ Progress claim submitted email sent to: ${clientEmail}`);
    return { success: true };
  } catch (error: unknown) {
    console.error('❌ Failed to send progress claim submitted email:', error);
    return { success: false, error: getErrorMessage(error) || 'Failed to send email' };
  }
}
