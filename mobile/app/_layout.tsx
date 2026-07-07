import { initSentry, setSentryUser, captureException } from '../src/lib/sentry';
import { installGlobalErrorHandler } from '../src/lib/errors';

initSentry();
installGlobalErrorHandler();

import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, InteractionManager, ActivityIndicator, AppState, AppStateStatus, Image, Animated, Easing, Platform } from 'react-native';
import { Alert } from '@/lib/alert';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import { useAuthStore, useTimeTrackingStore, useJobsStore } from '../src/lib/store';
import "../global.css";
import { useNotifications, useOfflineStorage, useLocationTracking, useStripeTerminal } from '../src/hooks/useServices';
import { isTapToPayAvailable } from '../src/lib/stripe-terminal';
import notificationService from '../src/lib/notifications';
import { router, usePathname, useSegments, useGlobalSearchParams } from 'expo-router';
import { ThemeProvider, useTheme } from '../src/lib/theme';
import { BottomNav, getBottomNavHeight } from '../src/components/BottomNav';
import { SidebarNav, getSidebarWidth } from '../src/components/SidebarNav';
import { Header } from '../src/components/Header';
import { useNotificationsStore } from '../src/lib/notifications-store';
import { useLocationStore } from '../src/lib/location-store';
import { TerminalProvider } from '../src/providers/StripeTerminalProvider';
import { OfflineBanner, OfflineIndicator } from '../src/components/OfflineIndicator';
import { ConflictResolutionPanel } from '../src/components/ConflictResolutionPanel';
import { useOfflineStore } from '../src/lib/offline-storage';
import offlineStorage from '../src/lib/offline-storage';
import { ScrollProvider } from '../src/contexts/ScrollContext';
import api from '../src/lib/api';
import { FloatingActionButton } from '../src/components/FloatingActionButton';
import { useShouldUseSidebar, isIPad, useOrientation } from '../src/lib/device';
import { MapPreferenceModal } from '../src/components/MapPreferenceModal';
import { WhatYouMissedPopup } from '../src/components/WhatYouMissedPopup';
import { WhatsNewSheet } from '../src/components/WhatsNewSheet';
import ErrorBoundary from '../src/components/ErrorBoundary';
import { CustomAlertProvider } from '../src/components/CustomAlert';
import { initGlobalIAP } from '../src/lib/iap-global';
import Toast from 'react-native-toast-message';
import { buildToastConfig } from '../src/lib/toast';
import Celebration from '../src/components/Celebration';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActionSheetProvider } from '../src/components/ui/ActionSheet';
import { ConfirmDialogProvider } from '../src/components/ui/ConfirmDialog';
import { AlertHost } from '../src/lib/alert';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { applyGlobalInterFont } from '../src/lib/global-font';

applyGlobalInterFont();

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

async function checkForOTAUpdate() {
  if (__DEV__) return;
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      Alert.alert(
        'Update Available',
        'A new version has been downloaded. Restart to apply?',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Restart', onPress: () => Updates.reloadAsync() },
        ]
      );
    }
  } catch (e) {
    // Silently fail - OTA check is non-critical
  }
}

function InviteAutoPrompt() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [prompted, setPrompted] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user || prompted) return;
    
    const checkInvites = async () => {
      try {
        const res = await api.getPendingInvites();
        if (res.data?.invites && res.data.invites.length > 0) {
          setPrompted(true);
          const invite = res.data.invites[0];
          Alert.alert(
            'New Invitation',
            `${invite.businessName} wants to add you as ${invite.roleName}. Open workspaces to review?`,
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'View',
                onPress: () => {
                  router.push('/(tabs)/profile');
                },
              },
            ],
          );
        }
      } catch (err) {
        if (__DEV__) console.log('[InviteAutoPrompt] Could not check invites:', err);
      }
    };
    
    const timer = setTimeout(checkInvites, 3000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, user, prompted]);

  return null;
}

