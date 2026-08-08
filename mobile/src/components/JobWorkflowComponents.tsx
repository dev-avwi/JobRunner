import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, ScrollView } from 'react-native';
import { Alert } from '@/lib/alert';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, shadows, iconSizes } from '../lib/design-tokens';
import { JobUrgency } from '../lib/jobUrgency';
import { api } from '../lib/api';
import { handleDedicatedNumberError, handleStatusSmsOutcome } from '../lib/smsGate';
import locationTracking from '../lib/location-tracking';
import { PressableRow } from './ui/PressableRow';

// Grab a fresh one-time GPS fix for the On My Way / Running Late flow. Prompts
// for foreground location permission right when the worker needs it (instead of
// it being buried in Settings). Returns null if denied or unavailable — callers
// gracefully fall back to a message without a live ETA.
async function getFreshCoordsForEta(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const granted = await locationTracking.requestForegroundPermission();
    if (!granted) return null;
    const loc = await locationTracking.getCurrentLocation();
    if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
      return { latitude: loc.latitude, longitude: loc.longitude };
    }
  } catch {
    // ignore — fall back to no-coords message
  }
  return null;
}

type JobStatus = 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';

interface LinkedDocument {
  id: string;
  title?: string;
  status: string;
  total: number;
  number?: string;
  quoteNumber?: string;
  invoiceNumber?: string;
  createdAt?: string;
  dueDate?: string;
  paidAt?: string;
}

const WORKFLOW_STEPS = [
  { id: 'pending', label: 'New', icon: 'briefcase' as const },
  { id: 'scheduled', label: 'Scheduled', icon: 'calendar' as const },
  { id: 'in_progress', label: 'In Progress', icon: 'play' as const },
  { id: 'done', label: 'Done', icon: 'check-circle' as const },
  { id: 'invoiced', label: 'Invoiced', icon: 'file-text' as const },
] as const;

const STATUS_ORDER: Record<JobStatus, number> = {
  pending: 0,
  scheduled: 1,
  in_progress: 2,
  done: 3,
  invoiced: 4,
};

interface JobProgressBarProps {
  status: JobStatus;
}

