// Properly ordered email handlers with validation, business settings, and idempotency
import crypto from 'crypto';
import { createQuoteEmailHtml, createInvoiceEmailHtml, createReceiptEmailHtml, replaceMergeFields } from './emailService';
import { sendEmailViaIntegration } from './emailIntegrationService';
import { generateQuotePDF, generateInvoicePDF, generatePDFBuffer, resolveBusinessLogoForPdf } from './pdfService';
import { notifyPaymentReceived } from './pushNotifications';
import { notifyQuoteSent, notifyInvoiceSent, notifyInvoicePaid } from './notifications';
import { syncSingleInvoiceToXero, markInvoicePaidInXero } from './xeroService';
import { processPaymentReceivedAutomation } from './automationService';
import { getProductionBaseUrl, getQuotePublicUrl, getInvoicePublicUrl, getReceiptPublicUrl } from './urlHelper';
import { getErrorMessage } from "./lib/errors";

const sendCooldowns = new Map<string, number>();
const SEND_COOLDOWN_MS = 60_000; // 60 seconds

function checkSendCooldown(userId: string, entityType: string, entityId: string): { blocked: boolean; remainingSeconds: number } {
  const key = `${userId}-${entityType}-${entityId}`;
  const lastSent = sendCooldowns.get(key);
  if (lastSent) {
    const elapsed = Date.now() - lastSent;
    if (elapsed < SEND_COOLDOWN_MS) {
      return { blocked: true, remainingSeconds: Math.ceil((SEND_COOLDOWN_MS - elapsed) / 1000) };
    }
  }
  return { blocked: false, remainingSeconds: 0 };
}

function setSendCooldown(userId: string, entityType: string, entityId: string) {
  const key = `${userId}-${entityType}-${entityId}`;
  sendCooldowns.set(key, Date.now());
  if (sendCooldowns.size > 1000) {
    const now = Date.now();
    for (const [k, v] of Array.from(sendCooldowns)) {
      if (now - v > SEND_COOLDOWN_MS * 2) sendCooldowns.delete(k);
    }
  }
}

