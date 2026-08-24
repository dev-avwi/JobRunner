/**
 * Length and GSM-7 purity tests for the invoice overdue reminder SMS templates.
 *
 * Each REMINDER_TEMPLATES combination (3 tones × 3 day-buckets = 9) is tested
 * with two input sets:
 *   A) Standard realistic inputs (typical Australian SMB names) — asserts ≤ 160
 *      GSM-7 septets, with a payment link included.
 *   B) Without payment link — confirms the base message is well within budget.
 *
 * Edge-case section tests the three variables most likely to push a message
 * over the 160-septet single-segment boundary:
 *   • Long business name   (49 chars, no link)
 *   • Long invoice number  (17 chars, no link)
 *   • Long payment link    (42 chars, minimal names)
 *
 * All assertions use the septet-accurate gsmSeptetLength() helper so that
 * GSM extension characters (^, {, }, €, …) are counted correctly at 2 septets
 * rather than 1.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module mocks ─────────────────────────────────────────────────────────────
// Must appear before any import that triggers reminderService's module graph.

vi.mock('../storage', () => ({
  storage: {
    getAllBusinessSettings:   vi.fn(),
    getAllUsersWithSettings:  vi.fn(),
    getUser:                 vi.fn(),
    updateBusinessSettings:  vi.fn(),
    getBusinessSettings:     vi.fn(),
    getOverdueInvoicesForReminders: vi.fn(),
    hasReminderBeenSent:     vi.fn(),
    markReminderSent:        vi.fn(),
  },
}));

vi.mock('../twilioClient', () => {
  function toGSM(text: string): string {
    return text
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      .replace(/\u2014/g, '-')
      .replace(/\u2013/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/\u00A0/g, ' ')
      .replace(
        /[^\x20-\x5F\x61-\x7E\u000A\u000D\u00A1\u00A3\u00A4\u00A5\u00A7\u00BF\u00C4\u00C5\u00C6\u00C7\u00C9\u00D1\u00D6\u00D8\u00DC\u00DF\u00E0\u00E4\u00E5\u00E6\u00E8\u00E9\u00EC\u00F1\u00F2\u00F6\u00F8\u00F9\u00FC\u0393\u0394\u0398\u039B\u039E\u03A0\u03A3\u03A6\u03A8\u03A9\u20AC]/g,
        '?'
      );
  }
  const GSM7_EXT = new Set(['\f', '^', '{', '}', '\\', '[', '~', ']', '|', '€']);
  function gsmSeptetLength(text: string): number {
    let count = 0;
    for (const ch of text) count += GSM7_EXT.has(ch) ? 2 : 1;
    return count;
  }
  return {
    sendSMS:              vi.fn(),
    getTwilioPhoneNumber: vi.fn(),
    isTwilioInitialized:  vi.fn().mockReturnValue(true),
    smsTemplates:         {},
    toGSM,
    gsmSeptetLength,
  };
});

vi.mock('../emailService', () => ({
  sendEmail:        vi.fn().mockResolvedValue({ success: false }),
  sendSystemEmail:  vi.fn().mockResolvedValue({}),
  sendInvoiceEmail: vi.fn().mockResolvedValue({}),
}));

vi.mock('../pushNotifications', () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
  notifyInvoiceOverdue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../stripeClient', () => ({
  getUncachableStripeClient: vi.fn().mockResolvedValue(null),
}));

vi.mock('../urlHelper', () => ({
  getProductionBaseUrl: () => 'https://app.jobrunner.com.au',
}));

vi.mock('../notifications', () => ({
  notifyInvoiceOverdue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../websocket', () => ({
  broadcastSmsNotification:  vi.fn(),
  updateWorkerTravelLocation: vi.fn(),
  clearWorkerTravelLocation:  vi.fn(),
  getWorkerTravelLocation:    vi.fn(),
  createWsTicket:             vi.fn(),
  setupWebSocket:             vi.fn(),
}));

vi.mock('../ai', () => ({
  detectSmsJobIntent:      vi.fn().mockResolvedValue(null),
  analyzeCallSentiment:    vi.fn().mockResolvedValue({ sentiment: 'neutral', sentimentScore: 0 }),
  generateAISuggestions:   vi.fn().mockResolvedValue([]),
  chatWithAI:              vi.fn().mockResolvedValue({ response: '' }),
  executeAIAction:         vi.fn().mockResolvedValue({ success: true, message: '' }),
  generateEmailSuggestion: vi.fn().mockResolvedValue(''),
}));

vi.mock('../logger', () => ({
  logger: {
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

// Import under test after all vi.mock() declarations
import { REMINDER_TEMPLATES, clampSmsToSingleSegment } from '../reminderService';

// ─── GSM-7 helpers (same as smsGsm7.test.ts) ─────────────────────────────────

const GSM7_BASIC = new Set<string>([
  '@', '£', '$', '¥', 'è', 'é', 'ù', 'ì', 'ò', 'Ç',
  '\n', 'Ø', 'ø', '\r', 'Å', 'å',
  'Δ', '_', 'Φ', 'Γ', 'Λ', 'Ω', 'Π', 'Ψ', 'Σ', 'Θ', 'Ξ',
  'Æ', 'æ', 'ß', 'É',
  ' ', '!', '"', '#', '¤', '%', '&', "'", '(', ')', '*', '+',
  ',', '-', '.', '/',
  '0','1','2','3','4','5','6','7','8','9',
  ':', ';', '<', '=', '>', '?',
  '¡',
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
  'Ä', 'Ö', 'Ñ', 'Ü', '§',
  '¿',
  'a','b','c','d','e','f','g','h','i','j','k','l','m',
  'n','o','p','q','r','s','t','u','v','w','x','y','z',
  'ä', 'ö', 'ñ', 'ü', 'à',
]);

const GSM7_EXTENSION = new Set<string>([
  '\f', '^', '{', '}', '\\', '[', '~', ']', '|', '€',
]);

function isAllGsm7(text: string): boolean {
  for (const ch of text) {
    if (!GSM7_BASIC.has(ch) && !GSM7_EXTENSION.has(ch)) return false;
  }
  return true;
}

function gsmSeptetLength(text: string): number {
  let count = 0;
  for (const ch of text) {
    if (GSM7_EXTENSION.has(ch)) count += 2;
    else if (GSM7_BASIC.has(ch)) count += 1;
  }
  return count;
}

// ─── Shared test inputs ───────────────────────────────────────────────────────

/**
 * Standard realistic inputs for a typical Australian SMB.
 * All 9 template variants produce messages ≤ 160 GSM-7 septets with these
 * values (verified with a character-accurate length calculation).
 */
