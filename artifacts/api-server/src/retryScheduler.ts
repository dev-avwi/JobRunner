import { getErrorMessage } from "./lib/errors";
import { db } from "./storage";
import { smsMessages, smsConversations, emailDeliveryLogs } from "@workspace/db";
import { eq, and, lte, lt, sql, isNotNull } from "drizzle-orm";
import { sendSMS } from "./twilioClient";
import { logger } from "./logger";
import { sendViaSendGrid, scheduleEmailRetry, isPermanentEmailFailure } from "./emailService";

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [60_000, 300_000, 900_000]; // 1min, 5min, 15min

let isProcessing = false;
let isProcessingEmail = false;
let emailCycleCounter = 0;

export function scheduleRetry(retryCount: number): Date {
  const delayMs = RETRY_DELAYS_MS[Math.min(retryCount, RETRY_DELAYS_MS.length - 1)];
  return new Date(Date.now() + delayMs);
}

export async function processFailedSmsMessages() {
  if (isProcessing) return;
  isProcessing = true;
  try {
    const now = new Date();

    const failedMessages = await db
      .select({
        id: smsMessages.id,
        body: smsMessages.body,
        retryCount: smsMessages.retryCount,
        conversationId: smsMessages.conversationId,
        clientPhone: smsConversations.clientPhone,
        businessOwnerId: smsConversations.businessOwnerId,
      })
      .from(smsMessages)
      .innerJoin(smsConversations, eq(smsMessages.conversationId, smsConversations.id))
      .where(and(
        eq(smsMessages.status, 'failed'),
        eq(smsMessages.direction, 'outbound'),
        lt(sql`coalesce(${smsMessages.retryCount}, 0)`, MAX_RETRY_ATTEMPTS),
        isNotNull(smsMessages.nextRetryAt),
        lte(smsMessages.nextRetryAt, now),
      ))
      .limit(10);

    if (failedMessages.length === 0) return;

    logger.info('background', `Processing ${failedMessages.length} failed SMS for retry`);

    for (const msg of failedMessages) {
      const currentRetry = (msg.retryCount ?? 0) + 1;

      const claimed = await db.update(smsMessages).set({
        status: 'retrying' as any,
        retryCount: currentRetry,
      }).where(and(
        eq(smsMessages.id, msg.id),
        eq(smsMessages.status, 'failed'),
      )).returning({ id: smsMessages.id });

      if (claimed.length === 0) continue;

      try {
        // Business SMS must only ever send from the business's own dedicated
        // number - never the shared platform number.
        const { storage } = await import("./storage");
        const settings = await storage.getBusinessSettings(msg.businessOwnerId);
        if (!settings?.dedicatedPhoneNumber) {
          await db.update(smsMessages).set({
            status: 'failed',
            errorMessage: 'No dedicated business number configured',
            nextRetryAt: null,
            retryCount: MAX_RETRY_ATTEMPTS,
          }).where(eq(smsMessages.id, msg.id));
          continue;
        }
        const result = await sendSMS({
          to: msg.clientPhone,
          message: msg.body,
          fromNumber: settings.dedicatedPhoneNumber,
        });

        if (result.success) {
          await db.update(smsMessages).set({
            status: 'sent',
            twilioSid: result.messageId,
            errorMessage: null,
            nextRetryAt: null,
          }).where(eq(smsMessages.id, msg.id));

          logger.info('sms', `SMS retry #${currentRetry} succeeded`, { metadata: { messageId: msg.id } });
        } else {
          const nextRetryAt = currentRetry < MAX_RETRY_ATTEMPTS ? scheduleRetry(currentRetry) : null;
          await db.update(smsMessages).set({
            status: 'failed',
            nextRetryAt,
            errorMessage: result.error || 'Retry failed',
          }).where(eq(smsMessages.id, msg.id));

          if (currentRetry >= MAX_RETRY_ATTEMPTS) {
            logger.warn('sms', `SMS permanently failed after ${MAX_RETRY_ATTEMPTS} attempts`, {
              metadata: { messageId: msg.id, error: result.error },
            });
          }
        }
      } catch (error) {
        logger.error('sms', `SMS retry error for message ${msg.id}`, { error });
        const nextRetryAt = currentRetry < MAX_RETRY_ATTEMPTS ? scheduleRetry(currentRetry) : null;
        await db.update(smsMessages).set({
          status: 'failed',
          nextRetryAt,
          errorMessage: error instanceof Error ? error.message : 'Unknown retry error',
        }).where(eq(smsMessages.id, msg.id));
      }
    }
  } catch (error: any) {
    const msg = getErrorMessage(error) || '';
    if (msg.includes('does not exist') || msg.includes('relation')) {
      // Table not yet created — skip silently
    } else if (
      msg.includes('Connection terminated') ||
      msg.includes('connection timeout') ||
      msg.includes('terminating connection') ||
      msg.includes('ECONNRESET') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('socket hang up') ||
      error?.code === 'ECONNRESET' ||
      error?.code === 'ETIMEDOUT' ||
      // 57P01 = administrator_shutdown — Neon killed an idle connection in the pool
      error?.code === '57P01'
    ) {
      // Transient Neon pool drop — log warn, skip alert. Will retry next tick.
      logger.warn('background', 'SMS retry scheduler skipped tick (transient DB connection)', { metadata: { error: msg } });
    } else {
      logger.error('background', 'Failed SMS retry scheduler error', { error });
    }
  } finally {
    isProcessing = false;
  }
}

