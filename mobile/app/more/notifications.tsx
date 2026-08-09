import { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, Pressable, Linking, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { useNotificationsStore } from '../../src/lib/notifications-store';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { typography, fontWeights } from '../../src/lib/design-tokens';

const createStyles = (colors: any, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: bottomNavHeight,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  settingSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 12,
  },
  infoText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  inboxButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 20,
  },
  inboxButtonText: {
    color: colors.primaryForeground,
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
  },
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: 2,
  },
  statusSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
  },
  fixButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.primaryLight,
  },
  fixButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.primary,
  },
});

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const { unreadCount, pushPermissionGranted } = useNotificationsStore();
  
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [jobReminders, setJobReminders] = useState(true);
  const [paymentAlerts, setPaymentAlerts] = useState(true);
  const [quoteUpdates, setQuoteUpdates] = useState(true);

  useEffect(() => {
    checkPermissionStatus();
    // Also fetch notifications to update unread count
    const { fetchNotifications } = useNotificationsStore.getState();
    fetchNotifications();
  }, []);

  const checkPermissionStatus = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionStatus(status);
    } catch (error) {
      if (__DEV__) console.log('Could not check permission status');
    }
  };

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const requestPermission = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setPermissionStatus(status);
    } catch (error) {
      if (__DEV__) console.log('Could not request permission');
    }
  };

  const isPermissionDenied = permissionStatus === 'denied';
  const isPermissionGranted = permissionStatus === 'granted';

  return (
    <>
      <Stack.Screen options={{ title: 'Notification Settings' }} />
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <Pressable 
            style={styles.inboxButton}
            onPress={() => router.push('/more/notifications-inbox')}
            data-testid="button-view-inbox"
          >
            <Feather name="inbox" size={20} color={colors.primaryForeground} />
            <Text style={styles.inboxButtonText}>
              View Inbox {unreadCount > 0 ? `(${unreadCount})` : ''}
            </Text>
          </Pressable>

          {isPermissionDenied && (
            <View style={[styles.statusCard, { borderColor: colors.destructive || '#ef4444' }]}>
              <View style={[styles.statusIcon, { backgroundColor: colors.destructiveLight || '#fee2e2' }]}>
                <Feather name="bell-off" size={22} color={colors.destructive || '#ef4444'} />
              </View>
              <View style={styles.statusContent}>
                <Text style={styles.statusTitle}>Notifications Disabled</Text>
                <Text style={styles.statusSubtitle}>Enable in device settings</Text>
              </View>
              <Pressable style={styles.fixButton} onPress={openSettings} data-testid="button-open-settings">
                <Text style={styles.fixButtonText}>Fix</Text>
              </Pressable>
            </View>
          )}

          {isPermissionGranted && (
            <View style={[styles.statusCard, { borderColor: colors.success || '#10b981' }]}>
              <View style={[styles.statusIcon, { backgroundColor: colors.successLight || '#d1fae5' }]}>
                <Feather name="check-circle" size={22} color={colors.success || '#10b981'} />
              </View>
              <View style={styles.statusContent}>
                <Text style={styles.statusTitle}>Notifications Enabled</Text>
                <Text style={styles.statusSubtitle}>You'll receive alerts on this device</Text>
              </View>
            </View>
          )}

          {permissionStatus === 'undetermined' && (
            <View style={styles.statusCard}>
              <View style={[styles.statusIcon, { backgroundColor: colors.warningLight || '#fef3c7' }]}>
                <Feather name="bell" size={22} color={colors.warning || '#f59e0b'} />
              </View>
              <View style={styles.statusContent}>
                <Text style={styles.statusTitle}>Enable Notifications</Text>
                <Text style={styles.statusSubtitle}>Get alerts for jobs and payments</Text>
              </View>
              <Pressable style={styles.fixButton} onPress={requestPermission} data-testid="button-enable-notifications">
                <Text style={styles.fixButtonText}>Enable</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.sectionTitle}>Notification Channels</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <Feather name="smartphone" size={20} color={colors.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Push Notifications</Text>
                <Text style={styles.settingSubtitle}>Receive alerts on your device</Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={'#FFFFFF'}
              />
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <Feather name="mail" size={20} color={colors.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Email Notifications</Text>
                <Text style={styles.settingSubtitle}>Daily digest and important updates</Text>
              </View>
              <Switch
                value={emailEnabled}
                onValueChange={setEmailEnabled}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={'#FFFFFF'}
              />
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.settingRow}>
              <View style={styles.settingIcon}>
                <Feather name="message-square" size={20} color={colors.primary} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>SMS Notifications</Text>
                <Text style={styles.settingSubtitle}>Urgent alerts via text message</Text>
              </View>
              <Switch
                value={smsEnabled}
                onValueChange={setSmsEnabled}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={'#FFFFFF'}
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Alert Types</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Job Reminders</Text>
                <Text style={styles.settingSubtitle}>Upcoming job notifications</Text>
              </View>
              <Switch
                value={jobReminders}
                onValueChange={setJobReminders}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={'#FFFFFF'}
              />
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.settingRow}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Payment Alerts</Text>
                <Text style={styles.settingSubtitle}>Payments received and overdue</Text>
              </View>
              <Switch
                value={paymentAlerts}
                onValueChange={setPaymentAlerts}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={'#FFFFFF'}
              />
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.settingRow}>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Quote Updates</Text>
                <Text style={styles.settingSubtitle}>Quote accepted or rejected</Text>
              </View>
              <Switch
                value={quoteUpdates}
                onValueChange={setQuoteUpdates}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={'#FFFFFF'}
              />
            </View>
          </View>

          <Text style={styles.infoText}>
            Push notifications require notification permissions. Please enable them in your device settings if they're not working.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}