// Helper function to wrap template content in professional HTML email layout
// Uses absolute JobRunner logo URL as fallback for email client compatibility
function wrapTemplateInHtml(content: string, subject: string, business: any, client: any, brandColor: string, actionUrl?: string | null, actionLabel?: string): string {
  // Compute absolute fallback URL for JobRunner logo (relative URLs don't work in email clients)
  const baseUrl = getProductionBaseUrl();
  const defaultLogoUrl = `${baseUrl}/logo.png`;
  const resolvedLogoUrl = business.logoUrl || defaultLogoUrl;
  
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, ${brandColor} 0%, ${brandColor}cc 100%); padding: 25px; border-radius: 8px 8px 0 0; text-align: center;">
        <div style="background: white; display: inline-block; padding: 12px 20px; border-radius: 8px; margin-bottom: 12px;">
          <img src="${resolvedLogoUrl}" alt="${business.businessName || 'JobRunner'}" style="max-height: 48px; max-width: 160px; display: block;" />
        </div>
        <h1 style="color: white; margin: 0; font-size: 24px;">${business.businessName || 'Your Business'}</h1>
        ${business.abn ? `<p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 12px;">ABN: ${business.abn}</p>` : ''}
      </div>
      <div style="padding: 25px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
        <div style="white-space: pre-line; margin-bottom: 20px;">${content}</div>
        
        ${actionUrl ? `
        <div style="text-align: center; margin: 24px 0; padding: 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; border: 1px solid #86efac;">
          <a href="${actionUrl}" style="background-color: ${brandColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold;">
            ${actionLabel || 'View Online'}
          </a>
          <p style="margin-top: 12px; color: #374151; font-size: 12px;">Or copy this link into your browser:</p>
          <p style="margin: 6px 0 0 0; word-break: break-all;"><a href="${actionUrl}" style="color: ${brandColor}; font-size: 11px;">${actionUrl}</a></p>
        </div>
        ` : ''}
        
        <p style="margin: 20px 0 0 0;">Cheers,<br>${business.businessName}</p>
      </div>
      <div style="text-align: center; padding: 15px; color: #666; font-size: 12px;">
        ${business.phone ? `<p style="margin: 5px 0;">Phone: ${business.phone}</p>` : ''}
        ${business.email ? `<p style="margin: 5px 0;">Email: ${business.email}</p>` : ''}
      </div>
    </body>
    </html>
  `;
}

// Helper to create tradie-friendly error messages with clear fixes
function getTradieFriendlyEmailError(rawError: string): { title: string; message: string; fix: string } {
  const errorLower = rawError.toLowerCase();
  
  if (errorLower.includes('insufficient permission') || errorLower.includes('oauth') || errorLower.includes('scope')) {
    return {
      title: "Email Setup Needed",
      message: "Your email service needs to be reconnected.",
      fix: "Go to Settings → Email Integration and reconnect your email account. This will refresh your email permissions."
    };
  }
  
  if (errorLower.includes('bad request') || errorLower.includes('sender') || errorLower.includes('forbidden') || errorLower.includes('403')) {
    return {
      title: "Email Not Set Up",
      message: "Email sending isn't configured yet.",
      fix: "Go to Settings → Email Integration and connect your Gmail or Outlook account. This lets you send quotes and invoices directly from your own email address."
    };
  }
  
  if (errorLower.includes('network') || errorLower.includes('timeout') || errorLower.includes('econnrefused')) {
    return {
      title: "Connection Issue",
      message: "Couldn't connect to the email service.",
      fix: "Check your internet connection and try again in a few minutes. If this keeps happening, go to Settings → Email Integration to reconnect your email."
    };
  }
  
  if (errorLower.includes('unauthorized') || errorLower.includes('forbidden') || errorLower.includes('all email sending methods failed')) {
    return {
      title: "Email Service Unavailable",
      message: "The email service is temporarily unavailable.",
      fix: "Try again in a few minutes. If this keeps happening, go to Settings → Email Integration and check your email connection is working."
    };
  }

  if (errorLower.includes('authentication failed') || errorLower.includes('invalid login') || errorLower.includes('password')) {
    return {
      title: "Email Login Expired",
      message: "Your email login needs to be refreshed.",
      fix: "Go to Settings → Email Integration and reconnect your email account. Your password or login may have changed."
    };
  }
  
  if (errorLower.includes('rate limit') || errorLower.includes('too many')) {
    return {
      title: "Too Many Emails",
      message: "You've sent too many emails in a short time.",
      fix: "Wait 5-10 minutes and try again. Email services limit how many emails you can send to prevent spam."
    };
  }
  
  if (errorLower.includes('invalid') && errorLower.includes('email')) {
    return {
      title: "Invalid Email Address",
      message: "The client's email address doesn't look right.",
      fix: "Check the client's email address is correct (e.g., john@email.com). Go to Clients and update their email address."
    };
  }
  
  // Default helpful message
  return {
    title: "Couldn't Send Email",
    message: "There was a problem sending this email.",
    fix: "Go to Settings → Email Integration and connect your Gmail or Outlook account. This is the easiest way to make sure emails work reliably."
  };
}

// Fixed quote sending handler
export const handleQuoteSend = async (req: any, res: any, storage: any) => {
  try {
    // Get custom subject and message from request body (optional)
    // skipEmail=true means just mark as sent without sending (user will send via Gmail)
    const { customSubject, customMessage, skipEmail } = req.body || {};
    
    // 1. Get quote with line items
    let quoteWithItems = await storage.getQuoteWithLineItems(req.params.id, req.userId);
    if (!quoteWithItems) {
      return res.status(404).json({ 
        title: "Quote Not Found",
        message: "We couldn't find this quote.",
        fix: "The quote may have been deleted. Go back to your Quotes list and try again."
      });
    }

    // 2. Check if already sent (idempotency) - allow force override
    const forceResend = req.query.force === 'true';
    if (quoteWithItems.status === 'sent' && quoteWithItems.sentAt && !forceResend) {
      const sentDate = new Date(quoteWithItems.sentAt).toLocaleDateString('en-AU');
      return res.status(400).json({ 
        title: "Quote Already Sent",
        message: `This quote was already sent on ${sentDate}.`,
        fix: "If you want to send it again, use the 'Resend' option instead."
      });
    }

    // Cooldown check - prevent rapid duplicate sends
    const quoteSendCooldown = checkSendCooldown(req.userId, 'quote', req.params.id);
    if (quoteSendCooldown.blocked) {
      return res.status(429).json({
        title: "Already Sent",
        message: `This quote was just sent. Please wait ${quoteSendCooldown.remainingSeconds} seconds before sending again.`,
        fix: "Check your sent items — the quote may have already been delivered."
      });
    }

    // 3. Get client information
    const client = await storage.getClient(quoteWithItems.clientId, req.userId);
    if (!client) {
      return res.status(404).json({ 
        title: "Client Not Found",
        message: "The client for this quote no longer exists.",
        fix: "Update the quote to select a different client, or recreate the client in your Clients list."
      });
    }

    // 4. Validate client email
    if (!client.email || !client.email.trim()) {
      return res.status(400).json({ 
        title: "Client Email Missing",
        message: `${client.name} doesn't have an email address.`,
        fix: `Go to Clients → ${client.name} → Edit and add their email address.`
      });
    }

    // 5. Get business settings
    let businessSettings = await storage.getBusinessSettings(req.userId);
    if (!businessSettings) {
      return res.status(404).json({ 
        title: "Business Setup Incomplete",
        message: "Your business details haven't been set up yet.",
        fix: "Go to Settings and complete your business profile before sending quotes."
      });
    }
    
    // Resolve logo URL for email (convert object storage path to public URL if needed)
    const baseUrlForLogo = getProductionBaseUrl(req);
    if (businessSettings.logoUrl && businessSettings.logoUrl.startsWith('/objects/')) {
      // For emails, use the public endpoint that serves the object (route is /objects/... not /api/objects/...)
      businessSettings = { ...businessSettings, logoUrl: `${baseUrlForLogo}${businessSettings.logoUrl}` };
    }
    // Apply JobRunner logo fallback if no business logo
    if (!businessSettings.logoUrl) {
      businessSettings = { ...businessSettings, logoUrl: `${baseUrlForLogo}/logo.png` };
    }

    // 6. Validate business email for sending
    if (!businessSettings.email || !businessSettings.email.trim()) {
      return res.status(400).json({ 
        title: "Business Email Missing",
        message: "Your business email isn't set up.",
        fix: "Go to Settings → Business Profile and add your business email address."
      });
    }

    // 6.5 Generate acceptance token if not already present
    let acceptanceToken = quoteWithItems.acceptanceToken;
    if (!acceptanceToken) {
      acceptanceToken = await storage.generateQuoteAcceptanceToken(req.params.id, req.userId);
      // Refresh quote data with token
      quoteWithItems = await storage.getQuoteWithLineItems(req.params.id, req.userId);
    }

    // Generate public quote URL for client to view and accept
    const quoteAcceptanceUrl = acceptanceToken ? getQuotePublicUrl(acceptanceToken, req) : null;

    // 7. Get linked job if quote is tied to one
    let linkedJob: any = null;
    if (quoteWithItems.jobId) {
      linkedJob = await storage.getJob(quoteWithItems.jobId, req.userId);
    }
    
    // Define common variables used across all email branches
    const brandColor = businessSettings.brandColor || '#2563eb';
    const formattedTotal = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(parseFloat(String(quoteWithItems.total || '0')));

    // 8. Send email (skip if user is sending via Gmail themselves)
    let emailSentVia = 'gmail_user'; // Default for skipEmail mode
    
    if (!skipEmail) {
      // Try to send via integration (User's SMTP, Gmail connector, or SendGrid)
      try {
        let emailSubject: string;
        let emailHtml: string;
        
        if (customSubject && customMessage) {
          // Use custom subject and message with professional template
          emailSubject = customSubject;
          
          emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, ${brandColor} 0%, ${brandColor}cc 100%); padding: 25px; border-radius: 8px 8px 0 0; text-align: center;">
                ${businessSettings.logoUrl ? `
                  <div style="background: white; display: inline-block; padding: 12px 20px; border-radius: 8px; margin-bottom: 12px;">
                    <img src="${businessSettings.logoUrl}" alt="${businessSettings.businessName}" style="max-height: 48px; max-width: 160px; display: block;" />
                  </div>
                ` : ''}
                <h1 style="color: white; margin: 0; font-size: 24px;">${businessSettings.businessName}</h1>
                ${businessSettings.abn ? `<p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 12px;">ABN: ${businessSettings.abn}</p>` : ''}
                <div style="margin-top: 12px; background: rgba(255,255,255,0.2); display: inline-block; padding: 6px 16px; border-radius: 20px;">
                  <span style="color: white; font-size: 13px; font-weight: 600;">QUOTE #${quoteWithItems.number || quoteWithItems.id}</span>
                </div>
              </div>
              
              <div style="background: #f8f9fa; padding: 25px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
                ${customMessage.split('\n').map((p: string) => p.trim() ? `<p style="margin: 0 0 16px 0;">${p}</p>` : '<br>').join('')}
                
                <div style="background: white; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">Quote Details:</p>
                  <p style="margin: 0 0 4px 0; font-weight: 600;">${quoteWithItems.title}</p>
                  <p style="margin: 0; font-size: 20px; color: ${brandColor}; font-weight: 700;">${formattedTotal}</p>
                </div>
                
                ${quoteAcceptanceUrl ? `
                <div style="text-align: center; margin: 24px 0; padding: 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; border: 1px solid #86efac;">
                  <a href="${quoteAcceptanceUrl}" style="background-color: ${brandColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold;">View & Accept Quote</a>
                  <p style="margin-top: 12px; color: #374151; font-size: 12px;">Or copy this link into your browser:</p>
                  <p style="margin: 6px 0 0 0; word-break: break-all;"><a href="${quoteAcceptanceUrl}" style="color: ${brandColor}; font-size: 11px;">${quoteAcceptanceUrl}</a></p>
                </div>
                ` : ''}
              </div>
              
              <div style="margin-top: 20px; padding: 16px; text-align: center; color: #666; font-size: 12px;">
                ${businessSettings.phone ? `<p style="margin: 4px 0;">Phone: ${businessSettings.phone}</p>` : ''}
                ${businessSettings.email ? `<p style="margin: 4px 0;">Email: ${businessSettings.email}</p>` : ''}
                ${businessSettings.address ? `<p style="margin: 4px 0;">${businessSettings.address}</p>` : ''}
              </div>
            </body>
            </html>
          `;
        } else {
          // Check for custom business template first
          const businessTemplate = await storage.getActiveBusinessTemplateByPurpose(req.userId, 'email', 'quote_sent');
          
          if (businessTemplate) {
            // Use custom business template with merge field replacement
            const mergeData = {
              client_name: client.name,
              business_name: businessSettings.businessName,
              quote_number: quoteWithItems.number || quoteWithItems.id?.substring(0, 8).toUpperCase(),
              quote_total: formattedTotal,
              job_title: quoteWithItems.title,
              job_address: linkedJob?.address || '',
              due_date: quoteWithItems.validUntil ? new Date(quoteWithItems.validUntil).toLocaleDateString('en-AU') : '',
              deposit_percent: businessSettings.depositPercent?.toString() || '50',
              acceptance_url: quoteAcceptanceUrl || '',
            };
            
            const templateContent = replaceMergeFields(businessTemplate.content, mergeData);
            const templateSubject = businessTemplate.subject 
              ? replaceMergeFields(businessTemplate.subject, mergeData)
              : `Quote ${mergeData.quote_number} from ${businessSettings.businessName}`;
            
            emailSubject = templateSubject;
            emailHtml = wrapTemplateInHtml(templateContent, templateSubject, businessSettings, client, brandColor, quoteAcceptanceUrl, 'View & Accept Quote');
          } else {
            // Use default email template
            const emailContent = createQuoteEmailHtml(quoteWithItems, client, businessSettings, quoteAcceptanceUrl);
            emailSubject = emailContent.subject;
            emailHtml = emailContent.html;
          }
        }
        
        // Generate PDF with acceptance link for attachment
        let pdfAttachment: { filename: string; content: Buffer; contentType: string } | undefined;
        try {
          // Get line items for PDF generation
          const lineItems = await storage.getQuoteLineItems(req.params.id, req.userId);
          
          // Get job signatures if quote is linked to a job
          let jobSignatures: any[] = [];
          if (quoteWithItems.jobId) {
            const { db } = await import('./storage');
            const { digitalSignatures } = await import('@shared/schema');
            const { eq } = await import('drizzle-orm');
            const signatures = await db.select().from(digitalSignatures).where(eq(digitalSignatures.jobId, quoteWithItems.jobId));
            jobSignatures = signatures.map(sig => ({
              id: sig.id,
              jobId: sig.jobId,
              signerName: sig.signerName,
              signatureData: sig.signatureData,
              signedAt: sig.signedAt,
            }));
          }
          
          const businessForPdf = await resolveBusinessLogoForPdf(businessSettings);
          const pdfHtml = generateQuotePDF({
            quote: quoteWithItems,
            lineItems: lineItems || [],
            client,
            business: businessForPdf,
            acceptanceUrl: quoteAcceptanceUrl || undefined,
            jobSignatures,
          });
          const pdfBuffer = await generatePDFBuffer(pdfHtml);
          pdfAttachment = {
            filename: `Quote-${quoteWithItems.number || quoteWithItems.id}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          };
          console.log(`Generated PDF attachment for quote ${quoteWithItems.number}`);
        } catch (pdfError) {
          // If PDF generation fails, continue without attachment
          console.error('Failed to generate quote PDF attachment:', pdfError);
        }
        
        const result = await sendEmailViaIntegration({
          to: client.email,
          subject: emailSubject,
          html: emailHtml,
          attachments: pdfAttachment ? [pdfAttachment] : undefined,
          userId: req.userId,
          type: 'quote',
          relatedId: req.params.id,
          fromName: businessSettings.businessName,
          replyTo: businessSettings.businessEmail || undefined,
        });
        
        if (result.success) {
          console.log(`Quote sent via ${result.sentVia}:`, req.params.id);
          emailSentVia = result.sentVia || 'integration';
        } else {
          console.error("Email integration failed:", result.error);
          const friendlyError = getTradieFriendlyEmailError(result.error || 'unknown error');
          return res.status(502).json(friendlyError);
        }
      } catch (emailError: unknown) {
        console.error("Quote email sending failed:", getErrorMessage(emailError));
        const friendlyError = getTradieFriendlyEmailError(getErrorMessage(emailError));
        return res.status(502).json(friendlyError);
      }
    } else {
      // skipEmail mode - user is sending via Gmail themselves
      console.log(`Quote ${req.params.id} marked as sent (user sending via Gmail)`);
    }

    // 8. Log resend event if applicable
    if (forceResend && quoteWithItems.sentAt) {
      console.log('Force resend quote:', req.params.id, 'Previous sent:', quoteWithItems.sentAt);
    }

    // 9. Update quote status ONLY after successful email send
    const updatedQuote = await storage.updateQuote(req.params.id, req.userId, {
      status: 'sent',
      sentAt: new Date()
    });

    if (!updatedQuote) {
      // Email was sent but status update failed - log this for manual review
      console.error("CRITICAL: Quote email sent but status update failed for quote:", req.params.id);
      return res.status(500).json({ 
        title: "Partial Success",
        message: "The quote was emailed to your client, but we had trouble updating its status.",
        fix: "The email was sent successfully. You can manually update the quote status if needed."
      });
    }

    // Set cooldown after successful send
    setSendCooldown(req.userId, 'quote', req.params.id);

    // Log activity for dashboard feed with full email content for Communications Hub
    try {
      // Get the email subject and body that was used
      const loggedSubject = customSubject || `Quote ${updatedQuote.number || updatedQuote.id} from ${businessSettings.businessName}`;
      const loggedBody = customMessage || `G'day ${client.name},\n\nPlease find attached our quote for ${updatedQuote.title || 'the requested work'}.\n\nTotal: ${new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(parseFloat(String(updatedQuote.total || '0')))}\n\nCheers,\n${businessSettings.businessName}`;
      
      await storage.createActivityLog({
        userId: req.userId,
        type: 'quote_sent',
        title: `Quote #${updatedQuote.number} sent`,
        description: `Sent to ${client.name}`,
        entityType: 'quote',
        entityId: updatedQuote.id,
        metadata: { 
          quoteNumber: updatedQuote.number, 
          quoteTitle: updatedQuote.title,
          clientName: client.name, 
          clientEmail: client.email, 
          recipientEmail: client.email,
          total: updatedQuote.total,
          emailSubject: loggedSubject,
          emailBody: loggedBody,
          source: req.headers['x-mobile-app'] === 'true' ? 'mobile' : 'web',
        }
      });
    } catch (activityError) {
      console.error('Failed to log quote sent activity:', activityError);
    }

    try {
      await notifyQuoteSent(storage, req.userId, updatedQuote, client.name);
    } catch (notifErr) {
      console.error('Failed to send quote sent notification:', notifErr);
    }

    res.json({ 
      ...updatedQuote, 
      emailSent: true, 
      message: 'Quote sent successfully to ' + client.email 
    });

  } catch (error) {
    console.error("Error in quote send handler:", error);
    res.status(500).json({ 
      title: "Something Went Wrong",
      message: "We couldn't send this quote right now.",
      fix: "Try again in a few minutes. If this keeps happening, contact support."
    });
  }
};

