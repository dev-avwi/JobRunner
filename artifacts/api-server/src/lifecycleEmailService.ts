import { db } from './storage';
import { users, jobs, quotes, invoices, clients } from '@workspace/db';
import { eq, sql, and, gt, isNull, isNotNull, count, inArray } from 'drizzle-orm';
import { sendSystemEmail } from './emailService';
import { logger } from './logger';
import { getProductionBaseUrl } from './urlHelper';

const BRAND_BLUE = '#2563EB';

// Absolute logo URL — relative URLs do not work in email clients
function lifecycleLogoUrl(): string {
  return `${getProductionBaseUrl()}/logo.png`;
}

// One consistent primary CTA button used across every lifecycle email
function lifecycleButton(text: string, url: string): string {
  return `
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
          <tr>
            <td align="center">
              <a href="${url}" style="display: inline-block; background-color: ${BRAND_BLUE}; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 16px; font-weight: 600; line-height: 1;">${text}</a>
            </td>
          </tr>
        </table>`;
}

// Shared, email-client-safe shell matching the JobRunner design language
function lifecycleEmailShell(heading: string, innerContent: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
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
</head>
<body style="margin: 0; padding: 0; width: 100% !important; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
          <tr>
            <td style="height: 4px; line-height: 4px; font-size: 0; background-color: ${BRAND_BLUE};">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 0 32px;">
              <img src="${lifecycleLogoUrl()}" alt="JobRunner" style="max-height: 44px; max-width: 180px; display: block; margin-bottom: 16px;" />
              <p style="margin: 0; color: #0f172a; font-size: 19px; font-weight: 700; line-height: 1.3;">JobRunner</p>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px;">Built for Australian tradies</p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 24px; border-top: 1px solid #e2e8f0;">
                <tr>
                  <td style="padding-top: 20px;">
                    <p style="margin: 0; color: #0f172a; font-size: 20px; font-weight: 700; line-height: 1.3;">${heading}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px 32px 32px;">
              ${innerContent}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

interface LifecycleEmailsSent {
  welcome_day1?: string;
  nudge_day3?: string;
  nudge_day7?: string;
  nudge_day14?: string;
  nudge_day30?: string;
  churn_risk_day21?: string;
  win_back_day45?: string;
}

interface UserWithMilestones {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date | null;
  lifecycleEmailsSent: LifecycleEmailsSent;
  lastLifecycleEmailAt: Date | null;
  subscriptionTier: string | null;
  jobCount: number;
  quoteCount: number;
  invoiceCount: number;
  clientCount: number;
}

const LIFECYCLE_EMAILS = [
  {
    key: 'nudge_day3',
    daysSinceSignup: 3,
    minDaysSinceLastEmail: 2,
    condition: (user: UserWithMilestones) => user.clientCount === 0,
    subject: (user: UserWithMilestones) => `${getFirstName(user)}, let's add your first client`,
    body: (user: UserWithMilestones) => lifecycleEmailShell('Let\'s add your first client', `
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.6;">G'day ${getFirstName(user)},</p>
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.6;">You signed up for JobRunner a few days ago &mdash; nice one. The quickest way to see the value is to add your first client and create a job.</p>
              <p style="margin: 0 0 12px 0; color: #475569; font-size: 15px; line-height: 1.6;">It takes about 30 seconds:</p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 0 0 16px 0;">
                <tr>
                  <td style="padding: 18px 20px;">
                    <p style="margin: 0 0 10px 0; color: #475569; font-size: 15px; line-height: 1.5;"><strong style="color: #0f172a;">1.</strong>&nbsp;&nbsp;Open JobRunner and tap <strong style="color: #0f172a;">Clients</strong></p>
                    <p style="margin: 0 0 10px 0; color: #475569; font-size: 15px; line-height: 1.5;"><strong style="color: #0f172a;">2.</strong>&nbsp;&nbsp;Add a client name and phone number</p>
                    <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.5;"><strong style="color: #0f172a;">3.</strong>&nbsp;&nbsp;Create a job for that client</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px 0; color: #475569; font-size: 15px; line-height: 1.6;">Once you've got a job in there, everything else &mdash; quotes, invoices, scheduling &mdash; flows from that.</p>
              ${lifecycleButton('Open JobRunner', 'https://jobrunner.com.au')}
              <p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">Stuck? Email us at admin@avwebinnovation.com and we'll personally help you get set up.<br/>&mdash; The JobRunner Team</p>
    `),
  },
  {
    key: 'nudge_day7',
    daysSinceSignup: 7,
    minDaysSinceLastEmail: 3,
    condition: (user: UserWithMilestones) => user.quoteCount === 0,
    subject: (user: UserWithMilestones) => `${getFirstName(user)}, send your first quote in under a minute`,
    body: (user: UserWithMilestones) => lifecycleEmailShell('Send your first quote in under a minute', `
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.6;">Hey ${getFirstName(user)},</p>
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.6;">You've been on JobRunner for a week now. The tradies who get the most value are the ones who send their first quote early &mdash; it's the moment the app starts saving you real time.</p>
              <p style="margin: 0 0 12px 0; color: #475569; font-size: 15px; line-height: 1.6;">Here's what makes JobRunner quotes different:</p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 0 0 16px 0;">
                <tr>
                  <td style="padding: 18px 20px;">
                    <p style="margin: 0 0 10px 0; color: #475569; font-size: 15px; line-height: 1.5;"><strong style="color: #0f172a;">Professional PDF</strong> &mdash; branded with your logo and ABN</p>
                    <p style="margin: 0 0 10px 0; color: #475569; font-size: 15px; line-height: 1.5;"><strong style="color: #0f172a;">One-tap send</strong> &mdash; email or SMS straight to the client</p>
                    <p style="margin: 0 0 10px 0; color: #475569; font-size: 15px; line-height: 1.5;"><strong style="color: #0f172a;">Track status</strong> &mdash; see when they view and accept it</p>
                    <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.5;"><strong style="color: #0f172a;">Convert to invoice</strong> &mdash; one click when the job's done</p>
                  </td>
                </tr>
              </table>
              ${lifecycleButton('Create a Quote', 'https://jobrunner.com.au')}
              <p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">Need a hand? Email us at admin@avwebinnovation.com.<br/>&mdash; The JobRunner Team</p>
    `),
  },
  {
    key: 'nudge_day14',
    daysSinceSignup: 14,
    minDaysSinceLastEmail: 5,
    condition: (user: UserWithMilestones) => user.invoiceCount === 0,
    subject: (user: UserWithMilestones) => `${getFirstName(user)}, get paid faster with JobRunner invoices`,
    body: (user: UserWithMilestones) => lifecycleEmailShell('Get paid faster with JobRunner invoices', `
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.6;">Hey ${getFirstName(user)},</p>
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.6;">Two weeks in and you haven't sent an invoice yet &mdash; that's where the real magic happens.</p>
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.6;">JobRunner invoices let your clients pay online with a card. No more chasing bank transfers or waiting for direct deposits.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 0 0 16px 0;">
                <tr>
                  <td style="padding: 18px 20px;">
                    <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.6;"><strong style="color: #0f172a;">Pro tip:</strong> If you've already got a quote in the system, you can convert it to an invoice with one tap.</p>
                  </td>
                </tr>
              </table>
              ${lifecycleButton('Send Your First Invoice', 'https://jobrunner.com.au')}
              <p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">Questions about getting paid through JobRunner? Email us at admin@avwebinnovation.com &mdash; happy to walk you through it.<br/>&mdash; The JobRunner Team</p>
    `),
  },
  {
    key: 'churn_risk_day21',
    daysSinceSignup: 21,
    minDaysSinceLastEmail: 5,
    condition: (user: UserWithMilestones) => user.jobCount <= 1 && user.quoteCount === 0,
    subject: (user: UserWithMilestones) => `${getFirstName(user)}, is JobRunner right for your business?`,
    body: (user: UserWithMilestones) => lifecycleEmailShell('Is JobRunner right for your business?', `
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.6;">Hey ${getFirstName(user)},</p>
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.6;">I noticed you signed up for JobRunner three weeks ago but haven't used it much yet. No worries &mdash; I wanted to check in and see if there's anything stopping you from getting started.</p>
              <p style="margin: 0 0 12px 0; color: #475569; font-size: 15px; line-height: 1.6;">Common things I hear from tradies:</p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 0 0 16px 0;">
                <tr>
                  <td style="padding: 18px 20px;">
                    <p style="margin: 0 0 12px 0; color: #475569; font-size: 15px; line-height: 1.6;"><strong style="color: #0f172a;">"I'm too busy right now"</strong> &mdash; Fair enough. The app is always here when you're ready. It takes 5 minutes to set up properly.</p>
                    <p style="margin: 0 0 12px 0; color: #475569; font-size: 15px; line-height: 1.6;"><strong style="color: #0f172a;">"I'm not sure how to use it"</strong> &mdash; Email us at admin@avwebinnovation.com and we'll personally walk you through it.</p>
                    <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.6;"><strong style="color: #0f172a;">"It's missing something I need"</strong> &mdash; Tell us what and we'll see what we can do.</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.6;">Either way, your account is here whenever you need it. No pressure.</p>
              <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.6;"><strong style="color: #0f172a;">P.S.</strong> If you want, I can jump on a quick call and set the whole thing up for you in 10 minutes. Just email admin@avwebinnovation.com and we'll sort a time.</p>
              <p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">&mdash; The JobRunner Team</p>
    `),
  },
  {
    key: 'nudge_day30',
    daysSinceSignup: 30,
    minDaysSinceLastEmail: 7,
    condition: (user: UserWithMilestones) => user.jobCount >= 3 && user.subscriptionTier === 'free',
    subject: (user: UserWithMilestones) => `${getFirstName(user)}, you're getting real value from JobRunner`,
    body: (user: UserWithMilestones) => lifecycleEmailShell(`Nice work, ${getFirstName(user)}`, `
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.6;">You've created ${user.jobCount} jobs in JobRunner this month &mdash; that's solid. You're clearly using it for real work.</p>
              <p style="margin: 0 0 16px 0; color: #475569; font-size: 15px; line-height: 1.6;">On the free plan you're limited to 25 jobs per month. As your business grows, the Pro plan gives you:</p>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 0 0 16px 0;">
                <tr>
                  <td style="padding: 18px 20px;">
                    <p style="margin: 0 0 8px 0; color: #475569; font-size: 15px; line-height: 1.5;">Unlimited jobs, quotes, and invoices</p>
                    <p style="margin: 0 0 8px 0; color: #475569; font-size: 15px; line-height: 1.5;">SMS notifications to clients</p>
                    <p style="margin: 0 0 8px 0; color: #475569; font-size: 15px; line-height: 1.5;">Custom branding on all documents</p>
                    <p style="margin: 0 0 8px 0; color: #475569; font-size: 15px; line-height: 1.5;">Xero integration</p>
                    <p style="margin: 0 0 8px 0; color: #475569; font-size: 15px; line-height: 1.5;">AI assistant for quotes and job descriptions</p>
                    <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.5;">Online payments via Stripe</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px 0; color: #475569; font-size: 15px; line-height: 1.6;">You can upgrade any time from the app &mdash; no lock-in, cancel whenever.</p>
              ${lifecycleButton('See Pro Plan', 'https://jobrunner.com.au')}
              <p style="margin: 24px 0 0 0; color: #94a3b8; font-size: 13px; line-height: 1.6;">&mdash; The JobRunner Team</p>
    `),
  },
];

function getFirstName(user: UserWithMilestones): string {
  if (!user.firstName) return 'mate';
  const parts = user.firstName.trim().split(' ');
  return parts[0] || 'mate';
}

function daysSince(date: Date | null): number {
  if (!date) return 0;
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

async function getUsersWithMilestones(): Promise<UserWithMilestones[]> {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      createdAt: users.createdAt,
      lifecycleEmailsSent: users.lifecycleEmailsSent,
      lastLifecycleEmailAt: users.lastLifecycleEmailAt,
      subscriptionTier: users.subscriptionTier,
    })
    .from(users)
    .where(
      and(
        isNotNull(users.email),
        eq(users.emailVerified, true),
        isNotNull(users.createdAt),
        gt(users.createdAt, sixtyDaysAgo)
      )
    );

  // Filter out demo/admin accounts before any per-user work
  const candidates = allUsers.filter(
    (u) => u.email && !u.email.includes('demo@') && !u.email.includes('admin@avweb')
  );

  if (candidates.length === 0) return [];

  // Aggregate all counts in 4 grouped queries instead of 4 queries PER user.
  // The previous N+1 pattern ran hundreds of sequential queries and starved the
  // Neon connection pool, causing "Connection terminated due to connection timeout".
  const userIds = candidates.map((u) => u.id);

  const countByUser = async (table: typeof jobs | typeof quotes | typeof invoices | typeof clients) => {
    const rows = await db
      .select({ userId: table.userId, value: count() })
      .from(table)
      .where(inArray(table.userId, userIds))
      .groupBy(table.userId);
    const map = new Map<string, number>();
    for (const row of rows) {
      if (row.userId) map.set(row.userId, Number(row.value) || 0);
    }
    return map;
  };

  const [jobCounts, quoteCounts, invoiceCounts, clientCounts] = await Promise.all([
    countByUser(jobs),
    countByUser(quotes),
    countByUser(invoices),
    countByUser(clients),
  ]);

  return candidates.map((user) => ({
    id: user.id,
    email: user.email!,
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt,
    lifecycleEmailsSent: (user.lifecycleEmailsSent as LifecycleEmailsSent) ?? {},
    lastLifecycleEmailAt: user.lastLifecycleEmailAt,
    subscriptionTier: user.subscriptionTier,
    jobCount: jobCounts.get(user.id) || 0,
    quoteCount: quoteCounts.get(user.id) || 0,
    invoiceCount: invoiceCounts.get(user.id) || 0,
    clientCount: clientCounts.get(user.id) || 0,
  }));
}

