/**
 * Tests for the GSM-7 sanitiser and automated SMS reminder paths.
 *
 * Section 1 — unit tests for `toGSM()`:
 *   Verifies that typographic characters (curly quotes, em/en dashes,
 *   ellipsis, non-breaking space) are mapped to their ASCII equivalents
 *   and that unknown code points fall back to '?' so the message always
 *   stays within the 160-char GSM-7 segment budget.
 *
 * Section 2 — integration test for `processBillingReminders`:
 *   Mocks storage + Twilio to assert that the message string passed
 *   to the Twilio client after toGSM() contains only GSM-7 characters.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { toGSM } from '../services/smsService';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../storage', () => ({
  storage: {
    getAllBusinessSettings:  vi.fn(),
    getUser:                vi.fn(),
    updateBusinessSettings: vi.fn(),
    getBusinessSettings:    vi.fn(),
  },
}));

// toGSM is inlined here so it is reliably available to both re-exporters
// (smsService → billingReminderService) regardless of importOriginal async
// resolution order.  The allow-list below must stay in sync with the
// production implementation in twilioClient.ts.  The correctness of the
// production implementation is verified separately via vi.importActual in
// the "toGSM — production implementation" describe block below.
vi.mock('../twilioClient', () => {
  function toGSM(text: string): string {
    return text
      .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
      .replace(/\u2014/g, '-')
      .replace(/\u2013/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/\u00A0/g, ' ')
      // Exact GSM 03.38 allow-list — individual code points only, no broad
      // ranges.  Mirrors twilioClient.ts toGSM() exactly.
      .replace(/[^\x20-\x5F\x61-\x7E\u000A\u000D\u00A1\u00A3\u00A4\u00A5\u00A7\u00BF\u00C4\u00C5\u00C6\u00C7\u00C9\u00D1\u00D6\u00D8\u00DC\u00DF\u00E0\u00E4\u00E5\u00E6\u00E8\u00E9\u00EC\u00F1\u00F2\u00F6\u00F8\u00F9\u00FC\u0393\u0394\u0398\u039B\u039E\u03A0\u03A3\u03A6\u03A8\u03A9\u20AC]/g, '?');
  }
  return {
    toGSM,
    sendSMS:              vi.fn(),
    getTwilioPhoneNumber: vi.fn(),
    isTwilioInitialized:  vi.fn().mockReturnValue(true),
    smsTemplates:         {},
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
  broadcastSmsNotification: vi.fn(),
  updateWorkerTravelLocation: vi.fn(),
  clearWorkerTravelLocation: vi.fn(),
  getWorkerTravelLocation: vi.fn(),
  createWsTicket: vi.fn(),
  setupWebSocket: vi.fn(),
}));

vi.mock('../ai', () => ({
  detectSmsJobIntent: vi.fn().mockResolvedValue(null),
  analyzeCallSentiment: vi.fn().mockResolvedValue({ sentiment: 'neutral', sentimentScore: 0 }),
  generateAISuggestions: vi.fn().mockResolvedValue([]),
  chatWithAI: vi.fn().mockResolvedValue({ response: '' }),
  executeAIAction: vi.fn().mockResolvedValue({ success: true, message: '' }),
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

// Import mocked modules after vi.mock declarations
import { storage } from '../storage';
import { sendSMS } from '../twilioClient';
import { processBillingReminders } from '../billingReminderService';

// ─── Exact GSM 03.38 character sets ──────────────────────────────────────────
//
// Source: ETSI TS 123 038 (3GPP TS 23.038), Table 1 (basic) and Table 2 (extension).
//
// The BASIC set (each character costs 1 septet):
const GSM7_BASIC = new Set<string>([
  // Special / symbols (positions 0x00–0x1F in GSM table)
  '@', '£', '$', '¥', 'è', 'é', 'ù', 'ì', 'ò', 'Ç',
  '\n', 'Ø', 'ø', '\r', 'Å', 'å',
  'Δ', '_', 'Φ', 'Γ', 'Λ', 'Ω', 'Π', 'Ψ', 'Σ', 'Θ', 'Ξ',
  // 0x1B is ESC (extension-table marker) — not a displayable char
  'Æ', 'æ', 'ß', 'É',
  // Positions 0x20–0x3F (space through ?)
  ' ', '!', '"', '#', '¤', '%', '&', "'", '(', ')', '*', '+',
  ',', '-', '.', '/',
  '0','1','2','3','4','5','6','7','8','9',
  ':', ';', '<', '=', '>', '?',
  // Positions 0x40–0x5F (¡ through §)
  '¡',
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
  'Ä', 'Ö', 'Ñ', 'Ü', '§',
  // Positions 0x60–0x7F (¿ through à)
  '¿',
  'a','b','c','d','e','f','g','h','i','j','k','l','m',
  'n','o','p','q','r','s','t','u','v','w','x','y','z',
  'ä', 'ö', 'ñ', 'ü', 'à',
]);

// The EXTENSION set (each character costs 2 septets — ESC + one byte):
const GSM7_EXTENSION = new Set<string>([
  '\f', '^', '{', '}', '\\', '[', '~', ']', '|', '€',
]);

/**
 * Returns true when every character in `text` belongs to the GSM 03.38
 * basic or extension character set (the two tables defined by the standard).
 *
 * This validator is intentionally strict: it uses the exact Unicode code
 * points from the standard rather than the overbroad ASCII range 0x20–0x7E
 * (which incorrectly includes ` and excludes some GSM characters).
 */
