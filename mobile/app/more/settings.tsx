import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Linking,
  Switch,
  TextInput,
  Modal,
  ActivityIndicator,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '@/components/ui/PressableRow';
import { Stack, router } from 'expo-router';
import { asHref } from '../../src/lib/nav';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { API_URL, api } from '../../src/lib/api';
import { spacing, radius, typography } from '../../src/lib/design-tokens';
import { useLocationStore } from '../../src/lib/location-store';
import AppTour from '../../src/components/AppTour';
import { Slider } from '../../src/components/ui/Slider';
import { showToast } from '../../src/lib/toast';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';

const PLAN_FEATURES = [
  { icon: 'briefcase', text: 'Unlimited jobs, quotes & invoices', pro: true },
  { icon: 'star', text: 'AI-powered suggestions', pro: true },
  { icon: 'sliders', text: 'Custom branding & theming', pro: true },
  { icon: 'users', text: 'Team management & permissions', pro: true },
  { icon: 'mail', text: 'Automated email reminders', pro: true },
  { icon: 'help-circle', text: 'Priority support', pro: true },
];

const SETTINGS_TABS = [
  { key: 'account', label: 'Account', icon: 'user' },
  { key: 'business', label: 'Business', icon: 'briefcase' },
  { key: 'payment', label: 'Payment', icon: 'credit-card' },
  { key: 'templates', label: 'Templates', icon: 'file-text' },
  { key: 'alerts', label: 'Alerts', icon: 'bell' },
  { key: 'plan', label: 'Plan', icon: 'award' },
  { key: 'help', label: 'Help', icon: 'help-circle' },
];

const GEOFENCE_STORAGE_KEY = '@jobrunner/global_geofence_settings';
const NOTIFICATION_SETTINGS_KEY = '@jobrunner/notification_settings';

interface NotificationSettings {
  push: {
    newJobAssignments: boolean;
    jobStatusChanges: boolean;
    paymentReceived: boolean;
    quoteAccepted: boolean;
    teamMessages: boolean;
  };
  email: {
    dailyDigest: boolean;
    weeklySummary: boolean;
    paymentReceipts: boolean;
    overdueReminders: boolean;
  };
  sms: {
    urgentJobAlerts: boolean;
    paymentConfirmations: boolean;
  };
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  push: {
    newJobAssignments: true,
    jobStatusChanges: true,
    paymentReceived: true,
    quoteAccepted: true,
    teamMessages: true,
  },
  email: {
    dailyDigest: false,
    weeklySummary: true,
    paymentReceipts: true,
    overdueReminders: true,
  },
  sms: {
    urgentJobAlerts: false,
    paymentConfirmations: false,
  },
};

