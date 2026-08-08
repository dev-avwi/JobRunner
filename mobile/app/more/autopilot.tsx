import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, Switch, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Alert } from '@/lib/alert';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes, componentStyles, fontWeights } from '../../src/lib/design-tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { PressableRow } from '../../src/components/ui/PressableRow';

interface AutomationTrigger {
  type: string;
  entityType?: string;
  fromStatus?: string;
  toStatus?: string;
  delayDays?: number;
}

interface AutomationAction {
  type: string;
  template?: string;
  message?: string;
  newStatus?: string;
}

interface Automation {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
}

interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  category?: string;
}

interface ActivityLogEntry {
  id: string;
  automationType: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  channel: string;
  status: string;
  recipientName: string;
  createdAt: string | null;
  errorMessage: string | null;
}

const TRIGGER_TYPES: { value: string; label: string; icon: string; description: string }[] = [
  { value: 'status_change', label: 'Status Change', icon: 'refresh-cw', description: 'When a status changes on an entity' },
  { value: 'time_delay', label: 'Time Delay', icon: 'clock', description: 'After a set number of days' },
  { value: 'no_response', label: 'No Response', icon: 'alert-circle', description: 'When no reply is received' },
  { value: 'payment_received', label: 'Payment Received', icon: 'dollar-sign', description: 'When a payment is recorded' },
];

const ENTITY_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'job', label: 'Job', icon: 'briefcase' },
  { value: 'quote', label: 'Quote', icon: 'file-text' },
  { value: 'invoice', label: 'Invoice', icon: 'file' },
  { value: 'client', label: 'Client', icon: 'users' },
];

const ACTION_TYPES: { value: string; label: string; icon: string; description: string }[] = [
  { value: 'send_email', label: 'Send Email', icon: 'mail', description: 'Send an email notification' },
  { value: 'create_job', label: 'Create Job', icon: 'briefcase', description: 'Auto-create a new job' },
  { value: 'create_invoice', label: 'Create Invoice', icon: 'file-plus', description: 'Auto-generate an invoice' },
  { value: 'send_notification', label: 'Send Notification', icon: 'bell', description: 'Send a push notification' },
  { value: 'update_status', label: 'Update Status', icon: 'edit-3', description: 'Change entity status' },
  { value: 'send_sms', label: 'Send SMS', icon: 'message-square', description: 'Send an SMS message' },
];

const STATUS_OPTIONS: Record<string, string[]> = {
  job: ['pending', 'scheduled', 'in_progress', 'done', 'invoiced', 'cancelled'],
  quote: ['draft', 'sent', 'accepted', 'rejected', 'expired'],
  invoice: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
  client: ['active', 'inactive'],
};

type EditorStep = 'details' | 'trigger' | 'actions' | 'review';

interface AutomationFormData {
  name: string;
  description: string;
  isActive: boolean;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
}

const EMPTY_FORM: AutomationFormData = {
  name: '',
  description: '',
  isActive: true,
  trigger: { type: '', entityType: '' },
  actions: [{ type: '' }],
};

const AUTOMATION_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  quote_followup: { label: 'Quote follow-up', icon: 'file-text', color: '#3b82f6' },
  job_reminder: { label: 'Job reminder', icon: 'calendar', color: '#22c55e' },
  invoice_reminder: { label: 'Invoice reminder', icon: 'dollar-sign', color: '#ef4444' },
  auto_invoice: { label: 'Auto-invoice', icon: 'file-plus', color: '#14b8a6' },
  review_request: { label: 'Review request', icon: 'star', color: '#eab308' },
  photo_requirement: { label: 'Photo prompt', icon: 'camera', color: '#f59e0b' },
  gps_checkin: { label: 'GPS check-in', icon: 'map-pin', color: '#8b5cf6' },
  sms_automation: { label: 'SMS automation', icon: 'message-square', color: '#6b7280' },
  general: { label: 'Automation', icon: 'zap', color: '#6b7280' },
};

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

type TabType = 'automations' | 'templates' | 'activity';