function isAllGsm7(text: string): boolean {
  for (const ch of text) {
    if (!GSM7_BASIC.has(ch) && !GSM7_EXTENSION.has(ch)) return false;
  }
  return true;
}

/**
 * Returns the number of GSM septets needed to transmit `text`.
 * Basic characters cost 1 septet; extension characters cost 2.
 * Non-GSM characters are not counted — sanitise first with toGSM().
 */
function gsmSeptetLength(text: string): number {
  let count = 0;
  for (const ch of text) {
    if (GSM7_EXTENSION.has(ch)) {
      count += 2;          // ESC + encoded char
    } else if (GSM7_BASIC.has(ch)) {
      count += 1;
    }
    // Unknown chars are skipped; caller should sanitise with toGSM() first.
  }
  return count;
}

// =============================================================================
// 1. Unit tests for toGSM()
// =============================================================================

describe('toGSM — curly single quotes', () => {
  it('replaces left single quotation mark \u2018 with apostrophe', () => {
    expect(toGSM('\u2018hello\u2019')).toBe("'hello'");
  });

  it('replaces right single quotation mark \u2019 (smart apostrophe) with apostrophe', () => {
    expect(toGSM("it\u2019s")).toBe("it's");
  });

  it('replaces single low-9 quotation mark \u201A with apostrophe', () => {
    expect(toGSM('\u201Atext\u201A')).toBe("'text'");
  });

  it('replaces single high-reversed-9 \u201B with apostrophe', () => {
    expect(toGSM('\u201Bfoo')).toBe("'foo");
  });

  it('replaces prime \u2032 with apostrophe', () => {
    expect(toGSM('5\u2032')).toBe("5'");
  });

  it('replaces reversed prime \u2035 with apostrophe', () => {
    expect(toGSM('5\u2035')).toBe("5'");
  });

  it('result passes strict GSM-7 validation', () => {
    expect(isAllGsm7(toGSM('\u2018smart quotes\u2019'))).toBe(true);
  });
});

describe('toGSM — curly double quotes', () => {
  it('replaces left double quotation mark \u201C with straight double quote', () => {
    expect(toGSM('\u201Chello\u201D')).toBe('"hello"');
  });

  it('replaces right double quotation mark \u201D with straight double quote', () => {
    expect(toGSM('\u201Dworld')).toBe('"world');
  });

  it('replaces double low-9 quotation mark \u201E with straight double quote', () => {
    expect(toGSM('\u201Etext')).toBe('"text');
  });

  it('replaces double high-reversed-9 \u201F with straight double quote', () => {
    expect(toGSM('\u201Ffoo')).toBe('"foo');
  });

  it('replaces double prime \u2033 with straight double quote', () => {
    expect(toGSM('5\u2033')).toBe('5"');
  });

  it('replaces reversed double prime \u2036 with straight double quote', () => {
    expect(toGSM('5\u2036')).toBe('5"');
  });

  it('result passes strict GSM-7 validation', () => {
    expect(isAllGsm7(toGSM('\u201Csmart double quotes\u201D'))).toBe(true);
  });
});

describe('toGSM — em dash', () => {
  it('replaces em dash \u2014 with a hyphen', () => {
    expect(toGSM('before\u2014after')).toBe('before-after');
  });

  it('result passes strict GSM-7 validation', () => {
    expect(isAllGsm7(toGSM('word\u2014word'))).toBe(true);
  });
});

describe('toGSM — en dash', () => {
  it('replaces en dash \u2013 with a hyphen', () => {
    expect(toGSM('10\u20135')).toBe('10-5');
  });

  it('result passes strict GSM-7 validation', () => {
    expect(isAllGsm7(toGSM('range\u20132026'))).toBe(true);
  });
});