// Deep link handler for email flows (verify-email, accept-invite, reset-password)
function DeepLinkHandler() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  
  useEffect(() => {
    // Handle initial URL (when app opens from a deep link)
    const handleInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleDeepLink(initialUrl);
      }
    };
    
    // Handle deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });
    
    handleInitialURL();
    
    return () => {
      subscription.remove();
    };
  }, []);
  
  const handleDeepLink = async (url: string) => {
    try {
      const parsed = Linking.parse(url);
      const { hostname, path, queryParams } = parsed;
      
      // Handle different deep link paths
      if (hostname === 'verify-email' || path === '/verify-email') {
        const token = queryParams?.token as string;
        if (token) {
          try {
            const response = await api.post<{ success?: boolean; sessionToken?: string; isNewUser?: boolean }>('/api/auth/verify-email', { token });
            if (response.data?.success) {
              if (response.data.sessionToken) {
                api.setToken(response.data.sessionToken);
              }
              await checkAuth();
              InteractionManager.runAfterInteractions(() => {
                if (response.data?.isNewUser) {
                  router.replace('/(onboarding)/setup');
                } else {
                  router.replace('/(tabs)');
                }
              });
            } else {
              Alert.alert('Verification Failed', response.error || 'Failed to verify email');
            }
          } catch (error: any) {
            Alert.alert('Verification Failed', error.message || 'Failed to verify email');
          }
        }
      } else if (hostname === 'accept-invite' || path === '/accept-invite') {
        const token = queryParams?.token as string;
        if (token) {
          InteractionManager.runAfterInteractions(() => {
            router.push(`/(auth)/accept-invite?token=${token}`);
          });
        }
      } else if (hostname === 'reset-password' || path === '/reset-password') {
        const token = queryParams?.token as string;
        if (token) {
          // Defer navigation until interactions complete for safety
          InteractionManager.runAfterInteractions(() => {
            router.push(`/(auth)/reset-password?token=${token}`);
          });
        }
      } else if (hostname === 'xero-callback' || path === '/xero-callback') {
        // Xero OAuth callback - handled by integrations screen
        const success = queryParams?.success === 'true';
        if (success) {
          InteractionManager.runAfterInteractions(() => {
            router.push('/more/integrations');
          });
        }
      }
    } catch (error) {
      if (__DEV__) console.log('[DeepLink] Error handling deep link:', error);
    }
  };
  
  return null;
}