const CATEGORY_COLORS: Record<string, { color: string; bgColor: string }> = {
  'communication': { color: '#3b82f6', bgColor: 'rgba(59,130,246,0.1)' },
  'scheduling': { color: '#8b5cf6', bgColor: 'rgba(139,92,246,0.1)' },
  'invoicing': { color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' },
  'follow-up': { color: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
  'status': { color: '#06b6d4', bgColor: 'rgba(6,182,212,0.1)' },
  'notification': { color: '#ec4899', bgColor: 'rgba(236,72,153,0.1)' },
  'default': { color: '#6b7280', bgColor: 'rgba(107,114,128,0.1)' },
};

function getCategoryStyle(category?: string) {
  if (!category) return CATEGORY_COLORS['default'];
  const key = category.toLowerCase();
  return CATEGORY_COLORS[key] || CATEGORY_COLORS['default'];
}

function getTriggerSummary(trigger: AutomationTrigger): string {
  if (!trigger) return 'No trigger configured';
  const parts: string[] = [];
  if (trigger.type) {
    parts.push(trigger.type.replace(/_/g, ' '));
  }
  if (trigger.entityType) {
    parts.push(`on ${trigger.entityType}`);
  }
  if (trigger.fromStatus && trigger.toStatus) {
    parts.push(`${trigger.fromStatus} → ${trigger.toStatus}`);
  } else if (trigger.toStatus) {
    parts.push(`→ ${trigger.toStatus}`);
  }
  if (trigger.delayDays) {
    parts.push(`after ${trigger.delayDays} day${trigger.delayDays > 1 ? 's' : ''}`);
  }
  return parts.length > 0 ? parts.join(' ') : 'Custom trigger';
}

function getActionSummary(actions: AutomationAction[]): string {
  if (!actions || actions.length === 0) return 'No actions';
  return actions.map(a => {
    if (a.type === 'send_email' || a.type === 'email') return 'Send email';
    if (a.type === 'send_sms' || a.type === 'sms') return 'Send SMS';
    if (a.type === 'update_status' || a.type === 'status_change') return `Set status to ${a.newStatus || 'new'}`;
    return a.type?.replace(/_/g, ' ') || 'Action';
  }).join(', ');
}

const createStyles = (colors: any, bottomNavHeight: number = 0) => StyleSheet.create({
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
    paddingBottom: bottomNavHeight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flex: 1,
  },
  pageTitle: {
    ...typography.largeTitle,
    color: colors.foreground,
  },
  pageSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 92,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: fontWeights.bold,
    letterSpacing: -0.5,
  },
  statLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
    fontSize: typography.sizes.xs,
  },
  tabContainer: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.sm,
    marginBottom: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xl,
    gap: spacing.xs,
  },
  activeTab: {
    backgroundColor: colors.primary + '15',
  },
  tabText: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    fontWeight: fontWeights.medium,
  },
  activeTabText: {
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    ...typography.badge,
    color: colors.white,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  automationIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    flex: 1,
  },
  cardDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  detailsContainer: {
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    ...typography.caption,
    color: colors.mutedForeground,
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  statusBadgeText: {
    ...typography.badge,
  },
  templateIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryContainer: {
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  categoryText: {
    ...typography.badge,
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
  },
  enableButtonText: {
    ...typography.button,
    color: colors.primaryForeground || colors.white,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  loadingText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.md,
    marginTop: spacing.md,
    ...shadows.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.destructive,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  retryButton: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  retryButtonText: {
    ...typography.button,
    color: colors.primaryForeground || colors.white,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
    ...shadows.sm,
  },
  emptyIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: 2,
    textAlign: 'center',
  },
  emptyDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: spacing.xs,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
  },
  emptyCtaText: {
    ...typography.button,
    color: colors.primaryForeground || colors.white,
  },
  templateGrid: {
    gap: spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    maxHeight: '92%',
    ...shadows.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    ...typography.cardTitle,
    fontSize: typography.sizes.lg,
  },
  modalBody: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: 40,
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  stepDot: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  inputLabel: {
    ...typography.caption,
    fontWeight: fontWeights.semibold,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
  },
  textInputMultiline: {
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.xl,
    marginBottom: spacing.sm,
  },
  optionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
  },
  optionDescription: {
    ...typography.caption,
    marginTop: 2,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    minHeight: 48,
    borderRadius: radius.xl,
  },
  footerButtonText: {
    ...typography.button,
  },
  reviewSection: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  reviewLabel: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  reviewValue: {
    ...typography.body,
    fontWeight: fontWeights.medium,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  delayInput: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: 80,
    textAlign: 'center',
    ...typography.body,
  },
});