interface DocumentTemplate {
  id: string;
  userId: string;
  type: 'quote' | 'invoice' | 'job';
  familyKey: string;
  name: string;
  tradeType: string;
  rateCardId: string | null;
  styling: {
    brandColor?: string;
    logoDisplay?: boolean;
  };
  sections: {
    showHeader?: boolean;
    showLineItems?: boolean;
    showTotals?: boolean;
    showTerms?: boolean;
    showSignature?: boolean;
  };
  defaults: {
    title?: string;
    description?: string;
    terms?: string;
    depositPct?: number;
    dueTermDays?: number;
    gstEnabled?: boolean;
  };
  defaultLineItems: Array<{
    description: string;
    qty: number;
    unitPrice: number;
    unit: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  unit: string;
}

interface NewTemplate {
  name: string;
  type: 'quote' | 'invoice' | 'job';
  tradeType: string;
  defaults: {
    title: string;
    description: string;
    terms: string;
    depositPct: number;
    gstEnabled: boolean;
  };
  defaultLineItems: LineItem[];
}

const tradeTypes = [
  'plumbing', 'electrical', 'carpentry', 'painting', 'hvac', 'roofing', 
  'landscaping', 'tiling', 'flooring', 'renovation', 'handyman', 'general'
];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  pageSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  saveButtonText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: '600',
  },
  subscriptionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subscriptionLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  subscriptionLinkText: {
    flex: 1,
  },
  subscriptionLinkTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  subscriptionLinkSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  tabsScroll: {
    marginBottom: spacing.lg,
    marginHorizontal: -spacing.lg,
  },
  tabsContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tabText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  planSection: {
    gap: spacing.lg,
  },
  subscriptionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  subscriptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  planInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  planIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  planDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  planPriceBadge: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
  },
  planPriceText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.foreground,
  },
  proFeaturesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  featureText: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
  },
  proBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  upgradeButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  manageBillingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  manageBillingText: {
    ...typography.body,
    color: colors.foreground,
  },
  tabContentSection: {
    gap: spacing.lg,
  },
  settingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
  },
  settingsCardInfo: {
    flex: 1,
  },
  settingsCardTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
  },
  settingsCardSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  settingsInfoCard: {
    backgroundColor: colors.muted,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  settingsInfoTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  settingsInfoText: {
    ...typography.body,
    color: colors.mutedForeground,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
    textTransform: 'uppercase',
  },
  notificationToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  notificationToggleRowLast: {
    borderBottomWidth: 0,
  },
  notificationToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  notificationToggleIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationToggleInfo: {
    flex: 1,
  },
  notificationToggleTitle: {
    ...typography.body,
    fontWeight: '500',
    color: colors.foreground,
  },
  notificationToggleSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  templateStatsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  templateStatCard: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  templateStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: 2,
  },
  templateStatLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  templateList: {
    gap: spacing.md,
  },
  templateCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  templateType: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
    textTransform: 'capitalize',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  templateTrade: {
    fontSize: 12,
    color: colors.mutedForeground,
    textTransform: 'capitalize',
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionButton: {
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  templateDetails: {
    marginTop: spacing.sm,
  },
  templateTitle: {
    fontSize: 14,
    color: colors.foreground,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  badge: {
    fontSize: 11,
    color: colors.mutedForeground,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  templateTerms: {
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 4,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'] + 16,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.lg + 4,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  createTemplateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  createTemplateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.foreground,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg + 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    fontSize: 16,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputMultiline: {
    minHeight: 80,
    paddingTop: spacing.md + 2,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  typeButtonText: {
    fontSize: 14,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  typeButtonTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  tradeTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tradeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tradeChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tradeChipText: {
    fontSize: 13,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  tradeChipTextActive: {
    color: colors.primary,
    fontWeight: '500',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  lineItemRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  lineItemInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    fontSize: 14,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lineItemQty: {
    width: 60,
  },
  lineItemPrice: {
    width: 80,
  },
  addLineItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addLineItemText: {
    fontSize: 14,
    color: colors.primary,
  },
  removeLineItemButton: {
    padding: spacing.sm,
    justifyContent: 'center',
  },
  modalSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
  },
  modalSaveButtonDisabled: {
    opacity: 0.7,
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
  },
  usageBarContainer: {
    marginBottom: spacing.md,
  },
  usageBarLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  usageBarLabelText: {
    ...typography.caption,
    color: colors.foreground,
  },
  usageBarValueText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  usageBarTrack: {
    height: 8,
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  usageBarFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  passwordInput: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    fontSize: 16,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  exportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  exportRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  exportIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  exportButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  businessInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  businessInfoLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  businessInfoValue: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: spacing.md,
  },
});

function GpsPrivacyCard() {
  const { colors } = useTheme();
  const confirm = useConfirmDialog();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { gpsOptOut, setGpsOptOut, isEnabled, status } = useLocationStore();

  const handleOptOutChange = useCallback(async (value: boolean) => {
    if (value) {
      const ok = await confirm({
        title: 'Disable GPS Tracking',
        message: 'This will stop all location sharing and geofencing. Your employer won\'t see your location on the team map. You can still track time without GPS.\n\nYou can re-enable this at any time.',
        confirmText: 'Disable GPS',
        cancelText: 'Cancel',
        destructive: true,
      });
      if (ok) {
        setGpsOptOut(true);
      }
    } else {
      setGpsOptOut(false);
    }
  }, [setGpsOptOut, confirm]);

  const statusText = gpsOptOut 
    ? 'GPS is off — your location is private'
    : isEnabled && (status === 'tracking' || status === 'foreground_only')
      ? 'Location sharing active' 
      : 'GPS available but not actively sharing';

  const statusColor = gpsOptOut ? colors.mutedForeground : isEnabled ? colors.success : colors.warning;

  return (
    <View style={[styles.subscriptionCard, { marginBottom: spacing.lg }]}>
      <View style={styles.subscriptionHeader}>
        <Feather name="shield" size={20} color={colors.primary} />
        <Text style={styles.subscriptionTitle}>Location & Privacy</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} />
        <Text style={[styles.planDescription, { color: statusColor }]}>{statusText}</Text>
      </View>

      <View style={[styles.featureRow, { justifyContent: 'space-between' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
          <Feather name="eye-off" size={16} color={colors.mutedForeground} />
          <View style={{ flex: 1 }}>
            <Text style={styles.featureText}>GPS Privacy Mode</Text>
            <Text style={[styles.planDescription, { marginTop: 2 }]}>Disable all location tracking and sharing</Text>
          </View>
        </View>
        <Switch
          value={gpsOptOut}
          onValueChange={handleOptOutChange}
          trackColor={{ false: colors.border, true: colors.destructive }}
          thumbColor={'#FFFFFF'}
          ios_backgroundColor={colors.border}
        />
      </View>

      {!gpsOptOut && (
        <View style={{ marginTop: spacing.md }}>
          <PressableRow
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}
            onPress={() => Linking.openSettings()}
          >
            <Feather name="settings" size={14} color={colors.info} />
            <Text style={[styles.planDescription, { color: colors.info }]}>
              Manage iOS location permissions
            </Text>
          </PressableRow>
        </View>
      )}

      {gpsOptOut && (
        <View style={{ marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.muted, borderRadius: radius.md }}>
          <Text style={[styles.planDescription, { color: colors.mutedForeground }]}>
            Time tracking still works without GPS. Your location won't appear on the team map and geofencing features will be disabled.
          </Text>
        </View>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const confirm = useConfirmDialog();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { user, refreshUser, roleInfo } = useAuthStore();
  const subRoleName = roleInfo?.roleName?.toLowerCase();
  const isSubcontractor = subRoleName === 'subcontractor' || subRoleName === 'sub_contractor';
  const visibleTabs = useMemo(() => (
    isSubcontractor
      ? SETTINGS_TABS.filter(t => t.key === 'account' || t.key === 'alerts' || t.key === 'help')
      : SETTINGS_TABS
  ), [isSubcontractor]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  useEffect(() => {
    if (!visibleTabs.some(t => t.key === activeTab)) {
      setActiveTab('account');
    }
  }, [visibleTabs, activeTab]);
  const [showTour, setShowTour] = useState(false);
  
  // Account tab - Geofence settings
  const [geofenceEnabled, setGeofenceEnabled] = useState(false);
  const [geofenceRadius, setGeofenceRadius] = useState(100);
  const [autoClockIn, setAutoClockIn] = useState(true);
  const [autoClockOut, setAutoClockOut] = useState(true);

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  // Templates tab
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'quote' | 'invoice' | 'job'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState<NewTemplate>({
    name: '',
    type: 'quote',
    tradeType: 'general',
    defaults: {
      title: '',
      description: '',
      terms: '',
      depositPct: 0,
      gstEnabled: true,
    },
    defaultLineItems: []
  });
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  // Business settings state
  const [businessSettings, setBusinessSettings] = useState<any>(null);
  const [businessLoading, setBusinessLoading] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentData, setPaymentData] = useState({
    defaultHourlyRate: '100',
    calloutFee: '80',
    quoteValidityDays: 30,
    defaultPaymentTermsDays: 14,
    lateFeeRate: '1.5% per month',
    warrantyPeriod: '12 months',
    bankDetails: '',
    quoteTerms: '',
    invoiceTerms: '',
    paymentInstructions: '',
    workerHourlyRate: '',
    workerOvertimeRate: '',
    workerWeekendRate: '',
  });

  // Usage tracking state
  const [usageInfo, setUsageInfo] = useState<any>(null);

  // AI settings state
  // NOTE: defaults are FALSE so we don't lie about AI being on before we've confirmed
  // (a) the user's tier supports it and (b) any saved preference has been loaded.
  const AI_SETTINGS_KEY = '@jobrunner/ai_settings';
  const [aiSettings, setAiSettings] = useState({
    aiEnabled: false,
    aiPhotoAnalysis: false,
    aiAutoCategorizephotos: false,
    aiSuggestions: false,
  });

  // Data export state
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  // Load geofence settings
  const loadGeofenceSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(GEOFENCE_STORAGE_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        setGeofenceEnabled(settings.enabled ?? false);
        setGeofenceRadius(settings.radius ?? 100);
        setAutoClockIn(settings.autoClockIn ?? true);
        setAutoClockOut(settings.autoClockOut ?? true);
      }
    } catch (error) {
      console.error('Failed to load geofence settings:', error);
    }
  }, []);

  const saveGeofenceSettings = useCallback(async (settings: {
    enabled: boolean;
    radius: number;
    autoClockIn: boolean;
    autoClockOut: boolean;
  }) => {
    try {
      await AsyncStorage.setItem(GEOFENCE_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save geofence settings:', error);
    }
  }, []);

  const handleGeofenceEnabledChange = useCallback((value: boolean) => {
    setGeofenceEnabled(value);
    saveGeofenceSettings({ enabled: value, radius: geofenceRadius, autoClockIn, autoClockOut });
  }, [saveGeofenceSettings, geofenceRadius, autoClockIn, autoClockOut]);

  const handleRadiusChange = useCallback((value: number | number[]) => {
    const numValue = Array.isArray(value) ? value[0] : value;
    setGeofenceRadius(numValue);
  }, []);

  const handleRadiusChangeComplete = useCallback((value: number | number[]) => {
    const numValue = Array.isArray(value) ? value[0] : value;
    saveGeofenceSettings({ enabled: geofenceEnabled, radius: numValue, autoClockIn, autoClockOut });
  }, [saveGeofenceSettings, geofenceEnabled, autoClockIn, autoClockOut]);

  const handleAutoClockInChange = useCallback((value: boolean) => {
    setAutoClockIn(value);
    saveGeofenceSettings({ enabled: geofenceEnabled, radius: geofenceRadius, autoClockIn: value, autoClockOut });
  }, [saveGeofenceSettings, geofenceEnabled, geofenceRadius, autoClockOut]);

  const handleAutoClockOutChange = useCallback((value: boolean) => {
    setAutoClockOut(value);
    saveGeofenceSettings({ enabled: geofenceEnabled, radius: geofenceRadius, autoClockIn, autoClockOut: value });
  }, [saveGeofenceSettings, geofenceEnabled, geofenceRadius, autoClockIn]);

  // Notification settings handlers
  const loadNotificationSettings = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored) as NotificationSettings;
        setNotificationSettings(settings);
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  }, []);

  const saveNotificationSettings = useCallback(async (settings: NotificationSettings) => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  }, []);

  const updatePushSetting = useCallback((key: keyof NotificationSettings['push'], value: boolean) => {
    setNotificationSettings(prev => {
      const updated = { ...prev, push: { ...prev.push, [key]: value } };
      saveNotificationSettings(updated);
      return updated;
    });
  }, [saveNotificationSettings]);

  const updateEmailSetting = useCallback((key: keyof NotificationSettings['email'], value: boolean) => {
    setNotificationSettings(prev => {
      const updated = { ...prev, email: { ...prev.email, [key]: value } };
      saveNotificationSettings(updated);
      return updated;
    });
  }, [saveNotificationSettings]);

  const updateSmsSetting = useCallback((key: keyof NotificationSettings['sms'], value: boolean) => {
    setNotificationSettings(prev => {
      const updated = { ...prev, sms: { ...prev.sms, [key]: value } };
      saveNotificationSettings(updated);
      return updated;
    });
  }, [saveNotificationSettings]);

  // Business settings handlers
  const loadBusinessSettings = useCallback(async () => {
    setBusinessLoading(true);
    try {
      const response = await api.get('/api/business-settings');
      if (response.data) {
        const d = response.data as any;
        setBusinessSettings(d);
        setPaymentData({
          defaultHourlyRate: String(d.defaultHourlyRate || '100'),
          calloutFee: String(d.calloutFee || '80'),
          quoteValidityDays: d.quoteValidityDays || 30,
          defaultPaymentTermsDays: d.defaultPaymentTermsDays || 14,
          lateFeeRate: d.lateFeeRate || '1.5% per month',
          warrantyPeriod: d.warrantyPeriod || '12 months',
          bankDetails: d.bankDetails || '',
          quoteTerms: d.quoteTerms || '',
          invoiceTerms: d.invoiceTerms || '',
          paymentInstructions: d.paymentInstructions || '',
          workerHourlyRate: String(d.workerHourlyRate || ''),
          workerOvertimeRate: String(d.workerOvertimeRate || ''),
          workerWeekendRate: String(d.workerWeekendRate || ''),
        });
      }
    } catch (error) {
      console.error('Failed to load business settings:', error);
    }
    setBusinessLoading(false);
  }, []);

  const savePaymentSettings = useCallback(async () => {
    setPaymentSaving(true);
    try {
      const response = await api.patch('/api/business-settings', {
        defaultHourlyRate: paymentData.defaultHourlyRate,
        calloutFee: paymentData.calloutFee,
        quoteValidityDays: paymentData.quoteValidityDays,
        defaultPaymentTermsDays: paymentData.defaultPaymentTermsDays,
        lateFeeRate: paymentData.lateFeeRate,
        warrantyPeriod: paymentData.warrantyPeriod,
        bankDetails: paymentData.bankDetails,
        quoteTerms: paymentData.quoteTerms,
        invoiceTerms: paymentData.invoiceTerms,
        paymentInstructions: paymentData.paymentInstructions,
        workerHourlyRate: paymentData.workerHourlyRate,
        workerOvertimeRate: paymentData.workerOvertimeRate,
        workerWeekendRate: paymentData.workerWeekendRate,
      });
      if (response.error) {
        showToast({ type: 'error', message: response.error });
      } else {
        showToast({ type: 'success', message: 'Payment settings updated successfully' });
      }
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Failed to save payment settings' });
    }
    setPaymentSaving(false);
  }, [paymentData]);

  // Usage tracking
  const loadUsageInfo = useCallback(async () => {
    try {
      const response = await api.get('/api/subscription/usage');
      if (response.data) {
        setUsageInfo(response.data);
      }
    } catch (error) {
      console.error('Failed to load usage info:', error);
    }
  }, []);

  // AI settings handlers — gate by tier so we don't show toggles "on" for users without AI.
  const loadAiSettings = useCallback(async () => {
    try {
      const tier = (user?.subscriptionTier || 'free') as string;
      const tierAllowsAi = tier === 'pro' || tier === 'team' || tier === 'trial';
      const stored = await AsyncStorage.getItem('@jobrunner/ai_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        // If the user's tier doesn't allow AI, force everything off regardless of saved prefs.
        if (!tierAllowsAi) {
          setAiSettings({
            aiEnabled: false,
            aiPhotoAnalysis: false,
            aiAutoCategorizephotos: false,
            aiSuggestions: false,
          });
        } else {
          setAiSettings(parsed);
        }
      } else if (tierAllowsAi) {
        // No saved prefs but tier supports AI → opt-in by default.
        setAiSettings({
          aiEnabled: true,
          aiPhotoAnalysis: true,
          aiAutoCategorizephotos: true,
          aiSuggestions: true,
        });
      }
      // else: tier doesn't allow AI, leave defaults (all false).
    } catch (error) {
      console.error('Failed to load AI settings:', error);
    }
  }, [user?.subscriptionTier]);

  // Tier check derived from auth — used by both the toggle handler and UI gating.
  const aiTierAllowed = (() => {
    const t = (user?.subscriptionTier || 'free') as string;
    return t === 'pro' || t === 'team' || t === 'trial';
  })();

  const updateAiSetting = useCallback((key: string, value: boolean) => {
    // Tier guard: block flipping AI on for tiers that don't include it.
    if (!aiTierAllowed && value === true) {
      showToast({ type: 'info', message: 'AI not included on your plan', description: 'AI features are available on Pro, Trial, and Team plans. Upgrade to enable them.' });
      return;
    }
    setAiSettings(prev => {
      const updated = { ...prev, [key]: value };
      AsyncStorage.setItem('@jobrunner/ai_settings', JSON.stringify(updated));
      return updated;
    });
  }, [aiTierAllowed]);

  // Password change
  const handleChangePassword = useCallback(async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      Alert.alert('Please fill in all password fields');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      showToast({ type: 'error', message: 'New password must be at least 6 characters' });
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast({ type: 'error', message: 'New passwords do not match' });
      return;
    }
    setPasswordSaving(true);
    try {
      const response = await api.post('/api/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      if (response.error) {
        showToast({ type: 'error', message: response.error });
      } else {
        showToast({ type: 'success', message: 'Password changed successfully' });
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setShowPasswordSection(false);
      }
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Failed to change password' });
    }
    setPasswordSaving(false);
  }, [passwordData]);

  const handleExport = useCallback(async (key: string) => {
    setExportingKey(key);
    try {
      const authToken = await api.getToken();
      const filename = `jobrunner-${key}-export.csv`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      const downloadResult = await FileSystem.downloadAsync(
        `${API_URL}/api/export/${key}`,
        fileUri,
        { headers: { 'Authorization': `Bearer ${authToken}` } }
      );
      if (downloadResult.status === 200) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'text/csv',
            dialogTitle: `Export ${key}`,
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          showToast({ type: 'success', message: `File saved to ${filename}` });
        }
      } else {
        showToast({ type: 'error', message: 'Failed to download export file' });
      }
    } catch (error: any) {
      showToast({ type: 'error', message: error.message || 'Could not export data' });
    }
    setExportingKey(null);
  }, []);

  // Templates handlers
  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.append('type', typeFilter);
      
      const authToken = await api.getToken();
      const url = `${API_URL}/api/templates${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    }
    setTemplatesLoading(false);
  }, [typeFilter]);

  const resetTemplateForm = () => {
    setNewTemplate({
      name: '',
      type: 'quote',
      tradeType: 'general',
      defaults: {
        title: '',
        description: '',
        terms: '',
        depositPct: 0,
        gstEnabled: true,
      },
      defaultLineItems: []
    });
    setEditingTemplate(null);
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name.trim()) {
      showToast({ type: 'error', message: 'Template name is required' });
      return;
    }

    setIsCreatingTemplate(true);
    try {
      const authToken = await api.getToken();
      const method = editingTemplate ? 'PATCH' : 'POST';
      const url = editingTemplate 
        ? `${API_URL}/api/templates/${editingTemplate.id}`
        : `${API_URL}/api/templates`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: newTemplate.name,
          type: newTemplate.type,
          tradeType: newTemplate.tradeType,
          familyKey: newTemplate.tradeType,
          defaults: newTemplate.defaults,
          defaultLineItems: newTemplate.defaultLineItems.filter(item => item.description.trim()),
          styling: {},
          sections: {
            showHeader: true,
            showLineItems: true,
            showTotals: true,
            showTerms: true,
            showSignature: false,
          },
        }),
      });

      if (response.ok) {
        await loadTemplates();
        setShowCreateModal(false);
        resetTemplateForm();
        showToast({ type: 'success', message: editingTemplate ? 'Template updated successfully' : 'Template created successfully' });
      } else {
        const error = await response.text();
        showToast({ type: 'error', message: error || 'Failed to save template' });
      }
    } catch (error) {
      showToast({ type: 'error', message: 'Network error. Please try again.' });
    }
    setIsCreatingTemplate(false);
  };

  const handleEditTemplate = (template: DocumentTemplate) => {
    setEditingTemplate(template);
    setNewTemplate({
      name: template.name,
      type: template.type,
      tradeType: template.tradeType,
      defaults: {
        title: template.defaults?.title || '',
        description: template.defaults?.description || '',
        terms: template.defaults?.terms || '',
        depositPct: template.defaults?.depositPct || 0,
        gstEnabled: template.defaults?.gstEnabled ?? true,
      },
      defaultLineItems: template.defaultLineItems || [],
    });
    setShowCreateModal(true);
  };

  const handleDuplicateTemplate = async (template: DocumentTemplate) => {
    try {
      const authToken = await api.getToken();
      const response = await fetch(`${API_URL}/api/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          type: template.type,
          tradeType: template.tradeType,
          familyKey: template.familyKey,
          defaults: template.defaults,
          defaultLineItems: template.defaultLineItems,
          styling: template.styling,
          sections: template.sections,
        }),
      });

      if (response.ok) {
        await loadTemplates();
        showToast({ type: 'success', message: 'Template duplicated successfully' });
      } else {
        showToast({ type: 'error', message: 'Failed to duplicate template' });
      }
    } catch (error) {
      showToast({ type: 'error', message: 'Network error. Please try again.' });
    }
  };

  const handleDeleteTemplate = async (template: DocumentTemplate) => {
    const ok = await confirm({
      title: 'Delete Template',
      message: `Are you sure you want to delete "${template.name}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (ok) {
      try {
        const authToken = await api.getToken();
        const response = await fetch(`${API_URL}/api/templates/${template.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        });
        if (response.ok) {
          await loadTemplates();
          showToast({ type: 'success', message: 'Success', description: 'Template deleted' });
        }
      } catch (error) {
        showToast({ type: 'error', message: 'Error', description: 'Failed to delete template' });
      }
    }
  };

  const addLineItem = () => {
    setNewTemplate({
      ...newTemplate,
      defaultLineItems: [
        ...newTemplate.defaultLineItems,
        { description: '', qty: 1, unitPrice: 0, unit: 'each' }
      ]
    });
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const items = [...newTemplate.defaultLineItems];
    items[index] = { ...items[index], [field]: value };
    setNewTemplate({ ...newTemplate, defaultLineItems: items });
  };

  const removeLineItem = (index: number) => {
    const items = newTemplate.defaultLineItems.filter((_, i) => i !== index);
    setNewTemplate({ ...newTemplate, defaultLineItems: items });
  };

  const quoteTemplates = templates.filter(t => t.type === 'quote').length;
  const invoiceTemplates = templates.filter(t => t.type === 'invoice').length;
  const jobTemplates = templates.filter(t => t.type === 'job').length;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'quote': return colors.info;
      case 'invoice': return colors.success;
      case 'job': return colors.warning;
      default: return colors.primary;
    }
  };

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      refreshUser(),
      loadGeofenceSettings(), 
      loadNotificationSettings(),
      loadTemplates(),
      loadBusinessSettings(),
      loadUsageInfo(),
      loadAiSettings(),
    ]);
    setIsLoading(false);
  }, [refreshUser, loadGeofenceSettings, loadNotificationSettings, loadTemplates, loadBusinessSettings, loadUsageInfo, loadAiSettings]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (activeTab === 'templates') {
      loadTemplates();
    }
  }, [typeFilter, activeTab]);

  const currentPlan = (user?.subscriptionTier || 'free') as 'free' | 'pro' | 'team' | 'trial';

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: false,
        }} 
      />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: getBottomNavHeight(insets.bottom) + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refreshData}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Settings</Text>
              <Text style={styles.pageSubtitle}>Manage your business profile and preferences</Text>
            </View>
            {activeTab === 'payment' && (
              <TouchableOpacity 
                style={[styles.saveButton, paymentSaving && { opacity: 0.7 }]} 
                onPress={savePaymentSettings}
                disabled={paymentSaving}
                data-testid="button-save-settings"
              >
                <Text style={styles.saveButtonText}>{paymentSaving ? 'Saving...' : 'Save Changes'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {!isSubcontractor && (
            <TouchableOpacity 
              style={styles.subscriptionLink}
              onPress={() => router.push('/more/subscription')}
              data-testid="button-manage-subscription"
            >
              <View style={styles.subscriptionLinkContent}>
                <Feather name="award" size={20} color={colors.primary} />
                <View style={styles.subscriptionLinkText}>
                  <Text style={styles.subscriptionLinkTitle}>Business Plan</Text>
                  <Text style={styles.subscriptionLinkSubtitle}>View plan details and usage</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsContent}
          >
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                  data-testid={`tab-${tab.key}`}
                >
                  <Feather 
                    name={tab.icon as any}
                    size={16} 
                    color={isActive ? colors.primary : colors.mutedForeground} 
                  />
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {activeTab === 'account' && (
            <View style={styles.tabContentSection}>
              <GpsPrivacyCard />

              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="map-pin" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Geofence Settings</Text>
                </View>

                <View style={[styles.featureRow, { justifyContent: 'space-between' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                    <Feather name="target" size={16} color={colors.mutedForeground} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featureText}>Enable Geofence for New Jobs</Text>
                      <Text style={[styles.planDescription, { marginTop: 2 }]}>Auto-enable location tracking on new jobs</Text>
                    </View>
                  </View>
                  <Switch
                    value={geofenceEnabled}
                    onValueChange={handleGeofenceEnabledChange}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={'#FFFFFF'}
                    ios_backgroundColor={colors.border}
                    data-testid="switch-geofence-enabled"
                  />
                </View>

                {geofenceEnabled && (
                  <>
                    <View style={{ marginTop: spacing.lg }}>
                      <Text style={styles.settingsCardTitle}>Default Radius: {geofenceRadius}m</Text>
                      <Text style={[styles.planDescription, { marginTop: 2 }]}>
                        Distance from job site to trigger clock-in/out
                      </Text>
                      <Slider
                        value={geofenceRadius}
                        onValueChange={handleRadiusChange}
                        onSlidingComplete={handleRadiusChangeComplete}
                        minimumValue={50}
                        maximumValue={500}
                        step={10}
                        style={{ marginTop: spacing.md }}
                      />
                    </View>

                    <View style={[styles.featureRow, { justifyContent: 'space-between', marginTop: spacing.lg }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                        <Feather name="log-in" size={16} color={colors.mutedForeground} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.featureText}>Auto Clock-In</Text>
                          <Text style={[styles.planDescription, { marginTop: 2 }]}>Automatically start time when entering geofence</Text>
                        </View>
                      </View>
                      <Switch
                        value={autoClockIn}
                        onValueChange={handleAutoClockInChange}
                        trackColor={{ false: colors.border, true: colors.success }}
                        thumbColor={'#FFFFFF'}
                        ios_backgroundColor={colors.border}
                        data-testid="switch-auto-clock-in"
                      />
                    </View>

                    <View style={[styles.featureRow, { justifyContent: 'space-between' }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                        <Feather name="log-out" size={16} color={colors.mutedForeground} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.featureText}>Auto Clock-Out</Text>
                          <Text style={[styles.planDescription, { marginTop: 2 }]}>Automatically stop time when leaving geofence</Text>
                        </View>
                      </View>
                      <Switch
                        value={autoClockOut}
                        onValueChange={handleAutoClockOutChange}
                        trackColor={{ false: colors.border, true: colors.success }}
                        thumbColor={'#FFFFFF'}
                        ios_backgroundColor={colors.border}
                        data-testid="switch-auto-clock-out"
                      />
                    </View>
                  </>
                )}
              </View>

              <PressableRow 
                style={styles.settingsCard}
                onPress={() => router.push('/more/profile-edit')}
                data-testid="button-profile-settings"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="user" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Profile Settings</Text>
                    <Text style={styles.settingsCardSubtitle}>Manage your personal information</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </PressableRow>

              <PressableRow 
                style={styles.settingsCard}
                onPress={() => router.push('/more/my-color' as any)}
                data-testid="button-my-color"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="droplet" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>My Team Colour</Text>
                    <Text style={styles.settingsCardSubtitle}>Your colour across chat, scheduling & map</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </PressableRow>

              <PressableRow 
                style={styles.settingsCard}
                onPress={() => router.push('/more/app-settings')}
                data-testid="button-app-settings"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="settings" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>App Settings</Text>
                    <Text style={styles.settingsCardSubtitle}>Theme, display preferences & more</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </PressableRow>

              <View style={styles.subscriptionCard}>
                <TouchableOpacity
                  style={[styles.subscriptionHeader, { marginBottom: showPasswordSection ? spacing.md : 0 }]}
                  onPress={() => {
                    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
                      UIManager.setLayoutAnimationEnabledExperimental(true);
                    }
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setShowPasswordSection(!showPasswordSection);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                    <Feather name="lock" size={20} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingsCardTitle}>Security</Text>
                      <Text style={styles.settingsCardSubtitle}>
                        Change your account password
                      </Text>
                    </View>
                  </View>
                  <Feather name={showPasswordSection ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
                </TouchableOpacity>

                {showPasswordSection && (
                  <View>
                    <View style={{ height: 1, backgroundColor: colors.border, marginBottom: spacing.md }} />
                    <TextInput
                      style={styles.passwordInput}
                      value={passwordData.currentPassword}
                      onChangeText={(text) => setPasswordData(prev => ({ ...prev, currentPassword: text }))}
                      placeholder="Current password"
                      placeholderTextColor={colors.mutedForeground}
                      secureTextEntry
                    />
                    <TextInput
                      style={styles.passwordInput}
                      value={passwordData.newPassword}
                      onChangeText={(text) => setPasswordData(prev => ({ ...prev, newPassword: text }))}
                      placeholder="New password"
                      placeholderTextColor={colors.mutedForeground}
                      secureTextEntry
                    />
                    <TextInput
                      style={styles.passwordInput}
                      value={passwordData.confirmPassword}
                      onChangeText={(text) => setPasswordData(prev => ({ ...prev, confirmPassword: text }))}
                      placeholder="Confirm new password"
                      placeholderTextColor={colors.mutedForeground}
                      secureTextEntry
                    />
                    <TouchableOpacity
                      style={[styles.upgradeButton, passwordSaving && { opacity: 0.7 }]}
                      onPress={handleChangePassword}
                      disabled={passwordSaving}
                    >
                      <Text style={styles.upgradeButtonText}>
                        {passwordSaving ? 'Changing...' : 'Change Password'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {user?.hasDemoData && (
                <View style={[styles.subscriptionCard, { borderColor: colors.mutedForeground }]}>
                  <View style={styles.subscriptionHeader}>
                    <Feather name="database" size={20} color={colors.mutedForeground} />
                    <Text style={styles.subscriptionTitle}>Sample Data</Text>
                  </View>
                  <Text style={[styles.planDescription, { marginBottom: spacing.md }]}>
                    You have sample data loaded to help you explore the app. Clear it when you're ready to add your real business data.
                  </Text>
                  <PressableRow
                    style={[styles.settingsCard, { backgroundColor: colors.muted, borderColor: colors.destructive }]}
                    onPress={async () => {
                      const ok = await confirm({
                        title: 'Clear Sample Data?',
                        message: 'This will remove all sample clients, jobs, quotes, and invoices. Your real data won\'t be affected.',
                        confirmText: 'Clear Sample Data',
                        cancelText: 'Cancel',
                        destructive: true,
                      });
                      if (ok) {
                        setIsLoading(true);
                        try {
                          const response = await api.post<{ message?: string }>('/api/onboarding/clear-demo-data');
                          if (response.error) {
                            showToast({ type: 'error', message: 'Error', description: response.error });
                          } else {
                            await refreshUser();
                            showToast({ type: 'success', message: 'Done', description: response.data?.message || 'Sample data cleared successfully!' });
                          }
                        } catch (error: any) {
                          showToast({ type: 'error', message: 'Error', description: error.message || 'Failed to clear sample data' });
                        } finally {
                          setIsLoading(false);
                        }
                      }
                    }}
                    data-testid="button-clear-sample-data"
                  >
                    <View style={styles.settingsCardHeader}>
                      <Feather name="trash-2" size={20} color={colors.destructive} />
                      <View style={styles.settingsCardInfo}>
                        <Text style={[styles.settingsCardTitle, { color: colors.destructive }]}>Clear Sample Data</Text>
                        <Text style={styles.settingsCardSubtitle}>Remove all demo clients, jobs, quotes & invoices</Text>
                      </View>
                    </View>
                    {isLoading ? (
                      <ActivityIndicator size="small" color={colors.destructive} />
                    ) : (
                      <Feather name="chevron-right" size={18} color={colors.destructive} />
                    )}
                  </PressableRow>
                </View>
              )}
            </View>
          )}

          {activeTab === 'business' && (
            <View style={styles.tabContentSection}>
              {businessSettings && (
                <View style={styles.subscriptionCard}>
                  <View style={styles.subscriptionHeader}>
                    <Feather name="briefcase" size={20} color={colors.primary} />
                    <Text style={styles.subscriptionTitle}>Business Profile</Text>
                  </View>
                  <View style={styles.businessInfoRow}>
                    <Text style={styles.businessInfoLabel}>Business Name</Text>
                    <Text style={styles.businessInfoValue} numberOfLines={1}>{businessSettings.businessName || 'Not set'}</Text>
                  </View>
                  <View style={styles.businessInfoRow}>
                    <Text style={styles.businessInfoLabel}>ABN</Text>
                    <Text style={styles.businessInfoValue}>{businessSettings.abn || 'Not set'}</Text>
                  </View>
                  <View style={styles.businessInfoRow}>
                    <Text style={styles.businessInfoLabel}>Phone</Text>
                    <Text style={styles.businessInfoValue}>{businessSettings.phone || 'Not set'}</Text>
                  </View>
                  <View style={styles.businessInfoRow}>
                    <Text style={styles.businessInfoLabel}>Email</Text>
                    <Text style={styles.businessInfoValue} numberOfLines={1}>{businessSettings.email || 'Not set'}</Text>
                  </View>
                  <View style={[styles.businessInfoRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.businessInfoLabel}>Trade Type</Text>
                    <Text style={[styles.businessInfoValue, { textTransform: 'capitalize' }]}>{businessSettings.tradeType || 'General'}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.upgradeButton, { marginTop: spacing.md }]}
                    onPress={() => router.push('/more/business-settings')}
                  >
                    <Text style={styles.upgradeButtonText}>Edit Business Details</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="toggle-right" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>GST Registration</Text>
                </View>
                <View style={[styles.featureRow, { justifyContent: 'space-between' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featureText}>Include GST on Documents</Text>
                      <Text style={[styles.planDescription, { marginTop: 2 }]}>Apply 10% GST to quotes and invoices</Text>
                    </View>
                  </View>
                  <Switch
                    value={businessSettings?.gstEnabled || false}
                    onValueChange={async (value) => {
                      try {
                        await api.patch('/api/business-settings', { gstEnabled: value });
                        setBusinessSettings((prev: any) => prev ? { ...prev, gstEnabled: value } : prev);
                        showToast({ type: 'success', message: `GST ${value ? 'enabled' : 'disabled'} on documents` });
                      } catch (e) {
                        showToast({ type: 'error', message: 'Failed to update GST setting' });
                      }
                    }}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={'#FFFFFF'}
                    ios_backgroundColor={colors.border}
                  />
                </View>
              </View>

              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="phone" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Business SMS Number</Text>
                </View>
                {businessSettings?.dedicatedPhoneNumber ? (
                  <PressableRow 
                    style={styles.businessInfoRow}
                    onPress={() => router.push(asHref('/more/phone-numbers'))}

                  >
                    <Text style={styles.businessInfoLabel}>Active Number</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      <Text style={[styles.businessInfoValue, { color: colors.success, fontWeight: '600' }]}>{businessSettings.dedicatedPhoneNumber}</Text>
                      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                    </View>
                  </PressableRow>
                ) : (
                  <>
                    <Text style={[styles.planDescription, { marginBottom: spacing.sm }]}>
                      Get a dedicated Australian phone number for two-way SMS with clients and AI Receptionist calls.
                    </Text>
                    <TouchableOpacity
                      style={[styles.upgradeButton, { marginTop: 0 }]}
                      onPress={() => router.push(asHref('/more/phone-numbers'))}
                    >
                      <Text style={styles.upgradeButtonText}>Get a Phone Number</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              <PressableRow 
                style={styles.settingsCard}
                onPress={() => router.push('/more/branding')}
                data-testid="button-branding-settings"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="droplet" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Branding & Colours</Text>
                    <Text style={styles.settingsCardSubtitle}>Logo, theme colour, document prefixes</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </PressableRow>


              {businessSettings?.simpleMode !== undefined && (
                <View style={styles.subscriptionCard}>
                  <View style={styles.subscriptionHeader}>
                    <Feather name="sliders" size={20} color={colors.primary} />
                    <Text style={styles.subscriptionTitle}>Simple Mode</Text>
                  </View>
                  <View style={[styles.featureRow, { justifyContent: 'space-between' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.featureText}>Solo Operator Mode</Text>
                        <Text style={[styles.planDescription, { marginTop: 2 }]}>Hide team management and dispatch for simpler workflow</Text>
                      </View>
                    </View>
                    <Switch
                      value={businessSettings?.simpleMode || false}
                      onValueChange={async (value) => {
                        try {
                          await api.patch('/api/business-settings', { simpleMode: value });
                          setBusinessSettings((prev: any) => prev ? { ...prev, simpleMode: value } : prev);
                          showToast({ type: 'success', message: `Solo Operator Mode ${value ? 'enabled' : 'disabled'}` });
                        } catch (e) {
                          showToast({ type: 'error', message: 'Failed to update mode' });
                        }
                      }}
                      trackColor={{ false: colors.border, true: colors.success }}
                      thumbColor={'#FFFFFF'}
                      ios_backgroundColor={colors.border}
                    />
                  </View>
                </View>
              )}
            </View>
          )}

          {activeTab === 'payment' && (
            <View style={styles.tabContentSection}>
              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="dollar-sign" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Rates & Defaults</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Default Hourly Rate ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={paymentData.defaultHourlyRate}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                      setPaymentData(prev => ({ ...prev, defaultHourlyRate: cleaned }));
                    }}
                    placeholder="100"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Callout Fee ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={paymentData.calloutFee}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                      setPaymentData(prev => ({ ...prev, calloutFee: cleaned }));
                    }}
                    placeholder="80"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={[styles.featureRow, { justifyContent: 'space-between' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featureText}>Bill for breaks</Text>
                      <Text style={[styles.planDescription, { marginTop: 2 }]}>Include break time as billable labour on invoices. Does not change worker pay.</Text>
                    </View>
                  </View>
                  <Switch
                    value={businessSettings?.billBreaks || false}
                    onValueChange={async (value) => {
                      try {
                        await api.patch('/api/business-settings', { billBreaks: value });
                        setBusinessSettings((prev: any) => prev ? { ...prev, billBreaks: value } : prev);
                        showToast({ type: 'success', message: `Breaks ${value ? 'will' : 'will not'} be billed on invoices` });
                      } catch (e) {
                        showToast({ type: 'error', message: 'Failed to update break billing setting' });
                      }
                    }}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Quote Validity (days)</Text>
                  <TextInput
                    style={styles.input}
                    value={String(paymentData.quoteValidityDays)}
                    onChangeText={(text) => setPaymentData(prev => ({ ...prev, quoteValidityDays: parseInt(text) || 30 }))}
                    placeholder="30"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Payment Terms (days)</Text>
                  <TextInput
                    style={styles.input}
                    value={String(paymentData.defaultPaymentTermsDays)}
                    onChangeText={(text) => setPaymentData(prev => ({ ...prev, defaultPaymentTermsDays: parseInt(text) || 14 }))}
                    placeholder="14"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Late Fee Rate</Text>
                  <TextInput
                    style={styles.input}
                    value={paymentData.lateFeeRate}
                    onChangeText={(text) => setPaymentData(prev => ({ ...prev, lateFeeRate: text }))}
                    placeholder="1.5% per month"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                  <Text style={styles.inputLabel}>Warranty Period</Text>
                  <TextInput
                    style={styles.input}
                    value={paymentData.warrantyPeriod}
                    onChangeText={(text) => setPaymentData(prev => ({ ...prev, warrantyPeriod: text }))}
                    placeholder="12 months"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              </View>

              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="users" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Worker Pay Rates</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Default Worker Hourly Rate ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={paymentData.workerHourlyRate}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                      setPaymentData(prev => ({ ...prev, workerHourlyRate: cleaned }));
                    }}
                    placeholder="45.00"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Overtime Rate ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={paymentData.workerOvertimeRate}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                      setPaymentData(prev => ({ ...prev, workerOvertimeRate: cleaned }));
                    }}
                    placeholder="67.50"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                  <Text style={styles.inputLabel}>Weekend / Public Holiday Rate ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={paymentData.workerWeekendRate}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                      setPaymentData(prev => ({ ...prev, workerWeekendRate: cleaned }));
                    }}
                    placeholder="90.00"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="credit-card" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Bank & Payment Details</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Bank Details (BSB, Acc No, Acc Name)</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    value={paymentData.bankDetails}
                    onChangeText={(text) => setPaymentData(prev => ({ ...prev, bankDetails: text }))}
                    placeholder="BSB: 000-000&#10;Account: 12345678&#10;Name: Your Business"
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                  <Text style={styles.inputLabel}>Payment Instructions</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    value={paymentData.paymentInstructions}
                    onChangeText={(text) => setPaymentData(prev => ({ ...prev, paymentInstructions: text }))}
                    placeholder="Additional payment instructions for clients..."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="file-text" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Default Terms</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Quote Terms & Conditions</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline, { minHeight: 100 }]}
                    value={paymentData.quoteTerms}
                    onChangeText={(text) => setPaymentData(prev => ({ ...prev, quoteTerms: text }))}
                    placeholder="Default terms for your quotes..."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                  <Text style={styles.inputLabel}>Invoice Terms & Conditions</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline, { minHeight: 100 }]}
                    value={paymentData.invoiceTerms}
                    onChangeText={(text) => setPaymentData(prev => ({ ...prev, invoiceTerms: text }))}
                    placeholder="Default terms for your invoices..."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.upgradeButton, paymentSaving && { opacity: 0.7 }]}
                onPress={savePaymentSettings}
                disabled={paymentSaving}
                data-testid="button-save-payment"
              >
                <Text style={styles.upgradeButtonText}>
                  {paymentSaving ? 'Saving...' : 'Save Payment Settings'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {activeTab === 'templates' && (
            <View style={styles.tabContentSection}>
              <TouchableOpacity
                style={styles.createTemplateButton}
                onPress={() => {
                  resetTemplateForm();
                  setShowCreateModal(true);
                }}
                data-testid="button-create-template"
              >
                <Feather name="plus" size={18} color={colors.primaryForeground} />
                <Text style={styles.createTemplateButtonText}>Create New Template</Text>
              </TouchableOpacity>

              <View style={styles.templateStatsRow}>
                <View style={styles.templateStatCard}>
                  <Text style={styles.templateStatValue}>{quoteTemplates}</Text>
                  <Text style={styles.templateStatLabel}>Quotes</Text>
                </View>
                <View style={styles.templateStatCard}>
                  <Text style={styles.templateStatValue}>{invoiceTemplates}</Text>
                  <Text style={styles.templateStatLabel}>Invoices</Text>
                </View>
                <View style={styles.templateStatCard}>
                  <Text style={styles.templateStatValue}>{jobTemplates}</Text>
                  <Text style={styles.templateStatLabel}>Jobs</Text>
                </View>
              </View>

              <View style={styles.filtersRow}>
                {(['all', 'quote', 'invoice', 'job'] as const).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.filterChip,
                      typeFilter === type && styles.filterChipActive
                    ]}
                    onPress={() => setTypeFilter(type)}
                    data-testid={`filter-${type}`}
                  >
                    <Text style={[
                      styles.filterChipText,
                      typeFilter === type && styles.filterChipTextActive
                    ]}>
                      {type === 'all' ? 'All Types' : type + 's'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {templatesLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : templates.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <Feather name="file-text" size={48} color={colors.mutedForeground} />
                  </View>
                  <Text style={styles.emptyTitle}>No templates yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Create templates to speed up creating quotes, invoices, and jobs
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => {
                      resetTemplateForm();
                      setShowCreateModal(true);
                    }}
                  >
                    <Feather name="plus" size={18} color={colors.primary} />
                    <Text style={styles.emptyButtonText}>Create First Template</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.templateList}>
                  {templates.map(template => (
                    <View key={template.id} style={styles.templateCard}>
                      <View style={styles.templateHeader}>
                        <View style={styles.templateInfo}>
                          <Text style={styles.templateName}>{template.name}</Text>
                          <View style={styles.templateMeta}>
                            <Text style={[styles.templateType, { backgroundColor: getTypeColor(template.type) + '20', color: getTypeColor(template.type) }]}>
                              {template.type}
                            </Text>
                            <Text style={styles.templateTrade}>{template.tradeType}</Text>
                          </View>
                        </View>
                        <View style={styles.templateActions}>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleEditTemplate(template)}
                            data-testid={`button-edit-template-${template.id}`}
                          >
                            <Feather name="edit-2" size={18} color={colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleDuplicateTemplate(template)}
                            data-testid={`button-duplicate-template-${template.id}`}
                          >
                            <Feather name="copy" size={18} color={colors.mutedForeground} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleDeleteTemplate(template)}
                            data-testid={`button-delete-template-${template.id}`}
                          >
                            <Feather name="trash-2" size={18} color={colors.destructive} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      
                      <View style={styles.templateDetails}>
                        {template.defaults?.title && (
                          <Text style={styles.templateTitle} numberOfLines={1}>
                            {template.defaults.title}
                          </Text>
                        )}
                        
                        <View style={styles.badgeRow}>
                          {template.defaultLineItems?.length > 0 && (
                            <Text style={styles.badge}>
                              {template.defaultLineItems.length} line items
                            </Text>
                          )}
                          {(template.defaults?.depositPct ?? 0) > 0 && (
                            <Text style={styles.badge}>
                              {template.defaults.depositPct}% deposit
                            </Text>
                          )}
                          {template.defaults?.gstEnabled && (
                            <Text style={styles.badge}>GST</Text>
                          )}
                        </View>

                        {template.defaults?.terms && (
                          <Text style={styles.templateTerms} numberOfLines={2}>
                            {template.defaults.terms}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {activeTab === 'alerts' && (
            <View style={styles.tabContentSection}>
              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="smartphone" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Push Notifications</Text>
                </View>

                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: colors.primaryLight }]}>
                      <Feather name="briefcase" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>New Job Assignments</Text>
                      <Text style={styles.notificationToggleSubtitle}>Get notified when assigned to a job</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.push.newJobAssignments}
                    onValueChange={(value) => updatePushSetting('newJobAssignments', value)}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={'#FFFFFF'}
                    ios_backgroundColor={colors.border}
                    data-testid="switch-push-new-job"
                  />
                </View>

                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: colors.primaryLight }]}>
                      <Feather name="refresh-cw" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Job Status Changes</Text>
                      <Text style={styles.notificationToggleSubtitle}>Updates when job status changes</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.push.jobStatusChanges}
                    onValueChange={(value) => updatePushSetting('jobStatusChanges', value)}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={'#FFFFFF'}
                    ios_backgroundColor={colors.border}
                    data-testid="switch-push-job-status"
                  />
                </View>

                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#22c55e20' }]}>
                      <Feather name="dollar-sign" size={16} color="#22c55e" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Payment Received</Text>
                      <Text style={styles.notificationToggleSubtitle}>Alert when a payment is received</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.push.paymentReceived}
                    onValueChange={(value) => updatePushSetting('paymentReceived', value)}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={'#FFFFFF'}
                    ios_backgroundColor={colors.border}
                    data-testid="switch-push-payment"
                  />
                </View>

                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#f59e0b20' }]}>
                      <Feather name="check-circle" size={16} color="#f59e0b" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Quote Accepted</Text>
                      <Text style={styles.notificationToggleSubtitle}>Notify when client accepts a quote</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.push.quoteAccepted}
                    onValueChange={(value) => updatePushSetting('quoteAccepted', value)}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={'#FFFFFF'}
                    ios_backgroundColor={colors.border}
                    data-testid="switch-push-quote"
                  />
                </View>

                <View style={[styles.notificationToggleRow, styles.notificationToggleRowLast]}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#8b5cf620' }]}>
                      <Feather name="message-circle" size={16} color="#8b5cf6" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Team Messages</Text>
                      <Text style={styles.notificationToggleSubtitle}>Notifications for team chat messages</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.push.teamMessages}
                    onValueChange={(value) => updatePushSetting('teamMessages', value)}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={'#FFFFFF'}
                    ios_backgroundColor={colors.border}
                    data-testid="switch-push-team"
                  />
                </View>
              </View>

              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="mail" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Email Notifications</Text>
                </View>

                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: colors.primaryLight }]}>
                      <Feather name="sun" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Daily Digest</Text>
                      <Text style={styles.notificationToggleSubtitle}>Daily summary of activity</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.email.dailyDigest}
                    onValueChange={(value) => updateEmailSetting('dailyDigest', value)}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={'#FFFFFF'}
                    ios_backgroundColor={colors.border}
                    data-testid="switch-email-daily"
                  />
                </View>

                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: colors.primaryLight }]}>
                      <Feather name="calendar" size={16} color={colors.primary} />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Weekly Summary</Text>
                      <Text style={styles.notificationToggleSubtitle}>Weekly business overview email</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.email.weeklySummary}
                    onValueChange={(value) => updateEmailSetting('weeklySummary', value)}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={'#FFFFFF'}
                    ios_backgroundColor={colors.border}
                    data-testid="switch-email-weekly"
                  />
                </View>

                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#22c55e20' }]}>
                      <Feather name="file-text" size={16} color="#22c55e" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Payment Receipts</Text>
                      <Text style={styles.notificationToggleSubtitle}>Email receipt when payment received</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.email.paymentReceipts}
                    onValueChange={(value) => updateEmailSetting('paymentReceipts', value)}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={'#FFFFFF'}
                    ios_backgroundColor={colors.border}
                    data-testid="switch-email-receipts"
                  />
                </View>

                <View style={[styles.notificationToggleRow, styles.notificationToggleRowLast]}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#ef444420' }]}>
                      <Feather name="alert-circle" size={16} color="#ef4444" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Overdue Reminders</Text>
                      <Text style={styles.notificationToggleSubtitle}>Reminders for overdue invoices</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.email.overdueReminders}
                    onValueChange={(value) => updateEmailSetting('overdueReminders', value)}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={'#FFFFFF'}
                    ios_backgroundColor={colors.border}
                    data-testid="switch-email-overdue"
                  />
                </View>
              </View>

              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="message-square" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>SMS Notifications</Text>
                </View>

                <View style={styles.notificationToggleRow}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#ef444420' }]}>
                      <Feather name="alert-triangle" size={16} color="#ef4444" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Urgent Job Alerts</Text>
                      <Text style={styles.notificationToggleSubtitle}>SMS for urgent job notifications</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.sms.urgentJobAlerts}
                    onValueChange={(value) => updateSmsSetting('urgentJobAlerts', value)}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={'#FFFFFF'}
                    ios_backgroundColor={colors.border}
                    data-testid="switch-sms-urgent"
                  />
                </View>

                <View style={[styles.notificationToggleRow, styles.notificationToggleRowLast]}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#22c55e20' }]}>
                      <Feather name="check-square" size={16} color="#22c55e" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>Payment Confirmations</Text>
                      <Text style={styles.notificationToggleSubtitle}>SMS when payments are confirmed</Text>
                    </View>
                  </View>
                  <Switch
                    value={notificationSettings.sms.paymentConfirmations}
                    onValueChange={(value) => updateSmsSetting('paymentConfirmations', value)}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={'#FFFFFF'}
                    ios_backgroundColor={colors.border}
                    data-testid="switch-sms-payment"
                  />
                </View>
              </View>

              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="cpu" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>AI Features</Text>
                </View>

                {!aiTierAllowed && (
                  <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f59e0b10', borderRadius: 8, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Feather name="lock" size={14} color="#b45309" />
                    <Text style={{ flex: 1, fontSize: 12, color: '#b45309' }}>
                      AI features require Pro, Trial, or Team. Upgrade to enable.
                    </Text>
                  </View>
                )}

                <View style={[styles.notificationToggleRow, !aiTierAllowed && { opacity: 0.5 }]}>
                  <View style={styles.notificationToggleLeft}>
                    <View style={[styles.notificationToggleIcon, { backgroundColor: '#8b5cf620' }]}>
                      <Feather name="zap" size={16} color="#8b5cf6" />
                    </View>
                    <View style={styles.notificationToggleInfo}>
                      <Text style={styles.notificationToggleTitle}>AI Features</Text>
                      <Text style={styles.notificationToggleSubtitle}>Master toggle for all AI capabilities</Text>
                    </View>
                  </View>
                  <Switch
                    value={aiSettings.aiEnabled}
                    onValueChange={(value) => updateAiSetting('aiEnabled', value)}
                    disabled={!aiTierAllowed}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={'#FFFFFF'}
                    ios_backgroundColor={colors.border}
                  />
                </View>

                {aiSettings.aiEnabled && (
                  <>
                    <View style={styles.notificationToggleRow}>
                      <View style={styles.notificationToggleLeft}>
                        <View style={[styles.notificationToggleIcon, { backgroundColor: '#8b5cf620' }]}>
                          <Feather name="camera" size={16} color="#8b5cf6" />
                        </View>
                        <View style={styles.notificationToggleInfo}>
                          <Text style={styles.notificationToggleTitle}>AI Photo Analysis</Text>
                          <Text style={styles.notificationToggleSubtitle}>Analyse job site photos for insights</Text>
                        </View>
                      </View>
                      <Switch
                        value={aiSettings.aiPhotoAnalysis}
                        onValueChange={(value) => updateAiSetting('aiPhotoAnalysis', value)}
                        trackColor={{ false: colors.border, true: colors.success }}
                        thumbColor={'#FFFFFF'}
                        ios_backgroundColor={colors.border}
                      />
                    </View>

                    <View style={styles.notificationToggleRow}>
                      <View style={styles.notificationToggleLeft}>
                        <View style={[styles.notificationToggleIcon, { backgroundColor: '#8b5cf620' }]}>
                          <Feather name="tag" size={16} color="#8b5cf6" />
                        </View>
                        <View style={styles.notificationToggleInfo}>
                          <Text style={styles.notificationToggleTitle}>Auto-Categorise Photos</Text>
                          <Text style={styles.notificationToggleSubtitle}>Automatically tag and sort uploaded photos</Text>
                        </View>
                      </View>
                      <Switch
                        value={aiSettings.aiAutoCategorizephotos}
                        onValueChange={(value) => updateAiSetting('aiAutoCategorizephotos', value)}
                        trackColor={{ false: colors.border, true: colors.success }}
                        thumbColor={'#FFFFFF'}
                        ios_backgroundColor={colors.border}
                      />
                    </View>

                    <View style={[styles.notificationToggleRow, styles.notificationToggleRowLast]}>
                      <View style={styles.notificationToggleLeft}>
                        <View style={[styles.notificationToggleIcon, { backgroundColor: '#8b5cf620' }]}>
                          <Feather name="edit-3" size={16} color="#8b5cf6" />
                        </View>
                        <View style={styles.notificationToggleInfo}>
                          <Text style={styles.notificationToggleTitle}>AI Suggestions</Text>
                          <Text style={styles.notificationToggleSubtitle}>Smart suggestions for quotes, invoices & follow-ups</Text>
                        </View>
                      </View>
                      <Switch
                        value={aiSettings.aiSuggestions}
                        onValueChange={(value) => updateAiSetting('aiSuggestions', value)}
                        trackColor={{ false: colors.border, true: colors.success }}
                        thumbColor={'#FFFFFF'}
                        ios_backgroundColor={colors.border}
                      />
                    </View>
                  </>
                )}
              </View>

              <PressableRow 
                style={styles.settingsCard}
                onPress={() => router.push('/more/notifications')}
                data-testid="button-notification-settings"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="settings" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Advanced Settings</Text>
                    <Text style={styles.settingsCardSubtitle}>Manage device permissions and inbox</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </PressableRow>

              <View style={styles.settingsInfoCard}>
                <Text style={styles.settingsInfoTitle}>Stay Informed</Text>
                <Text style={styles.settingsInfoText}>
                  Configure how and when you receive notifications about jobs, payments, and team activity. SMS notifications may incur additional charges.
                </Text>
              </View>
            </View>
          )}

          {activeTab === 'plan' && (
            <View style={styles.planSection}>
              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="award" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Your Subscription</Text>
                </View>

                <View style={styles.planInfo}>
                  <View style={styles.planBadge}>
                    <View style={styles.planIconContainer}>
                      <Feather 
                        name={currentPlan === 'team' ? 'users' : currentPlan === 'pro' || currentPlan === 'trial' ? 'star' : 'user'} 
                        size={22} 
                        color={colors.primary} 
                      />
                    </View>
                    <View>
                      <Text style={styles.planName}>
                        {currentPlan === 'team' ? 'Team Plan' : currentPlan === 'pro' ? 'Pro Plan' : currentPlan === 'trial' ? 'Pro Trial' : 'Starter Plan'}
                      </Text>
                      <Text style={styles.planDescription}>
                        {currentPlan === 'team' ? 'Full team management features' : currentPlan === 'pro' || currentPlan === 'trial' ? 'Full access to all features' : 'Core business features'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.planPriceBadge}>
                    <Text style={styles.planPriceText}>
                      {currentPlan === 'team' ? 'Team' : currentPlan === 'pro' ? 'Pro' : currentPlan === 'trial' ? 'Trial' : 'Starter'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.proFeaturesTitle}>PRO FEATURES</Text>

                {PLAN_FEATURES.map((feature, index) => {
                  const isPaidPlan = currentPlan === 'pro' || currentPlan === 'team' || currentPlan === 'trial';
                  return (
                    <View key={index} style={styles.featureRow}>
                      <Feather 
                        name={feature.icon as any} 
                        size={18} 
                        color={isPaidPlan ? colors.primary : colors.mutedForeground} 
                      />
                      <Text style={[
                        styles.featureText,
                        !isPaidPlan && { color: colors.mutedForeground }
                      ]}>
                        {feature.text}
                      </Text>
                      {feature.pro && !isPaidPlan && (
                        <View style={styles.proBadge}>
                          <Text style={styles.proBadgeText}>PRO</Text>
                        </View>
                      )}
                      {isPaidPlan && (
                        <Feather name="check" size={18} color={colors.primary} />
                      )}
                    </View>
                  );
                })}

                {(currentPlan === 'pro' || currentPlan === 'team') && (
                  <TouchableOpacity 
                    style={styles.manageBillingButton}
                    onPress={() => router.push('/more/subscription')}
                  >
                    <Feather name="settings" size={16} color={colors.foreground} />
                    <Text style={styles.manageBillingText}>Manage Billing</Text>
                  </TouchableOpacity>
                )}
              </View>

              {usageInfo && (
                <View style={styles.subscriptionCard}>
                  <View style={styles.subscriptionHeader}>
                    <Feather name="bar-chart-2" size={20} color={colors.primary} />
                    <Text style={styles.subscriptionTitle}>Usage</Text>
                  </View>
                  <Text style={[styles.planDescription, { marginBottom: spacing.lg }]}>
                    {usageInfo.isUnlimited ? 'Unlimited usage with your current plan' : 'Track your usage against plan limits'}
                  </Text>
                  {[
                    { label: 'Jobs', data: usageInfo.jobs },
                    { label: 'Quotes', data: usageInfo.quotes },
                    { label: 'Invoices', data: usageInfo.invoices },
                    { label: 'Clients', data: usageInfo.clients },
                    { label: 'Templates', data: usageInfo.templates },
                  ].map((item) => {
                    if (!item.data) return null;
                    const isUnlimited = item.data.limit === -1;
                    const percentage = isUnlimited ? 0 : Math.min((item.data.used / item.data.limit) * 100, 100);
                    const isNearLimit = !isUnlimited && percentage >= 80;
                    const isAtLimit = !isUnlimited && item.data.used >= item.data.limit;
                    return (
                      <View key={item.label} style={styles.usageBarContainer}>
                        <View style={styles.usageBarLabel}>
                          <Text style={styles.usageBarLabelText}>{item.label}</Text>
                          <Text style={[styles.usageBarValueText, isAtLimit && { color: '#ef4444', fontWeight: '600' }]}>
                            {item.data.used} / {isUnlimited ? '\u221E' : item.data.limit}
                          </Text>
                        </View>
                        <View style={styles.usageBarTrack}>
                          <View 
                            style={[
                              styles.usageBarFill,
                              { 
                                width: isUnlimited ? '0%' : `${percentage}%`,
                                backgroundColor: isAtLimit ? '#ef4444' : isNearLimit ? '#f59e0b' : '#22c55e',
                              },
                            ]} 
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {activeTab === 'help' && (
            <View style={styles.tabContentSection}>
              <PressableRow 
                style={[styles.settingsCard, { borderColor: colors.primary, borderWidth: 2 }]}
                onPress={() => setShowTour(true)}
                data-testid="button-start-tour"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="compass" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Start App Tour</Text>
                    <Text style={styles.settingsCardSubtitle}>Quick walkthrough of the app</Text>
                  </View>
                </View>
                <Feather name="play-circle" size={18} color={colors.primary} />
              </PressableRow>

              {Platform.OS === 'ios' && (
                <>
                  <Text style={styles.sectionLabel}>TAP TO PAY ON IPHONE</Text>

                  <PressableRow
                    style={styles.settingsCard}
                    onPress={() => router.push('/more/tap-to-pay-setup')}
                    data-testid="row-tap-to-pay-setup"
                  >
                    <View style={styles.settingsCardHeader}>
                      <Feather name="radio" size={20} color={colors.primary} />
                      <View style={styles.settingsCardInfo}>
                        <Text style={styles.settingsCardTitle}>Set Up Tap to Pay on iPhone</Text>
                        <Text style={styles.settingsCardSubtitle}>Accept contactless cards and Apple Pay right on your iPhone. No extra hardware needed.</Text>
                      </View>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  </PressableRow>

                  <PressableRow
                    style={styles.settingsCard}
                    onPress={() => router.push('/more/tap-to-pay-setup?mode=education')}
                    data-testid="row-tap-to-pay-guide"
                  >
                    <View style={styles.settingsCardHeader}>
                      <Feather name="book-open" size={20} color={colors.primary} />
                      <View style={styles.settingsCardInfo}>
                        <Text style={styles.settingsCardTitle}>How to Accept Payments</Text>
                        <Text style={styles.settingsCardSubtitle}>Learn how to take contactless cards, Apple Pay, and other digital wallets with Tap to Pay on iPhone.</Text>
                      </View>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  </PressableRow>
                </>
              )}

              <Text style={styles.sectionLabel}>SUPPORT</Text>

              <PressableRow 
                style={[styles.settingsCard, { borderColor: colors.destructive, borderWidth: 1 }]}
                onPress={() => router.push('/more/report-bug')}
                data-testid="button-report-bug"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="alert-circle" size={20} color={colors.destructive} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Report a Bug</Text>
                    <Text style={styles.settingsCardSubtitle}>Something not working? Let us know!</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </PressableRow>

              <PressableRow 
                style={styles.settingsCard}
                onPress={() => Linking.openURL('mailto:admin@avwebinnovation.com')}
                data-testid="button-contact-support"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="mail" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Contact Support</Text>
                    <Text style={styles.settingsCardSubtitle}>admin@avwebinnovation.com</Text>
                  </View>
                </View>
                <Feather name="external-link" size={18} color={colors.mutedForeground} />
              </PressableRow>

              <PressableRow 
                style={styles.settingsCard}
                onPress={() => router.push('/more/support')}
                data-testid="button-help-centre"
              >
                <View style={styles.settingsCardHeader}>
                  <Feather name="help-circle" size={20} color={colors.primary} />
                  <View style={styles.settingsCardInfo}>
                    <Text style={styles.settingsCardTitle}>Help & FAQs</Text>
                    <Text style={styles.settingsCardSubtitle}>Browse support articles</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </PressableRow>

              <Text style={styles.sectionLabel}>DATA EXPORT</Text>

              <View style={styles.subscriptionCard}>
                <View style={styles.subscriptionHeader}>
                  <Feather name="download" size={20} color={colors.primary} />
                  <Text style={styles.subscriptionTitle}>Export Your Data</Text>
                </View>
                <Text style={[styles.planDescription, { marginBottom: spacing.md }]}>
                  Download your business data as CSV files for accounting or backup purposes.
                </Text>

                {[
                  { key: 'clients', label: 'Clients', description: 'Names, contact details, addresses', icon: 'users' },
                  { key: 'jobs', label: 'Jobs', description: 'Job titles, statuses, addresses, dates', icon: 'briefcase' },
                  { key: 'quotes', label: 'Quotes', description: 'Quote numbers, amounts, GST, statuses', icon: 'file-text' },
                  { key: 'invoices', label: 'Invoices', description: 'Invoice numbers, amounts, payment status', icon: 'file' },
                  { key: 'time-entries', label: 'Time Entries', description: 'Hours, rates, jobs, billing status', icon: 'clock' },
                ].map((item) => (
                  <View key={item.key} style={styles.exportRow}>
                    <View style={styles.exportRowLeft}>
                      <View style={styles.exportIconContainer}>
                        <Feather name={item.icon as any} size={16} color={colors.mutedForeground} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.settingsCardTitle}>{item.label}</Text>
                        <Text style={[styles.settingsCardSubtitle, { marginTop: 1 }]}>{item.description}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.exportButton}
                      onPress={() => handleExport(item.key)}
                      disabled={exportingKey === item.key}
                    >
                      {exportingKey === item.key ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <Feather name="download" size={14} color={colors.primary} />
                          <Text style={styles.exportButtonText}>CSV</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={styles.settingsInfoCard}>
                <Text style={styles.settingsInfoTitle}>Need Help?</Text>
                <Text style={styles.settingsInfoText}>
                  Our support team is available Monday to Friday, 9am-5pm AEST. We typically respond within 24 hours.
                </Text>
              </View>

              <View style={[styles.settingsInfoCard, { marginTop: spacing.sm }]}>
                <Text style={styles.settingsInfoTitle}>Data Responsibility</Text>
                <Text style={styles.settingsInfoText}>
                  We recommend exporting your data at least monthly as a backup. Exported CSV files can be opened in Excel, Google Sheets, or any spreadsheet application.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        <Modal
          visible={showCreateModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            setShowCreateModal(false);
            resetTemplateForm();
          }}
        >
          <View style={[styles.modalContainer, { paddingBottom: insets.bottom }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                onPress={() => {
                  setShowCreateModal(false);
                  resetTemplateForm();
                }} 
              >
                <Feather name="x" size={24} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Template Name</Text>
                <TextInput
                  style={styles.input}
                  value={newTemplate.name}
                  onChangeText={(text) => setNewTemplate({ ...newTemplate, name: text })}
                  placeholder="e.g., Standard Plumbing Quote"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Template Type</Text>
                <View style={styles.typeButtons}>
                  {(['quote', 'invoice', 'job'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        newTemplate.type === type && styles.typeButtonActive
                      ]}
                      onPress={() => setNewTemplate({ ...newTemplate, type })}
                    >
                      <Text style={[
                        styles.typeButtonText,
                        newTemplate.type === type && styles.typeButtonTextActive
                      ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Trade Type</Text>
                <View style={styles.tradeTypeContainer}>
                  {tradeTypes.map((trade) => (
                    <TouchableOpacity
                      key={trade}
                      style={[
                        styles.tradeChip,
                        newTemplate.tradeType === trade && styles.tradeChipActive
                      ]}
                      onPress={() => setNewTemplate({ ...newTemplate, tradeType: trade })}
                    >
                      <Text style={[
                        styles.tradeChipText,
                        newTemplate.tradeType === trade && styles.tradeChipTextActive
                      ]}>
                        {trade}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Text style={styles.sectionHeader}>Default Values</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Default Title</Text>
                <TextInput
                  style={styles.input}
                  value={newTemplate.defaults.title}
                  onChangeText={(text) => setNewTemplate({ 
                    ...newTemplate, 
                    defaults: { ...newTemplate.defaults, title: text } 
                  })}
                  placeholder="e.g., Plumbing Service Quote"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Default Description</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={newTemplate.defaults.description}
                  onChangeText={(text) => setNewTemplate({ 
                    ...newTemplate, 
                    defaults: { ...newTemplate.defaults, description: text } 
                  })}
                  placeholder="Brief description..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Default Terms</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={newTemplate.defaults.terms}
                  onChangeText={(text) => setNewTemplate({ 
                    ...newTemplate, 
                    defaults: { ...newTemplate.defaults, terms: text } 
                  })}
                  placeholder="Payment terms, conditions..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Default Deposit (%)</Text>
                <TextInput
                  style={[styles.input, { width: 100 }]}
                  value={String(newTemplate.defaults.depositPct || '')}
                  onChangeText={(text) => setNewTemplate({ 
                    ...newTemplate, 
                    defaults: { ...newTemplate.defaults, depositPct: parseInt(text) || 0 } 
                  })}
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                />
              </View>

              <Text style={styles.sectionHeader}>Default Line Items</Text>

              {newTemplate.defaultLineItems.map((item, index) => (
                <View key={index} style={styles.lineItemRow}>
                  <TextInput
                    style={styles.lineItemInput}
                    value={item.description}
                    onChangeText={(text) => updateLineItem(index, 'description', text)}
                    placeholder="Description"
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <TextInput
                    style={[styles.lineItemInput, styles.lineItemQty]}
                    value={String(item.qty || '')}
                    onChangeText={(text) => updateLineItem(index, 'qty', parseInt(text) || 1)}
                    placeholder="Qty"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={[styles.lineItemInput, styles.lineItemPrice]}
                    value={String(item.unitPrice || '')}
                    onChangeText={(text) => updateLineItem(index, 'unitPrice', parseFloat(text) || 0)}
                    placeholder="Price"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                  <TouchableOpacity
                    style={styles.removeLineItemButton}
                    onPress={() => removeLineItem(index)}
                  >
                    <Feather name="x" size={20} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addLineItemButton}
                onPress={addLineItem}
              >
                <Feather name="plus" size={18} color={colors.primary} />
                <Text style={styles.addLineItemText}>Add Line Item</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveButton, isCreatingTemplate && styles.modalSaveButtonDisabled]}
                onPress={handleCreateTemplate}
                disabled={isCreatingTemplate}
              >
                <Feather name="check" size={18} color={colors.primaryForeground} />
                <Text style={styles.modalSaveButtonText}>
                  {isCreatingTemplate ? 'Saving...' : (editingTemplate ? 'Update Template' : 'Create Template')}
                </Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </Modal>

        <AppTour 
          visible={showTour} 
          onClose={() => setShowTour(false)} 
        />
      </View>
    </>
  );
}