describe('toGSM — horizontal ellipsis', () => {
  it('replaces horizontal ellipsis \u2026 with three dots', () => {
    expect(toGSM('Wait\u2026')).toBe('Wait...');
  });

  it('preserves existing three-dot ellipsis unchanged', () => {
    expect(toGSM('Wait...')).toBe('Wait...');
  });

  it('result passes strict GSM-7 validation', () => {
    expect(isAllGsm7(toGSM('Loading\u2026'))).toBe(true);
  });
});

describe('toGSM — non-breaking space', () => {
  it('replaces non-breaking space \u00A0 with a regular space', () => {
    expect(toGSM('hello\u00A0world')).toBe('hello world');
  });

  it('result passes strict GSM-7 validation', () => {
    expect(isAllGsm7(toGSM('a\u00A0b'))).toBe(true);
  });
});

describe('toGSM — unknown / non-GSM-7 code points', () => {
  it('replaces emoji (surrogate pair) with ? per code unit', () => {
    // Emoji are encoded as two UTF-16 surrogate code units; the GSM-7 regex
    // replaces each non-GSM-7 code unit individually, so a two-unit emoji → '??'.
    const result = toGSM('Hi \uD83D\uDE00');
    expect(result).toBe('Hi ??');
    expect(isAllGsm7(result)).toBe(true);
  });

  it('replaces Chinese characters with ?', () => {
    const result = toGSM('\u4E2D\u6587');
    expect(result).toBe('??');
    expect(isAllGsm7(result)).toBe(true);
  });

  it('replaces Arabic characters with ?', () => {
    const result = toGSM('\u0645\u0631\u062D\u0628\u0627');
    expect(result).toBe('?????');
    expect(isAllGsm7(result)).toBe(true);
  });

  it('replaces copyright symbol \u00A9 with ?', () => {
    const result = toGSM('\u00A9 2026');
    expect(result).toBe('? 2026');
    expect(isAllGsm7(result)).toBe(true);
  });

  it('result always passes strict GSM-7 validation after replacement', () => {
    const exotic = '\u2603 snowman \uD83D\uDC4D thumbs \u4E2D\u6587';
    expect(isAllGsm7(toGSM(exotic))).toBe(true);
  });
});

describe('toGSM — backtick is not in the GSM 03.38 basic charset', () => {
  it('backtick (`) is absent from the GSM-7 basic character set', () => {
    // GSM 03.38 position 0x60 maps to ¿ (U+00BF), not to `.
    expect(GSM7_BASIC.has('`')).toBe(false);
  });

  it('toGSM() replaces backtick with ? (regression: old allow-range 0x20-0x7E passed it through)', () => {
    // The sanitiser's catch-all regex now excludes 0x60 so backtick → '?'.
    const result = toGSM('hello`world');
    expect(result).toBe('hello?world');
    expect(isAllGsm7(result)).toBe(true);
  });
});

describe('toGSM — plain ASCII passthrough', () => {
  it('leaves a string using only common punctuation and letters unchanged', () => {
    const plain = 'Your invoice INV-001 for $299.00 is due. Pay at https://app.jobrunner.com.au';
    expect(toGSM(plain)).toBe(plain);
  });

  it('plain billing-reminder message fits in a single GSM-7 segment (160 septets)', () => {
    const msg = toGSM(
      'JobRunner: Your subscription renews in 3 days ($49.00 AUD). Manage at jobrunner.com.au/billing'
    );
    expect(gsmSeptetLength(msg)).toBeLessThanOrEqual(160);
    expect(isAllGsm7(msg)).toBe(true);
  });
});

describe('toGSM — combined typographic characters in a realistic template', () => {
  it('sanitises a billing reminder template containing curly quotes and em dash', () => {
    const template = `JobRunner: Your \u201CStarter\u201D plan renews in 3 days\u2014don\u2019t lose access. jobrunner.com.au/billing`;
    const result = toGSM(template);
    expect(result).toBe(
      `JobRunner: Your "Starter" plan renews in 3 days-don't lose access. jobrunner.com.au/billing`
    );
    expect(isAllGsm7(result)).toBe(true);
    expect(gsmSeptetLength(result)).toBeLessThanOrEqual(160);
  });

  it('sanitises a template with ellipsis and non-breaking space and result is within one segment', () => {
    const template = `Hi Dave,\u00A0invoice INV-042 is overdue\u2026 Pay now. - Acme Plumbing`;
    const result = toGSM(template);
    expect(isAllGsm7(result)).toBe(true);
    expect(gsmSeptetLength(result)).toBeLessThanOrEqual(160);
  });
});