// Fixed invoice sending handler
export const handleInvoiceSend = async (req: any, res: any, storage: any) => {
  try {
    // Get custom subject and message from request body (optional)
    // skipEmail=true means just mark as sent without sending (user will send via Gmail)
    const { customSubject, customMessage, skipEmail } = req.body || {};
    
    // 1. Get invoice with line items
    let invoiceWithItems = await storage.getInvoiceWithLineItems(req.params.id, req.userId);
    if (!invoiceWithItems) {
      return res.status(404).json({ 
        title: "Invoice Not Found",
        message: "We couldn't find this invoice.",
        fix: "The invoice may have been deleted. Go back to your Invoices list and try again."
      });
    }

    // 2. Check if already sent (idempotency) - allow force override  
    const forceResend = req.query.force === 'true';
    if (invoiceWithItems.status === 'sent' && invoiceWithItems.sentAt && !forceResend) {
      const sentDate = new Date(invoiceWithItems.sentAt).toLocaleDateString('en-AU');
      return res.status(400).json({ 
        title: "Invoice Already Sent",
        message: `This invoice was already sent on ${sentDate}.`,
        fix: "If you want to send it again, use the 'Resend' option instead."
      });
    }

    // 3. Get client information
    const client = await storage.getClient(invoiceWithItems.clientId, req.userId);
    if (!client) {
      return res.status(404).json({ 
        title: "Client Not Found",
        message: "The client for this invoice no longer exists.",
        fix: "Update the invoice to select a different client, or recreate the client in your Clients list."
      });
    }

    // 4. Validate client email
    if (!client.email || !client.email.trim()) {
      return res.status(400).json({ 
        title: "Client Email Missing",
        message: `${client.name} doesn't have an email address.`,
        fix: `Go to Clients → ${client.name} → Edit and add their email address.`
      });
    }

    // 5. Get business settings
    let businessSettings = await storage.getBusinessSettings(req.userId);
    if (!businessSettings) {
      return res.status(404).json({ 
        title: "Business Setup Incomplete",
        message: "Your business details haven't been set up yet.",
        fix: "Go to Settings and complete your business profile before sending invoices."
      });
    }
    
    // Resolve logo URL for email (convert object storage path to public URL if needed)
    const baseUrlForLogo = getProductionBaseUrl(req);
    if (businessSettings.logoUrl && businessSettings.logoUrl.startsWith('/objects/')) {
      // For emails, use the public endpoint that serves the object (route is /objects/... not /api/objects/...)
      businessSettings = { ...businessSettings, logoUrl: `${baseUrlForLogo}${businessSettings.logoUrl}` };
    }
    // Apply JobRunner logo fallback if no business logo
    if (!businessSettings.logoUrl) {
      businessSettings = { ...businessSettings, logoUrl: `${baseUrlForLogo}/logo.png` };
    }

    // 6. Validate business email for sending
    if (!businessSettings.email || !businessSettings.email.trim()) {
      return res.status(400).json({ 
        title: "Business Email Missing",
        message: "Your business email isn't set up.",
        fix: "Go to Settings → Business Profile and add your business email address."
      });
    }

    // 6.5. Determine payment URL for email - always use custom payment page for tradie branding
    let paymentUrl: string | null = null;
    
    if (invoiceWithItems.allowOnlinePayment) {
      // Generate payment token if not already present (12 chars alphanumeric for shorter URLs)
      if (!invoiceWithItems.paymentToken) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let paymentToken = '';
        for (let i = 0; i < 12; i++) {
          paymentToken += chars[crypto.randomInt(chars.length)];
        }
        await storage.updateInvoice(req.params.id, req.userId, { paymentToken });
        invoiceWithItems = { ...invoiceWithItems, paymentToken };
      }
      
      // Always use custom payment page for consistent tradie branding (not Stripe's checkout.stripe.com)
      paymentUrl = `${getProductionBaseUrl(req)}/pay/${invoiceWithItems.paymentToken}`;
    }

    // 7. Get linked job if invoice is tied to one
    let linkedJob: any = null;
    if (invoiceWithItems.jobId) {
      linkedJob = await storage.getJob(invoiceWithItems.jobId, req.userId);
    }
    
    // Define common variables used across all email branches
    const brandColor = businessSettings.brandColor || '#16a34a'; // Green for invoices
    const formattedTotal = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(parseFloat(String(invoiceWithItems.total || '0')));
    const isGstRegistered = businessSettings.gstEnabled && businessSettings.abn;
    const documentType = isGstRegistered ? 'TAX INVOICE' : 'INVOICE';

    // 8. Send email (skip if user is sending via Gmail themselves)
    let emailSentVia = 'gmail_user'; // Default for skipEmail mode
    
    if (!skipEmail) {
      // Try to send via integration (User's SMTP, Gmail connector, or SendGrid)
      try {
        let emailSubject: string;
        let emailHtml: string;
        
        if (customSubject && customMessage) {
          // Use custom subject and message with professional template
          emailSubject = customSubject;
          
          emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, ${brandColor} 0%, ${brandColor}cc 100%); padding: 25px; border-radius: 8px 8px 0 0; text-align: center;">
                ${businessSettings.logoUrl ? `
                  <div style="background: white; display: inline-block; padding: 12px 20px; border-radius: 8px; margin-bottom: 12px;">
                    <img src="${businessSettings.logoUrl}" alt="${businessSettings.businessName}" style="max-height: 48px; max-width: 160px; display: block;" />
                  </div>
                ` : ''}
                <h1 style="color: white; margin: 0; font-size: 24px;">${businessSettings.businessName}</h1>
                ${businessSettings.abn ? `<p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 12px;">ABN: ${businessSettings.abn}</p>` : ''}
                <div style="margin-top: 12px; background: rgba(255,255,255,0.2); display: inline-block; padding: 6px 16px; border-radius: 20px;">
                  <span style="color: white; font-size: 13px; font-weight: 600;">${documentType} #${invoiceWithItems.number || invoiceWithItems.id}</span>
                </div>
              </div>
              
              <div style="background: #f8f9fa; padding: 25px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
                ${customMessage.split('\n').map((p: string) => p.trim() ? `<p style="margin: 0 0 16px 0;">${p}</p>` : '<br>').join('')}
                
                <div style="background: white; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">Invoice Details:</p>
                  <p style="margin: 0 0 4px 0; font-weight: 600;">${invoiceWithItems.title}</p>
                  <p style="margin: 0; font-size: 20px; color: ${brandColor}; font-weight: 700;">${formattedTotal}</p>
                  ${invoiceWithItems.dueDate ? `<p style="margin: 8px 0 0 0; color: #666; font-size: 13px;">Due: ${new Date(invoiceWithItems.dueDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>` : ''}
                </div>
                
                ${paymentUrl ? `
                <div style="text-align: center; margin: 24px 0; padding: 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; border: 1px solid #86efac;">
                  <a href="${paymentUrl}" style="background-color: ${brandColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold;">Pay Now</a>
                  <p style="margin-top: 12px; color: #374151; font-size: 12px;">Or copy this link into your browser:</p>
                  <p style="margin: 6px 0 0 0; word-break: break-all;"><a href="${paymentUrl}" style="color: ${brandColor}; font-size: 11px;">${paymentUrl}</a></p>
                </div>
                ` : ''}
              </div>
              
              <div style="margin-top: 20px; padding: 16px; text-align: center; color: #666; font-size: 12px;">
                ${businessSettings.phone ? `<p style="margin: 4px 0;">Phone: ${businessSettings.phone}</p>` : ''}
                ${businessSettings.email ? `<p style="margin: 4px 0;">Email: ${businessSettings.email}</p>` : ''}
                ${businessSettings.address ? `<p style="margin: 4px 0;">${businessSettings.address}</p>` : ''}
              </div>
            </body>
            </html>
          `;
        } else {
          // Check for custom business template first
          const businessTemplate = await storage.getActiveBusinessTemplateByPurpose(req.userId, 'email', 'invoice_sent');
          
          if (businessTemplate) {
            // Use custom business template with merge field replacement
            const mergeData = {
              client_name: client.name,
              business_name: businessSettings.businessName,
              invoice_number: invoiceWithItems.number || invoiceWithItems.id?.substring(0, 8).toUpperCase(),
              invoice_total: formattedTotal,
              job_title: invoiceWithItems.title,
              job_address: linkedJob?.address || '',
              due_date: invoiceWithItems.dueDate ? new Date(invoiceWithItems.dueDate).toLocaleDateString('en-AU') : '',
              payment_url: paymentUrl || '',
            };
            
            const templateContent = replaceMergeFields(businessTemplate.content, mergeData);
            const templateSubject = businessTemplate.subject 
              ? replaceMergeFields(businessTemplate.subject, mergeData)
              : `${documentType} ${mergeData.invoice_number} from ${businessSettings.businessName}`;
            
            emailSubject = templateSubject;
            emailHtml = wrapTemplateInHtml(templateContent, templateSubject, businessSettings, client, brandColor, paymentUrl, 'Pay Now');
          } else {
            // Use default email template
            const emailContent = createInvoiceEmailHtml(invoiceWithItems, client, businessSettings, paymentUrl);
            emailSubject = emailContent.subject;
            emailHtml = emailContent.html;
          }
        }
        
        // Generate PDF with payment link for attachment
        let pdfAttachment: { filename: string; content: Buffer; contentType: string } | undefined;
        try {
          // Get line items for PDF generation
          const lineItems = await storage.getInvoiceLineItems(req.params.id, req.userId);
          
          // Get job and signatures (from job completion AND linked quote acceptance)
          const job = invoiceWithItems.jobId ? await storage.getJob(invoiceWithItems.jobId, req.userId) : undefined;
          let jobSignatures: any[] = [];
          const { digitalSignatures } = await import("@shared/schema");
          const { db } = await import("./storage");
          const { eq } = await import("drizzle-orm");
          
          // Get job completion signatures if job is linked
          if (invoiceWithItems.jobId) {
            const jobSigs = await db.select().from(digitalSignatures).where(eq(digitalSignatures.jobId, invoiceWithItems.jobId));
            jobSignatures = jobSigs.filter((s: any) => s.documentType === 'job_completion');
          }
          
          // Also get quote acceptance signatures if invoice is linked to a quote
          if (invoiceWithItems.quoteId) {
            const quoteSigs = await db.select().from(digitalSignatures).where(eq(digitalSignatures.quoteId, invoiceWithItems.quoteId));
            const quoteSignatures = quoteSigs.map((sig: any) => ({
              id: sig.id,
              quoteId: sig.quoteId,
              signerName: sig.signerName,
              signatureData: sig.signatureData,
              signedAt: sig.signedAt,
              documentType: 'quote_acceptance',
            }));
            jobSignatures = [...jobSignatures, ...quoteSignatures];
          }
          
          const businessForPdf = await resolveBusinessLogoForPdf(businessSettings);
          const pdfHtml = generateInvoicePDF({
            invoice: invoiceWithItems,
            lineItems: lineItems || [],
            client,
            business: businessForPdf,
            paymentUrl: paymentUrl || undefined,
            job,
            jobSignatures,
          });
          const pdfBuffer = await generatePDFBuffer(pdfHtml);
          pdfAttachment = {
            filename: `Invoice-${invoiceWithItems.number || invoiceWithItems.id}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          };
          console.log(`Generated PDF attachment for invoice ${invoiceWithItems.number}`);
        } catch (pdfError) {
          // If PDF generation fails, continue without attachment
          console.error('Failed to generate invoice PDF attachment:', pdfError);
        }
        
        const result = await sendEmailViaIntegration({
          to: client.email,
          subject: emailSubject,
          html: emailHtml,
          attachments: pdfAttachment ? [pdfAttachment] : undefined,
          userId: req.userId,
          type: 'invoice',
          relatedId: req.params.id,
          fromName: businessSettings.businessName,
        });
        
        if (result.success) {
          console.log(`Invoice sent via ${result.sentVia}:`, req.params.id);
          emailSentVia = result.sentVia || 'integration';
        } else {
          console.error("Email integration failed:", result.error);
          const friendlyError = getTradieFriendlyEmailError(result.error || 'unknown error');
          return res.status(502).json(friendlyError);
        }
      } catch (emailError: unknown) {
        console.error("Invoice email sending failed:", getErrorMessage(emailError));
        const friendlyError = getTradieFriendlyEmailError(getErrorMessage(emailError));
        return res.status(502).json(friendlyError);
      }
    } else {
      // skipEmail mode - user is sending via Gmail themselves
      console.log(`Invoice ${req.params.id} marked as sent (user sending via Gmail)`);
    }

    // 8. Log resend event if applicable
    if (forceResend && invoiceWithItems.sentAt) {
      console.log('Force resend invoice:', req.params.id, 'Previous sent:', invoiceWithItems.sentAt);
    }

    // 9. Update invoice status ONLY after successful email send
    const updatedInvoice = await storage.updateInvoice(req.params.id, req.userId, {
      status: 'sent',
      sentAt: new Date()
    });

    if (!updatedInvoice) {
      // Email was sent but status update failed - log this for manual review
      console.error("CRITICAL: Invoice email sent but status update failed for invoice:", req.params.id);
      return res.status(500).json({ 
        title: "Partial Success",
        message: "The invoice was emailed to your client, but we had trouble updating its status.",
        fix: "The email was sent successfully. You can manually update the invoice status if needed."
      });
    }

    // 10. Auto-sync to Xero if connected (non-blocking, errors logged but don't fail the request)
    try {
      const xeroResult = await syncSingleInvoiceToXero(req.userId, req.params.id);
      if (xeroResult.success && xeroResult.xeroInvoiceId) {
        console.log(`[Xero] Invoice ${req.params.id} auto-synced to Xero as ${xeroResult.xeroInvoiceId}`);
      } else if (!xeroResult.success) {
        console.warn(`[Xero] Failed to auto-sync invoice ${req.params.id}:`, xeroResult.error);
      }
    } catch (xeroError) {
      // Log but don't fail - Xero sync is a nice-to-have, not critical
      console.warn('[Xero] Auto-sync error (non-blocking):', xeroError);
    }

    // Log activity for dashboard feed with full email content for Communications Hub
    try {
      // Get the email subject and body that was used
      const loggedSubject = customSubject || `${documentType} ${updatedInvoice.number || updatedInvoice.id} from ${businessSettings.businessName}`;
      const loggedBody = customMessage || `G'day ${client.name},\n\nPlease find attached your ${documentType.toLowerCase()} for ${updatedInvoice.title || 'the completed work'}.\n\nTotal: ${formattedTotal}\n${paymentUrl ? `\nPay online: ${paymentUrl}` : ''}\n\nCheers,\n${businessSettings.businessName}`;
      
      await storage.createActivityLog({
        userId: req.userId,
        type: 'invoice_sent',
        title: `Invoice #${updatedInvoice.number} sent`,
        description: `Sent to ${client.name}`,
        entityType: 'invoice',
        entityId: updatedInvoice.id,
        metadata: { 
          invoiceNumber: updatedInvoice.number, 
          invoiceTitle: updatedInvoice.title,
          clientName: client.name, 
          clientEmail: client.email, 
          recipientEmail: client.email,
          total: updatedInvoice.total,
          emailSubject: loggedSubject,
          emailBody: loggedBody,
          source: req.headers['x-mobile-app'] === 'true' ? 'mobile' : 'web',
        }
      });
    } catch (activityError) {
      console.error('Failed to log invoice sent activity:', activityError);
    }

    try {
      await notifyInvoiceSent(storage, req.userId, updatedInvoice, client.name);
    } catch (notifErr) {
      console.error('Failed to send invoice sent notification:', notifErr);
    }

    res.json({ 
      ...updatedInvoice, 
      emailSent: true, 
      paymentUrl,
      message: 'Invoice sent successfully to ' + client.email 
    });

  } catch (error) {
    console.error("Error in invoice send handler:", error);
    res.status(500).json({ 
      title: "Something Went Wrong",
      message: "We couldn't send this invoice right now.",
      fix: "Try again in a few minutes. If this keeps happening, contact support."
    });
  }
};

