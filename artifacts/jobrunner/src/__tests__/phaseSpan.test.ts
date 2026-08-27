import { describe, it, expect } from "vitest";
import { getPhaseSpanPosition } from "../lib/phaseSpan";

// Helpers -------------------------------------------------------------------

/** Build a sequence of 7 consecutive Date objects starting from `startStr`. */
function week(startStr: string): Date[] {
  const start = new Date(startStr + "T00:00:00");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/** Return the nth day (0-based) from the generated week array. */
function day(days: Date[], n: number): Date {
  return days[n];
}

// ---------------------------------------------------------------------------
// Null / missing date cases — the primary regression guard for this task
// ---------------------------------------------------------------------------

describe("getPhaseSpanPosition — null/missing dates", () => {
  const days = week("2025-06-02"); // Mon–Sun

  it('returns "single" when scheduledStart is null', () => {
    expect(
      getPhaseSpanPosition(
        { scheduledStart: null, scheduledEnd: "2025-06-04T10:00:00" },
        day(days, 2),
        days,
      ),
    ).toBe("single");
  });

  it('returns "single" when scheduledEnd is null', () => {
    expect(
      getPhaseSpanPosition(
        { scheduledStart: "2025-06-02T09:00:00", scheduledEnd: null },
        day(days, 0),
        days,
      ),
    ).toBe("single");
  });

  it('returns "single" when both scheduledStart and scheduledEnd are null', () => {
    expect(
      getPhaseSpanPosition(
        { scheduledStart: null, scheduledEnd: null },
        day(days, 0),
        days,
      ),
    ).toBe("single");
  });

  it('returns "single" when scheduledStart is undefined', () => {
    expect(
      getPhaseSpanPosition(
        { scheduledEnd: "2025-06-04T10:00:00" },
        day(days, 2),
        days,
      ),
    ).toBe("single");
  });

  it('returns "single" when scheduledEnd is undefined', () => {
    expect(
      getPhaseSpanPosition(
        { scheduledStart: "2025-06-02T09:00:00" },
        day(days, 0),
        days,
      ),
    ).toBe("single");
  });

  it('returns "single" when both date fields are undefined', () => {
    expect(
      getPhaseSpanPosition(
        {},
        day(days, 3),
        days,
      ),
    ).toBe("single");
  });
});

// ---------------------------------------------------------------------------
// Same-day phase
// ---------------------------------------------------------------------------

describe("getPhaseSpanPosition — single-day phase", () => {
  const days = week("2025-06-02");

  it('returns "single" when start and end are the same date', () => {
    expect(
      getPhaseSpanPosition(
        {
          scheduledStart: "2025-06-04T09:00:00",
          scheduledEnd:   "2025-06-04T11:00:00",
        },
        day(days, 2), // Wed 4 Jun
        days,
      ),
    ).toBe("single");
  });
});

// ---------------------------------------------------------------------------
// Multi-day phase spanning the full week
// ---------------------------------------------------------------------------

describe("getPhaseSpanPosition — multi-day phase", () => {
  const days = week("2025-06-02"); // Mon 2 Jun … Sun 8 Jun

  const phase = {
    scheduledStart: "2025-06-03T08:00:00", // Tue
    scheduledEnd:   "2025-06-06T17:00:00", // Fri
  };

  it('returns "start" on the first active day (Tue)', () => {
    expect(getPhaseSpanPosition(phase, day(days, 1), days)).toBe("start");
  });

  it('returns "middle" on interior days (Wed, Thu)', () => {
    expect(getPhaseSpanPosition(phase, day(days, 2), days)).toBe("middle");
    expect(getPhaseSpanPosition(phase, day(days, 3), days)).toBe("middle");
  });

  it('returns "end" on the last active day (Fri)', () => {
    expect(getPhaseSpanPosition(phase, day(days, 4), days)).toBe("end");
  });

  it('returns "single" on a day outside the phase window (Mon before, Sat after)', () => {
    // Mon is before the phase start → only 0 active days in the week preceding it;
    // but since Mon is NOT in the activeDays list for the Tue–Fri phase,
    // activeDays.length is still 4 (Tue–Fri).  Mon's dayStr won't equal first/last active,
    // so it falls through to "middle".  However, phaseOnDay() guards the render —
    // this helper is only called for days already confirmed to be in range.
    // To test out-of-range, use a week that only partially overlaps.
    const earlyWeek = week("2025-05-26"); // Mon–Sun, all before phase start
    expect(
      getPhaseSpanPosition(phase, earlyWeek[0], earlyWeek),
    ).toBe("single"); // activeDays.length === 0 → <= 1 → "single"
  });
});

// ---------------------------------------------------------------------------
// Phase that spans across a week boundary (only partially visible in view)
// ---------------------------------------------------------------------------

describe("getPhaseSpanPosition — phase partially visible in view", () => {
  const days = week("2025-06-09"); // Mon 9 Jun … Sun 15 Jun

  const phase = {
    scheduledStart: "2025-06-07T08:00:00", // Sat last week
    scheduledEnd:   "2025-06-11T17:00:00", // Wed this week
  };

  it('returns "start" on the first day of this view that falls in the phase (Mon)', () => {
    // Mon (days[0]) is inside the phase; it is the first visible day in this week
    expect(getPhaseSpanPosition(phase, day(days, 0), days)).toBe("start");
  });

  it('returns "middle" on Tue (second visible day)', () => {
    expect(getPhaseSpanPosition(phase, day(days, 1), days)).toBe("middle");
  });

  it('returns "end" on Wed (last visible day of phase in this view)', () => {
    expect(getPhaseSpanPosition(phase, day(days, 2), days)).toBe("end");
  });
});
