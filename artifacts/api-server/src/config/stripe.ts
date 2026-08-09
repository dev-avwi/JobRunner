/**
 * Stripe configuration constants.
 *
 * Centralizes magic numbers/strings previously hardcoded in stripeConnect.ts
 * so they can be tuned via environment variables without code changes.
 *
 * All values default to Australian-tradie defaults (AUD, AU country, MCC 1711
 * for plumbing/HVAC contractors, $5.00 minimum, 2.5% platform fee).
 */

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envString(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw && raw.trim() ? raw.trim() : fallback;
}

export const STRIPE_CONFIG = {
  /** Platform fee % charged on connected-account payments. */
  platformFeePercent: envNumber('STRIPE_PLATFORM_FEE_PERCENT', 2.5),
  /** Floor for platform fee in cents (covers Stripe's per-transaction fee). */
  platformFeeMinCents: envNumber('STRIPE_PLATFORM_FEE_MIN_CENTS', 50),
  /** Minimum chargeable invoice amount in cents. */
  minimumAmountCents: envNumber('STRIPE_MINIMUM_AMOUNT_CENTS', 500),
  /** ISO country for Connect Express accounts. */
  country: envString('STRIPE_CONNECT_COUNTRY', 'AU'),
  /** Default currency (lowercase, Stripe convention). */
  currency: envString('STRIPE_CURRENCY', 'aud').toLowerCase(),
  /** Merchant Category Code (1711 = Heating, Plumbing, A/C). */
  mcc: envString('STRIPE_CONNECT_MCC', '1711'),
} as const;

export type StripeConfig = typeof STRIPE_CONFIG;
