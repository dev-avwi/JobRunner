import { db } from "./storage";
import { errorLogs } from "@workspace/db";

export type LogLevel = 'info' | 'warn' | 'error' | 'fatal';
export type LogCategory = 'sms' | 'email' | 'billing' | 'webhook' | 'auth' | 'api' | 'background' | 'system' | 'frontend';

// ---------------------------------------------------------------------------
// PII sanitisation helpers
// ---------------------------------------------------------------------------

/** Field names whose values must never appear in plaintext in logs or the DB. */
const PII_FIELD_NAMES = new Set([
  'password', 'passwordHash', 'emailVerificationToken', 'passwordResetToken',
  'email', 'phone', 'phoneNormalized',
  'bankBsb', 'bankAccountNumber', 'bankAccountName',
  'abn', 'tfn', 'payId',
  'appleReceiptData', 'stripeCustomerId', 'stripePaymentIntentId',
]);

/**
 * Recursively walk a plain-object metadata value and replace any key that is
 * in the PII_FIELD_NAMES set with "[REDACTED]".  Non-plain-object values
 * (strings, numbers, arrays) are returned unchanged so callers can still log
 * counts, IDs, and other non-sensitive data safely.
 *
 * Exported for unit testing.
 */
export function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => sanitizeMetadata(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = PII_FIELD_NAMES.has(k) ? '[REDACTED]' : sanitizeMetadata(v, depth + 1);
  }
  return out;
}

/**
 * Strip common PII patterns from a string so that callers who accidentally
 * interpolate an email address or phone number don't persist them.
 * Patterns replaced with "[REDACTED]":
 *   - Email addresses (RFC-5321 local@domain)
 *   - Australian mobile/landline numbers (10+ digits, optional +61 prefix)
 *
 * Exported for unit testing.
 */
export function sanitizeMessage(msg: string): string {
  return msg
    // email addresses
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[REDACTED]')
    // phone numbers: optional +61/0, 9-15 digits, optional spaces/dashes
    .replace(/(\+?61[\s\-]?|0)[\d][\d\s\-]{7,13}\d/g, '[REDACTED]');
}

/**
 * Produce a safe, sanitized summary of an error value suitable for storing in
 * the DB or emitting to stdout/email.
 *
 * - Error.message and stack frames are passed through sanitizeMessage so PII
 *   patterns (emails, phone numbers) embedded in HTTP response bodies or
 *   provider error payloads are redacted before they reach any sink.
 * - Stacks are truncated to the first 8 lines to limit volume.
 * - Non-Error values are coerced to a sanitized string.
 *
 * Exported for unit testing.
 */
export function sanitizeError(error: unknown): { name: string; message: string; stack: string } | { raw: string } | undefined {
  if (error === undefined || error === null) return undefined;
  if (error instanceof Error) {
    const safeMsg = sanitizeMessage(error.message);
    const rawStack = error.stack ?? '';
    const safeStack = rawStack
      .split('\n')
      .slice(0, 8)
      .map((line) => sanitizeMessage(line))
      .join('\n');
    return { name: error.name, message: safeMsg, stack: safeStack };
  }
  return { raw: sanitizeMessage(String(error)) };
}

interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  userId?: string;
  metadata?: Record<string, any>;
  error?: Error | unknown;
}

const ALERT_COOLDOWN_MS = 5 * 60 * 1000;
let lastAlertSent = 0;

// Transient infra errors that happen routinely under Neon serverless
// (idle connections dropped, websocket churn). They are not user-impacting
// — every scheduler that hits one retries on its next interval — so we
// keep them in console + DB logs but suppress the admin email alert.
// If a real outage is happening you'll see other signals first (5xx spike
// in /api/metrics, ALB health failure, etc).
const TRANSIENT_ERROR_PATTERNS: RegExp[] = [
  /Connection terminated due to connection timeout/i,
  /Connection terminated unexpectedly/i,
  /terminating connection due to administrator command/i,
  /Client has encountered a connection error and is not queryable/i,
  /timeout exceeded when trying to connect/i,
];

function isTransientInfraError(entry: { message?: unknown; error?: unknown }): boolean {
  // Defense-in-depth: callers sometimes pass an Error object in the message
  // slot (wrong signature) — coerce everything to text so the patterns below
  // still match no matter which slot the connection error landed in.
  const parts: string[] = [];
  if (typeof entry.message === 'string') parts.push(entry.message);
  else if (entry.message instanceof Error) parts.push(entry.message.message);
  else if (entry.message != null) parts.push(String(entry.message));
  if (entry.error instanceof Error) parts.push(entry.error.message);
  else if (entry.error != null) parts.push(String(entry.error));
  const haystack = parts.join(' ');
  if (!haystack) return false;
  return TRANSIENT_ERROR_PATTERNS.some(re => re.test(haystack));
}