// Fixed mark paid handler with receipt
export const handleInvoiceMarkPaid = async (req: any, res: any, storage: any) => {
  try {
    // 1. Get invoice with line items
    const invoiceWithItems = await storage.getInvoiceWithLineItems(req.params.id, req.userId);
    if (!invoiceWithItems) {
      return res.status(404).json({ 
        title: "Invoice Not Found",
        message: "We couldn't find this invoice.",
        fix: "The invoice may have been deleted. Go back to your Invoices list."
      });
    }

    // 2. Check if already paid (idempotency)
    if (invoiceWithItems.status === 'paid' && invoiceWithItems.paidAt) {
      const paidDate = new Date(invoiceWithItems.paidAt).toLocaleDateString('en-AU');
      return res.status(400).json({ 
        title: "Already Paid",
        message: `This invoice was already marked as paid on ${paidDate}.`,
        fix: "No action needed - the payment is already recorded."
      });
    }

    // 3. Get client information  
    const client = await storage.getClient(invoiceWithItems.clientId, req.userId);
    if (!client) {
      return res.status(404).json({ 
        title: "Client Not Found",
        message: "The client for this invoice no longer exists.",
        fix: "The payment can still be recorded, but the client details are missing."
      });
    }

    // 4. Get business settings
    const businessSettings = await storage.getBusinessSettings(req.userId);
    if (!businessSettings) {
      return res.status(404).json({ 
        title: "Business Setup Incomplete",
        message: "Your business details haven't been set up yet.",
        fix: "Go to Settings and complete your business profile."
      });
    }

    // 5. Update invoice status to paid FIRST (payment is recorded regardless of email) and lock it
    const updatedInvoice = await storage.updateInvoice(req.params.id, req.userId, {
      status: 'paid',
      paidAt: new Date(),
      lockedAt: new Date(),
      lockedReason: 'payment_received',
    });

    if (!updatedInvoice) {
      return res.status(500).json({ 
        title: "Couldn't Record Payment",
        message: "There was a problem saving the payment.",
        fix: "Try again in a few minutes. If this keeps happening, contact support."
      });
    }

    // Update linked job status if applicable (best effort, don't fail if this errors)
    if (invoiceWithItems.jobId) {
      try {
        const job = await storage.getJob(invoiceWithItems.jobId, req.userId);
        if (job && job.status !== 'invoiced') {
          await storage.updateJob(invoiceWithItems.jobId, req.userId, { status: 'invoiced' });
        }
      } catch (jobError) {
        console.log("Job status update skipped:", jobError);
      }
    }

    // Trigger automation rules for payment received (async, non-blocking)
    processPaymentReceivedAutomation(req.userId, req.params.id)
      .catch(err => console.error('[Automations] Error processing payment received:', err));

    // Sync payment status to Xero (async, non-blocking)
    markInvoicePaidInXero(req.userId, req.params.id)
      .catch(err => console.warn('[Xero] Error syncing payment to Xero:', err));

    // Log activity for dashboard feed
    try {
      const formattedTotal = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(parseFloat(String(invoiceWithItems.total || '0')));
      await storage.createActivityLog({
        userId: req.userId,
        type: 'invoice_paid',
        title: `Payment received: Invoice #${invoiceWithItems.number}`,
        description: `${formattedTotal} from ${client.name}`,
        entityType: 'invoice',
        entityId: invoiceWithItems.id,
        metadata: { invoiceNumber: invoiceWithItems.number, clientName: client.name, total: invoiceWithItems.total, source: req.headers['x-mobile-app'] === 'true' ? 'mobile' : 'web' }
      });
    } catch (activityError) {
      console.error('Failed to log invoice paid activity:', activityError);
    }

    // 6. Send receipt email (optional - don't fail if email issues)
    // Always use sendEmailViaIntegration which handles:
    // 1. User's SMTP integration (if connected)
    // 2. Gmail via Replit connector (if available)
    // 3. SendGrid platform email (fallback)
    let receiptEmailSent = false;
    let emailMessage = '';

    if (client.email && client.email.trim() && businessSettings.email && businessSettings.email.trim()) {
      try {
        const invoiceData = { ...invoiceWithItems, paidAt: updatedInvoice.paidAt };
        const emailContent = createReceiptEmailHtml(invoiceData, client, businessSettings);
        
        const result = await sendEmailViaIntegration({
          to: client.email,
          subject: emailContent.subject,
          html: emailContent.html,
          userId: req.userId,
          type: 'receipt',
          relatedId: req.params.id,
          fromName: businessSettings.businessName,
        });
        
        if (result.success) {
          receiptEmailSent = true;
          emailMessage = `Payment recorded and receipt sent to ${client.email}`;
          console.log(`Receipt sent via ${result.sentVia}:`, req.params.id);
        } else {
          emailMessage = `Payment recorded. Receipt couldn't be sent - you may need to set up email in Settings.`;
          console.error("Receipt email integration failed:", result.error);
        }
      } catch (emailError: unknown) {
        console.error("Receipt email sending failed:", getErrorMessage(emailError));
        emailMessage = `Payment recorded. Receipt couldn't be sent - check Settings → Email Integration.`;
      }
    } else {
      emailMessage = 'Payment recorded. Receipt not sent - add email addresses to send receipts.';
    }

    // Send push notification for payment received
    const invoiceTotal = parseFloat(String(invoiceWithItems.total || '0'));
    const amountInCents = Math.round(invoiceTotal * 100);
    await notifyPaymentReceived(req.userId, amountInCents, invoiceWithItems.number || `INV-${invoiceWithItems.id}`, invoiceWithItems.id);
    
    try {
      await notifyInvoicePaid(storage, req.userId, invoiceWithItems, client.name);
    } catch (notifErr) {
      console.error('Failed to send invoice paid notification:', notifErr);
    }
    
    res.json({ 
      ...updatedInvoice, 
      emailSent: receiptEmailSent, 
      message: emailMessage
    });

  } catch (error) {
    console.error("Error in mark paid handler:", error);
    res.status(500).json({ 
      title: "Something Went Wrong",
      message: "We couldn't record this payment right now.",
      fix: "Try again in a few minutes. If this keeps happening, contact support."
    });
  }
};

