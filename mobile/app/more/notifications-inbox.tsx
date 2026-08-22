import { useEffect, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { useNotificationsStore } from '../../src/lib/notifications-store';
import { formatDistanceToNow } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { typography, fontWeights, spacing } from '../../src/lib/design-tokens';
import { SkeletonListItem } from '../../src/components/Skeleton';

const createStyles = (colors: any, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: bottomNavHeight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
  },
  markAllText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 280,
  },
  notificationCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  notificationUnread: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  notificationContent: {
    padding: 14,
    flexDirection: 'row',
    gap: 12,
  },
  notificationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBody: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationTime: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
  },
  notificationActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  actionDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  actionText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.primary,
  },
  dismissText: {
    color: colors.mutedForeground,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginTop: 8,
  },
  settingsText: {
    fontSize: typography.button.fontSize,
    color: colors.primary,
    fontWeight: fontWeights.medium,
  },
});

function getNotificationIcon(notification: any, colors: any) {
  // SMS and chat have special icons
  if (notification.notificationType === 'sms') {
    return { icon: 'phone', bg: '#10b98120', color: '#10b981' }; // Emerald for SMS
  }
  if (notification.notificationType === 'chat') {
    return { icon: 'message-circle', bg: '#6366f120', color: '#6366f1' }; // Indigo for chat
  }
  
  switch (notification.type) {
    case 'job_assigned':
      return { icon: 'briefcase', bg: colors.primaryLight, color: colors.primary };
    case 'job_update':
    case 'job_reminder':
      return { icon: 'tool', bg: colors.warningLight || '#fef3c7', color: colors.warning || '#f59e0b' };
    case 'payment_received':
      return { icon: 'dollar-sign', bg: colors.successLight || '#d1fae5', color: colors.success || '#10b981' };
    case 'invoice_overdue':
      return { icon: 'alert-circle', bg: colors.destructiveLight || '#fee2e2', color: colors.destructive || '#ef4444' };
    case 'quote_accepted':
      return { icon: 'check-circle', bg: colors.successLight || '#d1fae5', color: colors.success || '#10b981' };
    case 'quote_rejected':
      return { icon: 'x-circle', bg: colors.destructiveLight || '#fee2e2', color: colors.destructive || '#ef4444' };
    case 'team_message':
      return { icon: 'message-circle', bg: colors.primaryLight, color: colors.primary };
    default:
      return { icon: 'bell', bg: colors.muted, color: colors.mutedForeground };
  }
}

function getActionForType(type: string): { label: string; route: string } | null {
  switch (type) {
    case 'job_assigned':
    case 'job_update':
    case 'job_reminder':
      return { label: 'View Job', route: '/job/' };
    case 'quote_accepted':
    case 'quote_rejected':
      return { label: 'View Quote', route: '/more/quote/' };
    case 'payment_received':
    case 'invoice_overdue':
      return { label: 'View Invoice', route: '/more/invoice/' };
    case 'team_message':
      return { label: 'View Messages', route: '/more/chat-hub' };
    default:
      return null;
  }
}

