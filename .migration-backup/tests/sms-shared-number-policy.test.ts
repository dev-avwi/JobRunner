/**
 * No-shared-number SMS policy tests (Task #362).
 *
 * Business text messages must NEVER go out from the shared platform Twilio
 * number. These tests pin every enforcement point so a regression in any one
 * path fails loudly:
 *
 *  1. sendSmsToClient with no dedicatedPhoneNumber returns the
 *     purchase-required error and persists a FAILED message (no retry queued).
 *  2. Quote/invoice/payment/job notification SMS fail loud without a
 *     dedicated number (both with and without a businessOwnerId).
 *  3. The retry scheduler marks messages permanently failed rather than
 *     retrying from the platform number.
 *  4. With a dedicated number set, the Twilio transport receives exactly that
 *     fromNumber.
 *  5. API routes: POST /api/sms/send and /api/integrations/test-sms return
 *     402 DEDICATED_NUMBER_REQUIRED without a dedicated number.
 *
 * The Twilio transport is intercepted in-process (__setSmsTestInterceptor) so
 * no real SMS can ever be sent by this suite.
 *
 * Run against the dev server (shares DATABASE_URL with the test process):
 *   BASE_URL=http://localhost:5000 tsx tests/sms-shared-number-policy.test.ts
 */

import { db, storage } from '../server/storage';
import { users, businessSettings, smsConversations, smsMessages, clients, jobs } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { AuthService } from '../server/auth';
import { __setSmsTestInterceptor, type SendSMSOptions } from '../server/twilioClient';
import { sendSmsToClient } from '../server/services/smsService';
import {
  notifyQuoteReady,
  notifyInvoiceSent,
  notifyPaymentReceived,
  notifyJobScheduled,
} from '../server/notificationService';
import { processFailedSmsMessages } from '../server/retryScheduler';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

const TEST_EMAIL = 'sms-shared-number-test@jobrunner.test';
const TEST_PASSWORD = 'SmsPolicy#Test1234';
const CLIENT_PHONE = '+61455000111';
const DEDICATED = '+61488999000';
const PURCHASE_ERR = 'Purchase a dedicated number';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// Capture every call that reaches the Twilio transport. Installed for the
// WHOLE suite so a policy regression can never send a real SMS from here.
const twilioCalls: SendSMSOptions[] = [];
__setSmsTestInterceptor(async (options) => {
  twilioCalls.push(options);
  return { success: true, messageId: `TEST_SID_${twilioCalls.length}` };
});

async function teardown() {
  // users FK cascades business_settings + sms_conversations (+ messages).
  await db.delete(users).where(eq(users.email, TEST_EMAIL));
}

async function seed() {
  await teardown();
  const passwordHash = await AuthService.hashPassword(TEST_PASSWORD);
  const [user] = await db.insert(users).values({
    email: TEST_EMAIL,
    username: `sms_policy_test_${Date.now().toString(36)}`,
    password: passwordHash,
    firstName: 'SmsPolicy',
    lastName: 'Test',
    emailVerified: true,
    isActive: true,
    subscriptionTier: 'pro', // pass requirePaidTierForSms — isolates the dedicated-number gate
  } as any).returning();

  // Onboarding guard 403s core routes for un-onboarded users — mark complete.
  // NO dedicatedPhoneNumber: that is the condition under test.
  await db.insert(businessSettings).values({
    userId: user.id,
    businessName: 'SMS Policy Test Pty Ltd',
    onboardingCompleted: true,
  } as any);

  return user;
}