describe('gsmSeptetLength — septet counting', () => {
  it('counts basic characters as 1 septet each', () => {
    expect(gsmSeptetLength('Hello')).toBe(5);
  });

  it('counts extension characters as 2 septets each', () => {
    // { and } are each 2 septets (ESC + char in extension table)
    expect(gsmSeptetLength('{}')).toBe(4);
    expect(gsmSeptetLength('^')).toBe(2);
    expect(gsmSeptetLength('|')).toBe(2);
    expect(gsmSeptetLength('~')).toBe(2);
    expect(gsmSeptetLength('€')).toBe(2);
  });

  it('a 160-char string of basic chars fits in one segment', () => {
    const msg = 'A'.repeat(160);
    expect(gsmSeptetLength(msg)).toBe(160);
  });

  it('a 154-char string with 3 extension chars uses 160 septets (one segment)', () => {
    // 154 basic chars + 3 extension chars = 154 + 6 = 160 septets
    const msg = 'A'.repeat(154) + '^^^';
    expect(gsmSeptetLength(msg)).toBe(160);
  });

  it('a 155-char string with 3 extension chars exceeds one segment', () => {
    const msg = 'A'.repeat(155) + '^^^';
    expect(gsmSeptetLength(msg)).toBeGreaterThan(160);
  });
});

// =============================================================================
// 1b. Production-module regressions via vi.importActual
//
//     These tests load the real twilioClient.toGSM (not the inlined mock copy)
//     and verify the corrected exact allow-list is in place in production code.
//     Formerly the broad ranges \u00C0-\u00C6 etc. admitted chars like
//     À, Á, â, ã, È, Ê, ë that are NOT in GSM 03.38 and would cause Twilio
//     to silently switch to UCS-2 (70-char segments).
// =============================================================================

describe('toGSM — production implementation (vi.importActual)', () => {
  let prodToGSM: (text: string) => string;

  beforeAll(async () => {
    // Loads the real module from disk, bypassing all vi.mock() stubs.
    const mod = await vi.importActual<{ toGSM: (text: string) => string }>('../twilioClient');
    prodToGSM = mod.toGSM;
  });

  // ── Characters the old broad ranges incorrectly admitted ──────────────────
  it('replaces À (U+00C0) with ? — was wrongly passed by \u00C0-\u00C6 range', () => {
    expect(prodToGSM('\u00C0')).toBe('?');
  });
  it('replaces Á (U+00C1) with ?', () => {
    expect(prodToGSM('\u00C1')).toBe('?');
  });
  it('replaces Â (U+00C2) with ?', () => {
    expect(prodToGSM('\u00C2')).toBe('?');
  });
  it('replaces Ã (U+00C3) with ?', () => {
    expect(prodToGSM('\u00C3')).toBe('?');
  });
  it('replaces á (U+00E1) with ? — was wrongly passed by \u00E0-\u00E6 range', () => {
    expect(prodToGSM('\u00E1')).toBe('?');
  });
  it('replaces â (U+00E2) with ?', () => {
    expect(prodToGSM('\u00E2')).toBe('?');
  });
  it('replaces ã (U+00E3) with ?', () => {
    expect(prodToGSM('\u00E3')).toBe('?');
  });
  it('replaces È (U+00C8) with ? — only É (U+00C9) is in GSM-7, not È', () => {
    expect(prodToGSM('\u00C8')).toBe('?');
  });
  it('replaces Ê (U+00CA) with ?', () => {
    expect(prodToGSM('\u00CA')).toBe('?');
  });
  it('replaces ê (U+00EA) with ?', () => {
    expect(prodToGSM('\u00EA')).toBe('?');
  });
  it('replaces Ë (U+00CB) with ?', () => {
    expect(prodToGSM('\u00CB')).toBe('?');
  });
  it('replaces ë (U+00EB) with ?', () => {
    expect(prodToGSM('\u00EB')).toBe('?');
  });
  it('replaces Ó (U+00D3) with ? — was wrongly passed by \u00D2-\u00D6 range', () => {
    expect(prodToGSM('\u00D3')).toBe('?');
  });
  it('replaces ú (U+00FA) with ? — was wrongly passed by \u00F9-\u00FC range', () => {
    expect(prodToGSM('\u00FA')).toBe('?');
  });

  // ── Valid GSM-7 accented characters must still pass through unchanged ──────
  it('passes É (U+00C9) through unchanged — it IS in GSM-7 basic table', () => {
    expect(prodToGSM('\u00C9')).toBe('\u00C9');
  });
  it('passes è (U+00E8) through unchanged', () => {
    expect(prodToGSM('\u00E8')).toBe('\u00E8');
  });
  it('passes é (U+00E9) through unchanged', () => {
    expect(prodToGSM('\u00E9')).toBe('\u00E9');
  });
  it('passes Ä (U+00C4) through unchanged', () => {
    expect(prodToGSM('\u00C4')).toBe('\u00C4');
  });
  it('passes ü (U+00FC) through unchanged', () => {
    expect(prodToGSM('\u00FC')).toBe('\u00FC');
  });
  it('passes ñ (U+00F1) through unchanged', () => {
    expect(prodToGSM('\u00F1')).toBe('\u00F1');
  });
  it('replaces em-dash and result passes strict GSM-7 validation', () => {
    const result = prodToGSM('before\u2014after');
    expect(result).toBe('before-after');
    expect(isAllGsm7(result)).toBe(true);
  });
  it('output of prodToGSM always passes strict GSM-7 validation', () => {
    const exotic = 'Á à â ã È Ê ë Ó ú \u2014 \u201C test \u2019';
    expect(isAllGsm7(prodToGSM(exotic))).toBe(true);
  });
});

