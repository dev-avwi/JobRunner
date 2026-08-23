/**
 * Client Approval Service
 *
 * Generates and verifies short-lived HMAC-signed approval tokens for
 * documents (variations, claims) sent to clients for approval.
 *
 * Token format (URL-safe base64): {payload}.{signature}
 *   payload  = base64url(JSON({ vid, uid, exp, doc }))
 *   signature = HMAC-SHA256(payload, ENCRYPTION_SECRET), base64url
 *
 * Tokens expire in 90 days (generous for client timelines in construction).
 */

import crypto from 'crypto';
import { getErrorMessage } from './lib/errors';
import { storage } from './storage';
import { logTeamActivity } from './activityService';
import { notifyClientDocumentApproved, notifyClientDocumentDeclined } from './pushNotifications';

const TOKEN_TTL_DAYS = 90;

function getSecret(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error('ENCRYPTION_SECRET not configured');
  return Buffer.from(secret, 'utf8');
}

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf8');
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export interface ApprovalTokenPayload {
  /** document id (variationId, claimId, etc.) */
  vid: string;
  /** business owner userId */
  uid: string;
  /** expiry epoch seconds */
  exp: number;
  /** document type: 'variation' | 'claim' */
  doc: 'variation' | 'claim';
}

export function generateApprovalToken(payload: Omit<ApprovalTokenPayload, 'exp'>): string {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_DAYS * 24 * 3600;
  const full: ApprovalTokenPayload = { ...payload, exp };
  const payloadB64 = b64url(JSON.stringify(full));
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest();
  return `${payloadB64}.${b64url(sig)}`;
}

export function verifyApprovalToken(token: string): ApprovalTokenPayload | null {
  try {
    const dotIdx = token.lastIndexOf('.');
    if (dotIdx === -1) return null;
    const payloadB64 = token.slice(0, dotIdx);
    const sigB64 = token.slice(dotIdx + 1);

    // Constant-time HMAC verification
    const expectedSig = crypto
      .createHmac('sha256', getSecret())
      .update(payloadB64)
      .digest();
    const receivedSig = fromB64url(sigB64);
    if (expectedSig.length !== receivedSig.length) return null;
    if (!crypto.timingSafeEqual(expectedSig, receivedSig)) return null;

    const payload: ApprovalTokenPayload = JSON.parse(fromB64url(payloadB64).toString('utf8'));
    if (Math.floor(Date.now() / 1000) > payload.exp) {
      console.warn('[ApprovalToken] Token expired for document:', payload.vid);
      return null;
    }
    return payload;
  } catch (err) {
    console.warn('[ApprovalToken] Verification failed:', getErrorMessage(err));
    return null;
  }
}

// ─── HTML confirmation page builder ───────────────────────────────────────────

