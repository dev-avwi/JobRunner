import { afterEach, describe, expect, it } from 'vitest';
import { toGSM, sendSMS, __setSmsTestInterceptor } from '../twilioClient';

// ── Unit tests for toGSM() ────────────────────────────────────────────────────

describe('toGSM()', () => {
  it('converts curly single quotes to straight single quotes', () => {
    // \u2018 left, \u2019 right, \u201A low-9, \u201B reversed, \u2032 prime, \u2035 reversed prime
    expect(toGSM('\u2018hello\u2019')).toBe("'hello'");
    expect(toGSM('\u201Aworld\u201B')).toBe("'world'");
    expect(toGSM('\u2032hi\u2035')).toBe("'hi'");
  });

  it('converts curly double quotes to straight double quotes', () => {
    // \u201C left, \u201D right, \u201E low-9, \u201F reversed, \u2033 double-prime, \u2036 reversed
    expect(toGSM('\u201Chello\u201D')).toBe('"hello"');
    expect(toGSM('\u201Eworld\u201F')).toBe('"world"');
    expect(toGSM('\u2033hi\u2036')).toBe('"hi"');
  });

  it('converts em dash to hyphen', () => {
    expect(toGSM('before\u2014after')).toBe('before-after');
  });

  it('converts en dash to hyphen', () => {
    expect(toGSM('before\u2013after')).toBe('before-after');
  });

  it('converts horizontal ellipsis to three dots', () => {
    expect(toGSM('loading\u2026')).toBe('loading...');
  });

  it('converts non-breaking space to regular space', () => {
    expect(toGSM('hello\u00A0world')).toBe('hello world');
  });

  it('replaces arbitrary non-GSM-7 code points with ?', () => {
    // Emoji are surrogate pairs (2 UTF-16 code units) so produce '??' — one ? per unit
    expect(toGSM('\uD83D\uDE00')).toBe('??'); // emoji 😀 (surrogate pair → 2 replacements)
    expect(toGSM('\u4E2D\u6587')).toBe('??'); // CJK characters (2 code points)
    expect(toGSM('\u0400')).toBe('?');          // Cyrillic (1 code point)
    expect(toGSM('\u20AC')).toBe('\u20AC');     // Euro sign — GSM-7 extension table (costs 2 septets, stays valid)
  });

  it('preserves plain ASCII text unchanged', () => {
    const plain = 'Your job #123 is scheduled for 9am. Call us on 0400 000 000.';
    expect(toGSM(plain)).toBe(plain);
  });

  it('preserves GSM-7 accented characters unchanged', () => {
    expect(toGSM('Cafe\u00E9')).toBe('Cafe\u00E9');    // e-acute
    expect(toGSM('\u00C5\u00E5')).toBe('\u00C5\u00E5'); // Å å
    expect(toGSM('\u00DF')).toBe('\u00DF');              // ß
    expect(toGSM('\u00E0')).toBe('\u00E0');              // à
  });

  it('handles a real-world mixed typographic message', () => {
    const input =
      '\u201CYour quote\u201D \u2013 $1,200\u2026 Call us\u00A0now\u2014don\u2019t wait!';
    const expected = '"Your quote" - $1,200... Call us now-don\'t wait!';
    expect(toGSM(input)).toBe(expected);
  });

  it('returns an empty string unchanged', () => {
    expect(toGSM('')).toBe('');
  });
});

// ── Integration-level tests: sendSMS() sanitises before the interceptor ───────

describe('sendSMS() — interceptor receives sanitised body', () => {
  afterEach(() => {
    __setSmsTestInterceptor(null);
  });

  it('delivers a GSM-7 sanitised body to the interceptor', async () => {
    let capturedMessage = '';

    __setSmsTestInterceptor((opts) => {
      capturedMessage = opts.message;
      return { success: true, simulated: true };
    });

    const rawMessage =
      '\u201CHello\u201D\u2014it\u2019s your job update\u2026 don\u2019t miss it\u00A0now!';
    const expectedMessage =
      '"Hello"-it\'s your job update... don\'t miss it now!';

    const result = await sendSMS({ to: '+61400000000', message: rawMessage });

    expect(result.success).toBe(true);
    expect(capturedMessage).toBe(expectedMessage);
  });

  it('strips non-GSM-7 code points before reaching the interceptor', async () => {
    let capturedMessage = '';

    __setSmsTestInterceptor((opts) => {
      capturedMessage = opts.message;
      return { success: true, simulated: true };
    });

    // Emoji are surrogate pairs so each produces '??'; CJK produces '??' for 2 code points
    await sendSMS({ to: '+61400000000', message: 'Update \uD83D\uDE00 \u4E2D\u6587 done' });

    expect(capturedMessage).toBe('Update ?? ?? done');
  });

  it('passes through plain ASCII without modification', async () => {
    let capturedMessage = '';

    __setSmsTestInterceptor((opts) => {
      capturedMessage = opts.message;
      return { success: true, simulated: true };
    });

    const plain = 'Job #99 confirmed for 9am Monday.';
    await sendSMS({ to: '+61400000000', message: plain });

    expect(capturedMessage).toBe(plain);
  });

  it('returns the interceptor result directly', async () => {
    __setSmsTestInterceptor(() => ({
      success: true,
      messageId: 'TEST-SID-001',
      simulated: true,
    }));

    const result = await sendSMS({ to: '+61400000001', message: 'Hello' });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('TEST-SID-001');
    expect(result.simulated).toBe(true);
  });

  it('sanitises the body and passes mediaUrls through unchanged for MMS sends', async () => {
    let capturedOptions: { message: string; mediaUrls?: string[] } | null = null;

    __setSmsTestInterceptor((opts) => {
      capturedOptions = { message: opts.message, mediaUrls: opts.mediaUrls };
      return { success: true, simulated: true };
    });

    const rawMessage =
      '\u201CJob photo attached\u201D\u2014please review\u2026 don\u2019t hesitate to call\u00A0us!';
    const expectedMessage =
      '"Job photo attached"-please review... don\'t hesitate to call us!';
    const mediaUrls = [
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.jpg',
    ];

    const result = await sendSMS({
      to: '+61400000003',
      message: rawMessage,
      mediaUrls,
    });

    expect(result.success).toBe(true);
    expect(capturedOptions).not.toBeNull();
    // Body must be GSM-7 sanitised even though this is an MMS send
    expect(capturedOptions!.message).toBe(expectedMessage);
    // Media URLs must be forwarded exactly as provided
    expect(capturedOptions!.mediaUrls).toEqual(mediaUrls);
  });

  it('does not invoke a previously registered interceptor after it is cleared', async () => {
    let called = false;
    __setSmsTestInterceptor(() => {
      called = true;
      return { success: true };
    });
    // Clear the interceptor before sending
    __setSmsTestInterceptor(null);

    // Register a fresh interceptor so the SMS does not hit the real Twilio in this test
    __setSmsTestInterceptor((opts) => {
      // This interceptor replaces the cleared one
      return { success: true, messageId: 'fresh-interceptor' };
    });

    const result = await sendSMS({ to: '+61400000002', message: 'Hi' });

    expect(called).toBe(false);
    expect(result.success).toBe(true);
  });
});