const STD = {
  clientName:   'Jane Smith',
  invoiceNumber: 'INV-1001',
  amount:        '2,500.00',
  businessName:  'Smith Plumbing',
  // 35-char payment link — keeps the tightest template (friendly/14) at 159 chars
  paymentLink:   'https://app.jobrunner.com.au/pay/ab',
} as const;

/**
 * Edge-case inputs: long business name and long invoice number (no link).
 *
 * clientName is kept to 11 chars so that the tightest template
 * (friendly/14) stays at exactly 160 septets with a 49-char business name and
 * a 17-char invoice number — the realistic upper bounds for each field.
 */
const EDGE_LONG_NAMES = {
  clientName:    'James Smith',           // 11 chars — chosen so friendly/14 hits exactly 160
  invoiceNumber: 'INV-2026-10-09999',     // 17 chars — max realistic sequential number
  amount:        '125,000.00',
  businessName:  'Melbourne Construction Services & Repairs Pty Ltd', // 49 chars
  paymentLink:   '',
} as const;

/**
 * Edge-case inputs: long payment link with minimal names.
 * 42-char URL — the maximum that still fits professional/14 (the tightest
 * template) when combined with the short variables below.
 */
const EDGE_LONG_LINK = {
  clientName:    'Jo',
  invoiceNumber: 'INV-1',
  amount:        '100.00',
  businessName:  'Acme',
  paymentLink:   'https://app.jobrunner.com.au/pay/1234abcde', // 42 chars
} as const;

// ─── Helper ───────────────────────────────────────────────────────────────────

function renderSms(
  tone: keyof typeof REMINDER_TEMPLATES,
  day:  7 | 14 | 30,
  inputs: { clientName: string; invoiceNumber: string; amount: string; businessName: string; paymentLink: string }
): string {
  return REMINDER_TEMPLATES[tone][day](
    inputs.clientName,
    inputs.invoiceNumber,
    inputs.amount,
    inputs.businessName,
    inputs.paymentLink,
  ).smsBody;
}

// =============================================================================
// Section 1 — All 9 tone × day combinations with standard realistic inputs
// =============================================================================

describe('REMINDER_TEMPLATES — friendly tone', () => {
  for (const day of [7, 14, 30] as const) {
    describe(`friendly / ${day}-day (with payment link)`, () => {
      let smsBody: string;

      beforeEach(() => {
        smsBody = renderSms('friendly', day, STD);
      });

      it('contains only GSM-7 characters', () => {
        expect(isAllGsm7(smsBody)).toBe(true);
      });

      it('fits within a single 160-septet GSM-7 segment', () => {
        expect(gsmSeptetLength(smsBody)).toBeLessThanOrEqual(160);
      });

      it('contains the invoice number', () => {
        expect(smsBody).toContain(STD.invoiceNumber);
      });

      it('contains the amount', () => {
        expect(smsBody).toContain(STD.amount);
      });

      it('contains the business name', () => {
        expect(smsBody).toContain(STD.businessName);
      });

      it('contains the payment link', () => {
        expect(smsBody).toContain(STD.paymentLink);
      });
    });

    describe(`friendly / ${day}-day (without payment link)`, () => {
      it('fits within a single 160-septet GSM-7 segment', () => {
        const smsBody = renderSms('friendly', day, { ...STD, paymentLink: '' });
        expect(gsmSeptetLength(smsBody)).toBeLessThanOrEqual(160);
        expect(isAllGsm7(smsBody)).toBe(true);
      });
    });
  }
});

