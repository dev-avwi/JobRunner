/**
 * PII redaction tests — verifies that both logging layers strip sensitive data
 * before it reaches stdout or the database.
 *
 * 1. pino logger (lib/logger.ts) — structural redaction at root, one level,
 *    and two levels deep.
 * 2. Custom persistence logger (logger.ts) — sanitizeMetadata and
 *    sanitizeMessage helpers that guard the errorLogs DB table and stdout.
 */

import { describe, it, expect } from 'vitest';
import { sanitizeMetadata, sanitizeMessage, sanitizeError } from '../logger';

// ---------------------------------------------------------------------------
// sanitizeMetadata
// ---------------------------------------------------------------------------

describe('sanitizeMetadata', () => {
  const PII_FIELDS = [
    'email', 'phone', 'phoneNormalized',
    'bankBsb', 'bankAccountNumber', 'bankAccountName',
    'abn', 'tfn', 'payId', 'password', 'passwordHash',
    'emailVerificationToken', 'passwordResetToken',
    'appleReceiptData', 'stripeCustomerId', 'stripePaymentIntentId',
  ];

  it('redacts PII fields at root level', () => {
    const input = { email: 'alice@example.com', phone: '0412345678', jobCount: 3 };
    const result = sanitizeMetadata(input) as any;
    expect(result.email).toBe('[REDACTED]');
    expect(result.phone).toBe('[REDACTED]');
    // Non-PII field must be preserved
    expect(result.jobCount).toBe(3);
  });

  it('redacts PII fields one level deep', () => {
    const input = { user: { email: 'bob@example.com', firstName: 'Bob' } };
    const result = sanitizeMetadata(input) as any;
    expect(result.user.email).toBe('[REDACTED]');
    expect(result.user.firstName).toBe('Bob');
  });

  it('redacts PII fields two levels deep', () => {
    const input = { data: { user: { bankAccountNumber: '12345678', id: 'u_1' } } };
    const result = sanitizeMetadata(input) as any;
    expect(result.data.user.bankAccountNumber).toBe('[REDACTED]');
    expect(result.data.user.id).toBe('u_1');
  });

  it('preserves non-PII scalars and arrays unchanged', () => {
    const input = { ids: ['u1', 'u2'], count: 42, ok: true };
    const result = sanitizeMetadata(input) as any;
    expect(result.ids).toEqual(['u1', 'u2']);
    expect(result.count).toBe(42);
    expect(result.ok).toBe(true);
  });

  it('handles null and undefined gracefully', () => {
    expect(sanitizeMetadata(null)).toBeNull();
    expect(sanitizeMetadata(undefined)).toBeUndefined();
  });

  it.each(PII_FIELDS)('redacts "%s" field', (field) => {
    const result = sanitizeMetadata({ [field]: 'sensitive-value' }) as any;
    expect(result[field]).toBe('[REDACTED]');
  });
});

// ---------------------------------------------------------------------------
// sanitizeMessage
// ---------------------------------------------------------------------------

describe('sanitizeMessage', () => {
  it('redacts email addresses interpolated into log messages', () => {
    const msg = '[Lifecycle] Sent welcome to alice@example.com';
    expect(sanitizeMessage(msg)).toBe('[Lifecycle] Sent welcome to [REDACTED]');
  });

  it('redacts email addresses with + tags and subdomains', () => {
    const msg = 'Failed to send invoice to bob+tag@mail.example.co.uk';
    expect(sanitizeMessage(msg)).toBe('Failed to send invoice to [REDACTED]');
  });

  it('redacts Australian mobile numbers (04xx format)', () => {
    const msg = 'SMS sent to 0412 345 678';
    expect(sanitizeMessage(msg)).not.toContain('0412');
    expect(sanitizeMessage(msg)).toContain('[REDACTED]');
  });

  it('redacts +61 international format phone numbers', () => {
    const msg = 'Calling +61412345678';
    expect(sanitizeMessage(msg)).not.toContain('+61412345678');
    expect(sanitizeMessage(msg)).toContain('[REDACTED]');
  });

  it('does not alter messages with no PII', () => {
    const msg = '[Lifecycle] Processed 10 users, sent 3 emails';
    expect(sanitizeMessage(msg)).toBe(msg);
  });

  it('redacts multiple PII items in a single message', () => {
    const msg = 'User alice@example.com called 0412345678';
    const result = sanitizeMessage(msg);
    expect(result).not.toContain('alice@example.com');
    expect(result).not.toContain('0412345678');
    expect(result.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// sanitizeError
// ---------------------------------------------------------------------------

describe('sanitizeError', () => {
  it('returns undefined for null/undefined', () => {
    expect(sanitizeError(null)).toBeUndefined();
    expect(sanitizeError(undefined)).toBeUndefined();
  });

  it('redacts email in Error.message', () => {
    const err = new Error('Failed to send to alice@example.com via Twilio');
    const result = sanitizeError(err) as any;
    expect(result.message).not.toContain('alice@example.com');
    expect(result.message).toContain('[REDACTED]');
  });

  it('redacts phone number in Error.message', () => {
    const err = new Error('SMS failed for 0412345678');
    const result = sanitizeError(err) as any;
    expect(result.message).not.toContain('0412345678');
    expect(result.message).toContain('[REDACTED]');
  });

  it('redacts PII in stack frames', () => {
    const err = new Error('error');
    err.stack = 'Error: error\n    at sendTo(alice@example.com)\n    at index.js:1:1';
    const result = sanitizeError(err) as any;
    expect(result.stack).not.toContain('alice@example.com');
  });

  it('truncates stack to at most 8 lines', () => {
    const err = new Error('big stack');
    err.stack = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n');
    const result = sanitizeError(err) as any;
    expect(result.stack.split('\n').length).toBeLessThanOrEqual(8);
  });

  it('handles non-Error values with sanitized raw string', () => {
    const result = sanitizeError('failed for alice@example.com') as any;
    expect(result.raw).not.toContain('alice@example.com');
    expect(result.raw).toContain('[REDACTED]');
  });

  it('preserves error name for identification', () => {
    const err = new TypeError('bad type');
    const result = sanitizeError(err) as any;
    expect(result.name).toBe('TypeError');
  });
});

// ---------------------------------------------------------------------------
// pino structural redaction (lib/logger.ts)
// ---------------------------------------------------------------------------

describe('pino logger redaction paths', () => {
  it('redacts PII fields at root, one level, and two levels deep', async () => {
    // Capture pino output by piping to a writable stream.
    const { Writable } = await import('stream');
    const chunks: Buffer[] = [];
    const dest = new Writable({
      write(chunk, _enc, cb) { chunks.push(chunk); cb(); },
    });

    const pino = (await import('pino')).default;
    const { buildRedactPaths } = await import('../lib/logger');
    const testLogger = pino(
      { level: 'info', redact: { paths: buildRedactPaths(), censor: '[REDACTED]' } },
      dest,
    );

    // Log a structured object with PII at three different depths.
    testLogger.info({ email: 'root@example.com' }, 'root-level test');
    testLogger.info({ user: { email: 'one@example.com' } }, 'one-level test');
    testLogger.info({ data: { user: { email: 'two@example.com' } } }, 'two-level test');

    // Give pino time to flush the synchronous writes.
    await new Promise((r) => setTimeout(r, 50));

    const output = Buffer.concat(chunks).toString('utf8');
    expect(output).not.toContain('root@example.com');
    expect(output).not.toContain('one@example.com');
    expect(output).not.toContain('two@example.com');
    expect(output).toContain('[REDACTED]');
  });
});
