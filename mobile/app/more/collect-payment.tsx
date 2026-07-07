import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  StyleSheet,
  RefreshControl,
  Share,
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '@/components/ui/PressableRow';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { format, isThisWeek, parseISO } from 'date-fns';
import { useStripeTerminal } from '../../src/hooks/useServices';
import { isTapToPayAvailable } from '../../src/lib/stripe-terminal';
import { useInvoicesStore, useClientsStore, useJobsStore } from '../../src/lib/store';
import api from '../../src/lib/api';
import { Card, CardContent } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { SheetButton } from '../../src/components/ui/SheetButton';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes, componentStyles } from '../../src/lib/design-tokens';
import { showToast } from '../../src/lib/toast';

// Keep money inputs clean: digits only, a single decimal point, max 2 decimals.
const sanitizeAmountInput = (text: string): string => {
  let cleaned = (text || '').replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    const intPart = cleaned.slice(0, firstDot);
    const decPart = cleaned.slice(firstDot + 1).replace(/\./g, '').slice(0, 2);
    cleaned = intPart + '.' + decPart;
  }
  return cleaned;
};

const createStyles = (colors: ThemeColors, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingTop: pageShell.paddingTop,
  },
  heroSection: {
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.foreground,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 4,
    lineHeight: 20,
  },
  headerBanner: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.promoBorder,
  },
  headerBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerBannerTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginLeft: spacing.sm,
  },
  headerBannerSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  quickLinksRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  quickLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: spacing.sm,
    ...shadows.sm,
  },
  quickLinkIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkText: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.foreground,
  },
  amountSection: {
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.isDark ? colors.muted : colors.card,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    height: 64,
    borderWidth: 1,
    borderColor: colors.isDark ? colors.borderLight : colors.border,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  amountInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.foreground,
  },
  descriptionInput: {
    marginTop: spacing.sm,
    backgroundColor: colors.isDark ? colors.muted : colors.card,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    height: 48,
    color: colors.foreground,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.isDark ? colors.borderLight : colors.border,
  },
  paymentMethodCard: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  paymentMethodCardDisabled: {
    opacity: 0.5,
  },
  paymentMethodIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  paymentMethodContent: {
    flex: 1,
  },
  paymentMethodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  paymentMethodTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  paymentMethodDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  pendingSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  pendingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pendingSectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
  },
  emptyPending: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  emptyPendingText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  pendingItemContent: {
    flex: 1,
  },
  pendingItemTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  pendingItemClient: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  pendingItemRight: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  pendingItemAmount: {
    ...typography.bodySemibold,
    color: colors.foreground,
  },
  collectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    gap: 4,
  },
  collectButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  infoCard: {
    marginTop: spacing.sm,
  },
  infoCardTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  infoCardText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  infoCardFees: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: spacing.sm,
  },
  warningCard: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.warningLight,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  warningTitle: {
    color: colors.warning,
    fontWeight: '600',
    marginBottom: 4,
  },
  warningText: {
    color: colors.mutedForeground,
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.isDark ? colors.borderLight : colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.foreground,
  },
  modalContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  modalStepTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  modalStepSubtitle: {
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  readyIcon: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  amountDisplay: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  acceptedMethodsCard: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  acceptedMethodsText: {
    color: colors.mutedForeground,
    fontSize: 14,
    textAlign: 'center',
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successTitle: {
    color: colors.success,
    fontSize: 24,
    fontWeight: 'bold',
  },
  successAmount: {
    color: colors.foreground,
    fontSize: 18,
    marginTop: spacing.sm,
  },
  errorIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.destructiveLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  errorTitle: {
    color: colors.destructive,
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalFooter: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.isDark ? colors.borderLight : colors.border,
    backgroundColor: colors.background,
  },
  statsGrid: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    ...typography.statValue,
    color: colors.foreground,
  },
  statTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  demoModeBanner: {
    backgroundColor: colors.infoLight || colors.primaryLight,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.info || colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  demoModeText: {
    flex: 1,
  },
  demoModeTitle: {
    color: colors.warning,
    fontWeight: '600',
    fontSize: 14,
  },
  demoModeDescription: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: 2,
  },
  receiptInput: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    color: colors.foreground,
    fontSize: 14,
  },
  qrCodeContainer: {
    width: 220,
    height: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    padding: spacing.sm,
  },
  qrCodeWrapper: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCodeImage: {
    width: 200,
    height: 200,
  },
  qrCodePlaceholder: {
    width: 180,
    height: 180,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrAmountDisplay: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  qrUrlContainer: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  qrUrlText: {
    flex: 1,
    fontSize: 12,
    color: colors.mutedForeground,
  },
  qrActionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    width: '100%',
  },
  paymentLinkInputContainer: {
    width: '100%',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  paymentLinkLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  recentPaymentsSection: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  recentPaymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  recentPaymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  recentPaymentIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.xl,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentPaymentContent: {
    flex: 1,
  },
  recentPaymentClient: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  recentPaymentMeta: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  recentPaymentAmount: {
    ...typography.bodySemibold,
    color: colors.success,
  },
  compactQuickLinksRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  compactQuickLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  compactQuickLinkText: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.foreground,
  },
  invoicePickerScrollView: {
    flex: 1,
  },
  invoicePickerContent: {
    padding: spacing.md,
    paddingBottom: bottomNavHeight,
  },
  invoicePickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
    gap: spacing.md,
  },
  invoicePickerStatusIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoicePickerItemContent: {
    flex: 1,
  },
  invoicePickerItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  invoicePickerItemTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  invoicePickerItemClient: {
    ...typography.body,
    color: colors.foreground,
    marginTop: 2,
  },
  invoicePickerItemMeta: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  invoicePickerItemRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  invoicePickerItemAmount: {
    ...typography.bodySemibold,
    fontSize: 18,
    color: colors.foreground,
  },
  invoicePickerItemAmountLabel: {
    ...typography.captionSmall,
    fontSize: 11,
    color: colors.mutedForeground,
  },
  customAmountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  customAmountButtonText: {
    ...typography.body,
    fontWeight: '500',
    color: colors.foreground,
  },
  invoicePickerEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  invoicePickerEmptyText: {
    ...typography.body,
    color: colors.mutedForeground,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});

interface PaymentMethodCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  badgeVariant?: 'success' | 'warning' | 'default';
  onPress: () => void;
  disabled?: boolean;
  colors: ThemeColors;
}

function PaymentMethodCard({ 
  icon, 
  title, 
  description, 
  badge, 
  badgeVariant = 'success',
  onPress,
  disabled = false,
  colors
}: PaymentMethodCardProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  return (
    <PressableRow
      onPress={onPress}
      disabled={disabled}

      style={[styles.paymentMethodCard, disabled && styles.paymentMethodCardDisabled]}
    >
      <View style={styles.paymentMethodIcon}>
        {icon}
      </View>
      <View style={styles.paymentMethodContent}>
        <View style={styles.paymentMethodHeader}>
          <Text style={styles.paymentMethodTitle}>{title}</Text>
          {badge && (
            <Badge variant={badgeVariant}>
              {badge}
            </Badge>
          )}
        </View>
        <Text style={styles.paymentMethodDescription}>
          {description}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
    </PressableRow>
  );
}

function StatCard({ 
  title, 
  value, 
  icon,
  iconBackground,
  valueColor,
  colors
}: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode;
  iconBackground?: string;
  valueColor?: string;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, iconBackground ? { backgroundColor: iconBackground } : undefined]}>
        {icon}
      </View>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

interface SelectedInvoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  total: number;
  amountPaid: number;
  amountDue: number;
}

