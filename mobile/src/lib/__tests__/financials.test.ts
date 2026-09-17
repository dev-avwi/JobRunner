/**
 * Money-math tests for the canonical GST helpers in shared/financials.ts —
 * used by every quote, invoice, purchase order, and payment receipt. A
 * rounding bug here costs users real dollars, so this is tested directly
 * against the same module the app imports via the @shared/* alias (Metro
 * resolves that alias at bundle time; Jest has no such mapping, so this
 * test reaches the file by relative path instead).
 */
import { calculateDocumentTotals, reverseTaxCalculation, type FinancialLineItem } from '../../../../shared/financials';

describe('calculateDocumentTotals', () => {
  it('applies the default 10% GST to a simple quantity x unitPrice line', () => {
    const result = calculateDocumentTotals([{ quantity: 2, unitPrice: 50 }]);
    expect(result.subtotal).toBe(100);
    expect(result.gstAmount).toBe(10);
    expect(result.total).toBe(110);
  });

  it('sums pre-calculated amount lines alongside quantity x unitPrice lines', () => {
    const items: FinancialLineItem[] = [
      { quantity: 3, unitPrice: 25 }, // 75
      { amount: 24.5 },
    ];
    const result = calculateDocumentTotals(items);
    expect(result.subtotal).toBe(99.5);
    expect(result.gstAmount).toBe(9.95);
    expect(result.total).toBe(109.45);
  });

  it('produces zero GST and total when there are no line items', () => {
    const result = calculateDocumentTotals([]);
    expect(result).toEqual({ subtotal: 0, gstAmount: 0, total: 0 });
  });

  it('supports a zero tax rate (GST-exempt documents)', () => {
    const result = calculateDocumentTotals([{ amount: 250 }], 0);
    expect(result).toEqual({ subtotal: 250, gstAmount: 0, total: 250 });
  });

  it('rounds the final subtotal/GST/total to the nearest cent at a half-cent boundary', () => {
    // 3 lines of 0.005 sum to a subtotal with a floating-point tail;
    // rounding must happen once, on the final subtotal, not per-line.
    const result = calculateDocumentTotals([
      { amount: 10.005 },
      { amount: 10.005 },
      { amount: 10.005 },
    ]);
    // raw subtotal = 30.015 -> rounds to 30.02 (round-half-up on the cent)
    expect(result.subtotal).toBe(30.02);
    expect(result.gstAmount).toBe(3.0);
    expect(result.total).toBe(33.02);
  });

  it('does not accumulate floating-point drift across many small lines', () => {
    const items: FinancialLineItem[] = Array.from({ length: 10 }, () => ({ amount: 0.1 }));
    const result = calculateDocumentTotals(items);
    expect(result.subtotal).toBe(1);
    expect(result.gstAmount).toBe(0.1);
    expect(result.total).toBe(1.1);
  });
});

describe('reverseTaxCalculation', () => {
  it('splits a round GST-inclusive total into subtotal + GST at the default rate', () => {
    const result = reverseTaxCalculation(110);
    expect(result.subtotal).toBe(100);
    expect(result.gstAmount).toBe(10);
    expect(result.total).toBe(110);
  });

  it('round-trips: forward calculation followed by reverse calculation recovers the original split', () => {
    const forward = calculateDocumentTotals([{ quantity: 7, unitPrice: 4.99 }]);
    const reversed = reverseTaxCalculation(forward.total);
    expect(reversed.subtotal).toBe(forward.subtotal);
    expect(reversed.gstAmount).toBe(forward.gstAmount);
    expect(reversed.total).toBe(forward.total);
  });

  it('handles an awkward tax-inclusive amount ($33.33) without drifting off by a cent', () => {
    const result = reverseTaxCalculation(33.33);
    // subtotal + gstAmount must reconstruct the original total exactly.
    expect(Math.round((result.subtotal + result.gstAmount) * 100) / 100).toBe(33.33);
    expect(result.total).toBe(33.33);
  });

  it('handles the smallest representable amount (1 cent) without going negative', () => {
    const result = reverseTaxCalculation(0.01);
    expect(result.total).toBe(0.01);
    expect(result.subtotal).toBeGreaterThanOrEqual(0);
    expect(result.gstAmount).toBeGreaterThanOrEqual(0);
  });

  it('supports a zero tax rate (entire amount is subtotal, no GST)', () => {
    const result = reverseTaxCalculation(250, 0);
    expect(result).toEqual({ subtotal: 250, gstAmount: 0, total: 250 });
  });
});
