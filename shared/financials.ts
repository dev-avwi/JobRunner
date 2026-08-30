/**
 * Canonical GST / invoice calculation helpers.
 *
 * Rounding policy: rounding (2 decimal places via Math.round(x * 100) / 100)
 * is applied ONLY to the final subtotal, gstAmount, and total values — never
 * to intermediate per-line amounts — so that accumulated floating-point drift
 * is absorbed at one deterministic point.
 *
 * GST rate assumption: 10% (Australian GST). The gstRate parameter defaults to
 * 0.1 everywhere and should only be overridden in tests or if the rate changes.
 */

/** A line item expressed as quantity × unitPrice, or as a pre-calculated amount. */
export type FinancialLineItem =
  | { quantity: number; unitPrice: number }
  | { amount: number };

function lineTotal(item: FinancialLineItem): number {
  if ('amount' in item) return item.amount;
  return item.quantity * item.unitPrice;
}

export interface DocumentTotals {
  subtotal: number;
  gstAmount: number;
  total: number;
}

/**
 * Forward GST calculation: subtotal → gstAmount → total.
 * Use this for all quotes, invoices, and purchase orders.
 */
export function calculateDocumentTotals(
  lineItems: FinancialLineItem[],
  gstRate = 0.1,
): DocumentTotals {
  const rawSubtotal = lineItems.reduce((sum, item) => sum + lineTotal(item), 0);
  const subtotal = Math.round(rawSubtotal * 100) / 100;
  const gstAmount = Math.round(subtotal * gstRate * 100) / 100;
  const total = Math.round((subtotal + gstAmount) * 100) / 100;
  return { subtotal, gstAmount, total };
}

/**
 * Reverse (tax-inclusive) GST calculation: given a GST-inclusive total, extract
 * the GST component and the ex-GST subtotal.
 * Used when a payment amount is collected and the receipt needs the GST split.
 */
export function reverseTaxCalculation(
  totalIncGst: number,
  gstRate = 0.1,
): DocumentTotals {
  const gstAmount = Math.round((totalIncGst - totalIncGst / (1 + gstRate)) * 100) / 100;
  const subtotal = Math.round((totalIncGst - gstAmount) * 100) / 100;
  const total = Math.round(totalIncGst * 100) / 100;
  return { subtotal, gstAmount, total };
}