class Logger {
  private async persist(entry: LogEntry) {
    try {
      // Sanitize the error object before persisting — error messages and stack
      // frames from third-party providers (Stripe, Twilio, SendGrid, etc.) can
      // contain PII such as email addresses or phone numbers embedded in request
      // or response payloads.
      const errorDetails = sanitizeError(entry.error) ?? null;

      await db.insert(errorLogs).values({
        level: entry.level,
        category: entry.category,
        // Sanitize the message before it hits the DB in case the caller
        // interpolated an email address or phone number inline.
        message: sanitizeMessage(entry.message),
        userId: entry.userId || null,
        // Deep-sanitize metadata so no PII field survives to the DB row.
        metadata: entry.metadata ? sanitizeMetadata(entry.metadata) as Record<string, any> : null,
        errorDetails,
      });
    } catch (dbError) {
      console.error('[Logger] Failed to persist log entry:', dbError);
    }
  }

  private async sendAlertEmail(entry: LogEntry) {
    // Skip transient infra noise — Neon connection drops, websocket churn,
    // etc. They self-recover on the next scheduler tick and would otherwise
    // flood admin inboxes with the same alert every 5 minutes.
    if (isTransientInfraError(entry)) return;

    const now = Date.now();
    if (now - lastAlertSent < ALERT_COOLDOWN_MS) return;
    lastAlertSent = now;

    try {
      const { sendEmail } = await import('./emailService');
      const adminEmail = process.env.ADMIN_ALERT_EMAIL || 'admin@avwebinnovation.com';
      // Sanitize the error before embedding it in the alert email — provider
      // error payloads can contain recipient addresses and request bodies.
      const safeErr = sanitizeError(entry.error);
      const errorMsg = safeErr && 'message' in safeErr ? safeErr.message : safeErr?.raw ?? '';
      const stack = safeErr && 'stack' in safeErr ? safeErr.stack : '';
      // Defensive: callers occasionally pass non-strings (Error objects, arrays
      // built from console.error spreads). Coerce so .substring/template literals
      // don't blow up the alerter and silently drop the alert.
      const safeMessage = sanitizeMessage(
        typeof entry.message === 'string'
          ? entry.message
          : (entry.message == null ? '' : String(entry.message)),
      );

      await sendEmail({
        to: adminEmail,
        subject: `[JobRunner ${entry.level.toUpperCase()}] ${entry.category}: ${safeMessage.substring(0, 80)}`,
        html: `
          <h2 style="color: #dc2626;">JobRunner ${entry.level.toUpperCase()} Alert</h2>
          <p><strong>Category:</strong> ${entry.category}</p>
          <p><strong>Message:</strong> ${safeMessage}</p>
          ${entry.userId ? `<p><strong>User:</strong> ${entry.userId}</p>` : ''}
          ${errorMsg ? `<p><strong>Error:</strong> ${errorMsg}</p>` : ''}
          ${stack ? `<pre style="background:#f3f4f6;padding:12px;border-radius:6px;font-size:12px;overflow:auto;">${stack}</pre>` : ''}
          <p style="color:#6b7280;font-size:12px;">Time: ${new Date().toISOString()}</p>
          <p style="color:#6b7280;font-size:12px;">Alerts are throttled to one every 5 minutes.</p>
        `,
      });
    } catch (emailError) {
      console.error('[Logger] Failed to send alert email:', emailError);
    }
  }

  private formatConsole(entry: LogEntry): string {
    const ts = new Date().toISOString();
    const prefix = `[${ts}] [${entry.level.toUpperCase()}] [${entry.category}]`;
    const userStr = entry.userId ? ` user=${entry.userId}` : '';
    // Sanitize before writing to stdout so CI/cloud log aggregators never
    // capture raw email addresses or phone numbers.
    return `${prefix}${userStr} ${sanitizeMessage(entry.message)}`;
  }

  /** Emit a sanitized string representation of an error to the console. */
  private consoleError(error: unknown): void {
    const safe = sanitizeError(error);
    if (!safe) return;
    const text = 'message' in safe
      ? `${safe.name}: ${safe.message}\n${safe.stack}`
      : safe.raw;
    console.error(text);
  }

  info(category: LogCategory, message: string, opts?: { userId?: string; metadata?: Record<string, any> }) {
    const entry: LogEntry = { level: 'info', category, message, ...opts };
    console.log(this.formatConsole(entry));
    this.persist(entry);
  }

  warn(category: LogCategory, message: string, opts?: { userId?: string; metadata?: Record<string, any>; error?: Error | unknown }) {
    const entry: LogEntry = { level: 'warn', category, message, ...opts };
    console.warn(this.formatConsole(entry));
    if (entry.error) this.consoleError(entry.error);
    this.persist(entry);
  }

  error(category: LogCategory, message: string, opts?: { userId?: string; metadata?: Record<string, any>; error?: Error | unknown }) {
    const entry: LogEntry = { level: 'error', category, message, ...opts };
    console.error(this.formatConsole(entry));
    if (entry.error) this.consoleError(entry.error);
    this.persist(entry);
    this.sendAlertEmail(entry);
  }

  fatal(category: LogCategory, message: string, opts?: { userId?: string; metadata?: Record<string, any>; error?: Error | unknown }) {
    const entry: LogEntry = { level: 'fatal', category, message, ...opts };
    console.error(this.formatConsole(entry));
    if (entry.error) this.consoleError(entry.error);
    this.persist(entry);
    this.sendAlertEmail(entry);
  }
}

export const logger = new Logger();
