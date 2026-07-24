/**
 * Production Email Templates for JobRunner
 * Professional, responsive HTML email templates for all business communications
 */

import { getProductionBaseUrl } from './urlHelper';

// Brand colors
const BRAND_BLUE = '#2563EB';
const SUCCESS_GREEN = '#2563EB';
const WARNING_ORANGE = '#F59E0B';
const ERROR_RED = '#dc2626';
const NEUTRAL_GRAY = '#64748b';

// Base email wrapper with responsive design
const baseEmailWrapper = (content: string, brandColor: string = BRAND_BLUE) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>JobRunner</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    /* Force light rendering — dark-mode email clients must not invert colors */
    :root { color-scheme: light; supported-color-schemes: light; }
    /* Reset styles */
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    
    /* Base styles */
    body { margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; }
    
    /* Responsive styles */
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; padding: 0 !important; }
      .content { padding: 24px !important; }
      .header { padding: 28px 24px 0 24px !important; }
      .line-items td { padding: 8px 4px !important; font-size: 13px !important; }
      .cta-button { padding: 14px 24px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table class="container" role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0;">
          ${content}
        </table>
        <!-- Footer with Unsubscribe -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; margin-top: 20px;">
          <tr>
            <td align="center" style="padding: 8px 24px; color: #94a3b8; font-size: 12px; line-height: 1.6;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">Sent with <strong style="color: #475569;">JobRunner</strong> &mdash; built for Australian tradies</p>
              <p style="margin: 14px 0 0 0; padding-top: 14px; border-top: 1px solid #e2e8f0; color: #94a3b8;">
                This email was sent by JobRunner on behalf of the business above.<br>
                <a href="<%asm_group_unsubscribe_url%>" style="color: #94a3b8; text-decoration: underline;">Unsubscribe</a>
                &nbsp;&middot;&nbsp;
                <a href="<%asm_preferences_url%>" style="color: #94a3b8; text-decoration: underline;">Manage email preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// Header component - always shows logo with white container for consistency
// Uses absolute JobRunner logo URL as fallback for email client compatibility
const emailHeader = (
  businessName: string, 
  documentType: string, 
  documentNumber: string,
  brandColor: string,
  logoUrl?: string,
  abn?: string
) => {
  // Compute absolute fallback URL for JobRunner logo (relative URLs don't work in email clients)
  const baseUrl = getProductionBaseUrl();
  const defaultLogoUrl = `${baseUrl}/logo.png`;
  const resolvedLogoUrl = logoUrl || defaultLogoUrl;
  
  return `
<tr>
  <td style="height: 4px; line-height: 4px; font-size: 0; background-color: ${brandColor};">&nbsp;</td>
</tr>
<tr>
  <td class="header" style="padding: 32px 32px 0 32px;">
    <img src="${resolvedLogoUrl}" alt="${businessName || 'JobRunner'}" style="max-height: 44px; max-width: 180px; display: block; margin-bottom: 16px;" />
    <p style="margin: 0; color: #0f172a; font-size: 19px; font-weight: 700; line-height: 1.3;">${businessName}</p>
    ${abn ? `<p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px;">ABN ${abn}</p>` : ''}
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 24px; border-top: 1px solid #e2e8f0;">
      <tr>
        <td style="padding-top: 18px; vertical-align: bottom;">
          <span style="color: ${brandColor}; font-size: 17px; font-weight: 700;">${documentType}</span>
        </td>
        <td style="padding-top: 18px; text-align: right; vertical-align: bottom;">
          <span style="color: #64748b; font-size: 14px;">No. ${documentNumber}</span>
        </td>
      </tr>
    </table>
  </td>
</tr>
`;
};

// Client info component
const clientInfoSection = (
  clientName: string,
  clientEmail?: string,
  clientAddress?: string,
  clientPhone?: string
) => `
<tr>
  <td style="padding: 24px 32px 0 32px;">
    <p style="margin: 0; color: #94a3b8; font-size: 11px; letter-spacing: 0.8px; text-transform: uppercase; font-weight: 600;">Billed to</p>
    <p style="margin: 6px 0 0 0; color: #0f172a; font-size: 16px; font-weight: 600;">${clientName}</p>
    ${clientEmail ? `<p style="margin: 3px 0 0 0; color: #64748b; font-size: 14px;">${clientEmail}</p>` : ''}
    ${clientAddress ? `<p style="margin: 3px 0 0 0; color: #64748b; font-size: 14px;">${clientAddress}</p>` : ''}
    ${clientPhone ? `<p style="margin: 3px 0 0 0; color: #64748b; font-size: 14px;">${clientPhone}</p>` : ''}
  </td>
</tr>
`;

// Greeting section
const greetingSection = (clientFirstName: string, message: string) => `
<tr>
  <td class="content" style="padding: 24px 32px 8px 32px;">
    <p style="margin: 0 0 14px 0; color: #0f172a; font-size: 16px; font-weight: 600;">Hi ${clientFirstName},</p>
    <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.65;">${message}</p>
  </td>
</tr>
`;

// Line items table
const lineItemsTable = (
  items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>,
  subtotal: number,
  gstAmount: number,
  total: number,
  brandColor: string,
  showGst: boolean = true
) => `
<tr>
  <td style="padding: 24px 32px 8px 32px;">
    <table class="line-items" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
      <tr>
        <td style="padding: 0 12px 10px 0; color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; border-bottom: 1px solid #e2e8f0;">Description</td>
        <td style="padding: 0 12px 10px 12px; color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; text-align: center; border-bottom: 1px solid #e2e8f0;">Qty</td>
        <td style="padding: 0 12px 10px 12px; color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; text-align: right; border-bottom: 1px solid #e2e8f0;">Price</td>
        <td style="padding: 0 0 10px 12px; color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; text-align: right; border-bottom: 1px solid #e2e8f0;">Total</td>
      </tr>
      ${items.map(item => `
      <tr>
        <td style="padding: 14px 12px 14px 0; color: #1e293b; font-size: 14px; border-bottom: 1px solid #f1f5f9;">${item.description}</td>
        <td style="padding: 14px 12px; color: #64748b; font-size: 14px; text-align: center; border-bottom: 1px solid #f1f5f9;">${Number(item.quantity).toFixed(2)}</td>
        <td style="padding: 14px 12px; color: #64748b; font-size: 14px; text-align: right; border-bottom: 1px solid #f1f5f9;">$${Number(item.unitPrice).toFixed(2)}</td>
        <td style="padding: 14px 0 14px 12px; color: #1e293b; font-size: 14px; font-weight: 600; text-align: right; border-bottom: 1px solid #f1f5f9;">$${Number(item.total).toFixed(2)}</td>
      </tr>
      `).join('')}
      <tr>
        <td colspan="3" style="padding: 14px 12px 6px 0; color: #64748b; font-size: 14px; text-align: right;">Subtotal</td>
        <td style="padding: 14px 0 6px 12px; color: #1e293b; font-size: 14px; text-align: right;">$${subtotal.toFixed(2)}</td>
      </tr>
      ${showGst && gstAmount > 0 ? `
      <tr>
        <td colspan="3" style="padding: 4px 12px 4px 0; color: #64748b; font-size: 14px; text-align: right;">GST (10%)</td>
        <td style="padding: 4px 0 4px 12px; color: #1e293b; font-size: 14px; text-align: right;">$${gstAmount.toFixed(2)}</td>
      </tr>
      ` : ''}
      <tr>
        <td colspan="3" style="padding: 14px 12px 0 0; color: #0f172a; font-size: 15px; font-weight: 700; text-align: right; border-top: 2px solid ${brandColor};">Total (AUD)</td>
        <td style="padding: 14px 0 0 12px; color: ${brandColor}; font-size: 20px; font-weight: 700; text-align: right; border-top: 2px solid ${brandColor};">$${total.toFixed(2)}</td>
      </tr>
    </table>
  </td>
</tr>
`;

// CTA Button — one consistent primary button style used across all emails
const ctaButton = (text: string, url: string, brandColor: string) => `
<tr>
  <td style="padding: 24px 32px 8px 32px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <a href="${url}" class="cta-button" style="display: inline-block; background-color: ${brandColor}; color: #ffffff; text-decoration: none; padding: 15px 36px; border-radius: 8px; font-size: 16px; font-weight: 600; line-height: 1;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  </td>
</tr>
`;

// Status badge
const statusBadge = (status: string, color: string) => `
<span style="display: inline-block; background-color: ${color}20; color: ${color}; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; letter-spacing: 0.3px;">
  ${status}
</span>
`;

// Due date section
const dueDateSection = (dueDate: string, isOverdue: boolean = false) => `
<tr>
  <td style="padding: 24px 32px 0 32px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${isOverdue ? '#fef2f2' : '#eff6ff'}; border: 1px solid ${isOverdue ? '#fecaca' : '#bfdbfe'}; border-radius: 8px;">
      <tr>
        <td style="padding: 16px 20px;">
          <p style="margin: 0; color: ${isOverdue ? ERROR_RED : NEUTRAL_GRAY}; font-size: 11px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase;">
            ${isOverdue ? 'Payment overdue' : 'Payment due'}
          </p>
          <p style="margin: 6px 0 0 0; color: #0f172a; font-size: 18px; font-weight: 700;">${dueDate}</p>
        </td>
      </tr>
    </table>
  </td>
</tr>
`;

// Business contact footer
const businessFooter = (
  businessName: string,
  email?: string,
  phone?: string,
  address?: string,
  abn?: string
) => `
<tr>
  <td style="padding: 32px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #e2e8f0;">
      <tr>
        <td style="padding-top: 24px;">
          <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.6;">Questions about this? Just reply to this email or get in touch&nbsp;&mdash; happy to help.</p>
          <p style="margin: 16px 0 0 0; color: #0f172a; font-size: 15px; font-weight: 600;">${businessName}</p>
          ${email ? `<p style="margin: 4px 0 0 0;"><a href="mailto:${email}" style="color: #2563EB; text-decoration: none; font-size: 14px;">${email}</a></p>` : ''}
          ${phone ? `<p style="margin: 4px 0 0 0;"><a href="tel:${phone}" style="color: #2563EB; text-decoration: none; font-size: 14px;">${phone}</a></p>` : ''}
          ${address ? `<p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">${address}</p>` : ''}
          ${abn ? `<p style="margin: 10px 0 0 0; color: #94a3b8; font-size: 12px;">ABN ${abn}</p>` : ''}
        </td>
      </tr>
    </table>
  </td>
</tr>
`;

// Utility function to darken/lighten colors
function adjustColor(color: string, percent: number): string {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1);
}

// Format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount);
};

// Format date
const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

// ============ EXPORT EMAIL TEMPLATE GENERATORS ============

export interface EmailTemplateData {
  businessName: string;
  businessEmail?: string;
  businessPhone?: string;
  businessAddress?: string;
  businessAbn?: string;
  businessLogo?: string;
  brandColor?: string;
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  clientPhone?: string;
}

export interface QuoteEmailData extends EmailTemplateData {
  quoteNumber: string;
  quoteTitle: string;
  quoteDescription?: string;
  validUntil?: string;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  subtotal: number;
  gstAmount: number;
  total: number;
  acceptanceUrl?: string;
}

export interface InvoiceEmailData extends EmailTemplateData {
  invoiceNumber: string;
  invoiceTitle: string;
  invoiceDescription?: string;
  dueDate?: string;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  subtotal: number;
  gstAmount: number;
  total: number;
  paymentUrl?: string;
  isOverdue?: boolean;
}

export interface ReceiptEmailData extends EmailTemplateData {
  invoiceNumber: string;
  invoiceTitle: string;
  paidDate: string;
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  subtotal: number;
  gstAmount: number;
  total: number;
}

export interface ReminderEmailData extends EmailTemplateData {
  invoiceNumber: string;
  invoiceTitle: string;
  dueDate: string;
  daysPastDue: number;
  total: number;
  paymentUrl?: string;
  tone: 'friendly' | 'professional' | 'firm';
}

// Generate Quote Email
export function generateQuoteEmailTemplate(data: QuoteEmailData): { subject: string; html: string } {
  const brandColor = data.brandColor || BRAND_BLUE;
  const clientFirstName = data.clientName.split(' ')[0];
  
  const content = `
    ${emailHeader(data.businessName, 'Quote', data.quoteNumber, brandColor, data.businessLogo, data.businessAbn)}
    ${greetingSection(clientFirstName, `Thanks for getting in touch! Here's your quote for <strong>${data.quoteTitle}</strong>. We'd love to work with you on this project.`)}
    ${data.quoteDescription ? `
    <tr>
      <td style="padding: 0 32px 24px 32px;">
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 16px;">
          <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Project Description</p>
          <p style="margin: 8px 0 0 0; color: #1e293b; font-size: 14px; line-height: 1.6;">${data.quoteDescription}</p>
        </div>
      </td>
    </tr>
    ` : ''}
    ${lineItemsTable(data.lineItems, data.subtotal, data.gstAmount, data.total, brandColor, data.gstAmount > 0)}
    ${data.validUntil ? `
    <tr>
      <td style="padding: 0 32px 24px 32px; text-align: center;">
        <p style="margin: 0; color: #64748b; font-size: 14px;">This quote is valid until <strong>${data.validUntil}</strong></p>
      </td>
    </tr>
    ` : ''}
    ${data.acceptanceUrl ? ctaButton('View & Accept Quote', data.acceptanceUrl, brandColor) : ''}
    ${businessFooter(data.businessName, data.businessEmail, data.businessPhone, data.businessAddress, data.businessAbn)}
  `;
  
  return {
    subject: `Quote #${data.quoteNumber} from ${data.businessName} - ${data.quoteTitle}`,
    html: baseEmailWrapper(content, brandColor)
  };
}

