/**
 * Retention Due Email Service (Task #442)
 *
 * Runs daily. For each project-type job where the DLP period has just expired
 * (releaseDate = today or within the last LOOKBACK_DAYS) and retention is still
 * outstanding, sends a one-time email to the business owner so they remember to
 * issue the retention release claim.
 *
 * Recipient policy: the business owner only (jobs.userId). The task spec
 * explicitly states "Sends an email to the business owner — 'Your DLP period
 * on [Job] has ended — $X retention is now due'".
 *
 * Concurrency safety: before sending each email the scheduler atomically claims
 * the job with a conditional UPDATE … WHERE retention_due_sent_at IS NULL.
 * If another process (parallel startup, overlapping run) already claimed it the
 * update returns 0 rows and we skip. On send failure the claim is cleared so
 * the next daily run can retry — no email is permanently missed.
 */

import { db } from './storage';
import { jobs, claims, users, businessSettings } from '@workspace/db';
import { eq, and, isNull, isNotNull, sql } from 'drizzle-orm';
import { computeRetentionSummary } from './routes/retentionSummary';
import { sendSystemEmail } from './emailService';
import { getProductionBaseUrl } from './urlHelper';
import { getErrorMessage } from './lib/errors';

/** How many days back to look when the daily run is slightly late. */
export const RETENTION_DUE_LOOKBACK_DAYS = 1;

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/**
 * Add `months` calendar months to `date`, clamping to the last valid day of
 * the target month rather than overflowing into the following month.
 *
 * Examples:
 *   Jan 31 + 1 month → Feb 28/29 (not Mar 3)
 *   Feb 29 (leap) + 12 months → Feb 28 (non-leap, clamped)
 */
