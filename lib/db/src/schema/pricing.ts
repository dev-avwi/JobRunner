// NOTE: keep this file free of drizzle-orm/zod imports; the web frontend imports it
// directly (via @shared/pricing) to avoid bundling the full schema.

// Pricing in cents (AUD) - flat per-tier (matches Apple IAP)
export const PRICING = {
  pro: {
    monthly: 4999, // $49.99/month
    name: 'JobRunner Pro',
    description: 'Unlimited jobs, quotes, and invoices for solo tradies',
  },
  team: {
    monthly: 9999, // $99.99/month flat (up to 5 workers)
    name: 'JobRunner Team',
    description: 'Everything in Pro plus team management for up to 5 workers',
  },
  business: {
    monthly: 19999, // $199.99/month flat (up to 15 workers)
    name: 'JobRunner Business',
    description: 'Everything in Team plus advanced reporting for up to 15 workers',
  },
  addons: {
    aiReceptionist: {
      monthly: 6000, // $60/month
      name: 'AI Receptionist',
      description: 'AI-powered phone answering with dedicated Australian number',
    },
    dedicatedNumber: {
      monthly: 1000, // $10/month
      name: 'Dedicated Phone Number',
      description: 'Dedicated Australian SMS & voice number for your business',
    },
    customWebsite: {
      name: 'Custom Website',
      description: 'Professional website built for your trade business',
      type: 'manual_service' as const,
    },
  },
} as const;
