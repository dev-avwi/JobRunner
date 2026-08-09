import crypto from 'crypto';
import { db } from './storage';
import { emailDeliveryLogs } from '@workspace/db';
import { eq, sql } from 'drizzle-orm';
import { getErrorMessage } from "./lib/errors";

// SendGrid Event Webhook
// Docs: https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook
// Signed Event Webhook uses ECDSA on the secp256r1 (P-256) curve.
// Headers: X-Twilio-Email-Event-Webhook-Signature, X-Twilio-Email-Event-Webhook-Timestamp
// Public key (base64-encoded ASN.1 DER) is set on SendGrid dashboard and provided to us.

// Reject events whose signed timestamp is older than this — protects against replay
// of an intercepted signed payload. SendGrid retries within minutes so 10min is generous.
const MAX_TIMESTAMP_SKEW_SEC = 10 * 60;

// Bounded in-memory dedupe of recently-processed sg_event_id values so that SendGrid's
// at-least-once delivery doesn't double-count opens or clicks. Sized for typical retry windows.
const SEEN_EVENT_LIMIT = 5000;
const seenEventIds: Map<string, number> = new Map();
function rememberEventId(id: string): boolean {
  if (seenEventIds.has(id)) return false;
  seenEventIds.set(id, Date.now());
  if (seenEventIds.size > SEEN_EVENT_LIMIT) {
    // Drop oldest insertion (Map preserves insertion order).
    const firstKey = seenEventIds.keys().next().value;
    if (firstKey) seenEventIds.delete(firstKey);
  }
  return true;
}

// Cached PEM key (avoid re-decoding on every request)
let cachedPublicKeyPem: string | null = null;
let cachedPublicKeyRaw: string | null = null;

function getPublicKeyPem(): string | null {
  const raw = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
  if (!raw) return null;
  if (cachedPublicKeyRaw === raw && cachedPublicKeyPem) return cachedPublicKeyPem;
  // Convert raw base64 (single line) to a PEM-formatted ECDSA public key.
  const cleaned = raw.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const wrapped = cleaned.match(/.{1,64}/g)?.join('\n') ?? cleaned;
  cachedPublicKeyRaw = raw;
  cachedPublicKeyPem = `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----\n`;
  return cachedPublicKeyPem;
}

/**
 * Fail-closed: in production we always require a configured public key and a valid
 * signature + recent timestamp. In development we still log a warning when the key
 * is missing, but only allow events through when SENDGRID_WEBHOOK_DEV_INSECURE=1
 * is explicitly set so a developer can iterate without SendGrid configured.
 */
export function verifySendGridWebhook(
  rawBody: Buffer | string,
  signature: string | undefined,
  timestamp: string | undefined,
): boolean {
  const pem = getPublicKeyPem();
  if (!pem) {
    const devOverride =
      process.env.NODE_ENV !== 'production' &&
      !process.env.REPLIT_DEPLOYMENT &&
      process.env.SENDGRID_WEBHOOK_DEV_INSECURE === '1';
    if (devOverride) {
      console.warn('[SendGrid Webhook] DEV INSECURE MODE — accepting event without signature verification');
      return true;
    }
    console.warn('[SendGrid Webhook] Rejecting event: SENDGRID_WEBHOOK_PUBLIC_KEY not configured');
    return false;
  }
  if (!signature || !timestamp) {
    console.warn('[SendGrid Webhook] Missing signature or timestamp header');
    return false;
  }
  // Replay protection — reject events whose signed timestamp is too old or in the future.
  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) {
    console.warn('[SendGrid Webhook] Non-numeric timestamp');
    return false;
  }
  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - tsNum);
  if (ageSec > MAX_TIMESTAMP_SKEW_SEC) {
    console.warn(`[SendGrid Webhook] Rejecting stale event — age ${ageSec}s exceeds ${MAX_TIMESTAMP_SKEW_SEC}s`);
    return false;
  }
  try {
    const bodyBuf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
    const payload = Buffer.concat([Buffer.from(timestamp, 'utf8'), bodyBuf]);
    const sigBuf = Buffer.from(signature, 'base64');
    const verifier = crypto.createVerify('sha256');
    verifier.update(payload);
    verifier.end();
    const ok = verifier.verify(pem, sigBuf);
    if (!ok) {
      console.warn('[SendGrid Webhook] Signature verification failed');
    }
    return ok;
  } catch (err: unknown) {
    console.error('[SendGrid Webhook] Verification error:', getErrorMessage(err));
    return false;
  }
}