async function sendLifecycleEmail(user: UserWithMilestones, emailConfig: typeof LIFECYCLE_EMAILS[0]): Promise<boolean> {
  try {
    await sendSystemEmail({
      to: user.email,
      subject: emailConfig.subject(user),
      html: emailConfig.body(user),
    });

    const updatedSent = { ...(user.lifecycleEmailsSent ?? {}), [emailConfig.key]: new Date().toISOString() };
    await db
      .update(users)
      .set({
        lifecycleEmailsSent: updatedSent,
        lastLifecycleEmailAt: new Date(),
      })
      .where(eq(users.id, user.id));
    const { invalidateUser } = await import('./cache');
    invalidateUser(user.id);

    logger.info('email', `[Lifecycle] Sent ${emailConfig.key} to ${user.email}`);
    return true;
  } catch (error) {
    logger.error('email', `[Lifecycle] Failed to send ${emailConfig.key} to ${user.email}`, { error });
    return false;
  }
}

export async function processLifecycleEmails(): Promise<void> {
  try {
    const usersToProcess = await getUsersWithMilestones();
    let sent = 0;

    for (const user of usersToProcess) {
      const userAge = daysSince(user.createdAt);
      const daysSinceLastEmail = user.lastLifecycleEmailAt ? daysSince(user.lastLifecycleEmailAt) : 999;

      for (const emailConfig of LIFECYCLE_EMAILS) {
        if (user.lifecycleEmailsSent[emailConfig.key as keyof LifecycleEmailsSent]) continue;
        if (userAge < emailConfig.daysSinceSignup) continue;
        if (daysSinceLastEmail < emailConfig.minDaysSinceLastEmail) continue;
        if (!emailConfig.condition(user)) continue;

        const success = await sendLifecycleEmail(user, emailConfig);
        if (success) {
          sent++;
          break;
        }
      }
    }

    if (sent > 0) {
      logger.info('email', `[Lifecycle] Processed ${usersToProcess.length} users, sent ${sent} emails`);
    }
  } catch (error) {
    logger.error('email', '[Lifecycle] Error processing lifecycle emails', { error });
  }
}

export function startLifecycleEmailScheduler(): void {
  const INTERVAL = 6 * 60 * 60 * 1000;

  console.log('[Lifecycle] Starting lifecycle email scheduler...');
  processLifecycleEmails();
  setInterval(processLifecycleEmails, INTERVAL);
  console.log('[Lifecycle] Lifecycle email scheduler running every 6 hours');
}