export default function AutopilotScreen() {
  const confirm = useConfirmDialog();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);

  const [activeTab, setActiveTab] = useState<TabType>('automations');
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [templates, setTemplates] = useState<AutomationTemplate[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [enablingIds, setEnablingIds] = useState<Set<string>>(new Set());
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorStep, setEditorStep] = useState<EditorStep>('details');
  const [formData, setFormData] = useState<AutomationFormData>({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [runningLateEnabled, setRunningLateEnabled] = useState(false);
  const [togglingRunningLate, setTogglingRunningLate] = useState(false);
  const [emailOnQuoteAccepted, setEmailOnQuoteAccepted] = useState(false);
  const [emailOnInvoicePaid, setEmailOnInvoicePaid] = useState(false);
  const [togglingEmailAlert, setTogglingEmailAlert] = useState(false);

  const activeCount = useMemo(() => automations.filter(a => a.isActive).length, [automations]);
  const totalCount = automations.length;
  const availableCount = templates.length;

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [automationsRes, templatesRes, activityRes] = await Promise.all([
        api.get<Automation[]>('/api/automations'),
        api.get<AutomationTemplate[]>('/api/automation-templates'),
        api.get<ActivityLogEntry[]>('/api/autopilot/activity-log?limit=50'),
      ]);

      if (automationsRes.error) {
        setError(automationsRes.error);
      } else {
        setAutomations(automationsRes.data || []);
      }
      setTemplates(templatesRes.data || []);
      setActivityLogs(activityRes.data || []);
    } catch (err) {
      setError('Failed to load automations');
      console.error('Error fetching automations:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    api.get<{ smartRunningLateEnabled?: boolean }>('/api/notification-preferences').then(res => {
      if (res.data && !res.error) {
        setRunningLateEnabled(res.data.smartRunningLateEnabled !== false);
      }
    });
    api.get<{ emailOnQuoteAccepted?: boolean; emailOnInvoicePaid?: boolean }>('/api/business-settings').then(res => {
      if (res.data && !res.error) {
        setEmailOnQuoteAccepted(res.data.emailOnQuoteAccepted === true);
        setEmailOnInvoicePaid(res.data.emailOnInvoicePaid === true);
      }
    });
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
    api.get<{ smartRunningLateEnabled?: boolean }>('/api/notification-preferences').then(res => {
      if (res.data && !res.error) {
        setRunningLateEnabled(res.data.smartRunningLateEnabled !== false);
      }
    });
  }, [fetchData]);

  const handleRunningLateToggle = useCallback(async (value: boolean) => {
    setTogglingRunningLate(true);
    setRunningLateEnabled(value);
    try {
      const res = await api.patch('/api/notification-preferences', { smartRunningLateEnabled: value });
      if (res.error) {
        setRunningLateEnabled(!value);
        Alert.alert('Error', 'Failed to update running late detection');
      }
    } catch {
      setRunningLateEnabled(!value);
      Alert.alert('Error', 'Failed to update setting');
    } finally {
      setTogglingRunningLate(false);
    }
  }, []);

  const handleEmailAlertToggle = useCallback(async (field: 'emailOnQuoteAccepted' | 'emailOnInvoicePaid', value: boolean) => {
    setTogglingEmailAlert(true);
    if (field === 'emailOnQuoteAccepted') setEmailOnQuoteAccepted(value);
    else setEmailOnInvoicePaid(value);
    try {
      const res = await api.patch('/api/business-settings', { [field]: value });
      if (res.error) {
        if (field === 'emailOnQuoteAccepted') setEmailOnQuoteAccepted(!value);
        else setEmailOnInvoicePaid(!value);
        Alert.alert('Error', 'Failed to update email alert setting');
      }
    } catch {
      if (field === 'emailOnQuoteAccepted') setEmailOnQuoteAccepted(!value);
      else setEmailOnInvoicePaid(!value);
      Alert.alert('Error', 'Failed to update setting');
    } finally {
      setTogglingEmailAlert(false);
    }
  }, []);

  const handleToggle = useCallback(async (automation: Automation) => {
    const newActive = !automation.isActive;
    setTogglingIds(prev => new Set(prev).add(automation.id));
    setAutomations(prev => prev.map(a => a.id === automation.id ? { ...a, isActive: newActive } : a));

    try {
      const res = await api.patch(`/api/automations/${automation.id}`, { isActive: newActive });
      if (res.error) {
        setAutomations(prev => prev.map(a => a.id === automation.id ? { ...a, isActive: automation.isActive } : a));
        Alert.alert('Error', res.error);
      }
    } catch {
      setAutomations(prev => prev.map(a => a.id === automation.id ? { ...a, isActive: automation.isActive } : a));
      Alert.alert('Error', 'Failed to update automation');
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(automation.id);
        return next;
      });
    }
  }, []);

  const handleEnableTemplate = useCallback(async (template: AutomationTemplate) => {
    setEnablingIds(prev => new Set(prev).add(template.id));
    try {
      const res = await api.post(`/api/automation-templates/${template.id}/enable`);
      if (res.error) {
        Alert.alert('Error', res.error);
      } else {
        Alert.alert('Success', `"${template.name}" has been enabled`);
        fetchData();
      }
    } catch {
      Alert.alert('Error', 'Failed to enable template');
    } finally {
      setEnablingIds(prev => {
        const next = new Set(prev);
        next.delete(template.id);
        return next;
      });
    }
  }, [fetchData]);

  const openCreateEditor = useCallback(() => {
    setFormData({ ...EMPTY_FORM, actions: [{ type: '' }] });
    setEditingId(null);
    setEditorStep('details');
    setEditorVisible(true);
  }, []);

  const openEditEditor = useCallback((automation: Automation) => {
    setFormData({
      name: automation.name,
      description: automation.description || '',
      isActive: automation.isActive,
      trigger: { ...automation.trigger },
      actions: automation.actions.length > 0 ? automation.actions.map(a => ({ ...a })) : [{ type: '' }],
    });
    setEditingId(automation.id);
    setEditorStep('details');
    setEditorVisible(true);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorVisible(false);
    setEditingId(null);
    setFormData({ ...EMPTY_FORM });
  }, []);

  const handleSaveAutomation = useCallback(async () => {
    if (!formData.name.trim()) {
      Alert.alert('Validation', 'Please enter a name for this automation');
      return;
    }
    if (!formData.trigger.type) {
      Alert.alert('Validation', 'Please select a trigger type');
      return;
    }
    if (!formData.trigger.entityType) {
      Alert.alert('Validation', 'Please select an entity type');
      return;
    }
    if (!formData.actions[0]?.type) {
      Alert.alert('Validation', 'Please add at least one action');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        isActive: formData.isActive,
        trigger: formData.trigger,
        actions: formData.actions.filter(a => a.type),
      };

      let res;
      if (editingId) {
        res = await api.patch(`/api/automations/${editingId}`, payload);
      } else {
        res = await api.post('/api/automations', payload);
      }

      if (res.error) {
        Alert.alert('Error', res.error);
      } else {
        Alert.alert('Success', editingId ? 'Automation updated' : 'Automation created');
        closeEditor();
        fetchData();
      }
    } catch {
      Alert.alert('Error', 'Failed to save automation');
    } finally {
      setIsSaving(false);
    }
  }, [formData, editingId, closeEditor, fetchData]);

  const handleDeleteAutomation = useCallback((automation: Automation) => {
    confirm({
      title: 'Delete Automation',
      message: `Are you sure you want to delete "${automation.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      destructive: true,
    }).then(async (ok) => {
      if (!ok) return;
      try {
        const res = await api.delete(`/api/automations/${automation.id}`);
        if (res.error) {
          Alert.alert('Error', res.error);
        } else {
          fetchData();
        }
      } catch {
        Alert.alert('Error', 'Failed to delete automation');
      }
    });
  }, [confirm, fetchData]);

  const updateFormTrigger = useCallback((updates: Partial<AutomationTrigger>) => {
    setFormData(prev => ({ ...prev, trigger: { ...prev.trigger, ...updates } }));
  }, []);

  const updateFormAction = useCallback((index: number, updates: Partial<AutomationAction>) => {
    setFormData(prev => {
      const actions = [...prev.actions];
      actions[index] = { ...actions[index], ...updates };
      return { ...prev, actions };
    });
  }, []);

  const addAction = useCallback(() => {
    setFormData(prev => ({ ...prev, actions: [...prev.actions, { type: '' }] }));
  }, []);

  const removeAction = useCallback((index: number) => {
    setFormData(prev => {
      if (prev.actions.length <= 1) return prev;
      return { ...prev, actions: prev.actions.filter((_, i) => i !== index) };
    });
  }, []);

  const STEPS: EditorStep[] = ['details', 'trigger', 'actions', 'review'];
  const currentStepIndex = STEPS.indexOf(editorStep);
  const canGoNext = (() => {
    if (editorStep === 'details') return formData.name.trim().length > 0;
    if (editorStep === 'trigger') return !!formData.trigger.type && !!formData.trigger.entityType;
    if (editorStep === 'actions') return formData.actions.some(a => !!a.type);
    return true;
  })();

  const goNext = useCallback(() => {
    const idx = STEPS.indexOf(editorStep);
    if (idx < STEPS.length - 1) setEditorStep(STEPS[idx + 1]);
  }, [editorStep]);

  const goBack = useCallback(() => {
    const idx = STEPS.indexOf(editorStep);
    if (idx > 0) setEditorStep(STEPS[idx - 1]);
  }, [editorStep]);

  const renderEditorModal = () => {
    const stepTitles: Record<EditorStep, string> = {
      details: 'Automation Details',
      trigger: 'Choose Trigger',
      actions: 'Set Actions',
      review: 'Review & Save',
    };

    return (
      <Modal visible={editorVisible} animationType="slide" transparent onRequestClose={closeEditor}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { backgroundColor: colors.card }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {editingId ? 'Edit Automation' : 'Create Automation'}
                </Text>
                <PressableRow onPress={closeEditor} >
                  <Feather name="x" size={22} color={colors.mutedForeground} />
                </PressableRow>
              </View>

              <View style={styles.stepIndicator}>
                {STEPS.map((step, i) => (
                  <View
                    key={step}
                    style={[
                      styles.stepDot,
                      { backgroundColor: i <= currentStepIndex ? colors.primary : colors.border },
                    ]}
                  />
                ))}
              </View>

              <Text style={[styles.inputLabel, { color: colors.primary, paddingHorizontal: spacing.lg, marginTop: spacing.sm }]}>
                {stepTitles[editorStep]}
              </Text>

              <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                {editorStep === 'details' && (
                  <>
                    <Text style={[styles.inputLabel, { color: colors.foreground, marginTop: 0 }]}>Name</Text>
                    <TextInput
                      style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                      value={formData.name}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                      placeholder="e.g. Follow up on sent quotes"
                      placeholderTextColor={colors.mutedForeground}
                    />

                    <Text style={[styles.inputLabel, { color: colors.foreground }]}>Description (optional)</Text>
                    <TextInput
                      style={[styles.textInputMultiline, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                      value={formData.description}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                      placeholder="Describe what this automation does..."
                      placeholderTextColor={colors.mutedForeground}
                      multiline
                    />

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
                      <Text style={[styles.inputLabel, { color: colors.foreground, marginTop: 0, marginBottom: 0 }]}>Enable immediately</Text>
                      <Switch
                        value={formData.isActive}
                        onValueChange={(val) => setFormData(prev => ({ ...prev, isActive: val }))}
                        trackColor={{ false: colors.border, true: colors.primary + '80' }}
                        thumbColor={'#FFFFFF'}
                      />
                    </View>
                  </>
                )}

                {editorStep === 'trigger' && (
                  <>
                    <Text style={[styles.inputLabel, { color: colors.foreground, marginTop: 0 }]}>Trigger Type</Text>
                    {TRIGGER_TYPES.map((t) => {
                      const selected = formData.trigger.type === t.value;
                      return (
                        <PressableRow key={t.value} style={[ styles.optionCard, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '08' : 'transparent', }, ]} onPress={() => updateFormTrigger({ type: t.value })} >
                          <View style={[styles.optionIconContainer, { backgroundColor: selected ? colors.primary + '18' : colors.border + '40' }]}>
                            <Feather name={t.icon as any} size={iconSizes.xl} color={selected ? colors.primary : colors.mutedForeground} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.optionTitle, { color: colors.foreground }]}>{t.label}</Text>
                            <Text style={[styles.optionDescription, { color: colors.mutedForeground }]}>{t.description}</Text>
                          </View>
                          {selected && <Feather name="check-circle" size={iconSizes.xl} color={colors.primary} />}
                        </PressableRow>
                      );
                    })}

                    <Text style={[styles.inputLabel, { color: colors.foreground }]}>Entity Type</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                      {ENTITY_TYPES.map((e) => {
                        const selected = formData.trigger.entityType === e.value;
                        return (
                          <PressableRow key={e.value} style={[ styles.optionCard, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '08' : 'transparent', flex: 0, paddingHorizontal: spacing.md, marginBottom: 0, }, ]} onPress={() => updateFormTrigger({ entityType: e.value })} >
                            <Feather name={e.icon as any} size={iconSizes.md} color={selected ? colors.primary : colors.mutedForeground} />
                            <Text style={[styles.optionTitle, { color: selected ? colors.primary : colors.foreground, fontSize: typography.button.fontSize }]}>{e.label}</Text>
                          </PressableRow>
                        );
                      })}
                    </View>

                    {formData.trigger.type === 'status_change' && formData.trigger.entityType && (
                      <>
                        <Text style={[styles.inputLabel, { color: colors.foreground }]}>From Status (optional)</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
                          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                            {(STATUS_OPTIONS[formData.trigger.entityType] || []).map(s => {
                              const selected = formData.trigger.fromStatus === s;
                              return (
                                <PressableRow key={s} onPress={() => updateFormTrigger({ fromStatus: selected ? undefined : s })} style={[styles.statusBadge, { backgroundColor: selected ? colors.primary + '18' : colors.border + '30', paddingHorizontal: spacing.md, paddingVertical: spacing.xs }]} >
                                  <Text style={[styles.statusBadgeText, { color: selected ? colors.primary : colors.mutedForeground }]}>
                                    {s.replace(/_/g, ' ')}
                                  </Text>
                                </PressableRow>
                              );
                            })}
                          </View>
                        </ScrollView>

                        <Text style={[styles.inputLabel, { color: colors.foreground }]}>To Status</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                            {(STATUS_OPTIONS[formData.trigger.entityType] || []).map(s => {
                              const selected = formData.trigger.toStatus === s;
                              return (
                                <PressableRow key={s} onPress={() => updateFormTrigger({ toStatus: selected ? undefined : s })} style={[styles.statusBadge, { backgroundColor: selected ? colors.primary + '18' : colors.border + '30', paddingHorizontal: spacing.md, paddingVertical: spacing.xs }]} >
                                  <Text style={[styles.statusBadgeText, { color: selected ? colors.primary : colors.mutedForeground }]}>
                                    {s.replace(/_/g, ' ')}
                                  </Text>
                                </PressableRow>
                              );
                            })}
                          </View>
                        </ScrollView>
                      </>
                    )}

                    {(formData.trigger.type === 'time_delay' || formData.trigger.type === 'no_response') && (
                      <>
                        <Text style={[styles.inputLabel, { color: colors.foreground }]}>Delay (days)</Text>
                        <TextInput
                          style={[styles.delayInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                          value={formData.trigger.delayDays?.toString() || ''}
                          onChangeText={(text) => {
                            const num = parseInt(text) || undefined;
                            updateFormTrigger({ delayDays: num });
                          }}
                          keyboardType="number-pad"
                          placeholder="3"
                          placeholderTextColor={colors.mutedForeground}
                        />
                      </>
                    )}
                  </>
                )}

                {editorStep === 'actions' && (
                  <>
                    {formData.actions.map((action, idx) => (
                      <View key={idx} style={{ marginBottom: spacing.md }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                          <Text style={[styles.inputLabel, { color: colors.foreground, marginTop: 0, marginBottom: 0 }]}>
                            Action {formData.actions.length > 1 ? `${idx + 1}` : ''}
                          </Text>
                          {formData.actions.length > 1 && (
                            <PressableRow onPress={() => removeAction(idx)} >
                              <Feather name="trash-2" size={iconSizes.md} color={colors.destructive || '#ef4444'} />
                            </PressableRow>
                          )}
                        </View>
                        {ACTION_TYPES.map((a) => {
                          const selected = action.type === a.value;
                          return (
                            <PressableRow key={a.value} style={[ styles.optionCard, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '08' : 'transparent', }, ]} onPress={() => updateFormAction(idx, { type: a.value })} >
                              <View style={[styles.optionIconContainer, { backgroundColor: selected ? colors.primary + '18' : colors.border + '40' }]}>
                                <Feather name={a.icon as any} size={iconSizes.xl} color={selected ? colors.primary : colors.mutedForeground} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.optionTitle, { color: colors.foreground }]}>{a.label}</Text>
                                <Text style={[styles.optionDescription, { color: colors.mutedForeground }]}>{a.description}</Text>
                              </View>
                              {selected && <Feather name="check-circle" size={iconSizes.xl} color={colors.primary} />}
                            </PressableRow>
                          );
                        })}

                        {action.type === 'update_status' && formData.trigger.entityType && (
                          <>
                            <Text style={[styles.inputLabel, { color: colors.foreground }]}>New Status</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                                {(STATUS_OPTIONS[formData.trigger.entityType] || []).map(s => {
                                  const selected = action.newStatus === s;
                                  return (
                                    <PressableRow key={s} onPress={() => updateFormAction(idx, { newStatus: s })} style={[styles.statusBadge, { backgroundColor: selected ? colors.primary + '18' : colors.border + '30', paddingHorizontal: spacing.md, paddingVertical: spacing.xs }]} >
                                      <Text style={[styles.statusBadgeText, { color: selected ? colors.primary : colors.mutedForeground }]}>
                                        {s.replace(/_/g, ' ')}
                                      </Text>
                                    </PressableRow>
                                  );
                                })}
                              </View>
                            </ScrollView>
                          </>
                        )}

                        {(action.type === 'send_email' || action.type === 'send_sms' || action.type === 'send_notification') && (
                          <>
                            <Text style={[styles.inputLabel, { color: colors.foreground }]}>Message (optional)</Text>
                            <TextInput
                              style={[styles.textInputMultiline, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                              value={action.message || ''}
                              onChangeText={(text) => updateFormAction(idx, { message: text })}
                              placeholder="Custom message template..."
                              placeholderTextColor={colors.mutedForeground}
                              multiline
                            />
                          </>
                        )}
                      </View>
                    ))}

                    <PressableRow style={[styles.deleteButton, { borderColor: colors.primary }]} onPress={addAction} >
                      <Feather name="plus" size={iconSizes.md} color={colors.primary} />
                      <Text style={[styles.footerButtonText, { color: colors.primary }]}>Add Another Action</Text>
                    </PressableRow>
                  </>
                )}

                {editorStep === 'review' && (
                  <>
                    <View style={[styles.reviewSection, { borderColor: colors.border, backgroundColor: colors.background }]}>
                      <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>NAME</Text>
                      <Text style={[styles.reviewValue, { color: colors.foreground }]}>{formData.name}</Text>
                      {formData.description ? (
                        <>
                          <Text style={[styles.reviewLabel, { color: colors.mutedForeground, marginTop: spacing.sm }]}>DESCRIPTION</Text>
                          <Text style={[styles.reviewValue, { color: colors.foreground }]}>{formData.description}</Text>
                        </>
                      ) : null}
                    </View>

                    <View style={[styles.reviewSection, { borderColor: colors.border, backgroundColor: colors.background }]}>
                      <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>TRIGGER</Text>
                      <Text style={[styles.reviewValue, { color: colors.foreground }]}>{getTriggerSummary(formData.trigger)}</Text>
                    </View>

                    <View style={[styles.reviewSection, { borderColor: colors.border, backgroundColor: colors.background }]}>
                      <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>ACTIONS</Text>
                      <Text style={[styles.reviewValue, { color: colors.foreground }]}>{getActionSummary(formData.actions)}</Text>
                    </View>

                    <View style={[styles.reviewSection, { borderColor: colors.border, backgroundColor: colors.background }]}>
                      <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>STATUS</Text>
                      <Text style={[styles.reviewValue, { color: formData.isActive ? '#22c55e' : colors.mutedForeground }]}>
                        {formData.isActive ? 'Active (enabled immediately)' : 'Inactive (disabled)'}
                      </Text>
                    </View>
                  </>
                )}
              </ScrollView>

              <View style={[styles.modalFooter, { borderTopColor: colors.border, backgroundColor: colors.card, paddingBottom: insets.bottom + spacing.md }]}>
                {currentStepIndex > 0 ? (
                  <PressableRow style={[styles.footerButton, { backgroundColor: colors.border + '40' }]} onPress={goBack} >
                    <Feather name="arrow-left" size={iconSizes.md} color={colors.foreground} />
                    <Text style={[styles.footerButtonText, { color: colors.foreground }]}>Back</Text>
                  </PressableRow>
                ) : (
                  <PressableRow style={[styles.footerButton, { backgroundColor: colors.border + '40' }]} onPress={closeEditor} >
                    <Text style={[styles.footerButtonText, { color: colors.foreground }]}>Cancel</Text>
                  </PressableRow>
                )}

                {editorStep === 'review' ? (
                  <PressableRow style={[styles.footerButton, { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 }]} onPress={handleSaveAutomation} disabled={isSaving} >
                    {isSaving ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground || colors.white} />
                    ) : (
                      <>
                        <Feather name="check" size={iconSizes.md} color={colors.primaryForeground || colors.white} />
                        <Text style={[styles.footerButtonText, { color: colors.primaryForeground || colors.white }]}>
                          {editingId ? 'Update' : 'Create'}
                        </Text>
                      </>
                    )}
                  </PressableRow>
                ) : (
                  <PressableRow style={[styles.footerButton, { backgroundColor: canGoNext ? colors.primary : colors.border, opacity: canGoNext ? 1 : 0.5 }]} onPress={goNext} disabled={!canGoNext} >
                    <Text style={[styles.footerButtonText, { color: canGoNext ? (colors.primaryForeground || colors.white) : colors.mutedForeground }]}>Next</Text>
                    <Feather name="arrow-right" size={iconSizes.md} color={canGoNext ? (colors.primaryForeground || colors.white) : colors.mutedForeground} />
                  </PressableRow>
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  const renderStatsRow = () => (
    <View style={styles.statsRow}>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
          <Feather name="zap" size={16} color="#22c55e" />
        </View>
        <Text style={[styles.statValue, { color: '#22c55e' }]}>{activeCount}</Text>
        <Text style={styles.statLabel}>Active</Text>
      </View>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
          <Feather name="copy" size={16} color="#3b82f6" />
        </View>
        <Text style={[styles.statValue, { color: colors.foreground }]}>{availableCount}</Text>
        <Text style={styles.statLabel}>Available</Text>
      </View>
      <View style={styles.statCard}>
        <View style={[styles.statIconContainer, { backgroundColor: 'rgba(107,114,128,0.1)' }]}>
          <Feather name="layers" size={16} color="#6b7280" />
        </View>
        <Text style={[styles.statValue, { color: colors.foreground }]}>{totalCount}</Text>
        <Text style={styles.statLabel}>Total</Text>
      </View>
    </View>
  );

  const renderAutomationCard = (automation: Automation) => {
    const isActive = automation.isActive;
    return (
      <View key={automation.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.automationIconContainer, { backgroundColor: isActive ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)' }]}>
              <Feather name="zap" size={iconSizes.xl} color={isActive ? '#22c55e' : '#6b7280'} />
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{automation.name}</Text>
          </View>
          <Switch
            value={automation.isActive}
            onValueChange={() => handleToggle(automation)}
            disabled={togglingIds.has(automation.id)}
            trackColor={{ false: colors.border, true: colors.primary + '80' }}
            thumbColor={'#FFFFFF'}
          />
        </View>

        {automation.description ? (
          <Text style={styles.cardDescription} numberOfLines={2}>{automation.description}</Text>
        ) : null}

        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Feather name="play-circle" size={iconSizes.sm} color={colors.mutedForeground} />
            <Text style={styles.detailText} numberOfLines={1}>{getTriggerSummary(automation.trigger)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="arrow-right-circle" size={iconSizes.sm} color={colors.mutedForeground} />
            <Text style={styles.detailText} numberOfLines={1}>{getActionSummary(automation.actions)}</Text>
          </View>
        </View>

        <View style={[styles.cardFooter, { justifyContent: 'space-between' }]}>
          <View style={[styles.statusBadge, { backgroundColor: isActive ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)' }]}>
            <Text style={[styles.statusBadgeText, { color: isActive ? '#22c55e' : '#6b7280' }]}>
              {isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <PressableRow onPress={() => openEditEditor(automation)} style={{ padding: spacing.xs }} >
              <Feather name="edit-2" size={iconSizes.lg} color={colors.primary} />
            </PressableRow>
            <PressableRow onPress={() => handleDeleteAutomation(automation)} style={{ padding: spacing.xs }} >
              <Feather name="trash-2" size={iconSizes.lg} color={colors.destructive || '#ef4444'} />
            </PressableRow>
          </View>
        </View>
      </View>
    );
  };

  const renderTemplateCard = (template: AutomationTemplate) => {
    const isEnabling = enablingIds.has(template.id);
    const catStyle = getCategoryStyle(template.category);
    return (
      <View key={template.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.templateIconContainer, { backgroundColor: catStyle.bgColor }]}>
              <Feather name="zap" size={iconSizes.xl} color={catStyle.color} />
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{template.name}</Text>
          </View>
        </View>

        {template.description ? (
          <Text style={styles.cardDescription} numberOfLines={3}>{template.description}</Text>
        ) : null}

        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Feather name="play-circle" size={iconSizes.sm} color={colors.mutedForeground} />
            <Text style={styles.detailText} numberOfLines={1}>{getTriggerSummary(template.trigger)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Feather name="arrow-right-circle" size={iconSizes.sm} color={colors.mutedForeground} />
            <Text style={styles.detailText} numberOfLines={1}>{getActionSummary(template.actions)}</Text>
          </View>
        </View>

        {template.category ? (
          <View style={styles.categoryContainer}>
            <View style={[styles.categoryBadge, { backgroundColor: catStyle.bgColor }]}>
              <Text style={[styles.categoryText, { color: catStyle.color }]}>{template.category}</Text>
            </View>
          </View>
        ) : null}

        <PressableRow style={styles.enableButton} onPress={() => handleEnableTemplate(template)} disabled={isEnabling} >
          {isEnabling ? (
            <ActivityIndicator size="small" color={colors.primaryForeground || colors.white} />
          ) : (
            <>
              <Feather name="plus" size={iconSizes.md} color={colors.primaryForeground || colors.white} />
              <Text style={styles.enableButtonText}>Enable</Text>
            </>
          )}
        </PressableRow>
      </View>
    );
  };

  const renderEmptyState = (type: 'automations' | 'templates') => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconContainer, { backgroundColor: colors.primaryLight || (colors.primary + '15') }]}>
        <Feather name="zap" size={18} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>
        {type === 'automations' ? 'Put Your Business on Autopilot' : 'No Templates Available'}
      </Text>
      <Text style={styles.emptyDescription}>
        {type === 'automations'
          ? 'Create automations to streamline your workflow. Let smart triggers handle the repetitive tasks so you can focus on what matters.'
          : 'Templates will appear here when available. Check back soon for ready-made automations.'}
      </Text>
      {type === 'automations' && (
        <View style={{ gap: spacing.xs, alignItems: 'center' }}>
          <PressableRow style={styles.emptyCta} onPress={openCreateEditor} >
            <Feather name="plus" size={iconSizes.md} color={colors.primaryForeground || colors.white} />
            <Text style={styles.emptyCtaText}>Create Automation</Text>
          </PressableRow>
          <PressableRow onPress={() => setActiveTab('templates')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs }} >
            <Feather name="copy" size={iconSizes.sm} color={colors.primary} />
            <Text style={[styles.emptyCtaText, { color: colors.primary, fontSize: typography.sizes.sm }]}>Browse Templates</Text>
          </PressableRow>
        </View>
      )}
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.pageTitle}>Autopilot</Text>
              <Text style={styles.pageSubtitle}>Automate your workflow with smart triggers</Text>
            </View>
          </View>

          {!isLoading && renderStatsRow()}

          <View style={styles.tabContainer}>
            <PressableRow style={[styles.tab, activeTab === 'automations' && styles.activeTab]} onPress={() => setActiveTab('automations')} >
              <Feather
                name="zap"
                size={14}
                color={activeTab === 'automations' ? colors.primary : colors.mutedForeground}
              />
              <Text style={[styles.tabText, activeTab === 'automations' && styles.activeTabText]} numberOfLines={1}>
                Automations
              </Text>
              <View style={[styles.tabBadge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.tabBadgeText, { color: colors.primaryForeground }]}>{automations.length}</Text>
              </View>
            </PressableRow>

            <PressableRow style={[styles.tab, activeTab === 'templates' && styles.activeTab]} onPress={() => setActiveTab('templates')} >
              <Feather
                name="copy"
                size={14}
                color={activeTab === 'templates' ? colors.primary : colors.mutedForeground}
              />
              <Text style={[styles.tabText, activeTab === 'templates' && styles.activeTabText]} numberOfLines={1}>
                Templates
              </Text>
              <View style={[styles.tabBadge, { backgroundColor: '#6b7280' }]}>
                <Text style={styles.tabBadgeText}>{templates.length}</Text>
              </View>
            </PressableRow>

            <PressableRow style={[styles.tab, activeTab === 'activity' && styles.activeTab]} onPress={() => setActiveTab('activity')} >
              <Feather
                name="activity"
                size={14}
                color={activeTab === 'activity' ? colors.primary : colors.mutedForeground}
              />
              <Text style={[styles.tabText, activeTab === 'activity' && styles.activeTabText]} numberOfLines={1}>
                Activity
              </Text>
              {activityLogs.length > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: '#22c55e' }]}>
                  <Text style={styles.tabBadgeText}>{activityLogs.length}</Text>
                </View>
              )}
            </PressableRow>
          </View>

          {error && automations.length === 0 && (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={28} color={colors.destructive} />
              <Text style={styles.errorText}>{error}</Text>
              <PressableRow style={styles.retryButton} onPress={() => { setIsLoading(true); fetchData(); }} >
                <Feather name="refresh-cw" size={iconSizes.sm} color={colors.primaryForeground || colors.white} />
                <Text style={styles.retryButtonText}>Try Again</Text>
              </PressableRow>
            </View>
          )}

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading automations...</Text>
            </View>
          )}

          {!isLoading && !error && activeTab === 'automations' && (
            <>
              {/* Smart GPS Features */}
              <Text style={styles.sectionTitle}>SMART GPS FEATURES</Text>
              <View style={[styles.card, { borderColor: runningLateEnabled ? colors.success + '40' : colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="navigation" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { marginBottom: 2 }]}>Running Late Detection</Text>
                    <Text style={[styles.cardDescription, { fontSize: typography.sizes.xs }]}>
                      Uses GPS to detect if you can't make your next job on time. Auto-notifies you with a one-tap client alert.
                    </Text>
                  </View>
                  <Switch
                    value={runningLateEnabled}
                    onValueChange={handleRunningLateToggle}
                    disabled={togglingRunningLate}
                    trackColor={{ false: colors.muted, true: colors.success + '60' }}
                    thumbColor={runningLateEnabled ? colors.success : colors.mutedForeground}
                  />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, paddingLeft: 48 }}>
                  <Feather name="info" size={12} color={colors.mutedForeground} />
                  <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>
                    Checks every 5 min when you have upcoming jobs within the hour
                  </Text>
                </View>
              </View>

              <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>EMAIL ALERTS</Text>
              <View style={[styles.card, { borderColor: emailOnQuoteAccepted ? colors.success + '40' : colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: '#3b82f6' + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="mail" size={18} color="#3b82f6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { marginBottom: 2 }]}>Quote Accepted</Text>
                    <Text style={[styles.cardDescription, { fontSize: typography.sizes.xs }]}>
                      Get an email when a client accepts your quote via the link you sent them.
                    </Text>
                  </View>
                  <Switch
                    value={emailOnQuoteAccepted}
                    onValueChange={(v) => handleEmailAlertToggle('emailOnQuoteAccepted', v)}
                    disabled={togglingEmailAlert}
                    trackColor={{ false: colors.muted, true: colors.success + '60' }}
                    thumbColor={emailOnQuoteAccepted ? colors.success : colors.mutedForeground}
                  />
                </View>
              </View>
              <View style={[styles.card, { marginTop: spacing.sm, borderColor: emailOnInvoicePaid ? colors.success + '40' : colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: '#22c55e' + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="dollar-sign" size={18} color="#22c55e" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { marginBottom: 2 }]}>Invoice Paid</Text>
                    <Text style={[styles.cardDescription, { fontSize: typography.sizes.xs }]}>
                      Get an email when a client pays an invoice online.
                    </Text>
                  </View>
                  <Switch
                    value={emailOnInvoicePaid}
                    onValueChange={(v) => handleEmailAlertToggle('emailOnInvoicePaid', v)}
                    disabled={togglingEmailAlert}
                    trackColor={{ false: colors.muted, true: colors.success + '60' }}
                    thumbColor={emailOnInvoicePaid ? colors.success : colors.mutedForeground}
                  />
                </View>
              </View>

              <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>YOUR AUTOMATIONS</Text>
              {automations.length === 0
                ? renderEmptyState('automations')
                : automations.map(renderAutomationCard)}
            </>
          )}

          {!isLoading && activeTab === 'templates' && (
            <>
              <Text style={styles.sectionTitle}>AVAILABLE TEMPLATES</Text>
              <View style={styles.templateGrid}>
                {templates.length === 0
                  ? renderEmptyState('templates')
                  : templates.map(renderTemplateCard)}
              </View>
            </>
          )}

          {!isLoading && activeTab === 'activity' && (
            <>
              <Text style={styles.sectionTitle}>AUTOMATION ACTIVITY</Text>
              {activityLogs.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={[styles.emptyIconContainer, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                    <Feather name="clock" size={18} color="#22c55e" />
                  </View>
                  <Text style={styles.emptyTitle}>No Activity Yet</Text>
                  <Text style={styles.emptyDescription}>
                    Activity will appear here when your automations fire — showing what was sent, to whom, and when.
                  </Text>
                </View>
              ) : (
                activityLogs.map((entry) => {
                  const typeInfo = AUTOMATION_TYPE_LABELS[entry.automationType] || AUTOMATION_TYPE_LABELS.general;
                  const isFailed = entry.status === 'failed' || entry.status === 'error';
                  const isExpanded = expandedLogId === entry.id;
                  return (
                    <PressableRow key={entry.id} style={styles.card} onPress={() => setExpandedLogId(isExpanded ? null : entry.id)} >
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                        <View style={[styles.automationIconContainer, { backgroundColor: isFailed ? 'rgba(239,68,68,0.1)' : (typeInfo.color + '18') }]}>
                          {isFailed ? (
                            <Feather name="x-circle" size={iconSizes.xl} color="#ef4444" />
                          ) : (
                            <Feather name="check-circle" size={iconSizes.xl} color="#22c55e" />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                            <View style={[styles.statusBadge, { backgroundColor: typeInfo.color + '18' }]}>
                              <Text style={[styles.statusBadgeText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
                            </View>
                            {isFailed && (
                              <View style={[styles.statusBadge, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                                <Text style={[styles.statusBadgeText, { color: '#ef4444' }]}>Failed</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.cardTitle, { marginTop: spacing.xs, fontSize: typography.button.fontSize }]} numberOfLines={1}>
                            {entry.entityLabel}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
                            <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground }}>
                              to {entry.recipientName}
                            </Text>
                            <View style={[styles.statusBadge, { backgroundColor: colors.border + '40', paddingHorizontal: spacing.sm, paddingVertical: 2 }]}>
                              <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, fontWeight: fontWeights.medium }}>
                                {entry.channel === 'sms' ? 'SMS' : entry.channel === 'email' ? 'Email' : entry.channel === 'both' ? 'Both' : entry.channel}
                              </Text>
                            </View>
                            <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginLeft: 'auto' }}>
                              {timeAgo(entry.createdAt)}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {isExpanded && (
                        <View style={{ marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border + '40' }}>
                          <View style={styles.detailRow}>
                            <Feather name="clock" size={iconSizes.sm} color={colors.mutedForeground} />
                            <Text style={styles.detailText}>
                              {entry.createdAt ? new Date(entry.createdAt).toLocaleString('en-AU', {
                                day: 'numeric', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              }) : '—'}
                            </Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Feather name="tag" size={iconSizes.sm} color={colors.mutedForeground} />
                            <Text style={styles.detailText}>
                              {entry.entityType.charAt(0).toUpperCase() + entry.entityType.slice(1)} ID: {entry.entityId.slice(0, 8)}...
                            </Text>
                          </View>
                          {isFailed && entry.errorMessage && (
                            <View style={styles.detailRow}>
                              <Feather name="alert-triangle" size={iconSizes.sm} color="#ef4444" />
                              <Text style={[styles.detailText, { color: '#ef4444' }]}>{entry.errorMessage}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </PressableRow>
                  );
                })
              )}
            </>
          )}
        </ScrollView>

        {renderEditorModal()}
      </View>
    </>
  );
}
