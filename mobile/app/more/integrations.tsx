import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Linking,
  ActivityIndicator
} from 'react-native';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../../src/lib/store';
import { useTheme } from '../../src/lib/theme';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import api from '../../src/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { showToast } from '../../src/lib/toast';

interface StripeConnectStatus {
  connected: boolean;
  stripeAvailable: boolean;
  connectEnabled?: boolean;
  accountId?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  message?: string;
}

interface XeroStatus {
  configured: boolean;
  connected: boolean;
  tenantName?: string;
  tenantId?: string;
  lastSyncAt?: string;
  status?: string;
  message?: string;
}

interface MyobStatus {
  configured: boolean;
  connected: boolean;
  companyName?: string;
  companyUri?: string;
  lastSyncAt?: string;
  status?: string;
  message?: string;
}

interface QuickBooksStatus {
  configured: boolean;
  connected: boolean;
  companyName?: string;
  companyId?: string;
  lastSyncAt?: string;
  status?: string;
  message?: string;
}

interface TwilioStatus {
  configured: boolean;
  platformConfigured: boolean;
  userConfigured: boolean;
  phoneNumber?: string;
  senderId?: string;
  demoMode: boolean;
}

interface IntegrationHealth {
  stripeConnectStatus?: {
    connected: boolean;
    accountId?: string;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
    detailsSubmitted?: boolean;
    businessName?: string;
    email?: string;
  };
  emailVerified?: boolean;
  emailError?: string;
  gmailConnected?: boolean;
  gmailEmail?: string;
  services?: {
    twilio?: {
      status: 'ready' | 'demo' | 'not_connected';
      verified?: boolean;
      description?: string;
    };
    email?: {
      verified?: boolean;
      provider?: string;
    };
    sendgrid?: {
      verified?: boolean;
    };
    payments?: {
      verified?: boolean;
    };
  };
}

interface GoogleCalendarStatus {
  connected: boolean;
  calendarEmail?: string;
  calendarName?: string;
  lastSyncAt?: string;
}

