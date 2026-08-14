/**
 * Shared notification helper: notify the client when a variation is sent for their approval.
 * Called from both the PATCH /api/jobs/:jobId/variations/:variationId handler (jobs.ts)
 * and the legacy POST /api/variations/:variationId/send handler (legacyRoutes.ts).
 *
 * Fire-and-forget: always call without awaiting so notification failures cannot
 * block the API response.
 */

import { storage } from './storage';
import { sendSMS } from './twilioClient';
import { sendSystemEmail } from './emailService';

function escapeHtml(str: string | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function notifyClientVariationSent(opts: {
  /** Persisted variation (post-update) so content is never stale */
  variation: {
    id: string;
    jobId: string;
    number?: string | null;
    title?: string | null;
    description?: string | null;
    totalAmount?: string | number | null;
  };
  effectiveUserId: string;
}): Promise<void> {
  const { variation, effectiveUserId } = opts;

  try {
    const job = await storage.getJob(variation.jobId, effectiveUserId);
    if (!job || !job.clientId) return;

    const client = await storage.getClient(job.clientId, effectiveUserId);
    if (!client) return;

    const business = await storage.getBusinessSettings(effectiveUserId);
    const businessName = (business as any)?.businessName || 'Your contractor';
    const brandColor = (business as any)?.brandColor || '#2563EB';

    const variationNumber = variation.number || '';
    const variationTitle = variation.title || 'Variation';
    const description = variation.description || '';
    const totalAmount = variation.totalAmount ?? '0';
    const amountFormatted = `$${parseFloat(String(totalAmount)).toLocaleString('en-AU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    let notified = false;

    // 1. Try SMS first
    if (client.phone) {
      try {
        const smsMessage =
          `${businessName}: A variation (${variationNumber}) has been submitted for your approval.\n\n` +
          `Scope: ${variationTitle}\nAmount: ${amountFormatted} (incl. GST)\n\n` +
          `Please contact us to approve or query this variation before work proceeds.`;

        const smsResult = await sendSMS({ to: client.phone, message: smsMessage });
        if (smsResult.success) {
          notified = true;
          await storage.createActivityLog({
            userId: effectiveUserId,
            type: 'sms_sent',
            title: 'Variation SMS Sent',
            entityType: 'job',
            entityId: variation.jobId,
            description: `Variation ${variationNumber} SMS sent to client ${client.name || client.phone}`,
          });
          console.log(`[Variation] SMS sent to client ${client.phone} for variation ${variationNumber}`);
        } else if (!smsResult.notConfigured) {
          console.warn(`[Variation] SMS failed for ${variationNumber}: ${smsResult.error}`);
        }
      } catch (smsErr) {
        console.error('[Variation] SMS send error:', smsErr);
      }
    }

    // 2. Fall back to email if SMS was not sent
    if (!notified && client.email) {
      try {
        const descHtml = description
          ? `<p style="margin:12px 0 0 0;color:#475569;font-size:14px;">${escapeHtml(description)}</p>`
          : '';

        const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Variation for Approval</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f1f5f9;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="height:4px;line-height:4px;font-size:0;background-color:${brandColor};">&nbsp;</td></tr>
        <tr><td style="padding:32px 32px 0 32px;">
          <p style="margin:0;color:#0f172a;font-size:19px;font-weight:700;">${escapeHtml(businessName)}</p>
          <p style="margin:4px 0 0 0;color:#64748b;font-size:13px;">Variation Notice — ${escapeHtml(variationNumber)}</p>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <p style="margin:0;color:#1e293b;font-size:15px;">Hi ${escapeHtml(client.name || 'there')},</p>
          <p style="margin:12px 0 0 0;color:#475569;font-size:14px;">A variation has been submitted for your approval before additional work proceeds.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Variation</p>
              <p style="margin:4px 0 0 0;color:#0f172a;font-size:16px;font-weight:700;">${escapeHtml(variationNumber)} — ${escapeHtml(variationTitle)}</p>
              ${descHtml}
              <p style="margin:16px 0 0 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Total Amount (incl. GST)</p>
              <p style="margin:4px 0 0 0;color:${brandColor};font-size:22px;font-weight:800;">${amountFormatted}</p>
            </td></tr>
          </table>
          <p style="margin:0;color:#475569;font-size:14px;">Please contact us to approve or raise any queries before work proceeds.</p>
          <p style="margin:24px 0 0 0;color:#475569;font-size:14px;">Kind regards,<br><strong style="color:#1e293b;">${escapeHtml(businessName)}</strong></p>
        </td></tr>
        <tr><td style="padding:16px 32px 32px;border-top:1px solid #f1f5f9;">
          <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center;">Sent with <strong>JobRunner</strong> &mdash; built for Australian tradies</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        await sendSystemEmail({
          to: client.email,
          from: { email: 'noreply@jobrunner.com.au', name: businessName },
          subject: `Variation ${variationNumber} submitted for your approval — ${escapeHtml(businessName)}`,
          html: emailHtml,
          _meta: {
            userId: effectiveUserId,
            type: 'variation_sent',
            relatedId: variation.id,
          },
        });

        await storage.createActivityLog({
          userId: effectiveUserId,
          type: 'email_sent',
          title: 'Variation Email Sent',
          entityType: 'job',
          entityId: variation.jobId,
          description: `Variation ${variationNumber} email sent to client ${client.name || client.email}`,
        });
        console.log(`[Variation] Email sent to client ${client.email} for variation ${variationNumber}`);
      } catch (emailErr) {
        console.error('[Variation] Email send error:', emailErr);
      }
    }

    if (!client.phone && !client.email) {
      console.warn(
        `[Variation] Client ${client.id} has no phone or email — cannot notify for variation ${variationNumber}`,
      );
    }
  } catch (err) {
    console.error('[Variation] Client notification failed (non-fatal):', err);
  }
}