function ServicesInitializer() {
  const notifications = useNotifications();
  const offline = useOfflineStorage();
  const location = useLocationTracking();
  const terminal = useStripeTerminal();
  const { fetchNotifications } = useNotificationsStore();
  const gpsOptOut = useLocationStore((s) => s.gpsOptOut);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const terminalInitializedRef = useRef(false);
  const runningLateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRunningLateJobRef = useRef<string | null>(null);
  const geofenceListenerRef = useRef(false);
  const lastExitPromptAtRef = useRef(0);

  // Shared "you've left the site but your timer is running" prompt.
  // Used by both the geofence exit event and the foreground fallback check.
  const showLeftSitePrompt = (jobId: string, jobTitle: string) => {
    const now = Date.now();
    if (now - lastExitPromptAtRef.current < 10 * 60 * 1000) return; // don't spam
    lastExitPromptAtRef.current = now;
    Alert.alert(
      'Are you finished at the job?',
      `You've left ${jobTitle} but your timer is still running.`,
      [
        {
          text: 'Finish Job',
          onPress: () => {
            router.push(`/job/${jobId}?action=complete` as any);
          },
        },
        {
          text: 'On Break',
          onPress: async () => {
            const ok = await useTimeTrackingStore.getState().pauseTimer();
            if (!ok) Alert.alert('Error', 'Could not switch to break — check Time Tracking.');
          },
        },
        { text: 'Continue Timer', style: 'cancel' },
      ]
    );
  };

  // Fallback: geofence events can be missed (OS throttling, app killed, no
  // background location). When the app comes to the foreground with a work
  // timer still running, check how far we are from the job site and show the
  // same prompt if we're clearly off-site.
  const checkTimerVsLocation = async () => {
    try {
      const tt = useTimeTrackingStore.getState();
      const timer = tt.activeTimer;
      if (!timer || timer.isBreak || !timer.jobId) return;
      const job = useJobsStore.getState().jobs.find((j) => j.id === timer.jobId);
      if (!job || job.latitude == null || job.longitude == null) return;

      const Location = await import('expo-location');
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) return;
      let pos = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000 });
      if (!pos) {
        pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      }
      if (!pos) return;

      // Haversine distance in metres
      const toRad = (d: number) => (d * Math.PI) / 180;
      const R = 6371000;
      const dLat = toRad(pos.coords.latitude - Number(job.latitude));
      const dLon = toRad(pos.coords.longitude - Number(job.longitude));
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(Number(job.latitude))) * Math.cos(toRad(pos.coords.latitude)) * Math.sin(dLon / 2) ** 2;
      const dist = 2 * R * Math.asin(Math.sqrt(a));

      if (dist > 150) {
        showLeftSitePrompt(timer.jobId, job.title || 'the job site');
      }
    } catch (err) {
      if (__DEV__) console.log('[App] Timer/location check failed:', err);
    }
  };

  useEffect(() => {
    async function initServices() {
      try {
        const token = await notifications.initialize();
        
        // Sync push token with store
        const { setPushToken } = useNotificationsStore.getState();
        setPushToken(token);
        
        // Handle notification received while app is open
        notificationService.onReceived((notification) => {
          if (__DEV__) console.log('[App] Notification received:', notification);
          // Refresh in-app notifications when push arrives
          fetchNotifications();
        });
        
        // Handle notification tapped - navigate to relevant screen
        notificationService.onTapped((notification, action) => {
          if (__DEV__) console.log('[App] Notification tapped:', notification);
          
          // Navigate based on notification type
          const { type, data } = notification;
          
          switch (type) {
            case 'job_assigned':
            case 'job_update':
            case 'job_reminder':
            case 'job_scheduled':
            case 'job_started':
            case 'job_completed':
            case 'geofence_checkin':
            case 'geofence_checkout':
            case 'geofence':
            case 'running_late':
            case 'recurring_job_created':
              if (data?.jobId) {
                router.push(`/job/${data.jobId}`);
              }
              break;

            case 'quote_accepted':
            case 'quote_rejected':
            case 'quote_sent':
            case 'quote_expiring':
              if (data?.quoteId) {
                router.push(`/more/quote/${data.quoteId}`);
              }
              break;

            case 'payment_received':
            case 'payment_failed':
            case 'invoice_overdue':
            case 'invoice_sent':
            case 'installment_due':
            case 'installment_received':
            case 'recurring_invoice_created':
              if (data?.invoiceId) {
                router.push(`/more/invoice/${data.invoiceId}`);
              }
              break;

            case 'team_message':
            case 'chat_message':
              if (data?.chatType === 'team') {
                router.push('/more/team-chat');
              } else if (data?.chatType === 'direct' || data?.conversationId) {
                router.push('/more/direct-messages');
              } else {
                router.push('/more/chat-hub');
              }
              break;

            case 'sms_received':
              if (data?.conversationId) {
                router.push(`/more/sms-conversation?id=${data.conversationId}`);
              } else {
                router.push('/more/chat-hub');
              }
              break;

            case 'team_invite':
              router.push('/more/team-management');
              break;

            case 'timesheet_submitted':
              router.push('/more/team-management');
              break;

            case 'trial_expiring':
              router.push('/more/subscription');
              break;

            case 'daily_summary':
            case 'weekly_summary':
            case 'automation':
            case 'general':
            default:
              fetchNotifications();
              router.push('/more/notifications-inbox');
          }
        });
      } catch (error) {
        if (__DEV__) console.log('[App] Notifications not available (requires device)');
      }

      try {
        await offline.initialize();
      } catch (error) {
        if (__DEV__) console.log('[App] Offline storage init failed:', error);
      }

      try {
        const currentGpsOptOut = useLocationStore.getState().gpsOptOut;
        
        if (currentGpsOptOut) {
          if (__DEV__) console.log('[App] GPS Privacy Mode enabled — skipping location init');
        } else {
          // Use the store's initializer so permissionGranted, the location/
          // status callbacks, AND the 60s window scheduler are all wired up at
          // boot. The bare hook init only flips local hook state, which left
          // applyTrackingSchedule() early-returning (permissionGranted=false)
          // so the owner tracking window never engaged until App Settings was
          // opened.
          await useLocationStore.getState().initializeTracking();
          const locationGranted = useLocationStore.getState().permissionGranted;
          
          if (locationGranted) {
            const { locationTracking } = await import('../src/lib/location-tracking');
            locationTracking.syncJobGeofences();
          } else {
            if (__DEV__) console.log('[App] Location not yet granted — will prompt when user needs it');
          }
        }

        if (!geofenceListenerRef.current) {
        geofenceListenerRef.current = true;
        location.onGeofenceEvent(async (event) => {
          if (useLocationStore.getState().gpsOptOut) return;
          if (__DEV__) console.log('[App] Geofence event:', event);
          const jobId = event.identifier.replace('job_', '');
          
          try {
            const response = await api.post<{ jobTitle?: string; timeEntryAction?: { type: string; duration?: number } }>('/api/geofence-events', {
              identifier: event.identifier,
              action: event.action,
              timestamp: event.timestamp,
            });

            const data = response.data ?? {};
            const jobTitle = data?.jobTitle || 'Job site';
            const timeAction = data?.timeEntryAction;

            let title = '';
            let body = '';

            if (event.action === 'enter') {
              if (timeAction?.type === 'clock_in') {
                title = 'Arrived — Timer Started';
                body = `You've arrived at ${jobTitle}. Time tracking has been auto-started.`;
              } else {
                title = 'Arrived on Site';
                body = `You've arrived at ${jobTitle}. Tap to view job details.`;
              }
            } else {
              if (timeAction?.type === 'clock_out') {
                const dur = timeAction.duration ? ` (${Math.round(timeAction.duration / 60)} min logged)` : '';
                title = 'Left Site — Timer Stopped';
                body = `You've left ${jobTitle}. Time tracking auto-stopped${dur}.`;
              } else {
                title = 'Left Job Site';
                body = `You've left ${jobTitle}. Don't forget to log your time.`;

                // If the worker's timer is still running for this job, ask
                // them directly what's going on instead of silently letting
                // the clock run (grabbing materials vs finished vs break).
                const tt = useTimeTrackingStore.getState();
                const timer = tt.activeTimer;
                if (timer && timer.jobId === jobId && !timer.isBreak && AppState.currentState === 'active') {
                  showLeftSitePrompt(jobId, jobTitle);
                  // The in-app prompt replaces the passive notification.
                  return;
                }
              }
            }

            await notificationService.scheduleLocalNotification(title, body, {
              type: 'geofence',
              jobId,
              action: event.action,
            });
          } catch (err) {
            if (__DEV__) console.log('[App] Geofence event handling error:', err);
            // Still show a basic notification even if server call fails
            const action = event.action === 'enter' ? 'Arrived on site' : 'Left site';
            await notificationService.scheduleLocalNotification(action, 'Tap to view job details.', {
              type: 'geofence',
              jobId,
            });
          }
        });
        } // end geofence listener guard
      } catch (error) {
        if (__DEV__) console.log('[App] Location init failed:', error);
      }

      if (runningLateIntervalRef.current) clearInterval(runningLateIntervalRef.current);
      runningLateIntervalRef.current = setInterval(async () => {
        try {
          if (useLocationStore.getState().gpsOptOut) return;

          const prefsRes = await api.get<{ smartRunningLateEnabled?: boolean; pushNotificationsEnabled?: boolean }>('/api/notification-preferences');
          if (prefsRes.error || prefsRes.data?.smartRunningLateEnabled === false || prefsRes.data?.pushNotificationsEnabled === false) return;

          let loc = location.currentLocation;
          const locationAge = loc ? Date.now() - loc.timestamp : Infinity;
          if (!loc || locationAge > 10 * 60 * 1000) {
            loc = await location.getCurrentLocation();
          }
          if (!loc?.latitude) return;

          type LateCheck = { runningLate?: boolean; jobId?: string; scheduledAt?: string; jobTitle?: string; lateByMinutes?: number; clientName?: string };
          const checkRes = await api.post<LateCheck>('/api/smart-running-late/check', {
            latitude: loc.latitude,
            longitude: loc.longitude,
          });

          const result: LateCheck = (checkRes.data as LateCheck) || ({} as LateCheck);
          if (result?.runningLate && result.jobId && result.jobId !== lastRunningLateJobRef.current) {
            lastRunningLateJobRef.current = result.jobId;
            const scheduledTime = result.scheduledAt ? new Date(result.scheduledAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '';
            await notificationService.scheduleLocalNotification(
              `Running Late for ${result.jobTitle}`,
              `You're ~${result.lateByMinutes} min behind for ${scheduledTime ? `your ${scheduledTime} job` : 'your next job'}. Tap to notify ${result.clientName}.`,
              { type: 'running_late', jobId: result.jobId }
            );
          }
        } catch (err) {
          if (__DEV__) console.log('[App] Running late check error:', err);
        }
      }, 5 * 60 * 1000);

      // Apple Requirement 1.4: Initialize/warm Terminal at app launch for faster checkout
      // Only initialize if Tap to Pay is available on this device
      if (isTapToPayAvailable() && !terminalInitializedRef.current) {
        try {
          if (__DEV__) console.log('[App] Warming up Stripe Terminal for faster checkout...');
          await terminal.initialize();
          terminalInitializedRef.current = true;
        } catch (error) {
          if (__DEV__) console.log('[App] Terminal warm-up failed (non-critical):', error);
        }
      }
    }

    initServices();

    // Apple Requirement 1.4: Re-initialize Terminal when app comes to foreground
    // This ensures Terminal is ready for quick payment processing
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      // On foreground, re-evaluate the owner tracking window so GPS resumes if
      // work hours have opened (or stops if they've closed) while backgrounded.
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        void useLocationStore.getState().applyTrackingSchedule();
        // Catch missed geofence exits: timer running but user is off-site.
        void checkTimerVsLocation();
      }

      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isTapToPayAvailable()
      ) {
        if (__DEV__) console.log('[App] App came to foreground - warming Terminal...');
        try {
          await terminal.initialize();
        } catch (error) {
          if (__DEV__) console.log('[App] Terminal foreground warm-up failed (non-critical):', error);
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
      if (runningLateIntervalRef.current) {
        clearInterval(runningLateIntervalRef.current);
        runningLateIntervalRef.current = null;
      }
    };
  }, []);

  return null;
}