// ===== AUTOMATED EMAIL WITH PDF ATTACHMENT =====
// These handlers automatically generate PDF, upload to cloud storage, and create Gmail draft

import { createGmailDraftWithAttachment, isGmailConnected } from './gmailClient';
import { ObjectStorageService } from './objectStorage';

const objectStorage = new ObjectStorageService();

// Helper to upload PDF to cloud storage and return metadata
async function uploadPDFToStorage(
  pdfBuffer: Buffer,
  type: 'quote' | 'invoice',
  documentNumber: string,
  userId: string
): Promise<{ path: string; filename: string }> {
  const timestamp = Date.now();
  const sanitizedNumber = documentNumber.replace(/[^a-zA-Z0-9-]/g, '_');
  const filename = `${type}s/${userId}/${sanitizedNumber}_${timestamp}.pdf`;
  
  try {
    const path = await objectStorage.uploadFile(filename, pdfBuffer, 'application/pdf');
    console.log(`✅ PDF uploaded to storage: ${filename}`);
    return { path, filename: `${type.toUpperCase()}-${documentNumber}.pdf` };
  } catch (error: unknown) {
    console.error('PDF upload error:', error);
    throw new Error('Failed to save PDF to cloud storage');
  }
}

// Create Gmail draft OR send directly via SendGrid based on user preference
export const handleQuoteEmailWithPDF = async (req: any, res: any, storage: any) => {
  try {
    const { customSubject, customMessage, includeBeforePhotos, excludeNotes } = req.body || {};
    
    // 1. Get business settings to check email sending preference
    let businessSettings = await storage.getBusinessSettings(req.userId);
    if (!businessSettings) {
      return res.status(404).json({
        title: "Business Setup Incomplete",
        message: "Your business details haven't been set up yet.",
        fix: "Go to Settings and complete your business profile."
      });
    }
    
    // Resolve logo URL for email (convert object storage path to public URL if needed)
    const baseUrlForLogo = getProductionBaseUrl(req);
    if (businessSettings.logoUrl && businessSettings.logoUrl.startsWith('/objects/')) {
      // Route is /objects/... not /api/objects/...
      businessSettings = { ...businessSettings, logoUrl: `${baseUrlForLogo}${businessSettings.logoUrl}` };
    }
    // Apply JobRunner logo fallback if no business logo
    if (!businessSettings.logoUrl) {
      businessSettings = { ...businessSettings, logoUrl: `${baseUrlForLogo}/logo.png` };
    }
    
    const emailSendingMode = businessSettings.emailSendingMode || 'manual';
    
    // Check Gmail connection status
    const gmailConnected = await isGmailConnected();
    
    // For manual mode, require Gmail connection - user wants to review draft before sending
    if (emailSendingMode === 'manual' && !gmailConnected) {
      return res.status(400).json({
        title: "Gmail Not Connected",
        message: "Gmail needs to be connected to review emails before sending.",
        fix: "Go to Settings → Email Integration and connect Gmail, or switch to 'Automatic' email mode to send directly without review."
      });
    }
    
    // 2. Get quote with line items
    let quoteWithItems = await storage.getQuoteWithLineItems(req.params.id, req.userId);
    if (!quoteWithItems) {
      return res.status(404).json({
        title: "Quote Not Found",
        message: "We couldn't find this quote.",
        fix: "The quote may have been deleted. Go back to your Quotes list."
      });
    }
    
    // Cooldown check - prevent rapid duplicate sends
    const cooldown = checkSendCooldown(req.userId, 'quote', req.params.id);
    if (cooldown.blocked) {
      return res.status(429).json({
        title: "Already Sent",
        message: `This quote was just sent. Please wait ${cooldown.remainingSeconds} seconds before sending again.`,
        fix: "Check your sent items — the quote may have already been delivered."
      });
    }
    
    // 3. Get client
    const client = await storage.getClient(quoteWithItems.clientId, req.userId);
    if (!client) {
      return res.status(404).json({
        title: "Client Not Found",
        message: "The client for this quote no longer exists.",
        fix: "Update the quote to select a different client."
      });
    }
    
    if (!client.email || !client.email.trim()) {
      return res.status(400).json({
        title: "Client Email Missing",
        message: `${client.name} doesn't have an email address.`,
        fix: `Go to Clients → ${client.name} → Edit and add their email.`
      });
    }
    
    // 4. Generate acceptance token if needed
    let acceptanceToken = quoteWithItems.acceptanceToken;
    if (!acceptanceToken) {
      acceptanceToken = await storage.generateQuoteAcceptanceToken(req.params.id, req.userId);
      quoteWithItems = await storage.getQuoteWithLineItems(req.params.id, req.userId);
    }
    
    // Generate public quote URL
    const baseUrl = getProductionBaseUrl(req);
    const quoteAcceptanceUrl = acceptanceToken ? `${baseUrl}/q/${acceptanceToken}` : null;
    
    // 6. Get linked job for site address
    let linkedJob = null;
    let jobSignatures: any[] = [];
    if (quoteWithItems.jobId) {
      linkedJob = await storage.getJob(quoteWithItems.jobId, req.userId);
      
      // Get job signatures for consistency with invoices
      const { db } = await import('./storage');
      const { digitalSignatures } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const signatures = await db.select().from(digitalSignatures).where(eq(digitalSignatures.jobId, quoteWithItems.jobId));
      jobSignatures = signatures.map(sig => ({
        id: sig.id,
        jobId: sig.jobId,
        signerName: sig.signerName,
        signatureData: sig.signatureData,
        signedAt: sig.signedAt,
      }));
    }
    
    // Check Stripe Connect status for payment capability
    const canAcceptPayments = businessSettings.stripeAccountId && businessSettings.stripeDetailsSubmitted;
    
    // Fetch before photos if requested
    let beforePhotos: Array<{ url: string; caption?: string; category: string }> | undefined;
    if (includeBeforePhotos && linkedJob) {
      const { getJobPhotos } = await import('./photoService');
      const allPhotos = await getJobPhotos(linkedJob.id, req.userId);
      beforePhotos = allPhotos
        .filter(p => p.category === 'before')
        .map(p => ({ url: p.signedUrl || '', caption: p.caption || undefined, category: p.category }));
    }
    
    // 7. Generate PDF buffer
    const businessForPdf = await resolveBusinessLogoForPdf(businessSettings);
    const pdfBuffer = await generatePDFBuffer(generateQuotePDF({
      quote: excludeNotes ? { ...quoteWithItems, notes: '' } : quoteWithItems,
      lineItems: quoteWithItems.lineItems || [],
      client,
      business: businessForPdf,
      signature: quoteWithItems.signature,
      canAcceptPayments,
      acceptanceUrl: quoteAcceptanceUrl || undefined,
      job: linkedJob,
      jobSignatures,
      beforePhotos,
    }));
    
    // 8. Upload PDF to cloud storage
    const quoteNumber = quoteWithItems.number || quoteWithItems.id.slice(0, 8);
    const { filename: pdfFilename } = await uploadPDFToStorage(
      pdfBuffer,
      'quote',
      quoteNumber,
      req.userId
    );
    
    // 9. Prepare email content
    const brandColor = businessSettings.brandColor || '#2563eb';
    const formattedTotal = new Intl.NumberFormat('en-AU', { 
      style: 'currency', 
      currency: 'AUD' 
    }).format(parseFloat(String(quoteWithItems.total || '0')));
    
    let subject = customSubject || `Quote ${quoteNumber} from ${businessSettings.businessName} - ${formattedTotal}`;
    let emailHtml: string;
    
    // Check for custom message from UI, or check for business template
    if (customMessage) {
      // Use custom message from UI (logo always present due to fallback above)
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, ${brandColor} 0%, ${brandColor}cc 100%); padding: 25px; border-radius: 8px 8px 0 0; text-align: center;">
            <div style="background: white; display: inline-block; padding: 12px 20px; border-radius: 8px; margin-bottom: 12px;">
              <img src="${businessSettings.logoUrl}" alt="${businessSettings.businessName || 'JobRunner'}" style="max-height: 48px; max-width: 160px; display: block;" />
            </div>
            <h1 style="color: white; margin: 0; font-size: 24px;">${businessSettings.businessName}</h1>
            ${businessSettings.abn ? `<p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 12px;">ABN: ${businessSettings.abn}</p>` : ''}
          </div>
          <div style="padding: 25px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
            <div style="white-space: pre-line;">${customMessage}</div>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${brandColor};">
              <p style="margin: 0; font-weight: bold;">Quote Total: ${formattedTotal}</p>
              ${quoteWithItems.gstIncluded ? `<p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">Includes GST</p>` : ''}
            </div>
            ${quoteAcceptanceUrl ? `
              <div style="text-align: center; margin: 24px 0; padding: 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; border: 1px solid #86efac;">
                <a href="${quoteAcceptanceUrl}" style="background-color: ${brandColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold;">View & Accept Quote</a>
                <p style="margin-top: 12px; color: #374151; font-size: 12px;">Or copy this link into your browser:</p>
                <p style="margin: 6px 0 0 0; word-break: break-all;"><a href="${quoteAcceptanceUrl}" style="color: ${brandColor}; font-size: 11px;">${quoteAcceptanceUrl}</a></p>
              </div>
            ` : ''}
            <p style="margin: 20px 0 0 0; font-size: 13px; color: #666;">Quote PDF attached for your records.</p>
            <p style="margin: 15px 0 0 0;">Cheers,<br>${businessSettings.businessName}</p>
          </div>
        </body>
        </html>
      `;
    } else {
      // Check for business template with quote_sent purpose
      const businessTemplate = await storage.getActiveBusinessTemplateByPurpose(req.userId, 'email', 'quote_sent');
      
      if (businessTemplate) {
        const mergeData = {
          client_name: client.name,
          business_name: businessSettings.businessName,
          quote_number: quoteNumber,
          quote_total: formattedTotal,
          job_title: quoteWithItems.title || '',
          job_address: linkedJob?.address || '',
          due_date: quoteWithItems.validUntil ? new Date(quoteWithItems.validUntil).toLocaleDateString('en-AU') : '',
          deposit_percent: businessSettings.depositPercent?.toString() || '50',
          acceptance_url: quoteAcceptanceUrl || '',
        };
        
        const templateContent = replaceMergeFields(businessTemplate.content, mergeData);
        if (businessTemplate.subject && !customSubject) {
          subject = replaceMergeFields(businessTemplate.subject, mergeData);
        }
        
        emailHtml = wrapTemplateInHtml(templateContent, subject, businessSettings, client, brandColor, quoteAcceptanceUrl, 'View & Accept Quote');
      } else {
        // Fall back to default template
        emailHtml = createQuoteEmailHtml(quoteWithItems, client, businessSettings, quoteAcceptanceUrl).html;
      }
    }
    
    // 10. Send email based on user preference
    // Helper to send via SendGrid (used for automatic mode or as fallback)
    const sendViaSendGrid = async () => {
      const { sendEmailWithAttachment } = await import('./emailService');
      await sendEmailWithAttachment({
        to: client.email,
        subject,
        html: emailHtml,
        fromName: businessSettings.businessName || 'JobRunner',
        replyTo: businessSettings.email,
        attachments: [{
          filename: pdfFilename,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
      });
      await storage.updateQuote(req.params.id, req.userId, { status: 'sent' });
    };
    
    const logQuoteEmailActivity = async (deliveryMethod: string) => {
      try {
        const quoteNum = quoteWithItems.number || quoteWithItems.id.slice(0, 8);
        const loggedSubject = customSubject || subject;
        const loggedBody = customMessage || `Quote ${quoteNum} sent to ${client.name}`;
        await storage.createActivityLog({
          userId: req.userId,
          type: 'quote_sent',
          title: `Quote #${quoteNum} sent`,
          description: `Sent to ${client.name}`,
          entityType: 'quote',
          entityId: quoteWithItems.id,
          metadata: {
            quoteNumber: quoteNum,
            quoteTitle: quoteWithItems.title,
            clientName: client.name,
            clientEmail: client.email,
            recipientEmail: client.email,
            total: quoteWithItems.total,
            deliveryMethod,
            emailSubject: loggedSubject,
            emailBody: loggedBody,
            source: req.headers['x-mobile-app'] === 'true' ? 'mobile' : 'web',
          }
        });
      } catch (activityError) {
        console.error('Failed to log quote email activity:', activityError);
      }
    };

    // Automatic mode sends directly via SendGrid
    if (emailSendingMode === 'automatic') {
      console.log('[Email] Sending quote via SendGrid (automatic mode)');
      
      await sendViaSendGrid();
      setSendCooldown(req.userId, 'quote', req.params.id);
      await logQuoteEmailActivity('email');
      
      res.json({
        success: true,
        sent: true,
        recipientEmail: client.email,
        message: `Quote emailed to ${client.email} with PDF attached.`
      });
    } else {
      // Manual mode - create Gmail draft, fallback to SendGrid if draft creation fails
      const draftResult = await createGmailDraftWithAttachment({
        to: client.email,
        subject,
        html: emailHtml,
        fromName: businessSettings.businessName,
        attachments: [{
          filename: pdfFilename,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
      });
      
      if (!draftResult.success) {
        // Gmail failed - fallback to SendGrid
        console.log('[Email] Gmail draft failed, falling back to SendGrid:', draftResult.error);
        await sendViaSendGrid();
        setSendCooldown(req.userId, 'quote', req.params.id);
        await logQuoteEmailActivity('email');
        
        return res.json({
          success: true,
          sent: true,
          usedFallback: true,
          recipientEmail: client.email,
          message: `Quote emailed to ${client.email} with PDF attached (sent via backup email service).`
        });
      }
      
      // Update quote status to sent (user created the draft, we assume they'll send it)
      await storage.updateQuote(req.params.id, req.userId, { status: 'sent' });
      setSendCooldown(req.userId, 'quote', req.params.id);
      await logQuoteEmailActivity('gmail');
      
      // Return success with draft URL for user to open Gmail
      res.json({
        success: true,
        draftId: draftResult.draftId,
        draftUrl: draftResult.draftUrl,
        pdfAttached: true,
        recipientEmail: client.email,
        message: `Gmail draft created with ${pdfFilename} attached. Click to open Gmail and send.`
      });
    }
    
  } catch (error: unknown) {
    console.error("Error creating quote email with PDF:", error);
    const friendlyError = getTradieFriendlyEmailError(getErrorMessage(error));
    res.status(500).json(friendlyError);
  }
};

