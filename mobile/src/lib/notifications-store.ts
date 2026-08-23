import { create } from 'zustand';
import api from './api';
import notificationService from './notifications';
import { offlineStorage, useOfflineStore } from './offline-storage';

// Unified notification interface matching web implementation
interface UnifiedNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedId?: string;
  relatedType?: string;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
  notificationType: 'system' | 'sms' | 'chat';
  unreadCount?: number;
}

interface UnifiedNotificationsResponse {
  notifications: UnifiedNotification[];
  unreadCount: number;
}

interface NotificationsState {
  notifications: UnifiedNotification[];
  isLoading: boolean;
  isOffline: boolean;
  error: string | null;
  unreadCount: number;
  pushToken: string | null;
  pushPermissionGranted: boolean;
  lastFetchTime: number;
  
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string, notificationType?: 'system' | 'sms' | 'chat') => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  getUnreadCount: () => number;
  setPushToken: (token: string | null) => void;
  setPushPermission: (granted: boolean) => void;
  updateBadgeCount: () => Promise<void>;
  startPolling: () => () => void;
  resetState: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  isLoading: true,
  isOffline: false,
  error: null,
  unreadCount: 0,
  pushToken: null,
  pushPermissionGranted: false,
  lastFetchTime: 0,

  fetchNotifications: async () => {
    // Debounce: don't fetch if we fetched in the last 5 seconds
    const now = Date.now();
    if (now - get().lastFetchTime < 5000 && get().notifications.length > 0) {
      return;
    }

    const isOnline = useOfflineStore.getState().isOnline;

    // When offline, serve from SQLite cache immediately and bail out
    if (!isOnline) {
      try {
        const cached = await offlineStorage.getCachedNotifications();
        const unreadCount = cached.filter(n => !n.read && !n.dismissed).length;
        set({ notifications: cached, unreadCount, isLoading: false, isOffline: true });
        get().updateBadgeCount();
      } catch {
        set({ isLoading: false, isOffline: true });
      }
      return;
    }
    
    set({ isLoading: true, error: null, lastFetchTime: now, isOffline: false });
    try {
      // Use unified endpoint like web - includes system, SMS, and chat notifications
      const response = await api.get<UnifiedNotificationsResponse>('/api/notifications/unified');
      const data = response.data!;
      const notifications = data.notifications || [];
      set({ 
        notifications,
        unreadCount: data.unreadCount || 0,
        isLoading: false 
      });
      // Persist to SQLite cache for offline use
      offlineStorage.cacheNotifications(notifications).catch(() => {});
      // Update badge count
      get().updateBadgeCount();
    } catch (error: any) {
      // Fallback to basic notifications endpoint if unified fails
      try {
        const fallbackResponse = await api.get('/api/notifications');
        const notifications = (fallbackResponse.data as any[]).map(n => ({
          ...n,
          id: String(n.id),
          notificationType: 'system' as const,
        }));
        const unreadCount = notifications.filter(n => !n.read && !n.dismissed).length;
        set({ 
          notifications, 
          unreadCount,
          isLoading: false 
        });
        offlineStorage.cacheNotifications(notifications).catch(() => {});
        get().updateBadgeCount();
      } catch (fallbackError) {
        // Both network paths failed — try the local cache as a last resort
        try {
          const cached = await offlineStorage.getCachedNotifications();
          const unreadCount = cached.filter(n => !n.read && !n.dismissed).length;
          set({ notifications: cached, unreadCount, isLoading: false });
          get().updateBadgeCount();
        } catch {
          set({ 
            error: error.message || 'Failed to fetch notifications',
            isLoading: false 
          });
        }
      }
    }
  },

  markAsRead: async (id: string, notificationType: 'system' | 'sms' | 'chat' = 'system') => {
    try {
      // Use appropriate endpoint based on notification type (matching web behavior)
      if (notificationType === 'sms') {
        await api.patch(`/api/notifications/sms/${id}/read`);
      } else if (notificationType === 'chat') {
        await api.patch(`/api/notifications/chat/${id}/read`);
      } else {
        await api.patch(`/api/notifications/${id}/read`);
      }
      
      const notifications = get().notifications.map(n => 
        n.id === id ? { ...n, read: true } : n
      );
      const unreadCount = notifications.filter(n => !n.read && !n.dismissed).length;
      set({ notifications, unreadCount });
      get().updateBadgeCount();
    } catch (error: any) {
      if (__DEV__) console.error('Failed to mark notification as read:', error);
    }
  },

  markAllAsRead: async () => {
    // Optimistic: clear badge & mark all read in UI FIRST, then fire the request.
    // This makes the "Mark all read" tap feel instant. We only roll back on failure
    // IF nobody else has touched the store in the meantime — checked via reference
    // identity on the notifications array (any state mutation creates a new array).
    const previous = get().notifications;
    const previousUnread = get().unreadCount;
    const optimistic = previous.map(n => ({ ...n, read: true }));
    set({ notifications: optimistic, unreadCount: 0 });
    get().updateBadgeCount();
    try {
      await api.post('/api/notifications/mark-all-read');
    } catch (error: any) {
      if (__DEV__) console.error('Failed to mark all notifications as read:', error);
      // Concurrency-safe rollback: only restore previous state if our optimistic
      // array is still the current one. If a newer fetch landed, leave it alone.
      if (get().notifications === optimistic) {
        set({ notifications: previous, unreadCount: previousUnread });
        get().updateBadgeCount();
      }
    }
  },

  dismissNotification: async (id: string) => {
    try {
      await api.patch(`/api/notifications/${id}/dismiss`);
      const notifications = get().notifications.map(n => 
        n.id === id ? { ...n, dismissed: true } : n
      );
      const unreadCount = notifications.filter(n => !n.read && !n.dismissed).length;
      set({ notifications, unreadCount });
      get().updateBadgeCount();
    } catch (error: any) {
      if (__DEV__) console.error('Failed to dismiss notification:', error);
    }
  },

  getUnreadCount: () => {
    return get().unreadCount;
  },

  setPushToken: (token: string | null) => {
    set({ pushToken: token, pushPermissionGranted: !!token });
  },

  setPushPermission: (granted: boolean) => {
    set({ pushPermissionGranted: granted });
  },

  updateBadgeCount: async () => {
    try {
      const unreadCount = get().unreadCount;
      await notificationService.setBadgeCount(unreadCount);
    } catch (error) {
      // Badge count update is non-critical
    }
  },

  resetState: () => {
    set({
      notifications: [],
      isLoading: false,
      isOffline: false,
      error: null,
      unreadCount: 0,
      lastFetchTime: 0,
    });
  },

  // Start polling for new notifications (returns cleanup function)
  startPolling: () => {
    // Fetch immediately
    get().fetchNotifications();
    
    // Poll every 30 seconds for new notifications
    const intervalId = setInterval(() => {
      get().fetchNotifications();
    }, 30000);
    
    return () => clearInterval(intervalId);
  },
}));

// Export the notification type for use in components
export type { UnifiedNotification };
