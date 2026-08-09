import { db } from "./storage";
import { errorLogs } from "@workspace/db";

export type LogLevel = 'info' | 'warn' | 'error' | 'fatal';
export type LogCategory = 'sms' | 'email' | 'billing' | 'webhook' | 'auth' | 'api' | 'background' | 'system' | 'frontend';

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
      const errorDetails = entry.error instanceof Error
        ? { name: entry.error.name, message: entry.error.message, stack: entry.error.stack }
        : entry.error ? { raw: String(entry.error) } : undefined;

      await db.insert(errorLogs).values({
        level: entry.level,
        category: entry.category,
        message: entry.message,
        userId: entry.userId || null,
        metadata: entry.metadata || null,
        errorDetails: errorDetails || null,
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
      const errorMsg = entry.error instanceof Error ? entry.error.message : String(entry.error || '');
      const stack = entry.error instanceof Error ? entry.error.stack : '';
      // Defensive: callers occasionally pass non-strings (Error objects, arrays
      // built from console.error spreads). Coerce so .substring/template literals
      // don't blow up the alerter and silently drop the alert.
      const safeMessage = typeof entry.message === 'string'
        ? entry.message
        : (entry.message == null ? '' : String(entry.message));

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
    return `${prefix}${userStr} ${entry.message}`;
  }

  info(category: LogCategory, message: string, opts?: { userId?: string; metadata?: Record<string, any> }) {
    const entry: LogEntry = { level: 'info', category, message, ...opts };
    console.log(this.formatConsole(entry));
    this.persist(entry);
  }

  warn(category: LogCategory, message: string, opts?: { userId?: string; metadata?: Record<string, any>; error?: Error | unknown }) {
    const entry: LogEntry = { level: 'warn', category, message, ...opts };
    console.warn(this.formatConsole(entry));
    if (entry.error) console.warn(entry.error);
    this.persist(entry);
  }

  error(category: LogCategory, message: string, opts?: { userId?: string; metadata?: Record<string, any>; error?: Error | unknown }) {
    const entry: LogEntry = { level: 'error', category, message, ...opts };
    console.error(this.formatConsole(entry));
    if (entry.error) console.error(entry.error);
    this.persist(entry);
    this.sendAlertEmail(entry);
  }

  fatal(category: LogCategory, message: string, opts?: { userId?: string; metadata?: Record<string, any>; error?: Error | unknown }) {
    const entry: LogEntry = { level: 'fatal', category, message, ...opts };
    console.error(this.formatConsole(entry));
    if (entry.error) console.error(entry.error);
    this.persist(entry);
    this.sendAlertEmail(entry);
  }
}

export const logger = new Logger();