function OwnerSubscriptionLapsedScreen({ businessName, onSignOut }: { businessName?: string; onSignOut: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
      <View style={{ maxWidth: 360, alignItems: 'center' }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <Image
            source={require('../assets/icon.png')}
            style={{ width: 32, height: 32, opacity: 0.4 }}
            resizeMode="contain"
          />
        </View>
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{ marginBottom: 12 }}>
            <Animated.Text style={{ fontSize: 20, fontWeight: '600', color: colors.foreground, textAlign: 'center' }}>
              Subscription Inactive
            </Animated.Text>
          </View>
          <Animated.Text style={{ fontSize: 15, color: colors.mutedForeground, textAlign: 'center', lineHeight: 22 }}>
            {businessName
              ? `${businessName}'s JobRunner subscription is no longer active.`
              : "Your employer's JobRunner subscription is no longer active."}
          </Animated.Text>
          <Animated.Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: 'center', marginTop: 12, lineHeight: 20 }}>
            Please contact the business owner to restore access.
          </Animated.Text>
        </View>
        <View
          onTouchEnd={onSignOut}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          <Animated.Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '500' }}>
            Sign Out
          </Animated.Text>
        </View>
      </View>
    </View>
  );
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const { fetchNotifications } = useNotificationsStore();
  const { isAuthenticated, isOwner, isStaff, hasActiveTeam, user, logout, businessSettings, onboardingFinishing, setOnboardingFinishing } = useAuthStore();
  const { colors } = useTheme();
  const { isOnline, isInitialized: offlineInitialized } = useOfflineStore();
  const shouldUseSidebar = useShouldUseSidebar();
  const orientation = useOrientation();

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      initGlobalIAP();
    }
  }, [isAuthenticated]);

  // Trigger full sync when coming online or after authentication
  useEffect(() => {
    if (isAuthenticated && isOnline && offlineInitialized) {
      offlineStorage.fullSync();
    }
  }, [isAuthenticated, isOnline, offlineInitialized]);
  
  const pathname = usePathname();
  const segments = useSegments();
  const globalSearchParams = useGlobalSearchParams<{ resume?: string }>();
  const isChatScreen = pathname?.includes('/chat') || pathname?.includes('/direct-messages') || pathname?.includes('/sms-conversation') || pathname?.includes('/team-chat');
  const isOnboardingScreen = segments.includes('(onboarding)' as never) || pathname === '/setup';
  const isOpsScreen = pathname === '/more/dispatch-board' || pathname === '/more/team-operations';
  const firstSegment = segments[0] as string || '';
  const isAuthScreen = firstSegment === '(auth)' || (firstSegment === '' && !isAuthenticated);

  // Global guard: an authenticated user who has already finished (or skipped)
  // onboarding must NEVER end up on the (onboarding) stack via deep-link,
  // cold start, or token refresh. The wizard's own effect handles the same
  // case while it's mounting; this catches any race where the wizard mounts
  // before settings have been fetched.
  // Exception: if the user explicitly opts in via `?resume=1` (the dashboard
  // reminder banner does this) we let them back into the wizard so they can
  // finish their business profile. We read the param via
  // `useGlobalSearchParams` because `usePathname()` strips the query string.
  useEffect(() => {
    if (!isAuthenticated) return;
    if (!isOnboardingScreen) {
      // The owner has left the wizard for the app — the post-onboarding
      // finishing sequence is over, so reset the guard-suppression flag.
      if (onboardingFinishing) setOnboardingFinishing(false);
      return;
    }
    if (globalSearchParams?.resume === '1') return;
    // While the post-onboarding sequence (magic screen → tour → notifications
    // permission) is intentionally playing, the owner's `onboardingCompleted`
    // flips true but they must be allowed to finish that timed flow — the
    // wizard navigates itself when done. Suppressing here stops this guard from
    // yanking them straight to the dashboard mid-animation.
    if (onboardingFinishing) return;
    if (businessSettings?.onboardingCompleted) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isOnboardingScreen, globalSearchParams?.resume, businessSettings?.onboardingCompleted, onboardingFinishing, setOnboardingFinishing]);

  // Push the owner's team-wide tracking window into the location tracker so the
  // worker's phone only runs GPS during work hours (with a clocked-in / on-job
  // override). Re-runs whenever the settings load or the owner changes them.
  useEffect(() => {
    if (!isAuthenticated) return;
    const window = businessSettings
      ? {
          enabled: !!businessSettings.trackingHoursEnabled,
          start: businessSettings.workHoursStart || '07:00',
          end: businessSettings.workHoursEnd || '17:00',
          days: Array.isArray(businessSettings.workDays) ? businessSettings.workDays : [1, 2, 3, 4, 5],
        }
      : null;
    useLocationStore.getState().setTrackingWindow(window);
  }, [
    isAuthenticated,
    businessSettings?.trackingHoursEnabled,
    businessSettings?.workHoursStart,
    businessSettings?.workHoursEnd,
    businessSettings?.workDays,
  ]);
  const showFab = !isChatScreen && !isOnboardingScreen && !isOpsScreen;
  const isTeamOwner = isOwner() && hasActiveTeam();

  if (!isAuthenticated || isAuthScreen) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        {children}
      </View>
    );
  }

  if (isOnboardingScreen) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {children}
      </View>
    );
  }

  // Worker whose business owner has cancelled / lapsed their subscription:
  // block all app access and show a clear termination screen. Mirrors the
  // web behaviour in client/src/App.tsx and matches the server's
  // 'subscription_lapsed' 403 returned by the permissions middleware.
  if (user && user.isOwner === false && user.ownerSubscriptionValid === false) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <OwnerSubscriptionLapsedScreen
          businessName={user.ownerBusinessName}
          onSignOut={() => { logout(); }}
        />
      </View>
    );
  }

  // Single layout tree for BOTH tablet (sidebar) and phone (header + bottom-nav)
  // chrome. Crossing the tablet-width threshold (folding/unfolding an Android
  // foldable, iPad rotation, split-view resize) only toggles the surrounding
  // chrome and the layout-flex styles — the content host that wraps {children}
  // (and therefore the navigation <Stack> inside it) stays at the exact same
  // position in the React tree, so the navigator is NOT remounted. Remounting
  // it is what previously re-initialized Expo Router / linking (the
  // "linking configured in multiple places" error) and dropped the current
  // route/role state. Conditional siblings are rendered as `null` rather than
  // omitted so the content column keeps a stable sibling index across the swap.
  return (
    <View style={[styles.container, { backgroundColor: colors.background, position: 'relative', overflow: 'visible' }]}>
      <View style={shouldUseSidebar ? styles.tabletLayout : styles.phoneLayout}>
        {/* Sidebar (tablet only). Kept as a stable slot so the content column
            after it does not shift index when it appears/disappears. */}
        {shouldUseSidebar ? <SidebarNav /> : null}

        {/* Content column — same element in both modes. On tablet the header
            hides the avatar (it lives in the sidebar); on phone it shows it. */}
        <View style={styles.tabletContent}>
          <Header showAvatar={!shouldUseSidebar} />

          <View
            style={[
              styles.content,
              !shouldUseSidebar && { paddingBottom: bottomNavHeight, backgroundColor: colors.background },
            ]}
          >
            {children}
          </View>
        </View>
      </View>

      {/* Overlays - absolutely positioned so they don't affect layout */}
      <View style={styles.overlayContainer} pointerEvents="box-none">
        <OfflineBanner />
        <ConflictResolutionPanel />
        <OfflineIndicator />
      </View>

      {/* FAB - floats right of the sidebar on tablet, above the bottom-nav on phone */}
      {showFab && (
        shouldUseSidebar ? (
          <View style={styles.tabletFabWrapper} pointerEvents="box-none">
            <FloatingActionButton isTeamOwner={isTeamOwner} fabStyle="tablet" />
          </View>
        ) : (
          <FloatingActionButton isTeamOwner={isTeamOwner} bottomOffset={bottomNavHeight} />
        )
      )}

      {/* Bottom nav (phone only) */}
      {!shouldUseSidebar ? <BottomNav /> : null}
    </View>
  );
}