async function main() {
  const user = await seed();

  // ── 1. sendSmsToClient without a dedicated number ─────────────────────────
  console.log('sendSmsToClient without dedicated number:');
  {
    twilioCalls.length = 0;
    const msg = await sendSmsToClient({
      businessOwnerId: user.id,
      clientPhone: CLIENT_PHONE,
      clientName: 'Policy Client',
      message: 'Hello from the policy test',
    });
    check('message persisted with status failed', msg.status === 'failed', `status=${msg.status}`);
    check('error message tells owner to purchase a number', (msg.errorMessage || '').includes(PURCHASE_ERR), msg.errorMessage || '(none)');
    check('no retry is scheduled (permanent failure)', msg.nextRetryAt == null, String(msg.nextRetryAt));
    check('Twilio transport was never called', twilioCalls.length === 0, `calls=${twilioCalls.length}`);

    // Confirm what actually landed in the DB, not just the return value.
    const [row] = await db.select().from(smsMessages).where(eq(smsMessages.id, msg.id));
    check('DB row is failed with purchase error', row?.status === 'failed' && (row?.errorMessage || '').includes(PURCHASE_ERR));
  }

  // ── 2. Notification SMS fail loud without a dedicated number ──────────────
  console.log('Notification SMS without dedicated number:');
  {
    twilioCalls.length = 0;
    const base = {
      clientName: 'Policy Client',
      clientPhone: CLIENT_PHONE,
      businessName: 'SMS Policy Test Pty Ltd',
      channel: 'sms' as const,
      businessOwnerId: user.id,
    };
    const results: Array<[string, { smsSent?: boolean; smsError?: string }]> = [
      ['quote', await notifyQuoteReady({ ...base, quoteNumber: 'Q-1', quoteTotal: '$100.00', viewQuoteUrl: 'https://example.com/q/1' })],
      ['invoice', await notifyInvoiceSent({ ...base, invoiceNumber: 'I-1', invoiceTotal: '$100.00', dueDate: '2026-09-01', paymentUrl: 'https://example.com/i/1' })],
      ['payment', await notifyPaymentReceived({ ...base, amount: '$100.00', invoiceNumber: 'I-1' } as any)],
      ['job', await notifyJobScheduled({ ...base, jobDate: 'Mon 10 Aug, 9am' })],
    ];
    for (const [name, r] of results) {
      check(`${name} notification SMS fails loud`, r.smsSent === false && (r.smsError || '').includes(PURCHASE_ERR), JSON.stringify(r));
    }
    check('no notification reached the Twilio transport', twilioCalls.length === 0, `calls=${twilioCalls.length}`);

    // Missing businessOwnerId must also refuse (never fall back to shared number)
    const { businessOwnerId: _omit, ...noOwner } = base;
    const r = await notifyQuoteReady({ ...noOwner, quoteNumber: 'Q-2', quoteTotal: '$50.00', viewQuoteUrl: 'https://example.com/q/2' });
    check('notification without businessOwnerId refuses to send', r.smsSent !== true && (r.smsError || '').includes(PURCHASE_ERR), JSON.stringify(r));
    check('still no Twilio call', twilioCalls.length === 0, `calls=${twilioCalls.length}`);
  }

  // ── 3. Retry scheduler permanently fails messages without a number ────────
  console.log('Retry scheduler without dedicated number:');
  {
    twilioCalls.length = 0;
    const [conv] = await db.insert(smsConversations).values({
      businessOwnerId: user.id,
      clientPhone: CLIENT_PHONE,
      clientName: 'Policy Client',
    } as any).returning();
    const [msg] = await db.insert(smsMessages).values({
      conversationId: conv.id,
      direction: 'outbound',
      body: 'retry me',
      status: 'failed',
      retryCount: 0,
      nextRetryAt: new Date(Date.now() - 60_000), // due now
    } as any).returning();

    await processFailedSmsMessages();

    const [row] = await db.select().from(smsMessages).where(eq(smsMessages.id, msg.id));
    check('message marked permanently failed', row?.status === 'failed', `status=${row?.status}`);
    check('retry budget exhausted (no future retries)', (row?.retryCount ?? 0) >= 3 && row?.nextRetryAt == null, `retryCount=${row?.retryCount} nextRetryAt=${row?.nextRetryAt}`);
    check('error explains missing dedicated number', (row?.errorMessage || '').toLowerCase().includes('no dedicated business number'), row?.errorMessage || '(none)');
    const mine = twilioCalls.filter(c => c.to === CLIENT_PHONE);
    check('scheduler never called Twilio for this business', mine.length === 0, `calls=${mine.length}`);
  }

  // ── 4. With a dedicated number, Twilio gets exactly that fromNumber ───────
  console.log('With dedicated number set:');
  {
    await db.update(businessSettings)
      .set({ dedicatedPhoneNumber: DEDICATED } as any)
      .where(eq(businessSettings.userId, user.id));
    // getBusinessSettings has a 60s hot-read cache — bust it after raw DB writes.
    const { invalidateBusinessSettings } = await import('../server/cache');
    invalidateBusinessSettings(user.id);

    twilioCalls.length = 0;
    const msg = await sendSmsToClient({
      businessOwnerId: user.id,
      clientPhone: CLIENT_PHONE,
      clientName: 'Policy Client',
      message: 'Hello with a dedicated number',
    });
    check('message sent', msg.status === 'sent', `status=${msg.status} err=${msg.errorMessage}`);
    check('exactly one Twilio call', twilioCalls.length === 1, `calls=${twilioCalls.length}`);
    check('Twilio call uses the dedicated fromNumber', twilioCalls[0]?.fromNumber === DEDICATED, `fromNumber=${twilioCalls[0]?.fromNumber}`);
    check('no alphanumeric sender id override', !twilioCalls[0]?.alphanumericSenderId, String(twilioCalls[0]?.alphanumericSenderId));

    // Retry path with a dedicated number must also send FROM that number.
    const [conv] = await db.insert(smsConversations).values({
      businessOwnerId: user.id,
      clientPhone: CLIENT_PHONE,
      clientName: 'Policy Client',
    } as any).returning();
    const [retryMsg] = await db.insert(smsMessages).values({
      conversationId: conv.id,
      direction: 'outbound',
      body: 'retry with number',
      status: 'failed',
      retryCount: 0,
      nextRetryAt: new Date(Date.now() - 60_000),
    } as any).returning();

    twilioCalls.length = 0;
    await processFailedSmsMessages();
    const [row] = await db.select().from(smsMessages).where(eq(smsMessages.id, retryMsg.id));
    check('retry succeeds with dedicated number', row?.status === 'sent', `status=${row?.status} err=${row?.errorMessage}`);
    const mineRetry = twilioCalls.filter(c => c.to === CLIENT_PHONE);
    check('retry send uses the dedicated fromNumber', mineRetry.length === 1 && mineRetry[0]?.fromNumber === DEDICATED, `calls=${mineRetry.length} from=${mineRetry[0]?.fromNumber}`);

    // Restore the no-number state for the API-route tests below.
    await db.update(businessSettings)
      .set({ dedicatedPhoneNumber: null } as any)
      .where(eq(businessSettings.userId, user.id));
    invalidateBusinessSettings(user.id);
  }

  // ── 5. API routes refuse without a dedicated number (against dev server) ──
  console.log('API routes without dedicated number:');
  {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    if (!loginRes.ok) throw new Error(`Login failed (${loginRes.status}): ${await loginRes.text()}`);
    const login = await loginRes.json();
    const auth = { authorization: `Bearer ${login.sessionToken}`, 'content-type': 'application/json' };

    const sendRes = await fetch(`${BASE_URL}/api/sms/send`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ clientPhone: CLIENT_PHONE, clientName: 'Policy Client', message: 'api route test' }),
    });
    const sendBody = await sendRes.json().catch(() => ({}));
    check('/api/sms/send returns 402 DEDICATED_NUMBER_REQUIRED', sendRes.status === 402 && sendBody.code === 'DEDICATED_NUMBER_REQUIRED', `status=${sendRes.status} body=${JSON.stringify(sendBody)}`);

    const testRes = await fetch(`${BASE_URL}/api/integrations/test-sms`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ phone: CLIENT_PHONE }),
    });
    const testBody = await testRes.json().catch(() => ({}));
    check('/api/integrations/test-sms returns 402 DEDICATED_NUMBER_REQUIRED', testRes.status === 402 && testBody.code === 'DEDICATED_NUMBER_REQUIRED', `status=${testRes.status} body=${JSON.stringify(testBody)}`);

    // ── 6. On-my-way refuses BEFORE any state writes (no dup on retry) ──────
    console.log('On-my-way pre-flight without dedicated number:');
    {
      const [client] = await db.insert(clients).values({
        userId: user.id,
        name: 'Policy Client',
        phone: CLIENT_PHONE,
      } as any).returning();
      const [job] = await db.insert(jobs).values({
        userId: user.id,
        clientId: client.id,
        title: 'Policy test job',
        status: 'scheduled',
      } as any).returning();

      // Call twice: both must 402 and NEITHER may mutate the job's worker status.
      for (const attempt of [1, 2]) {
        const r = await fetch(`${BASE_URL}/api/jobs/${job.id}/on-my-way`, {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({}),
        });
        const body = await r.json().catch(() => ({}));
        check(`on-my-way attempt ${attempt} returns 402 DEDICATED_NUMBER_REQUIRED`,
          r.status === 402 && body.code === 'DEDICATED_NUMBER_REQUIRED',
          `status=${r.status} body=${JSON.stringify(body)}`);
      }

      const [jobRow] = await db.select().from(jobs).where(eq(jobs.id, job.id));
      check('job worker status untouched (no partial state before 402)',
        jobRow?.workerStatus == null && jobRow?.status === 'scheduled',
        `workerStatus=${jobRow?.workerStatus} status=${jobRow?.status}`);

      // ── 7. Status-change routes keep the write successful + surface smsFailed ─
      // worker-status persists the transition, then reports the skipped SMS
      // via 200 { smsFailed, smsErrorCode } — NOT an error status.
      console.log('Worker-status keeps status write successful, surfaces smsFailed:');
      {
        const r = await fetch(`${BASE_URL}/api/jobs/${job.id}/worker-status`, {
          method: 'PATCH',
          headers: auth,
          body: JSON.stringify({ workerStatus: 'arrived' }),
        });
        const body = await r.json().catch(() => ({}));
        check('worker-status returns 200 despite missing number', r.status === 200, `status=${r.status} body=${JSON.stringify(body)}`);
        check('response carries smsFailed + DEDICATED_NUMBER_REQUIRED',
          body.smsFailed === true && body.smsErrorCode === 'DEDICATED_NUMBER_REQUIRED',
          JSON.stringify(body));
        const [rowAfter] = await db.select().from(jobs).where(eq(jobs.id, job.id));
        check('status transition persisted', rowAfter?.workerStatus === 'arrived', `workerStatus=${rowAfter?.workerStatus}`);
      }
    }

    await fetch(`${BASE_URL}/api/auth/logout`, { method: 'POST', headers: auth }).catch(() => {});
  }

  await teardown();
  __setSmsTestInterceptor(null);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Test run crashed:', err);
  try { await teardown(); } catch {}
  process.exit(1);
});