interface SendGridEvent {
  email?: string;
  timestamp?: number;
  event?: string;
  sg_message_id?: string;
  sg_event_id?: string;
  reason?: string;
  url?: string;
  // Custom args we set on send
  delivery_log_id?: string;
  user_id?: string;
  type?: string;
  related_id?: string;
}

/**
 * Find the delivery log row for an event.
 * Prefer the `delivery_log_id` custom arg we attach at send time.
 * Fallback: match by SendGrid message id (strip the suffix after '.' that SendGrid appends per event).
 */
async function findLogForEvent(event: SendGridEvent) {
  if (event.delivery_log_id) {
    const [row] = await db
      .select()
      .from(emailDeliveryLogs)
      .where(eq(emailDeliveryLogs.id, event.delivery_log_id))
      .limit(1);
    if (row) return row;
  }
  if (event.sg_message_id) {
    // SendGrid emits sg_message_id like "abc123.filterdrecv-..." — the part before '.' is the X-Message-Id we stored.
    const baseId = event.sg_message_id.split('.')[0];
    const [row] = await db
      .select()
      .from(emailDeliveryLogs)
      .where(eq(emailDeliveryLogs.messageId, baseId))
      .limit(1);
    if (row) return row;
  }
  return null;
}

/**
 * Apply a single SendGrid event to its delivery log row.
 */
async function applyEvent(event: SendGridEvent): Promise<void> {
  // Idempotency: SendGrid delivers at-least-once. Drop duplicates by sg_event_id.
  if (event.sg_event_id && !rememberEventId(event.sg_event_id)) {
    return;
  }
  const row = await findLogForEvent(event);
  if (!row) {
    // Common during local dev or for system emails sent before tracking was wired up.
    return;
  }
  const eventTime = event.timestamp ? new Date(event.timestamp * 1000) : new Date();
  const updates: Record<string, any> = {
    lastEventType: event.event,
    lastEventAt: eventTime,
  };

  switch (event.event) {
    case 'delivered':
      updates.status = 'delivered';
      updates.deliveredAt = row.deliveredAt || eventTime;
      break;
    case 'open':
      updates.status = row.status === 'clicked' ? 'clicked' : 'opened';
      updates.openedAt = row.openedAt || eventTime;
      updates.openCount = sql`COALESCE(${emailDeliveryLogs.openCount}, 0) + 1`;
      break;
    case 'click':
      updates.status = 'clicked';
      updates.clickedAt = row.clickedAt || eventTime;
      updates.clickCount = sql`COALESCE(${emailDeliveryLogs.clickCount}, 0) + 1`;
      // A click implies open even if SendGrid didn't fire one
      if (!row.openedAt) updates.openedAt = eventTime;
      break;
    case 'bounce':
    case 'dropped':
    case 'blocked':
      updates.status = 'failed';
      updates.bouncedAt = row.bouncedAt || eventTime;
      updates.bounceReason = event.reason || event.event;
      updates.permanentlyFailed = true;
      break;
    case 'spamreport':
    case 'unsubscribe':
    case 'group_unsubscribe':
      updates.status = 'failed';
      updates.bounceReason = event.event;
      break;
    case 'processed':
    case 'deferred':
      // Informational only
      break;
    default:
      // Unknown event type — still record lastEventType
      break;
  }

  await db
    .update(emailDeliveryLogs)
    .set(updates)
    .where(eq(emailDeliveryLogs.id, row.id));
}

/**
 * Process a batch of SendGrid events. Errors on individual events are logged
 * but do not abort the batch — webhook returns 200 to prevent SendGrid retries
 * on per-row issues.
 */
export async function processSendGridEvents(events: SendGridEvent[]): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;
  for (const event of events) {
    try {
      await applyEvent(event);
      processed += 1;
    } catch (err: unknown) {
      errors += 1;
      console.error('[SendGrid Webhook] Failed to apply event:', getErrorMessage(err), JSON.stringify(event));
    }
  }
  return { processed, errors };
}