export default function NotificationsInboxScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  
  const { 
    notifications, 
    isLoading, 
    unreadCount,
    fetchNotifications, 
    markAsRead, 
    dismissNotification 
  } = useNotificationsStore();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const activeNotifications = useMemo(() => 
    notifications.filter(n => !n.dismissed).slice(0, 50),
    [notifications]
  );

  const handleNotificationPress = useCallback((notification: any) => {
    if (!notification.read) {
      markAsRead(notification.id, notification.notificationType);
    }
    
    // Handle SMS notifications - go to chat hub with SMS filter
    if (notification.notificationType === 'sms') {
      router.push(`/more/chat-hub?smsClientId=${notification.relatedId}` as any);
      return;
    }
    
    // Handle chat notifications - go to chat hub
    if (notification.notificationType === 'chat') {
      router.push('/more/chat-hub');
      return;
    }
    
    // Handle by related type (matching web behavior)
    if (notification.relatedType && notification.relatedId) {
      switch (notification.relatedType) {
        case 'job':
          router.push(`/job/${notification.relatedId}` as any);
          return;
        case 'quote':
          router.push(`/more/quote/${notification.relatedId}` as any);
          return;
        case 'invoice':
          router.push(`/more/invoice/${notification.relatedId}` as any);
          return;
        case 'client':
          router.push(`/more/client/${notification.relatedId}` as any);
          return;
        case 'receipt':
          router.push(`/more/receipt/${notification.relatedId}` as any);
          return;
      }
    }
    
    // Fallback to legacy action type handling
    const action = getActionForType(notification.type);
    if (action) {
      const metadata = notification.metadata || {};
      const id = metadata.jobId || metadata.quoteId || metadata.invoiceId;
      
      if (id && action.route !== '/more/chat-hub') {
        router.push(`${action.route}${id}` as any);
      } else if (action.route === '/more/chat-hub') {
        router.push(action.route);
      }
    }
  }, [markAsRead]);

  const handleMarkAllRead = useCallback(async () => {
    const { markAllAsRead } = useNotificationsStore.getState();
    await markAllAsRead();
  }, []);

  if (isLoading && notifications.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Notifications' }} />
        <View style={[styles.container, { padding: spacing.md }]}>
          {[1, 2, 3, 4, 5, 6, 7].map((i) => <SkeletonListItem key={i} />)}
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchNotifications}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </Text>
            {unreadCount > 0 && (
              <Pressable 
                style={styles.markAllButton}
                onPress={handleMarkAllRead}
                data-testid="button-mark-all-read"
              >
                <Text style={styles.markAllText}>Mark all read</Text>
              </Pressable>
            )}
          </View>

          {activeNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="bell-off" size={32} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptySubtitle}>
                When you receive job updates, payment alerts, or team messages, they'll appear here.
              </Text>
            </View>
          ) : (
            activeNotifications.map((notification) => {
              const iconConfig = getNotificationIcon(notification, colors);
              const action = notification.notificationType === 'sms' || notification.notificationType === 'chat' 
                ? { label: notification.notificationType === 'sms' ? 'View SMS' : 'View Chat', route: '/more/chat-hub' }
                : getActionForType(notification.type);
              
              return (
                <Pressable
                  key={notification.id}
                  style={[
                    styles.notificationCard,
                    !notification.read && styles.notificationUnread
                  ]}
                  onPress={() => handleNotificationPress(notification)}
                  data-testid={`notification-item-${notification.id}`}
                >
                  <View style={styles.notificationContent}>
                    <View style={[styles.notificationIconContainer, { backgroundColor: iconConfig.bg }]}>
                      <Feather name={iconConfig.icon as any} size={20} color={iconConfig.color} />
                    </View>
                    <View style={styles.notificationBody}>
                      <Text style={styles.notificationTitle}>{notification.title}</Text>
                      <Text style={styles.notificationMessage} numberOfLines={2}>
                        {notification.message}
                      </Text>
                      <Text style={styles.notificationTime}>
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.notificationActions}>
                    {action && (
                      <>
                        <Pressable 
                          style={styles.actionButton}
                          onPress={() => handleNotificationPress(notification)}
                          data-testid={`button-view-${notification.id}`}
                        >
                          <Feather name="external-link" size={14} color={colors.primary} />
                          <Text style={styles.actionText}>{action.label}</Text>
                        </Pressable>
                        <View style={styles.actionDivider} />
                      </>
                    )}
                    <Pressable 
                      style={styles.actionButton}
                      onPress={() => dismissNotification(notification.id)}
                      data-testid={`button-dismiss-${notification.id}`}
                    >
                      <Feather name="x" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.actionText, styles.dismissText]}>Dismiss</Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            })
          )}

          <Pressable 
            style={styles.settingsLink}
            onPress={() => router.push('/more/notifications')}
            data-testid="link-notification-settings"
          >
            <Feather name="settings" size={16} color={colors.primary} />
            <Text style={styles.settingsText}>Notification Settings</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}