// Generate Invoice Email
export function generateInvoiceEmailTemplate(data: InvoiceEmailData): { subject: string; html: string } {
  const brandColor = data.brandColor || SUCCESS_GREEN;
  const clientFirstName = data.clientName.split(' ')[0];
  const documentType = data.gstAmount > 0 ? 'Tax Invoice' : 'Invoice';
  
  const content = `
    ${emailHeader(data.businessName, documentType, data.invoiceNumber, brandColor, data.businessLogo, data.businessAbn)}
    ${greetingSection(clientFirstName, `Thank you for your business! Please find your invoice for <strong>${data.invoiceTitle}</strong> below.`)}
    ${data.dueDate ? dueDateSection(formatDate(data.dueDate), data.isOverdue) : ''}
    ${lineItemsTable(data.lineItems, data.subtotal, data.gstAmount, data.total, brandColor, data.gstAmount > 0)}
    ${data.paymentUrl ? ctaButton('Pay Now', data.paymentUrl, brandColor) : ''}
    ${businessFooter(data.businessName, data.businessEmail, data.businessPhone, data.businessAddress, data.businessAbn)}
  `;
  
  const duePart = data.dueDate ? ` - Due ${formatDate(data.dueDate)}` : '';
  
  return {
    subject: `${documentType} #${data.invoiceNumber} from ${data.businessName}${duePart}`,
    html: baseEmailWrapper(content, brandColor)
  };
}