// =============================================================================
// 2. Integration test — processBillingReminders passes GSM-7 to Twilio
// =============================================================================

describe('processBillingReminders — message passed to Twilio is GSM-7 clean', () => {
  const mockSettings = {
    id:                        'biz-1',
    userId:                    'user-1',
    subscriptionStatus:        'active',
    billingRemindersEnabled:   true,
    nextBillingDate:           new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    billingReminderDays:       [3],
    lastBillingReminderSentAt: null,
    phone:                     '+61400000000',
    seatCount:                 0,
    paymentMethodBrand:        'visa',
    paymentMethodLast4:        '4242',
  };

  const mockUser = {
    id:               'user-1',
    isActive:         true,
    email:            null, // disable email path so only SMS fires
    firstName:        'Alice',
    subscriptionTier: 'pro',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (storage.getAllBusinessSettings as any).mockResolvedValue([mockSettings]);
    (storage.getUser as any).mockResolvedValue(mockUser);
    (storage.updateBusinessSettings as any).mockResolvedValue(undefined);
    (sendSMS as any).mockResolvedValue({ success: true, messageId: 'SM123' });
  });

  it('passes a GSM-7 clean message to the Twilio client for a standard renewal reminder', async () => {
    await processBillingReminders();

    expect(sendSMS).toHaveBeenCalledOnce();
    const { message } = (sendSMS as any).mock.calls[0][0];
    expect(typeof message).toBe('string');
    // Strict GSM 03.38 validator — not the overbroad ASCII range
    expect(isAllGsm7(message)).toBe(true);
  });

  it('message fits within a single GSM-7 segment (160 septets)', async () => {
    await processBillingReminders();

    const { message } = (sendSMS as any).mock.calls[0][0];
    // Septet-accurate length — extension chars cost 2
    expect(gsmSeptetLength(message)).toBeLessThanOrEqual(160);
  });

  it('passes a GSM-7 clean message for a trial-ending reminder (1 day)', async () => {
    const trialSettings = {
      ...mockSettings,
      subscriptionStatus:  'trialing',
      nextBillingDate:     new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      billingReminderDays: [1],
    };
    (storage.getAllBusinessSettings as any).mockResolvedValue([trialSettings]);

    await processBillingReminders();

    expect(sendSMS).toHaveBeenCalledOnce();
    const { message } = (sendSMS as any).mock.calls[0][0];
    expect(isAllGsm7(message)).toBe(true);
    expect(gsmSeptetLength(message)).toBeLessThanOrEqual(160);
  });

  it('passes a GSM-7 clean message for a trial-ending reminder (multiple days)', async () => {
    const trialSettings = {
      ...mockSettings,
      subscriptionStatus:  'trialing',
      nextBillingDate:     new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      billingReminderDays: [5],
    };
    (storage.getAllBusinessSettings as any).mockResolvedValue([trialSettings]);

    await processBillingReminders();

    expect(sendSMS).toHaveBeenCalledOnce();
    const { message } = (sendSMS as any).mock.calls[0][0];
    expect(isAllGsm7(message)).toBe(true);
    expect(gsmSeptetLength(message)).toBeLessThanOrEqual(160);
  });

  it('does not call Twilio when there is no phone number on the business settings', async () => {
    const noPhoneSettings = { ...mockSettings, phone: null };
    (storage.getAllBusinessSettings as any).mockResolvedValue([noPhoneSettings]);

    await processBillingReminders();

    expect(sendSMS).not.toHaveBeenCalled();
  });
});
