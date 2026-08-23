/**
 * SendGrid Inbound Parse Webhook Handler
 *
 * Receives inbound client reply emails via SendGrid's Inbound Parse service.
 * Matches each reply to the originating document via In-Reply-To / References
 * header threading, creates an activity feed entry, and notifies the job owner.
 *
 * SendGrid Inbound Parse delivers a multipart/form-data POST with these fields:
 *   from, to, subject, text, html, headers, envelope, charsets, dkim, spf, spam_report
 */

import { db } from './storage';
import { emailDeliveryLogs } from '@workspace/db';
import { eq, or } from 'drizzle-orm';
import { storage } from './storage';
import { getErrorMessage } from './lib/errors';
import { notifyClientEmailReply } from './pushNotifications';
import { logTeamActivity } from './activityService';

const INBOUND_RATE_LIMIT_MAP = new Map<string, number>();
const INBOUND_RATE_LIMIT_WINDOW_MS = 60_000;
const INBOUND_RATE_LIMIT_MAX = 10;

/**
 * Simple per-sender rate limiter to prevent abuse/spam from a single sender.
 */
function checkInboundRateLimit(senderEmail: string): boolean {
  const key = senderEmail.toLowerCase();
  const now = Date.now();
  const last = INBOUND_RATE_LIMIT_MAP.get(key) ?? 0;
  if (now - last < INBOUND_RATE_LIMIT_WINDOW_MS / INBOUND_RATE_LIMIT_MAX) {
    return false; // too fast
  }
  INBOUND_RATE_LIMIT_MAP.set(key, now);
  // Prune map to avoid memory leak
  if (INBOUND_RATE_LIMIT_MAP.size > 5000) {
    const cutoff = now - INBOUND_RATE_LIMIT_WINDOW_MS * 2;
    for (const [k, v] of INBOUND_RATE_LIMIT_MAP) {
      if (v < cutoff) INBOUND_RATE_LIMIT_MAP.delete(k);
    }
  }
  return true;
}

/**
 * Parse the raw `headers` string from SendGrid to extract the value of a
 * specific header (case-insensitive). Returns the first match, or null.
 */
function extractHeader(rawHeaders: string, name: string): string | null {
  const lower = name.toLowerCase();
  for (const line of rawHeaders.split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    if (line.slice(0, colon).trim().toLowerCase() === lower) {
      return line.slice(colon + 1).trim();
    }
  }
  return null;
}

/**
 * Extract all Message-IDs referenced in In-Reply-To or References headers.
 * Message-IDs look like <abc@domain.com>.
 */
function extractReferencedMessageIds(rawHeaders: string): string[] {
  const inReplyTo = extractHeader(rawHeaders, 'in-reply-to') ?? '';
  const references = extractHeader(rawHeaders, 'references') ?? '';
  const combined = `${inReplyTo} ${references}`;
  const matches = combined.match(/<[^>]+>/g) ?? [];
  return matches.map(m => m.slice(1, -1)); // strip angle brackets
}

/**
 * Truncate email body to a safe length for storage in metadata.
 */
function truncateBody(text: string, maxLen = 2000): string {
  if (!text) return '';
  const stripped = text.replace(/^>.*$/gm, '').trim(); // strip quoted lines
  return stripped.length > maxLen ? stripped.slice(0, maxLen) + '...' : stripped;
}

/**
 * Main inbound email processor. Called after the route validates the request.
 * `fields` is a plain object of the parsed multipart form fields from SendGrid.
 */
