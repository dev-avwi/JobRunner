/**
 * Money-math test for the time-tracking earnings calculation — converts
 * logged minutes into a dollar amount at an hourly rate. Extracted from
 * app/more/time-tracking.tsx into src/utils/earnings.ts (no behavior
 * change) so it's testable without pulling in that screen's full import
 * chain (expo-background-fetch et al., which isn't mocked under jest).
 */
import { calculateEarnings } from '../../utils/earnings';

describe('calculateEarnings', () => {
  it('computes a full hour at the hourly rate', () => {
    expect(calculateEarnings(60, 45)).toBe(45);
  });

  it('computes a partial hour proportionally', () => {
    expect(calculateEarnings(30, 45)).toBe(22.5);
  });

  it('returns 0 for 0 minutes regardless of rate', () => {
    expect(calculateEarnings(0, 45)).toBe(0);
  });

  it('handles a rate that produces a repeating decimal without throwing', () => {
    // 20 minutes at $45/hr = 1/3 hour * 45 = 15 exactly, but 7 minutes
    // exercises the non-terminating-decimal path (7/60 * 45 = 5.25).
    expect(calculateEarnings(7, 45)).toBeCloseTo(5.25, 2);
  });

  it('scales linearly with duration for a fixed rate', () => {
    const rate = 38.5;
    const oneHour = calculateEarnings(60, rate);
    const twoHours = calculateEarnings(120, rate);
    expect(twoHours).toBeCloseTo(oneHour * 2, 5);
  });
});