export function JobProgressBar({ status }: JobProgressBarProps) {
  const { colors } = useTheme();
  const styles = createProgressStyles(colors);
  const currentIndex = STATUS_ORDER[status];

  return (
    <View style={styles.container}>
      {/* Simple Progress Steps - no header, cleaner design */}
      <View style={styles.stepsRow}>
        {WORKFLOW_STEPS.map((step, index) => {
          const isPassed = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <View key={step.id} style={styles.stepContainer}>
              {index > 0 && (
                <View 
                  style={[
                    styles.connector,
                    isPassed ? styles.connectorComplete : 
                    isCurrent ? styles.connectorActive : 
                    styles.connectorInactive
                  ]} 
                />
              )}
              <View
                style={[
                  styles.stepCircle,
                  isPassed && styles.stepCircleComplete,
                  isCurrent && styles.stepCircleCurrent,
                ]}
              >
                {isPassed ? (
                  <Feather name="check" size={14} color={colors.white} />
                ) : (
                  <View style={[
                    styles.stepDot,
                    isCurrent && styles.stepDotCurrent,
                  ]} />
                )}
              </View>
              <Text 
                style={[
                  styles.stepLabel,
                  isPassed && styles.stepLabelComplete,
                  isCurrent && styles.stepLabelCurrent,
                ]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const createProgressStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  stepContainer: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  connector: {
    position: 'absolute',
    top: 12,
    right: '50%',
    width: '100%',
    height: 2,
    zIndex: -1,
    backgroundColor: colors.muted,
  },
  connectorComplete: {
    backgroundColor: colors.success,
  },
  connectorActive: {
    backgroundColor: colors.border,
  },
  connectorInactive: {
    backgroundColor: colors.muted,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
    backgroundColor: colors.muted,
  },
  stepCircleComplete: {
    backgroundColor: colors.success,
  },
  stepCircleCurrent: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.foreground,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.mutedForeground,
  },
  stepDotCurrent: {
    backgroundColor: colors.foreground,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '500', fontFamily: 'Inter_500Medium',
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  stepLabelComplete: {
    color: colors.success,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
  },
  stepLabelCurrent: {
    color: colors.foreground,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
  },
});

interface LinkedReceipt {
  id: string;
  receiptNumber?: string;
  amount: number;
  paymentMethod?: string;
  createdAt?: string;
}

interface LinkedDocumentsCardProps {
  linkedQuote?: LinkedDocument | null;
  linkedInvoice?: LinkedDocument | null;
  linkedReceipt?: LinkedReceipt | null;
  jobStatus: JobStatus;
  onViewQuote?: (id: string) => void;
  onViewInvoice?: (id: string) => void;
  onViewReceipt?: (id: string) => void;
  onCreateQuote?: () => void;
  onCreateInvoice?: () => void;
}

export function LinkedDocumentsCard({
  linkedQuote,
  linkedInvoice,
  linkedReceipt,
  jobStatus,
  onViewQuote,
  onViewInvoice,
  onViewReceipt,
  onCreateQuote,
  onCreateInvoice,
}: LinkedDocumentsCardProps) {
  const { colors } = useTheme();
  const styles = createDocumentsStyles(colors);

  const getQuoteStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'sent': return { bg: `${colors.scheduled}15`, text: colors.scheduled };
      case 'accepted': return { bg: `${colors.success}15`, text: colors.success };
      case 'declined': return { bg: `${colors.destructive}15`, text: colors.destructive };
      default: return { bg: colors.muted, text: colors.mutedForeground };
    }
  };

  const getInvoiceStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'sent': return { bg: `${colors.scheduled}15`, text: colors.scheduled };
      case 'paid': return { bg: `${colors.success}15`, text: colors.success };
      case 'overdue': return { bg: `${colors.destructive}15`, text: colors.destructive };
      case 'partial': return { bg: `${colors.warning}15`, text: colors.warning };
      default: return { bg: colors.muted, text: colors.mutedForeground };
    }
  };

  const formatCurrency = (amount: number) => {
    const { formatCurrency: fmt } = require('../lib/format');
    return fmt(amount);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Feather name="file-text" size={iconSizes.md} color={colors.foreground} />
        <Text style={styles.title}>Documents</Text>
      </View>

      <PressableRow style={[styles.documentRow, linkedQuote && styles.documentRowClickable]} onPress={() => linkedQuote && onViewQuote?.(linkedQuote.id)} >
        <View style={[styles.documentIcon, { backgroundColor: linkedQuote ? `${colors.scheduled}15` : colors.muted }]}>
          <Feather name="file-text" size={16} color={linkedQuote ? colors.scheduled : colors.mutedForeground} />
        </View>
        <View style={styles.documentContent}>
          <Text style={styles.documentTitle}>
            {linkedQuote ? (linkedQuote.quoteNumber || linkedQuote.number || 'Quote') : 'No Quote'}
          </Text>
          {linkedQuote ? (
            <View style={styles.documentMeta}>
              <Text style={styles.documentAmount}>{formatCurrency(linkedQuote.total)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getQuoteStatusColor(linkedQuote.status).bg }]}>
                <Text style={[styles.statusText, { color: getQuoteStatusColor(linkedQuote.status).text }]}>
                  {linkedQuote.status || 'Draft'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.documentSubtitle}>Create a quote for this job</Text>
          )}
        </View>
        {!linkedQuote && onCreateQuote ? (
          <PressableRow style={styles.createButton} onPress={onCreateQuote}>
            <Text style={styles.createButtonText}>Create Quote</Text>
          </PressableRow>
        ) : linkedQuote ? (
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        ) : null}
      </PressableRow>

      <PressableRow style={[styles.documentRow, linkedInvoice && styles.documentRowClickable]} onPress={() => linkedInvoice && onViewInvoice?.(linkedInvoice.id)} >
        <View style={[styles.documentIcon, { backgroundColor: linkedInvoice ? `${colors.invoiced}15` : colors.muted }]}>
          <Feather name="file" size={16} color={linkedInvoice ? colors.invoiced : colors.mutedForeground} />
        </View>
        <View style={styles.documentContent}>
          <Text style={styles.documentTitle}>
            {linkedInvoice ? (linkedInvoice.invoiceNumber || linkedInvoice.number || 'Invoice') : 'No Invoice'}
          </Text>
          {linkedInvoice ? (
            <View style={styles.documentMeta}>
              <Text style={styles.documentAmount}>{formatCurrency(linkedInvoice.total)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getInvoiceStatusColor(linkedInvoice.status).bg }]}>
                <Text style={[styles.statusText, { color: getInvoiceStatusColor(linkedInvoice.status).text }]}>
                  {linkedInvoice.status || 'Draft'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.documentSubtitle}>
              {jobStatus === 'done' ? 'Job complete - ready to invoice!' : 'Create invoice after job is done'}
            </Text>
          )}
        </View>
        {!linkedInvoice && onCreateInvoice ? (
          <PressableRow style={styles.createButton} onPress={onCreateInvoice}>
            <Text style={styles.createButtonText}>Create Invoice</Text>
          </PressableRow>
        ) : linkedInvoice ? (
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        ) : null}
      </PressableRow>

      {/* Receipt Row - only show if invoice is paid and receipt exists */}
      {linkedInvoice?.status?.toLowerCase() === 'paid' && (
        <PressableRow style={[styles.documentRow, linkedReceipt && styles.documentRowClickable]} onPress={() => linkedReceipt && onViewReceipt?.(linkedReceipt.id)} >
          <View style={[styles.documentIcon, { backgroundColor: linkedReceipt ? `${colors.success}15` : colors.muted }]}>
            <Feather name="check-circle" size={16} color={linkedReceipt ? colors.success : colors.mutedForeground} />
          </View>
          <View style={styles.documentContent}>
            <Text style={styles.documentTitle}>
              {linkedReceipt ? (linkedReceipt.receiptNumber || 'Receipt') : 'No Receipt'}
            </Text>
            {linkedReceipt ? (
              <View style={styles.documentMeta}>
                <Text style={styles.documentAmount}>{formatCurrency(linkedReceipt.amount)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: `${colors.success}15` }]}>
                  <Text style={[styles.statusText, { color: colors.success }]}>
                    {linkedReceipt.paymentMethod || 'Paid'}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.documentSubtitle}>Payment received - no receipt created</Text>
            )}
          </View>
          {linkedReceipt ? (
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          ) : null}
        </PressableRow>
      )}
    </View>
  );
}

const createDocumentsStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 14,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    color: colors.foreground,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.lg,
    marginBottom: spacing.xs,
    backgroundColor: `${colors.muted}30`,
  },
  documentRowClickable: {
    backgroundColor: `${colors.muted}50`,
  },
  documentIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  documentContent: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    color: colors.foreground,
    marginBottom: 2,
  },
  documentSubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  documentAmount: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    textTransform: 'capitalize',
  },
  createButton: {
    backgroundColor: `${colors.primary}12`,
    borderWidth: 1,
    borderColor: `${colors.primary}25`,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  createButtonText: {
    fontSize: 12,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    color: colors.primary,
  },
});

