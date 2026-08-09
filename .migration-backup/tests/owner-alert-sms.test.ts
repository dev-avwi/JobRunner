/**
 * Owner alert SMS tests (Task #363).
 *
 * Owner-facing alert texts (payment received, quote accepted, geofence
 * arrival, etc. via notifyOwnerViaSms) are INTERNAL platform alerts, not
 * client-facing business texts. They intentionally keep using the shared
 * platform Twilio number and must NOT require a dedicated number.
 *
 * These tests pin that contract so a future sweep tightening the
 * no-shared-number policy (see tests/sms-shared-number-policy.test.ts)
 * cannot silently break owner alerts:
 *
 *  1. Every ownerSmsTemplates key sends successfully with NO dedicated
 *     number involved anywhere.
 *  2. The Twilio transport receives NO fromNumber override — meaning the
 *     platform sender (twilioPhoneNumber fallback in sendSMS) is used.
 *  3. Missing phone / unknown template fail gracefully without touching
 *     the transport.
 *
 * The Twilio transport is intercepted in-process (__setSmsTestInterceptor)
 * so no real SMS can ever be sent by this suite.
 */
import { __setSmsTestInterceptor } from '../server/twilioClient';
import { notifyOwnerViaSms, ownerSmsTemplates } from '../server/notificationService';

const OWNER_PHONE = '+61455000222';

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

type SmsCall = { to: string; message: string; fromNumber?: string; alphanumericSenderId?: string };
const twilioCalls: SmsCall[] = [];
__setSmsTestInterceptor(async (options: any) => {
  twilioCalls.push(options);
  return { success: true, messageId: `TEST_OWNER_SID_${twilioCalls.length}` };
});

// Representative args per template — matches each template's signature.
const TEMPLATE_ARGS: Record<keyof typeof ownerSmsTemplates, any[]> = {
  paymentReceived: ['Policy Client', '150.00', 'INV-1'],
  quoteAccepted: ['Policy Client', 'Q-1', '500.00'],
  quoteDeclined: ['Policy Client', 'Q-2'],
  invoiceOverdue: ['Policy Client', 'INV-2', '250.00', 7],
  newJobAssigned: ['Wal Worker', 'Fix the fence'],
  jobCompleted: ['Wal Worker', 'Fix the fence'],
  teamMemberJoined: ['Wal Worker', 'Worker'],
  geofenceArrival: ['Wal Worker', 'Fix the fence'],
  geofenceDeparture: ['Wal Worker', 'Fix the fence', '2h 15m'],
};

async function main() {
  // ── 1. Every owner template sends WITHOUT a dedicated number ─────────────
  console.log('notifyOwnerViaSms sends every template without a dedicated number:');
  const keys = Object.keys(ownerSmsTemplates) as Array<keyof typeof ownerSmsTemplates>;
  check('template arg map covers every ownerSmsTemplates key', keys.every((k) => k in TEMPLATE_ARGS), keys.join(','));

  for (const key of keys) {
    twilioCalls.length = 0;
    const args = TEMPLATE_ARGS[key] ?? [];
    const expectedMessage = (ownerSmsTemplates[key] as any)(...args);
    const result = await notifyOwnerViaSms(OWNER_PHONE, key, ...args);

    check(`${key} sends successfully`, result.success === true, JSON.stringify(result));
    check(`${key} reached the Twilio transport exactly once`, twilioCalls.length === 1, `calls=${twilioCalls.length}`);
    const call = twilioCalls[0];
    if (call) {
      check(`${key} goes to the owner's phone`, call.to === OWNER_PHONE, call.to);
      check(`${key} carries the template message`, call.message === expectedMessage, call.message);
      // The platform-sender contract: NO fromNumber override means sendSMS
      // falls back to the shared platform twilioPhoneNumber.
      check(`${key} uses the platform sender (no fromNumber override)`, call.fromNumber == null, String(call.fromNumber));
      check(`${key} has no dedicated-number error`, !(result.error || '').includes('Purchase a dedicated number'), result.error);
    }
  }

  // ── 2. Graceful failures never touch the transport ───────────────────────
  console.log('Graceful failure paths:');
  {
    twilioCalls.length = 0;
    const noPhone = await notifyOwnerViaSms('', 'paymentReceived', 'X', '1.00', 'INV-9');
    check('empty phone refuses without sending', noPhone.success === false && !!noPhone.error, JSON.stringify(noPhone));

    const badTemplate = await notifyOwnerViaSms(OWNER_PHONE, 'nonexistent' as any);
    check('unknown template refuses without sending', badTemplate.success === false && !!badTemplate.error, JSON.stringify(badTemplate));

    check('no transport call on failure paths', twilioCalls.length === 0, `calls=${twilioCalls.length}`);
  }

  __setSmsTestInterceptor(null);
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  __setSmsTestInterceptor(null);
  console.error('Test run crashed:', err);
  process.exit(1);
});