// Generate Receipt Email
export function generateReceiptEmailTemplate(data: ReceiptEmailData): { subject: string; html: string } {
  const brandColor = SUCCESS_GREEN;
  const clientFirstName = data.clientName.split(' ')[0];
  // Logo is provided via data.businessLogo (business logo or JobRunner fallback)
  const logoUrl = data.businessLogo;
  
  const content = `
    <tr>
      <td style="height: 4px; line-height: 4px; font-size: 0; background-color: ${brandColor};">&nbsp;</td>
    </tr>
    <tr>
      <td class="header" style="padding: 32px 32px 0 32px;">
        ${logoUrl ? `<img src="${logoUrl}" alt="${data.businessName}" style="max-height: 44px; max-width: 180px; display: block; margin-bottom: 16px;" />` : ''}
        <p style="margin: 0; color: #0f172a; font-size: 19px; font-weight: 700; line-height: 1.3;">${data.businessName}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 24px; border-top: 1px solid #e2e8f0;">
          <tr>
            <td style="padding-top: 18px; vertical-align: bottom;">
              <span style="color: ${brandColor}; font-size: 17px; font-weight: 700;">Receipt</span>
            </td>
            <td style="padding-top: 18px; text-align: right; vertical-align: bottom;">
              <span style="color: #64748b; font-size: 14px;">No. ${data.invoiceNumber}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${greetingSection(clientFirstName, `Thanks &mdash; we've received your payment for <strong>${data.invoiceTitle}</strong>. Here's your receipt for your records.`)}
    <tr>
      <td style="padding: 24px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
          <tr>
            <td style="padding: 16px 20px;">
              <p style="margin: 0; color: ${NEUTRAL_GRAY}; font-size: 11px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase;">Payment date</p>
              <p style="margin: 6px 0 0 0; color: #0f172a; font-size: 18px; font-weight: 700;">${data.paidDate}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${lineItemsTable(data.lineItems, data.subtotal, data.gstAmount, data.total, brandColor, data.gstAmount > 0)}
    ${businessFooter(data.businessName, data.businessEmail, data.businessPhone, data.businessAddress, data.businessAbn)}
  `;
  
  return {
    subject: `Payment Receipt - ${data.invoiceTitle} from ${data.businessName}`,
    html: baseEmailWrapper(content, brandColor)
  };
}

