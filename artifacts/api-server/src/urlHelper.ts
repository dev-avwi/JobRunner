/**
 * Centralized URL helper for generating consistent URLs across the application.
 * Production URLs always use jobrunner.com.au for branding and trust.
 */

const PRODUCTION_DOMAIN = 'jobrunner.com.au';

/**
 * Find the best custom domain from REPLIT_DOMAINS (prefer non-.replit.app domains)
 */
function getCustomDomainFromReplitDomains(): string | null {
  const domains = process.env.REPLIT_DOMAINS?.split(',') || [];
  const customDomain = domains.find(d => !d.endsWith('.replit.app') && !d.endsWith('.replit.dev') && !d.endsWith('.repl.co'));
  return customDomain || null;
}

/**
 * Get the base URL for public links (quotes, invoices, receipts, tracking).
 * In development, uses the dev domain so links work with the dev database.
 * In production, uses jobrunner.com.au.
 */
export function getProductionBaseUrl(req?: { protocol: string; get: (header: string) => string | undefined }): string {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isDevelopment) {
    if (process.env.REPLIT_DEV_DOMAIN) {
      return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }

    const allowedDomains = process.env.REPLIT_DOMAINS
      ? process.env.REPLIT_DOMAINS.split(',').map((d) => d.trim()).filter(Boolean)
      : [];

    // Only trust the request Host header when it matches a known, env-configured
    // Replit domain (allowlist barrier). This keeps email/link generation safe
    // from host-header poisoning while still resolving multi-domain dev requests
    // to the host the request actually arrived on.
    if (req) {
      const host = req.get('host');
      if (host && allowedDomains.includes(host)) {
        return `${req.protocol}://${host}`;
      }
    }

    if (allowedDomains.length > 0) {
      const customDomain = getCustomDomainFromReplitDomains();
      return `https://${customDomain || allowedDomains[0]}`;
    }

    return 'http://localhost:5000';
  }
  
  // Production mode: STRICT priority — APP_DOMAIN → VITE_APP_URL →
  // hardcoded apex. We must never fall back to REPLIT_DOMAINS in production
  // because that can resolve to a Replit-managed subdomain (e.g.
  // `xxx.jobrunner.com.au` or `xxx.replit.app`) whose TLS cert Chrome
  // flags as untrusted, breaking verification/invoice/quote links.
  const normalize = (raw: string) => {
    const trimmed = raw.trim().replace(/\/+$/, '');
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };
  if (process.env.APP_DOMAIN) {
    return normalize(process.env.APP_DOMAIN);
  }
  if (process.env.VITE_APP_URL) {
    return normalize(process.env.VITE_APP_URL);
  }
  console.warn(
    '[urlHelper] APP_DOMAIN/VITE_APP_URL unset in production — using ' +
    `hardcoded https://${PRODUCTION_DOMAIN}. Set APP_DOMAIN to silence this.`
  );
  return `https://${PRODUCTION_DOMAIN}`;
}

/**
 * Generate a short public quote URL (for customers)
 */
export function getQuotePublicUrl(token: string, req?: { protocol: string; get: (header: string) => string | undefined }): string {
  const baseUrl = getProductionBaseUrl(req);
  return `${baseUrl}/q/${token}`;
}

/**
 * Generate a short public invoice URL (for customers)
 */
export function getInvoicePublicUrl(token: string, req?: { protocol: string; get: (header: string) => string | undefined }): string {
  const baseUrl = getProductionBaseUrl(req);
  return `${baseUrl}/i/${token}`;
}

/**
 * Generate a receipt URL (for customers)
 */
export function getReceiptPublicUrl(token: string, req?: { protocol: string; get: (header: string) => string | undefined }): string {
  const baseUrl = getProductionBaseUrl(req);
  return `${baseUrl}/receipt/${token}`;
}

/**
 * Generate a Stripe payment link URL
 */
export function getStripePaymentUrl(linkId: string): string {
  return `https://pay.stripe.com/c/${linkId}`;
}

/**
 * Generate a public variation approval URL (no-login approval link for clients).
 * The token is HMAC-signed and self-contained.
 */
export function getVariationApprovalUrl(approvalToken: string, req?: { protocol: string; get: (header: string) => string | undefined }): string {
  const baseUrl = getProductionBaseUrl(req);
  return `${baseUrl}/api/public/variation/${approvalToken}/approve`;
}

/**
 * Generate a public variation decline URL (no-login decline link for clients).
 */
export function getVariationDeclineUrl(approvalToken: string, req?: { protocol: string; get: (header: string) => string | undefined }): string {
  const baseUrl = getProductionBaseUrl(req);
  return `${baseUrl}/api/public/variation/${approvalToken}/decline`;
}

/**
 * Generate a variation portal view URL (shows document summary before action).
 */
export function getVariationPortalUrl(approvalToken: string, req?: { protocol: string; get: (header: string) => string | undefined }): string {
  const baseUrl = getProductionBaseUrl(req);
  return `${baseUrl}/api/public/variation/${approvalToken}`;
}