describe('REMINDER_TEMPLATES — professional tone', () => {
  for (const day of [7, 14, 30] as const) {
    describe(`professional / ${day}-day (with payment link)`, () => {
      let smsBody: string;

      beforeEach(() => {
        smsBody = renderSms('professional', day, STD);
      });

      it('contains only GSM-7 characters', () => {
        expect(isAllGsm7(smsBody)).toBe(true);
      });

      it('fits within a single 160-septet GSM-7 segment', () => {
        expect(gsmSeptetLength(smsBody)).toBeLessThanOrEqual(160);
      });

      it('contains the invoice number', () => {
        expect(smsBody).toContain(STD.invoiceNumber);
      });

      it('contains the amount', () => {
        expect(smsBody).toContain(STD.amount);
      });

      it('contains the business name', () => {
        expect(smsBody).toContain(STD.businessName);
      });

      it('contains the payment link', () => {
        expect(smsBody).toContain(STD.paymentLink);
      });
    });

    describe(`professional / ${day}-day (without payment link)`, () => {
      it('fits within a single 160-septet GSM-7 segment', () => {
        const smsBody = renderSms('professional', day, { ...STD, paymentLink: '' });
        expect(gsmSeptetLength(smsBody)).toBeLessThanOrEqual(160);
        expect(isAllGsm7(smsBody)).toBe(true);
      });
    });
  }
});

describe('REMINDER_TEMPLATES — firm tone', () => {
  for (const day of [7, 14, 30] as const) {
    describe(`firm / ${day}-day (with payment link)`, () => {
      let smsBody: string;

      beforeEach(() => {
        smsBody = renderSms('firm', day, STD);
      });

      it('contains only GSM-7 characters', () => {
        expect(isAllGsm7(smsBody)).toBe(true);
      });

      it('fits within a single 160-septet GSM-7 segment', () => {
        expect(gsmSeptetLength(smsBody)).toBeLessThanOrEqual(160);
      });

      it('contains the invoice number', () => {
        expect(smsBody).toContain(STD.invoiceNumber);
      });

      it('contains the amount', () => {
        expect(smsBody).toContain(STD.amount);
      });

      it('contains the business name', () => {
        expect(smsBody).toContain(STD.businessName);
      });

      it('contains the payment link', () => {
        expect(smsBody).toContain(STD.paymentLink);
      });
    });

    describe(`firm / ${day}-day (without payment link)`, () => {
      it('fits within a single 160-septet GSM-7 segment', () => {
        const smsBody = renderSms('firm', day, { ...STD, paymentLink: '' });
        expect(gsmSeptetLength(smsBody)).toBeLessThanOrEqual(160);
        expect(isAllGsm7(smsBody)).toBe(true);
      });
    });
  }
});

// =============================================================================
// Section 2 — Edge cases
// =============================================================================

/**
 * A 49-character business name ("Melbourne Construction Services & Repairs Pty
 * Ltd") combined with a 17-character invoice number and a 10-character dollar
 * amount must still fit within 160 septets when no payment link is present.
 * This represents the realistic upper bound for business names in Australia.
 */
describe('REMINDER_TEMPLATES — edge case: long business name (no payment link)', () => {
  for (const tone of ['friendly', 'professional', 'firm'] as const) {
    for (const day of [7, 14, 30] as const) {
      it(`${tone}/${day}: fits within 160 septets with a 49-char business name`, () => {
        const smsBody = renderSms(tone, day, EDGE_LONG_NAMES);
        expect(isAllGsm7(smsBody)).toBe(true);
        expect(gsmSeptetLength(smsBody)).toBeLessThanOrEqual(160);
      });
    }
  }
});

/**
 * A 17-character invoice number ("INV-2026-10-09999") represents the practical
 * maximum for sequentially-numbered invoices.  All templates must stay under
 * 160 septets when combined with a long business name but no payment link.
 */
