import { parseDuration, parseRecurrenceEndDate } from '../create-job-validation';

// ---------------------------------------------------------------------------
// parseDuration
// ---------------------------------------------------------------------------

describe('parseDuration', () => {
  it('accepts a whole number and converts to minutes', () => {
    const r = parseDuration('4');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.minutes).toBe(240);
  });

  it('accepts a decimal and converts to minutes', () => {
    const r = parseDuration('1.5');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.minutes).toBe(90);
  });

  it('accepts empty string (optional field)', () => {
    const r = parseDuration('');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.minutes).toBe(0);
  });

  it('accepts whitespace-only string the same as empty', () => {
    const r = parseDuration('   ');
    expect(r.ok).toBe(true);
  });

  it('rejects a string with trailing alpha characters', () => {
    expect(parseDuration('1abc').ok).toBe(false);
  });

  it('rejects a string with embedded alpha characters', () => {
    expect(parseDuration('1a5').ok).toBe(false);
  });

  it('rejects multiple decimal points', () => {
    expect(parseDuration('1.2.3').ok).toBe(false);
  });

  it('rejects negative values', () => {
    expect(parseDuration('-1').ok).toBe(false);
    expect(parseDuration('-0.5').ok).toBe(false);
  });

  it('rejects zero', () => {
    expect(parseDuration('0').ok).toBe(false);
    expect(parseDuration('0.0').ok).toBe(false);
  });

  it('rejects the string "Infinity"', () => {
    expect(parseDuration('Infinity').ok).toBe(false);
  });

  it('rejects a leading-sign positive', () => {
    // "+4" contains a non-digit character
    expect(parseDuration('+4').ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseRecurrenceEndDate
// ---------------------------------------------------------------------------

describe('parseRecurrenceEndDate', () => {
  // A scheduled start well in the future so "past" checks don't interfere.
  const future = new Date(2030, 0, 15); // 15 Jan 2030 local

  it('accepts empty string (no end date)', () => {
    const r = parseRecurrenceEndDate('', future);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.date).toBeNull();
  });

  it('accepts a valid future date strictly after scheduledAt', () => {
    const r = parseRecurrenceEndDate('2030-06-01', future);
    expect(r.ok).toBe(true);
  });

  it('accepts a date the day after scheduledAt', () => {
    const r = parseRecurrenceEndDate('2030-01-16', future);
    expect(r.ok).toBe(true);
  });

  it('works when scheduledAt is null', () => {
    const r = parseRecurrenceEndDate('2030-06-01', null);
    expect(r.ok).toBe(true);
  });

  it('rejects slash-delimited format', () => {
    expect(parseRecurrenceEndDate('01/06/2030', future).ok).toBe(false);
    expect(parseRecurrenceEndDate('2030/06/01', future).ok).toBe(false);
  });

  it('rejects plain text', () => {
    expect(parseRecurrenceEndDate('next-year', future).ok).toBe(false);
  });

  it('rejects an impossible calendar date (Feb 30)', () => {
    expect(parseRecurrenceEndDate('2030-02-30', future).ok).toBe(false);
  });

  it('rejects an impossible calendar date (month 13)', () => {
    expect(parseRecurrenceEndDate('2030-13-01', future).ok).toBe(false);
  });

  it('rejects a date in the past', () => {
    expect(parseRecurrenceEndDate('2020-01-01', future).ok).toBe(false);
  });

  it('rejects a date on the same day as scheduledAt', () => {
    // Same local calendar day → not strictly after
    expect(parseRecurrenceEndDate('2030-01-15', future).ok).toBe(false);
  });

  it('rejects a date before scheduledAt', () => {
    expect(parseRecurrenceEndDate('2030-01-10', future).ok).toBe(false);
  });

  it('error message mentions past when date is in the past', () => {
    const r = parseRecurrenceEndDate('2020-01-01', future);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/past/i);
  });

  it('error message mentions format when string is malformed', () => {
    const r = parseRecurrenceEndDate('01/06/2030', future);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/YYYY-MM-DD/i);
  });
});