// Create Gmail draft OR send directly via SendGrid based on user preference
export const handleInvoiceEmailWithPDF = async (req: any, res: any, storage: any) => {
  try {
    const { customSubject, customMessage, includeBeforePhotos, includeAfterPhotos } = req.body || {};
    
    // 1. Get business settings to check email sending preference
    let businessSettings = await storage.getBusinessSettings(req.userId);
    if (!businessSettings) {
      return res.status(404).json({
        title: "Business Setup Incomplete",
        message: "Your business details haven't been set up yet.",
        fix: "Go to Settings and complete your business profile."
      });
    }
    
    // Resolve logo URL for email (convert object storage path to public URL if needed)
    const baseUrlForLogo = getProductionBaseUrl(req);
    if (businessSettings.logoUrl && businessSettings.logoUrl.startsWith('/objects/')) {
      // Route is /objects/... not /api/objects/...
      businessSettings = { ...businessSettings, logoUrl: `${baseUrlForLogo}${businessSettings.logoUrl}` };
    }
    // Apply JobRunner logo fallback if no business logo
    if (!businessSettings.logoUrl) {
      businessSettings = { ...businessSettings, logoUrl: `${baseUrlForLogo}/logo.png` };
    }
    
    const emailSendingMode = businessSettings.emailSendingMode || 'manual';
    
    // Check Gmail connection status
    const gmailConnected = await isGmailConnected();
    
    // For manual mode, require Gmail connection - user wants to review draft before sending
    if (emailSendingMode === 'manual' && !gmailConnected) {
      return res.status(400).json({
        title: "Gmail Not Connected",
        message: "Gmail needs to be connected to review emails before sending.",
        fix: "Go to Settings → Email Integration and connect Gmail, or switch to 'Automatic' email mode to send directly without review."
      });
    }
    
    // 3. Get invoice with line items
    let invoiceWithItems = await storage.getInvoiceWithLineItems(req.params.id, req.userId);
    if (!invoiceWithItems) {
      return res.status(404).json({
        title: "Invoice Not Found",
        message: "We couldn't find this invoice.",
        fix: "The invoice may have been deleted. Go back to your Invoices list."
      });
    }
    
    // Cooldown check - prevent rapid duplicate sends
    const invoiceCooldown = checkSendCooldown(req.userId, 'invoice', req.params.id);
    if (invoiceCooldown.blocked) {
      return res.status(429).json({
        title: "Already Sent",
        message: `This invoice was just sent. Please wait ${invoiceCooldown.remainingSeconds} seconds before sending again.`,
        fix: "Check your sent items — the invoice may have already been delivered."
      });
    }
    
    // 4. Get client
    const client = await storage.getClient(invoiceWithItems.clientId, req.userId);
    if (!client) {
      return res.status(404).json({
        title: "Client Not Found",
        message: "The client for this invoice no longer exists.",
        fix: "Update the invoice to select a different client."
      });
    }
    
    if (!client.email || !client.email.trim()) {
      return res.status(400).json({
        title: "Client Email Missing",
        message: `${client.name} doesn't have an email address.`,
        fix: `Go to Clients → ${client.name} → Edit and add their email.`
      });
    }
    
    // 5. Generate payment token if needed
    let paymentToken = invoiceWithItems.paymentToken;
    if (!paymentToken) {
      paymentToken = await storage.generateInvoicePaymentToken(req.params.id, req.userId);
      invoiceWithItems = await storage.getInvoiceWithLineItems(req.params.id, req.userId);
    }
    
    // Generate public payment URL
    const baseUrl = getProductionBaseUrl(req);
    const paymentUrl = paymentToken ? `${baseUrl}/pay/${paymentToken}` : null;
    
    // 6. Get linked job for site address and time entries
    let linkedJob = null;
    let timeEntries: any[] = [];
    let jobSignatures: any[] = [];
    const { digitalSignatures } = await import("@shared/schema");
    const { db } = await import("./storage");
    const { eq } = await import("drizzle-orm");
    
    if (invoiceWithItems.jobId) {
      linkedJob = await storage.getJob(invoiceWithItems.jobId, req.userId);
      timeEntries = await storage.getTimeEntriesForJob(invoiceWithItems.jobId, req.userId);
      
      // Get job completion signatures
      const jobSigs = await db.select().from(digitalSignatures).where(eq(digitalSignatures.jobId, invoiceWithItems.jobId));
      jobSignatures = jobSigs.filter((s: any) => s.documentType === 'job_completion');
    }
    
    // Also get quote acceptance signatures if invoice is linked to a quote
    if (invoiceWithItems.quoteId) {
      const quoteSigs = await db.select().from(digitalSignatures).where(eq(digitalSignatures.quoteId, invoiceWithItems.quoteId));
      const quoteSignatures = quoteSigs.map((sig: any) => ({
        id: sig.id,
        quoteId: sig.quoteId,
        signerName: sig.signerName,
        signatureData: sig.signatureData,
        signedAt: sig.signedAt,
        documentType: 'quote_acceptance',
      }));
      jobSignatures = [...jobSignatures, ...quoteSignatures];
    }
    
    // Fetch photos if requested
    let beforePhotos: Array<{ url: string; caption?: string; category: string }> | undefined;
    let afterPhotos: Array<{ url: string; caption?: string; category: string }> | undefined;
    if (linkedJob && (includeBeforePhotos || includeAfterPhotos)) {
      const { getJobPhotos } = await import('./photoService');
      const allPhotos = await getJobPhotos(linkedJob.id, req.userId);
      if (includeBeforePhotos) {
        beforePhotos = allPhotos
          .filter(p => p.category === 'before')
          .map(p => ({ url: p.signedUrl || '', caption: p.caption || undefined, category: p.category }));
      }
      if (includeAfterPhotos) {
        afterPhotos = allPhotos
          .filter(p => p.category === 'after')
          .map(p => ({ url: p.signedUrl || '', caption: p.caption || undefined, category: p.category }));
      }
    }
    
    // 7. Generate PDF buffer
    const businessForPdf = await resolveBusinessLogoForPdf(businessSettings);
    const pdfBuffer = await generatePDFBuffer(generateInvoicePDF({
      invoice: invoiceWithItems,
      lineItems: invoiceWithItems.lineItems || [],
      client,
      business: businessForPdf,
      job: linkedJob,
      timeEntries,
      paymentUrl: paymentUrl || undefined,
      jobSignatures,
      beforePhotos,
      afterPhotos,
    }));
    
    // 8. Upload PDF to cloud storage
    const invoiceNumber = invoiceWithItems.number || invoiceWithItems.id.slice(0, 8);
    const { filename: pdfFilename } = await uploadPDFToStorage(
      pdfBuffer,
      'invoice',
      invoiceNumber,
      req.userId
    );
    
    // 9. Prepare email content
    const brandColor = businessSettings.brandColor || '#2563eb';
    const formattedTotal = new Intl.NumberFormat('en-AU', { 
      style: 'currency', 
      currency: 'AUD' 
    }).format(parseFloat(String(invoiceWithItems.total || '0')));
    
    // "TAX INVOICE" label for GST-registered businesses
    const isTaxInvoice = businessSettings.gstRegistered && parseFloat(String(invoiceWithItems.total || '0')) > 82.50;
    const invoiceLabel = isTaxInvoice ? 'Tax Invoice' : 'Invoice';
    
    let subject = customSubject || `${invoiceLabel} ${invoiceNumber} from ${businessSettings.businessName} - ${formattedTotal}`;
    let emailHtml: string;
    
    // Check for custom message from UI, or check for business template
    if (customMessage) {
      // Use custom message from UI (logo always present due to fallback above)
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, ${brandColor} 0%, ${brandColor}cc 100%); padding: 25px; border-radius: 8px 8px 0 0; text-align: center;">
            <div style="background: white; display: inline-block; padding: 12px 20px; border-radius: 8px; margin-bottom: 12px;">
              <img src="${businessSettings.logoUrl}" alt="${businessSettings.businessName || 'JobRunner'}" style="max-height: 48px; max-width: 160px; display: block;" />
            </div>
            <h1 style="color: white; margin: 0; font-size: 24px;">${businessSettings.businessName}</h1>
            ${businessSettings.abn ? `<p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 12px;">ABN: ${businessSettings.abn}</p>` : ''}
          </div>
          <div style="padding: 25px; background: #f9f9f9; border-radius: 0 0 8px 8px;">
            <div style="white-space: pre-line;">${customMessage}</div>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${brandColor};">
              <p style="margin: 0; font-weight: bold;">${invoiceLabel} Total: ${formattedTotal}</p>
              ${invoiceWithItems.gstIncluded ? `<p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">Includes GST (10%)</p>` : ''}
            </div>
            ${paymentUrl ? `
              <div style="text-align: center; margin: 24px 0; padding: 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; border: 1px solid #86efac;">
                <a href="${paymentUrl}" style="background-color: ${brandColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold;">Pay Now</a>
                <p style="margin-top: 12px; color: #374151; font-size: 12px;">Or copy this link into your browser:</p>
                <p style="margin: 6px 0 0 0; word-break: break-all;"><a href="${paymentUrl}" style="color: ${brandColor}; font-size: 11px;">${paymentUrl}</a></p>
              </div>
            ` : ''}
            <p style="margin: 20px 0 0 0; font-size: 13px; color: #666;">${invoiceLabel} PDF attached for your records.</p>
            <p style="margin: 15px 0 0 0;">Cheers,<br>${businessSettings.businessName}</p>
          </div>
        </body>
        </html>
      `;
    } else {
      // Check for business template with invoice_sent purpose
      const businessTemplate = await storage.getActiveBusinessTemplateByPurpose(req.userId, 'email', 'invoice_sent');
      
      if (businessTemplate) {
        const mergeData = {
          client_name: client.name,
          business_name: businessSettings.businessName,
          invoice_number: invoiceNumber,
          invoice_total: formattedTotal,
          job_title: invoiceWithItems.title || '',
          job_address: linkedJob?.address || '',
          due_date: invoiceWithItems.dueDate ? new Date(invoiceWithItems.dueDate).toLocaleDateString('en-AU') : '',
          payment_url: paymentUrl || '',
        };
        
        const templateContent = replaceMergeFields(businessTemplate.content, mergeData);
        if (businessTemplate.subject && !customSubject) {
          subject = replaceMergeFields(businessTemplate.subject, mergeData);
        }
        
        emailHtml = wrapTemplateInHtml(templateContent, subject, businessSettings, client, brandColor, paymentUrl, 'Pay Now');
      } else {
        // Fall back to default template
        emailHtml = createInvoiceEmailHtml(invoiceWithItems, client, businessSettings, paymentUrl).html;
      }
    }
    
    // 10. Send email based on user preference
    // Helper to send via SendGrid (used for automatic mode or as fallback)
    const sendViaSendGrid = async () => {
      const { sendEmailWithAttachment } = await import('./emailService');
      await sendEmailWithAttachment({
        to: client.email,
        subject,
        html: emailHtml,
        fromName: businessSettings.businessName || 'JobRunner',
        replyTo: businessSettings.email,
        attachments: [{
          filename: pdfFilename,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
      });
      await storage.updateInvoice(req.params.id, req.userId, { status: 'sent' });
    };

    const logInvoiceEmailActivity = async (deliveryMethod: string) => {
      try {
        const invoiceNum = invoiceWithItems.number || invoiceWithItems.id.slice(0, 8);
        const loggedSubject = customSubject || subject;
        const loggedBody = customMessage || `Invoice ${invoiceNum} sent to ${client.name}`;
        const amount = invoiceWithItems.total;
        await storage.createActivityLog({
          userId: req.userId,
          type: 'invoice_sent',
          title: `Invoice #${invoiceNum} sent`,
          description: `Sent to ${client.name}`,
          entityType: 'invoice',
          entityId: invoiceWithItems.id,
          metadata: {
            invoiceNumber: invoiceNum,
            invoiceTitle: invoiceWithItems.title,
            clientName: client.name,
            clientEmail: client.email,
            recipientEmail: client.email,
            total: amount,
            deliveryMethod,
            emailSubject: loggedSubject,
            emailBody: loggedBody,
            source: req.headers['x-mobile-app'] === 'true' ? 'mobile' : 'web',
          }
        });
      } catch (activityError) {
        console.error('Failed to log invoice email activity:', activityError);
      }
    };
    
    // Automatic mode sends directly via SendGrid
    if (emailSendingMode === 'automatic') {
      console.log('[Email] Sending invoice via SendGrid (automatic mode)');
      
      await sendViaSendGrid();
      setSendCooldown(req.userId, 'invoice', req.params.id);
      await logInvoiceEmailActivity('email');
      
      res.json({
        success: true,
        sent: true,
        recipientEmail: client.email,
        message: `Invoice emailed to ${client.email} with PDF attached.`
      });
    } else {
      // Manual mode - create Gmail draft, fallback to SendGrid if draft creation fails
      const draftResult = await createGmailDraftWithAttachment({
        to: client.email,
        subject,
        html: emailHtml,
        fromName: businessSettings.businessName,
        attachments: [{
          filename: pdfFilename,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
      });
      
      if (!draftResult.success) {
        // Gmail failed - fallback to SendGrid
        console.log('[Email] Gmail draft failed for invoice, falling back to SendGrid:', draftResult.error);
        await sendViaSendGrid();
        setSendCooldown(req.userId, 'invoice', req.params.id);
        await logInvoiceEmailActivity('email');
        
        return res.json({
          success: true,
          sent: true,
          usedFallback: true,
          recipientEmail: client.email,
          message: `Invoice emailed to ${client.email} with PDF attached (sent via backup email service).`
        });
      }
      
      // Update invoice status to sent (user created the draft, we assume they'll send it)
      await storage.updateInvoice(req.params.id, req.userId, { status: 'sent' });
      setSendCooldown(req.userId, 'invoice', req.params.id);
      await logInvoiceEmailActivity('gmail');
      
      // Return success with draft URL for user to open Gmail
      res.json({
        success: true,
        draftId: draftResult.draftId,
        draftUrl: draftResult.draftUrl,
        pdfAttached: true,
        recipientEmail: client.email,
        message: `Gmail draft created with ${pdfFilename} attached. Click to open Gmail and send.`
      });
    }
    
  } catch (error: unknown) {
    console.error("Error creating invoice email with PDF:", error);
    const friendlyError = getTradieFriendlyEmailError(getErrorMessage(error));
    res.status(500).json(friendlyError);
  }
};