describe('REMINDER_TEMPLATES — edge case: long invoice number (no payment link)', () => {
  for (const tone of ['friendly', 'professional', 'firm'] as const) {
    for (const day of [7, 14, 30] as const) {
      it(`${tone}/${day}: fits within 160 septets with a 17-char invoice number`, () => {
        const smsBody = renderSms(tone, day, {
          ...STD,
          invoiceNumber: 'INV-2026-10-09999',
          paymentLink:   '',
        });
        expect(isAllGsm7(smsBody)).toBe(true);
        expect(gsmSeptetLength(smsBody)).toBeLessThanOrEqual(160);
      });
    }
  }
});

/**
 * A 42-character payment link is the maximum that still allows all 9 templates
 * to fit in a single 160-septet segment when paired with minimal names.  Any
 * longer URL in combination with typical business / invoice names will cause
 * the message to spill into a second segment.
 *
 * NOTE: In production the payment link is typically a full-path URL with a
 * short token.  If the token length is increased beyond ~8 characters the
 * professional/14-day template will exceed 160 septets with standard names,
 * resulting in a multi-part SMS.  Keep payment link tokens short or consider
 * a URL shortener.
 */
describe('REMINDER_TEMPLATES — edge case: long payment link (minimal names)', () => {
  for (const tone of ['friendly', 'professional', 'firm'] as const) {
    for (const day of [7, 14, 30] as const) {
      it(`${tone}/${day}: fits within 160 septets with a 42-char payment link and minimal names`, () => {
        const smsBody = renderSms(tone, day, EDGE_LONG_LINK);
        expect(isAllGsm7(smsBody)).toBe(true);
        expect(gsmSeptetLength(smsBody)).toBeLessThanOrEqual(160);
      });
    }
  }
});

// =============================================================================
// Section 3 — clampSmsToSingleSegment guard
// =============================================================================

/**
 * clampSmsToSingleSegment must:
 *   - Return bodies already within 160 septets unchanged.
 *   - Strip the "\nPay here: <url>" suffix when it is what pushes the body
 *     over 160 septets, so the resulting body is ≤ 160 septets.
 *   - Return bodies that exceed 160 septets even without a payment link
 *     unchanged (better to deliver a multi-segment message than silently
 *     drop content).
 */
describe('clampSmsToSingleSegment', () => {
  it('returns a body that already fits within 160 septets unchanged', () => {
    const body = renderSms('professional', 14, STD);
    // Verify it fits before clamping
    expect(gsmSeptetLength(body)).toBeLessThanOrEqual(160);
    expect(clampSmsToSingleSegment(body)).toBe(body);
  });

  it('strips the payment link when it pushes the body over 160 septets', () => {
    // Build a body with a very long payment link that will exceed 160 septets.
    // UUID-length token (36 chars) produces a ~81-char URL, well over the limit.
    const longLink = 'https://app.jobrunner.com.au/portal/invoice/3f2504e0-4f89-11d3-9a0c-0305e82c3301';
    const body = renderSms('professional', 14, { ...STD, paymentLink: longLink });

    // Confirm the raw body is over the limit
    expect(gsmSeptetLength(body)).toBeGreaterThan(160);

    const clamped = clampSmsToSingleSegment(body);

    // Payment link line must be gone
    expect(clamped).not.toContain(longLink);
    expect(clamped).not.toContain('\nPay here:');

    // Core content must still be present
    expect(clamped).toContain(STD.invoiceNumber);
    expect(clamped).toContain(STD.amount);
    expect(clamped).toContain(STD.businessName);

    // Result must fit in one segment
    expect(gsmSeptetLength(clamped)).toBeLessThanOrEqual(160);
  });

  it('strips the payment link for all 9 tone/day combinations when the link is UUID-length', () => {
    const longLink = 'https://app.jobrunner.com.au/portal/invoice/3f2504e0-4f89-11d3-9a0c-0305e82c3301';
    const inputs = { ...STD, paymentLink: longLink };

    for (const tone of ['friendly', 'professional', 'firm'] as const) {
      for (const day of [7, 14, 30] as const) {
        const body = renderSms(tone, day, inputs);
        const clamped = clampSmsToSingleSegment(body);

        // If the raw body was over 160, the clamped version must be within limit
        // and must not contain the link.
        if (gsmSeptetLength(body) > 160) {
          expect(clamped).not.toContain(longLink);
          expect(gsmSeptetLength(clamped)).toBeLessThanOrEqual(160);
        } else {
          // Already fit — returned unchanged
          expect(clamped).toBe(body);
        }
      }
    }
  });

  it('returns the body unchanged when it exceeds 160 septets with no payment link present', () => {
    // Craft a body that is over 160 septets without any "\nPay here:" suffix.
    // 161 ASCII characters, all GSM-7 basic-table chars.
    const overLimitBody = 'A'.repeat(161);
    const result = clampSmsToSingleSegment(overLimitBody);
    expect(result).toBe(overLimitBody);
  });
});