export default function CollectScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const { invoiceId } = useLocalSearchParams<{ invoiceId?: string }>();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [showTapToPayModal, setShowTapToPayModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [autoReceiptWasSent, setAutoReceiptWasSent] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'ready' | 'connecting' | 'waiting' | 'processing' | 'success' | 'error'>('ready');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SelectedInvoice | null>(null);
  const [lastPaymentAmount, setLastPaymentAmount] = useState(0);
  const [sendingReceipt, setSendingReceipt] = useState(false);
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const hasAutoSelectedInvoice = useRef(false);
  
  // QR Code Modal state
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrPaymentUrl, setQrPaymentUrl] = useState('');
  const [qrPaymentRequest, setQrPaymentRequest] = useState<any>(null);
  const [qrLoading, setQrLoading] = useState(false);
  
  // Record Payment Modal state
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [recordPaymentMethod, setRecordPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer'>('cash');
  const [recordAmount, setRecordAmount] = useState('');
  const [recordDescription, setRecordDescription] = useState('');
  const [recordClientId, setRecordClientId] = useState<string | null>(null);
  const [recordInvoiceId, setRecordInvoiceId] = useState<string | null>(null);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [recordPaymentSuccess, setRecordPaymentSuccess] = useState<{ receiptNumber: string; receiptId: string } | null>(null);
  
  // Payment Link Modal state
  const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false);
  const [paymentLinkRequest, setPaymentLinkRequest] = useState<any>(null);
  const [linkRecipientEmail, setLinkRecipientEmail] = useState('');
  const [linkRecipientPhone, setLinkRecipientPhone] = useState('');
  const [sendingLink, setSendingLink] = useState(false);
  
  // Resend Payment Link Modal state
  const [showResendModal, setShowResendModal] = useState(false);
  const [resendRequest, setResendRequest] = useState<any>(null);
  const [resendClientName, setResendClientName] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resendPhone, setResendPhone] = useState('');
  const [resendingLink, setResendingLink] = useState(false);
  
  // Ongoing Payments state (includes pending payment requests + recent receipts)
  const [recentReceipts, setRecentReceipts] = useState<any[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<any[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  
  // Invoice Picker Modal state
  const [showInvoicePickerModal, setShowInvoicePickerModal] = useState(false);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<'record' | 'qr' | 'link' | 'tap' | null>(null);
  const [pickerTab, setPickerTab] = useState<'jobs' | 'invoices'>('jobs');
  const [pickerSearch, setPickerSearch] = useState('');
  
  // Custom Amount Modal state (for entering amount when no invoice selected)
  const [showCustomAmountModal, setShowCustomAmountModal] = useState(false);
  const [customAmountValue, setCustomAmountValue] = useState('');
  const [customAmountDescription, setCustomAmountDescription] = useState('');
  
  // SMS Status and Setup Modal state
  const [smsStatus, setSmsStatus] = useState<{
    connected: boolean;
    setupRequired: boolean;
    setupInstructions?: {
      title: string;
      description: string;
      steps: string[];
    };
  } | null>(null);
  const [showSmsSetupModal, setShowSmsSetupModal] = useState(false);
  
  const { invoices, fetchInvoices } = useInvoicesStore();
  const { clients, fetchClients } = useClientsStore();
  const { jobs, fetchJobs } = useJobsStore();
  const terminal = useStripeTerminal();
  const tapToPaySupported = isTapToPayAvailable();

  const fetchReceipts = useCallback(async () => {
    setReceiptsLoading(true);
    try {
      const [receiptsResponse, requestsResponse] = await Promise.all([
        api.get<any[]>('/api/receipts?limit=10'),
        api.get<any[]>('/api/payment-requests?limit=15')
      ]);
      if (!receiptsResponse.error && Array.isArray(receiptsResponse.data)) {
        setRecentReceipts(receiptsResponse.data);
      }
      if (!requestsResponse.error && Array.isArray(requestsResponse.data)) {
        // Sort payment requests by createdAt desc and limit to 15 for performance
        const sortedRequests = [...requestsResponse.data]
          .sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          })
          .slice(0, 15);
        setPaymentRequests(sortedRequests);
      }
    } catch (error) {
      console.error('Failed to fetch payments data:', error);
      showToast({ type: 'info', message: 'Loading Error', description: 'Could not load recent payments. Please try again.' });
    } finally {
      setReceiptsLoading(false);
    }
  }, []);

  // Fetch SMS status
  const fetchSmsStatus = useCallback(async () => {
    try {
      const response = await api.get<{
        connected: boolean;
        setupRequired: boolean;
        setupInstructions?: {
          title: string;
          description: string;
          steps: string[];
        };
      }>('/api/sms/status');
      if (response.data) {
        setSmsStatus(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch SMS status:', error);
      // Default to not connected if fetch fails
      setSmsStatus({ connected: false, setupRequired: true });
    }
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchInvoices(), fetchClients(), fetchJobs(), fetchReceipts(), fetchSmsStatus()]);
    setIsLoading(false);
  }, [fetchInvoices, fetchClients, fetchJobs, fetchReceipts, fetchSmsStatus]);

  useEffect(() => {
    refreshData();
    if (tapToPaySupported) {
      terminal.initialize();
    }
  }, []);

  // Reset auto-selection flag when invoiceId changes (allows new invoice selection)
  useEffect(() => {
    hasAutoSelectedInvoice.current = false;
  }, [invoiceId]);

  // Auto-select invoice when navigated from invoice detail with invoiceId param
  useEffect(() => {
    if (invoiceId && invoices.length > 0 && clients.length > 0 && !hasAutoSelectedInvoice.current) {
      const invoice = invoices.find(i => i.id === invoiceId);
      if (invoice) {
        const client = clients.find(c => c.id === invoice.clientId);
        // Parse amounts - database stores dollars as strings
        const invoiceTotal = typeof invoice.total === 'string' ? parseFloat(invoice.total) : (invoice.total || 0);
        const invoicePaid = typeof invoice.amountPaid === 'string' ? parseFloat(invoice.amountPaid) : (invoice.amountPaid || 0);
        const invoiceAmountDue = invoiceTotal - invoicePaid;
        
        setSelectedInvoice({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          clientId: invoice.clientId,
          clientName: client?.name || 'Unknown Client',
          clientEmail: client?.email,
          clientPhone: client?.phone,
          total: invoiceTotal,
          amountPaid: invoicePaid,
          amountDue: invoiceAmountDue,
        });
        
        setAmount(invoiceAmountDue.toFixed(2));
        setDescription(`Payment for ${invoice.invoiceNumber || 'Invoice'}`);
        hasAutoSelectedInvoice.current = true;
      }
    } else if (!invoiceId) {
      // Clear selection when navigating to collect without an invoice ID
      hasAutoSelectedInvoice.current = false;
    }
  }, [invoiceId, invoices, clients]);

  const getClient = (clientId: string) => {
    return clients.find(c => c.id === clientId);
  };

  const getClientName = (clientId: string) => {
    const client = getClient(clientId);
    return client?.name || 'Unknown Client';
  };

  // Handle collecting payment for a specific invoice
  const handleCollectForInvoice = (invoice: any) => {
    const client = getClient(invoice.clientId);
    // Parse amounts - database stores dollars as strings
    const invoiceTotal = typeof invoice.total === 'string' ? parseFloat(invoice.total) : (invoice.total || 0);
    const invoicePaid = typeof invoice.amountPaid === 'string' ? parseFloat(invoice.amountPaid) : (invoice.amountPaid || 0);
    const amountDue = invoiceTotal - invoicePaid;
    
    setSelectedInvoice({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      clientName: client?.name || 'Unknown Client',
      clientEmail: client?.email,
      clientPhone: client?.phone,
      total: invoiceTotal,
      amountPaid: invoicePaid,
      amountDue,
    });
    
    // Pre-fill the amount and description
    setAmount(amountDue.toFixed(2));
    setDescription(`Payment for ${invoice.invoiceNumber || 'Invoice'}`);
  };

  // Clear invoice selection
  const clearInvoiceSelection = () => {
    setSelectedInvoice(null);
    setAmount('');
    setDescription('');
  };

  const formatCurrency = (amount: number | string) => {
    const { formatCurrency: fmt } = require('../../src/lib/format');
    return fmt(amount);
  };

  const collectibleJobs = useMemo(() => {
    const activeJobs = jobs.filter(j => 
      j.status === 'in_progress' || j.status === 'scheduled' || j.status === 'done' || j.status === 'invoiced'
    );
    return activeJobs.map(job => {
      const client = clients.find(c => c.id === job.clientId);
      const jobInvoices = invoices.filter(i => i.jobId === job.id && (i.status === 'sent' || i.status === 'overdue'));
      const totalDue = jobInvoices.reduce((sum, inv) => {
        const total = typeof inv.total === 'string' ? parseFloat(inv.total) : (inv.total || 0);
        const paid = typeof inv.amountPaid === 'string' ? parseFloat(inv.amountPaid) : (inv.amountPaid || 0);
        return sum + (total - paid);
      }, 0);
      return {
        ...job,
        clientName: client?.name || job.clientName || 'No Client',
        clientEmail: client?.email,
        clientPhone: client?.phone,
        clientId: job.clientId,
        outstandingAmount: totalDue,
        invoiceCount: jobInvoices.length,
        hasOverdue: jobInvoices.some(i => i.status === 'overdue'),
      };
    });
  }, [jobs, invoices, clients]);

  const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const totalPending = pendingInvoices.reduce((sum, i) => {
    const total = typeof i.total === 'string' ? parseFloat(i.total) : (i.total || 0);
    const paid = typeof i.amountPaid === 'string' ? parseFloat(i.amountPaid) : (i.amountPaid || 0);
    return sum + (total - paid);
  }, 0);
  const overdueAmount = overdueInvoices.reduce((sum, i) => {
    const total = typeof i.total === 'string' ? parseFloat(i.total) : (i.total || 0);
    const paid = typeof i.amountPaid === 'string' ? parseFloat(i.amountPaid) : (i.amountPaid || 0);
    return sum + (total - paid);
  }, 0);
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;
  const pendingInvoiceCount = pendingInvoices.length;
  
  // Calculate collected this week from recent receipts
  const collectedThisWeek = useMemo(() => {
    return (Array.isArray(recentReceipts) ? recentReceipts : [])
      .filter(r => {
        try {
          const receiptDate = r.createdAt ? parseISO(r.createdAt) : null;
          return receiptDate && isThisWeek(receiptDate, { weekStartsOn: 1 });
        } catch {
          return false;
        }
      })
      .reduce((sum, r) => {
        const amount = typeof r.amount === 'string' ? parseFloat(r.amount) : (r.amount || 0);
        return sum + amount;
      }, 0);
  }, [recentReceipts]);

  const getPaymentMethodLabel = (method: string): string => {
    const labels: Record<string, string> = {
      cash: 'Cash',
      card: 'Card',
      bank_transfer: 'Bank Transfer',
      eftpos: 'EFTPOS',
      cheque: 'Cheque',
      other: 'Other',
    };
    return labels[method] || method;
  };

  const getPaymentMethodIcon = (method: string): string => {
    const icons: Record<string, string> = {
      cash: 'dollar-sign',
      card: 'credit-card',
      bank_transfer: 'home',
      eftpos: 'credit-card',
      cheque: 'file-text',
      other: 'circle',
    };
    return icons[method] || 'circle';
  };

  const getAmountInCents = (): number => {
    const parsed = parseFloat(amount);
    return isNaN(parsed) ? 0 : Math.round(parsed * 100);
  };

  const handleTapToPay = async () => {
    const amountCents = getAmountInCents();
    if (amountCents < 50) {
      handleShowInvoicePicker('tap');
      return;
    }

    // Only show custom modal in simulation mode (Expo Go)
    // When using real SDK, Apple's native Tap to Pay UI appears automatically
    const useNativeSDK = !terminal.isSimulation && terminal.isSDKAvailable;
    
    if (!useNativeSDK) {
      // Simulation mode: show custom modal as fallback UI
      setShowTapToPayModal(true);
      setPaymentStep('connecting');
    }

    try {
      if (!terminal.isInitialized) {
        const initialized = await terminal.initialize();
        if (!initialized) {
          if (!useNativeSDK) setPaymentStep('error');
          else showToast({ type: 'info', message: 'Terminal Error', description: 'Failed to initialize Tap to Pay. Please try again.' });
          return;
        }
      }

      if (!terminal.reader) {
        const connected = await terminal.connectReader();
        if (!connected) {
          if (!useNativeSDK) setPaymentStep('error');
          else showToast({ type: 'info', message: 'Connection Error', description: 'Failed to connect to reader. Please try again.' });
          return;
        }
      }

      if (!useNativeSDK) {
        setPaymentStep('waiting');
      }
      
      // When using real SDK, collectPaymentMethod will present Apple's native 
      // "Hold Here to Pay" interface automatically - no custom UI needed
      const result = await terminal.collectPayment(amountCents, description || undefined);
      
      if (result) {
        setLastPaymentAmount(amountCents);
        
        // If paying an invoice, update the invoice payment status
        if (selectedInvoice) {
          try {
            const recordRes = await api.post(`/api/invoices/${selectedInvoice.id}/record-payment`, {
              amount: (amountCents / 100).toFixed(2),
              paymentMethod: 'card',
              notes: 'Tap to Pay contactless payment',
            });
            if (recordRes.error) {
              showToast({ type: 'info', message: 'Recording Error', description: recordRes.error });
            }
            fetchInvoices();
          } catch (err: any) {
            const msg = err?.message || 'Payment was successful but we could not update the invoice record. Please update it manually.';
            showToast({ type: 'info', message: 'Recording Error', description: msg });
          }
        }
        
        // Auto-send receipt if client has email or phone
        const clientEmail = selectedInvoice?.clientEmail;
        const clientPhone = selectedInvoice?.clientPhone;
        let autoReceiptSent = false;
        
        if (clientEmail) {
          try {
            await api.post('/api/payments/send-receipt', {
              email: clientEmail,
              amount: amountCents,
              description: description || 'Payment received',
              invoiceId: selectedInvoice?.id,
              invoiceNumber: selectedInvoice?.invoiceNumber,
              clientName: selectedInvoice?.clientName,
              method: 'email',
            });
            autoReceiptSent = true;
          } catch (e) {
            console.log('Auto email receipt failed, will show manual option');
          }
        }
        
        if (clientPhone && !smsStatus?.setupRequired && smsStatus?.connected) {
          try {
            await api.post('/api/payments/send-receipt', {
              phone: clientPhone,
              amount: amountCents,
              description: description || 'Payment received',
              invoiceId: selectedInvoice?.id,
              invoiceNumber: selectedInvoice?.invoiceNumber,
              clientName: selectedInvoice?.clientName,
              method: 'sms',
            });
            autoReceiptSent = true;
          } catch (e) {
            console.log('Auto SMS receipt failed, will show manual option');
          }
        }
        
        setAutoReceiptWasSent(autoReceiptSent);
        
        if (!useNativeSDK) {
          setPaymentStep('success');
          setTimeout(() => {
            setShowTapToPayModal(false);
            setPaymentStep('ready');
            setShowReceiptModal(true);
          }, 1500);
        } else {
          setShowReceiptModal(true);
        }
      } else {
        if (!useNativeSDK) {
          setPaymentStep('error');
        } else {
          showToast({ type: 'info', message: 'Payment Cancelled', description: 'The payment was not completed.' });
        }
      }
    } catch (error: any) {
      console.error('Tap to Pay error:', error);
      if (!useNativeSDK) {
        setPaymentStep('error');
      } else {
        showToast({ type: 'info', message: 'Payment Error', description: error?.message || 'The payment could not be processed. Please try again.' });
      }
    }
  };

  const handleTapToPayWithAmount = async (amountDollars: number) => {
    const amountCents = Math.round(amountDollars * 100);
    if (amountCents < 50) {
      showToast({ type: 'info', message: 'Invalid Amount', description: 'Please enter an amount of at least $0.50' });
      return;
    }

    const useNativeSDK = !terminal.isSimulation && terminal.isSDKAvailable;
    
    if (!useNativeSDK) {
      setShowTapToPayModal(true);
      setPaymentStep('connecting');
    }

    try {
      if (!terminal.isInitialized) {
        const initialized = await terminal.initialize();
        if (!initialized) {
          if (!useNativeSDK) setPaymentStep('error');
          else showToast({ type: 'info', message: 'Terminal Error', description: 'Failed to initialize Tap to Pay. Please try again.' });
          return;
        }
      }

      if (!terminal.reader) {
        const connected = await terminal.connectReader();
        if (!connected) {
          if (!useNativeSDK) setPaymentStep('error');
          else showToast({ type: 'info', message: 'Connection Error', description: 'Failed to connect to reader. Please try again.' });
          return;
        }
      }

      if (!useNativeSDK) {
        setPaymentStep('waiting');
      }
      
      const result = await terminal.collectPayment(amountCents, description || undefined);
      
      if (result) {
        setLastPaymentAmount(amountCents);
        
        if (selectedInvoice) {
          try {
            const recordRes = await api.post(`/api/invoices/${selectedInvoice.id}/record-payment`, {
              amount: (amountCents / 100).toFixed(2),
              paymentMethod: 'card',
              notes: 'Tap to Pay contactless payment',
            });
            if (recordRes.error) {
              showToast({ type: 'info', message: 'Recording Error', description: recordRes.error });
            }
            fetchInvoices();
          } catch (err: any) {
            const msg = err?.message || 'Payment was successful but we could not update the invoice record. Please update it manually.';
            showToast({ type: 'info', message: 'Recording Error', description: msg });
          }
        }
        
        const clientEmail = selectedInvoice?.clientEmail;
        const clientPhone = selectedInvoice?.clientPhone;
        let autoReceiptSent = false;
        
        if (clientEmail) {
          try {
            await api.post('/api/payments/send-receipt', {
              email: clientEmail,
              amount: amountCents,
              description: description || 'Payment received',
              invoiceId: selectedInvoice?.id,
              invoiceNumber: selectedInvoice?.invoiceNumber,
              clientName: selectedInvoice?.clientName,
              method: 'email',
            });
            autoReceiptSent = true;
          } catch (e) {
            console.log('Auto email receipt failed, will show manual option');
          }
        }
        
        if (clientPhone && !smsStatus?.setupRequired && smsStatus?.connected) {
          try {
            await api.post('/api/payments/send-receipt', {
              phone: clientPhone,
              amount: amountCents,
              description: description || 'Payment received',
              invoiceId: selectedInvoice?.id,
              invoiceNumber: selectedInvoice?.invoiceNumber,
              clientName: selectedInvoice?.clientName,
              method: 'sms',
            });
            autoReceiptSent = true;
          } catch (e) {
            console.log('Auto SMS receipt failed, will show manual option');
          }
        }
        
        setAutoReceiptWasSent(autoReceiptSent);

        if (!useNativeSDK) {
          setPaymentStep('success');
          setTimeout(() => {
            setShowTapToPayModal(false);
            setPaymentStep('ready');
            setShowReceiptModal(true);
          }, 1500);
        } else {
          setShowReceiptModal(true);
        }
      } else {
        if (!useNativeSDK) {
          setPaymentStep('error');
        } else {
          showToast({ type: 'info', message: 'Payment Cancelled', description: 'The payment was not completed.' });
        }
      }
    } catch (error: any) {
      console.error('Tap to Pay error:', error);
      if (!useNativeSDK) {
        setPaymentStep('error');
      } else {
        showToast({ type: 'info', message: 'Payment Error', description: error?.message || 'The payment could not be processed. Please try again.' });
      }
    }
  };

  // Send receipt via email
  const sendReceiptEmail = async () => {
    setSendingReceipt(true);
    try {
      const recipientEmail = manualEmail || selectedInvoice?.clientEmail;
      if (!recipientEmail) {
        showToast({ type: 'info', message: 'No Email', description: 'Please enter an email address to send the receipt.' });
        setSendingReceipt(false);
        return;
      }

      await api.post('/api/payments/send-receipt', {
        email: recipientEmail,
        amount: lastPaymentAmount, // Amount in cents - backend divides by 100
        description: description || 'Payment received',
        invoiceId: selectedInvoice?.id,
        invoiceNumber: selectedInvoice?.invoiceNumber,
        clientName: selectedInvoice?.clientName,
        method: 'email',
      });

      showToast({ type: 'info', message: 'Receipt Sent', description: `Receipt emailed to ${recipientEmail}` });
      handleCloseReceiptModal();
    } catch (error) {
      console.error('Failed to send receipt:', error);
      showToast({ type: 'error', message: 'Failed to send receipt. Please try again.' });
    } finally {
      setSendingReceipt(false);
    }
  };

  // Send receipt via SMS
  const sendReceiptSMS = async () => {
    // Check if SMS is configured
    if (smsStatus?.setupRequired || !smsStatus?.connected) {
      setShowSmsSetupModal(true);
      return;
    }
    
    setSendingReceipt(true);
    try {
      const recipientPhone = manualPhone || selectedInvoice?.clientPhone;
      if (!recipientPhone) {
        showToast({ type: 'info', message: 'No Phone', description: 'Please enter a phone number to send the receipt.' });
        setSendingReceipt(false);
        return;
      }

      await api.post('/api/payments/send-receipt', {
        phone: recipientPhone,
        amount: lastPaymentAmount, // Amount in cents - backend divides by 100
        description: description || 'Payment received',
        invoiceId: selectedInvoice?.id,
        invoiceNumber: selectedInvoice?.invoiceNumber,
        clientName: selectedInvoice?.clientName,
        method: 'sms',
      });

      showToast({ type: 'info', message: 'Receipt Sent', description: `Receipt SMS sent to ${recipientPhone}` });
      handleCloseReceiptModal();
    } catch (error: any) {
      console.error('Failed to send SMS receipt:', error);
      if (error?.message?.includes('disabled') || error?.message?.includes('not configured')) {
        setShowSmsSetupModal(true);
      } else if (error?.message?.includes('disabled')) {
        showToast({ type: 'info', message: 'SMS Unavailable', description: 'SMS is not configured. Use email instead.' });
      } else {
        showToast({ type: 'error', message: 'Failed to send SMS. Please try again.' });
      }
    } finally {
      setSendingReceipt(false);
    }
  };

  // Close receipt modal and reset state
  const handleCloseReceiptModal = () => {
    setShowReceiptModal(false);
    setAutoReceiptWasSent(false);
    setAmount('');
    setDescription('');
    setSelectedInvoice(null);
    setLastPaymentAmount(0);
    setManualEmail('');
    setManualPhone('');
  };

  const handleCancelPayment = async () => {
    await terminal.cancelPayment();
    setShowTapToPayModal(false);
    setPaymentStep('ready');
  };

  const handleQRCode = () => {
    handleShowInvoicePicker('qr');
  };

  const handleQRCodeDirect = async () => {
    const amountCents = getAmountInCents();
    if (amountCents <= 0) {
      showToast({ type: 'info', message: 'Invalid Amount', description: 'Please enter a valid payment amount' });
      return;
    }

    setQrLoading(true);
    setShowQRModal(true);

    try {
      const response = await api.post<{ 
        id: string; 
        token: string; 
        paymentUrl: string; 
        amount: string;
        status: string;
      }>('/api/payment-requests', {
        amount: amountCents / 100, // API expects dollars
        description: description || 'Payment',
        invoiceId: selectedInvoice?.id,
        clientId: selectedInvoice?.clientId,
        reference: selectedInvoice?.invoiceNumber,
      });

      if (response.error) {
        showToast({ type: 'error', message: response.error });
        setShowQRModal(false);
        return;
      }
      if (response.data) {
        setQrPaymentUrl(response.data.paymentUrl);
        setQrPaymentRequest(response.data);
      }
    } catch (error: any) {
      console.error('Failed to generate QR code:', error);
      const msg = error?.message || 'Failed to generate QR code';
      showToast({ type: 'error', message: msg });
      setShowQRModal(false);
    } finally {
      setQrLoading(false);
    }
  };

  const handleCopyPaymentUrl = async () => {
    if (qrPaymentUrl) {
      try {
        await Clipboard.setStringAsync(qrPaymentUrl);
        showToast({ type: 'info', message: 'Copied!', description: 'Payment link copied to clipboard' });
      } catch (error) {
        showToast({ type: 'info', message: 'Payment Link', description: qrPaymentUrl });
      }
    }
  };

  const handleSharePaymentUrl = async () => {
    if (qrPaymentUrl) {
      try {
        const amountDisplay = (getAmountInCents() / 100).toFixed(2);
        await Share.share({
          message: `Please pay $${amountDisplay} using this secure link: ${qrPaymentUrl}`,
          url: qrPaymentUrl,
        });
      } catch (error) {
        console.error('Share error:', error);
      }
    }
  };

  const handleCloseQRModal = () => {
    setShowQRModal(false);
    setQrPaymentUrl('');
    setQrPaymentRequest(null);
    setAmount('');
    setDescription('');
    setSelectedInvoice(null);
  };

  const handlePaymentLink = () => {
    handleShowInvoicePicker('link');
  };

  const handlePaymentLinkDirect = async () => {
    const amountCents = getAmountInCents();
    if (amountCents <= 0) {
      showToast({ type: 'info', message: 'Invalid Amount', description: 'Please enter a valid payment amount' });
      return;
    }

    // Pre-fill recipient from selected invoice if available
    setLinkRecipientEmail(selectedInvoice?.clientEmail || '');
    setLinkRecipientPhone(selectedInvoice?.clientPhone || '');
    
    setSendingLink(true);
    
    try {
      // Create payment request first
      const response = await api.post<{ 
        id: string; 
        token: string; 
        paymentUrl: string; 
        amount: string;
        status: string;
      }>('/api/payment-requests', {
        amount: amountCents / 100, // API expects dollars
        description: description || 'Payment',
        invoiceId: selectedInvoice?.id,
        clientId: selectedInvoice?.clientId,
        reference: selectedInvoice?.invoiceNumber,
      });

      if (response.error) {
        showToast({ type: 'error', message: response.error });
        return;
      }
      if (response.data) {
        setPaymentLinkRequest(response.data);
        setShowPaymentLinkModal(true);
      }
    } catch (error: any) {
      console.error('Failed to create payment request:', error);
      const msg = error?.message || 'Failed to create payment link';
      showToast({ type: 'error', message: msg });
    } finally {
      setSendingLink(false);
    }
  };

  const sendPaymentLinkViaEmail = async () => {
    if (!paymentLinkRequest?.id) return;
    
    const email = linkRecipientEmail.trim();
    if (!email) {
      showToast({ type: 'info', message: 'Email Required', description: 'Please enter an email address' });
      return;
    }
    
    setSendingLink(true);
    try {
      await api.post(`/api/payment-requests/${paymentLinkRequest.id}/send-email`, {
        email,
      });
      
      showToast({ type: 'success', message: `Payment link sent to ${email}` });
      handleClosePaymentLinkModal();
    } catch (error) {
      console.error('Failed to send email:', error);
      showToast({ type: 'error', message: 'Failed to send payment link via email' });
    } finally {
      setSendingLink(false);
    }
  };

  const sendPaymentLinkViaSMS = async () => {
    // Check if SMS is configured
    if (smsStatus?.setupRequired || !smsStatus?.connected) {
      setShowSmsSetupModal(true);
      return;
    }
    
    if (!paymentLinkRequest?.id) return;
    
    const phone = linkRecipientPhone.trim();
    if (!phone) {
      showToast({ type: 'info', message: 'Phone Required', description: 'Please enter a phone number' });
      return;
    }
    
    setSendingLink(true);
    try {
      await api.post(`/api/payment-requests/${paymentLinkRequest.id}/send-sms`, {
        phone,
      });
      
      showToast({ type: 'success', message: `Payment link sent to ${phone}` });
      handleClosePaymentLinkModal();
    } catch (error: any) {
      console.error('Failed to send SMS:', error);
      if (error?.message?.includes('not configured')) {
        setShowSmsSetupModal(true);
      } else if (error?.message?.includes('disabled')) {
        showToast({ type: 'info', message: 'SMS Unavailable', description: 'SMS is not configured. Use email instead, or copy the link to share manually.' });
      } else {
        showToast({ type: 'error', message: error?.message || 'Failed to send payment link via SMS' });
      }
    } finally {
      setSendingLink(false);
    }
  };

  const handleCopyPaymentLink = async () => {
    if (paymentLinkRequest?.paymentUrl) {
      try {
        await Clipboard.setStringAsync(paymentLinkRequest.paymentUrl);
        showToast({ type: 'info', message: 'Copied!', description: 'Payment link copied to clipboard' });
      } catch (error) {
        showToast({ type: 'info', message: 'Payment Link', description: paymentLinkRequest.paymentUrl });
      }
    }
  };

  const handleSharePaymentLink = async () => {
    if (paymentLinkRequest?.paymentUrl) {
      try {
        const amountDisplay = (getAmountInCents() / 100).toFixed(2);
        await Share.share({
          message: `Please pay $${amountDisplay} using this secure link: ${paymentLinkRequest.paymentUrl}`,
          url: paymentLinkRequest.paymentUrl,
        });
      } catch (error) {
        console.error('Share error:', error);
      }
    }
  };

  const handleClosePaymentLinkModal = () => {
    setShowPaymentLinkModal(false);
    setPaymentLinkRequest(null);
    setLinkRecipientEmail('');
    setLinkRecipientPhone('');
    setAmount('');
    setDescription('');
    setSelectedInvoice(null);
  };

  // Open resend modal for a payment request
  const handleResendPaymentRequest = (request: any, clientName: string) => {
    const client = request.clientId ? clients.find(c => c.id === request.clientId) : null;
    setResendRequest(request);
    setResendClientName(clientName);
    setResendEmail(client?.email || '');
    setResendPhone(client?.phone || '');
    setShowResendModal(true);
  };

  // Send payment link via email from resend modal
  const handleResendViaEmail = async () => {
    if (!resendRequest?.id) return;
    
    const email = resendEmail.trim();
    if (!email) {
      showToast({ type: 'info', message: 'Email Required', description: 'Please enter an email address' });
      return;
    }
    
    setResendingLink(true);
    try {
      await api.post(`/api/payment-requests/${resendRequest.id}/send-email`, { email });
      showToast({ type: 'success', message: `Payment link sent to ${email}` });
      setShowResendModal(false);
      setResendRequest(null);
      // Refresh using the existing pattern
      fetchReceipts();
    } catch (error) {
      console.error('Failed to send email:', error);
      showToast({ type: 'error', message: 'Failed to send payment link via email' });
    } finally {
      setResendingLink(false);
    }
  };

  // Send payment link via SMS from resend modal
  const handleResendViaSMS = async () => {
    // Check if SMS is configured
    if (smsStatus?.setupRequired || !smsStatus?.connected) {
      setShowSmsSetupModal(true);
      return;
    }
    
    if (!resendRequest?.id) return;
    
    const phone = resendPhone.trim();
    if (!phone) {
      showToast({ type: 'info', message: 'Phone Required', description: 'Please enter a phone number' });
      return;
    }
    
    setResendingLink(true);
    try {
      await api.post(`/api/payment-requests/${resendRequest.id}/send-sms`, { phone });
      showToast({ type: 'success', message: `Payment link sent to ${phone}` });
      setShowResendModal(false);
      setResendRequest(null);
      // Refresh using the existing pattern
      fetchReceipts();
    } catch (error: any) {
      console.error('Failed to send SMS:', error);
      if (error?.message?.includes('not configured')) {
        setShowSmsSetupModal(true);
      } else {
        const errorMsg = error?.message || 'Failed to send payment link via SMS';
        showToast({ type: 'error', message: errorMsg });
      }
    } finally {
      setResendingLink(false);
    }
  };

  // Close resend modal
  const handleCloseResendModal = () => {
    setShowResendModal(false);
    setResendRequest(null);
    setResendClientName('');
    setResendEmail('');
    setResendPhone('');
  };

  // Record Payment handlers
  const handleOpenRecordPayment = () => {
    handleShowInvoicePicker('record');
  };

  const handleOpenRecordPaymentDirect = () => {
    // Pre-fill from selected invoice if available
    if (selectedInvoice) {
      setRecordAmount(selectedInvoice.amountDue.toFixed(2));
      setRecordDescription(`Payment for ${selectedInvoice.invoiceNumber || 'Invoice'}`);
      setRecordClientId(selectedInvoice.clientId);
      setRecordInvoiceId(selectedInvoice.id);
    } else if (amount) {
      setRecordAmount(amount);
      setRecordDescription(description);
    }
    setShowRecordPaymentModal(true);
  };

  const handleCloseRecordPaymentModal = () => {
    setShowRecordPaymentModal(false);
    setRecordPaymentSuccess(null);
    setRecordAmount('');
    setRecordDescription('');
    setRecordClientId(null);
    setRecordInvoiceId(null);
    setRecordPaymentMethod('cash');
    setRecordingPayment(false);
  };

  const handleSubmitRecordPayment = async () => {
    const amountNum = parseFloat(recordAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast({ type: 'info', message: 'Invalid Amount', description: 'Please enter a valid payment amount' });
      return;
    }

    setRecordingPayment(true);
    try {
      const gstAmount = amountNum / 11; // Calculate GST (10% of GST-inclusive amount)
      const subtotal = amountNum - gstAmount;
      
      const response = await api.post<{
        id: string;
        receiptNumber: string;
        amount: string;
      }>('/api/receipts', {
        amount: amountNum.toFixed(2),
        gstAmount: gstAmount.toFixed(2),
        subtotal: subtotal.toFixed(2),
        paymentMethod: recordPaymentMethod,
        notes: recordDescription || undefined,
        description: recordDescription || undefined,
        clientId: recordClientId || undefined,
        invoiceId: recordInvoiceId || undefined,
      });

      if (response.error) {
        showToast({ type: 'error', message: response.error });
        return;
      }
      if (response.data) {
        setRecordPaymentSuccess({
          receiptNumber: response.data.receiptNumber,
          receiptId: response.data.id,
        });
        
        if (recordInvoiceId) {
          fetchInvoices();
        }
      }
    } catch (error: any) {
      console.error('Failed to record payment:', error);
      const msg = error?.message || 'Failed to record payment. Please try again.';
      showToast({ type: 'error', message: msg });
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleSendRecordedReceipt = async (method: 'email' | 'sms') => {
    if (!recordPaymentSuccess) return;
    
    const client = recordClientId ? clients.find(c => c.id === recordClientId) : null;
    
    if (method === 'email') {
      const email = client?.email;
      if (!email) {
        showToast({ type: 'info', message: 'No Email', description: 'No email address found for this client' });
        return;
      }
      
      try {
        await api.post(`/api/receipts/${recordPaymentSuccess.receiptId}/send-email`, { email });
        showToast({ type: 'success', message: `Receipt sent to ${email}` });
      } catch (error) {
        showToast({ type: 'error', message: 'Failed to send receipt email' });
      }
    } else {
      const phone = client?.phone;
      if (!phone) {
        showToast({ type: 'info', message: 'No Phone', description: 'No phone number found for this client' });
        return;
      }
      
      try {
        await api.post(`/api/receipts/${recordPaymentSuccess.receiptId}/send-sms`, { phone });
        showToast({ type: 'success', message: `Receipt sent to ${phone}` });
      } catch (error) {
        showToast({ type: 'error', message: 'Failed to send receipt SMS' });
      }
    }
  };

  // Get unpaid invoices, optionally filtered by client
  const getFilteredInvoices = () => {
    let filtered = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
    if (recordClientId) {
      filtered = filtered.filter(i => i.clientId === recordClientId);
    }
    return filtered;
  };

  // Invoice Picker handlers
  const handleShowInvoicePicker = (method: 'record' | 'qr' | 'link' | 'tap') => {
    // If amount is already entered or invoice selected, skip the picker
    if (amount && parseFloat(amount) > 0) {
      proceedToPaymentMethod(method);
      return;
    }
    
    // If no pending invoices AND no active jobs, show custom amount directly
    if (pendingInvoices.length === 0 && collectibleJobs.length === 0) {
      setPendingPaymentMethod(method);
      setCustomAmountValue('');
      setCustomAmountDescription('');
      setShowCustomAmountModal(true);
      return;
    }
    
    // Show the picker modal (jobs + invoices)
    setPendingPaymentMethod(method);
    setPickerTab(collectibleJobs.length > 0 ? 'jobs' : 'invoices');
    setPickerSearch('');
    setShowInvoicePickerModal(true);
  };

  const handleSelectInvoiceFromPicker = (invoice: any) => {
    const client = getClient(invoice.clientId);
    const invoiceTotal = typeof invoice.total === 'string' ? parseFloat(invoice.total) : (invoice.total || 0);
    const invoicePaid = typeof invoice.amountPaid === 'string' ? parseFloat(invoice.amountPaid) : (invoice.amountPaid || 0);
    const amountDue = invoiceTotal - invoicePaid;
    
    setSelectedInvoice({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      clientName: client?.name || 'Unknown Client',
      clientEmail: client?.email,
      clientPhone: client?.phone,
      total: invoiceTotal,
      amountPaid: invoicePaid,
      amountDue,
    });
    
    setAmount(amountDue.toFixed(2));
    setDescription(`Payment for ${invoice.invoiceNumber || 'Invoice'}`);
    
    setShowInvoicePickerModal(false);
    
    // Wait for picker modal to fully dismiss before opening next modal
    // (iOS pageSheet drops back-to-back modal presentations otherwise)
    const method = pendingPaymentMethod;
    setPendingPaymentMethod(null);
    if (method) {
      setTimeout(() => proceedToPaymentMethod(method), 400);
    }
  };

  const handleSelectJobFromPicker = (job: typeof collectibleJobs[0]) => {
    if (job.outstandingAmount > 0) {
      setAmount(job.outstandingAmount.toFixed(2));
      setDescription(`Payment for ${job.title}`);
      setShowInvoicePickerModal(false);
      setPickerSearch('');
      const method = pendingPaymentMethod;
      setPendingPaymentMethod(null);
      if (method) {
        setTimeout(() => proceedToPaymentMethod(method), 400);
      }
    } else {
      setShowInvoicePickerModal(false);
      setPickerSearch('');
      setCustomAmountValue('');
      setCustomAmountDescription(job.title || '');
      setTimeout(() => setShowCustomAmountModal(true), 400);
    }
  };

  const handleCustomAmountFromPicker = () => {
    setShowInvoicePickerModal(false);
    setPickerSearch('');
    setCustomAmountValue('');
    setCustomAmountDescription('');
    setTimeout(() => setShowCustomAmountModal(true), 400);
  };
  
  const handleSubmitCustomAmount = () => {
    const amountNum = parseFloat(customAmountValue);
    if (isNaN(amountNum) || amountNum < 0.50) {
      showToast({ type: 'info', message: 'Invalid Amount', description: 'Please enter an amount of at least $0.50' });
      return;
    }
    
    const savedMethod = pendingPaymentMethod;
    const savedAmount = customAmountValue;
    const savedDescription = customAmountDescription || 'Payment';
    const savedAmountNum = amountNum;
    
    setAmount(savedAmount);
    setDescription(savedDescription);
    setShowCustomAmountModal(false);
    
    if (savedMethod) {
      setTimeout(() => {
        switch (savedMethod) {
          case 'record':
            setRecordAmount(savedAmount);
            setRecordDescription(savedDescription);
            setShowRecordPaymentModal(true);
            break;
          case 'qr':
            handleQRCodeDirectWithAmount(savedAmountNum);
            break;
          case 'link':
            handlePaymentLinkDirectWithAmount(savedAmountNum);
            break;
          case 'tap':
            handleTapToPayWithAmount(savedAmountNum);
            break;
        }
        setPendingPaymentMethod(null);
      }, 400);
    }
  };

  const handleQRCodeDirectWithAmount = async (amountDollars: number) => {
    const amountCents = Math.round(amountDollars * 100);
    
    setQrLoading(true);
    setShowQRModal(true);

    try {
      const response = await api.post<{ 
        id: string; 
        token: string; 
        paymentUrl: string; 
        amount: string;
        status: string;
      }>('/api/payment-requests', {
        amount: amountDollars,
        description: customAmountDescription || 'Payment',
      });

      if (response.error) {
        showToast({ type: 'error', message: response.error });
        setShowQRModal(false);
        return;
      }
      if (response.data) {
        setQrPaymentUrl(response.data.paymentUrl);
        setQrPaymentRequest(response.data);
      }
    } catch (error: any) {
      console.error('Failed to generate QR code:', error);
      const msg = error?.message || 'Failed to generate QR code';
      showToast({ type: 'error', message: msg });
      setShowQRModal(false);
    } finally {
      setQrLoading(false);
    }
  };
  
  const handlePaymentLinkDirectWithAmount = async (amountDollars: number) => {
    setSendingLink(true);
    
    try {
      const response = await api.post<{ 
        id: string; 
        token: string; 
        paymentUrl: string; 
        amount: string;
        status: string;
      }>('/api/payment-requests', {
        amount: amountDollars,
        description: customAmountDescription || 'Payment',
      });

      if (response.error) {
        showToast({ type: 'error', message: response.error });
        return;
      }
      if (response.data) {
        setPaymentLinkRequest(response.data);
        setShowPaymentLinkModal(true);
      }
    } catch (error: any) {
      console.error('Failed to create payment request:', error);
      const msg = error?.message || 'Failed to create payment link';
      showToast({ type: 'error', message: msg });
    } finally {
      setSendingLink(false);
    }
  };
  
  const handleCloseCustomAmountModal = () => {
    setShowCustomAmountModal(false);
    setCustomAmountValue('');
    setCustomAmountDescription('');
    setPendingPaymentMethod(null);
  };

  const proceedToPaymentMethod = (method: 'record' | 'qr' | 'link' | 'tap') => {
    switch (method) {
      case 'record':
        handleOpenRecordPaymentDirect();
        break;
      case 'qr':
        handleQRCodeDirect();
        break;
      case 'link':
        handlePaymentLinkDirect();
        break;
      case 'tap':
        handleTapToPay();
        break;
    }
  };

  const handleCloseInvoicePickerModal = () => {
    setShowInvoicePickerModal(false);
    setPendingPaymentMethod(null);
    setPickerSearch('');
    setPickerTab('jobs');
  };

  const renderTapToPayModal = () => (
    <AppBottomSheet
      visible={showTapToPayModal}
      onDismiss={handleCancelPayment}
      snapPoints={['90%']}
      scrollable={false}
      contentPadding={0}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Tap to Pay</Text>
          <TouchableOpacity onPress={handleCancelPayment} activeOpacity={0.7}>
            <Feather name="x" size={24} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          {paymentStep === 'connecting' && (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.modalStepTitle}>Connecting...</Text>
              <Text style={styles.modalStepSubtitle}>
                Setting up Tap to Pay on this device
              </Text>
            </>
          )}

          {paymentStep === 'waiting' && (
            <>
              <View style={styles.readyIcon}>
                <Feather name="smartphone" size={64} color={colors.primary} />
              </View>
              <Text style={styles.amountDisplay}>
                ${(getAmountInCents() / 100).toFixed(2)}
              </Text>
              <Text style={styles.modalStepTitle}>Ready for Payment</Text>
              <Text style={styles.modalStepSubtitle}>
                Ask customer to tap their card or phone on the back of your device
              </Text>
              <View style={styles.acceptedMethodsCard}>
                <Text style={styles.acceptedMethodsText}>
                  Accepts contactless cards, Apple Pay, and Google Pay
                </Text>
              </View>
            </>
          )}

          {paymentStep === 'processing' && (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.modalStepTitle}>Processing Payment...</Text>
              <Text style={styles.modalStepSubtitle}>
                Please wait while we process the payment
              </Text>
            </>
          )}

          {paymentStep === 'success' && (
            <>
              <View style={styles.successIcon}>
                <Feather name="check-circle" size={48} color={colors.success} />
              </View>
              <Text style={styles.successTitle}>Payment Successful!</Text>
              <Text style={styles.successAmount}>
                ${(getAmountInCents() / 100).toFixed(2)} received
              </Text>
            </>
          )}

          {paymentStep === 'error' && (
            <>
              <View style={styles.errorIcon}>
                <Feather name="alert-circle" size={48} color={colors.destructive} />
              </View>
              <Text style={styles.errorTitle}>Payment Failed</Text>
              <Text style={styles.modalStepSubtitle}>
                {terminal.error || 'The payment could not be processed. Please try again.'}
              </Text>
              <Button
                variant="default"
                onPress={() => {
                  setPaymentStep('ready');
                  handleTapToPay();
                }}
                fullWidth
              >
                Try Again
              </Button>
            </>
          )}
        </View>

        {(paymentStep === 'waiting' || paymentStep === 'connecting') && (
          <View style={styles.modalFooter}>
            <Button variant="outline" onPress={handleCancelPayment} fullWidth>
              Cancel Payment
            </Button>
          </View>
        )}
      </View>
    </AppBottomSheet>
  );

  const renderQRModal = () => (
    <AppBottomSheet
        visible={showQRModal}
        onDismiss={handleCloseQRModal}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}
      >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Payment QR Code</Text>
          <TouchableOpacity onPress={handleCloseQRModal} activeOpacity={0.7}>
            <Feather name="x" size={24} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          {qrLoading ? (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.modalStepTitle}>Generating QR Code...</Text>
            </>
          ) : qrPaymentUrl ? (
            <>
              <Text style={styles.qrAmountDisplay}>
                ${(getAmountInCents() / 100).toFixed(2)}
              </Text>
              
              {selectedInvoice && (
                <Text style={styles.modalStepSubtitle}>
                  {selectedInvoice.invoiceNumber} • {selectedInvoice.clientName}
                </Text>
              )}
              
              <View style={[styles.qrCodeContainer, { marginTop: spacing.md }]}>
                <View style={styles.qrCodeWrapper}>
                  <Image
                    source={{ 
                      uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrPaymentUrl)}&margin=10` 
                    }}
                    style={styles.qrCodeImage}
                    resizeMode="contain"
                  />
                </View>
              </View>
              
              <Text style={styles.modalStepSubtitle}>
                Customer can scan this code to pay securely online
              </Text>

              <TouchableOpacity 
                style={styles.qrUrlContainer}
                onPress={handleCopyPaymentUrl}
                activeOpacity={0.7}
              >
                <Feather name="link" size={16} color={colors.mutedForeground} />
                <Text style={styles.qrUrlText} numberOfLines={1}>
                  {qrPaymentUrl}
                </Text>
                <Feather name="copy" size={16} color={colors.primary} />
              </TouchableOpacity>

              <View style={styles.qrActionButtons}>
                <Button 
                  variant="outline" 
                  onPress={handleCopyPaymentUrl}
                  style={{ flex: 1 }}
                >
                  <Feather name="copy" size={18} color={colors.foreground} />
                  <Text style={{ marginLeft: spacing.xs }}>Copy Link</Text>
                </Button>
                <Button 
                  variant="default" 
                  onPress={handleSharePaymentUrl}
                  style={{ flex: 1 }}
                >
                  <Feather name="share" size={18} color={colors.primaryForeground} />
                  <Text style={{ marginLeft: spacing.xs, color: colors.primaryForeground }}>Share</Text>
                </Button>
              </View>
            </>
          ) : (
            <Text style={styles.modalStepSubtitle}>Failed to generate QR code</Text>
          )}
        </View>

        <View style={styles.modalFooter}>
          <Button variant="outline" onPress={handleCloseQRModal} fullWidth>
            Done
          </Button>
        </View>
      </View>
    </AppBottomSheet>
  );

  const renderPaymentLinkModal = () => (
    <AppBottomSheet
        visible={showPaymentLinkModal}
        onDismiss={handleClosePaymentLinkModal}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Send Payment Link</Text>
          <TouchableOpacity onPress={handleClosePaymentLinkModal} activeOpacity={0.7}>
            <Feather name="x" size={24} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md }}>
          <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
            <View style={styles.readyIcon}>
              <Feather name="link" size={64} color={colors.primary} />
            </View>
            <Text style={styles.qrAmountDisplay}>
              ${(getAmountInCents() / 100).toFixed(2)}
            </Text>
            {selectedInvoice && (
              <Text style={styles.modalStepSubtitle}>
                {selectedInvoice.invoiceNumber} • {selectedInvoice.clientName}
              </Text>
            )}
          </View>

          <View style={styles.paymentLinkInputContainer}>
            <View>
              <Text style={styles.paymentLinkLabel}>Send via Email</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TextInput
                  style={[styles.descriptionInput, { flex: 1, marginTop: 0 }]}
                  placeholder="Enter email address"
                  placeholderTextColor={colors.mutedForeground}
                  value={linkRecipientEmail}
                  onChangeText={setLinkRecipientEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Button 
                  variant="default" 
                  onPress={sendPaymentLinkViaEmail}
                  disabled={sendingLink || !linkRecipientEmail.trim()}
                >
                  {sendingLink ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Feather name="send" size={18} color={colors.primaryForeground} />
                  )}
                </Button>
              </View>
            </View>

            <View>
              <Text style={styles.paymentLinkLabel}>Send via SMS</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TextInput
                  style={[styles.descriptionInput, { flex: 1, marginTop: 0 }]}
                  placeholder="Enter phone number"
                  placeholderTextColor={colors.mutedForeground}
                  value={linkRecipientPhone}
                  onChangeText={setLinkRecipientPhone}
                  keyboardType="phone-pad"
                />
                <Button 
                  variant="default" 
                  onPress={sendPaymentLinkViaSMS}
                  disabled={sendingLink || !linkRecipientPhone.trim()}
                >
                  {sendingLink ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Feather name="send" size={18} color={colors.primaryForeground} />
                  )}
                </Button>
              </View>
              <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: spacing.xs }}>
                SMS requires Twilio configuration in settings
              </Text>
            </View>

            <View style={{ marginTop: spacing.md }}>
              <Text style={styles.paymentLinkLabel}>Or share manually</Text>
              <TouchableOpacity 
                style={styles.qrUrlContainer}
                onPress={handleCopyPaymentLink}
                activeOpacity={0.7}
              >
                <Feather name="link" size={16} color={colors.mutedForeground} />
                <Text style={styles.qrUrlText} numberOfLines={1}>
                  {paymentLinkRequest?.paymentUrl || 'Loading...'}
                </Text>
                <Feather name="copy" size={16} color={colors.primary} />
              </TouchableOpacity>
              
              <View style={[styles.qrActionButtons, { marginTop: spacing.md }]}>
                <Button 
                  variant="outline" 
                  onPress={handleCopyPaymentLink}
                  style={{ flex: 1 }}
                >
                  <Feather name="copy" size={18} color={colors.foreground} />
                  <Text style={{ marginLeft: spacing.xs }}>Copy</Text>
                </Button>
                <Button 
                  variant="outline" 
                  onPress={handleSharePaymentLink}
                  style={{ flex: 1 }}
                >
                  <Feather name="share" size={18} color={colors.foreground} />
                  <Text style={{ marginLeft: spacing.xs }}>Share</Text>
                </Button>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.modalFooter}>
          <Button variant="outline" onPress={handleClosePaymentLinkModal} fullWidth>
            Done
          </Button>
        </View>
      </View>
    </AppBottomSheet>
  );

  const renderResendModal = () => {
    const requestAmount = resendRequest ? (typeof resendRequest.amount === 'string' ? parseFloat(resendRequest.amount) : (resendRequest.amount || 0)) : 0;
    const notifications = resendRequest?.notificationsSent || [];
    const hasSent = notifications.length > 0;
    
    return (
      <AppBottomSheet
        visible={showResendModal}
        onDismiss={handleCloseResendModal}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{hasSent ? 'Resend' : 'Send'} Payment Link</Text>
            <TouchableOpacity onPress={handleCloseResendModal} activeOpacity={0.7}>
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md }}>
            <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
              <View style={styles.readyIcon}>
                <Feather name="link" size={64} color={colors.primary} />
              </View>
              <Text style={styles.qrAmountDisplay}>
                {formatCurrency(requestAmount)}
              </Text>
              <Text style={styles.modalStepSubtitle}>
                {resendClientName}
              </Text>
            </View>

            <View style={styles.paymentLinkInputContainer}>
              <View>
                <Text style={styles.paymentLinkLabel}>Send via Email</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <TextInput
                    style={[styles.descriptionInput, { flex: 1, marginTop: 0 }]}
                    placeholder="Enter email address"
                    placeholderTextColor={colors.mutedForeground}
                    value={resendEmail}
                    onChangeText={setResendEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Button 
                    variant="default" 
                    onPress={handleResendViaEmail}
                    disabled={resendingLink || !resendEmail.trim()}
                  >
                    {resendingLink ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : (
                      <Feather name="send" size={18} color={colors.primaryForeground} />
                    )}
                  </Button>
                </View>
              </View>

              <View>
                <Text style={styles.paymentLinkLabel}>Send via SMS</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <TextInput
                    style={[styles.descriptionInput, { flex: 1, marginTop: 0 }]}
                    placeholder="Enter phone number"
                    placeholderTextColor={colors.mutedForeground}
                    value={resendPhone}
                    onChangeText={setResendPhone}
                    keyboardType="phone-pad"
                  />
                  <Button 
                    variant="default" 
                    onPress={handleResendViaSMS}
                    disabled={resendingLink || !resendPhone.trim()}
                  >
                    {resendingLink ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : (
                      <Feather name="send" size={18} color={colors.primaryForeground} />
                    )}
                  </Button>
                </View>
              </View>

              {hasSent && (
                <View style={{ marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.muted, borderRadius: 8 }}>
                  <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: spacing.xs }}>
                    Previously sent:
                  </Text>
                  {notifications.map((n: any, i: number) => (
                    <Text key={i} style={{ fontSize: 12, color: colors.foreground }}>
                      {n.type === 'email' ? 'Email' : 'SMS'}: {n.email || n.phone}{n.sentAt ? ` (${format(parseISO(n.sentAt), 'MMM d, h:mm a')})` : ''}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button variant="outline" onPress={handleCloseResendModal} fullWidth>
              Done
            </Button>
          </View>
        </View>
      </AppBottomSheet>
    );
  };

  const renderRecordPaymentModal = () => {
    const paymentMethods: Array<{ id: 'cash' | 'card' | 'bank_transfer'; label: string; icon: string }> = [
      { id: 'cash', label: 'Cash', icon: 'dollar-sign' },
      { id: 'card', label: 'Card/EFTPOS', icon: 'credit-card' },
      { id: 'bank_transfer', label: 'Bank Transfer', icon: 'home' },
    ];

    const filteredInvoices = getFilteredInvoices();

    return (
      <AppBottomSheet
        visible={showRecordPaymentModal}
        onDismiss={handleCloseRecordPaymentModal}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {recordPaymentSuccess ? 'Payment Recorded' : 'Record Payment'}
            </Text>
            <TouchableOpacity onPress={handleCloseRecordPaymentModal} activeOpacity={0.7}>
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {recordPaymentSuccess ? (
            <View style={styles.modalContent}>
              <View style={styles.successIcon}>
                <Feather name="check-circle" size={48} color={colors.success} />
              </View>
              <Text style={styles.successTitle}>Receipt Created!</Text>
              <Text style={styles.successAmount}>{recordPaymentSuccess.receiptNumber}</Text>
              <Text style={[styles.modalStepSubtitle, { marginTop: spacing.sm }]}>
                ${parseFloat(recordAmount).toFixed(2)} recorded as {recordPaymentMethod === 'bank_transfer' ? 'bank transfer' : recordPaymentMethod}
              </Text>
              
              {recordClientId && (
                <View style={{ marginTop: spacing.md, width: '100%', gap: spacing.sm }}>
                  <Text style={styles.sectionLabel}>Send Receipt</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Button 
                      variant="outline" 
                      onPress={() => handleSendRecordedReceipt('email')}
                      style={{ flex: 1 }}
                    >
                      <Feather name="mail" size={18} color={colors.foreground} />
                      <Text style={{ marginLeft: spacing.xs }}>Email</Text>
                    </Button>
                    <Button 
                      variant="outline" 
                      onPress={() => handleSendRecordedReceipt('sms')}
                      style={{ flex: 1 }}
                    >
                      <Feather name="message-circle" size={18} color={colors.foreground} />
                      <Text style={{ marginLeft: spacing.xs }}>SMS</Text>
                    </Button>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md }}>
              <View style={{ gap: spacing.md }}>
                <View>
                  <Text style={styles.paymentLinkLabel}>Amount *</Text>
                  <View style={styles.amountInputContainer}>
                    <Text style={styles.currencySymbol}>$</Text>
                    <TextInput
                      style={styles.amountInput}
                      placeholder="0.00"
                      placeholderTextColor={colors.mutedForeground}
                      value={recordAmount}
                      onChangeText={(t) => setRecordAmount(sanitizeAmountInput(t))}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <View>
                  <Text style={styles.paymentLinkLabel}>Payment Method</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {paymentMethods.map((method) => (
                      <TouchableOpacity
                        key={method.id}
                        onPress={() => setRecordPaymentMethod(method.id)}
                        style={{
                          flex: 1,
                          paddingVertical: spacing.md,
                          paddingHorizontal: spacing.sm,
                          borderRadius: radius.lg,
                          borderWidth: 2,
                          borderColor: recordPaymentMethod === method.id ? colors.primary : (colors.isDark ? colors.borderLight : colors.border),
                          backgroundColor: recordPaymentMethod === method.id ? colors.primaryLight : (colors.isDark ? colors.muted : colors.card),
                          alignItems: 'center',
                          gap: spacing.sm,
                        }}
                        activeOpacity={0.7}
                      >
                        <Feather 
                          name={method.icon as any} 
                          size={20} 
                          color={recordPaymentMethod === method.id ? colors.primary : colors.mutedForeground} 
                        />
                        <Text style={{ 
                          fontSize: 12, 
                          fontWeight: '500',
                          color: recordPaymentMethod === method.id ? colors.primary : colors.foreground,
                        }}>
                          {method.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View>
                  <Text style={styles.paymentLinkLabel}>Description (optional)</Text>
                  <TextInput
                    style={[styles.descriptionInput, { marginTop: 0 }]}
                    placeholder="e.g., Cash payment for kitchen renovation"
                    placeholderTextColor={colors.mutedForeground}
                    value={recordDescription}
                    onChangeText={setRecordDescription}
                  />
                </View>

                <View>
                  <Text style={styles.paymentLinkLabel}>Link to Client (optional)</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: spacing.sm }}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        setRecordClientId(null);
                        setRecordInvoiceId(null);
                      }}
                      style={{
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.md,
                        borderRadius: radius.lg,
                        borderWidth: 1,
                        borderColor: !recordClientId ? colors.primary : (colors.isDark ? colors.borderLight : colors.border),
                        backgroundColor: !recordClientId ? colors.primaryLight : (colors.isDark ? colors.muted : colors.card),
                        marginRight: spacing.sm,
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ 
                        fontSize: 13, 
                        color: !recordClientId ? colors.primary : colors.foreground,
                      }}>
                        No Client
                      </Text>
                    </TouchableOpacity>
                    {clients.slice(0, 10).map((client) => (
                      <TouchableOpacity
                        key={client.id}
                        onPress={() => {
                          setRecordClientId(client.id);
                          setRecordInvoiceId(null); // Reset invoice when client changes
                        }}
                        style={{
                          paddingVertical: spacing.sm,
                          paddingHorizontal: spacing.md,
                          borderRadius: radius.lg,
                          borderWidth: 1,
                          borderColor: recordClientId === client.id ? colors.primary : (colors.isDark ? colors.borderLight : colors.border),
                          backgroundColor: recordClientId === client.id ? colors.primaryLight : (colors.isDark ? colors.muted : colors.card),
                          marginRight: spacing.sm,
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ 
                          fontSize: 13, 
                          color: recordClientId === client.id ? colors.primary : colors.foreground,
                        }}>
                          {client.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {recordClientId && filteredInvoices.length > 0 && (
                  <View>
                    <Text style={styles.paymentLinkLabel}>Link to Invoice (optional)</Text>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={{ marginTop: spacing.sm }}
                    >
                      <TouchableOpacity
                        onPress={() => setRecordInvoiceId(null)}
                        style={{
                          paddingVertical: spacing.sm,
                          paddingHorizontal: spacing.md,
                          borderRadius: radius.lg,
                          borderWidth: 1,
                          borderColor: !recordInvoiceId ? colors.primary : (colors.isDark ? colors.borderLight : colors.border),
                          backgroundColor: !recordInvoiceId ? colors.primaryLight : (colors.isDark ? colors.muted : colors.card),
                          marginRight: spacing.sm,
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ 
                          fontSize: 13, 
                          color: !recordInvoiceId ? colors.primary : colors.foreground,
                        }}>
                          No Invoice
                        </Text>
                      </TouchableOpacity>
                      {filteredInvoices.map((invoice) => {
                        const amountDue = (typeof invoice.total === 'string' ? parseFloat(invoice.total) : invoice.total || 0) - 
                                         (typeof invoice.amountPaid === 'string' ? parseFloat(invoice.amountPaid) : invoice.amountPaid || 0);
                        return (
                          <TouchableOpacity
                            key={invoice.id}
                            onPress={() => {
                              setRecordInvoiceId(invoice.id);
                              setRecordAmount(amountDue.toFixed(2));
                              setRecordDescription(`Payment for ${invoice.invoiceNumber || 'Invoice'}`);
                            }}
                            style={{
                              paddingVertical: spacing.sm,
                              paddingHorizontal: spacing.md,
                              borderRadius: radius.lg,
                              borderWidth: 1,
                              borderColor: recordInvoiceId === invoice.id ? colors.primary : (colors.isDark ? colors.borderLight : colors.border),
                              backgroundColor: recordInvoiceId === invoice.id ? colors.primaryLight : (colors.isDark ? colors.muted : colors.card),
                              marginRight: spacing.sm,
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={{ 
                              fontSize: 13, 
                              fontWeight: '500',
                              color: recordInvoiceId === invoice.id ? colors.primary : colors.foreground,
                            }}>
                              {invoice.invoiceNumber}
                            </Text>
                            <Text style={{ 
                              fontSize: 11, 
                              color: colors.mutedForeground,
                            }}>
                              ${amountDue.toFixed(2)} due
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                <View style={{
                  backgroundColor: colors.successLight,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}>
                  <Feather name="check-circle" size={20} color={colors.success} />
                  <Text style={{ color: colors.success, fontSize: 13, flex: 1 }}>
                    No processing fees - great for cash & EFTPOS payments
                  </Text>
                </View>
              </View>
            </ScrollView>
          )}

          {!recordPaymentSuccess && (
            <View style={styles.modalFooter}>
              <Button 
                variant="default" 
                onPress={handleSubmitRecordPayment} 
                fullWidth
                disabled={recordingPayment || !recordAmount || parseFloat(recordAmount) <= 0}
              >
                {recordingPayment ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <>
                    <Feather name="file-text" size={18} color={colors.primaryForeground} />
                    <Text style={{ marginLeft: spacing.xs, color: colors.primaryForeground, fontWeight: '600' }}>
                      Create Receipt
                    </Text>
                  </>
                )}
              </Button>
            </View>
          )}

          {recordPaymentSuccess && (
            <View style={styles.modalFooter}>
              <Button variant="outline" onPress={handleCloseRecordPaymentModal} fullWidth>
                Done
              </Button>
            </View>
          )}
        </View>
      </AppBottomSheet>
    );
  };

  const renderInvoicePickerModal = () => {
    const searchLower = pickerSearch.toLowerCase();
    const filteredJobs = collectibleJobs.filter(j => {
      if (!pickerSearch) return true;
      return j.title.toLowerCase().includes(searchLower) || 
             (j.clientName || '').toLowerCase().includes(searchLower) ||
             (j.address || '').toLowerCase().includes(searchLower);
    });
    const filteredInvoices = pendingInvoices.filter(inv => {
      if (!pickerSearch) return true;
      const clientName = getClientName(inv.clientId);
      return (inv.invoiceNumber || '').toLowerCase().includes(searchLower) ||
             clientName.toLowerCase().includes(searchLower);
    });
    const statusLabels: Record<string, string> = {
      scheduled: 'Scheduled',
      in_progress: 'In Progress',
      done: 'Completed',
      invoiced: 'Invoiced',
    };
    const statusColors: Record<string, { bg: string; text: string }> = {
      scheduled: { bg: colors.primaryLight || '#EFF6FF', text: colors.primary },
      in_progress: { bg: colors.warningLight || '#FFF7ED', text: colors.warning || '#F59E0B' },
      done: { bg: colors.successLight || '#F0FDF4', text: colors.success || '#22C55E' },
      invoiced: { bg: colors.primaryLight || '#EFF6FF', text: colors.primary },
    };

    return (
      <AppBottomSheet
        visible={showInvoicePickerModal}
        onDismiss={handleCloseInvoicePickerModal}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Collect Payment</Text>
            <TouchableOpacity onPress={handleCloseInvoicePickerModal} activeOpacity={0.7}>
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.isDark ? colors.muted : colors.card,
              borderRadius: radius.xl,
              paddingHorizontal: spacing.md,
              height: 44,
              borderWidth: 1,
              borderColor: colors.isDark ? colors.borderLight : colors.border,
              marginBottom: spacing.sm,
            }}>
              <Feather name="search" size={18} color={colors.mutedForeground} />
              <TextInput
                style={{ flex: 1, marginLeft: spacing.sm, fontSize: 15, color: colors.foreground }}
                placeholder="Search jobs or invoices..."
                placeholderTextColor={colors.mutedForeground}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                autoCorrect={false}
              />
              {pickerSearch.length > 0 && (
                <TouchableOpacity onPress={() => setPickerSearch('')} activeOpacity={0.7}>
                  <Feather name="x-circle" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              <TouchableOpacity
                onPress={() => setPickerTab('jobs')}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.lg,
                  backgroundColor: pickerTab === 'jobs' ? colors.primary : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text style={{ 
                  fontSize: 14, fontWeight: '600',
                  color: pickerTab === 'jobs' ? colors.primaryForeground : colors.mutedForeground 
                }}>
                  Jobs ({filteredJobs.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPickerTab('invoices')}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.lg,
                  backgroundColor: pickerTab === 'invoices' ? colors.primary : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text style={{ 
                  fontSize: 14, fontWeight: '600',
                  color: pickerTab === 'invoices' ? colors.primaryForeground : colors.mutedForeground 
                }}>
                  Invoices ({filteredInvoices.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView 
            style={styles.invoicePickerScrollView}
            contentContainerStyle={styles.invoicePickerContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity 
              style={[styles.customAmountButton, { marginBottom: spacing.md, borderWidth: 1, borderColor: colors.primary + '30', borderRadius: radius.lg, backgroundColor: colors.primary + '08' }]}
              onPress={handleCustomAmountFromPicker}
              activeOpacity={0.7}
            >
              <Feather name="dollar-sign" size={20} color={colors.primary} />
              <Text style={[styles.customAmountButtonText, { color: colors.primary }]}>Quick Collect — Custom Amount</Text>
            </TouchableOpacity>

            {pickerTab === 'jobs' ? (
              <>
                {filteredJobs.length === 0 ? (
                  <View style={styles.invoicePickerEmpty}>
                    <Feather name="briefcase" size={40} color={colors.mutedForeground} />
                    <Text style={styles.invoicePickerEmptyText}>
                      {pickerSearch ? 'No matching jobs found' : 'No active jobs'}
                    </Text>
                  </View>
                ) : (
                  filteredJobs.map(job => {
                    const sc = statusColors[job.status] || statusColors.scheduled;
                    return (
                      <TouchableOpacity 
                        key={job.id}
                        style={styles.invoicePickerItem}
                        onPress={() => handleSelectJobFromPicker(job)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.invoicePickerItemContent}>
                          <View style={styles.invoicePickerItemHeader}>
                            <Text style={styles.invoicePickerItemTitle} numberOfLines={1}>{job.title}</Text>
                            <View style={{ backgroundColor: sc.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: sc.text }}>{statusLabels[job.status] || job.status}</Text>
                            </View>
                          </View>
                          <Text style={styles.invoicePickerItemClient} numberOfLines={1}>{job.clientName}</Text>
                          {job.address && (
                            <Text style={[styles.invoicePickerItemClient, { fontSize: 12, marginTop: 1 }]} numberOfLines={1}>{job.address}</Text>
                          )}
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          {job.outstandingAmount > 0 ? (
                            <>
                              <Text style={[styles.invoicePickerItemAmount, job.hasOverdue && { color: colors.destructive }]}>
                                {formatCurrency(job.outstandingAmount)}
                              </Text>
                              <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                                {job.invoiceCount} inv{job.invoiceCount !== 1 ? 's' : ''}
                              </Text>
                            </>
                          ) : (
                            <Text style={{ fontSize: 13, color: colors.mutedForeground, fontStyle: 'italic' }}>
                              Quick collect
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </>
            ) : (
              <>
                {filteredInvoices.length === 0 ? (
                  <View style={styles.invoicePickerEmpty}>
                    <Feather name="file-text" size={40} color={colors.mutedForeground} />
                    <Text style={styles.invoicePickerEmptyText}>
                      {pickerSearch ? 'No matching invoices found' : 'No pending invoices'}
                    </Text>
                  </View>
                ) : (
                  filteredInvoices.map(invoice => {
                    const invoiceTotal = typeof invoice.total === 'string' ? parseFloat(invoice.total) : (invoice.total || 0);
                    const invoicePaid = typeof invoice.amountPaid === 'string' ? parseFloat(invoice.amountPaid) : (invoice.amountPaid || 0);
                    const amountDue = invoiceTotal - invoicePaid;
                    const isOverdue = invoice.status === 'overdue';
                    const isPartiallyPaid = invoicePaid > 0 && amountDue > 0;
                    const statusColor = isOverdue ? colors.destructive : (isPartiallyPaid ? colors.warning : colors.primary);
                    const statusBg = isOverdue ? colors.destructiveLight : (isPartiallyPaid ? colors.warningLight : colors.primaryLight);
                    
                    return (
                      <TouchableOpacity 
                        key={invoice.id}
                        style={styles.invoicePickerItem}
                        onPress={() => handleSelectInvoiceFromPicker(invoice)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.invoicePickerStatusIcon, { backgroundColor: statusBg }]}>
                          <Feather 
                            name={isOverdue ? 'alert-circle' : (isPartiallyPaid ? 'clock' : 'file-text')} 
                            size={18} 
                            color={statusColor} 
                          />
                        </View>
                        <View style={styles.invoicePickerItemContent}>
                          <View style={styles.invoicePickerItemHeader}>
                            <Text style={styles.invoicePickerItemTitle}>{invoice.invoiceNumber}</Text>
                            {isOverdue && (
                              <Badge variant="destructive">Overdue</Badge>
                            )}
                            {isPartiallyPaid && !isOverdue && (
                              <Badge variant="warning">Partial</Badge>
                            )}
                          </View>
                          <Text style={styles.invoicePickerItemClient} numberOfLines={1}>{getClientName(invoice.clientId)}</Text>
                          {isPartiallyPaid && (
                            <Text style={styles.invoicePickerItemMeta}>
                              {formatCurrency(invoicePaid)} of {formatCurrency(invoiceTotal)} paid
                            </Text>
                          )}
                        </View>
                        <View style={styles.invoicePickerItemRight}>
                          <Text style={[styles.invoicePickerItemAmount, isOverdue && { color: colors.destructive }]}>
                            {formatCurrency(amountDue)}
                          </Text>
                          <Text style={styles.invoicePickerItemAmountLabel}>
                            {isPartiallyPaid ? 'remaining' : 'due'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </>
            )}

          </ScrollView>
        </View>
      </AppBottomSheet>
    );
  };
  
  const renderCustomAmountModal = () => {
    const canContinue = customAmountValue && parseFloat(customAmountValue) >= 0.50;
    
    return (
      <AppBottomSheet
        visible={showCustomAmountModal}
        onDismiss={handleCloseCustomAmountModal}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Enter Amount</Text>
            <TouchableOpacity onPress={handleCloseCustomAmountModal} activeOpacity={0.7}>
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView 
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
          >
            <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <View style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: colors.primaryLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing.md,
                }}>
                  <Feather name="dollar-sign" size={32} color={colors.primary} />
                </View>
                <Text style={{ ...typography.largeTitle, color: colors.foreground, marginBottom: spacing.xs }}>
                  Payment Amount
                </Text>
                <Text style={{ ...typography.caption, color: colors.mutedForeground }}>
                  Enter the amount to collect
                </Text>
              </View>

              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.isDark ? colors.muted : colors.card,
                borderRadius: radius['2xl'],
                paddingHorizontal: spacing.lg,
                height: 72,
                borderWidth: 2,
                borderColor: customAmountValue ? colors.primary : (colors.isDark ? colors.borderLight : colors.border),
                marginBottom: spacing.xs,
              }}>
                <Text style={{ fontSize: 28, fontWeight: '700', color: colors.mutedForeground }}>$</Text>
                <TextInput
                  style={{
                    flex: 1,
                    marginLeft: spacing.xs,
                    fontSize: 28,
                    lineHeight: 36,
                    fontWeight: '700',
                    color: colors.foreground,
                    paddingVertical: spacing.sm,
                    textAlignVertical: 'center',
                  }}
                  value={customAmountValue}
                  onChangeText={(t) => setCustomAmountValue(sanitizeAmountInput(t))}
                  placeholder="0.00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  autoFocus
                />
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginBottom: spacing.lg }}>
                Minimum amount: $0.50
              </Text>
              
              <Text style={[styles.sectionLabel]}>Description (Optional)</Text>
              <TextInput
                style={styles.descriptionInput}
                value={customAmountDescription}
                onChangeText={setCustomAmountDescription}
                placeholder="What's this payment for?"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />

              <View style={{ marginTop: spacing.lg }}>
                <SheetButton
                  onPress={handleSubmitCustomAmount}
                  fullWidth
                  disabled={!canContinue}
                  label={canContinue ? `Continue — $${parseFloat(customAmountValue).toFixed(2)}` : 'Continue'}
                  trailingIcon={<Feather name="arrow-right" size={18} color={colors.primaryForeground} />}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </AppBottomSheet>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomNavHeight + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refreshData}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.heroSection}>
            <Text style={styles.pageTitle}>Collect Payment</Text>
            <Text style={styles.pageSubtitle}>Get paid instantly with multiple options</Text>
          </View>

          {/* Compact Quick Links */}
          <View style={styles.compactQuickLinksRow}>
            <TouchableOpacity 
              style={styles.compactQuickLink} 
              activeOpacity={0.7}
              onPress={() => router.push('/more/invoices')}
            >
              <Feather name="file-text" size={14} color={colors.foreground} />
              <Text style={styles.compactQuickLinkText}>Invoices</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.compactQuickLink} 
              activeOpacity={0.7}
              onPress={() => router.push('/more/payments')}
            >
              <Feather name="clock" size={14} color={colors.foreground} />
              <Text style={styles.compactQuickLinkText}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.compactQuickLink} 
              activeOpacity={0.7}
              onPress={() => router.push('/more/receipts')}
            >
              <Feather name="file-text" size={14} color={colors.foreground} />
              <Text style={styles.compactQuickLinkText}>Receipts</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Payment Methods</Text>

          <PaymentMethodCard
            icon={<Feather name="grid" size={24} color={colors.primary} />}
            title="QR Code"
            description="Customer scans and pays online ~1.95% + $0.30"
            badge="Works Now"
            badgeVariant="success"
            onPress={handleQRCode}
            colors={colors}
          />

          <PaymentMethodCard
            icon={<Feather name="credit-card" size={24} color={colors.primary} />}
            title="Payment Link"
            description="Send via SMS or email ~1.95% + $0.30"
            badge="Works Now"
            badgeVariant="success"
            onPress={handlePaymentLink}
            colors={colors}
          />

          <PaymentMethodCard
            icon={<Feather name="dollar-sign" size={24} color={colors.success} />}
            title="Record Payment"
            description="Cash, EFTPOS, or bank transfer - no processing fees"
            badge="No Fees"
            badgeVariant="success"
            onPress={handleOpenRecordPayment}
            colors={colors}
          />

          {/* Ongoing Payments Section - Shows pending requests + completed payments */}
          <View style={styles.recentPaymentsSection}>
            <View style={styles.pendingSectionHeader}>
              <Feather name="clock" size={18} color={colors.primary} />
              <Text style={styles.pendingSectionTitle}>Ongoing Payments</Text>
            </View>
            
            {receiptsLoading ? (
              <View style={styles.emptyPending}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.emptyPendingText}>Loading...</Text>
              </View>
            ) : paymentRequests.length === 0 && recentReceipts.length === 0 ? (
              <View style={styles.emptyPending}>
                <Feather name="inbox" size={32} color={colors.mutedForeground} />
                <Text style={styles.emptyPendingText}>No ongoing payments</Text>
              </View>
            ) : (
              <>
                {/* Pending Payment Requests (QR codes & Payment Links) */}
                {paymentRequests
                  .filter(req => req.status === 'pending')
                  .slice(0, 5)
                  .map((request, index) => {
                    const requestAmount = typeof request.amount === 'string' ? parseFloat(request.amount) : (request.amount || 0);
                    const requestDate = request.createdAt ? format(parseISO(request.createdAt), 'MMM d') : '';
                    const client = request.clientId ? clients.find(c => c.id === request.clientId) : null;
                    const clientName = client?.name || 'Customer';
                    const isQR = !!request.qrCodeUrl;
                    
                    return (
                      <TouchableOpacity
                        key={`req-${request.id || index}`}
                        style={styles.recentPaymentItem}
                        activeOpacity={0.7}
                        onPress={() => {
                          const paymentUrl = request.paymentUrl || request.qrCodeUrl;
                          // Build notification status info
                          const notifications = request.notificationsSent || [];
                          let deliveryStatus = '';
                          if (notifications.length > 0) {
                            const emailSent = notifications.find((n: any) => n.type === 'email');
                            const smsSent = notifications.find((n: any) => n.type === 'sms');
                            const statusParts: string[] = [];
                            if (emailSent) {
                              const emailDate = emailSent.sentAt ? format(parseISO(emailSent.sentAt), 'MMM d, h:mm a') : '';
                              statusParts.push(`Email: Sent${emailDate ? ` on ${emailDate}` : ''}`);
                            }
                            if (smsSent) {
                              const smsDate = smsSent.sentAt ? format(parseISO(smsSent.sentAt), 'MMM d, h:mm a') : '';
                              statusParts.push(`SMS: Sent${smsDate ? ` on ${smsDate}` : ''}`);
                            }
                            if (statusParts.length > 0) {
                              deliveryStatus = '\n\nDelivery:\n' + statusParts.join('\n');
                            }
                          } else {
                            deliveryStatus = '\n\nDelivery: Not yet sent to client';
                          }
                          
                          const createdDate = request.createdAt ? format(parseISO(request.createdAt), 'MMM d, h:mm a') : '';
                          const expiresDate = request.expiresAt ? format(parseISO(request.expiresAt), 'MMM d') : '';
                          
                          Alert.alert(
                            isQR ? 'QR Code Payment' : 'Payment Link',
                            `${clientName}\n${formatCurrency(requestAmount)}\n\nStatus: Awaiting Payment${createdDate ? `\nCreated: ${createdDate}` : ''}${expiresDate ? `\nExpires: ${expiresDate}` : ''}${deliveryStatus}`,
                            [
                              { text: 'Close', style: 'cancel' },
                              { text: notifications.length > 0 ? 'Resend' : 'Send', onPress: () => handleResendPaymentRequest(request, clientName) },
                              paymentUrl ? { text: 'Copy', onPress: () => Clipboard.setStringAsync(paymentUrl).then(() => showToast({ type: 'success', message: 'Copied!', description: 'Payment link copied to clipboard' })) } : null,
                            ].filter(Boolean) as any
                          );
                        }}
                      >
                        <View style={styles.recentPaymentLeft}>
                          <View style={[styles.recentPaymentIconContainer, { backgroundColor: colors.warningLight }]}>
                            <Feather 
                              name={isQR ? 'grid' : 'link'} 
                              size={18} 
                              color={colors.warning} 
                            />
                          </View>
                          <View style={styles.recentPaymentContent}>
                            <Text style={styles.recentPaymentClient}>{clientName}</Text>
                            <Text style={styles.recentPaymentMeta}>
                              {isQR ? 'QR Code' : 'Payment Link'} • {requestDate}
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.recentPaymentAmount, { color: colors.foreground }]}>
                            {formatCurrency(requestAmount)}
                          </Text>
                          <Badge variant="warning" style={{ marginTop: 4 }}>In Progress</Badge>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                
                {/* Paid Payment Requests (QR/Link payments completed) */}
                {paymentRequests
                  .filter(req => req.status === 'paid')
                  .slice(0, 5)
                  .map((request, index) => {
                    const requestAmount = typeof request.amount === 'string' ? parseFloat(request.amount) : (request.amount || 0);
                    const requestDate = request.paidAt ? format(parseISO(request.paidAt), 'MMM d') : (request.createdAt ? format(parseISO(request.createdAt), 'MMM d') : '');
                    const client = request.clientId ? clients.find(c => c.id === request.clientId) : null;
                    const clientName = client?.name || 'Customer';
                    const isQR = !!request.qrCodeUrl;
                    
                    return (
                      <TouchableOpacity
                        key={`paid-${request.id || index}`}
                        style={styles.recentPaymentItem}
                        activeOpacity={0.7}
                        onPress={() => {
                          showToast({ type: 'info', message: 'Payment Complete', description: `${clientName}\n${formatCurrency(requestAmount)}\n\nPaid via ${isQR ? 'QR Code' : 'Payment Link'}${requestDate ? ` on ${requestDate}` : ''}` });
                        }}
                      >
                        <View style={styles.recentPaymentLeft}>
                          <View style={[styles.recentPaymentIconContainer, { backgroundColor: colors.successLight }]}>
                            <Feather 
                              name={isQR ? 'grid' : 'link'} 
                              size={18} 
                              color={colors.success} 
                            />
                          </View>
                          <View style={styles.recentPaymentContent}>
                            <Text style={styles.recentPaymentClient}>{clientName}</Text>
                            <Text style={styles.recentPaymentMeta}>
                              {isQR ? 'QR Code' : 'Payment Link'} • {requestDate}
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.recentPaymentAmount}>
                            +{formatCurrency(requestAmount)}
                          </Text>
                          <Badge variant="success" style={{ marginTop: 4 }}>Paid</Badge>
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                {/* Completed Payments (Receipts from manual payments) */}
                {recentReceipts.slice(0, 5).map((receipt, index) => {
                  const receiptAmount = typeof receipt.amount === 'string' ? parseFloat(receipt.amount) : (receipt.amount || 0);
                  const receiptDate = receipt.createdAt ? format(parseISO(receipt.createdAt), 'MMM d') : '';
                  const client = receipt.clientId ? clients.find(c => c.id === receipt.clientId) : null;
                  const clientName = client?.name || 'Walk-in Customer';
                  const paymentMethod = getPaymentMethodLabel(receipt.paymentMethod || 'other');
                  
                  return (
                    <TouchableOpacity
                      key={`rcpt-${receipt.id || index}`}
                      style={styles.recentPaymentItem}
                      activeOpacity={0.7}
                      onPress={() => router.push(`/more/receipt/${receipt.id}`)}
                    >
                      <View style={styles.recentPaymentLeft}>
                        <View style={[styles.recentPaymentIconContainer, { backgroundColor: colors.successLight }]}>
                          <Feather 
                            name={getPaymentMethodIcon(receipt.paymentMethod || 'other') as any} 
                            size={18} 
                            color={colors.success} 
                          />
                        </View>
                        <View style={styles.recentPaymentContent}>
                          <Text style={styles.recentPaymentClient}>{clientName}</Text>
                          <Text style={styles.recentPaymentMeta}>
                            {paymentMethod} • {receiptDate}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.recentPaymentAmount}>
                          +{formatCurrency(receiptAmount)}
                        </Text>
                        <Badge variant="success" style={{ marginTop: 4 }}>Paid</Badge>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                
                {/* Expired/Cancelled Payment Requests */}
                {paymentRequests
                  .filter(req => req.status === 'expired' || req.status === 'cancelled')
                  .slice(0, 3)
                  .map((request, index) => {
                    const requestAmount = typeof request.amount === 'string' ? parseFloat(request.amount) : (request.amount || 0);
                    const requestDate = request.createdAt ? format(parseISO(request.createdAt), 'MMM d') : '';
                    const client = request.clientId ? clients.find(c => c.id === request.clientId) : null;
                    const clientName = client?.name || 'Customer';
                    const isQR = !!request.qrCodeUrl;
                    
                    return (
                      <TouchableOpacity
                        key={`exp-${request.id || index}`}
                        style={[styles.recentPaymentItem, { opacity: 0.6 }]}
                        activeOpacity={0.7}
                        onPress={() => {
                          showToast({ type: 'info', message: request.status === 'expired' ? 'Payment Expired' : 'Payment Cancelled', description: `${clientName}\n${formatCurrency(requestAmount)}\n\n${isQR ? 'QR Code' : 'Payment Link'} ${request.status === 'expired' ? 'expired' : 'was cancelled'}${requestDate ? ` on ${requestDate}` : ''}` });
                        }}
                      >
                        <View style={styles.recentPaymentLeft}>
                          <View style={[styles.recentPaymentIconContainer, { backgroundColor: colors.mutedForeground + '20' }]}>
                            <Feather 
                              name={isQR ? 'grid' : 'link'} 
                              size={18} 
                              color={colors.mutedForeground} 
                            />
                          </View>
                          <View style={styles.recentPaymentContent}>
                            <Text style={[styles.recentPaymentClient, { color: colors.mutedForeground }]}>{clientName}</Text>
                            <Text style={styles.recentPaymentMeta}>
                              {isQR ? 'QR Code' : 'Payment Link'} • {requestDate}
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.recentPaymentAmount, { color: colors.mutedForeground }]}>
                            {formatCurrency(requestAmount)}
                          </Text>
                          <Badge variant="secondary" style={{ marginTop: 4 }}>
                            {request.status === 'expired' ? 'Expired' : 'Cancelled'}
                          </Badge>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </>
            )}
          </View>

          <Card style={styles.infoCard}>
            <CardContent>
              <Text style={styles.infoCardTitle}>Accepted Payment Methods</Text>
              <Text style={styles.infoCardText}>
                Visa, Mastercard, American Express, Apple Pay, Google Pay
              </Text>
              <Text style={styles.infoCardFees}>
                2.9% + $0.30 per transaction Deposits within 2 business days
              </Text>
            </CardContent>
          </Card>

        </ScrollView>

        {renderTapToPayModal()}
        {renderReceiptModal()}
        {renderQRModal()}
        {renderPaymentLinkModal()}
        {renderResendModal()}
        {renderRecordPaymentModal()}
        {renderInvoicePickerModal()}
        {renderCustomAmountModal()}
        {renderSmsSetupModal()}
      </View>
    </>
  );

  function renderSmsSetupModal() {
    const instructions = smsStatus?.setupInstructions;
    
    return (
      <AppBottomSheet
        visible={showSmsSetupModal}
        onDismiss={() => setShowSmsSetupModal(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set Up SMS Messaging</Text>
            <TouchableOpacity onPress={() => setShowSmsSetupModal(false)} activeOpacity={0.7}>
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md }}>
            <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
              <View style={[styles.readyIcon, { backgroundColor: colors.warningLight }]}>
                <Feather name="message-circle" size={48} color={colors.warning} />
              </View>
              <Text style={[styles.successTitle, { marginTop: spacing.md }]}>
                SMS Not Configured
              </Text>
              <Text style={[styles.modalStepSubtitle, { textAlign: 'center', marginTop: spacing.sm }]}>
                {instructions?.description || "To send SMS messages to your clients, you need to connect your own Twilio account."}
              </Text>
            </View>

            <View style={{ 
              backgroundColor: colors.card, 
              borderRadius: radius.lg, 
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border
            }}>
              <Text style={[styles.sectionLabel, { marginBottom: spacing.md }]}>
                Quick Setup Guide
              </Text>
              
              {(instructions?.steps || [
                "Create a free Twilio account at twilio.com",
                "Get your Account SID and Auth Token from the Twilio Console",
                "Purchase or verify a phone number in Twilio",
                "Go to Settings > Integrations on the web app to enter your credentials"
              ]).map((step, index) => (
                <View key={index} style={{ flexDirection: 'row', marginBottom: spacing.sm }}>
                  <View style={{ 
                    width: 24, 
                    height: 24, 
                    borderRadius: 12, 
                    backgroundColor: colors.primary, 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    marginRight: spacing.sm
                  }}>
                    <Text style={{ color: colors.primaryForeground, fontSize: 12, fontWeight: 'bold' }}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={{ flex: 1, color: colors.foreground, fontSize: 14 }}>
                    {step}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ 
              backgroundColor: colors.infoLight, 
              borderRadius: radius.lg, 
              padding: spacing.md,
              marginTop: spacing.md
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                <Feather name="info" size={16} color={colors.info} />
                <Text style={{ marginLeft: spacing.xs, color: colors.info, fontWeight: '600' }}>
                  Why your own Twilio account?
                </Text>
              </View>
              <Text style={{ color: colors.foreground, fontSize: 13 }}>
                Each business sets up their own Twilio account to keep your SMS costs separate and give you full control over your messaging. Twilio offers pay-as-you-go pricing with no monthly fees.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button variant="outline" onPress={() => setShowSmsSetupModal(false)} fullWidth>
              Got It
            </Button>
          </View>
        </View>
      </AppBottomSheet>
    );
  }

  function renderReceiptModal() {
    return (
      <AppBottomSheet
        visible={showReceiptModal}
        onDismiss={handleCloseReceiptModal}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Send Receipt</Text>
            <TouchableOpacity onPress={handleCloseReceiptModal} activeOpacity={0.7}>
              <Feather name="x" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.successIcon}>
              <Feather name="check-circle" size={48} color={colors.success} />
            </View>
            <Text style={styles.successTitle}>Payment Complete!</Text>
            <Text style={styles.successAmount}>
              ${(lastPaymentAmount / 100).toFixed(2)} received
            </Text>
            
            {selectedInvoice && (
              <Text style={[styles.modalStepSubtitle, { marginTop: spacing.sm }]}>
                {selectedInvoice.invoiceNumber} • {selectedInvoice.clientName}
              </Text>
            )}

            {autoReceiptWasSent && (
              <View style={{ marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.success + '15', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 }}>
                <Feather name="check" size={16} color={colors.success} />
                <Text style={{ color: colors.success, fontSize: 14, fontWeight: '600' }}>
                  Receipt sent automatically
                </Text>
              </View>
            )}

            <View style={{ marginTop: spacing.md, width: '100%', gap: spacing.sm }}>
              <View>
                <PressableRow
                  style={[
                    styles.paymentMethodCard,
                    sendingReceipt && styles.paymentMethodCardDisabled
                  ]}
                  onPress={sendReceiptEmail}
                  disabled={sendingReceipt}

                >
                  <View style={[styles.paymentMethodIcon, { backgroundColor: colors.infoLight }]}>
                    <Feather name="mail" size={24} color={colors.info} />
                  </View>
                  <View style={styles.paymentMethodContent}>
                    <Text style={styles.paymentMethodTitle}>Email Receipt</Text>
                    <Text style={styles.paymentMethodDescription}>
                      {manualEmail || selectedInvoice?.clientEmail || 'Enter email below'}
                    </Text>
                  </View>
                  {sendingReceipt ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Feather name="send" size={20} color={colors.mutedForeground} />
                  )}
                </PressableRow>
                {!selectedInvoice?.clientEmail && (
                  <TextInput
                    style={styles.receiptInput}
                    placeholder="Enter email address"
                    placeholderTextColor={colors.mutedForeground}
                    value={manualEmail}
                    onChangeText={setManualEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                )}
              </View>

              <View>
                <PressableRow
                  style={[
                    styles.paymentMethodCard,
                    sendingReceipt && styles.paymentMethodCardDisabled
                  ]}
                  onPress={sendReceiptSMS}
                  disabled={sendingReceipt}

                >
                  <View style={[styles.paymentMethodIcon, { backgroundColor: colors.successLight }]}>
                    <Feather name="message-circle" size={24} color={colors.success} />
                  </View>
                  <View style={styles.paymentMethodContent}>
                    <Text style={styles.paymentMethodTitle}>SMS Receipt</Text>
                    <Text style={styles.paymentMethodDescription}>
                      {manualPhone || selectedInvoice?.clientPhone || 'Enter phone below'}
                    </Text>
                  </View>
                  {sendingReceipt ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Feather name="send" size={20} color={colors.mutedForeground} />
                  )}
                </PressableRow>
                {!selectedInvoice?.clientPhone && (
                  <TextInput
                    style={styles.receiptInput}
                    placeholder="Enter phone number"
                    placeholderTextColor={colors.mutedForeground}
                    value={manualPhone}
                    onChangeText={setManualPhone}
                    keyboardType="phone-pad"
                  />
                )}
              </View>
            </View>
          </View>

          <View style={styles.modalFooter}>
            <Button variant="outline" onPress={handleCloseReceiptModal} fullWidth>
              Skip - No Receipt Needed
            </Button>
          </View>
        </View>
      </AppBottomSheet>
    );
  }
}
