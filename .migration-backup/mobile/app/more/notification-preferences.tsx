import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography, iconSizes, fontWeights } from '../../src/lib/design-tokens';
import haptics from '../../src/lib/haptics';
import apiClient from '../../src/lib/api';

interface NotificationPreference {
  key: string;
  label: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  category: 'jobs' | 'payments' | 'team' | 'reminders';
}

const NOTIFICATION_PREFERENCES: NotificationPreference[] = [
  {
    key: 'job_assigned',
    label: 'Job Assigned',
    description: 'When a new job is assigned to you',
    icon: 'briefcase',
    color: '#3b82f6',
    category: 'jobs',
  },
  {
    key: 'job_updated',
    label: 'Job Updates',
    description: 'When a job status changes',
    icon: 'refresh-cw',
    color: '#3b82f6',
    category: 'jobs',
  },
  {
    key: 'job_reminder',
    label: 'Job Reminders',
    description: 'Reminders for upcoming scheduled jobs',
    icon: 'clock',
    color: '#f59e0b',
    category: 'jobs',
  },
  {
    key: 'quote_responses',
    label: 'Quote Responses',
    description: 'When clients accept or reject your quotes',
    icon: 'file-text',
    color: '#3b82f6',
    category: 'payments',
  },
  {
    key: 'payment_received',
    label: 'Payment Received',
    description: 'When you receive a payment',
    icon: 'dollar-sign',
    color: '#22c55e',
    category: 'payments',
  },
  {
    key: 'invoice_overdue',
    label: 'Overdue Invoices',
    description: 'Alerts for overdue invoices',
    icon: 'alert-circle',
    color: '#ef4444',
    category: 'payments',
  },
  {
    key: 'team_message',
    label: 'Team Messages',
    description: 'Messages from team members',
    icon: 'message-circle',
    color: '#8b5cf6',
    category: 'team',
  },
  {
    key: 'team_location',
    label: 'Team Location Alerts',
    description: 'When team members check in/out',
    icon: 'map-pin',
    color: '#8b5cf6',
    category: 'team',
  },
  {
    key: 'daily_summary',
    label: 'Daily Summary',
    description: 'Daily overview of your schedule',
    icon: 'calendar',
    color: '#6b7280',
    category: 'reminders',
  },
  {
    key: 'weekly_report',
    label: 'Weekly Report',
    description: 'Weekly business performance summary',
    icon: 'bar-chart-2',
    color: '#6b7280',
    category: 'reminders',
  },
];

const STORAGE_KEY = 'notification_preferences';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  masterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  masterToggleLabel: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  masterToggleDesc: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  prefCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  prefItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  prefItemLast: {
    borderBottomWidth: 0,
  },
  prefIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  prefContent: {
    flex: 1,
  },
  prefLabel: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  prefDesc: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});