// Generate Reminder Email
export function generateReminderEmailTemplate(data: ReminderEmailData): { subject: string; html: string } {
  const clientFirstName = data.clientName.split(' ')[0];
  
  // Different content based on tone and days past due
  const toneContent = {
    friendly: {
      color: BRAND_BLUE,
      heading: data.daysPastDue <= 7 ? 'Friendly Reminder' : data.daysPastDue <= 14 ? 'Payment Reminder' : 'Quick Reminder',
      message: data.daysPastDue <= 7 
        ? `Just a friendly reminder that your invoice is now ${data.daysPastDue} days past due. If you've already sent payment, thank you and please disregard this message!`
        : data.daysPastDue <= 14
        ? `We wanted to let you know that your invoice is now ${data.daysPastDue} days overdue. We'd really appreciate it if you could arrange payment at your earliest convenience.`
        : `Your invoice is now ${data.daysPastDue} days overdue. If there are any issues or you'd like to discuss payment options, please don't hesitate to reach out.`,
      cta: 'Pay Now',
    },
    professional: {
      color: NEUTRAL_GRAY,
      heading: data.daysPastDue <= 7 ? 'Payment Notice' : data.daysPastDue <= 14 ? 'Second Notice' : 'Final Notice',
      message: data.daysPastDue <= 7 
        ? `Please be advised that Invoice #${data.invoiceNumber} is now ${data.daysPastDue} days past due. We kindly request payment at your earliest convenience.`
        : data.daysPastDue <= 14
        ? `This is a second notice regarding Invoice #${data.invoiceNumber}, which is now ${data.daysPastDue} days past due. Immediate attention to this matter would be appreciated.`
        : `This is a final notice regarding Invoice #${data.invoiceNumber}, which is now ${data.daysPastDue} days past due. Please arrange payment immediately to avoid further action.`,
      cta: 'Make Payment',
    },
    firm: {
      color: ERROR_RED,
      heading: data.daysPastDue <= 7 ? 'Overdue Notice' : data.daysPastDue <= 14 ? 'Second Overdue Notice' : 'Final Demand',
      message: data.daysPastDue <= 7 
        ? `Invoice #${data.invoiceNumber} is now ${data.daysPastDue} days overdue. Payment is required within 7 days.`
        : data.daysPastDue <= 14
        ? `Invoice #${data.invoiceNumber} is now ${data.daysPastDue} days overdue. Immediate payment is required. Failure to pay may result in late fees or suspension of services.`
        : `FINAL DEMAND: Invoice #${data.invoiceNumber} is ${data.daysPastDue} days overdue. Unless payment is received within 7 days, this matter will be escalated for collection.`,
      cta: 'Pay Immediately',
    },
  };
  
  const tone = toneContent[data.tone];
  
  const content = `
    <tr>
      <td style="height: 4px; line-height: 4px; font-size: 0; background-color: ${tone.color};">&nbsp;</td>
    </tr>
    <tr>
      <td class="header" style="padding: 32px 32px 0 32px;">
        <p style="margin: 0; color: #0f172a; font-size: 19px; font-weight: 700; line-height: 1.3;">${data.businessName}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 24px; border-top: 1px solid #e2e8f0;">
          <tr>
            <td style="padding-top: 18px; vertical-align: bottom;">
              <span style="color: ${tone.color}; font-size: 17px; font-weight: 700;">${tone.heading}</span>
            </td>
            <td style="padding-top: 18px; text-align: right; vertical-align: bottom;">
              <span style="color: #64748b; font-size: 14px;">Invoice #${data.invoiceNumber}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${greetingSection(clientFirstName, tone.message)}
    <tr>
      <td style="padding: 24px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <tr>
            <td style="padding: 20px; width: 50%; border-right: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600;">Amount due</p>
              <p style="margin: 8px 0 0 0; color: ${tone.color}; font-size: 26px; font-weight: 700;">${formatCurrency(data.total)}</p>
            </td>
            <td style="padding: 20px; width: 50%;">
              <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600;">Due date</p>
              <p style="margin: 8px 0 0 0; color: #0f172a; font-size: 17px; font-weight: 600;">${formatDate(data.dueDate)}</p>
              <p style="margin: 4px 0 0 0; color: ${ERROR_RED}; font-size: 13px; font-weight: 500;">${data.daysPastDue} days overdue</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${data.paymentUrl ? ctaButton(tone.cta, data.paymentUrl, tone.color) : ''}
    ${businessFooter(data.businessName, data.businessEmail, data.businessPhone, data.businessAddress, data.businessAbn)}
  `;
  
  const urgencyPrefix = data.daysPastDue >= 30 ? 'URGENT: ' : data.daysPastDue >= 14 ? 'Reminder: ' : '';
  
  return {
    subject: `${urgencyPrefix}Invoice #${data.invoiceNumber} - ${data.daysPastDue} Days Overdue`,
    html: baseEmailWrapper(content, tone.color)
  };
}