function LoadingScreen({ colors }: { colors: any }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Gentle pulsing animation for the logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    // Smooth rotation for the loading ring
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);
  
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: colors.background 
    }}>
      <View style={{ 
        width: 140, 
        height: 140, 
        justifyContent: 'center', 
        alignItems: 'center',
        marginBottom: 24,
      }}>
        {/* Outer rotating ring */}
        <Animated.View
          style={{
            position: 'absolute',
            width: 140,
            height: 140,
            borderRadius: 70,
            borderWidth: 3,
            borderColor: 'transparent',
            borderTopColor: colors.primary,
            borderRightColor: colors.primary + '40',
            transform: [{ rotate: spin }],
          }}
        />
        
        {/* Inner pulsing logo container */}
        <Animated.View
          style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: colors.card,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 8,
            transform: [{ scale: pulseAnim }],
            overflow: 'hidden',
          }}
        >
          <Image 
            source={require('../assets/jobrunner-logo.png')} 
            style={{ 
              width: 120, 
              height: 120, 
              resizeMode: 'contain',
            }} 
          />
        </Animated.View>
      </View>
      
      {/* Loading text with subtle fade */}
      <Animated.Text
        style={{
          fontSize: 14,
          color: colors.mutedForeground,
          fontWeight: '500',
          opacity: 0.8,
        }}
      >
        Loading...
      </Animated.Text>
    </View>
  );
}