export default function NotificationPreferencesScreen() {
  const { colors } = useTheme();
  const bottomInset = useBottomInset(40);
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [preferences, setPreferences] = useState<Record<string, boolean>>({});
  const [masterEnabled, setMasterEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [geofenceSms, setGeofenceSms] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    loadPreferences();
    (async () => {
      try {
        const meRes = await apiClient.get<any>('/api/auth/me');
        const me = meRes.data;
        const owner = !!me && (me.role === 'owner' || me.role === 'admin' || me.isOwner === true);
        setIsOwner(owner);
        if (owner) {
          try {
            const bs = await apiClient.get<any>('/api/business-settings');
            setGeofenceSms(!!bs.data?.geofenceSmsAlerts);
          } catch {}
        }
      } catch {}
    })();
  }, []);

  const toggleGeofenceSms = async (value: boolean) => {
    haptics.toggle(value);
    setGeofenceSms(value);
    try {
      await apiClient.patch('/api/business-settings', { geofenceSmsAlerts: value });
    } catch (err) {
      setGeofenceSms(!value); // rollback
      Alert.alert('Could not save', 'Please try again.');
    }
  };
  
  const loadPreferences = async () => {
    try {
      // First try to load from server
      try {
        const response = await apiClient.get<Record<string, boolean>>('/api/notification-preferences');
        const serverPrefs = response.data ?? ({} as Record<string, boolean>);
        
        // Map server preferences to local preference keys
        const mappedPrefs: Record<string, boolean> = {
          job_assigned: serverPrefs.notifyJobAssigned ?? true,
          job_updated: serverPrefs.notifyJobUpdates ?? true,
          job_reminder: serverPrefs.notifyJobReminders ?? true,
          quote_responses: serverPrefs.notifyQuoteResponses ?? true,
          payment_received: serverPrefs.notifyPaymentConfirmations ?? true,
          invoice_overdue: serverPrefs.notifyOverdueInvoices ?? true,
          team_message: serverPrefs.notifyTeamMessages ?? true,
          team_location: serverPrefs.notifyTeamLocations ?? true,
          daily_summary: serverPrefs.notifyDailySummary ?? false,
          weekly_report: serverPrefs.notifyWeeklySummary ?? false,
        };
        
        setPreferences(mappedPrefs);
        setMasterEnabled(serverPrefs.pushNotificationsEnabled !== false);
        
        // Also cache locally
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
          preferences: mappedPrefs,
          masterEnabled: serverPrefs.pushNotificationsEnabled !== false,
        }));
      } catch (serverError) {
        if (__DEV__) console.log('[Notifications] Server fetch failed, using local cache');
        // Fallback to local storage if server fails
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setPreferences(parsed.preferences || {});
          setMasterEnabled(parsed.masterEnabled !== false);
        } else {
          const defaultPrefs: Record<string, boolean> = {};
          NOTIFICATION_PREFERENCES.forEach(pref => {
            defaultPrefs[pref.key] = true;
          });
          setPreferences(defaultPrefs);
        }
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
      const defaultPrefs: Record<string, boolean> = {};
      NOTIFICATION_PREFERENCES.forEach(pref => {
        defaultPrefs[pref.key] = true;
      });
      setPreferences(defaultPrefs);
    } finally {
      setIsLoading(false);
    }
  };
  
  const savePreferences = async (newPrefs: Record<string, boolean>, newMaster: boolean) => {
    try {
      // Save locally first
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        preferences: newPrefs,
        masterEnabled: newMaster,
      }));
      
      // Then sync to server (non-blocking)
      syncToServer(newPrefs, newMaster);
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
  };
  
  const syncToServer = useCallback(async (prefs: Record<string, boolean>, masterEnabled: boolean) => {
    try {
      // Map local preference keys to server keys
      const serverPrefs = {
        pushNotificationsEnabled: masterEnabled,
        notifyJobAssigned: prefs.job_assigned ?? true,
        notifyJobUpdates: prefs.job_updated ?? true,
        notifyJobReminders: prefs.job_reminder ?? true,
        notifyQuoteResponses: prefs.quote_responses ?? true,
        notifyPaymentConfirmations: prefs.payment_received ?? true,
        notifyOverdueInvoices: prefs.invoice_overdue ?? true,
        notifyTeamMessages: prefs.team_message ?? true,
        notifyTeamLocations: prefs.team_location ?? true,
        notifyDailySummary: prefs.daily_summary ?? false,
        notifyWeeklySummary: prefs.weekly_report ?? false,
      };
      
      await apiClient.patch('/api/notification-preferences', serverPrefs);
      if (__DEV__) console.log('[Notifications] Synced preferences to server');
    } catch (error) {
      console.error('[Notifications] Failed to sync to server:', error);
    }
  }, []);
  
  const toggleMaster = (value: boolean) => {
    haptics.toggle(value);
    setMasterEnabled(value);
    savePreferences(preferences, value);
  };
  
  const togglePreference = (key: string) => {
    haptics.selection();
    const newPrefs = {
      ...preferences,
      [key]: !preferences[key],
    };
    setPreferences(newPrefs);
    savePreferences(newPrefs, masterEnabled);
  };
  
  const renderCategory = (category: string, title: string) => {
    const categoryPrefs = NOTIFICATION_PREFERENCES.filter(p => p.category === category);
    
    return (
      <View style={styles.section} key={category}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.prefCard}>
          {categoryPrefs.map((pref, index) => (
            <View 
              key={pref.key}
              style={[
                styles.prefItem,
                index === categoryPrefs.length - 1 && styles.prefItemLast,
              ]}
            >
              <View style={[styles.prefIconContainer, { backgroundColor: pref.color + '20' }]}>
                <Feather name={pref.icon} size={iconSizes.md} color={pref.color} />
              </View>
              <View style={styles.prefContent}>
                <Text style={styles.prefLabel}>{pref.label}</Text>
                <Text style={styles.prefDesc}>{pref.description}</Text>
              </View>
              <Switch
                value={masterEnabled && (preferences[pref.key] !== false)}
                onValueChange={() => togglePreference(pref.key)}
                disabled={!masterEnabled}
                trackColor={{ false: colors.muted, true: colors.primary + '80' }}
                thumbColor={'#FFFFFF'}
              />
            </View>
          ))}
        </View>
      </View>
    );
  };
  
  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.headerCard}>
        <View style={styles.headerIconContainer}>
          <Feather name="bell" size={iconSizes.lg} color={colors.primary} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Notification Preferences</Text>
          <Text style={styles.headerSubtitle}>Choose which notifications you receive</Text>
        </View>
      </View>
      
      <ScrollView contentContainerStyle={{ paddingBottom: bottomInset }}>
        <View style={styles.masterToggle}>
          <View style={{ flex: 1 }}>
            <Text style={styles.masterToggleLabel}>Push Notifications</Text>
            <Text style={styles.masterToggleDesc}>Enable all push notifications</Text>
          </View>
          <Switch
            value={masterEnabled}
            onValueChange={toggleMaster}
            trackColor={{ false: colors.muted, true: colors.primary + '80' }}
            thumbColor={'#FFFFFF'}
          />
        </View>
        
        {renderCategory('jobs', 'Jobs')}
        {renderCategory('payments', 'Payments & Quotes')}
        {renderCategory('team', 'Team')}
        {renderCategory('reminders', 'Reminders & Reports')}

        {isOwner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SMS Alerts (Owner)</Text>
            <View style={styles.prefCard}>
              <View style={[styles.prefItem, styles.prefItemLast]}>
                <View style={[styles.prefIconContainer, { backgroundColor: '#10b98120' }]}>
                  <Feather name="message-square" size={iconSizes.md} color="#10b981" />
                </View>
                <View style={styles.prefContent}>
                  <Text style={styles.prefLabel}>Geofence SMS</Text>
                  <Text style={styles.prefDesc}>
                    Send SMS to your phone when team arrive/leave job sites
                  </Text>
                </View>
                <Switch
                  value={geofenceSms}
                  onValueChange={toggleGeofenceSms}
                  trackColor={{ false: colors.muted, true: colors.primary + '80' }}
                  thumbColor={'#FFFFFF'}
                />
              </View>
            </View>
          </View>
        )}
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            You can also manage notifications in your device settings
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