async function recoverStrandedMessages() {
  try {
    const recovered = await db.update(smsMessages).set({
      status: 'failed',
    }).where(
      eq(smsMessages.status, 'retrying' as any),
    ).returning({ id: smsMessages.id });

    if (recovered.length > 0) {
      logger.warn('background', `Recovered ${recovered.length} stranded SMS messages from 'retrying' state`);
    }
  } catch (error: unknown) {
    const m = getErrorMessage(error) || '';
    if (!m.includes('does not exist') && !m.includes('relation')) {
      logger.error('background', 'Failed to recover stranded SMS messages', { error });
    }
  }
}

export async function processFailedEmailMessages() {
  if (isProcessingEmail) return;
  isProcessingEmail = true;
  try {
    const now = new Date();
    const failed = await db
      .select()
      .from(emailDeliveryLogs)
      .where(and(
        eq(emailDeliveryLogs.status, 'failed'),
        eq(emailDeliveryLogs.permanentlyFailed, false),
        isNotNull(emailDeliveryLogs.nextRetryAt),
        lte(emailDeliveryLogs.nextRetryAt, now),
        lt(sql`coalesce(${emailDeliveryLogs.retryCount}, 0)`, sql`coalesce(${emailDeliveryLogs.maxRetries}, 5)`),
      ))
      .limit(10);

    if (failed.length === 0) return;
    logger.info('background', `Processing ${failed.length} failed emails for retry`);

    for (const row of failed) {
      const currentRetry = (row.retryCount ?? 0) + 1;
      const claimed = await db.update(emailDeliveryLogs).set({
        status: 'retrying' as any,
        retryCount: currentRetry,
      }).where(and(
        eq(emailDeliveryLogs.id, row.id),
        eq(emailDeliveryLogs.status, 'failed'),
      )).returning({ id: emailDeliveryLogs.id });
      if (claimed.length === 0) continue;

      const payload: any = row.payloadJson;
      if (!payload || !payload.to) {
        await db.update(emailDeliveryLogs).set({
          status: 'failed',
          permanentlyFailed: true,
          errorMessage: 'Missing payload for retry',
          nextRetryAt: null,
        }).where(eq(emailDeliveryLogs.id, row.id));
        continue;
      }

      try {
        // Restore base64 attachments to Buffer for SendGrid
        if (Array.isArray(payload.attachments)) {
          payload.attachments = payload.attachments.map((a: any) =>
            a.content ? { ...a, content: Buffer.from(a.content, 'base64') } : a,
          );
        }
        await sendViaSendGrid(payload);
        await db.update(emailDeliveryLogs).set({
          status: 'sent',
          sentVia: 'sendgrid',
          sentAt: new Date(),
          errorMessage: null,
          nextRetryAt: null,
          payloadJson: null, // free up storage on success
        }).where(eq(emailDeliveryLogs.id, row.id));
        logger.info('background', `Email retry #${currentRetry} succeeded`, { metadata: { id: row.id } });
      } catch (err: unknown) {
        const permanent = isPermanentEmailFailure(err);
        const max = row.maxRetries ?? 5;
        const nextRetryAt = (!permanent && currentRetry < max) ? scheduleEmailRetry(currentRetry) : null;
        await db.update(emailDeliveryLogs).set({
          status: 'failed',
          nextRetryAt,
          errorMessage: getErrorMessage(err) || 'Retry failed',
          permanentlyFailed: permanent || currentRetry >= max,
        }).where(eq(emailDeliveryLogs.id, row.id));
        if (permanent || currentRetry >= max) {
          logger.warn('background', `Email permanently failed`, {
            metadata: { id: row.id, error: getErrorMessage(err), retries: currentRetry },
          });
        }
      }
    }
  } catch (err: any) {
    const m = getErrorMessage(err) || '';
    if (m.includes('does not exist') || m.includes('relation')) {
      // Table not yet created — skip silently
    } else if (
      m.includes('Connection terminated') ||
      m.includes('connection timeout') ||
      m.includes('ECONNRESET') ||
      m.includes('ETIMEDOUT') ||
      m.includes('socket hang up') ||
      err?.code === 'ECONNRESET' ||
      err?.code === 'ETIMEDOUT'
    ) {
      // Transient Neon pool drop — log warn, skip alert. Will retry next tick.
      logger.warn('background', 'Email retry scheduler skipped tick (transient DB connection)', { metadata: { error: m } });
    } else {
      logger.error('background', 'Email retry scheduler error', { error: err });
    }
  } finally {
    isProcessingEmail = false;
  }
}

async function recoverStrandedEmails() {
  try {
    const recovered = await db.update(emailDeliveryLogs).set({
      status: 'failed',
    }).where(eq(emailDeliveryLogs.status, 'retrying' as any)).returning({ id: emailDeliveryLogs.id });
    if (recovered.length > 0) {
      logger.warn('background', `Recovered ${recovered.length} stranded emails from 'retrying' state`);
    }
  } catch (e) {
    logger.warn('background', 'Failed to recover stranded emails from retrying state', { error: e });
  }
}

let retryInterval: NodeJS.Timeout | null = null;

export async function startRetryScheduler() {
  if (retryInterval) return;
  await recoverStrandedMessages();
  await recoverStrandedEmails();
  retryInterval = setInterval(async () => {
    await processFailedSmsMessages();
    // Process emails every 5 cycles (≈5min) to avoid hammering provider.
    emailCycleCounter = (emailCycleCounter + 1) % 5;
    if (emailCycleCounter === 0) await processFailedEmailMessages();
  }, 60_000);
  logger.info('background', 'Retry scheduler started — SMS each 60s, emails each 5min');
}

export function stopRetryScheduler() {
  if (retryInterval) {
    clearInterval(retryInterval);
    retryInterval = null;
  }
}