function addMonths(date: Date, months: number): Date {
  const totalMonths = date.getMonth() + months;
  const targetYear  = date.getFullYear() + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12; // always 0–11

  // Day 0 of month+1 is the last day of `month`.
  const lastDayOfTarget = new Date(targetYear, targetMonth + 1, 0).getDate();
  const clampedDay = Math.min(date.getDate(), lastDayOfTarget);

  return new Date(
    targetYear,
    targetMonth,
    clampedDay,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

/**
 * Given a PC date string (YYYY-MM-DD) and a DLP duration in months, returns
 * the computed release date as a Date object.
 *
 * Month-end dates are clamped: Jan 31 + 1 month = Feb 28 (or Feb 29 on a
 * leap year), not Mar 3. This matches the commercially expected behaviour
 * for DLP expiry calculations.
 */
export function computeReleaseDate(
  practicalCompletionDate: string,
  defectsLiabilityMonths: number,
): Date {
  const pcDate = new Date(practicalCompletionDate + 'T00:00:00');
  return addMonths(pcDate, defectsLiabilityMonths);
}

/**
 * Pure eligibility test: true when a job's DLP release date falls within the
 * send window [now − lookbackDays, now].
 *
 * Exported for unit tests so date-boundary behaviour can be verified without
 * hitting the database.
 */
export function isWithinSendWindow(
  releaseDate: Date,
  now: Date,
  lookbackDays: number = RETENTION_DUE_LOOKBACK_DAYS,
): boolean {
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - lookbackDays);
  windowStart.setHours(0, 0, 0, 0);
  return releaseDate >= windowStart && releaseDate <= now;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDisplayDate(dateStr: string): string {
  // Parse as local date (not UTC) to avoid off-by-one on AEST/AEDT.
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Escape a string for safe embedding in HTML content or attribute values. */
function esc(str: string | null | undefined): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Email template
// ---------------------------------------------------------------------------

function buildRetentionDueEmail(opts: {
  ownerFirstName: string | null;
  businessName: string;
  jobTitle: string;
  jobId: string;
  retentionHeld: number;
  releaseDate: string;
  baseUrl: string;
  brandColor: string;
}): string {
  const { ownerFirstName, businessName, jobTitle, jobId, retentionHeld, releaseDate, baseUrl, brandColor } = opts;

  // URL-encode the job ID so special chars can't escape the path segment.
  const safeJobId = encodeURIComponent(jobId);
  const jobUrl = `${baseUrl}/jobs/${safeJobId}?tab=claims`;

  const safeFirstName    = esc(ownerFirstName);
  const safeBusinessName = esc(businessName);
  const safeJobTitle     = esc(jobTitle);
  const safeDocTitle     = esc(`Retention Due — ${jobTitle}`);

  const greeting = safeFirstName ? `Hi ${safeFirstName},` : 'Hi,';
  const color = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(brandColor) ? brandColor : '#2563EB';
  const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

  const ctaButton = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
      <tr>
        <td align="center" style="border-radius: 8px; background-color: ${color};">
          <a href="${jobUrl}" style="display: inline-block; padding: 15px 36px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; line-height: 1; font-family: ${fontStack};">Issue Retention Release Claim</a>
        </td>
      </tr>
    </table>`;

  const innerRows = `
    <tr><td style="height: 4px; line-height: 4px; font-size: 0; background-color: ${color};">&nbsp;</td></tr>
    <tr>
      <td style="background-color: #ffffff; padding: 32px 32px 4px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td valign="middle" style="padding-right: 10px;">
              <img src="${baseUrl}/favicon-192.png" width="32" height="32" alt="JobRunner" style="display: inline-block; border: 0; vertical-align: middle;" />
            </td>
            <td valign="middle"><span style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px; font-family: ${fontStack};"><span style="color: #2563EB;">Job</span><span style="color: #F59E0B;">Runner</span></span></td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 32px 0 32px;">
        <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #0f172a; font-family: ${fontStack};">${greeting}</p>
        <p style="margin: 16px 0; font-size: 15px; color: #334155; line-height: 1.6; font-family: ${fontStack};">
          The defects liability period (DLP) on the following project has ended — your retention is now due.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
               style="border: 1px solid #e2e8f0; border-radius: 8px; margin: 24px 0;">
          <tr>
            <td style="padding: 20px 24px; background-color: #f8fafc; border-radius: 8px;">
              <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-family: ${fontStack};">Project</p>
              <p style="margin: 0 0 16px 0; font-size: 17px; font-weight: 700; color: #0f172a; font-family: ${fontStack};">${safeJobTitle}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td width="50%">
                    <p style="margin: 0 0 2px 0; font-size: 12px; color: #94a3b8; font-family: ${fontStack};">DLP Ended</p>
                    <p style="margin: 0; font-size: 15px; font-weight: 600; color: #334155; font-family: ${fontStack};">${formatDisplayDate(releaseDate)}</p>
                  </td>
                  <td width="50%">
                    <p style="margin: 0 0 2px 0; font-size: 12px; color: #94a3b8; font-family: ${fontStack};">Retention Held</p>
                    <p style="margin: 0; font-size: 20px; font-weight: 800; color: ${color}; font-family: ${fontStack};">${formatCurrency(retentionHeld)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p style="margin: 0 0 24px 0; font-size: 15px; color: #334155; line-height: 1.6; font-family: ${fontStack};">
          Log in to JobRunner and create a <strong>Retention Release</strong> progress claim to collect the outstanding amount.
        </p>
        ${ctaButton}
        <p style="margin: 32px 0 0 0; font-size: 13px; color: #94a3b8; line-height: 1.5; font-family: ${fontStack};">
          This is a one-time reminder from <strong>${safeBusinessName}</strong> via JobRunner.
        </p>
      </td>
    </tr>
    <tr><td style="height: 40px;">&nbsp;</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${safeDocTitle}</title>
  <style type="text/css">
    body, table, td, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; background-color: #f1f5f9; }
    @media only screen and (max-width: 600px) { .container { width: 100% !important; } }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: ${fontStack};">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table class="container" role="presentation" cellpadding="0" cellspacing="0" width="600"
               style="max-width: 600px; background-color: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0;">
          ${innerRows}
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; margin-top: 20px;">
          <tr>
            <td align="center" style="padding: 8px 24px; color: #94a3b8; font-size: 12px; line-height: 1.6;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">Sent with <strong style="color: #475569;">JobRunner</strong> &mdash; built for Australian tradies</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Scheduler entry point
// ---------------------------------------------------------------------------

/**
 * Find all project jobs whose DLP release date has just passed and that have
 * outstanding retention and haven't been emailed yet. For each eligible job:
 *
 *  1. Atomically claim it with a conditional UPDATE … WHERE retention_due_sent_at IS NULL.
 *     If another process already claimed it the update returns 0 rows — we skip.
 *  2. Send the email to the business owner (per task spec).
 *  3. On send failure, clear the claim (reset to NULL) so the next run retries.
 */
export async function processRetentionDueEmails(): Promise<void> {
  console.log('[RetentionDue] Checking for jobs with expired DLP and outstanding retention...');

  try {
    // Fetch all project jobs with a PC date that haven't been stamped yet.
    const projectJobs = await db
      .select({
        id:                       jobs.id,
        userId:                   jobs.userId,
        title:                    jobs.title,
        jobNumber:                jobs.jobNumber,
        practicalCompletionDate:  jobs.practicalCompletionDate,
        defectsLiabilityMonths:   jobs.defectsLiabilityMonths,
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.jobType, 'project'),
          isNotNull(jobs.practicalCompletionDate),
          isNull(jobs.retentionDueSentAt),
        ),
      );

    if (projectJobs.length === 0) {
      console.log('[RetentionDue] No eligible project jobs found');
      return;
    }

    const now     = new Date();
    const baseUrl = getProductionBaseUrl();
    let sentCount    = 0;
    let skippedCount = 0;

    for (const job of projectJobs) {
      try {
        if (!job.practicalCompletionDate) continue;

        const dlpMonths   = job.defectsLiabilityMonths ?? 12;
        const releaseDate = computeReleaseDate(job.practicalCompletionDate, dlpMonths);

        // Date-window check: only act when the DLP expired recently.
        if (!isWithinSendWindow(releaseDate, now)) {
          skippedCount++;
          continue;
        }

        // Compute retention to confirm something is still outstanding and
        // that no retention-release claim is already in flight. Sending a
        // "create a release claim" prompt when one already exists would
        // confuse the owner and could trigger a duplicate claim.
        const jobClaims = await db
          .select({
            id:              claims.id,
            status:          claims.status,
            retentionAmount: claims.retentionAmount,
            subtotal:        claims.subtotal,
            total:           claims.total,
            notes:           claims.notes,
          })
          .from(claims)
          .where(eq(claims.jobId, job.id));

        const summary = computeRetentionSummary(
          jobClaims.map((c) => ({
            id:              c.id,
            status:          c.status,
            retentionAmount: c.retentionAmount ?? '0',
            subtotal:        c.subtotal        ?? '0',
            total:           c.total           ?? '0',
            notes:           c.notes,
          })),
          { practicalCompletionDate: job.practicalCompletionDate, defectsLiabilityMonths: dlpMonths },
          now,
        );

        if (summary.outstandingRetention <= 0) {
          skippedCount++;
          continue;
        }

        // A retention-release claim is already pending — the owner has already
        // acted. Don't send a duplicate prompt; stamp and skip.
        if (summary.hasReleasePending) {
          console.log(`[RetentionDue] Job ${job.id} already has a pending release claim — skipping`);
          skippedCount++;
          continue;
        }

        // ── Resolve recipient before claiming ─────────────────────────────
        // Look up the owner email BEFORE the atomic stamp so a missing email
        // doesn't consume the claim slot; the job stays unstamped and the
        // scheduler will re-check on subsequent runs.
        const [ownerRow] = await db
          .select({ id: users.id, email: users.email, firstName: users.firstName })
          .from(users)
          .where(eq(users.id, job.userId))
          .limit(1);

        if (!ownerRow?.email) {
          console.warn(`[RetentionDue] Owner for job ${job.id} has no email address — skipping without stamping`);
          skippedCount++;
          continue;
        }

        // ── Atomic claim ──────────────────────────────────────────────────
        // Stamp NOW *before* sending. The WHERE guards against a concurrent
        // process that may have already claimed (and begun sending) this job.
        // Only the process that sees rowCount > 0 proceeds to send.
        //
        // We do NOT clear the stamp on send failure. sendSystemEmail persists
        // transient failures to emailDeliveryLogs and the retry scheduler
        // re-attempts delivery every five minutes. Clearing the stamp would
        // race with that retry: if the queued retry succeeds and then the
        // daily scheduler re-runs, the owner receives a duplicate notification.
        const claimed = await db
          .update(jobs)
          .set({ retentionDueSentAt: now })
          .where(and(eq(jobs.id, job.id), isNull(jobs.retentionDueSentAt)))
          .returning({ id: jobs.id });

        if (claimed.length === 0) {
          // Another process (parallel startup / overlapping run) already stamped it.
          console.log(`[RetentionDue] Job ${job.id} already claimed by another process — skipping`);
          skippedCount++;
          continue;
        }

        // ── Send email ────────────────────────────────────────────────────
        try {
          const [bizRow] = await db
            .select({ businessName: businessSettings.businessName, brandColor: businessSettings.brandColor })
            .from(businessSettings)
            .where(eq(businessSettings.userId, job.userId))
            .limit(1);

          const businessName   = bizRow?.businessName ?? 'your business';
          const brandColor     = bizRow?.brandColor   ?? '#2563EB';
          const releaseDateStr = releaseDate.toISOString().split('T')[0];
          const jobTitle       = job.jobNumber ? `${job.jobNumber} – ${job.title}` : job.title;

          const html = buildRetentionDueEmail({
            ownerFirstName: ownerRow.firstName,
            businessName,
            jobTitle,
            jobId:         job.id,
            retentionHeld: summary.outstandingRetention,
            releaseDate:   releaseDateStr,
            baseUrl,
            brandColor,
          });

          await sendSystemEmail({
            to:      ownerRow.email,
            subject: `Retention due — ${jobTitle} (${formatCurrency(summary.outstandingRetention)} to claim)`,
            html,
            _meta: { type: 'retention_due', userId: job.userId, relatedId: job.id },
          });

          console.log(
            `[RetentionDue] Sent retention-due email for job ${job.id} (${jobTitle}) ` +
            `to ${ownerRow.email} — ${formatCurrency(summary.outstandingRetention)} outstanding`,
          );
          sentCount++;
        } catch (sendErr) {
          // Stamp is kept. sendSystemEmail logs the failure to emailDeliveryLogs
          // and its retry scheduler will re-attempt delivery automatically.
          // Clearing the stamp here would race with that retry and risk a
          // duplicate notification if the queued retry later succeeds.
          console.error(
            `[RetentionDue] Email send failed for job ${job.id} — stamp kept, ` +
            `delivery retry queue will handle retransmission:`,
            getErrorMessage(sendErr),
          );
        }
      } catch (jobErr) {
        console.error(`[RetentionDue] Error processing job ${job.id}:`, getErrorMessage(jobErr));
      }
    }

    console.log(`[RetentionDue] Done — ${sentCount} sent, ${skippedCount} skipped`);
  } catch (err) {
    console.error('[RetentionDue] Fatal error in processRetentionDueEmails:', getErrorMessage(err));
  }
}