interface NextActionCardProps {
  jobStatus: JobStatus;
  hasInvoice: boolean;
  hasQuote: boolean;
  quoteStatus?: string;
  invoiceStatus?: string;
  scheduledAt?: string | null;
  onCreateInvoice?: () => void;
  onCreateQuote?: () => void;
  onSendQuote?: () => void;
  onSchedule?: () => void;
  onStartJob?: () => void;
  onCompleteJob?: () => void;
  canCompleteJob?: boolean;
  onSendInvoice?: () => void;
  onSendReminder?: () => void;
  urgencyLabel?: string;
  isOverdue?: boolean;
  clientPhone?: string | null;
  clientName?: string;
  jobId?: string;
  jobAddress?: string;
  businessName?: string;
  tradieName?: string;
  workerStatus?: string | null;
}

type NextActionPriority = 'high' | 'medium' | 'low';

interface NextAction {
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  buttonText: string;
  action?: () => void;
  priority: NextActionPriority;
}

function getNextAction(props: NextActionCardProps): NextAction | null {
  const { jobStatus, hasInvoice, hasQuote, quoteStatus, invoiceStatus, scheduledAt } = props;

  switch (jobStatus) {
    case 'pending':
      if (!hasQuote) {
        return {
          title: 'Create a Quote',
          subtitle: 'Send the client a quote before scheduling',
          icon: 'file-text',
          action: props.onCreateQuote,
          buttonText: 'Create Quote',
          priority: 'medium',
        };
      }
      if (quoteStatus?.toLowerCase() === 'draft') {
        return {
          title: 'Send Your Quote',
          subtitle: 'Quote is ready - send it to the client',
          icon: 'send',
          action: props.onSendQuote,
          buttonText: 'Send Quote',
          priority: 'high',
        };
      }
      if (!scheduledAt) {
        return {
          title: 'Schedule This Job',
          subtitle: 'Pick a date and time for the work',
          icon: 'calendar',
          action: props.onSchedule,
          buttonText: 'Schedule Job',
          priority: 'medium',
        };
      }
      return null;

    case 'scheduled':
      return {
        title: 'Start the Job',
        subtitle: 'Mark as in progress when you begin work',
        icon: 'play',
        action: props.onStartJob,
        buttonText: 'Start Job',
        priority: 'medium',
      };

    case 'in_progress':
      // Only the lead worker (or owner/manager) can complete the whole job.
      // Other assigned workers finish by clocking off their own timer, so no
      // "complete" guidance is shown to them here.
      if (props.canCompleteJob === false) {
        return null;
      }
      return {
        title: 'Complete the Job',
        subtitle: 'Mark as done when work is finished',
        icon: 'check-circle',
        action: props.onCompleteJob,
        buttonText: 'Mark Complete',
        priority: 'high',
      };

    case 'done':
      if (!hasInvoice) {
        if (!props.onCreateInvoice) return null;
        return {
          title: 'Create Invoice',
          subtitle: 'Job is done - time to get paid!',
          icon: 'file-text',
          action: props.onCreateInvoice,
          buttonText: 'Create Invoice',
          priority: 'high',
        };
      }
      if (invoiceStatus?.toLowerCase() === 'draft') {
        return {
          title: 'Send Invoice',
          subtitle: 'Invoice is ready - send it to get paid',
          icon: 'send',
          action: props.onSendInvoice,
          buttonText: 'Send Invoice',
          priority: 'high',
        };
      }
      if (invoiceStatus?.toLowerCase() === 'sent' || invoiceStatus?.toLowerCase() === 'overdue') {
        return {
          title: 'Follow Up on Payment',
          subtitle: invoiceStatus?.toLowerCase() === 'overdue'
            ? 'Payment is overdue - send a reminder'
            : 'Waiting for payment',
          icon: 'alert-circle',
          action: props.onSendReminder,
          buttonText: 'Send Reminder',
          priority: invoiceStatus?.toLowerCase() === 'overdue' ? 'high' : 'low',
        };
      }
      return null;

    case 'invoiced':
      if (invoiceStatus?.toLowerCase() !== 'paid') {
        return {
          title: 'Follow Up on Payment',
          subtitle: 'Invoice sent - waiting for payment',
          icon: 'clock',
          action: props.onSendReminder,
          buttonText: 'Send Reminder',
          priority: 'low',
        };
      }
      return null;

    default:
      return null;
  }
}

