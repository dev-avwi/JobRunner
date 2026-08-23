import { storage } from './storage';
import { sendEmail } from './emailService';
import { sendSMS as sendSms } from './twilioClient';
import { toGSM } from './services/smsService';
import Stripe from 'stripe';
import { PRICING } from '@workspace/db';
import type { User, BusinessSettings } from '@workspace/db';
import { sendPushNotification } from './pushNotifications';
import { getProductionBaseUrl } from './urlHelper';
import { getUncachableStripeClient } from './stripeClient';
import { getErrorMessage } from "./lib/errors";

let stripe: Stripe | null = null;
async function getStripe(): Promise<Stripe | null> {
  if (!stripe) {
    stripe = await getUncachableStripeClient();
  }
  return stripe;
}

const getBaseUrl = () => {
  return getProductionBaseUrl();
};

function calculateAmount(subscriptionTier: string, _seatCount: number = 0): number {
  if (subscriptionTier === 'pro') {
    return PRICING.pro.monthly / 100;
  }
  if (subscriptionTier === 'team') {
    return PRICING.team.monthly / 100;
  }
  if (subscriptionTier === 'business') {
    return PRICING.business.monthly / 100;
  }
  return 0;
}

function formatCardBrand(brand: string | null | undefined): string {
  if (!brand) return 'Card';
  const brands: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'American Express',
    discover: 'Discover',
    diners: 'Diners Club',
    jcb: 'JCB',
    unionpay: 'UnionPay',
  };
  return brands[brand.toLowerCase()] || brand;
}