const createStyles = (colors: any, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: bottomNavHeight,
  },
  header: {
    marginBottom: 20,
    paddingTop: 8,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 4,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.mutedForeground,
    marginBottom: 12,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  statusCardSuccess: {
    backgroundColor: colors.successLight,
    borderColor: colors.success,
  },
  statusCardWarning: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warning,
  },
  statusCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeSuccess: {
    backgroundColor: colors.successLight,
  },
  statusBadgeWarning: {
    backgroundColor: colors.warningLight,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusCardContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  statusCardText: {
    flex: 1,
    fontSize: 14,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  integrationCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  integrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  integrationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  integrationIconText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  integrationInfo: {
    flex: 1,
  },
  integrationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  integrationSubtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  integrationBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  integrationBadgeSuccess: {
    backgroundColor: colors.successLight,
  },
  integrationBadgeWarning: {
    backgroundColor: colors.warningLight,
  },
  integrationBadgeDisabled: {
    backgroundColor: colors.muted,
  },
  integrationBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  integrationBadgeBuiltIn: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  integrationBadgeBuiltInText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  integrationDetails: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  detailText: {
    fontSize: 14,
    color: colors.foreground,
    fontWeight: '500',
  },
  detailSubtext: {
    fontSize: 13,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  actionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  actionButtonSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonTextPrimary: {
    color: colors.primaryForeground,
  },
  actionButtonTextSecondary: {
    color: colors.foreground,
  },
  builtInInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  builtInText: {
    fontSize: 13,
    color: colors.success,
  },
  comingSoonCard: {
    backgroundColor: colors.muted,
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    alignItems: 'center',
    opacity: 0.8,
  },
  comingSoonTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 4,
  },
  comingSoonText: {
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  featureList: {
    marginTop: 8,
    gap: 6,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    padding: 12,
    borderRadius: 10,
    gap: 10,
    marginBottom: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: colors.warning,
  },
});

export default function IntegrationsScreen() {
  const { colors } = useTheme();
  const confirm = useConfirmDialog();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  
  const { businessSettings, fetchBusinessSettings } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncingContacts, setIsSyncingContacts] = useState(false);
  const [isPushingInvoices, setIsPushingInvoices] = useState(false);
  const [isSendingTestSms, setIsSendingTestSms] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<StripeConnectStatus | null>(null);
  const [integrationHealth, setIntegrationHealth] = useState<IntegrationHealth | null>(null);
  const [xeroStatus, setXeroStatus] = useState<XeroStatus | null>(null);
  const [myobStatus, setMyobStatus] = useState<MyobStatus | null>(null);
  const [quickBooksStatus, setQuickBooksStatus] = useState<QuickBooksStatus | null>(null);
  const [isConnectingMyob, setIsConnectingMyob] = useState(false);
  const [isConnectingQuickBooks, setIsConnectingQuickBooks] = useState(false);
  const [isSyncingMyob, setIsSyncingMyob] = useState(false);
  const [isSyncingQuickBooks, setIsSyncingQuickBooks] = useState(false);
  const [googleCalendarStatus, setGoogleCalendarStatus] = useState<GoogleCalendarStatus | null>(null);
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);
  const [showSmsPreview, setShowSmsPreview] = useState(false);
  const [isSyncingAllJobs, setIsSyncingAllJobs] = useState(false);

  const fetchIntegrationStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const [stripeResponse, healthResponse, xeroResponse, calendarResponse, myobResponse, quickBooksResponse] = await Promise.all([
        api.get<StripeConnectStatus>('/api/stripe-connect/status'),
        api.get<IntegrationHealth>('/api/integrations/health'),
        api.get<XeroStatus>('/api/integrations/xero/status'),
        api.get<GoogleCalendarStatus>('/api/integrations/google-calendar/status'),
        api.get<MyobStatus>('/api/integrations/myob/status'),
        api.get<QuickBooksStatus>('/api/integrations/quickbooks/status')
      ]);
      
      if (!stripeResponse.error && stripeResponse.data && typeof stripeResponse.data.connected === 'boolean') {
        setStripeStatus(stripeResponse.data);
      }
      if (healthResponse.data) {
        setIntegrationHealth(healthResponse.data);
      }
      if (xeroResponse.data) {
        setXeroStatus(xeroResponse.data);
      }
      if (calendarResponse.data) {
        setGoogleCalendarStatus(calendarResponse.data);
      }
      if (myobResponse.data) {
        setMyobStatus(myobResponse.data);
      }
      if (quickBooksResponse.data) {
        setQuickBooksStatus(quickBooksResponse.data);
      }
      
      await fetchBusinessSettings();
    } catch (error) {
      console.error('Error fetching integration status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchBusinessSettings]);

  useEffect(() => {
    fetchIntegrationStatus();
  }, [fetchIntegrationStatus]);

  // Refresh data when screen gains focus (syncs with web app)
  useFocusEffect(
    useCallback(() => {
      fetchIntegrationStatus();
    }, [fetchIntegrationStatus])
  );

  const handleConnectStripe = async () => {
    setIsConnecting(true);
    try {
      if (!stripeStatus?.connected) {
        // create-account only creates/returns the account — the actual
        // onboarding URL comes from the account-link endpoint afterwards.
        const createRes = await api.post<{ accountId?: string; error?: string; connectNotEnabled?: boolean }>('/api/stripe-connect/create-account');
        if (createRes.error || createRes.data?.connectNotEnabled) {
          showToast({ type: 'info', message: 'Connection Error', description: createRes.data?.error || createRes.error || 'Could not start Stripe setup' });
          return;
        }
        const linkRes = await api.post<{ url: string }>('/api/stripe-connect/account-link', { type: 'account_onboarding' });
        if (linkRes.data?.url) {
          await Linking.openURL(linkRes.data.url);
        } else {
          showToast({ type: 'info', message: 'Setup Error', description: linkRes.error || 'Could not open Stripe onboarding' });
        }
      } else if (!stripeStatus.chargesEnabled) {
        const response = await api.post<{ url: string }>('/api/stripe-connect/account-link', { type: 'account_onboarding' });
        if (response.data?.url) {
          await Linking.openURL(response.data.url);
        } else if (response.error) {
          showToast({ type: 'info', message: 'Setup Error', description: response.error });
        }
      }
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Failed to connect Stripe' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleOpenStripeDashboard = async () => {
    try {
      const response = await api.get<{ url: string }>('/api/stripe-connect/dashboard-link');
      if (response.data?.url) {
        await Linking.openURL(response.data.url);
      } else {
        await Linking.openURL('https://dashboard.stripe.com');
      }
    } catch (error) {
      await Linking.openURL('https://dashboard.stripe.com');
    }
  };

  const handleConnectXero = async () => {
    try {
      setIsConnecting(true);
      
      // Get auth URL from backend (this creates a mobile-specific state)
      const response = await api.post<{ authUrl: string; state: string }>('/api/integrations/xero/mobile-connect');
      if (!response.data?.authUrl) {
        showToast({ type: 'error', message: response.error || 'Could not initiate Xero connection' });
        return;
      }
      
      // Open Xero OAuth in in-app browser
      const result = await WebBrowser.openAuthSessionAsync(
        response.data.authUrl,
        'jobrunner://xero-callback'
      );
      
      if (result.type === 'success') {
        // Parse the callback URL to check success
        const url = new URL(result.url);
        const success = url.searchParams.get('success') === 'true';
        const error = url.searchParams.get('error');
        
        if (success) {
          showToast({ type: 'success', message: 'Xero account connected successfully!' });
          fetchIntegrationStatus();
        } else {
          showToast({ type: 'info', message: 'Connection Failed', description: error || 'Failed to connect Xero account' });
        }
      } else if (result.type === 'cancel') {
        // User cancelled - no alert needed
      }
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Failed to connect Xero' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectXero = async () => {
    const ok = await confirm({ title: 'Disconnect Xero', message: 'Are you sure you want to disconnect your Xero account? Invoice sync will stop working.', confirmText: 'Disconnect', cancelText: 'Cancel', destructive: true });
    if (ok) {
      try {
        await api.post('/api/integrations/xero/disconnect');
        showToast({ type: 'success', message: 'Success', description: 'Xero has been disconnected' });
        fetchIntegrationStatus();
      } catch (error: any) {
        showToast({ type: 'error', message: 'Error', description: error.message || 'Failed to disconnect Xero' });
      }
    }
  };

  const handleSyncXeroContacts = async () => {
    setIsSyncingContacts(true);
    try {
      const response = await api.post<{ 
        success: boolean;
        imported?: number;
        updated?: number;
        skipped?: number;
        message?: string;
      }>('/api/integrations/xero/sync-contacts');
      
      if (response.data?.success) {
        const { imported = 0, updated = 0, skipped = 0 } = response.data;
        showToast({ type: 'info', message: 'Contacts Synced', description: `Successfully synced contacts from Xero.\n\n${imported} imported\n${updated} updated\n${skipped} skipped (duplicates)` });
      } else {
        showToast({ type: 'info', message: 'Sync Complete', description: response.data?.message || 'Contacts synced from Xero' });
      }
      fetchIntegrationStatus();
    } catch (error: any) {
      showToast({ type: 'info', message: 'Sync Failed', description: error.response?.data?.error || error.message || 'Failed to sync contacts from Xero' });
    } finally {
      setIsSyncingContacts(false);
    }
  };

  const handlePushXeroInvoices = async () => {
    setIsPushingInvoices(true);
    try {
      const response = await api.post<{
        success: boolean;
        pushed?: number;
        skipped?: number;
        failed?: number;
        message?: string;
      }>('/api/integrations/xero/push-invoices');
      
      if (response.data?.success) {
        const { pushed = 0, skipped = 0, failed = 0 } = response.data;
        showToast({ type: 'info', message: 'Invoices Pushed', description: `Successfully pushed invoices to Xero.\n\n${pushed} pushed\n${skipped} skipped (already synced)\n${failed} failed` });
      } else {
        showToast({ type: 'info', message: 'Push Complete', description: response.data?.message || 'Invoices pushed to Xero' });
      }
      fetchIntegrationStatus();
    } catch (error: any) {
      showToast({ type: 'info', message: 'Push Failed', description: error.response?.data?.error || error.message || 'Failed to push invoices to Xero' });
    } finally {
      setIsPushingInvoices(false);
    }
  };

  const handleConnectMyob = async () => {
    try {
      setIsConnectingMyob(true);
      const response = await api.post<{ authUrl: string; state: string }>('/api/integrations/myob/mobile-connect');
      if (!response.data?.authUrl) {
        showToast({ type: 'error', message: response.error || 'Could not initiate MYOB connection' });
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(
        response.data.authUrl,
        'jobrunner://myob-callback'
      );
      if (result.type === 'success') {
        const url = new URL(result.url);
        const success = url.searchParams.get('success') === 'true';
        const error = url.searchParams.get('error');
        if (success) {
          showToast({ type: 'success', message: 'MYOB account connected successfully!' });
          fetchIntegrationStatus();
        } else {
          showToast({ type: 'info', message: 'Connection Failed', description: error || 'Failed to connect MYOB account' });
        }
      }
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Failed to connect MYOB' });
    } finally {
      setIsConnectingMyob(false);
    }
  };

  const handleDisconnectMyob = async () => {
    const ok = await confirm({ title: 'Disconnect MYOB', message: 'Are you sure you want to disconnect your MYOB account? Invoice sync will stop working.', confirmText: 'Disconnect', cancelText: 'Cancel', destructive: true });
    if (ok) {
      try {
        await api.post('/api/integrations/myob/disconnect');
        showToast({ type: 'success', message: 'Success', description: 'MYOB has been disconnected' });
        fetchIntegrationStatus();
      } catch (error: any) {
        showToast({ type: 'error', message: 'Error', description: error.message || 'Failed to disconnect MYOB' });
      }
    }
  };

  const handleSyncMyob = async () => {
    setIsSyncingMyob(true);
    try {
      const response = await api.post<{
        success: boolean;
        synced?: number;
        skipped?: number;
        failed?: number;
        message?: string;
      }>('/api/integrations/myob/sync');
      if (response.data?.success) {
        const { synced = 0, skipped = 0, failed = 0 } = response.data;
        showToast({ type: 'info', message: 'MYOB Sync Complete', description: `Successfully synced data with MYOB.\n\n${synced} synced\n${skipped} skipped\n${failed} failed` });
      } else {
        showToast({ type: 'info', message: 'Sync Complete', description: response.data?.message || 'Data synced with MYOB' });
      }
      fetchIntegrationStatus();
    } catch (error: any) {
      showToast({ type: 'info', message: 'Sync Failed', description: error.response?.data?.error || error.message || 'Failed to sync with MYOB' });
    } finally {
      setIsSyncingMyob(false);
    }
  };

  const handleConnectQuickBooks = async () => {
    try {
      setIsConnectingQuickBooks(true);
      const response = await api.post<{ authUrl: string; state: string }>('/api/integrations/quickbooks/mobile-connect');
      if (!response.data?.authUrl) {
        showToast({ type: 'error', message: response.error || 'Could not initiate QuickBooks connection' });
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(
        response.data.authUrl,
        'jobrunner://quickbooks-callback'
      );
      if (result.type === 'success') {
        const url = new URL(result.url);
        const success = url.searchParams.get('success') === 'true';
        const error = url.searchParams.get('error');
        if (success) {
          showToast({ type: 'success', message: 'QuickBooks account connected successfully!' });
          fetchIntegrationStatus();
        } else {
          showToast({ type: 'info', message: 'Connection Failed', description: error || 'Failed to connect QuickBooks account' });
        }
      }
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Failed to connect QuickBooks' });
    } finally {
      setIsConnectingQuickBooks(false);
    }
  };

  const handleDisconnectQuickBooks = async () => {
    const ok = await confirm({ title: 'Disconnect QuickBooks', message: 'Are you sure you want to disconnect your QuickBooks account? Invoice sync will stop working.', confirmText: 'Disconnect', cancelText: 'Cancel', destructive: true });
    if (ok) {
      try {
        await api.post('/api/integrations/quickbooks/disconnect');
        showToast({ type: 'success', message: 'Success', description: 'QuickBooks has been disconnected' });
        fetchIntegrationStatus();
      } catch (error: any) {
        showToast({ type: 'error', message: 'Error', description: error.message || 'Failed to disconnect QuickBooks' });
      }
    }
  };

  const handleSyncQuickBooks = async () => {
    setIsSyncingQuickBooks(true);
    try {
      const response = await api.post<{
        success: boolean;
        synced?: number;
        skipped?: number;
        failed?: number;
        message?: string;
      }>('/api/integrations/quickbooks/sync');
      if (response.data?.success) {
        const { synced = 0, skipped = 0, failed = 0 } = response.data;
        showToast({ type: 'info', message: 'QuickBooks Sync Complete', description: `Successfully synced data with QuickBooks.\n\n${synced} synced\n${skipped} skipped\n${failed} failed` });
      } else {
        showToast({ type: 'info', message: 'Sync Complete', description: response.data?.message || 'Data synced with QuickBooks' });
      }
      fetchIntegrationStatus();
    } catch (error: any) {
      showToast({ type: 'info', message: 'Sync Failed', description: error.response?.data?.error || error.message || 'Failed to sync with QuickBooks' });
    } finally {
      setIsSyncingQuickBooks(false);
    }
  };

  const handleTestSms = async () => {
    setIsSendingTestSms(true);
    try {
      const response = await api.post<{ success: boolean; message: string; preview?: any }>('/api/integrations/test-sms-preview');
      if (response.data?.success) {
        setShowSmsPreview(true);
        showToast({
          type: 'info',
          message: 'SMS Preview',
          description: `Hi [Client Name], reminder: Your appointment with ${businessSettings?.businessName || 'Your Business'} is scheduled for tomorrow at 9:00 AM. Reply YES to confirm. Note: Connect Twilio to send real SMS.`,
        });
        setShowSmsPreview(false);
      } else {
        showToast({ type: 'info', message: 'SMS Preview', description: response.data?.message || 'SMS preview shown' });
      }
    } catch (error: any) {
      showToast({ type: 'info', message: 'SMS Preview', description: `This is how your SMS notifications will appear:\n\n"Hi [Client Name], reminder: Your appointment with ${businessSettings?.businessName || 'Your Business'} is scheduled for tomorrow at 9:00 AM. Reply YES to confirm."\n\nNote: Connect your Twilio credentials to send real messages.` });
    } finally {
      setIsSendingTestSms(false);
    }
  };

  const handleConnectGoogleCalendar = async () => {
    setIsConnectingCalendar(true);
    try {
      // Pass source: 'mobile' so server prefixes state with 'mobile_' for deep link redirect
      const response = await api.post<{ authUrl: string }>('/api/integrations/google-calendar/connect', { source: 'mobile' });
      if (response.data?.authUrl) {
        const result = await WebBrowser.openAuthSessionAsync(
          response.data.authUrl,
          'jobrunner://google-calendar-callback'
        );
        
        if (result.type === 'success') {
          // Parse the callback URL to check success
          const url = new URL(result.url);
          const success = url.searchParams.get('success') === 'true';
          const error = url.searchParams.get('error');
          
          if (success) {
            // Refresh status to get the connected email
            const statusCheck = await api.get<GoogleCalendarStatus>('/api/integrations/google-calendar/status');
            if (statusCheck.data?.connected) {
              setGoogleCalendarStatus(statusCheck.data);
            }
            showToast({ type: 'success', message: 'Google Calendar connected successfully!' });
            fetchIntegrationStatus();
          } else {
            showToast({ type: 'info', message: 'Connection Failed', description: error || 'Failed to connect Google Calendar' });
          }
        } else if (result.type === 'dismiss' || result.type === 'cancel') {
          // User cancelled OAuth flow - no action needed
        }
      } else {
        showToast({ type: 'error', message: 'Could not initiate Google Calendar connection' });
      }
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Failed to connect Google Calendar' });
    } finally {
      setIsConnectingCalendar(false);
    }
  };

  const handleDisconnectGoogleCalendar = async () => {
    const ok = await confirm({ title: 'Disconnect Google Calendar', message: 'Are you sure you want to disconnect your Google Calendar? Job sync will stop working.', confirmText: 'Disconnect', cancelText: 'Cancel', destructive: true });
    if (ok) {
      try {
        await api.post('/api/integrations/google-calendar/disconnect');
        showToast({ type: 'success', message: 'Success', description: 'Google Calendar has been disconnected' });
        fetchIntegrationStatus();
      } catch (error: any) {
        showToast({ type: 'error', message: 'Error', description: error.message || 'Failed to disconnect Google Calendar' });
      }
    }
  };

  const handleSyncAllJobs = async () => {
    setIsSyncingAllJobs(true);
    try {
      const response = await api.post<{
        success: boolean;
        synced?: number;
        skipped?: number;
        failed?: number;
        message?: string;
      }>('/api/integrations/google-calendar/sync-all-jobs');
      
      if (response.data?.success) {
        const { synced = 0, skipped = 0, failed = 0 } = response.data;
        showToast({ type: 'info', message: 'Jobs Synced to Calendar', description: `Successfully synced your jobs to Google Calendar.\n\n${synced} synced\n${skipped} skipped (already synced or no date)\n${failed} failed` });
      } else {
        showToast({ type: 'info', message: 'Sync Complete', description: response.data?.message || 'Jobs synced to Google Calendar' });
      }
      fetchIntegrationStatus();
    } catch (error: any) {
      showToast({ type: 'info', message: 'Sync Failed', description: error.response?.data?.error || error.message || 'Failed to sync jobs to Google Calendar' });
    } finally {
      setIsSyncingAllJobs(false);
    }
  };

  const isStripeFullyConnected = stripeStatus?.connected && stripeStatus?.chargesEnabled;
  const isStripePartiallyConnected = stripeStatus?.connected && !stripeStatus?.chargesEnabled;
  const hasEmailService = integrationHealth?.services?.email?.verified || integrationHealth?.services?.sendgrid?.verified || integrationHealth?.emailVerified || integrationHealth?.gmailConnected;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={fetchIntegrationStatus}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.header}>
            <Text style={styles.pageTitle} data-testid="text-page-title">Integrations</Text>
            <Text style={styles.pageSubtitle}>
              Connect your business tools to streamline your workflow
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.detailSubtext, { marginTop: 12 }]}>Checking integration status...</Text>
            </View>
          ) : (
            <>
              <View style={[
                styles.statusCard,
                isStripeFullyConnected ? styles.statusCardSuccess : styles.statusCardWarning
              ]}>
                <View style={styles.statusCardHeader}>
                  <Text style={styles.statusCardTitle}>
                    {isStripeFullyConnected ? 'Ready to Accept Payments' : 'Set Up Payments'}
                  </Text>
                  <View style={[
                    styles.statusBadge,
                    isStripeFullyConnected ? styles.statusBadgeSuccess : styles.statusBadgeWarning
                  ]}>
                    {isStripeFullyConnected ? (
                      <Feather name="check-circle" size={12} color={colors.success} />
                    ) : (
                      <Feather name="alert-circle" size={12} color={colors.warning} />
                    )}
                    <Text style={[
                      styles.statusBadgeText,
                      { color: isStripeFullyConnected ? colors.success : colors.warning }
                    ]}>
                      {isStripeFullyConnected ? 'Live' : 'Setup Required'}
                    </Text>
                  </View>
                </View>
                <View style={styles.statusCardContent}>
                  <Feather 
                    name={isStripeFullyConnected ? "check-circle" : "credit-card"} 
                    size={24} 
                    color={isStripeFullyConnected ? colors.success : colors.warning} 
                  />
                  <Text style={styles.statusCardText}>
                    {isStripeFullyConnected 
                      ? 'Your Stripe account is connected. You can send invoices and collect payments online!'
                      : stripeStatus?.message || 'Connect Stripe to accept online payments from your customers.'
                    }
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Payment Processing</Text>

              <View style={styles.integrationCard} data-testid="card-stripe-integration">
                <View style={styles.integrationHeader}>
                  <View style={[styles.integrationIconContainer, { backgroundColor: '#635bff20' }]}>
                    <Text style={[styles.integrationIconText, { color: '#635bff' }]}>S</Text>
                  </View>
                  <View style={styles.integrationInfo}>
                    <Text style={styles.integrationTitle}>Stripe Connect</Text>
                    <Text style={styles.integrationSubtitle}>Accept online payments</Text>
                  </View>
                  <View style={[
                    styles.integrationBadge,
                    isStripeFullyConnected 
                      ? styles.integrationBadgeSuccess 
                      : isStripePartiallyConnected 
                        ? styles.integrationBadgeWarning 
                        : styles.integrationBadgeDisabled
                  ]}>
                    <Text style={[
                      styles.integrationBadgeText,
                      { color: isStripeFullyConnected ? colors.success : isStripePartiallyConnected ? colors.warning : colors.mutedForeground }
                    ]}>
                      {isStripeFullyConnected ? 'Connected' : isStripePartiallyConnected ? 'Incomplete' : 'Not Connected'}
                    </Text>
                  </View>
                </View>

                <View style={styles.integrationDetails}>
                  {isStripePartiallyConnected && (
                    <View style={styles.warningBanner}>
                      <Feather name="alert-triangle" size={18} color={colors.warning} />
                      <Text style={styles.warningText}>
                        Complete your Stripe setup to start accepting payments
                      </Text>
                    </View>
                  )}

                  {isStripeFullyConnected && (
                    <>
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconContainer}>
                          <Feather name="credit-card" size={16} color={colors.primary} />
                        </View>
                        <Text style={styles.detailText}>
                          {integrationHealth?.stripeConnectStatus?.businessName || businessSettings?.businessName || 'Your Business'}
                        </Text>
                      </View>
                      {integrationHealth?.stripeConnectStatus?.email && (
                        <View style={styles.detailRow}>
                          <View style={styles.detailIconContainer}>
                            <Feather name="mail" size={16} color={colors.primary} />
                          </View>
                          <Text style={styles.detailText}>
                            {integrationHealth.stripeConnectStatus.email}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.detailSubtext}>
                        Payments are processed and deposited directly to your bank account. Stripe's standard fees apply.
                      </Text>
                    </>
                  )}

                  {!isStripeFullyConnected && !isStripePartiallyConnected && (
                    <>
                      <Text style={styles.detailSubtext}>
                        Accept credit cards, Apple Pay, and Google Pay. Funds are deposited directly to your bank.
                      </Text>
                      <View style={styles.featureList}>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Send payment links via invoice</Text>
                        </View>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Get paid faster with online payments</Text>
                        </View>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Automatic payment confirmations</Text>
                        </View>
                      </View>
                    </>
                  )}

                  {isStripeFullyConnected ? (
                    <PressableRow style={[styles.actionButton, styles.actionButtonSecondary]} onPress={handleOpenStripeDashboard} data-testid="button-stripe-dashboard" >
                      <Feather name="external-link" size={16} color={colors.foreground} />
                      <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                        View Stripe Dashboard
                      </Text>
                    </PressableRow>
                  ) : (
                    <PressableRow style={[styles.actionButton, styles.actionButtonPrimary]} onPress={handleConnectStripe} disabled={isConnecting || stripeStatus?.stripeAvailable === false} data-testid="button-connect-stripe" >
                      {isConnecting ? (
                        <ActivityIndicator size="small" color={colors.primaryForeground} />
                      ) : (
                        <Feather name="link" size={16} color={colors.primaryForeground} />
                      )}
                      <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                        {isConnecting ? 'Connecting...' : isStripePartiallyConnected ? 'Complete Setup' : 'Connect Stripe'}
                      </Text>
                    </PressableRow>
                  )}
                </View>
              </View>

              <Text style={styles.sectionTitle}>Email & Communication</Text>

              <View style={styles.integrationCard} data-testid="card-email-integration">
                <View style={styles.integrationHeader}>
                  <View style={[styles.integrationIconContainer, { backgroundColor: colors.destructiveLight }]}>
                    <Feather name="mail" size={22} color={colors.destructive} />
                  </View>
                  <View style={styles.integrationInfo}>
                    <Text style={styles.integrationTitle}>Email Service</Text>
                    <Text style={styles.integrationSubtitle}>
                      {integrationHealth?.gmailConnected ? 'Gmail' : integrationHealth?.services?.email?.provider || 'SendGrid'}
                    </Text>
                  </View>
                  <View style={styles.integrationBadgeBuiltIn}>
                    <Text style={styles.integrationBadgeBuiltInText}>
                      {hasEmailService ? 'Active' : 'Not Configured'}
                    </Text>
                  </View>
                </View>

                <View style={styles.integrationDetails}>
                  {hasEmailService ? (
                    <>
                      {integrationHealth?.gmailEmail && (
                        <View style={styles.detailRow}>
                          <View style={styles.detailIconContainer}>
                            <Feather name="user" size={16} color={colors.primary} />
                          </View>
                          <Text style={styles.detailText}>{integrationHealth.gmailEmail}</Text>
                        </View>
                      )}
                      <Text style={styles.detailSubtext}>
                        Quotes and invoices are sent via email to your customers. Professional templates are included.
                      </Text>
                      <View style={styles.builtInInfo}>
                        <Feather name="check-circle" size={16} color={colors.success} />
                        <Text style={styles.builtInText}>Email service is active and ready</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.detailSubtext}>
                        Email sending is not yet configured. Contact support to enable email sending.
                      </Text>
                      <View style={styles.builtInInfo}>
                        <Feather name="info" size={16} color={colors.mutedForeground} />
                        <Text style={[styles.builtInText, { color: colors.mutedForeground }]}>
                          Platform-managed integration
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </View>

              <Text style={styles.sectionTitle}>Accounting</Text>

              <View style={styles.integrationCard} data-testid="card-xero-integration">
                <View style={styles.integrationHeader}>
                  <View style={[styles.integrationIconContainer, { backgroundColor: '#13b5ea20' }]}>
                    <Feather name="book" size={22} color="#13b5ea" />
                  </View>
                  <View style={styles.integrationInfo}>
                    <Text style={styles.integrationTitle}>Xero</Text>
                    <Text style={styles.integrationSubtitle}>
                      {xeroStatus?.connected ? xeroStatus.tenantName : 'Accounting sync'}
                    </Text>
                  </View>
                  <View style={[
                    styles.integrationBadge,
                    xeroStatus?.connected ? styles.integrationBadgeSuccess : 
                    xeroStatus?.configured ? styles.integrationBadgeWarning : styles.integrationBadgeDisabled
                  ]}>
                    <Text style={[
                      styles.integrationBadgeText,
                      { color: xeroStatus?.connected ? colors.success : 
                        xeroStatus?.configured ? colors.warning : colors.mutedForeground }
                    ]}>
                      {xeroStatus?.connected ? 'Connected' : 
                       xeroStatus?.configured ? 'Not Connected' : 'Not Configured'}
                    </Text>
                  </View>
                </View>

                <View style={styles.integrationDetails}>
                  {xeroStatus?.connected ? (
                    <>
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconContainer}>
                          <Feather name="check-circle" size={16} color={colors.success} />
                        </View>
                        <Text style={styles.detailText}>
                          Connected to {xeroStatus.tenantName}
                        </Text>
                      </View>
                      {xeroStatus.lastSyncAt && (
                        <View style={styles.detailRow}>
                          <View style={styles.detailIconContainer}>
                            <Feather name="clock" size={16} color={colors.primary} />
                          </View>
                          <Text style={styles.detailText}>
                            Last synced: {new Date(xeroStatus.lastSyncAt).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.detailSubtext}>
                        Invoices are automatically synced to Xero when sent. Contacts can be imported from Xero.
                      </Text>
                      <View style={{ gap: 8, marginTop: 8 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <PressableRow style={[styles.actionButton, styles.actionButtonPrimary, { flex: 1 }]} onPress={handleSyncXeroContacts} disabled={isSyncingContacts || isPushingInvoices} data-testid="button-sync-xero-contacts" >
                            {isSyncingContacts ? (
                              <ActivityIndicator size="small" color={colors.primaryForeground} />
                            ) : (
                              <Feather name="download" size={16} color={colors.primaryForeground} />
                            )}
                            <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                              {isSyncingContacts ? 'Syncing...' : 'Sync Contacts'}
                            </Text>
                          </PressableRow>
                          <PressableRow style={[styles.actionButton, styles.actionButtonPrimary, { flex: 1 }]} onPress={handlePushXeroInvoices} disabled={isSyncingContacts || isPushingInvoices} data-testid="button-push-xero-invoices" >
                            {isPushingInvoices ? (
                              <ActivityIndicator size="small" color={colors.primaryForeground} />
                            ) : (
                              <Feather name="upload" size={16} color={colors.primaryForeground} />
                            )}
                            <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                              {isPushingInvoices ? 'Pushing...' : 'Push Invoices'}
                            </Text>
                          </PressableRow>
                        </View>
                        <PressableRow style={[styles.actionButton, styles.actionButtonSecondary]} onPress={handleDisconnectXero} data-testid="button-disconnect-xero" >
                          <Feather name="link-2" size={16} color={colors.destructive} />
                          <Text style={[styles.actionButtonText, { color: colors.destructive }]}>
                            Disconnect Xero
                          </Text>
                        </PressableRow>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.detailSubtext}>
                        {xeroStatus?.configured 
                          ? 'Connect your Xero account to automatically sync invoices and import contacts.'
                          : 'Xero integration is not configured. Contact support to enable this feature.'}
                      </Text>
                      <View style={styles.featureList}>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Auto-sync invoices when sent</Text>
                        </View>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Import contacts from Xero</Text>
                        </View>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Keep your books up to date</Text>
                        </View>
                      </View>
                      {xeroStatus?.configured && (
                        <PressableRow style={[styles.actionButton, styles.actionButtonPrimary]} onPress={handleConnectXero} data-testid="button-connect-xero" >
                          <Feather name="link" size={16} color={colors.primaryForeground} />
                          <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                            Connect Xero
                          </Text>
                        </PressableRow>
                      )}
                    </>
                  )}
                </View>
              </View>

              <View style={styles.integrationCard} data-testid="card-myob-integration">
                <View style={styles.integrationHeader}>
                  <View style={[styles.integrationIconContainer, { backgroundColor: '#6b21a820' }]}>
                    <Text style={[styles.integrationIconText, { color: '#6b21a8' }]}>M</Text>
                  </View>
                  <View style={styles.integrationInfo}>
                    <Text style={styles.integrationTitle}>MYOB AccountRight</Text>
                    <Text style={styles.integrationSubtitle}>
                      {myobStatus?.connected ? myobStatus.companyName : 'Accounting sync'}
                    </Text>
                  </View>
                  <View style={[
                    styles.integrationBadge,
                    myobStatus?.connected ? styles.integrationBadgeSuccess : 
                    myobStatus?.configured ? styles.integrationBadgeWarning : styles.integrationBadgeDisabled
                  ]}>
                    <Text style={[
                      styles.integrationBadgeText,
                      { color: myobStatus?.connected ? colors.success : 
                        myobStatus?.configured ? colors.warning : colors.mutedForeground }
                    ]}>
                      {myobStatus?.connected ? 'Connected' : 
                       myobStatus?.configured ? 'Not Connected' : 'Not Configured'}
                    </Text>
                  </View>
                </View>

                <View style={styles.integrationDetails}>
                  {myobStatus?.connected ? (
                    <>
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconContainer}>
                          <Feather name="check-circle" size={16} color={colors.success} />
                        </View>
                        <Text style={styles.detailText}>
                          Connected to {myobStatus.companyName}
                        </Text>
                      </View>
                      {myobStatus.lastSyncAt && (
                        <View style={styles.detailRow}>
                          <View style={styles.detailIconContainer}>
                            <Feather name="clock" size={16} color={colors.primary} />
                          </View>
                          <Text style={styles.detailText}>
                            Last synced: {new Date(myobStatus.lastSyncAt).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.detailSubtext}>
                        Invoices and contacts are synced with your MYOB AccountRight company file.
                      </Text>
                      <View style={{ gap: 8, marginTop: 8 }}>
                        <PressableRow style={[styles.actionButton, styles.actionButtonPrimary]} onPress={handleSyncMyob} disabled={isSyncingMyob} data-testid="button-sync-myob" >
                          {isSyncingMyob ? (
                            <ActivityIndicator size="small" color={colors.primaryForeground} />
                          ) : (
                            <Feather name="refresh-cw" size={16} color={colors.primaryForeground} />
                          )}
                          <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                            {isSyncingMyob ? 'Syncing...' : 'Sync Now'}
                          </Text>
                        </PressableRow>
                        <PressableRow style={[styles.actionButton, styles.actionButtonSecondary]} onPress={handleDisconnectMyob} data-testid="button-disconnect-myob" >
                          <Feather name="link-2" size={16} color={colors.destructive} />
                          <Text style={[styles.actionButtonText, { color: colors.destructive }]}>
                            Disconnect MYOB
                          </Text>
                        </PressableRow>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.detailSubtext}>
                        {myobStatus?.configured 
                          ? 'Connect your MYOB AccountRight account to sync invoices and contacts.'
                          : 'MYOB integration is not configured. Contact support to enable this feature.'}
                      </Text>
                      <View style={styles.featureList}>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Sync invoices to MYOB</Text>
                        </View>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Import contacts and accounts</Text>
                        </View>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Automatic reconciliation</Text>
                        </View>
                      </View>
                      {myobStatus?.configured && (
                        <PressableRow style={[styles.actionButton, styles.actionButtonPrimary]} onPress={handleConnectMyob} disabled={isConnectingMyob} data-testid="button-connect-myob" >
                          {isConnectingMyob ? (
                            <ActivityIndicator size="small" color={colors.primaryForeground} />
                          ) : (
                            <Feather name="link" size={16} color={colors.primaryForeground} />
                          )}
                          <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                            {isConnectingMyob ? 'Connecting...' : 'Connect MYOB'}
                          </Text>
                        </PressableRow>
                      )}
                    </>
                  )}
                </View>
              </View>

              <View style={styles.integrationCard} data-testid="card-quickbooks-integration">
                <View style={styles.integrationHeader}>
                  <View style={[styles.integrationIconContainer, { backgroundColor: '#2ca01c20' }]}>
                    <Text style={[styles.integrationIconText, { color: '#2ca01c' }]}>QB</Text>
                  </View>
                  <View style={styles.integrationInfo}>
                    <Text style={styles.integrationTitle}>QuickBooks Online</Text>
                    <Text style={styles.integrationSubtitle}>
                      {quickBooksStatus?.connected ? quickBooksStatus.companyName : 'Accounting sync'}
                    </Text>
                  </View>
                  <View style={[
                    styles.integrationBadge,
                    quickBooksStatus?.connected ? styles.integrationBadgeSuccess : 
                    quickBooksStatus?.configured ? styles.integrationBadgeWarning : styles.integrationBadgeDisabled
                  ]}>
                    <Text style={[
                      styles.integrationBadgeText,
                      { color: quickBooksStatus?.connected ? colors.success : 
                        quickBooksStatus?.configured ? colors.warning : colors.mutedForeground }
                    ]}>
                      {quickBooksStatus?.connected ? 'Connected' : 
                       quickBooksStatus?.configured ? 'Not Connected' : 'Not Configured'}
                    </Text>
                  </View>
                </View>

                <View style={styles.integrationDetails}>
                  {quickBooksStatus?.connected ? (
                    <>
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconContainer}>
                          <Feather name="check-circle" size={16} color={colors.success} />
                        </View>
                        <Text style={styles.detailText}>
                          Connected to {quickBooksStatus.companyName}
                        </Text>
                      </View>
                      {quickBooksStatus.lastSyncAt && (
                        <View style={styles.detailRow}>
                          <View style={styles.detailIconContainer}>
                            <Feather name="clock" size={16} color={colors.primary} />
                          </View>
                          <Text style={styles.detailText}>
                            Last synced: {new Date(quickBooksStatus.lastSyncAt).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.detailSubtext}>
                        Invoices and contacts are synced with your QuickBooks Online account.
                      </Text>
                      <View style={{ gap: 8, marginTop: 8 }}>
                        <PressableRow style={[styles.actionButton, styles.actionButtonPrimary]} onPress={handleSyncQuickBooks} disabled={isSyncingQuickBooks} data-testid="button-sync-quickbooks" >
                          {isSyncingQuickBooks ? (
                            <ActivityIndicator size="small" color={colors.primaryForeground} />
                          ) : (
                            <Feather name="refresh-cw" size={16} color={colors.primaryForeground} />
                          )}
                          <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                            {isSyncingQuickBooks ? 'Syncing...' : 'Sync Now'}
                          </Text>
                        </PressableRow>
                        <PressableRow style={[styles.actionButton, styles.actionButtonSecondary]} onPress={handleDisconnectQuickBooks} data-testid="button-disconnect-quickbooks" >
                          <Feather name="link-2" size={16} color={colors.destructive} />
                          <Text style={[styles.actionButtonText, { color: colors.destructive }]}>
                            Disconnect QuickBooks
                          </Text>
                        </PressableRow>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.detailSubtext}>
                        {quickBooksStatus?.configured 
                          ? 'Connect your QuickBooks Online account to sync invoices and contacts.'
                          : 'QuickBooks integration is not configured. Contact support to enable this feature.'}
                      </Text>
                      <View style={styles.featureList}>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Sync invoices to QuickBooks</Text>
                        </View>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Import customers and vendors</Text>
                        </View>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Track payments and expenses</Text>
                        </View>
                      </View>
                      {quickBooksStatus?.configured && (
                        <PressableRow style={[styles.actionButton, styles.actionButtonPrimary]} onPress={handleConnectQuickBooks} disabled={isConnectingQuickBooks} data-testid="button-connect-quickbooks" >
                          {isConnectingQuickBooks ? (
                            <ActivityIndicator size="small" color={colors.primaryForeground} />
                          ) : (
                            <Feather name="link" size={16} color={colors.primaryForeground} />
                          )}
                          <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                            {isConnectingQuickBooks ? 'Connecting...' : 'Connect QuickBooks'}
                          </Text>
                        </PressableRow>
                      )}
                    </>
                  )}
                </View>
              </View>

              <Text style={styles.sectionTitle}>SMS Notifications</Text>

              <View style={styles.integrationCard} data-testid="card-sms-integration">
                <View style={styles.integrationHeader}>
                  <View style={[styles.integrationIconContainer, { backgroundColor: '#25d36620' }]}>
                    <Feather name="message-circle" size={22} color="#25d366" />
                  </View>
                  <View style={styles.integrationInfo}>
                    <Text style={styles.integrationTitle}>SMS Notifications</Text>
                    <Text style={styles.integrationSubtitle}>Twilio-powered messaging</Text>
                  </View>
                  <View style={[
                    styles.integrationBadge,
                    integrationHealth?.services?.twilio?.status === 'ready' 
                      ? styles.integrationBadgeSuccess 
                      : styles.integrationBadgeWarning
                  ]}>
                    <Text style={[
                      styles.integrationBadgeText,
                      { color: integrationHealth?.services?.twilio?.status === 'ready' 
                          ? colors.success 
                          : colors.warning }
                    ]}>
                      {integrationHealth?.services?.twilio?.status === 'ready' ? 'Connected' : 'Not Configured'}
                    </Text>
                  </View>
                </View>

                <View style={styles.integrationDetails}>
                  {integrationHealth?.services?.twilio?.status !== 'ready' && (
                    <View style={styles.warningBanner}>
                      <Feather name="info" size={18} color={colors.warning} />
                      <Text style={styles.warningText}>
                        SMS is not configured. Connect your Twilio account to send messages.
                      </Text>
                    </View>
                  )}
                  <Text style={styles.detailSubtext}>
                    {integrationHealth?.services?.twilio?.status === 'ready'
                      ? 'SMS notifications are active. Send appointment reminders and job updates via SMS.'
                      : 'Send appointment reminders and job updates via SMS. Keep customers informed automatically.'}
                  </Text>
                  <View style={styles.featureList}>
                    <View style={styles.featureItem}>
                      <Feather name="check" size={14} color={colors.success} />
                      <Text style={styles.featureText}>Appointment reminders</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Feather name="check" size={14} color={colors.success} />
                      <Text style={styles.featureText}>Job status updates</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Feather name="check" size={14} color={colors.success} />
                      <Text style={styles.featureText}>Payment confirmations</Text>
                    </View>
                  </View>
                  <PressableRow style={[styles.actionButton, styles.actionButtonSecondary]} onPress={handleTestSms} disabled={isSendingTestSms} data-testid="button-test-sms" >
                    {isSendingTestSms ? (
                      <ActivityIndicator size="small" color={colors.foreground} />
                    ) : (
                      <Feather name="eye" size={16} color={colors.foreground} />
                    )}
                    <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                      {isSendingTestSms ? 'Loading...' : 'Preview SMS Template'}
                    </Text>
                  </PressableRow>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Calendar</Text>

              <View style={styles.integrationCard} data-testid="card-calendar-integration">
                <View style={styles.integrationHeader}>
                  <View style={[styles.integrationIconContainer, { backgroundColor: '#4285f420' }]}>
                    <Feather name="calendar" size={22} color="#4285f4" />
                  </View>
                  <View style={styles.integrationInfo}>
                    <Text style={styles.integrationTitle}>Google Calendar</Text>
                    <Text style={styles.integrationSubtitle}>
                      {googleCalendarStatus?.connected ? googleCalendarStatus.calendarEmail : 'Sync job schedules'}
                    </Text>
                  </View>
                  <View style={[
                    styles.integrationBadge,
                    googleCalendarStatus?.connected ? styles.integrationBadgeSuccess : styles.integrationBadgeDisabled
                  ]}>
                    <Text style={[
                      styles.integrationBadgeText,
                      { color: googleCalendarStatus?.connected ? colors.success : colors.mutedForeground }
                    ]}>
                      {googleCalendarStatus?.connected ? 'Connected' : 'Not Connected'}
                    </Text>
                  </View>
                </View>
                <View style={styles.integrationDetails}>
                  {googleCalendarStatus?.connected ? (
                    <>
                      <View style={styles.detailRow}>
                        <View style={styles.detailIconContainer}>
                          <Feather name="check-circle" size={16} color={colors.success} />
                        </View>
                        <Text style={styles.detailText}>
                          Connected to {googleCalendarStatus.calendarEmail || 'Google Calendar'}
                        </Text>
                      </View>
                      <Text style={styles.detailSubtext}>
                        Jobs with scheduled dates will automatically sync to your Google Calendar.
                      </Text>
                      <PressableRow style={[styles.actionButton, styles.actionButtonPrimary, { marginBottom: 8 }]} onPress={handleSyncAllJobs} disabled={isSyncingAllJobs} data-testid="button-sync-all-jobs" >
                        {isSyncingAllJobs ? (
                          <ActivityIndicator size="small" color={colors.primaryForeground} />
                        ) : (
                          <Feather name="refresh-cw" size={16} color={colors.primaryForeground} />
                        )}
                        <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                          {isSyncingAllJobs ? 'Syncing...' : 'Sync All Jobs to Calendar'}
                        </Text>
                      </PressableRow>
                      <PressableRow style={[styles.actionButton, styles.actionButtonSecondary]} onPress={handleDisconnectGoogleCalendar} data-testid="button-disconnect-google-calendar" >
                        <Feather name="link-2" size={16} color={colors.destructive} />
                        <Text style={[styles.actionButtonText, { color: colors.destructive }]}>
                          Disconnect
                        </Text>
                      </PressableRow>
                    </>
                  ) : (
                    <>
                      <Text style={styles.detailSubtext}>
                        Automatically sync your job schedules with Google Calendar. See all appointments in one place.
                      </Text>
                      <View style={styles.featureList}>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Auto-sync scheduled jobs</Text>
                        </View>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>View all appointments in calendar</Text>
                        </View>
                        <View style={styles.featureItem}>
                          <Feather name="check" size={14} color={colors.success} />
                          <Text style={styles.featureText}>Get reminders on your phone</Text>
                        </View>
                      </View>
                      <PressableRow style={[styles.actionButton, styles.actionButtonPrimary]} onPress={handleConnectGoogleCalendar} disabled={isConnectingCalendar} data-testid="button-connect-google-calendar" >
                        {isConnectingCalendar ? (
                          <ActivityIndicator size="small" color={colors.primaryForeground} />
                        ) : (
                          <Feather name="link" size={16} color={colors.primaryForeground} />
                        )}
                        <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                          {isConnectingCalendar ? 'Connecting...' : 'Connect Google Calendar'}
                        </Text>
                      </PressableRow>
                    </>
                  )}
                </View>
              </View>

              <View style={styles.comingSoonCard}>
                <Feather name="zap" size={24} color={colors.mutedForeground} style={{ marginBottom: 8 }} />
                <Text style={styles.comingSoonTitle}>Need Another Integration?</Text>
                <Text style={styles.comingSoonText}>
                  We're always adding new integrations. Got a request? Let us know and we'll prioritise it!
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}
