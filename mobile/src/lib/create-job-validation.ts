/**
 * Pure validation helpers for the Create Job form.
 * Extracted so they can be unit-tested independently of the React component.
 */

export type DurationResult =
  | { ok: true; minutes: number }
  | { ok: false; error: string };

/**
 * Parse and validate the estimated duration field (hours, decimal allowed).
 *
 * - Empty string is valid (optional field) — returns `{ ok: true, minutes: 0 }`.
 * - Rejects any string that contains non-numeric characters (e.g. "1abc", "1.2.3").
 * - Rejects non-finite values (Infinity, NaN).
 * - Rejects zero and negative values.
 */
export function parseDuration(raw: string): DurationResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, minutes: 0 };

  // Require the entire string to be a non-negative decimal (digits, optional single dot, more digits).
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return {
      ok: false,
      error: 'Estimated duration must be a positive number (e.g., 1.5 for 90 minutes).',
    };
  }

  const hours = Number(trimmed);

  if (!Number.isFinite(hours) || hours <= 0) {
    return {
      ok: false,
      error: 'Estimated duration must be a positive number (e.g., 1.5 for 90 minutes).',
    };
  }

  return { ok: true, minutes: Math.round(hours * 60) };
}

export type RecurrenceEndDateResult =
  | { ok: true; date: Date | null }
  | { ok: false; error: string };

/**
 * Parse and validate the recurrence end date string.
 *
 * - Empty string is valid (no end date) — returns `{ ok: true, date: null }`.
 * - Requires strict YYYY-MM-DD format.
 * - Rejects impossible calendar dates (e.g. Feb 30) by comparing parsed components.
 * - Uses local calendar dates throughout to avoid UTC-offset misclassification.
 * - Rejects dates in the past (before today's local midnight).
 * - When `scheduledAt` is provided, rejects dates on or before the scheduled start day.
 */
export function parseRecurrenceEndDate(
  raw: string,
  scheduledAt: Date | null,
): RecurrenceEndDateResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, date: null };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return {
      ok: false,
      error: 'The recurrence end date is not a valid date. Use the format YYYY-MM-DD.',
    };
  }

  const [yearStr, monthStr, dayStr] = trimmed.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-based
  const day = parseInt(dayStr, 10);

  // Construct as a local midnight date; JavaScript normalises overflows (e.g.
  // Feb 30 → Mar 2), so we must verify the components round-trip.
  const endDate = new Date(year, month - 1, day);

  if (
    endDate.getFullYear() !== year ||
    endDate.getMonth() !== month - 1 ||
    endDate.getDate() !== day
  ) {
    return {
      ok: false,
      error: 'The recurrence end date is not a valid date. Use the format YYYY-MM-DD.',
    };
  }

  // Compare against local today at midnight.
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (endDate < todayMidnight) {
    return { ok: false, error: 'The recurrence end date cannot be in the past.' };
  }

  // Must be strictly after the scheduled start (local calendar day).
  if (scheduledAt) {
    const startMidnight = new Date(
      scheduledAt.getFullYear(),
      scheduledAt.getMonth(),
      scheduledAt.getDate(),
    );
    if (endDate <= startMidnight) {
      return {
        ok: false,
        error: 'The recurrence end date must be after the scheduled start date.',
      };
    }
  }

  return { ok: true, date: endDate };
}