// Generate Quote Accepted Notification (for tradie)
export function generateQuoteAcceptedNotificationTemplate(data: {
  businessName: string;
  tradieFirstName: string;
  clientName: string;
  quoteNumber: string;
  quoteTitle: string;
  total: number;
  acceptedAt: string;
}): { subject: string; html: string } {
  const content = `
    <tr>
      <td style="height: 4px; line-height: 4px; font-size: 0; background-color: ${SUCCESS_GREEN};">&nbsp;</td>
    </tr>
    <tr>
      <td class="header" style="padding: 32px 32px 0 32px;">
        <p style="margin: 0; color: ${SUCCESS_GREEN}; font-size: 11px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase;">${data.businessName}</p>
        <h1 style="margin: 10px 0 0 0; color: #0f172a; font-size: 22px; font-weight: 700;">Quote accepted</h1>
      </td>
    </tr>
    ${greetingSection(data.tradieFirstName, `Great news &mdash; <strong>${data.clientName}</strong> has accepted your quote.`)}
    <tr>
      <td style="padding: 24px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <tr>
            <td style="padding: 24px;">
              <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600;">Quote details</p>
              <p style="margin: 10px 0 0 0; color: #0f172a; font-size: 18px; font-weight: 600;">${data.quoteTitle}</p>
              <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">Quote #${data.quoteNumber}</p>
              <p style="margin: 16px 0 0 0; color: ${SUCCESS_GREEN}; font-size: 28px; font-weight: 700;">${formatCurrency(data.total)}</p>
              <p style="margin: 12px 0 0 0; color: #64748b; font-size: 13px;">Accepted on ${formatDate(data.acceptedAt)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 32px 8px 32px;">
        <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.65;">
          <strong style="color: #0f172a;">Next steps:</strong> You can now convert this quote to a job and start scheduling the work. Remember to send an invoice once the job's done.
        </p>
      </td>
    </tr>
    ${businessFooter(data.businessName)}
  `;
  
  return {
    subject: `Quote Accepted! ${data.clientName} accepted Quote #${data.quoteNumber}`,
    html: baseEmailWrapper(content, SUCCESS_GREEN)
  };
}

