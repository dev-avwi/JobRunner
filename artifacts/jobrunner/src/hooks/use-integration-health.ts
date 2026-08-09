import { useQuery } from "@tanstack/react-query";

export interface IntegrationService {
  name: string;
  status: 'ready' | 'test' | 'demo' | 'not_connected' | 'error';
  provider: string;
  managed: boolean;
  verified: boolean;
  testMode?: boolean;
  hasLiveKeys?: boolean;
  error: string | null;
  description: string;
}

export interface StripeConnectStatus {
  connected: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  businessName: string | null;
  email: string | null;
}

export interface AccountingIntegrationStatus {
  connected: boolean;
  name: string | null;
  lastSync: string | null;
  needsReconnect: boolean;
}

export interface CalendarIntegrationStatus {
  connected: boolean;
  email: string | null;
  needsReconnect: boolean;
}

export interface IntegrationHealth {
  allReady: boolean;
  servicesReady: boolean;
  message: string;
  services: {
    payments: IntegrationService;
    email: IntegrationService;
    sendgrid: IntegrationService;
    twilio: IntegrationService;
  };
  stripeConnect: StripeConnectStatus;
  accounting?: {
    xero: AccountingIntegrationStatus | null;
    quickbooks: AccountingIntegrationStatus | null;
    myob: AccountingIntegrationStatus | null;
  };
  calendar?: {
    googleCalendar: CalendarIntegrationStatus | null;
    outlook: CalendarIntegrationStatus | null;
  };
  needsReconnect?: boolean;
  checkedAt: string;
}

export function useIntegrationHealth() {
  return useQuery<IntegrationHealth>({
    queryKey: ['/api/integrations/health'],
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    refetchOnWindowFocus: false,
  });
}

// Helper functions to check specific integrations
// SMS uses platform-managed Twilio (no per-business setup needed)
// Returns true when the platform connector is configured, or when health hasn't loaded yet (optimistic)
export function isTwilioReady(health: IntegrationHealth | undefined): boolean {
  if (!health) return true;
  const twilio = health.services?.twilio;
  if (!twilio) return true;
  return twilio.status === 'ready' || twilio.verified === true || twilio.managed === true;
}

export function isStripeReady(health: IntegrationHealth | undefined): boolean {
  return health?.services?.payments?.verified === true;
}

export function isSendGridReady(health: IntegrationHealth | undefined): boolean {
  return health?.services?.sendgrid?.verified === true;
}

export function isEmailReady(health: IntegrationHealth | undefined): boolean {
  return health?.services?.email?.verified === true;
}
