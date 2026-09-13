/**
 * ManageTabPaymentSection
 *
 * Renders the three payment-collection blocks that live on the Manage tab:
 *
 *  1. Quick Collect card — job done/in-progress, no invoice, positive total
 *  2. PaymentCollectionCard — invoice exists and is not yet fully paid
 *  3. Payment Received card — a receipt is already linked to the job
 *
 * Extracted from job/[id].tsx so it can be imported and tested in isolation.
 */

import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { spacing, radius, typography, fontWeights, iconSizes, shadows } from '../../lib/design-tokens';
import { PaymentCollectionCard } from '../JobWorkflowComponents';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaymentSectionLinkedReceipt {
  id: string;
  receiptNumber?: string | null;
  paymentMethod?: string | null;
  createdAt?: string | null;
  amount: number;
}

export interface PaymentSectionInvoice {
  id: string;
  number: string;
  status: string;
  total: number;
  paidAmount?: number;
}

export interface ManageTabPaymentSectionProps {
  isSubcontractorUser: boolean;
  canCollectPayments: boolean;
  /** job.status from the screen */
  jobStatus: string;
  jobId: string;
  invoice: PaymentSectionInvoice | null;
  quickCollectTotal: number;
  quickCollectSource: 'quote' | 'materials' | 'custom';
  linkedReceipt: PaymentSectionLinkedReceipt | null;
  isQuickCollecting: boolean;
  /** Whether the iOS Tap-to-Pay button should appear in the Quick Collect row */
  showTapToPay?: boolean;
  onQuickCollectCash: () => void;
  onQuickCollectCard: () => void;
  onQuickCollectBank: () => void;
  onTapToPayQuickCollect: () => void;
  onTapToPay: () => void;
  onQRCode: () => void;
  onPaymentLink: () => void;
  onRecordCash: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ManageTabPaymentSection({
  isSubcontractorUser,
  canCollectPayments,
  jobStatus,
  jobId,
  invoice,
  quickCollectTotal,
  quickCollectSource,
  linkedReceipt,
  isQuickCollecting,
  showTapToPay = false,
  onQuickCollectCash,
  onQuickCollectCard,
  onQuickCollectBank,
  onTapToPayQuickCollect,
  onTapToPay,
  onQRCode,
  onPaymentLink,
  onRecordCash,
}: ManageTabPaymentSectionProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const jobDoneOrInProgress = jobStatus === 'done' || jobStatus === 'in_progress';

  // Visibility guards — same conditions as renderManageTab() in job/[id].tsx
  const showQuickCollect =
    !isSubcontractorUser &&
    canCollectPayments &&
    jobDoneOrInProgress &&
    !invoice &&
    quickCollectTotal > 0;

  const showPaymentCollection = !isSubcontractorUser;

  const showPaymentReceived = !isSubcontractorUser && linkedReceipt !== null;

  const showSectionHeader =
    !isSubcontractorUser &&
    canCollectPayments &&
    (linkedReceipt !== null ||
      (invoice !== null && invoice.status !== 'paid') ||
      (jobDoneOrInProgress && !invoice && quickCollectTotal > 0));

  if (!showSectionHeader && !showPaymentCollection && !showPaymentReceived) {
    return null;
  }

  return (
    <>
      {/* Section header */}
      {showSectionHeader && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm }}>
          <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.bold, color: colors.mutedForeground, letterSpacing: 0.5, textTransform: 'uppercase' }}>Payment</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </View>
      )}

      {/* Quick Collect card */}
      {showQuickCollect && (
        <View testID="quick-collect-card" style={[styles.card, { borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: `${colors.success}15` }]}>
              <Feather name="zap" size={iconSizes.lg} color={colors.success} />
            </View>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: colors.foreground }]}>Quick Collect</Text>
              <View style={[styles.badge, { backgroundColor: `${colors.success}20` }]}>
                <Text style={[styles.badgeText, { color: colors.success }]}>No Invoice Needed</Text>
              </View>
            </View>
          </View>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            Collect payment on the spot. Invoice and receipt created automatically.
          </Text>
          <View style={[styles.amountBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Text style={[styles.amountLabel, { color: colors.mutedForeground }]}>
              {quickCollectSource === 'quote' ? 'From accepted quote' : 'From materials'}
            </Text>
            <Text style={[styles.amountValue, { color: colors.foreground }]}>
              {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(quickCollectTotal)}
            </Text>
          </View>
          <View style={styles.buttons}>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                testID="quick-collect-cash"
                style={[styles.button, { backgroundColor: `${colors.success}15` }]}
                onPress={onQuickCollectCash}
                disabled={isQuickCollecting}
                activeOpacity={0.8}
              >
                <Feather name="dollar-sign" size={18} color={colors.success} />
                <Text style={[styles.buttonText, { color: colors.success }]}>Cash</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="quick-collect-card-link"
                style={[styles.button, { backgroundColor: `${colors.primary}12` }]}
                onPress={onQuickCollectCard}
                disabled={isQuickCollecting}
                activeOpacity={0.8}
              >
                <Feather name="link" size={18} color={colors.primary} />
                <Text style={[styles.buttonText, { color: colors.primary }]}>Card Link</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                testID="quick-collect-bank"
                style={[styles.button, { backgroundColor: `${colors.info}12` }]}
                onPress={onQuickCollectBank}
                disabled={isQuickCollecting}
                activeOpacity={0.8}
              >
                <Feather name="repeat" size={18} color={colors.info} />
                <Text style={[styles.buttonText, { color: colors.info }]}>Bank</Text>
              </TouchableOpacity>
              {showTapToPay && (
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: `${colors.warning}12` }]}
                  onPress={onTapToPayQuickCollect}
                  disabled={isQuickCollecting}
                  activeOpacity={0.8}
                >
                  <Feather name="smartphone" size={18} color={colors.warning} />
                  <Text style={[styles.buttonText, { color: colors.warning }]}>Tap to Pay</Text>
                </TouchableOpacity>
              )}
            </View>
            {isQuickCollecting && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingTop: spacing.xs }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>Processing payment...</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Payment Collection Card — invoice exists and not yet fully paid */}
      {showPaymentCollection && (
        <PaymentCollectionCard
          invoice={invoice}
          jobId={jobId}
          canCollectPayments={canCollectPayments}
          onTapToPay={onTapToPay}
          onQRCode={onQRCode}
          onPaymentLink={onPaymentLink}
          onRecordCash={onRecordCash}
        />
      )}

      {/* Payment Received card — receipt already linked to this job */}
      {showPaymentReceived && linkedReceipt && (
        <TouchableOpacity
          testID="payment-received-card"
          style={[styles.card, { borderColor: `${colors.success}30` }]}
          onPress={() => router.push(`/more/receipt/${linkedReceipt.id}`)}
          activeOpacity={0.8}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: `${colors.success}15` }]}>
              <Feather name="check-circle" size={iconSizes.lg} color={colors.success} />
            </View>
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: colors.foreground }]}>Payment Received</Text>
              {linkedReceipt.receiptNumber && (
                <View style={[styles.badge, { backgroundColor: `${colors.success}15` }]}>
                  <Text style={[styles.badgeText, { color: colors.success }]}>{linkedReceipt.receiptNumber}</Text>
                </View>
              )}
            </View>
            <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
          </View>
          <View style={[styles.amountBox, { backgroundColor: `${colors.success}08`, borderColor: `${colors.success}25` }]}>
            <Text style={[styles.amountLabel, { color: colors.mutedForeground }]}>
              {linkedReceipt.paymentMethod
                ? linkedReceipt.paymentMethod.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
                : 'Payment'}
              {linkedReceipt.createdAt
                ? ` \u2022 ${new Date(linkedReceipt.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
                : ''}
            </Text>
            <Text style={[styles.amountValue, { color: colors.success }]}>
              {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(linkedReceipt.amount)}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      ...shadows.sm,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    titleContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    title: {
      fontSize: typography.sizes.lg,
      fontWeight: fontWeights.bold,
    },
    badge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.md,
    },
    badgeText: {
      fontSize: typography.sizes.xs,
      fontWeight: fontWeights.semibold,
      textTransform: 'uppercase',
    },
    description: {
      fontSize: typography.button.fontSize,
      lineHeight: 20,
      marginBottom: spacing.md,
    },
    amountBox: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      marginBottom: spacing.md,
    },
    amountLabel: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.medium,
    },
    amountValue: {
      fontSize: typography.sizes['2xl'],
      fontWeight: fontWeights.bold,
    },
    buttons: {
      flexDirection: 'column',
      gap: spacing.sm,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    button: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      minHeight: 52,
    },
    buttonText: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.semibold,
    },
  });
}