export async function processInboundEmail(fields: Record<string, string>): Promise<void> {
  const from = fields.from ?? '';
  const subject = fields.subject ?? '(No subject)';
  const text = fields.text ?? fields.html ?? '';
  const rawHeaders = fields.headers ?? '';

  // Extract sender address (SendGrid `from` field may be "Name <email@example.com>")
  const senderMatch = from.match(/<([^>]+)>/) ?? from.match(/([^\s@<]+@[^\s@>]+)/);
  const senderEmail = (senderMatch?.[1] ?? from).trim().toLowerCase();

  if (!senderEmail) {
    console.warn('[InboundEmail] Skipping — could not parse sender email from:', from);
    return;
  }

  // Per-sender rate limit
  if (!checkInboundRateLimit(senderEmail)) {
    console.warn('[InboundEmail] Rate limited sender:', senderEmail);
    return;
  }

  // Find the original document by matching In-Reply-To / References to our sent message IDs
  const referencedIds = extractReferencedMessageIds(rawHeaders);
  if (referencedIds.length === 0) {
    // Cannot match without a reference — still try matching by sender email as fallback
    console.log('[InboundEmail] No In-Reply-To/References found; cannot match to document');
    return;
  }

  let deliveryLog: typeof emailDeliveryLogs.$inferSelect | null = null;
  for (const msgId of referencedIds) {
    // emailDeliveryLogs.messageId stores the SendGrid X-Message-Id, which is the
    // local-part of the RFC Message-ID header (e.g. "abc123" from "abc123@sendgrid.net").
    // Clients include the full RFC Message-ID in their In-Reply-To/References headers,
    // so we must try both the full string and the local-part (before '@').
    const localPart = msgId.includes('@') ? msgId.split('@')[0] : msgId;
    const [row] = await db
      .select()
      .from(emailDeliveryLogs)
      .where(
        localPart !== msgId
          ? or(eq(emailDeliveryLogs.messageId, msgId), eq(emailDeliveryLogs.messageId, localPart))
          : eq(emailDeliveryLogs.messageId, msgId),
      )
      .limit(1);
    if (row) {
      deliveryLog = row;
      break;
    }
  }

  if (!deliveryLog) {
    console.log('[InboundEmail] No delivery log matched for message IDs:', referencedIds);
    return;
  }

  const { userId, relatedId, type: docType } = deliveryLog;
  if (!userId) {
    console.warn('[InboundEmail] Delivery log has no userId — skipping');
    return;
  }

  // Security: verify the reply sender matches the original outbound recipient stored
  // in the delivery log. This ensures a forged POST that references a known
  // messageId (e.g. guessed from a leaked log) cannot impersonate a client reply.
  const loggedRecipient = deliveryLog.recipientEmail?.toLowerCase() ?? null;
  if (loggedRecipient) {
    if (senderEmail !== loggedRecipient) {
      console.warn(
        `[InboundEmail] Discarding — sender "${senderEmail}" does not match logged recipient "${loggedRecipient}"`,
      );
      return;
    }
  }

  // Secondary guard: discard any reply from our own sending domain (prevents self-loops).
  const OUR_NOREPLY_DOMAINS = ['jobrunner.com.au'];
  const senderDomain = senderEmail.split('@')[1] ?? '';
  if (OUR_NOREPLY_DOMAINS.some(d => senderDomain === d)) {
    console.warn('[InboundEmail] Discarding reply from our own sending domain:', senderEmail);
    return;
  }

  const bodyPreview = truncateBody(text);
  const senderName = from.includes('<') ? from.replace(/<[^>]+>/, '').trim().replace(/^["']|["']$/g, '').trim() : senderEmail;

  // Create activity log entry for the client email reply
  try {
    await storage.createActivityLog({
      userId,
      type: 'client_email_reply',
      title: `Client replied: ${subject.slice(0, 100)}`,
      description: `${senderName || senderEmail}: ${bodyPreview.slice(0, 200)}`,
      entityType: docType as any || 'quote',
      entityId: relatedId ?? undefined,
      metadata: {
        senderEmail,
        senderName,
        subject,
        bodyPreview,
        referencedMessageIds: referencedIds,
        docType,
        docId: relatedId,
      },
    });
  } catch (err) {
    console.error('[InboundEmail] Failed to create activity log:', getErrorMessage(err));
  }

  // Log to team activity feed as well (visible on the job timeline)
  try {
    await logTeamActivity({
      businessOwnerId: userId,
      activityType: 'client_email_reply',
      entityType: (docType as any) || 'quote',
      entityId: relatedId ?? undefined,
      entityTitle: subject.slice(0, 100),
      description: `Client email reply from ${senderName || senderEmail}: "${bodyPreview.slice(0, 150)}"`,
      metadata: { senderEmail, senderName, subject, bodyPreview, docType, docId: relatedId },
      isImportant: true,
    });
  } catch (err) {
    console.error('[InboundEmail] Failed to log team activity:', getErrorMessage(err));
  }

  // Send push notification to the job owner
  try {
    await notifyClientEmailReply(userId, senderName || senderEmail, subject, relatedId ?? undefined, docType ?? undefined);
  } catch (err) {
    console.error('[InboundEmail] Failed to send push notification:', getErrorMessage(err));
  }

  console.log(`[InboundEmail] Processed reply from ${senderEmail} for ${docType} ${relatedId}`);
}