async function sendBillingReminderEmail(
  user: User,
  settings: BusinessSettings,
  daysUntilBilling: number
): Promise<boolean> {
  if (!user.email) {
    console.log(`[BillingReminder] Skipping email for user ${user.id}: No email address`);
    return false;
  }

  const subscriptionTier = user.subscriptionTier || 'free';
  const subscriptionStatus = settings.subscriptionStatus || 'none';
  const amount = calculateAmount(subscriptionTier, settings.seatCount || 0);
  const cardBrand = formatCardBrand(settings.paymentMethodBrand);
  const cardLast4 = settings.paymentMethodLast4 || '****';
  const manageUrl = `${getBaseUrl()}/settings?tab=subscription`;
  const brandColor = settings.brandColor || '#2563eb';

  const isTrialing = subscriptionStatus === 'trialing';
  const planName = subscriptionTier === 'business' ? 'JobRunner Business' : subscriptionTier === 'team' ? 'JobRunner Team' : 'JobRunner Pro';

  const subject = isTrialing
    ? `Your JobRunner trial ends in ${daysUntilBilling} day${daysUntilBilling !== 1 ? 's' : ''}`
    : `Your JobRunner billing is coming up in ${daysUntilBilling} day${daysUntilBilling !== 1 ? 's' : ''}`;

  const headerMessage = isTrialing
    ? `Your free trial of ${planName} ends in ${daysUntilBilling} day${daysUntilBilling !== 1 ? 's' : ''}.`
    : `Your ${planName} subscription will renew in ${daysUntilBilling} day${daysUntilBilling !== 1 ? 's' : ''}.`;

  const actionMessage = isTrialing
    ? 'After your trial ends, your subscription will automatically continue and your saved payment method will be charged.'
    : 'Your saved payment method will be charged automatically.';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: ${brandColor}; margin: 0;">JobRunner</h1>
        <p style="margin: 5px 0 0 0; color: #666;">Billing Reminder</p>
      </div>

      <div style="margin-bottom: 20px;">
        <p style="font-size: 16px;">Hi ${user.firstName || 'there'},</p>
        <p>${headerMessage}</p>
        <p>${actionMessage}</p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 15px 0; color: #333;">Billing Summary</h3>
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0; color: #666;">Plan:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold;">${planName}</td>
          </tr>
          ${(subscriptionTier === 'team' || subscriptionTier === 'business') && (settings.seatCount || 0) > 0 ? `
          <tr>
            <td style="padding: 8px 0; color: #666;">Team Seats:</td>
            <td style="padding: 8px 0; text-align: right;">${settings.seatCount} additional</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 8px 0; color: #666;">Payment Method:</td>
            <td style="padding: 8px 0; text-align: right;">${cardBrand} ending in ${cardLast4}</td>
          </tr>
          <tr style="border-top: 2px solid ${brandColor};">
            <td style="padding: 12px 0; font-weight: bold; font-size: 18px;">Amount:</td>
            <td style="padding: 12px 0; text-align: right; font-weight: bold; font-size: 18px; color: ${brandColor};">$${amount.toFixed(2)} AUD</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${manageUrl}" style="background-color: ${brandColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold;">
          Manage Subscription
        </a>
        <p style="margin-top: 12px; color: #666; font-size: 14px;">Update your payment method or change your plan</p>
      </div>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px;">
        <p style="margin: 0;">Powered by <strong>JobRunner</strong> | The business management platform for Australian tradies</p>
        <p style="margin: 10px 0 0 0; font-size: 11px; color: #888;">
          This is a transactional email regarding your subscription billing.
        </p>
      </div>
    </body>
    </html>
  `;

  try {
    const result = await sendEmail({
      to: user.email,
      subject,
      html,
    });

    if (result.success) {
      console.log(`[BillingReminder] Email sent to ${user.email} (${daysUntilBilling} days before billing)`);
      return true;
    } else {
      console.error(`[BillingReminder] Failed to send email to ${user.email}:`, result.error);
      return false;
    }
  } catch (error: unknown) {
    console.error(`[BillingReminder] Error sending email to ${user.email}:`, getErrorMessage(error));
    return false;
  }
}

async function sendBillingReminderSms(
  user: User,
  settings: BusinessSettings,
  daysUntilBilling: number
): Promise<boolean> {
  const phone = settings.phone;
  if (!phone) {
    console.log(`[BillingReminder] Skipping SMS for user ${user.id}: No phone number`);
    return false;
  }

  const subscriptionTier = user.subscriptionTier || 'free';
  const subscriptionStatus = settings.subscriptionStatus || 'none';
  const amount = calculateAmount(subscriptionTier, settings.seatCount || 0);
  const isTrialing = subscriptionStatus === 'trialing';

  let message: string;
  if (isTrialing) {
    if (daysUntilBilling <= 1) {
      message = `JobRunner: Your trial ends tomorrow. Don't lose access to your data — upgrade now. jobrunner.com.au/billing`;
    } else {
      message = `JobRunner: Your free trial ends in ${daysUntilBilling} days. Add payment details to keep access to all your jobs, quotes and invoices. jobrunner.com.au/billing`;
    }
  } else {
    message = `JobRunner: Your subscription renews in ${daysUntilBilling} day${daysUntilBilling !== 1 ? 's' : ''} ($${amount.toFixed(2)} AUD). Manage at jobrunner.com.au/billing`;
  }

  try {
    const result = await sendSms({
      to: phone,
      message: toGSM(message),
      alphanumericSenderId: 'JobRunner',
    });

    if (result.success) {
      console.log(`[BillingReminder] SMS sent to ${phone} (${daysUntilBilling} days before billing)${result.simulated ? ' [SIMULATED]' : ''}`);
      return true;
    } else {
      console.error(`[BillingReminder] Failed to send SMS to ${phone}:`, result.error);
      return false;
    }
  } catch (error: unknown) {
    console.error(`[BillingReminder] Error sending SMS to ${phone}:`, getErrorMessage(error));
    return false;
  }
}

export async function processBillingReminders(): Promise<{
  processed: number;
  emailsSent: number;
  smsSent: number;
  errors: number;
}> {
  console.log('[BillingReminder] Starting billing reminder processing...');
  
  const stats = {
    processed: 0,
    emailsSent: 0,
    smsSent: 0,
    errors: 0,
  };

  try {
    const allBusinessSettings = await storage.getAllBusinessSettings();
    
    if (!allBusinessSettings || allBusinessSettings.length === 0) {
      console.log('[BillingReminder] No business settings found');
      return stats;
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const settings of allBusinessSettings) {
      try {
        const subscriptionStatus = settings.subscriptionStatus;
        if (subscriptionStatus !== 'active' && subscriptionStatus !== 'trialing') {
          continue;
        }

        if (!settings.billingRemindersEnabled) {
          continue;
        }

        const nextBillingDate = settings.nextBillingDate;
        if (!nextBillingDate) {
          continue;
        }

        const billingDate = new Date(nextBillingDate);
        billingDate.setHours(0, 0, 0, 0);
        const timeDiff = billingDate.getTime() - now.getTime();
        const daysUntilBilling = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        if (daysUntilBilling < 0) {
          continue;
        }

        const billingReminderDays = (settings.billingReminderDays as number[]) || [3, 1];
        if (!billingReminderDays.includes(daysUntilBilling)) {
          continue;
        }

        const lastReminderSent = settings.lastBillingReminderSentAt;
        if (lastReminderSent) {
          const lastReminderDate = new Date(lastReminderSent);
          lastReminderDate.setHours(0, 0, 0, 0);
          if (lastReminderDate.getTime() === now.getTime()) {
            console.log(`[BillingReminder] Skipping user ${settings.userId}: Already sent reminder today`);
            continue;
          }
        }

        const user = await storage.getUser(settings.userId);
        if (!user || !user.isActive) {
          continue;
        }

        stats.processed++;
        console.log(`[BillingReminder] Processing reminder for user ${user.id} (${daysUntilBilling} days until billing)`);

        const emailSent = await sendBillingReminderEmail(user, settings, daysUntilBilling);
        if (emailSent) {
          stats.emailsSent++;
        }

        const smsSent = await sendBillingReminderSms(user, settings, daysUntilBilling);
        if (smsSent) {
          stats.smsSent++;
        }

        if (emailSent || smsSent) {
          await storage.updateBusinessSettings(settings.userId, {
            lastBillingReminderSentAt: new Date(),
          });
          
          // Send push notification for billing reminder
          try {
            const subscriptionTier = user.subscriptionTier || 'free';
            const subscriptionStatus = settings.subscriptionStatus || 'none';
            const isTrialing = subscriptionStatus === 'trialing';
            const planName = subscriptionTier === 'business' ? 'Business' : subscriptionTier === 'team' ? 'Team' : 'Pro';
            
            await sendPushNotification({
              userId: user.id,
              type: 'general',
              title: isTrialing ? 'Trial Ending Soon' : 'Billing Reminder',
              body: isTrialing 
                ? `Your ${planName} trial ends in ${daysUntilBilling} day${daysUntilBilling !== 1 ? 's' : ''}`
                : `Your ${planName} subscription renews in ${daysUntilBilling} day${daysUntilBilling !== 1 ? 's' : ''}`,
              data: { type: 'billing_reminder', daysUntilBilling },
            });
            console.log(`[PushNotification] Sent billing reminder notification to user ${user.id}`);
          } catch (pushError) {
            console.error('[PushNotification] Error sending billing reminder notification:', pushError);
          }
        }

      } catch (error: unknown) {
        console.error(`[BillingReminder] Error processing settings ${settings.id}:`, getErrorMessage(error));
        stats.errors++;
      }
    }

    console.log(`[BillingReminder] Completed. Processed: ${stats.processed}, Emails: ${stats.emailsSent}, SMS: ${stats.smsSent}, Errors: ${stats.errors}`);
    return stats;

  } catch (error: unknown) {
    console.error('[BillingReminder] Fatal error:', getErrorMessage(error));
    stats.errors++;
    return stats;
  }
}

async function sendOverdueReminderEmail(
  user: User,
  settings: BusinessSettings,
  daysOverdue: number
): Promise<boolean> {
  if (!user.email) return false;

  const subscriptionTier = user.subscriptionTier || 'free';
  const amount = calculateAmount(subscriptionTier, settings.seatCount || 0);
  const planName = subscriptionTier === 'business' ? 'JobRunner Business' : subscriptionTier === 'team' ? 'JobRunner Team' : 'JobRunner Pro';
  const manageUrl = `${getBaseUrl()}/settings?tab=subscription`;
  const brandColor = settings.brandColor || '#2563eb';

  const urgencyLevel = daysOverdue >= 14 ? 'final' : daysOverdue >= 7 ? 'urgent' : 'reminder';
  const subjects: Record<string, string> = {
    reminder: `Action required: Your JobRunner payment is overdue`,
    urgent: `Urgent: Your JobRunner account will be restricted`,
    final: `Final notice: Your JobRunner account has been restricted`,
  };
  const subject = subjects[urgencyLevel];

  const statusMessages: Record<string, string> = {
    reminder: `Your ${planName} payment of <strong>$${amount.toFixed(2)} AUD</strong> failed ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} ago. Please update your payment method to continue using all features.`,
    urgent: `Your ${planName} subscription is <strong>${daysOverdue} days overdue</strong>. Your account features have been restricted to the free plan. Update your payment method now to restore full access.`,
    final: `Your ${planName} subscription is <strong>${daysOverdue} days overdue</strong>. Your account is currently restricted. All Pro/Team features are unavailable until payment is resolved.`,
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: ${urgencyLevel === 'final' ? '#dc2626' : urgencyLevel === 'urgent' ? '#f59e0b' : '#f8f9fa'}; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: ${urgencyLevel === 'reminder' ? brandColor : '#fff'}; margin: 0;">JobRunner</h1>
        <p style="margin: 5px 0 0 0; color: ${urgencyLevel === 'reminder' ? '#666' : '#fff'};">Payment ${urgencyLevel === 'final' ? 'Final Notice' : urgencyLevel === 'urgent' ? 'Urgent Notice' : 'Overdue'}</p>
      </div>

      <div style="margin-bottom: 20px;">
        <p style="font-size: 16px;">Hi ${user.firstName || 'there'},</p>
        <p>${statusMessages[urgencyLevel]}</p>
      </div>

      <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
        <h3 style="margin: 0 0 10px 0; color: #dc2626;">What happens next?</h3>
        <ul style="margin: 0; padding-left: 20px; color: #666;">
          <li>Your account is restricted to free-tier limits</li>
          <li>AI features, advanced reporting, and team features are unavailable</li>
          <li>Your existing data is safe and will be fully restored when you pay</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${manageUrl}" style="background-color: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: bold;">
          Update Payment Method
        </a>
        <p style="margin-top: 12px; color: #666; font-size: 14px;">Resolve your payment to restore full access</p>
      </div>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px;">
        <p style="margin: 0;">Powered by <strong>JobRunner</strong> | The business management platform for Australian tradies</p>
        <p style="margin: 10px 0 0 0; font-size: 11px; color: #888;">
          This is a transactional email regarding your subscription billing.
        </p>
      </div>
    </body>
    </html>
  `;

  try {
    const result = await sendEmail({ to: user.email, subject, html });
    if (result.success) {
      console.log(`[OverdueReminder] Email sent to ${user.email} (${daysOverdue} days overdue)`);
      return true;
    }
    console.error(`[OverdueReminder] Failed to send email to ${user.email}:`, result.error);
    return false;
  } catch (error: unknown) {
    console.error(`[OverdueReminder] Error sending email to ${user.email}:`, getErrorMessage(error));
    return false;
  }
}

async function sendOverdueReminderSms(
  user: User,
  settings: BusinessSettings,
  daysOverdue: number
): Promise<boolean> {
  const phone = settings.phone;
  if (!phone) return false;

  let message: string;
  const subscriptionTier = user.subscriptionTier || 'free';
  const planName = subscriptionTier === 'business' ? 'Business' : subscriptionTier === 'team' ? 'Team' : subscriptionTier === 'pro' ? 'Pro' : 'your';

  if (daysOverdue >= 14) {
    message = `JobRunner: Your ${planName} plan is ${daysOverdue} days overdue. Update your card to keep access. jobrunner.com.au/billing`;
  } else if (daysOverdue >= 7) {
    message = `JobRunner: We couldn't process your payment for ${planName} plan. Update your card to keep access. jobrunner.com.au/billing`;
  } else {
    message = `JobRunner: We couldn't process your payment for ${planName} plan. Update your card to keep access. jobrunner.com.au/billing`;
  }

  try {
    const result = await sendSms({
      to: phone,
      message: toGSM(message),
      alphanumericSenderId: 'JobRunner',
    });
    if (result.success) {
      console.log(`[OverdueReminder] SMS sent to ${phone} (${daysOverdue} days overdue)${result.simulated ? ' [SIMULATED]' : ''}`);
      return true;
    }
    console.error(`[OverdueReminder] Failed to send SMS to ${phone}:`, result.error);
    return false;
  } catch (error: unknown) {
    console.error(`[OverdueReminder] Error sending SMS to ${phone}:`, getErrorMessage(error));
    return false;
  }
}

export async function processOverdueReminders(): Promise<{
  processed: number;
  emailsSent: number;
  smsSent: number;
  errors: number;
}> {
  console.log('[OverdueReminder] Starting overdue payment reminder processing...');

  const stats = { processed: 0, emailsSent: 0, smsSent: 0, errors: 0 };

  try {
    const allBusinessSettings = await storage.getAllBusinessSettings();
    if (!allBusinessSettings || allBusinessSettings.length === 0) return stats;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const overdueReminderDays = [1, 3, 7, 14, 21];

    for (const settings of allBusinessSettings) {
      try {
        if (settings.subscriptionStatus !== 'past_due') continue;

        const nextBillingDate = settings.nextBillingDate;
        if (!nextBillingDate) continue;

        const billingDate = new Date(nextBillingDate);
        billingDate.setHours(0, 0, 0, 0);
        const timeDiff = now.getTime() - billingDate.getTime();
        const daysOverdue = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

        if (daysOverdue < 1) continue;

        if (!overdueReminderDays.includes(daysOverdue)) continue;

        const lastReminderSent = settings.lastBillingReminderSentAt;
        if (lastReminderSent) {
          const lastDate = new Date(lastReminderSent);
          lastDate.setHours(0, 0, 0, 0);
          if (lastDate.getTime() === now.getTime()) continue;
        }

        const user = await storage.getUser(settings.userId);
        if (!user || !user.isActive) continue;

        stats.processed++;
        console.log(`[OverdueReminder] Processing for user ${user.id} (${daysOverdue} days overdue)`);

        const emailSent = await sendOverdueReminderEmail(user, settings, daysOverdue);
        if (emailSent) stats.emailsSent++;

        const smsSent = await sendOverdueReminderSms(user, settings, daysOverdue);
        if (smsSent) stats.smsSent++;

        if (emailSent || smsSent) {
          await storage.updateBusinessSettings(settings.userId, {
            lastBillingReminderSentAt: new Date(),
          });

          try {
            await sendPushNotification({
              userId: user.id,
              type: 'general',
              title: daysOverdue >= 7 ? 'Account Restricted' : 'Payment Overdue',
              body: daysOverdue >= 7
                ? `Your account is restricted. Payment is ${daysOverdue} days overdue.`
                : `Your payment failed ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} ago. Update your payment method.`,
              data: { type: 'payment_overdue', daysOverdue },
            });
          } catch (pushError) {
            console.error('[OverdueReminder] Push notification error:', pushError);
          }
        }
      } catch (error: unknown) {
        console.error(`[OverdueReminder] Error processing settings ${settings.id}:`, getErrorMessage(error));
        stats.errors++;
      }
    }

    console.log(`[OverdueReminder] Completed. Processed: ${stats.processed}, Emails: ${stats.emailsSent}, SMS: ${stats.smsSent}, Errors: ${stats.errors}`);
    return stats;
  } catch (error: unknown) {
    console.error('[OverdueReminder] Fatal error:', getErrorMessage(error));
    stats.errors++;
    return stats;
  }
}

export async function runDailyBillingReminders(): Promise<{
  processed: number;
  emailsSent: number;
  smsSent: number;
  errors: number;
}> {
  console.log('[BillingReminder] Running daily billing reminder check...');
  const upcomingStats = await processBillingReminders();
  const overdueStats = await processOverdueReminders();

  const combinedStats = {
    processed: upcomingStats.processed + overdueStats.processed,
    emailsSent: upcomingStats.emailsSent + overdueStats.emailsSent,
    smsSent: upcomingStats.smsSent + overdueStats.smsSent,
    errors: upcomingStats.errors + overdueStats.errors,
  };

  console.log('[BillingReminder] Daily check complete:', combinedStats);
  return combinedStats;
}