// Send payment link email to customer for an existing invoice
export const handleSendPaymentLink = async (req: any, res: any, storage: any) => {
  try {
    const invoiceId = req.params.id;
    const userId = req.userId;
    
    // 1. Get invoice
    const invoice = await storage.getInvoice(invoiceId, userId);
    if (!invoice) {
      return res.status(404).json({ 
        title: "Invoice Not Found",
        message: "We couldn't find this invoice.",
        fix: "The invoice may have been deleted. Go back to your Invoices list and try again."
      });
    }
    
    // 2. Check if online payment is enabled
    if (!invoice.allowOnlinePayment || !invoice.paymentToken) {
      return res.status(400).json({ 
        title: "Online Payment Not Enabled",
        message: "Online payment isn't enabled for this invoice.",
        fix: "Enable 'Allow Online Payment' toggle first, then try sending the payment link."
      });
    }
    
    // 3. Get client
    const client = await storage.getClient(invoice.clientId, userId);
    if (!client) {
      return res.status(404).json({ 
        title: "Client Not Found",
        message: "The client for this invoice no longer exists.",
        fix: "Update the invoice to select a different client."
      });
    }
    
    // 4. Validate client email
    if (!client.email || !client.email.trim()) {
      return res.status(400).json({ 
        title: "Client Email Missing",
        message: `${client.name} doesn't have an email address.`,
        fix: `Go to Clients → ${client.name} → Edit and add their email address.`
      });
    }
    
    // 5. Get business settings
    const businessSettings = await storage.getBusinessSettings(userId);
    if (!businessSettings) {
      return res.status(404).json({ 
        title: "Business Setup Incomplete",
        message: "Your business details haven't been set up yet.",
        fix: "Go to Settings and complete your business profile."
      });
    }
    
    // 6. Generate payment URL
    const paymentUrl = `${getProductionBaseUrl(req)}/pay/${invoice.paymentToken}`;
    
    // 7. Build email content
    const brandColor = businessSettings.brandColor || '#16a34a';
    const formattedTotal = new Intl.NumberFormat('en-AU', { 
      style: 'currency', 
      currency: 'AUD' 
    }).format(parseFloat(String(invoice.total || '0')));
    const isGstRegistered = businessSettings.gstEnabled && businessSettings.abn;
    const documentType = isGstRegistered ? 'Tax Invoice' : 'Invoice';
    
    const subject = `Payment Link for ${documentType} #${invoice.number || invoice.id} from ${businessSettings.businessName}`;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, ${brandColor} 0%, ${brandColor}cc 100%); padding: 25px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">${businessSettings.businessName}</h1>
          ${businessSettings.abn ? `<p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 12px;">ABN: ${businessSettings.abn}</p>` : ''}
        </div>
        
        <div style="background: #f8f9fa; padding: 25px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="margin: 0 0 16px 0;">G'day ${client.name},</p>
          
          <p style="margin: 0 0 16px 0;">Here's a quick link to pay your invoice online. It only takes a minute!</p>
          
          <div style="background: white; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
            <p style="margin: 0 0 8px 0; color: #666; font-size: 13px;">${documentType} Details:</p>
            <p style="margin: 0 0 4px 0; font-weight: 600;">${invoice.title || `Invoice #${invoice.number}`}</p>
            <p style="margin: 0; font-size: 24px; color: ${brandColor}; font-weight: 700;">${formattedTotal}</p>
            ${invoice.dueDate ? `<p style="margin: 8px 0 0 0; color: #666; font-size: 13px;">Due: ${new Date(invoice.dueDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>` : ''}
          </div>
          
          <div style="text-align: center; margin: 24px 0;">
            <a href="${paymentUrl}" style="background-color: ${brandColor}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">Pay Now Securely</a>
          </div>
          
          <p style="text-align: center; color: #666; font-size: 13px; margin: 0 0 16px 0;">Secure payment powered by Stripe.</p>
          
          <p style="margin: 16px 0 0 0;">Cheers,<br>${businessSettings.businessName}</p>
          
          ${businessSettings.phone ? `<p style="margin: 8px 0 0 0; color: #666; font-size: 13px;">Phone: ${businessSettings.phone}</p>` : ''}
          ${businessSettings.email ? `<p style="margin: 4px 0 0 0; color: #666; font-size: 13px;">Email: ${businessSettings.email}</p>` : ''}
        </div>
      </body>
      </html>
    `;
    
    // 8. Send email
    const emailResult = await sendEmailViaIntegration({
      to: client.email,
      subject,
      html: emailHtml,
      userId,
      type: 'payment_link',
      relatedId: invoice.id,
      fromName: businessSettings.businessName,
    });
    
    if (!emailResult.success) {
      const friendlyError = getTradieFriendlyEmailError(emailResult.error || 'Email send failed');
      return res.status(500).json(friendlyError);
    }
    
    // 9. Log activity
    try {
      await storage.addActivityLog(userId, {
        action: 'payment_link_sent',
        title: `Payment link sent for Invoice #${invoice.number}`,
        description: `Payment link emailed to ${client.name} (${client.email})`,
        entityType: 'invoice',
        entityId: invoice.id,
        metadata: { invoiceNumber: invoice.number, clientName: client.name, clientEmail: client.email, total: invoice.total }
      });
    } catch (activityError) {
      console.error('Failed to log payment link sent activity:', activityError);
    }
    
    res.json({ 
      success: true,
      message: `Payment link sent to ${client.email}`,
      paymentUrl
    });
    
  } catch (error: unknown) {
    console.error("Error sending payment link:", error);
    const friendlyError = getTradieFriendlyEmailError(getErrorMessage(error) || 'Unknown error');
    res.status(500).json(friendlyError);
  }
};