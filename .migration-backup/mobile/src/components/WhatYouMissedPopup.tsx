import { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
  Platform
} from 'react-native';
import { PressableRow } from './ui/PressableRow';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, typography } from '../lib/design-tokens';
import { useAuthStore } from '../lib/store';
import { formatDistanceToNow } from 'date-fns';
import api from '../lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isIOS = Platform.OS === 'ios';

interface MissedNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  relatedId?: string;
  relatedType?: string;
  priority?: 'urgent' | 'important' | 'info';
  actionUrl?: string;
  createdAt: string;
}

interface MissedNotificationsResponse {
  notifications: MissedNotification[];
  count: number;
  hasUrgent: boolean;
}

const AUTO_DISMISS_DELAY = 10000;

const getIcon = (type: string): keyof typeof Feather.glyphMap => {
  switch (type) {
    case 'payment_received':
    case 'installment_received':
    case 'payment_plan_completed':
      return 'dollar-sign';
    case 'quote_accepted':
    case 'quote_rejected':
      return 'file-text';
    case 'job_assigned':
    case 'job_completed':
    case 'recurring_job_created':
      return 'check-circle';
    case 'job_reminder':
    case 'job_scheduled':
      return 'calendar';
    case 'team_invite':
    case 'timesheet_submitted':
      return 'users';
    case 'overdue_invoice':
    case 'payment_failed':
    case 'installment_due':
      return 'alert-circle';
    default:
      return 'bell';
  }
};

const getPriorityColors = (priority?: string) => {
  switch (priority) {
    case 'urgent':
      return { bg: 'rgba(52, 199, 89, 0.15)', icon: '#34C759' };
    case 'important':
      return { bg: 'rgba(255, 149, 0, 0.15)', icon: '#FF9500' };
    default:
      return { bg: 'rgba(142, 142, 147, 0.15)', icon: '#8E8E93' };
  }
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    backgroundColor: colors.card,
    borderRadius: radius['xl'],
    width: Math.min(SCREEN_WIDTH - 48, 400),
    maxHeight: '80%',
    ...(isIOS ? {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 25 },
      shadowOpacity: 0.25,
      shadowRadius: 50,
    } : { elevation: 24 }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: `${colors.muted}50`,
    borderTopLeftRadius: radius['xl'],
    borderTopRightRadius: radius['xl'],
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    ...typography.headline,
    color: colors.foreground,
    fontWeight: '600',
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  progressContainer: {
    height: 4,
    backgroundColor: colors.muted,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  countdownText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.xs,
    fontSize: 11,
  },
  scrollView: {
    maxHeight: 300,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 2,
  },
  notificationMessage: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: 4,
  },
  notificationTime: {
    ...typography.caption,
    color: `${colors.mutedForeground}99`,
    fontSize: 11,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: spacing.xs,
    flexShrink: 0,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  dismissButton: {
    backgroundColor: colors.muted,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  dismissButtonText: {
    ...typography.body,
    fontWeight: '500',
    color: colors.foreground,
  },
});

export function WhatYouMissedPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasShownOnce, setHasShownOnce] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_DISMISS_DELAY);
  const [notifications, setNotifications] = useState<MissedNotification[]>([]);
  const [hasUrgent, setHasUrgent] = useState(false);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isAuthenticated, dashboardReady } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !dashboardReady || hasShownOnce) return;

    const fetchNotifications = async () => {
      try {
        const response = await api.get<MissedNotificationsResponse>('/api/notifications/missed');
        if (response.data && response.data.count > 0) {
          setNotifications(response.data.notifications);
          setHasUrgent(response.data.hasUrgent);
          setIsOpen(true);
          setHasShownOnce(true);
          setCountdown(AUTO_DISMISS_DELAY);
        }
      } catch (error) {
        if (__DEV__) console.error('Failed to fetch missed notifications:', error);
      }
    };

    fetchNotifications();
  }, [isAuthenticated, dashboardReady, hasShownOnce]);

  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 100) {
          clearInterval(interval);
          setIsOpen(false);
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen]);

  const handleClose = () => {
    setCountdown(0);
    setIsOpen(false);
  };

  const handleNotificationPress = async (notification: MissedNotification) => {
    try {
      await api.patch(`/api/notifications/${notification.id}/read`);
    } catch (error) {
      if (__DEV__) console.error('Failed to mark notification as read:', error);
    }

    setIsOpen(false);

    if (notification.actionUrl) {
      router.push(notification.actionUrl as any);
      return;
    }

    if (notification.relatedType && notification.relatedId) {
      switch (notification.relatedType) {
        case 'job':
          router.push(`/job/${notification.relatedId}` as any);
          break;
        case 'quote':
          router.push(`/more/quote/${notification.relatedId}` as any);
          break;
        case 'invoice':
          router.push(`/more/invoice/${notification.relatedId}` as any);
          break;
        case 'client':
          router.push(`/more/client/${notification.relatedId}` as any);
          break;
      }
    }
  };

  const countdownPercent = (countdown / AUTO_DISMISS_DELAY) * 100;

  const sortedNotifications = useMemo(() => {
    const urgent = notifications.filter(n => n.priority === 'urgent');
    const important = notifications.filter(n => n.priority === 'important');
    const other = notifications.filter(n => !n.priority || n.priority === 'info');
    return [...urgent, ...important, ...other];
  }, [notifications]);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.modalOverlay} onPress={handleClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: hasUrgent ? 'rgba(52, 199, 89, 0.15)' : `${colors.primary}20` }]}>
              <Feather 
                name="bell" 
                size={20} 
                color={hasUrgent ? '#34C759' : colors.primary} 
              />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>What You Missed</Text>
              <Text style={styles.headerSubtitle}>
                {notifications.length} update{notifications.length !== 1 ? 's' : ''} since you were away
              </Text>
            </View>
            <PressableRow style={styles.closeButton} onPress={handleClose}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </PressableRow>
          </View>

          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${countdownPercent}%` }]} />
          </View>
          <Text style={styles.countdownText}>
            Auto-closing in {Math.ceil(countdown / 1000)}s
          </Text>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {sortedNotifications.map((notification) => {
              const iconName = getIcon(notification.type);
              const priorityColors = getPriorityColors(notification.priority);

              return (
                <PressableRow key={notification.id} style={styles.notificationItem} onPress={() => handleNotificationPress(notification)} >
                  <View style={[styles.notificationIcon, { backgroundColor: priorityColors.bg }]}>
                    <Feather name={iconName} size={18} color={priorityColors.icon} />
                  </View>
                  <View style={styles.notificationContent}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                      <Text style={[styles.notificationTitle, { flex: 1, minWidth: 0 }]} numberOfLines={1} ellipsizeMode="tail">
                        {notification.title}
                      </Text>
                      {notification.priority === 'urgent' && (
                        <View style={[styles.priorityBadge, { backgroundColor: '#34C75920' }]}>
                          <Text style={[styles.priorityBadgeText, { color: '#34C759' }]}>Money</Text>
                        </View>
                      )}
                      {notification.priority === 'important' && (
                        <View style={[styles.priorityBadge, { backgroundColor: '#FF950020' }]}>
                          <Text style={[styles.priorityBadgeText, { color: '#FF9500' }]}>Action</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.notificationMessage} numberOfLines={2}>
                      {notification.message}
                    </Text>
                    <Text style={styles.notificationTime}>
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} style={{ alignSelf: 'center' }} />
                </PressableRow>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <PressableRow style={styles.dismissButton} onPress={handleClose} >
              <Text style={styles.dismissButtonText}>Got it, thanks!</Text>
            </PressableRow>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