function buildConfirmationPage(opts: {
  title: string;
  heading: string;
  bodyHtml: string;
  /** The form action URL (same-origin POST to this path) */
  postAction: string;
  /** Hidden + visible fields for the POST form */
  formFields: Array<{ name: string; label?: string; type?: string; placeholder?: string; required?: boolean }>;
  primaryLabel: string;
  primaryColor: string;
  isDanger?: boolean;
}): string {
  const btnBg = opts.isDanger ? '#dc2626' : opts.primaryColor;
  const fieldsHtml = opts.formFields
    .map(f =>
      f.type === 'hidden'
        ? `<input type="hidden" name="${f.name}" value="">`
        : `<div style="margin-bottom:16px;">
            <label style="display:block;margin-bottom:6px;font-size:14px;font-weight:600;color:#374151;">${f.label ?? f.name}${f.required ? ' <span style="color:#dc2626">*</span>' : ''}</label>
            <input name="${f.name}" type="${f.type ?? 'text'}" placeholder="${f.placeholder ?? ''}" ${f.required ? 'required' : ''}
              style="width:100%;box-sizing:border-box;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:15px;outline:none;">
          </div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.title}</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;}
    .card{background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:40px 36px;max-width:480px;width:100%;margin:24px;}
    h1{margin:0 0 8px;font-size:22px;color:#0f172a;}
    .sub{color:#64748b;font-size:14px;margin:0 0 28px;}
    .btn{display:block;width:100%;padding:14px;border:none;border-radius:8px;font-size:16px;font-weight:700;cursor:pointer;margin-top:8px;}
    .btn-primary{background:${btnBg};color:#fff;}
    .btn-primary:hover{opacity:0.9;}
    .loading{display:none;}
    form:not(.submitted) .loading{display:none;}
  </style>
</head>
<body>
  <div class="card">
    <h1>${opts.heading}</h1>
    <div class="sub">${opts.bodyHtml}</div>
    <form method="POST" action="${opts.postAction}" onsubmit="this.classList.add('submitted');this.querySelector('.btn-primary').disabled=true;this.querySelector('.btn-primary').textContent='Processing…';">
      ${fieldsHtml}
      <button type="submit" class="btn btn-primary">${opts.primaryLabel}</button>
    </form>
  </div>
</body>
</html>`;
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── GET confirmation pages (linked from email buttons) ─────────────────────

/**
 * GET /api/public/variation/:token/approve
 * Renders an HTML confirmation page. The actual mutation is done via POST to the same URL.
 */
export async function handleVariationApproveConfirmPage(req: any, res: any): Promise<void> {
  try {
    const { token } = req.params;
    const payload = verifyApprovalToken(token);
    if (!payload || payload.doc !== 'variation') {
      res.status(400).send('<h2>This approval link is invalid or has expired.</h2>');
      return;
    }

    const variation = await storage.getJobVariation(payload.vid, payload.uid);
    if (!variation) {
      res.status(404).send('<h2>Variation not found.</h2>');
      return;
    }

    if (variation.status === 'approved') {
      res.status(200).send(`<html><body style="font-family:sans-serif;padding:40px;text-align:center"><h2 style="color:#16a34a">&#10003; This variation has already been approved.</h2></body></html>`);
      return;
    }

    const businessSettings = await storage.getBusinessSettings(payload.uid).catch(() => null);
    const brandColor = (businessSettings as any)?.brandColor ?? '#6366f1';
    const businessName = escapeHtmlAttr((businessSettings as any)?.businessName ?? 'Your contractor');

    const amountFmt = `$${parseFloat(variation.totalAmount ?? '0').toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
    const bodyHtml = `<strong>${businessName}</strong> is requesting your approval for:<br><br>
      <b>Variation ${escapeHtmlAttr(variation.number)} — ${escapeHtmlAttr(variation.title)}</b><br>
      ${variation.description ? `<span style="color:#64748b">${escapeHtmlAttr(variation.description)}</span><br>` : ''}
      <br>Total (incl. GST): <b style="color:${brandColor}">${amountFmt}</b>`;

    res.status(200).send(buildConfirmationPage({
      title: 'Approve Variation',
      heading: 'Approve this variation?',
      bodyHtml,
      postAction: `/api/public/variation/${encodeURIComponent(token)}/approve`,
      formFields: [
        { name: 'approvedByName', label: 'Your name', type: 'text', placeholder: 'e.g. Jane Smith', required: true },
      ],
      primaryLabel: 'Confirm Approval',
      primaryColor: brandColor,
    }));
  } catch (err) {
    console.error('[VariationApproveConfirmPage] Error:', getErrorMessage(err));
    res.status(500).send('<h2>An error occurred. Please try again.</h2>');
  }
}

/**
 * GET /api/public/variation/:token/decline
 * Renders an HTML confirmation page. The actual mutation is done via POST to the same URL.
 */
export async function handleVariationDeclineConfirmPage(req: any, res: any): Promise<void> {
  try {
    const { token } = req.params;
    const payload = verifyApprovalToken(token);
    if (!payload || payload.doc !== 'variation') {
      res.status(400).send('<h2>This decline link is invalid or has expired.</h2>');
      return;
    }

    const variation = await storage.getJobVariation(payload.vid, payload.uid);
    if (!variation) {
      res.status(404).send('<h2>Variation not found.</h2>');
      return;
    }

    if (variation.status === 'rejected') {
      res.status(200).send(`<html><body style="font-family:sans-serif;padding:40px;text-align:center"><h2 style="color:#dc2626">This variation has already been declined.</h2></body></html>`);
      return;
    }

    const businessSettings = await storage.getBusinessSettings(payload.uid).catch(() => null);
    const brandColor = (businessSettings as any)?.brandColor ?? '#6366f1';
    const businessName = escapeHtmlAttr((businessSettings as any)?.businessName ?? 'Your contractor');

    const amountFmt = `$${parseFloat(variation.totalAmount ?? '0').toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
    const bodyHtml = `You are declining the variation from <strong>${businessName}</strong>:<br><br>
      <b>Variation ${escapeHtmlAttr(variation.number)} — ${escapeHtmlAttr(variation.title)}</b><br>
      Total (incl. GST): <b>${amountFmt}</b>`;

    res.status(200).send(buildConfirmationPage({
      title: 'Decline Variation',
      heading: 'Decline this variation?',
      bodyHtml,
      postAction: `/api/public/variation/${encodeURIComponent(token)}/decline`,
      formFields: [
        { name: 'declinedByName', label: 'Your name', type: 'text', placeholder: 'e.g. Jane Smith', required: true },
        { name: 'reason', label: 'Reason (optional)', type: 'text', placeholder: 'e.g. Price too high' },
      ],
      primaryLabel: 'Confirm Decline',
      primaryColor: brandColor,
      isDanger: true,
    }));
  } catch (err) {
    console.error('[VariationDeclineConfirmPage] Error:', getErrorMessage(err));
    res.status(500).send('<h2>An error occurred. Please try again.</h2>');
  }
}

// ─── POST handlers: redirect to confirmation page on success ──────────────────

/**
 * After successful approval/decline POST, redirect to a simple success page
 * instead of returning JSON (since the client opened this in a browser tab).
 */
function sendApprovalSuccessPage(res: any, heading: string, detail: string): void {
  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${heading}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:40px 36px;max-width:440px;width:100%;margin:24px;text-align:center;">
    <div style="font-size:48px;margin-bottom:16px;">&#10003;</div>
    <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">${heading}</h1>
    <p style="margin:0;color:#64748b;font-size:14px;">${detail}</p>
  </div>
</body>
</html>`);
}

// ─── Variation approval handlers ───────────────────────────────────────────────

export async function handleVariationApprove(req: any, res: any): Promise<void> {
  try {
    const { token } = req.params;
    const { approvedByName, note } = req.body ?? {};

    const payload = verifyApprovalToken(token);
    if (!payload || payload.doc !== 'variation') {
      res.status(400).json({ error: 'Invalid or expired approval link.' });
      return;
    }

    const variation = await storage.getJobVariation(payload.vid, payload.uid);
    if (!variation) {
      res.status(404).json({ error: 'Variation not found.' });
      return;
    }

    if (variation.status === 'approved') {
      res.json({ status: 'already_approved', message: 'This variation has already been approved.' });
      return;
    }

    if (variation.status === 'rejected') {
      res.status(409).json({ error: 'This variation was already declined.' });
      return;
    }

    const clientName = (approvedByName ?? '').trim() || 'Client';

    // Update variation to approved
    const updated = await storage.updateJobVariation(payload.vid, payload.uid, {
      status: 'approved',
      approvedAt: new Date(),
      approvedByName: clientName,
      approvalMethod: 'client_portal',
      approvalContact: req.ip ?? null,
    } as any);

    // Activity log
    await storage.createActivityLog({
      userId: payload.uid,
      type: 'document_approved',
      title: `Variation ${variation.number} approved by client`,
      description: `${clientName} approved variation ${variation.number} via the client portal`,
      entityType: 'job',
      entityId: variation.jobId,
      metadata: { variationId: payload.vid, approvedByName: clientName, method: 'client_portal' },
    });

    await logTeamActivity({
      businessOwnerId: payload.uid,
      activityType: 'document_approved',
      entityType: 'job',
      entityId: variation.jobId,
      entityTitle: `Variation ${variation.number}`,
      description: `${clientName} approved variation ${variation.number} via the approval link`,
      metadata: { variationId: payload.vid, approvedByName: clientName },
      isImportant: true,
    });

    // Push notification to job owner
    await notifyClientDocumentApproved(payload.uid, clientName, `Variation ${variation.number}`, variation.jobId);

    // If this came from a browser form (Accept header includes text/html), serve a success page
    const acceptsHtml = ((req.headers?.accept ?? '') as string).includes('text/html');
    if (acceptsHtml) {
      sendApprovalSuccessPage(res, 'Variation Approved', `Thank you, ${clientName}. Your approval has been recorded.`);
    } else {
      res.json({
        status: 'approved',
        message: 'Variation approved successfully.',
        variationNumber: variation.number,
        approvedByName: clientName,
        approvedAt: updated?.approvedAt ?? new Date(),
      });
    }
  } catch (err) {
    console.error('[VariationApprove] Error:', getErrorMessage(err));
    const acceptsHtml = ((req.headers?.accept ?? '') as string).includes('text/html');
    if (acceptsHtml) {
      res.status(500).send('<h2>Failed to record approval. Please try again.</h2>');
    } else {
      res.status(500).json({ error: 'Failed to record approval.' });
    }
  }
}

export async function handleVariationDecline(req: any, res: any): Promise<void> {
  try {
    const { token } = req.params;
    const { reason, declinedByName } = req.body ?? {};

    const payload = verifyApprovalToken(token);
    if (!payload || payload.doc !== 'variation') {
      res.status(400).json({ error: 'Invalid or expired decline link.' });
      return;
    }

    const variation = await storage.getJobVariation(payload.vid, payload.uid);
    if (!variation) {
      res.status(404).json({ error: 'Variation not found.' });
      return;
    }

    if (variation.status === 'rejected') {
      res.json({ status: 'already_declined', message: 'This variation has already been declined.' });
      return;
    }

    if (variation.status === 'approved') {
      res.status(409).json({ error: 'This variation was already approved.' });
      return;
    }

    const clientName = (declinedByName ?? '').trim() || 'Client';
    const declineReason = (reason ?? '').trim() || null;

    await storage.updateJobVariation(payload.vid, payload.uid, {
      status: 'rejected',
      rejectedAt: new Date(),
      rejectionReason: declineReason ?? 'Declined via client portal',
    } as any);

    await storage.createActivityLog({
      userId: payload.uid,
      type: 'document_declined',
      title: `Variation ${variation.number} declined by client`,
      description: `${clientName} declined variation ${variation.number}${declineReason ? `: ${declineReason}` : ''}`,
      entityType: 'job',
      entityId: variation.jobId,
      metadata: { variationId: payload.vid, declinedByName: clientName, reason: declineReason },
    });

    await logTeamActivity({
      businessOwnerId: payload.uid,
      activityType: 'document_declined',
      entityType: 'job',
      entityId: variation.jobId,
      entityTitle: `Variation ${variation.number}`,
      description: `${clientName} declined variation ${variation.number}${declineReason ? ` — reason: ${declineReason}` : ''}`,
      metadata: { variationId: payload.vid, declinedByName: clientName, reason: declineReason },
      isImportant: true,
    });

    await notifyClientDocumentDeclined(payload.uid, clientName, `Variation ${variation.number}`, variation.jobId, declineReason ?? undefined);

    const acceptsHtml = ((req.headers?.accept ?? '') as string).includes('text/html');
    if (acceptsHtml) {
      sendApprovalSuccessPage(res, 'Variation Declined', `Thank you, ${clientName}. Your response has been recorded.`);
    } else {
      res.json({
        status: 'declined',
        message: 'Variation declined.',
        variationNumber: variation.number,
      });
    }
  } catch (err) {
    console.error('[VariationDecline] Error:', getErrorMessage(err));
    const acceptsHtml = ((req.headers?.accept ?? '') as string).includes('text/html');
    if (acceptsHtml) {
      res.status(500).send('<h2>Failed to record decline. Please try again.</h2>');
    } else {
      res.status(500).json({ error: 'Failed to record decline.' });
    }
  }
}

// ─── Public variation info (for the portal confirmation page) ──────────────────

export async function handleVariationPublicGet(req: any, res: any): Promise<void> {
  try {
    const { token } = req.params;
    const payload = verifyApprovalToken(token);
    if (!payload || payload.doc !== 'variation') {
      res.status(400).json({ error: 'Invalid or expired link.' });
      return;
    }

    const variation = await storage.getJobVariation(payload.vid, payload.uid);
    if (!variation) {
      res.status(404).json({ error: 'Variation not found.' });
      return;
    }

    const job = await storage.getJob(variation.jobId, payload.uid).catch(() => null);
    const businessSettings = await storage.getBusinessSettings(payload.uid).catch(() => null);

    // Log portal view
    await logTeamActivity({
      businessOwnerId: payload.uid,
      activityType: 'document_viewed',
      entityType: 'job',
      entityId: variation.jobId,
      entityTitle: `Variation ${variation.number}`,
      description: `Client viewed variation ${variation.number} in the approval portal`,
      metadata: { variationId: payload.vid, ip: req.ip },
    }).catch(() => {});

    res.json({
      type: 'variation',
      id: variation.id,
      number: variation.number,
      title: variation.title,
      description: variation.description,
      additionalAmount: variation.additionalAmount,
      gstAmount: variation.gstAmount,
      totalAmount: variation.totalAmount,
      status: variation.status,
      approvedAt: variation.approvedAt,
      approvedByName: variation.approvedByName,
      rejectedAt: (variation as any).rejectedAt,
      rejectionReason: (variation as any).rejectionReason,
      job: job ? { title: job.title, address: job.address } : null,
      business: businessSettings ? {
        name: (businessSettings as any).businessName,
        email: (businessSettings as any).email,
        phone: (businessSettings as any).phone,
        logoUrl: (businessSettings as any).logoUrl,
        brandColor: (businessSettings as any).brandColor,
      } : null,
    });
  } catch (err) {
    console.error('[VariationPublicGet] Error:', getErrorMessage(err));
    res.status(500).json({ error: 'Failed to load variation.' });
  }
}