// Generate Payment Received Notification (for tradie)
export function generatePaymentReceivedNotificationTemplate(data: {
  businessName: string;
  tradieFirstName: string;
  clientName: string;
  invoiceNumber: string;
  invoiceTitle: string;
  amountPaid: number;
  paidAt: string;
}): { subject: string; html: string } {
  const content = `
    <tr>
      <td style="height: 4px; line-height: 4px; font-size: 0; background-color: ${SUCCESS_GREEN};">&nbsp;</td>
    </tr>
    <tr>
      <td class="header" style="padding: 32px 32px 0 32px;">
        <p style="margin: 0; color: ${SUCCESS_GREEN}; font-size: 11px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase;">${data.businessName}</p>
        <h1 style="margin: 10px 0 0 0; color: #0f172a; font-size: 22px; font-weight: 700;">Payment received</h1>
      </td>
    </tr>
    ${greetingSection(data.tradieFirstName, `<strong>${data.clientName}</strong> has paid Invoice #${data.invoiceNumber}.`)}
    <tr>
      <td style="padding: 24px 32px 0 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <tr>
            <td style="padding: 24px;">
              <p style="margin: 0; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600;">Amount received</p>
              <p style="margin: 10px 0 0 0; color: ${SUCCESS_GREEN}; font-size: 34px; font-weight: 700;">${formatCurrency(data.amountPaid)}</p>
              <p style="margin: 16px 0 0 0; color: #0f172a; font-size: 16px; font-weight: 600;">${data.invoiceTitle}</p>
              <p style="margin: 4px 0 0 0; color: #64748b; font-size: 14px;">Invoice #${data.invoiceNumber}</p>
              <p style="margin: 12px 0 0 0; color: #64748b; font-size: 13px;">Paid on ${formatDate(data.paidAt)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${businessFooter(data.businessName)}
  `;
  
  return {
    subject: `Payment Received: ${formatCurrency(data.amountPaid)} from ${data.clientName}`,
    html: baseEmailWrapper(content, SUCCESS_GREEN)
  };
}
