/**
 * Push Notifications Module
 * 
 * Handles push notifications for job updates, payment alerts, and team messages.
 * Uses Expo Notifications for cross-platform support.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from './api';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushToken {
  token: string;
  platform: 'ios' | 'android';
}

export type NotificationType =
  | 'job_assigned'
  | 'job_update'
  | 'job_reminder'
  | 'job_scheduled'
  | 'job_started'
  | 'job_completed'
  | 'recurring_job_created'
  | 'geofence_checkin'
  | 'geofence_checkout'
  | 'geofence'
  | 'running_late'
  | 'payment_received'
  | 'payment_failed'
  | 'quote_accepted'
  | 'quote_rejected'
  | 'quote_sent'
  | 'quote_expiring'
  | 'team_message'
  | 'chat_message'
  | 'sms_received'
  | 'invoice_overdue'
  | 'invoice_sent'
  | 'installment_due'
  | 'installment_received'
  | 'recurring_invoice_created'
  | 'team_invite'
  | 'timesheet_submitted'
  | 'trial_expiring'
  | 'daily_summary'
  | 'weekly_summary'
  | 'automation'
  | 'general';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: {
    jobId?: string;
    invoiceId?: string;
    quoteId?: string;
    messageId?: string;
    conversationId?: string;
    amount?: number;
    chatType?: 'job' | 'team' | 'direct';
    relatedType?: 'job' | 'quote' | 'invoice';
    [key: string]: any;
  };
}

class NotificationService {
  private pushToken: string | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;
  private onNotificationReceived?: (notification: NotificationPayload) => void;
  private onNotificationTapped?: (notification: NotificationPayload, action?: string) => void;
  private isInitializing: boolean = false;
  private isInitialized: boolean = false;
  private isRegisteredWithBackend: boolean = false;

  /**
   * Initialize push notifications
   * Requests permissions and registers for push notifications
   */
  async initialize(): Promise<string | null> {
    // Guard: prevent multiple initializations
    if (this.isInitialized && this.pushToken) {
      if (__DEV__) console.log('[Notifications] Already initialized, returning existing token');
      // Backend registration may have failed previously (e.g. auth race) — retry now
      if (!this.isRegisteredWithBackend) {
        await this.registerTokenWithBackend();
      }
      return this.pushToken;
    }
    
    if (this.isInitializing) {
      if (__DEV__) console.log('[Notifications] Initialization already in progress, skipping');
      return null;
    }
    
    this.isInitializing = true;
    
    try {
      // Check if we're on a physical device
      if (!Device.isDevice) {
        if (__DEV__) console.log('[Notifications] Push notifications require a physical device');
        this.isInitializing = false;
        return null;
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        if (__DEV__) console.log('[Notifications] Permission not granted');
        this.isInitializing = false;
        return null;
      }

      // Get the push token
      // Try multiple sources for projectId (varies between dev/production builds)
      const projectId = 
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.easConfig?.projectId ||
        process.env.EXPO_PUBLIC_PROJECT_ID;
      
      // Validate projectId is a valid UUID before attempting to get push token
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!projectId || !uuidRegex.test(projectId)) {
        if (__DEV__) console.log('[Notifications] No valid projectId available - push notifications disabled in dev');
        if (__DEV__) console.log('[Notifications] To enable, add EAS projectId to app.config or run eas build');
        this.isInitializing = false;
        return null;
      }
      
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });
      
      this.pushToken = tokenData.data;
      if (__DEV__) console.log('[Notifications] Push token:', this.pushToken);

      // Set up notification channels for Android
      if (Platform.OS === 'android') {
        await this.setupAndroidChannels();
      }

      // Set up listeners
      this.setupListeners();

      // Register token with backend
      await this.registerTokenWithBackend();

      this.isInitialized = true;
      this.isInitializing = false;
      return this.pushToken;
    } catch (error) {
      if (__DEV__) console.error('[Notifications] Initialization failed:', error);
      this.isInitializing = false;
      return null;
    }
  }

  /**
   * Set up Android notification channels
   */
  private async setupAndroidChannels(): Promise<void> {
    await Notifications.setNotificationChannelAsync('jobs', {
      name: 'Job Updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E8862E',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('payments', {
      name: 'Payments',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#22c55e',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Team Messages',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lightColor: '#3b82f6',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('quotes', {
      name: 'Quotes',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8b5cf6',
      sound: 'default',
    });
    
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lightColor: '#6b7280',
      sound: 'default',
    });
  }

  /**
   * Set up notification event listeners
   */
  private setupListeners(): void {
    // Listener for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(
      notification => {
        if (__DEV__) console.log('[Notifications] Received:', notification);
        
        const payload = this.parseNotification(notification);
        if (this.onNotificationReceived && payload) {
          this.onNotificationReceived(payload);
        }
      }
    );

    // Listener for when user taps on a notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      response => {
        if (__DEV__) console.log('[Notifications] Tapped:', response);
        
        const payload = this.parseNotification(response.notification);
        const actionId = response.actionIdentifier;
        
        if (this.onNotificationTapped && payload) {
          this.onNotificationTapped(
            payload,
            actionId !== Notifications.DEFAULT_ACTION_IDENTIFIER ? actionId : undefined
          );
        }
      }
    );
  }

  /**
   * Parse notification into our payload format
   */
  private parseNotification(
    notification: Notifications.Notification
  ): NotificationPayload | null {
    const content = notification.request.content;
    const data = content.data as any;
    
    return {
      type: data?.type ?? 'job_update',
      title: content.title ?? '',
      body: content.body ?? '',
      data: {
        jobId: data?.jobId,
        invoiceId: data?.invoiceId,
        quoteId: data?.quoteId,
        messageId: data?.messageId,
        amount: data?.amount,
      },
    };
  }

  /**
   * Register push token with the backend
   */
  private async registerTokenWithBackend(): Promise<void> {
    if (!this.pushToken) return;
    
    try {
      const res = await api.post('/api/push-tokens', {
        token: this.pushToken,
        platform: Platform.OS,
        deviceName: Device.deviceName,
      });
      // api.post returns { data, error, status } — treat 2xx as success
      const status = (res as any)?.status ?? 0;
      const ok = status >= 200 && status < 300;
      if (ok) {
        this.isRegisteredWithBackend = true;
        if (__DEV__) console.log('[Notifications] Token registered with backend');
      } else {
        this.isRegisteredWithBackend = false;
        if (__DEV__) console.warn('[Notifications] Backend register returned non-2xx:', status);
      }
    } catch (error) {
      this.isRegisteredWithBackend = false;
      if (__DEV__) console.error('[Notifications] Failed to register token:', error);
    }
  }

  /**
   * Public: ensure the current device's push token is registered with the
   * backend for the currently-logged-in user. Safe to call repeatedly — it
   * is a no-op if already registered. Call this after login.
   */
  async ensureRegisteredWithBackend(): Promise<void> {
    // If never initialized, do a full init
    if (!this.isInitialized || !this.pushToken) {
      await this.initialize();
      return;
    }
    if (!this.isRegisteredWithBackend) {
      await this.registerTokenWithBackend();
    }
  }

  /**
   * Public: clear backend-registration flag so the next ensureRegistered
   * will re-POST the token. Call this on logout so the next user re-binds
   * the device to their account.
   */
  resetBackendRegistration(): void {
    this.isRegisteredWithBackend = false;
  }

  /**
   * Public: deactivate this device's push token for the CURRENT user on the
   * backend. Call this on logout BEFORE the auth token is cleared (requireAuth
   * needs it) so the device immediately stops receiving the logged-out user's
   * pushes — e.g. an overtime nudge for a timer the previous account started.
   * The next login re-binds the token via ensureRegisteredWithBackend().
   */
  async deactivateTokenWithBackend(): Promise<void> {
    if (!this.pushToken) {
      this.isRegisteredWithBackend = false;
      return;
    }
    try {
      // api.request resolves with { error } on 401/404/offline (it does NOT
      // throw), so inspect the result rather than assuming success.
      const res = await api.request('DELETE', '/api/push-tokens', { token: this.pushToken });
      if ((res as any)?.error) {
        if (__DEV__) console.warn('[Notifications] Token deactivation returned error:', (res as any).error);
      }
    } catch (error) {
      if (__DEV__) console.warn('[Notifications] Failed to deactivate token on logout:', error);
    } finally {
      this.isRegisteredWithBackend = false;
    }
  }

  /**
   * Set callback for notifications received while app is open
   */
  onReceived(callback: (notification: NotificationPayload) => void): void {
    this.onNotificationReceived = callback;
  }

  /**
   * Set callback for when user taps a notification
   */
  onTapped(callback: (notification: NotificationPayload, action?: string) => void): void {
    this.onNotificationTapped = callback;
  }

  /**
   * Schedule a local notification (for testing or reminders)
   */
  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: any,
    triggerSeconds?: number
  ): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
      },
      trigger: triggerSeconds ? { type: 'timeInterval', seconds: triggerSeconds, repeats: false } as any : null,
    });
    
    return id;
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Get the badge count
   */
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Set the badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Clear the badge
   */
  async clearBadge(): Promise<void> {
    await this.setBadgeCount(0);
  }

  /**
   * Get the push token
   */
  getToken(): string | null {
    return this.pushToken;
  }

  /**
   * Clean up listeners
   */
  cleanup(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
    }
    if (this.responseListener) {
      this.responseListener.remove();
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