export function NextActionCard(props: NextActionCardProps) {
  const { colors } = useTheme();
  const styles = createNextActionStyles(colors);
  const nextAction = getNextAction(props);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isPreparingSms, setIsPreparingSms] = useState(false);
  const [showSmsPreview, setShowSmsPreview] = useState(false);
  const [smsPreviewMessage, setSmsPreviewMessage] = useState('');
  const [smsCoords, setSmsCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  if (!nextAction) return null;

  const priorityColors = {
    high: { border: `${colors.destructive}40`, bg: `${colors.destructive}08`, iconBg: `${colors.destructive}15`, accent: colors.destructive, btnBg: colors.primary },
    medium: { border: `${colors.warning}40`, bg: `${colors.warning}08`, iconBg: `${colors.warning}15`, accent: colors.warning, btnBg: colors.warning },
    low: { border: `${colors.info}40`, bg: `${colors.info}08`, iconBg: `${colors.info}15`, accent: colors.info, btnBg: colors.info },
  };

  const pColors = priorityColors[nextAction.priority];

  const showOnMyWay = props.jobStatus === 'scheduled' && !!props.clientPhone && (!props.workerStatus || props.workerStatus === 'assigned');
  const showUrgency = props.jobStatus === 'scheduled' && !!props.urgencyLabel;

  const getDefaultSmsMessage = () => {
    const name = props.clientName || 'there';
    const trader = props.tradieName || props.businessName || 'Your tradesperson';
    const business = props.businessName || 'your tradesperson';
    const address = props.jobAddress || 'your location';

    if (props.isOverdue) {
      return `Hi ${name}, ${trader} from ${business} here. Running a bit late for your job at ${address}. Apologies for the delay - will be there as soon as possible.\n\nTrack arrival: [link will be added]`;
    }
    return `Hi ${name}, ${trader} from ${business} is on the way to your job at ${address}. ETA approximately 15-20 minutes.\n\nTrack arrival: [link will be added]`;
  };

  const handleOpenSmsPreview = async () => {
    if (isPreparingSms) return;
    setIsPreparingSms(true);
    try {
      // Prompt for location + grab a fresh fix, then ask the server for a message
      // with a REAL driving ETA. Falls back to the generic message if GPS is
      // unavailable or denied.
      const coords = await getFreshCoordsForEta();
      setSmsCoords(coords);
      let message = getDefaultSmsMessage();
      if (coords && props.jobId) {
        try {
          const res = await api.post<{ message?: string }>(`/api/jobs/${props.jobId}/eta-message`, {
            type: props.isOverdue ? 'late' : 'omw',
            latitude: coords.latitude,
            longitude: coords.longitude,
            previewOnly: true,
          });
          if (res.data?.message) message = res.data.message;
        } catch {
          // keep the generic fallback message
        }
      }
      setSmsPreviewMessage(message);
      setShowSmsPreview(true);
    } finally {
      setIsPreparingSms(false);
    }
  };

  const fallbackToNativeSms = (phone: string, message: string) => {
    Alert.alert(
      'Send via SMS App?',
      'Could not send directly. Would you like to open your messaging app instead?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open SMS App',
          onPress: () => {
            const url = `sms:${phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;
            Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open SMS app'));
          },
        },
      ]
    );
  };

  const handleSendSms = async () => {
    if (isSendingSms || !props.clientPhone || !props.jobId) return;

    const endpoint = props.isOverdue
      ? `/api/jobs/${props.jobId}/running-late`
      : `/api/jobs/${props.jobId}/on-my-way`;

    setIsSendingSms(true);
    setShowSmsPreview(false);
    try {
      const response = await api.post(endpoint, {
        customMessage: smsPreviewMessage,
        ...(smsCoords ? { latitude: smsCoords.latitude, longitude: smsCoords.longitude } : {}),
      });
      if (response.error) {
        if (handleDedicatedNumberError(response)) return;
        fallbackToNativeSms(props.clientPhone, smsPreviewMessage);
      } else if (handleStatusSmsOutcome(response.data)) {
        // Status/state applied but the client SMS was skipped — prompt shown.
      } else {
        Alert.alert('SMS Sent', props.isOverdue ? 'Running late message sent to client.' : 'On my way message sent to client.');
      }
    } catch {
      fallbackToNativeSms(props.clientPhone, smsPreviewMessage);
    } finally {
      setIsSendingSms(false);
    }
  };

  return (
    <View style={[styles.container, { borderColor: pColors.border, backgroundColor: pColors.bg }]}>
      {showUrgency && (
        <View style={styles.urgencyRow}>
          <Feather
            name={props.isOverdue ? "alert-circle" : "clock"}
            size={14}
            color={props.isOverdue ? '#ea580c' : colors.primary}
          />
          <Text style={[styles.urgencyText, { color: props.isOverdue ? '#ea580c' : colors.primary }]}>
            {props.urgencyLabel}
          </Text>
        </View>
      )}
      <View style={styles.mainRow}>
        <View style={[styles.iconContainer, { backgroundColor: pColors.iconBg }]}>
          <Feather name={nextAction.icon} size={20} color={pColors.accent} />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>{nextAction.title}</Text>
          <Text style={styles.subtitle}>{nextAction.subtitle}</Text>
        </View>
        {nextAction.action && (
          <PressableRow style={[styles.actionButton, { backgroundColor: pColors.iconBg, borderWidth: 1, borderColor: pColors.border }]} onPress={nextAction.action} >
            <Text style={[styles.actionButtonText, { color: pColors.accent }]}>{nextAction.buttonText}</Text>
            <Feather name="arrow-right" size={14} color={pColors.accent} />
          </PressableRow>
        )}
      </View>
      {showOnMyWay && (
        <PressableRow style={[styles.secondaryAction, { borderColor: colors.border }]} onPress={handleOpenSmsPreview} disabled={isSendingSms || isPreparingSms} >
          <Feather name="message-circle" size={16} color={colors.mutedForeground} />
          <Text style={[styles.secondaryActionText, { color: colors.foreground }]}>
            {props.isOverdue ? 'Text Running Late' : 'Text On My Way'}
          </Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </PressableRow>
      )}

      <Modal
        visible={showSmsPreview}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSmsPreview(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.smsModalOverlay}
        >
          <TouchableOpacity
            style={styles.smsModalOverlay}
            activeOpacity={1}
            onPress={() => setShowSmsPreview(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={[styles.smsModalContent, { backgroundColor: colors.card }]}>
                <View style={styles.smsModalHeader}>
                  <View style={[styles.smsModalHeaderIcon, { backgroundColor: `${colors.primary}15` }]}>
                    <Feather name="message-square" size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.smsModalTitle, { color: colors.foreground }]}>
                    {props.isOverdue ? 'Running Late' : 'On My Way'}
                  </Text>
                  <PressableRow onPress={() => setShowSmsPreview(false)} style={styles.smsModalCloseButton}>
                    <Feather name="x" size={20} color={colors.mutedForeground} />
                  </PressableRow>
                </View>

                <View style={[styles.smsRecipientRow, { backgroundColor: colors.muted }]}>
                  <Feather name="user" size={16} color={colors.mutedForeground} />
                  <View style={styles.smsRecipientInfo}>
                    <Text style={[styles.smsRecipientName, { color: colors.foreground }]}>
                      {props.clientName || 'Client'}
                    </Text>
                    <Text style={[styles.smsRecipientPhone, { color: colors.mutedForeground }]}>
                      {props.clientPhone}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.smsMessageLabel, { color: colors.mutedForeground }]}>MESSAGE</Text>
                <TextInput
                  style={[styles.smsMessageInput, {
                    backgroundColor: colors.background,
                    color: colors.foreground,
                    borderColor: colors.border,
                  }]}
                  value={smsPreviewMessage}
                  onChangeText={setSmsPreviewMessage}
                  multiline
                  textAlignVertical="top"
                />

                <View style={[styles.smsInfoRow, { backgroundColor: `${colors.scheduled}10` }]}>
                  <Feather name="info" size={14} color={colors.scheduled} />
                  <Text style={[styles.smsInfoText, { color: colors.scheduled }]}>
                    This will be sent via SMS to the client
                  </Text>
                </View>

                {!props.isOverdue && (
                  <View style={[styles.smsInfoRow, { backgroundColor: `${colors.primary}10`, marginTop: -8 }]}>
                    <Feather name="link" size={14} color={colors.primary} />
                    <Text style={[styles.smsInfoText, { color: colors.primary }]}>
                      A tracking link will be included automatically
                    </Text>
                  </View>
                )}

                <View style={styles.smsModalActions}>
                  <PressableRow style={[styles.smsCancelButton, { borderColor: colors.border }]} onPress={() => setShowSmsPreview(false)} >
                    <Text style={[styles.smsCancelButtonText, { color: colors.foreground }]}>Cancel</Text>
                  </PressableRow>
                  <PressableRow style={[styles.smsSendButton, { backgroundColor: props.isOverdue ? '#ea580c' : colors.primary }]} onPress={handleSendSms} disabled={isSendingSms || !smsPreviewMessage.trim()} >
                    {isSendingSms ? (
                      <ActivityIndicator size="small" color={props.isOverdue ? colors.white : colors.primaryForeground} />
                    ) : (
                      <>
                        <Feather name="send" size={14} color={props.isOverdue ? colors.white : colors.primaryForeground} />
                        <Text style={[styles.smsSendButtonText, !props.isOverdue && { color: colors.primaryForeground }]}>Send</Text>
                      </>
                    )}
                  </PressableRow>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createNextActionStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: `${colors.destructive}08`,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: `${colors.destructive}40`,
  },
  urgencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}40`,
  },
  urgencyText: {
    fontSize: 13,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: `${colors.destructive}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    color: colors.foreground,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    color: colors.primaryForeground,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: `${colors.border}40`,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '500', fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  smsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  smsModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  smsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  smsModalHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smsModalTitle: {
    fontSize: 18,
    fontWeight: '700', fontFamily: 'Inter_700Bold',
    flex: 1,
  },
  smsModalCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smsRecipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  smsRecipientInfo: {
    flex: 1,
  },
  smsRecipientName: {
    fontSize: 14,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
  },
  smsRecipientPhone: {
    fontSize: 13,
    marginTop: 2,
  },
  smsMessageLabel: {
    fontSize: 11,
    fontWeight: '700', fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    paddingLeft: spacing.xs,
  },
  smsMessageInput: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 120,
    marginBottom: spacing.md,
  },
  smsInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  smsInfoText: {
    fontSize: 12,
    fontWeight: '500', fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  smsModalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  smsCancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  smsCancelButtonText: {
    fontSize: 15,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
  },
  smsSendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  smsSendButtonText: {
    fontSize: 15,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    color: colors.white,
  },
});

// Payment Collection Card - shows when invoice exists and needs payment
interface PaymentCollectionCardProps {
  invoice: {
    id: string;
    number: string;
    status: string;
    total: number;
    paidAmount?: number;
  } | null;
  jobId: string;
  canCollectPayments: boolean;
  onTapToPay: () => void;
  onQRCode: () => void;
  onPaymentLink: () => void;
  onRecordCash: () => void;
}

export function PaymentCollectionCard({
  invoice,
  jobId,
  canCollectPayments,
  onTapToPay,
  onQRCode,
  onPaymentLink,
  onRecordCash,
}: PaymentCollectionCardProps) {
  const { colors } = useTheme();
  const styles = createPaymentStyles(colors);

  // Only show if there's an unpaid invoice. Draft invoices ARE collectible —
  // tradies often collect on the spot before sending the invoice.
  if (!invoice || invoice.status === 'paid' || !canCollectPayments) {
    return null;
  }

  // Parse amounts as numbers to handle string values from API
  const total = typeof invoice.total === 'number' ? invoice.total : parseFloat(String(invoice.total) || '0');
  const paidAmount = typeof invoice.paidAmount === 'number' ? invoice.paidAmount : parseFloat(String(invoice.paidAmount) || '0');
  const outstanding = total - paidAmount;
  const formatCurrency = (amount: number) => {
    const { formatCurrency: fmt } = require('../lib/format');
    return fmt(amount);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${colors.success}15` }]}>
          <Feather name="credit-card" size={iconSizes.lg} color={colors.success} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Collect Payment</Text>
          <Text style={styles.subtitle}>
            {invoice.number} • {formatCurrency(outstanding)} outstanding
          </Text>
        </View>
      </View>

      <View style={styles.buttonGrid}>
        <PressableRow style={[styles.paymentButton, { backgroundColor: `${colors.primary}12` }]} onPress={onTapToPay} data-testid="button-tap-to-pay" >
          <View style={[styles.paymentIcon, { backgroundColor: colors.primary }]}>
            <Feather name="smartphone" size={18} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.paymentLabel, { color: colors.primary }]}>Tap to Pay</Text>
        </PressableRow>

        <PressableRow style={[styles.paymentButton, { backgroundColor: `${colors.secondary}40` }]} onPress={onQRCode} data-testid="button-qr-code" >
          <View style={[styles.paymentIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="grid" size={18} color={colors.secondaryForeground} />
          </View>
          <Text style={[styles.paymentLabel, { color: colors.secondaryForeground }]}>QR Code</Text>
        </PressableRow>

        <PressableRow style={[styles.paymentButton, { backgroundColor: `${colors.warning}12` }]} onPress={onPaymentLink} data-testid="button-payment-link" >
          <View style={[styles.paymentIcon, { backgroundColor: colors.warning }]}>
            <Feather name="link" size={18} color={colors.white} />
          </View>
          <Text style={[styles.paymentLabel, { color: colors.warning }]}>Send Link</Text>
        </PressableRow>

        <PressableRow style={[styles.paymentButton, { backgroundColor: `${colors.success}12` }]} onPress={onRecordCash} data-testid="button-record-cash" >
          <View style={[styles.paymentIcon, { backgroundColor: colors.success }]}>
            <Feather name="dollar-sign" size={18} color={colors.white} />
          </View>
          <Text style={[styles.paymentLabel, { color: colors.success }]}>Record Cash</Text>
        </PressableRow>
      </View>
    </View>
  );
}

const createPaymentStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    color: colors.foreground,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  paymentButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  paymentIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentLabel: {
    fontSize: 13,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
  },
});

// Schedule Notification Card - Shows scheduled time and Start Now button
interface ScheduleNotificationCardProps {
  jobStatus: 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';
  urgency: JobUrgency | null;
  onStartJob: () => void;
  isLoading?: boolean;
}

export function ScheduleNotificationCard({
  jobStatus,
  urgency,
  onStartJob,
  isLoading = false,
}: ScheduleNotificationCardProps) {
  const { colors } = useTheme();
  const styles = createScheduleCardStyles(colors);

  if (jobStatus !== 'scheduled' || !urgency) {
    return null;
  }

  const isOverdue = urgency.level === 'overdue';
  const borderColor = isOverdue ? '#ea580c' : colors.primary;
  const bgColor = isOverdue ? '#fff7ed' : `${colors.primary}08`;
  const iconBgColor = isOverdue ? '#ffedd5' : `${colors.primary}15`;
  const iconColor = isOverdue ? '#ea580c' : colors.primary;

  return (
    <View style={[styles.container, { borderColor, backgroundColor: bgColor }]}>
      <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
        <Feather 
          name={isOverdue ? "alert-circle" : "clock"} 
          size={20} 
          color={iconColor} 
        />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: iconColor }]}>
          {urgency.label}
        </Text>
        <Text style={styles.subtitle}>
          {isOverdue 
            ? "This job is past its scheduled time"
            : "Ready to start?"}
        </Text>
      </View>
      <PressableRow style={[styles.actionButton, { backgroundColor: `${colors.primary}12`, borderWidth: 1, borderColor: `${colors.primary}25` }]} onPress={onStartJob} disabled={isLoading} >
        <Text style={[styles.actionButtonText, { color: colors.primary }]}>Start Now</Text>
        <Feather name="play" size={14} color={colors.primary} />
      </PressableRow>
    </View>
  );
}

const createScheduleCardStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    color: colors.primaryForeground,
  },
});

// SMS Contact Card - "Heading to the job?" with Text On My Way button
interface SmsContactCardProps {
  jobStatus: 'pending' | 'scheduled' | 'in_progress' | 'done' | 'invoiced';
  clientPhone?: string | null;
  clientName?: string;
  isOverdue?: boolean;
  jobId: string;
  jobAddress?: string;
  businessName?: string;
  tradieName?: string;
  workerStatus?: string | null;
}

export function SmsContactCard({
  jobStatus,
  clientPhone,
  clientName,
  isOverdue = false,
  jobId,
  jobAddress,
  businessName,
  tradieName,
  workerStatus,
}: SmsContactCardProps) {
  const { colors } = useTheme();
  const styles = createSmsCardStyles(colors);
  const [isSending, setIsSending] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewMessage, setPreviewMessage] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  if (!clientPhone || (jobStatus !== 'scheduled' && jobStatus !== 'in_progress')) {
    return null;
  }

  if (workerStatus && workerStatus !== 'assigned') {
    return null;
  }

  const getDefaultMessage = () => {
    const name = clientName || 'there';
    const trader = tradieName || businessName || 'Your tradesperson';
    const business = businessName || 'your tradesperson';
    const address = jobAddress || 'your location';

    if (isOverdue) {
      return `Hi ${name}, ${trader} from ${business} here. Running a bit late for your job at ${address}. Apologies for the delay - will be there as soon as possible.\n\nTrack arrival: [link will be added]`;
    }
    return `Hi ${name}, ${trader} from ${business} is on the way to your job at ${address}. ETA approximately 15-20 minutes.\n\nTrack arrival: [link will be added]`;
  };

  const handleOpenPreview = async () => {
    if (isPreparing) return;
    setIsPreparing(true);
    try {
      // Prompt for location + grab a fresh fix, then ask the server for a message
      // with a REAL driving ETA. Falls back to the generic message if GPS is
      // unavailable or denied.
      const gps = await getFreshCoordsForEta();
      setCoords(gps);
      let message = getDefaultMessage();
      if (gps && jobId) {
        try {
          const res = await api.post<{ message?: string }>(`/api/jobs/${jobId}/eta-message`, {
            type: isOverdue ? 'late' : 'omw',
            latitude: gps.latitude,
            longitude: gps.longitude,
            previewOnly: true,
          });
          if (res.data?.message) message = res.data.message;
        } catch {
          // keep the generic fallback message
        }
      }
      setPreviewMessage(message);
      setShowPreview(true);
    } finally {
      setIsPreparing(false);
    }
  };

  const fallbackToNativeSms = (phone: string, message: string) => {
    Alert.alert(
      'Send via SMS App?',
      'Could not send directly. Would you like to open your messaging app instead?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open SMS App',
          onPress: () => {
            const url = `sms:${phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;
            Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open SMS app'));
          },
        },
      ]
    );
  };

  const handleSendSms = async () => {
    if (isSending) return;
    
    const endpoint = isOverdue 
      ? `/api/jobs/${jobId}/running-late`
      : `/api/jobs/${jobId}/on-my-way`;

    setIsSending(true);
    setShowPreview(false);
    try {
      const response = await api.post(endpoint, {
        customMessage: previewMessage,
        ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
      });
      if (response.error) {
        if (handleDedicatedNumberError(response)) return;
        fallbackToNativeSms(clientPhone!, previewMessage);
      } else if (handleStatusSmsOutcome(response.data)) {
        // Status/state applied but the client SMS was skipped — prompt shown.
      } else {
        Alert.alert('SMS Sent', isOverdue ? 'Running late message sent to client.' : 'On my way message sent to client.');
      }
    } catch {
      fallbackToNativeSms(clientPhone!, previewMessage);
    } finally {
      setIsSending(false);
    }
  };

  const buttonLabel = isOverdue ? "Text Running Late" : "Text On My Way";
  const buttonBg = isOverdue ? '#ea580c' : colors.primary;
  const modalTitle = isOverdue ? "Running Late" : "On My Way";

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: `${colors.scheduled}15` }]}>
        <Feather name="message-circle" size={20} color={colors.scheduled} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>Heading to the job?</Text>
        <Text style={styles.subtitle}>Let the client know you're heading over</Text>
      </View>
      <PressableRow style={[styles.actionButton, { backgroundColor: buttonBg }]} onPress={handleOpenPreview} disabled={isSending || isPreparing} >
        {isSending || isPreparing ? (
          <ActivityIndicator size="small" color={isOverdue ? colors.white : colors.primaryForeground} />
        ) : (
          <>
            <Feather name="message-square" size={14} color={isOverdue ? colors.white : colors.primaryForeground} />
            <Text style={[styles.actionButtonText, !isOverdue && { color: colors.primaryForeground }]}>{buttonLabel}</Text>
          </>
        )}
      </PressableRow>

      <Modal
        visible={showPreview}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPreview(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowPreview(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                <View style={styles.modalHeader}>
                  <View style={[styles.modalHeaderIcon, { backgroundColor: `${buttonBg}15` }]}>
                    <Feather name="message-square" size={20} color={buttonBg} />
                  </View>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>{modalTitle}</Text>
                  <PressableRow onPress={() => setShowPreview(false)} style={styles.modalCloseButton}>
                    <Feather name="x" size={20} color={colors.mutedForeground} />
                  </PressableRow>
                </View>

                <View style={[styles.recipientRow, { backgroundColor: colors.muted }]}>
                  <Feather name="user" size={16} color={colors.mutedForeground} />
                  <View style={styles.recipientInfo}>
                    <Text style={[styles.recipientName, { color: colors.foreground }]}>
                      {clientName || 'Client'}
                    </Text>
                    <Text style={[styles.recipientPhone, { color: colors.mutedForeground }]}>
                      {clientPhone}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.messageLabel, { color: colors.mutedForeground }]}>MESSAGE</Text>
                <TextInput
                  style={[styles.messageInput, { 
                    backgroundColor: colors.background, 
                    color: colors.foreground,
                    borderColor: colors.border,
                  }]}
                  value={previewMessage}
                  onChangeText={setPreviewMessage}
                  multiline
                  textAlignVertical="top"
                />

                <View style={[styles.infoRow, { backgroundColor: `${colors.scheduled}10` }]}>
                  <Feather name="info" size={14} color={colors.scheduled} />
                  <Text style={[styles.infoText, { color: colors.scheduled }]}>
                    This will be sent via SMS to the client
                  </Text>
                </View>

                {!isOverdue && (
                  <View style={[styles.infoRow, { backgroundColor: `${colors.primary}10`, marginTop: -8 }]}>
                    <Feather name="link" size={14} color={colors.primary} />
                    <Text style={[styles.infoText, { color: colors.primary }]}>
                      A tracking link will be included automatically
                    </Text>
                  </View>
                )}

                <View style={styles.modalActions}>
                  <PressableRow style={[styles.cancelButton, { borderColor: colors.border }]} onPress={() => setShowPreview(false)} >
                    <Text style={[styles.cancelButtonText, { color: colors.foreground }]}>Cancel</Text>
                  </PressableRow>
                  <PressableRow style={[styles.sendButton, { backgroundColor: buttonBg }]} onPress={handleSendSms} disabled={isSending || !previewMessage.trim()} >
                    {isSending ? (
                      <ActivityIndicator size="small" color={isOverdue ? colors.white : colors.primaryForeground} />
                    ) : (
                      <>
                        <Feather name="send" size={14} color={isOverdue ? colors.white : colors.primaryForeground} />
                        <Text style={[styles.sendButtonText, !isOverdue && { color: colors.primaryForeground }]}>Send</Text>
                      </>
                    )}
                  </PressableRow>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const createSmsCardStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    color: colors.foreground,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    color: colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  modalHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700', fontFamily: 'Inter_700Bold',
    flex: 1,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: 14,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
  },
  recipientPhone: {
    fontSize: 13,
    marginTop: 2,
  },
  messageLabel: {
    fontSize: 11,
    fontWeight: '700', fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    paddingLeft: spacing.xs,
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 120,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  infoText: {
    fontSize: 12,
    fontWeight: '500', fontFamily: 'Inter_500Medium',
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
  },
  sendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: '600', fontFamily: 'Inter_600SemiBold',
    color: colors.white,
  },
});

interface WorkerStateQuickActionsProps {
  jobId: string;
  jobStatus: string;
}

const WORKER_STATE_BUTTONS = [
  { state: 'delayed', label: 'Delayed', icon: 'alert-triangle' as const, color: '#eab308', bg: 'rgba(234,179,8,0.1)' },
  { state: 'needs_help', label: 'Needs Help', icon: 'alert-circle' as const, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
];

export function WorkerStateQuickActions({ jobId, jobStatus }: WorkerStateQuickActionsProps) {
  const { colors } = useTheme();
  const [updating, setUpdating] = useState<string | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [pendingState, setPendingState] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  if (jobStatus !== 'scheduled' && jobStatus !== 'in_progress') return null;

  const handleSetState = (state: string) => {
    setPendingState(state);
    setNoteText('');
    setShowNoteModal(true);
  };

  const confirmSetState = async () => {
    if (!pendingState) return;
    const state = pendingState;
    const label = state === 'delayed' ? 'Delayed' : 'Needs Help';
    setShowNoteModal(false);
    setUpdating(state);
    try {
      await api.post('/api/worker/state', { state, jobId, note: noteText || null });
      Alert.alert('Status Updated', `Your status has been set to "${label}".`);
    } catch {
      Alert.alert('Error', 'Failed to update status. Please try again.');
    } finally {
      setUpdating(null);
      setPendingState(null);
      setNoteText('');
    }
  };

  const pendingLabel = pendingState === 'delayed' ? 'Delayed' : 'Needs Help';
  const pendingColor = pendingState === 'delayed' ? '#eab308' : '#ef4444';

  return (
    <>
    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
      {WORKER_STATE_BUTTONS.map(btn => (
        <PressableRow key={btn.state} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: btn.bg, borderWidth: 1, borderColor: `${btn.color}30`, }} onPress={() => handleSetState(btn.state)} disabled={updating !== null} >
          {updating === btn.state ? (
            <ActivityIndicator size="small" color={btn.color} />
          ) : (
            <Feather name={btn.icon} size={14} color={btn.color} />
          )}
          <Text style={{ fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold', color: btn.color }}>
            {btn.label}
          </Text>
        </PressableRow>
      ))}
    </View>

    <Modal
      visible={showNoteModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowNoteModal(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        <View style={{
          width: '85%',
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: spacing.lg,
        }}>
          <Text style={{ fontSize: 17, fontWeight: '700', fontFamily: 'Inter_700Bold', color: colors.foreground, marginBottom: spacing.xs }}>
            {pendingLabel}
          </Text>
          <Text style={{ fontSize: 14, color: colors.mutedForeground, marginBottom: spacing.md }}>
            Add a note (optional):
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.sm,
              fontSize: 14,
              color: colors.foreground,
              backgroundColor: colors.background,
              minHeight: 60,
              textAlignVertical: 'top',
            }}
            placeholder="e.g. Stuck in traffic, ETA 20 mins"
            placeholderTextColor={colors.mutedForeground}
            value={noteText}
            onChangeText={setNoteText}
            multiline
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
            <PressableRow style={{ flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', }} onPress={() => { setShowNoteModal(false); setPendingState(null); }} >
              <Text style={{ color: colors.foreground, fontWeight: '600', fontFamily: 'Inter_600SemiBold' }}>Cancel</Text>
            </PressableRow>
            <PressableRow style={{ flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: pendingColor, alignItems: 'center', }} onPress={confirmSetState} >
              <Text style={{ color: colors.white, fontWeight: '600', fontFamily: 'Inter_600SemiBold' }}>Confirm</Text>
            </PressableRow>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
}