function RootLayoutContent() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const user = useAuthStore((state) => state.user);
  const { colors, isDark } = useTheme();
  const [appReady, setAppReady] = useState(false);
  const segments = useSegments();
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (user) {
      setSentryUser({ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName });
    } else {
      setSentryUser(null);
    }
  }, [user]);

  useEffect(() => {
    checkAuth();
    checkForOTAUpdate();
    const maxTimer = setTimeout(() => setAppReady(true), 2000);
    return () => clearTimeout(maxTimer);
  }, []);

  useEffect(() => {
    if (isInitialized && !isLoading) setAppReady(true);
  }, [isInitialized, isLoading]);

  const firstSegment = (segments[0] as string | undefined) ?? '';
  const navigationDone = firstSegment !== '';
  const ready = isInitialized && !isLoading && appReady && navigationDone;

  useEffect(() => {
    if (ready && !settled) setSettled(true);
  }, [ready, settled]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <DeepLinkHandler />
      <InviteAutoPrompt />
      <ServicesInitializer />
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        backgroundColor={colors.background}
        translucent={false}
      />
      <MapPreferenceModal />
      <WhatYouMissedPopup />
      <WhatsNewSheet />
      <AuthenticatedLayout>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'ios_from_right',
            animationDuration: 200,
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            freezeOnBlur: true,
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false, animation: 'none' }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false, animation: 'none', gestureEnabled: false }} />
          <Stack.Screen name="(onboarding)" options={{ headerShown: false, animation: 'none', gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: colors.background } }} />
          <Stack.Screen name="job" options={{ headerShown: false }} />
          <Stack.Screen name="more" options={{ headerShown: false }} />
        </Stack>
      </AuthenticatedLayout>
      {!settled && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, elevation: 99999, backgroundColor: colors.background }}>
          <LoadingScreen colors={colors} />
        </View>
      )}
      <Celebration />
      <Toast config={buildToastConfig()} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <ThemeProvider>
                <ScrollProvider>
                  <TerminalProvider>
                    <CustomAlertProvider>
                      <ConfirmDialogProvider>
                        <ActionSheetProvider>
                          <RootLayoutContent />
                          <AlertHost />
                        </ActionSheetProvider>
                      </ConfirmDialogProvider>
                    </CustomAlertProvider>
                  </TerminalProvider>
                </ScrollProvider>
            </ThemeProvider>
          </SafeAreaProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  tabletLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  phoneLayout: {
    flex: 1,
    flexDirection: 'column',
  },
  tabletContent: {
    flex: 1,
  },
  tabletFabWrapper: {
    position: 'absolute',
    left: 280, // SIDEBAR_WIDTH constant
    right: 0,
    bottom: 0,
    top: 0,
    pointerEvents: 'box-none',
    zIndex: 9999,
    elevation: 9999,
  },
  overlayContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 100,
    zIndex: 50,
    elevation: 50,
    alignItems: 'center',
  },
});
