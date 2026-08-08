import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, Switch, TextInput, Linking, Platform } from 'react-native';
import { Alert } from '@/lib/alert';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { useActionSheet } from '../../src/components/ui/ActionSheet';
import { PressableRow } from '@/components/ui/PressableRow';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { asHref } from '../../src/lib/nav';
import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useTheme, type ThemeColors } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { spacing, radius, shadows, typography, pageShell, fontWeights } from '../../src/lib/design-tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { useUserRole } from '../../src/hooks/use-user-role';
import { isIAPAvailable, purchaseSubscription, IAP_ADDON_PRODUCT_IDS } from '../../src/lib/iap';

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

interface TransferNumber {
  name: string;
  phone: string;
  priority: number;
}

interface KnowledgeBankContent {
  faqs?: Array<{ question: string; answer: string }>;
  serviceDescriptions?: string;
  pricingInfo?: string;
  specialInstructions?: string;
}

interface VoiceChangeRequest {
  id: string;
  requestedDescription: string;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface CallLog {
  id: string;
  callerPhone: string | null;
  callerName: string | null;
  status: string;
  duration: number | null;
  summary: string | null;
  transcript: string | null;
  recordingUrl: string | null;
  outcome: string | null;
  callerIntent: string | null;
  sentiment: string | null;
  sentimentScore: number | null;
  latencyMs: number | null;
  createdAt: string;
}

function getLatencyTone(ms: number, colors: ThemeColors): { bg: string; text: string; label: string } {
  if (ms > 3000) return { bg: '#fee2e2', text: '#b91c1c', label: 'Slow' };
  if (ms > 1500) return { bg: '#fef3c7', text: '#92400e', label: 'Above target' };
  return { bg: colors.cardBorder, text: colors.mutedForeground, label: 'On target' };
}

interface DaySchedule {
  day: number;
  enabled: boolean;
  start: string;
  end: string;
  breakStart?: string;
  breakEnd?: string;
}

interface Holiday {
  date: string;
  label: string;
}

interface BusinessHoursData {
  start: string;
  end: string;
  timezone: string;
  days: number[];
  schedule?: DaySchedule[];
  holidays?: Holiday[];
}

interface ReceptionistConfig {
  enabled: boolean;
  mode: string;
  voice: string;
  greeting: string | null;
  transferNumbers: TransferNumber[];
  businessHours: BusinessHoursData | null;
  dedicatedPhoneNumber: string | null;
  vapiAssistantId: string | null;
  approvalStatus: string | null;
  knowledgeBank: KnowledgeBankContent | null;
  voiceStability: number | null;
  voiceClarity: number | null;
  voiceSpeed: number | null;
  voiceStyleExaggeration: number | null;
  voiceSpeakerBoost: boolean | null;
  voicemailDetectionEnabled: boolean | null;
  voicemailMessage: string | null;
  silenceTimeoutSeconds: number | null;
  maxCallDurationSeconds: number | null;
  endCallMessage: string | null;
  backgroundSound: string | null;
  autoReplyEnabled: boolean;
  autoReplyMessage: string | null;
  aiModel: string | null;
  aiMaxTokens: number | null;
  aiTemperature: number | null;
  customInstructions: string | null;
  lastLatencyMs: number | null;
  latencyStatus: 'optimal' | 'amber' | 'warn' | null;
  lastLatencyCheckedAt: string | null;
}

interface AnalyticsSummary {
  totalCalls: number;
  avgDuration: number;
  outcomeBreakdown: Record<string, number>;
  avgMeasuredLatencyMs?: number | null;
  latencySampleSize?: number;
  estimatedLatencyMs?: number | null;
  estimatedLatencyStatus?: 'optimal' | 'amber' | 'warn' | null;
  latencyMismatch?: boolean;
}

function formatPhoneDisplay(phone: string): string {
  if (phone.startsWith('+61')) {
    const local = phone.replace('+61', '0');
    return local.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
  }
  return phone;
}

const VOICE_OPTIONS: { id: string; name: string; accent: string }[] = [
  { id: 'Jess', name: 'Jess', accent: 'Australian Female' },
  { id: 'Harry', name: 'Harry', accent: 'Australian Male' },
  { id: 'Chris', name: 'Chris', accent: 'Australian Male' },
];

const AI_MODEL_OPTIONS: { id: string; name: string; description: string }[] = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast responses, great for most calls' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fastest responses, basic conversations' },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Smarter responses, slightly slower' },
  { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Most capable, higher latency' },
];

const MODE_OPTIONS: { id: string; label: string; icon: FeatherIconName; description: string }[] = [
  { id: 'off', label: 'Off', icon: 'phone-off', description: 'AI Receptionist is disabled' },
  { id: 'after_hours', label: 'After Hours Only', icon: 'moon', description: 'Only active outside business hours' },
  { id: 'always_on_transfer', label: 'Always On + Transfer', icon: 'phone-forwarded', description: 'Answer all calls, transfer to your team when available' },
  { id: 'always_on_message', label: 'Always On + Message', icon: 'message-square', description: 'Answer all calls, take a message for you' },
  { id: 'selective', label: 'Selective', icon: 'filter', description: 'AI answers when you choose not to pick up' },
];

const createStyles = (colors: any, bottomNavHeight: number = 0) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  contentContainer: { paddingHorizontal: pageShell.paddingHorizontal, paddingTop: pageShell.paddingTop, paddingBottom: bottomNavHeight },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg, gap: spacing.md },
  pageTitle: { ...typography.largeTitle, color: colors.foreground, flex: 1 },
  card: { backgroundColor: colors.card, borderRadius: radius['2xl'], padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.cardBorder, ...shadows.sm },
  cardTitle: { ...typography.body, fontWeight: fontWeights.bold, color: colors.foreground, marginBottom: spacing.xs },
  cardSubtitle: { ...typography.caption, color: colors.mutedForeground, marginBottom: spacing.md },
  enableRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  enableLabel: { ...typography.body, fontWeight: fontWeights.bold, color: colors.foreground },
  enableSublabel: { ...typography.caption, fontWeight: fontWeights.regular, color: colors.mutedForeground, marginTop: 2 },
  sectionTitle: { ...typography.label, color: colors.mutedForeground, marginTop: spacing.lg, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 1 },
  modeOption: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.xl, marginBottom: spacing.sm, borderWidth: 1, gap: spacing.md },
  modeIconContainer: { width: 40, height: 40, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  modeLabel: { ...typography.body, fontWeight: fontWeights.semibold, color: colors.foreground },
  modeDescription: { ...typography.caption, color: colors.mutedForeground, marginTop: 2 },
  voiceOption: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.xl, marginBottom: spacing.sm, borderWidth: 1, gap: spacing.md },
  voiceName: { ...typography.body, fontWeight: fontWeights.semibold, color: colors.foreground },
  voiceAccent: { ...typography.caption, color: colors.mutedForeground },
  textArea: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.lg, padding: spacing.md, color: colors.foreground, ...typography.body, minHeight: 80, textAlignVertical: 'top' },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.lg, padding: spacing.md, color: colors.foreground, ...typography.body },
  inputLabel: { ...typography.caption, color: colors.mutedForeground, marginBottom: spacing.xs },
  phoneRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  phoneInput: { flex: 1, color: colors.foreground, ...typography.body },
  phoneLabel: { ...typography.caption, color: colors.mutedForeground, width: 60 },
  daysRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  dayButton: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, borderRadius: radius.lg, borderWidth: 1 },
  dayText: { ...typography.caption, fontWeight: fontWeights.semibold },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.lg, gap: spacing.xs, alignSelf: 'flex-start' },
  statusText: { ...typography.caption, fontWeight: fontWeights.semibold },
  phoneNumber: { ...typography.body, fontWeight: fontWeights.bold, color: colors.primary, fontSize: typography.sizes.lg },
  saveButton: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  saveButtonText: { ...typography.body, fontWeight: fontWeights.bold, color: colors.primaryForeground },
  transferRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  transferName: { ...typography.body, fontWeight: fontWeights.semibold, color: colors.foreground, flex: 1 },
  transferPhone: { ...typography.caption, color: colors.mutedForeground },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', gap: spacing.sm },
  addButtonText: { ...typography.body, fontWeight: fontWeights.semibold },
});

const SHARED_PLATFORM_NUMBER = '0485 013 993';

interface MultiNumberConfig {
  id: string;
  dedicatedPhoneNumber: string | null;
  label: string | null;
  enabled: boolean;
  approvalStatus: string | null;
}

export default function AIReceptionistScreen() {
  const confirm = useConfirmDialog();
  const showActionSheet = useActionSheet();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const { user, businessSettings, fetchBusinessSettings } = useAuthStore();
  // Owners, managers, and any role granted the "Manage AI Receptionist"
  // permission can set up the AI Receptionist. Workers and joined-business
  // subcontractors get a read-only "managed by owner" screen.
  const { isOwner, isManager, hasPermission, isLoading: roleLoading } = useUserRole();
  const canManageReceptionist = isOwner || isManager || hasPermission('manage_ai_receptionist');
  const { configId: urlConfigId } = useLocalSearchParams<{ configId?: string }>();
  const hasDedicatedNumber = !!businessSettings?.dedicatedPhoneNumber;
  const userTier = user?.subscriptionTier || 'free';
  const isFreePlan = userTier === 'free' && !user?.betaLifetimeAccess && !user?.isBeta;
  const [allConfigs, setAllConfigs] = useState<MultiNumberConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(urlConfigId || null);
  const [config, setConfig] = useState<ReceptionistConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState('off');
  const [voice, setVoice] = useState('Jess');
  const [greeting, setGreeting] = useState('');
  const defaultSchedule: DaySchedule[] = [
    { day: 1, enabled: true, start: '08:00', end: '17:00' },
    { day: 2, enabled: true, start: '08:00', end: '17:00' },
    { day: 3, enabled: true, start: '08:00', end: '17:00' },
    { day: 4, enabled: true, start: '08:00', end: '17:00' },
    { day: 5, enabled: true, start: '08:00', end: '17:00' },
    { day: 6, enabled: false, start: '08:00', end: '12:00' },
    { day: 0, enabled: false, start: '08:00', end: '12:00' },
  ];
  const [schedule, setSchedule] = useState<DaySchedule[]>(defaultSchedule);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [timezone, setTimezone] = useState('Australia/Sydney');
  const [transferNumbers, setTransferNumbers] = useState<TransferNumber[]>([]);
  const [showHolidayPresets, setShowHolidayPresets] = useState(false);
  const [holidayPresets, setHolidayPresets] = useState<Holiday[]>([]);
  const [showCustomHoliday, setShowCustomHoliday] = useState(false);
  const [customHolidayDate, setCustomHolidayDate] = useState('');
  const [customHolidayLabel, setCustomHolidayLabel] = useState('');
  const [knowledgeBank, setKnowledgeBank] = useState<KnowledgeBankContent>({});
  const [voiceRequests, setVoiceRequests] = useState<VoiceChangeRequest[]>([]);
  const [voiceRequestText, setVoiceRequestText] = useState('');
  const [isSavingKB, setIsSavingKB] = useState(false);
  const [isSubmittingVR, setIsSubmittingVR] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisioningStatus, setProvisioningStatus] = useState<string | null>(null);
  const [provisioningError, setProvisioningError] = useState<string | null>(null);
  const [recentCalls, setRecentCalls] = useState<CallLog[]>([]);
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [userChangedEnabled, setUserChangedEnabled] = useState(false);
  const [voiceStability, setVoiceStability] = useState(0.5);
  const [voiceClarity, setVoiceClarity] = useState(0.75);
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voicemailDetectionEnabled, setVoicemailDetectionEnabled] = useState(false);
  const [silenceTimeoutSeconds, setSilenceTimeoutSeconds] = useState(30);
  const [maxCallDurationSeconds, setMaxCallDurationSeconds] = useState(300);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [isTestingCall, setIsTestingCall] = useState(false);
  const [isMeasuringLatency, setIsMeasuringLatency] = useState(false);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [autoReplyMessage, setAutoReplyMessage] = useState("Thanks for calling {{business_name}}. We got your message and will get back to you shortly. — Sent via JobRunner");
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [aiMaxTokens, setAiMaxTokens] = useState(250);
  const [aiTemperature, setAiTemperature] = useState(0.5);
  const [customInstructions, setCustomInstructions] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [sentimentSort, setSentimentSort] = useState(false);
  const [playingCallId, setPlayingCallId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  const stopAudio = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
    setPlayingCallId(null);
    setAudioProgress(0);
    setAudioDuration(0);
  }, []);

  const playRecording = useCallback(async (callId: string, url: string) => {
    if (playingCallId === callId) {
      await stopAudio();
      return;
    }
    await stopAudio();
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setAudioProgress(status.positionMillis || 0);
            setAudioDuration(status.durationMillis || 0);
            if (status.didJustFinish) {
              stopAudio();
            }
          }
        }
      );
      soundRef.current = sound;
      setPlayingCallId(callId);
    } catch (e: any) {
      Alert.alert('Playback Error', 'Could not play recording. The file may be unavailable.');
    }
  }, [playingCallId, stopAudio]);

  useEffect(() => {
    return () => { stopAudio(); };
  }, [stopAudio]);

  const filteredCalls = useMemo(() => {
    let calls = Array.isArray(recentCalls) ? [...recentCalls] : [];
    if (sentimentFilter !== 'all') {
      calls = calls.filter(c => c.sentiment === sentimentFilter);
    }
    if (sentimentSort) {
      const order: Record<string, number> = { negative: 0, neutral: 1, positive: 2 };
      calls.sort((a, b) => (order[a.sentiment || 'neutral'] ?? 1) - (order[b.sentiment || 'neutral'] ?? 1));
    }
    return calls;
  }, [recentCalls, sentimentFilter, sentimentSort]);

  const pollProvisioningStatus = useCallback(async (maxAttempts = 15) => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const statusRes = await api.get<{ status: string; phoneNumber?: string; error?: string }>('/api/ai-receptionist/provisioning-status');
        const data = statusRes.data;
        if (data?.status === 'active' || data?.status === 'approved') {
          setProvisioningStatus('complete');
          await fetchConfig();
          setIsProvisioning(false);
          return;
        }
        if (data?.status === 'failed' || data?.error) {
          setProvisioningError(data?.error || 'Provisioning failed. Please try again.');
          setIsProvisioning(false);
          return;
        }
        setProvisioningStatus(i < 5 ? 'Setting up your number...' : 'Almost there...');
      } catch {
        // continue polling
      }
    }
    await fetchConfig();
    setIsProvisioning(false);
    setProvisioningStatus(null);
  }, []);

  const handleProvisionNumber = async () => {
    const numberDisplay = formatPhoneDisplay(businessSettings?.dedicatedPhoneNumber || '');
    confirm({
      title: 'Activate AI Receptionist',
      message: `This will set up your AI assistant on ${numberDisplay || 'your dedicated number'}. It will answer calls, take messages, and book appointments. Continue?`,
      confirmText: 'Activate',
    }).then(async (ok) => {
      if (!ok) return;
      setIsProvisioning(true);
      setProvisioningStatus('Saving your preferences...');
      setProvisioningError(null);
      try {
        const enabledDaysP = schedule.filter(s => s.enabled).map(s => s.day);
        const firstEnabledP = schedule.find(s => s.enabled);
        await api.patch('/api/ai-receptionist/config', {
          mode: mode || 'after_hours',
          voice,
          greeting: greeting || null,
          transferNumbers,
          businessHours: {
            start: firstEnabledP?.start || '08:00',
            end: firstEnabledP?.end || '17:00',
            timezone,
            days: enabledDaysP,
            schedule,
            holidays,
          },
        });
        setProvisioningStatus('Setting up your AI assistant...');
        // iOS: AI Receptionist is sold as an Apple In-App Purchase. Apple policy means iOS
        // must NEVER open the Stripe checkout for add-ons, so handle the whole iOS path here
        // and return regardless of outcome.
        if (Platform.OS === 'ios') {
          setIsProvisioning(false);
          setProvisioningStatus(null);
          if (!isIAPAvailable()) {
            Alert.alert('Purchase Unavailable', 'In-app purchases are not available on this device right now. Please try again later.');
            return;
          }
          if (!businessSettings?.dedicatedPhoneNumber) {
            confirm({
              title: 'Dedicated Number Required',
              message: 'You need a dedicated phone number before setting up AI Receptionist.',
              confirmText: 'Get a Number',
            }).then((okN) => { if (okN) router.push(asHref('/more/phone-numbers')); });
            return;
          }
          // The global IAP listener verifies the receipt + provisions the assistant.
          setIsProvisioning(true);
          setProvisioningStatus('Configuring AI voice and responses...');
          await purchaseSubscription(IAP_ADDON_PRODUCT_IDS.aiReceptionist);
          pollProvisioningStatus();
          return;
        }
        const checkoutRes = await api.post<{ success?: boolean; provisioning?: boolean; url?: string }>('/api/subscription/ai-receptionist-checkout');
        if (checkoutRes.data?.url) {
          setIsProvisioning(false);
          setProvisioningStatus(null);
          confirm({
            title: 'Complete Setup',
            message: 'You\'ll be taken to checkout to complete your AI Receptionist setup.',
            confirmText: 'Continue',
          }).then((ok2) => {
            if (ok2) Linking.openURL(checkoutRes.data!.url!);
          });
          return;
        }
        setProvisioningStatus('Configuring AI voice and responses...');
        pollProvisioningStatus();
      } catch (e: any) {
        setIsProvisioning(false);
        setProvisioningStatus(null);
        // User dismissed the Apple sheet (or the purchase was superseded) — reset quietly.
        if (e?.code === 'E_USER_CANCELLED' || e?.code === 'E_PURCHASE_SUPERSEDED') {
          return;
        }
        const errorData = e?.response?.data || e;
        if (errorData?.needsDedicatedNumber) {
          confirm({
            title: 'Dedicated Number Required',
            message: 'You need a dedicated phone number before setting up AI Receptionist.',
            confirmText: 'Get a Number',
          }).then((ok3) => { if (ok3) router.push(asHref('/more/phone-numbers')); });
        } else if (errorData?.upgradeRequired) {
          confirm({
            title: 'Plan Upgrade Required',
            message: 'AI Receptionist requires a Pro plan or higher. Please upgrade your subscription first.',
            confirmText: 'Upgrade',
          }).then((ok4) => { if (ok4) router.push('/more/settings'); });
        } else {
          Alert.alert('Error', errorData?.error || e?.message || 'Could not set up AI Receptionist. Please try again.');
        }
      }
    });
  };

  const fetchAllConfigs = useCallback(async () => {
    try {
      const response = await api.get<MultiNumberConfig[]>('/api/ai-receptionist/configs');
      if (response.data && Array.isArray(response.data)) {
        setAllConfigs(response.data);
        if (!selectedConfigId && response.data.length > 0) {
          setSelectedConfigId(response.data[0].id);
        }
      }
    } catch (e) {}
  }, [selectedConfigId]);

  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const endpoint = selectedConfigId
        ? `/api/ai-receptionist/configs/${selectedConfigId}`
        : '/api/ai-receptionist/config';
      const response = await api.get<any>(endpoint);
      const data = response.data;
      if (data) {
        const mappedConfig: ReceptionistConfig = selectedConfigId ? {
          enabled: data.enabled,
          mode: data.mode || 'off',
          voice: data.voiceName || 'Jess',
          greeting: data.greeting || null,
          transferNumbers: data.transferNumbers || [],
          businessHours: data.businessHours || null,
          dedicatedPhoneNumber: data.dedicatedPhoneNumber || null,
          vapiAssistantId: data.vapiAssistantId || null,
          approvalStatus: data.approvalStatus || null,
          knowledgeBank: data.knowledgeBank || null,
          voiceStability: data.voiceStability ?? null,
          voiceClarity: data.voiceClarity ?? null,
          voiceSpeed: data.voiceSpeed ?? null,
          voiceStyleExaggeration: data.voiceStyleExaggeration ?? null,
          voiceSpeakerBoost: data.voiceSpeakerBoost ?? null,
          voicemailDetectionEnabled: data.voicemailDetectionEnabled ?? null,
          voicemailMessage: data.voicemailMessage || null,
          silenceTimeoutSeconds: data.silenceTimeoutSeconds ?? null,
          maxCallDurationSeconds: data.maxCallDurationSeconds ?? null,
          endCallMessage: data.endCallMessage || null,
          backgroundSound: data.backgroundSound || null,
          autoReplyEnabled: data.autoReplyEnabled ?? true,
          autoReplyMessage: data.autoReplyMessage || null,
          aiModel: data.aiModel || 'gpt-4o-mini',
          aiMaxTokens: data.aiMaxTokens ?? 250,
          aiTemperature: data.aiTemperature ?? 0.5,
          customInstructions: data.customInstructions || null,
          lastLatencyMs: data.lastLatencyMs ?? null,
          latencyStatus: data.latencyStatus ?? null,
          lastLatencyCheckedAt: data.lastLatencyCheckedAt ?? null,
        } : data;
        setConfig(mappedConfig);
        setEnabled(mappedConfig.enabled);
        setMode(mappedConfig.mode || 'off');
        setVoice(mappedConfig.voice || 'Jess');
        setGreeting(mappedConfig.greeting || '');
        setTransferNumbers(mappedConfig.transferNumbers || []);
        if (mappedConfig.businessHours?.schedule && mappedConfig.businessHours.schedule.length > 0) {
          setSchedule(mappedConfig.businessHours.schedule);
        } else if (mappedConfig.businessHours?.days) {
          setSchedule(prev => prev.map(s => ({
            ...s,
            enabled: mappedConfig.businessHours!.days.includes(s.day),
            start: mappedConfig.businessHours!.start || s.start,
            end: mappedConfig.businessHours!.end || s.end,
          })));
        }
        if (mappedConfig.businessHours?.holidays) setHolidays(mappedConfig.businessHours.holidays);
        if (mappedConfig.businessHours?.timezone) setTimezone(mappedConfig.businessHours.timezone);
        if (mappedConfig.knowledgeBank) setKnowledgeBank(mappedConfig.knowledgeBank);
        if (mappedConfig.voiceStability != null) setVoiceStability(mappedConfig.voiceStability);
        if (mappedConfig.voiceClarity != null) setVoiceClarity(mappedConfig.voiceClarity);
        if (mappedConfig.voiceSpeed != null) setVoiceSpeed(mappedConfig.voiceSpeed);
        if (mappedConfig.voicemailDetectionEnabled != null) setVoicemailDetectionEnabled(mappedConfig.voicemailDetectionEnabled);
        if (mappedConfig.silenceTimeoutSeconds != null) setSilenceTimeoutSeconds(mappedConfig.silenceTimeoutSeconds);
        if (mappedConfig.maxCallDurationSeconds != null) setMaxCallDurationSeconds(mappedConfig.maxCallDurationSeconds);
        setAutoReplyEnabled(mappedConfig.autoReplyEnabled ?? true);
        if (mappedConfig.autoReplyMessage) setAutoReplyMessage(mappedConfig.autoReplyMessage);
        if (mappedConfig.aiModel) setAiModel(mappedConfig.aiModel);
        if (mappedConfig.aiMaxTokens != null) setAiMaxTokens(mappedConfig.aiMaxTokens);
        if (mappedConfig.aiTemperature != null) setAiTemperature(mappedConfig.aiTemperature);
        setCustomInstructions(mappedConfig.customInstructions || '');
        setConfigLoaded(true);
        setUserChangedEnabled(false);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load AI Receptionist settings. Pull down to retry.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedConfigId]);

  const fetchVoiceRequests = useCallback(async () => {
    try {
      const response = await api.get<VoiceChangeRequest[]>('/api/ai-receptionist/voice-requests');
      setVoiceRequests(response.data || []);
    } catch (e) {
    }
  }, []);

  const fetchRecentCalls = useCallback(async () => {
    try {
      const phoneFilter = selectedConfigId ? `&phoneNumberId=${selectedConfigId}` : '';
      const response = await api.get<CallLog[]>(`/api/ai-receptionist/calls?limit=10${phoneFilter}`);
      setRecentCalls(Array.isArray(response.data) ? response.data : []);
    } catch (e) {
    }
  }, [selectedConfigId]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const phoneFilter = selectedConfigId ? `?phoneNumberId=${selectedConfigId}` : '';
      const response = await api.get<AnalyticsSummary>(`/api/ai-receptionist/analytics${phoneFilter}`);
      if (response.data) setAnalytics(response.data);
    } catch (e) {
    }
  }, [selectedConfigId]);

  const handleMeasureLatency = async () => {
    setIsMeasuringLatency(true);
    try {
      const res = await api.post<{ lastLatencyMs: number; latencyStatus: 'optimal' | 'amber' | 'warn'; lastLatencyCheckedAt: string }>('/api/ai-receptionist/measure-latency');
      const data = res.data;
      if (data && typeof data.lastLatencyMs === 'number' && Number.isFinite(data.lastLatencyMs)) {
        const ms = data.lastLatencyMs;
        const status: 'optimal' | 'amber' | 'warn' =
          data.latencyStatus || (ms < 1000 ? 'optimal' : ms < 1200 ? 'amber' : 'warn');
        setConfig(prev => prev ? { ...prev, lastLatencyMs: ms, latencyStatus: status, lastLatencyCheckedAt: data.lastLatencyCheckedAt } : prev);
        const label = status === 'optimal'
          ? 'Excellent — under 1000ms target'
          : status === 'amber'
            ? 'Acceptable — between 1000ms and 1200ms'
            : 'Slow — exceeds 1200ms ceiling';
        Alert.alert(`Estimated response time: ${ms}ms`, label);
      } else {
        Alert.alert('Test failed', res.error || 'Could not measure latency. Please try again in a moment.');
      }
    } catch (e: any) {
      Alert.alert('Test failed', e?.message || 'Could not measure latency');
    } finally {
      setIsMeasuringLatency(false);
    }
  };

  const handleTestCall = async () => {
    const phone = (businessSettings as any)?.businessPhone || (businessSettings as any)?.phone || (user as any)?.phone;
    if (!phone) {
      Alert.alert('No Phone Number', 'Please set a business phone number in your settings first.');
      return;
    }
    confirm({
      title: 'Test Call',
      message: `This will place a test call to ${phone}. Your AI receptionist will call you so you can hear how it sounds.`,
      confirmText: 'Call Me',
    }).then(async (ok) => {
      if (!ok) return;
      setIsTestingCall(true);
      try {
        await api.post('/api/ai-receptionist/test-call', { phoneNumber: phone });
        Alert.alert('Test Call Started', 'You should receive a call shortly from your AI receptionist.');
      } catch (e: any) {
        Alert.alert('Error', e?.response?.data?.error || 'Could not initiate test call.');
      } finally {
        setIsTestingCall(false);
      }
    });
  };

  const fetchHolidayPresets = useCallback(async () => {
    try {
      const response = await api.get<Holiday[]>('/api/ai-receptionist/holiday-presets');
      setHolidayPresets(response.data || []);
    } catch {
    }
  }, []);

  useEffect(() => { fetchAllConfigs(); }, []);
  useEffect(() => { fetchConfig(); fetchRecentCalls(); fetchAnalytics(); }, [selectedConfigId, fetchConfig, fetchRecentCalls, fetchAnalytics]);
  useEffect(() => { fetchVoiceRequests(); fetchHolidayPresets(); }, [fetchVoiceRequests, fetchHolidayPresets]);

  const handleSave = async () => {
    if (!configLoaded) {
      Alert.alert('Not Ready', 'Settings are still loading. Please wait and try again.');
      return;
    }
    setIsSaving(true);
    try {
      const enabledDays = schedule.filter(s => s.enabled).map(s => s.day);
      const firstEnabled = schedule.find(s => s.enabled);
      const configEndpoint = selectedConfigId
        ? `/api/ai-receptionist/configs/${selectedConfigId}`
        : '/api/ai-receptionist/config';
      await api.patch(configEndpoint, {
        mode,
        voice,
        greeting: greeting || null,
        transferNumbers,
        businessHours: {
          start: firstEnabled?.start || '08:00',
          end: firstEnabled?.end || '17:00',
          timezone,
          days: enabledDays,
          schedule,
          holidays,
        },
        voiceStability,
        voiceClarity,
        voiceSpeed,
        voicemailDetectionEnabled,
        silenceTimeoutSeconds,
        maxCallDurationSeconds,
        autoReplyEnabled,
        autoReplyMessage,
        aiModel,
        aiMaxTokens,
        aiTemperature,
        customInstructions: customInstructions || null,
      });

      if (userChangedEnabled) {
        const wasEnabled = config?.enabled || false;
        if (enabled && !wasEnabled) {
          await api.post('/api/ai-receptionist/enable');
        } else if (!enabled && wasEnabled) {
          await api.post('/api/ai-receptionist/disable');
        }
      }

      await fetchConfig();
      Alert.alert('Saved', 'AI Receptionist settings updated.');
    } catch {
      Alert.alert('Error', 'Could not save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveKnowledgeBank = async () => {
    setIsSavingKB(true);
    try {
      const kbEndpoint = selectedConfigId
        ? `/api/ai-receptionist/configs/${selectedConfigId}`
        : '/api/ai-receptionist/config';
      await api.patch(kbEndpoint, { knowledgeBank });
      await fetchConfig();
      Alert.alert('Saved', 'Knowledge bank has been synced to the AI.');
    } catch {
      Alert.alert('Error', 'Could not save knowledge bank.');
    } finally {
      setIsSavingKB(false);
    }
  };

  const handleSubmitVoiceRequest = async () => {
    if (!voiceRequestText.trim() || voiceRequestText.length < 5) return;
    setIsSubmittingVR(true);
    try {
      await api.post('/api/ai-receptionist/voice-requests', { requestedDescription: voiceRequestText });
      Alert.alert('Submitted', "We'll review your request and get back to you.");
      setVoiceRequestText('');
      fetchVoiceRequests();
    } catch {
      Alert.alert('Error', 'Could not submit voice request.');
    } finally {
      setIsSubmittingVR(false);
    }
  };

  const addFaq = () => {
    setKnowledgeBank(prev => ({
      ...prev,
      faqs: [...(prev.faqs || []), { question: '', answer: '' }],
    }));
  };

  const removeFaq = (index: number) => {
    setKnowledgeBank(prev => ({
      ...prev,
      faqs: (prev.faqs || []).filter((_, i) => i !== index),
    }));
  };

  const updateFaq = (index: number, field: 'question' | 'answer', value: string) => {
    setKnowledgeBank(prev => ({
      ...prev,
      faqs: (prev.faqs || []).map((faq, i) => i === index ? { ...faq, [field]: value } : faq),
    }));
  };

  const toggleDayEnabled = (dayNum: number) => {
    setSchedule(prev => prev.map(s => s.day === dayNum ? { ...s, enabled: !s.enabled } : s));
  };

  const updateDayTime = (dayNum: number, field: 'start' | 'end' | 'breakStart' | 'breakEnd', value: string) => {
    setSchedule(prev => prev.map(s => s.day === dayNum ? { ...s, [field]: value } : s));
  };

  const toggleDayBreak = (dayNum: number) => {
    setSchedule(prev => prev.map(s => {
      if (s.day !== dayNum) return s;
      if (s.breakStart) {
        const { breakStart, breakEnd, ...rest } = s;
        return rest as DaySchedule;
      }
      return { ...s, breakStart: '12:00', breakEnd: '13:00' };
    }));
  };

  const addHoliday = (date: string, label: string) => {
    if (holidays.some(h => h.date === date)) return;
    setHolidays(prev => [...prev, { date, label }].sort((a, b) => a.date.localeCompare(b.date)));
  };

  const removeHoliday = (date: string) => {
    setHolidays(prev => prev.filter(h => h.date !== date));
  };

  const addTransferNumber = () => {
    Alert.prompt('Add Transfer Number', 'Enter a name for this contact (e.g. "Office" or "Jake")', (name: string) => {
      if (!name) return;
      Alert.prompt('Phone Number', 'Enter the phone number', (phone: string) => {
        if (!phone) return;
        setTransferNumbers(prev => [...prev, { name, phone, priority: prev.length + 1 }]);
      }, 'plain-text', '', 'phone-pad');
    });
  };

  const addTransferNumberFallback = () => {
    setTransferNumbers(prev => [...prev, { name: `Contact ${prev.length + 1}`, phone: '', priority: prev.length + 1 }]);
  };

  const removeTransferNumber = (index: number) => {
    setTransferNumbers(prev => prev.filter((_, i) => i !== index));
  };

  const updateTransferNumber = (index: number, field: 'name' | 'phone', value: string) => {
    setTransferNumbers(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  if (isLoading || roleLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!canManageReceptionist) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Feather name="lock" size={40} color={colors.mutedForeground} />
          <Text style={{ ...typography.body, fontWeight: fontWeights.bold, fontSize: typography.sizes.lg, color: colors.foreground, marginTop: spacing.lg, textAlign: 'center' }}>
            Managed by the business owner
          </Text>
          <Text style={{ ...typography.body, color: colors.mutedForeground, marginTop: spacing.sm, textAlign: 'center' }}>
            Only the business owner or a manager can set up the AI Receptionist. You don't have access to change these settings.
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={[styles.saveButton, { marginTop: spacing.xl, paddingHorizontal: spacing.xl }]}>
            <Text style={styles.saveButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => { fetchConfig(); fetchRecentCalls(); fetchAnalytics(); }} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <Text style={styles.pageTitle}>AI Receptionist</Text>
        </View>

        {Array.isArray(allConfigs) && allConfigs.length > 1 && (
          <View style={[styles.card, { marginBottom: spacing.md }]}>
            <Text style={[styles.cardTitle, { marginBottom: spacing.sm }]}>Select Number</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.xs }}>
              {allConfigs.map((cfg) => {
                const isSelected = selectedConfigId === cfg.id;
                return (
                  <TouchableOpacity
                    key={cfg.id}
                    onPress={() => setSelectedConfigId(cfg.id)}
                    activeOpacity={0.7}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderRadius: radius.lg,
                      marginHorizontal: spacing.xs,
                      backgroundColor: isSelected ? `${colors.primary}15` : `${colors.muted}50`,
                      borderWidth: isSelected ? 1 : StyleSheet.hairlineWidth,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: typography.sizes.sm, fontWeight: isSelected ? fontWeights.bold : fontWeights.medium, color: isSelected ? colors.primary : colors.foreground }}>
                      {cfg.label || (cfg.dedicatedPhoneNumber ? formatPhoneDisplay(cfg.dedicatedPhoneNumber) : 'Number')}
                    </Text>
                    <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: 2 }}>
                      {cfg.label && cfg.dedicatedPhoneNumber ? formatPhoneDisplay(cfg.dedicatedPhoneNumber) : (cfg.enabled ? 'Active' : 'Inactive')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {!config?.enabled && mode === 'off' && (
          <View style={{ backgroundColor: `${colors.primary}08`, borderRadius: radius['2xl'], padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: `${colors.primary}20` }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="phone" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.cardTitle, color: colors.foreground }}>Get started in 3 steps</Text>
                <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 2 }}>Set up your AI receptionist in under 2 minutes</Text>
              </View>
            </View>
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.bold, color: colors.primaryForeground }}>1</Text>
                </View>
                <Text style={{ ...typography.body, color: colors.foreground }}>Choose a mode (after hours, always on, etc.)</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.bold, color: colors.primaryForeground }}>2</Text>
                </View>
                <Text style={{ ...typography.body, color: colors.foreground }}>Pick a voice and customise your greeting</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.bold, color: colors.primaryForeground }}>3</Text>
                </View>
                <Text style={{ ...typography.body, color: colors.foreground }}>Enable and save — you're live</Text>
              </View>
            </View>
          </View>
        )}

        {isFreePlan ? (
          <View style={styles.card}>
            <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
                <Feather name="lock" size={28} color={colors.primary} />
              </View>
              <Text style={{ ...typography.cardTitle, color: colors.foreground, textAlign: 'center', marginBottom: spacing.xs }}>
                Pro Plan Required
              </Text>
              <Text style={{ ...typography.caption, color: colors.mutedForeground, textAlign: 'center', lineHeight: 18, marginBottom: spacing.xs }}>
                AI Receptionist is available on Pro, Team, and Business plans.
              </Text>
              <Text style={{ ...typography.caption, color: colors.mutedForeground, textAlign: 'center', lineHeight: 18, marginBottom: spacing.lg }}>
                Upgrade your plan to get a dedicated number and AI-powered call answering for your business. AI Receptionist is a managed service add-on — contact us after upgrading to get started.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
                onPress={() => router.push('/more/settings')}
                activeOpacity={0.7}
              >
                <Feather name="zap" size={16} color={colors.primaryForeground} />
                <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.bold, color: colors.primaryForeground }}>Upgrade Plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : !hasDedicatedNumber && !config?.dedicatedPhoneNumber ? (
          <View style={styles.card}>
            <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${colors.warning}15`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
                <Feather name="phone-off" size={28} color={colors.warning} />
              </View>
              <Text style={{ ...typography.cardTitle, color: colors.foreground, textAlign: 'center', marginBottom: spacing.xs }}>
                Dedicated Number Required
              </Text>
              <Text style={{ ...typography.caption, color: colors.mutedForeground, textAlign: 'center', lineHeight: 18, marginBottom: spacing.xs }}>
                You're currently using the shared JobRunner number ({SHARED_PLATFORM_NUMBER}).
              </Text>
              <Text style={{ ...typography.caption, color: colors.mutedForeground, textAlign: 'center', lineHeight: 18, marginBottom: spacing.lg }}>
                To set up an AI Receptionist, you need your own dedicated phone number first. Your AI will answer calls and take messages on that number.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
                onPress={() => router.push(asHref('/more/phone-numbers'))}
                activeOpacity={0.7}
              >
                <Feather name="phone" size={16} color={colors.primaryForeground} />
                <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.bold, color: colors.primaryForeground }}>Get a Dedicated Number</Text>
              </TouchableOpacity>
              <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.sm }}>
                Includes SMS and AI calls
              </Text>
            </View>
          </View>
        ) : config?.dedicatedPhoneNumber || hasDedicatedNumber ? (
          <View style={styles.card}>
            {isProvisioning ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
                  <Feather name="loader" size={28} color={colors.primary} />
                </View>
                <Text style={{ ...typography.cardTitle, color: colors.foreground, textAlign: 'center', marginBottom: spacing.xs }}>
                  Setting Up AI Receptionist
                </Text>
                <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: spacing.sm }} />
                <Text style={{ ...typography.caption, color: colors.primary, textAlign: 'center', fontWeight: fontWeights.medium, marginBottom: spacing.xs }}>
                  {provisioningStatus || 'Please wait...'}
                </Text>
                <Text style={{ ...typography.caption, color: colors.mutedForeground, textAlign: 'center', lineHeight: 18 }}>
                  This usually takes 10-30 seconds. Please don't close this screen.
                </Text>
              </View>
            ) : provisioningError ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${colors.destructive}15`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
                  <Feather name="alert-circle" size={28} color={colors.destructive} />
                </View>
                <Text style={{ ...typography.cardTitle, color: colors.foreground, textAlign: 'center', marginBottom: spacing.xs }}>
                  Setup Issue
                </Text>
                <Text style={{ ...typography.caption, color: colors.destructive || '#ef4444', textAlign: 'center', lineHeight: 18, marginBottom: spacing.md }}>
                  {provisioningError}
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
                  onPress={handleProvisionNumber}
                  activeOpacity={0.7}
                >
                  <Feather name="refresh-cw" size={16} color={colors.primaryForeground} />
                  <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.primaryForeground }}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : !config?.vapiAssistantId ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
                  <Feather name="cpu" size={28} color={colors.primary} />
                </View>
                <Text style={{ ...typography.cardTitle, color: colors.foreground, textAlign: 'center', marginBottom: spacing.xs }}>
                  Ready to Set Up AI Receptionist
                </Text>
                <View style={{ padding: spacing.md, backgroundColor: `${colors.success}10`, borderRadius: radius.lg, marginBottom: spacing.md, width: '100%' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Feather name="check-circle" size={16} color={colors.success} />
                    <Text style={{ ...typography.body, color: colors.foreground, fontWeight: fontWeights.semibold }}>
                      Number: {formatPhoneDisplay(businessSettings?.dedicatedPhoneNumber || config?.dedicatedPhoneNumber || '')}
                    </Text>
                  </View>
                </View>
                <Text style={{ ...typography.caption, color: colors.mutedForeground, textAlign: 'center', lineHeight: 18, marginBottom: spacing.md }}>
                  Your AI assistant will answer calls, take messages, and book appointments on your dedicated number. Configure your preferences below, then activate.
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
                  onPress={handleProvisionNumber}
                  activeOpacity={0.7}
                >
                  <Feather name="zap" size={16} color={colors.primaryForeground} />
                  <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.bold, color: colors.primaryForeground }}>Activate AI Receptionist</Text>
                </TouchableOpacity>
                <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.sm }}>
                  Business add-on
                </Text>
              </View>
            ) : (
              <>
                {config?.approvalStatus === 'pending_approval' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f59e0b15', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm }}>
                    <Feather name="clock" size={18} color="#f59e0b" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.body, fontWeight: fontWeights.semibold, color: colors.foreground }}>Pending Review</Text>
                      <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 2, lineHeight: 16 }}>
                        Your AI Receptionist is being reviewed by our team. You'll be notified once it's approved and ready to go.
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.enableRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.enableLabel}>AI Receptionist</Text>
                    <Text style={styles.enableSublabel}>Answer calls, book jobs, and take messages automatically</Text>
                  </View>
                  <Switch
                    value={enabled}
                    disabled={config?.approvalStatus === 'pending_approval'}
                    onValueChange={(val) => {
                      if (config?.approvalStatus === 'pending_approval') {
                        Alert.alert(
                          'Pending Review',
                          'Your AI Receptionist is still being reviewed. You can enable it once approved.'
                        );
                        return;
                      }
                      if (!val && config?.enabled) {
                        confirm({
                          title: 'Disable AI Receptionist?',
                          message: 'This will stop the AI from answering calls on your dedicated number. You can re-enable it anytime.',
                          confirmText: 'Disable',
                          destructive: true,
                        }).then((ok) => {
                          if (ok) {
                            setEnabled(false);
                            setUserChangedEnabled(true);
                          }
                        });
                      } else {
                        setEnabled(val);
                        setUserChangedEnabled(true);
                      }
                    }}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={'#FFFFFF'}
                    ios_backgroundColor={colors.border}
                  />
                </View>

                <View style={{ marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.primary + '10', borderRadius: radius.lg }}>
                  <Text style={{ ...typography.caption, color: colors.mutedForeground, marginBottom: 4 }}>Your AI answers on</Text>
                  <Text style={styles.phoneNumber}>{formatPhoneDisplay(config?.dedicatedPhoneNumber || businessSettings?.dedicatedPhoneNumber || '')}</Text>
                  <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 4, lineHeight: 16 }}>
                    This number handles AI calls and SMS via Chat Hub.
                  </Text>
                </View>

                {(() => {
                  const approvalStatus = config?.approvalStatus;
                  const hasVapi = !!config?.vapiAssistantId;
                  const isConfigured = hasVapi && (config?.mode || 'off') !== 'off';

                  let statusLabel = 'Not Set Up';
                  let statusColor = colors.mutedForeground;
                  let statusBg = colors.muted;
                  let statusIcon: 'minus-circle' | 'clock' | 'check-circle' | 'pause-circle' = 'minus-circle';

                  if (approvalStatus === 'pending_approval') {
                    statusLabel = 'Pending Approval';
                    statusColor = '#f59e0b';
                    statusBg = '#f59e0b20';
                    statusIcon = 'clock';
                  } else if (enabled && isConfigured) {
                    statusLabel = 'Active';
                    statusColor = colors.success;
                    statusBg = colors.success + '20';
                    statusIcon = 'check-circle';
                  } else if (!enabled && isConfigured) {
                    statusLabel = 'Paused';
                    statusColor = '#f59e0b';
                    statusBg = '#f59e0b20';
                    statusIcon = 'pause-circle';
                  } else {
                    statusLabel = 'Not Set Up';
                    statusColor = colors.mutedForeground;
                    statusBg = colors.muted;
                    statusIcon = 'minus-circle';
                  }

                  return (
                    <View style={[styles.statusBadge, { backgroundColor: statusBg, marginTop: spacing.md }]}>
                      <Feather name={statusIcon} size={14} color={statusColor} />
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {statusLabel}
                      </Text>
                    </View>
                  );
                })()}
              </>
            )}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Mode</Text>
        {MODE_OPTIONS.map(opt => (
          <PressableRow
            key={opt.id}
            style={[styles.modeOption, { borderColor: mode === opt.id ? colors.primary : colors.cardBorder, backgroundColor: mode === opt.id ? colors.primary + '08' : colors.card }]}
            onPress={() => setMode(opt.id)}

          >
            <View style={[styles.modeIconContainer, { backgroundColor: mode === opt.id ? colors.primary + '20' : colors.muted }]}>
              <Feather name={opt.icon} size={20} color={mode === opt.id ? colors.primary : colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modeLabel}>{opt.label}</Text>
              <Text style={styles.modeDescription}>{opt.description}</Text>
            </View>
            {mode === opt.id && <Feather name="check" size={20} color={colors.primary} />}
          </PressableRow>
        ))}


        <Text style={styles.sectionTitle}>Performance</Text>
        <View style={styles.card}>
          {(() => {
            const serverLatency = config?.lastLatencyMs ?? null;
            const serverStatus = config?.latencyStatus ?? null;
            const hasServerValue = typeof serverLatency === 'number' && serverLatency > 0;
            const status: 'optimal' | 'amber' | 'warn' = serverStatus
              ?? (hasServerValue
                ? (serverLatency! < 1000 ? 'optimal' : serverLatency! < 1200 ? 'amber' : 'warn')
                : 'amber');
            const latencyColor = status === 'optimal' ? colors.success : status === 'amber' ? '#f59e0b' : '#ef4444';
            const latencyLabel = status === 'optimal' ? 'Fast' : status === 'amber' ? 'Acceptable' : 'Slow';
            const displayLatency = hasServerValue ? serverLatency : null;
            const checkedAt = config?.lastLatencyCheckedAt;
            return (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                  <Feather name="zap" size={18} color={latencyColor} />
                  <Text style={styles.cardTitle}>Response Latency</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
                      <Text style={{ fontSize: typography.sizes['3xl'], fontWeight: fontWeights.extrabold, color: hasServerValue ? latencyColor : colors.mutedForeground }}>
                        {displayLatency !== null ? `~${displayLatency}` : '—'}
                      </Text>
                      <Text style={{ ...typography.caption, color: hasServerValue ? latencyColor : colors.mutedForeground, fontWeight: fontWeights.semibold }}>ms</Text>
                    </View>
                    <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 2 }}>
                      {hasServerValue
                        ? `Measured estimate${checkedAt ? ` · updated ${new Date(checkedAt).toLocaleString()}` : ''}`
                        : 'Tap "Test response time" to measure'}
                    </Text>
                  </View>
                  {hasServerValue && (
                    <View style={{ backgroundColor: latencyColor + '18', borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
                      <Text style={{ ...typography.caption, fontWeight: fontWeights.bold, color: latencyColor }}>{latencyLabel}</Text>
                    </View>
                  )}
                </View>
                {hasServerValue && (
                  <View style={{ height: 6, backgroundColor: colors.cardBorder, borderRadius: 3, overflow: 'hidden', marginBottom: spacing.md }}>
                    <View style={{ width: `${Math.min(100, ((displayLatency || 0) / 2000) * 100)}%`, height: '100%', backgroundColor: latencyColor, borderRadius: 3 }} />
                  </View>
                )}
                {hasServerValue && (
                  <View style={{ backgroundColor: latencyColor + '10', borderRadius: radius.lg, padding: spacing.sm }}>
                    <Text style={{ ...typography.caption, color: latencyColor, lineHeight: 16 }}>
                      {status === 'optimal'
                        ? "Great! Your AI responds quickly enough for natural conversation. Callers won't notice much delay."
                        : status === 'amber'
                          ? 'Response time is slightly above the 1000ms target. Consider trimming your greeting or knowledge bank.'
                          : 'Response time exceeds the 1200ms ceiling. Try a faster model (GPT-4o Mini), shorter greeting, or smaller knowledge bank.'}
                    </Text>
                  </View>
                )}
                {(() => {
                  const measured = analytics?.avgMeasuredLatencyMs ?? null;
                  const sampleSize = analytics?.latencySampleSize ?? 0;
                  if (measured === null || sampleSize === 0) return null;
                  const measuredColor = measured < 1000 ? colors.success : measured < 1500 ? '#f59e0b' : '#ef4444';
                  return (
                    <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.cardBorder }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs, gap: spacing.sm }}>
                        <Text style={{ ...typography.caption, color: colors.mutedForeground, fontWeight: fontWeights.semibold }}>
                          Real average (last {sampleSize} {sampleSize === 1 ? 'call' : 'calls'})
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                          <Text style={{ ...typography.body, fontWeight: fontWeights.extrabold, color: measuredColor }}>{measured}</Text>
                          <Text style={{ ...typography.caption, color: measuredColor, fontWeight: fontWeights.semibold }}>ms</Text>
                        </View>
                      </View>
                      {analytics?.latencyMismatch && (
                        <View style={{ backgroundColor: '#ef444418', borderRadius: radius.lg, padding: spacing.sm, marginTop: spacing.xs }}>
                          <Text style={{ ...typography.caption, color: '#ef4444', fontWeight: fontWeights.bold, marginBottom: 2 }}>Estimate vs reality mismatch</Text>
                          <Text style={{ ...typography.caption, color: '#ef4444', lineHeight: 16 }}>
                            Your estimate says "Fast" but real calls average {measured}ms. Tap Test response time again to recalibrate, or trim your greeting/knowledge bank.
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })()}
                <TouchableOpacity
                  onPress={handleMeasureLatency}
                  disabled={isMeasuringLatency}
                  style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.muted, opacity: isMeasuringLatency ? 0.6 : 1 }}
                  activeOpacity={0.7}
                >
                  {isMeasuringLatency ? (
                    <ActivityIndicator size="small" color={colors.foreground} />
                  ) : (
                    <Feather name="activity" size={16} color={colors.foreground} />
                  )}
                  <Text style={{ ...typography.body, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                    {isMeasuringLatency ? 'Measuring…' : hasServerValue ? 'Test response time again' : 'Test response time'}
                  </Text>
                </TouchableOpacity>
                <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: spacing.md }}>
                  <Text style={{ ...typography.caption, color: colors.mutedForeground, fontWeight: fontWeights.semibold, marginBottom: spacing.xs }}>Target: under 1000ms total turn time</Text>
                  <Text style={{ ...typography.caption, color: colors.mutedForeground, lineHeight: 16 }}>
                    Total turn time is how long callers wait between finishing their sentence and the AI starting to reply. It includes the 0.8s anti-interruption pause, speech recognition, AI thinking, and voice generation. Under 1000ms feels natural; up to 1200ms is acceptable.
                  </Text>
                </View>
              </>
            );
          })()}
        </View>

        <Text style={styles.sectionTitle}>AI Brain</Text>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Feather name="cpu" size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>AI Model</Text>
          </View>
          <Text style={styles.cardSubtitle}>Choose the AI that powers your receptionist. Faster models respond quicker, smarter models handle complex conversations better.</Text>
          {AI_MODEL_OPTIONS.map(m => {
            const isSelected = aiModel === m.id;
            return (
              <PressableRow
                key={m.id}
                style={[styles.modeOption, { borderColor: isSelected ? colors.primary : colors.cardBorder, backgroundColor: isSelected ? colors.primary + '08' : colors.card }]}
                onPress={() => setAiModel(m.id)}

              >
                <View style={[styles.modeIconContainer, { backgroundColor: isSelected ? colors.primary + '20' : colors.muted }]}>
                  <Feather name="cpu" size={18} color={isSelected ? colors.primary : colors.mutedForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modeLabel}>{m.name}</Text>
                  <Text style={styles.modeDescription}>{m.description}</Text>
                </View>
                {isSelected && <Feather name="check" size={20} color={colors.primary} />}
              </PressableRow>
            );
          })}
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Feather name="sliders" size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Response Settings</Text>
          </View>

          <View style={{ marginBottom: spacing.md }}>
            <Text style={{ ...typography.caption, color: colors.mutedForeground, marginBottom: spacing.sm }}>
              Temperature ({aiTemperature.toFixed(2)}) — {aiTemperature <= 0.3 ? 'Very consistent' : aiTemperature <= 0.6 ? 'Balanced' : 'More creative'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <TouchableOpacity
                onPress={() => setAiTemperature(v => Math.max(0, parseFloat((v - 0.1).toFixed(2))))}
                style={{ width: 36, height: 36, borderRadius: radius.lg, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.7}
              >
                <Feather name="minus" size={16} color={colors.foreground} />
              </TouchableOpacity>
              <View style={{ flex: 1, height: 4, backgroundColor: colors.cardBorder, borderRadius: 2, overflow: 'hidden' }}>
                <View style={{ width: `${aiTemperature * 100}%`, height: '100%', backgroundColor: colors.primary, borderRadius: 2 }} />
              </View>
              <TouchableOpacity
                onPress={() => setAiTemperature(v => Math.min(1, parseFloat((v + 0.1).toFixed(2))))}
                style={{ width: 36, height: 36, borderRadius: radius.lg, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={16} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
              <Text style={{ ...typography.caption, color: colors.mutedForeground, fontSize: typography.sizes.xs }}>Consistent</Text>
              <Text style={{ ...typography.caption, color: colors.mutedForeground, fontSize: typography.sizes.xs }}>Creative</Text>
            </View>
          </View>

          <View style={{ marginBottom: spacing.md }}>
            <Text style={{ ...typography.caption, color: colors.mutedForeground, marginBottom: spacing.sm }}>Max Response Length ({aiMaxTokens} tokens)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <TouchableOpacity
                onPress={() => setAiMaxTokens(v => Math.max(50, v - 50))}
                style={{ width: 36, height: 36, borderRadius: radius.lg, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.7}
              >
                <Feather name="minus" size={16} color={colors.foreground} />
              </TouchableOpacity>
              <View style={{ flex: 1, height: 4, backgroundColor: colors.cardBorder, borderRadius: 2, overflow: 'hidden' }}>
                <View style={{ width: `${((aiMaxTokens - 50) / 950) * 100}%`, height: '100%', backgroundColor: colors.primary, borderRadius: 2 }} />
              </View>
              <TouchableOpacity
                onPress={() => setAiMaxTokens(v => Math.min(1000, v + 50))}
                style={{ width: 36, height: 36, borderRadius: radius.lg, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={16} color={colors.foreground} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs }}>
              <Text style={{ ...typography.caption, color: colors.mutedForeground, fontSize: typography.sizes.xs }}>Shorter (faster)</Text>
              <Text style={{ ...typography.caption, color: colors.mutedForeground, fontSize: typography.sizes.xs }}>Longer (detailed)</Text>
            </View>
          </View>

          <Text style={{ ...typography.caption, color: colors.mutedForeground, lineHeight: 16, backgroundColor: colors.muted, padding: spacing.sm, borderRadius: radius.md }}>
            Lower temperature = more predictable responses. Lower max tokens = faster replies. For a phone receptionist, 200-300 tokens and 0.3-0.5 temperature works best.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
            <Feather name="edit-3" size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Custom Instructions</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            Add specific instructions for how your AI should handle calls. These are added to the AI's core instructions.
          </Text>
          <TextInput
            style={[styles.textArea, { minHeight: 100 }]}
            value={customInstructions}
            onChangeText={setCustomInstructions}
            placeholder={"e.g. Always ask if they need an emergency plumber.\nNever discuss pricing over the phone.\nIf they mention a leak, treat it as urgent.\nOur service area is Cairns and surrounding suburbs only."}
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={2000}
          />
          <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.xs }}>
            {customInstructions.length}/2000 characters
          </Text>
        </View>

        {config?.vapiAssistantId && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <Feather name="phone-call" size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Test Call</Text>
            </View>
            <Text style={styles.cardSubtitle}>Call yourself to hear how the AI receptionist sounds</Text>
            <TouchableOpacity
              style={[styles.saveButton, { marginTop: spacing.sm }, isTestingCall && { opacity: 0.7 }]}
              onPress={handleTestCall}
              disabled={isTestingCall}
              activeOpacity={0.8}
            >
              {isTestingCall ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Feather name="phone-outgoing" size={16} color={colors.primaryForeground} />
                  <Text style={styles.saveButtonText}>Call Me</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionTitle}>Voice</Text>
        {VOICE_OPTIONS.map(v => (
          <TouchableOpacity
            key={v.id}
            style={[styles.voiceOption, { borderColor: voice === v.id ? colors.primary : colors.cardBorder, backgroundColor: voice === v.id ? colors.primary + '08' : colors.card }]}
            onPress={() => setVoice(v.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.modeIconContainer, { backgroundColor: voice === v.id ? colors.primary + '20' : colors.muted }]}>
              <Feather name="mic" size={18} color={voice === v.id ? colors.primary : colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.voiceName}>{v.name}</Text>
              <Text style={styles.voiceAccent}>{v.accent}</Text>
            </View>
            {voice === v.id && <Feather name="check" size={20} color={colors.primary} />}
          </TouchableOpacity>
        ))}

        <Text style={styles.sectionTitle}>Voice Tuning</Text>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Feather name="sliders" size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Fine-tune Voice</Text>
          </View>

          <View style={{ marginBottom: spacing.md }}>
            <Text style={{ ...typography.caption, color: colors.mutedForeground, marginBottom: spacing.sm }}>Stability ({voiceStability.toFixed(2)})</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <TouchableOpacity
                onPress={() => setVoiceStability(v => Math.max(0, parseFloat((v - 0.05).toFixed(2))))}
                style={{ width: 36, height: 36, borderRadius: radius.lg, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.7}
              >
                <Feather name="minus" size={16} color={colors.foreground} />
              </TouchableOpacity>
              <View style={{ flex: 1, height: 4, backgroundColor: colors.cardBorder, borderRadius: 2, overflow: 'hidden' }}>
                <View style={{ width: `${voiceStability * 100}%`, height: '100%', backgroundColor: colors.primary, borderRadius: 2 }} />
              </View>
              <TouchableOpacity
                onPress={() => setVoiceStability(v => Math.min(1, parseFloat((v + 0.05).toFixed(2))))}
                style={{ width: 36, height: 36, borderRadius: radius.lg, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={16} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginBottom: spacing.md }}>
            <Text style={{ ...typography.caption, color: colors.mutedForeground, marginBottom: spacing.sm }}>Clarity ({voiceClarity.toFixed(2)})</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <TouchableOpacity
                onPress={() => setVoiceClarity(v => Math.max(0, parseFloat((v - 0.05).toFixed(2))))}
                style={{ width: 36, height: 36, borderRadius: radius.lg, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.7}
              >
                <Feather name="minus" size={16} color={colors.foreground} />
              </TouchableOpacity>
              <View style={{ flex: 1, height: 4, backgroundColor: colors.cardBorder, borderRadius: 2, overflow: 'hidden' }}>
                <View style={{ width: `${voiceClarity * 100}%`, height: '100%', backgroundColor: colors.primary, borderRadius: 2 }} />
              </View>
              <TouchableOpacity
                onPress={() => setVoiceClarity(v => Math.min(1, parseFloat((v + 0.05).toFixed(2))))}
                style={{ width: 36, height: 36, borderRadius: radius.lg, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={16} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          <View>
            <Text style={{ ...typography.caption, color: colors.mutedForeground, marginBottom: spacing.sm }}>Speed ({voiceSpeed.toFixed(2)}x)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <TouchableOpacity
                onPress={() => setVoiceSpeed(v => Math.max(0.25, parseFloat((v - 0.25).toFixed(2))))}
                style={{ width: 36, height: 36, borderRadius: radius.lg, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.7}
              >
                <Feather name="minus" size={16} color={colors.foreground} />
              </TouchableOpacity>
              <View style={{ flex: 1, height: 4, backgroundColor: colors.cardBorder, borderRadius: 2, overflow: 'hidden' }}>
                <View style={{ width: `${((voiceSpeed - 0.25) / 3.75) * 100}%`, height: '100%', backgroundColor: colors.primary, borderRadius: 2 }} />
              </View>
              <TouchableOpacity
                onPress={() => setVoiceSpeed(v => Math.min(4, parseFloat((v + 0.25).toFixed(2))))}
                style={{ width: 36, height: 36, borderRadius: radius.lg, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={16} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Call Settings</Text>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Feather name="settings" size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Call Behaviour</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.body, fontWeight: fontWeights.semibold, color: colors.foreground }}>Voicemail Detection</Text>
              <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 2 }}>Detect and handle voicemail systems</Text>
            </View>
            <Switch
              value={voicemailDetectionEnabled}
              onValueChange={setVoicemailDetectionEnabled}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor={'#FFFFFF'}
              ios_backgroundColor={colors.border}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Silence Timeout (sec)</Text>
              <TextInput
                style={styles.input}
                value={String(silenceTimeoutSeconds)}
                onChangeText={(v) => { const n = parseInt(v, 10); if (!isNaN(n) && n > 0) setSilenceTimeoutSeconds(n); else if (v === '') setSilenceTimeoutSeconds(0); }}
                keyboardType="number-pad"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Max Duration (sec)</Text>
              <TextInput
                style={styles.input}
                value={String(maxCallDurationSeconds)}
                onChangeText={(v) => { const n = parseInt(v, 10); if (!isNaN(n) && n > 0) setMaxCallDurationSeconds(n); else if (v === '') setMaxCallDurationSeconds(0); }}
                keyboardType="number-pad"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>
        </View>

        {(mode === 'always_on_transfer' || mode === 'selective') && (
          <>
            <Text style={styles.sectionTitle}>Transfer Numbers</Text>
            <View style={styles.card}>
              <Text style={styles.cardSubtitle}>Numbers the AI can transfer calls to when your team is available</Text>
              {transferNumbers.map((tn, index) => (
                <View key={index} style={styles.transferRow}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={[styles.transferName, { padding: 0 }]}
                      value={tn.name}
                      onChangeText={(val) => updateTransferNumber(index, 'name', val)}
                      placeholder="Contact name"
                      placeholderTextColor={colors.mutedForeground}
                    />
                    <TextInput
                      style={[styles.transferPhone, { padding: 0, marginTop: 4 }]}
                      value={tn.phone}
                      onChangeText={(val) => updateTransferNumber(index, 'phone', val)}
                      placeholder="04XX XXX XXX"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <TouchableOpacity onPress={() => removeTransferNumber(index)} activeOpacity={0.7}>
                    <Feather name="trash-2" size={18} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={[styles.addButton, { borderColor: colors.primary + '40' }]}
                onPress={addTransferNumberFallback}
                activeOpacity={0.7}
              >
                <Feather name="plus" size={16} color={colors.primary} />
                <Text style={[styles.addButtonText, { color: colors.primary }]}>Add Transfer Number</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Custom Greeting</Text>
        <TextInput
          style={styles.textArea}
          value={greeting}
          onChangeText={setGreeting}
          placeholder="G'day, you've reached [Business Name]. How can I help?"
          placeholderTextColor={colors.mutedForeground}
          multiline
        />

        <Text style={styles.sectionTitle}>Business Hours</Text>
        <View style={styles.card}>
          <Text style={styles.cardSubtitle}>Set different hours for each day</Text>
          {[
            { day: 1, label: 'Monday' },
            { day: 2, label: 'Tuesday' },
            { day: 3, label: 'Wednesday' },
            { day: 4, label: 'Thursday' },
            { day: 5, label: 'Friday' },
            { day: 6, label: 'Saturday' },
            { day: 0, label: 'Sunday' },
          ].map(({ day, label }) => {
            const daySchedule = schedule.find(s => s.day === day);
            if (!daySchedule) return null;
            return (
              <View key={day} style={{ marginBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.cardBorder, paddingBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                  <Text style={{ ...typography.body, fontWeight: fontWeights.semibold, color: daySchedule.enabled ? colors.foreground : colors.mutedForeground }}>{label}</Text>
                  <Switch
                    value={daySchedule.enabled}
                    onValueChange={() => toggleDayEnabled(day)}
                    trackColor={{ false: colors.border, true: colors.success }}
                    thumbColor={'#FFFFFF'}
                    ios_backgroundColor={colors.border}
                  />
                </View>
                {daySchedule.enabled && (
                  <>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>Open</Text>
                        <TextInput
                          style={styles.input}
                          value={daySchedule.start}
                          onChangeText={(v) => updateDayTime(day, 'start', v)}
                          placeholder="08:00"
                          placeholderTextColor={colors.mutedForeground}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>Close</Text>
                        <TextInput
                          style={styles.input}
                          value={daySchedule.end}
                          onChangeText={(v) => updateDayTime(day, 'end', v)}
                          placeholder="17:00"
                          placeholderTextColor={colors.mutedForeground}
                        />
                      </View>
                    </View>
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}
                      onPress={() => toggleDayBreak(day)}
                      activeOpacity={0.7}
                    >
                      <Feather name={daySchedule.breakStart ? 'check-square' : 'square'} size={16} color={daySchedule.breakStart ? colors.primary : colors.mutedForeground} />
                      <Text style={{ ...typography.caption, color: daySchedule.breakStart ? colors.primary : colors.mutedForeground }}>Break window</Text>
                    </TouchableOpacity>
                    {daySchedule.breakStart && (
                      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.inputLabel}>Break start</Text>
                          <TextInput
                            style={styles.input}
                            value={daySchedule.breakStart}
                            onChangeText={(v) => updateDayTime(day, 'breakStart', v)}
                            placeholder="12:00"
                            placeholderTextColor={colors.mutedForeground}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.inputLabel}>Break end</Text>
                          <TextInput
                            style={styles.input}
                            value={daySchedule.breakEnd || ''}
                            onChangeText={(v) => updateDayTime(day, 'breakEnd', v)}
                            placeholder="13:00"
                            placeholderTextColor={colors.mutedForeground}
                          />
                        </View>
                      </View>
                    )}
                  </>
                )}
              </View>
            );
          })}
          <View style={{ marginTop: spacing.sm }}>
            <Text style={styles.inputLabel}>Timezone</Text>
            <TextInput
              style={styles.input}
              value={timezone}
              onChangeText={setTimezone}
              placeholder="Australia/Sydney"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Holidays / Days Off</Text>
        <View style={styles.card}>
          <Text style={styles.cardSubtitle}>Add dates when the AI should answer as if you're closed all day</Text>
          {holidays.map((h) => (
            <View key={h.date} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.body, color: colors.foreground }}>{h.label}</Text>
                <Text style={{ ...typography.caption, color: colors.mutedForeground }}>{h.date}</Text>
              </View>
              <TouchableOpacity onPress={() => removeHoliday(h.date)} activeOpacity={0.7}>
                <Feather name="x" size={18} color={colors.destructive || '#ef4444'} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.addButton, { borderColor: colors.primary + '50', marginTop: spacing.md }]}
            onPress={() => setShowHolidayPresets(!showHolidayPresets)}
            activeOpacity={0.7}
          >
            <Feather name="calendar" size={16} color={colors.primary} />
            <Text style={[styles.addButtonText, { color: colors.primary }]}>
              {showHolidayPresets ? 'Hide Presets' : 'Add Australian Holidays'}
            </Text>
          </TouchableOpacity>
          {showHolidayPresets && holidayPresets.length > 0 && (
            <View style={{ marginTop: spacing.sm }}>
              {holidayPresets
                .filter(p => !holidays.some(h => h.date === p.date))
                .map((preset) => (
                  <TouchableOpacity
                    key={preset.date}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}
                    onPress={() => addHoliday(preset.date, preset.label)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.body, color: colors.foreground }}>{preset.label}</Text>
                      <Text style={{ ...typography.caption, color: colors.mutedForeground }}>{preset.date}</Text>
                    </View>
                    <Feather name="plus-circle" size={18} color={colors.primary} />
                  </TouchableOpacity>
                ))}
            </View>
          )}
          <TouchableOpacity
            style={[styles.addButton, { borderColor: colors.primary + '50', marginTop: spacing.sm }]}
            onPress={() => setShowCustomHoliday(!showCustomHoliday)}
            activeOpacity={0.7}
          >
            <Feather name={showCustomHoliday ? 'chevron-up' : 'plus'} size={16} color={colors.primary} />
            <Text style={[styles.addButtonText, { color: colors.primary }]}>{showCustomHoliday ? 'Cancel' : 'Add Custom Date'}</Text>
          </TouchableOpacity>
          {showCustomHoliday && (
            <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    value={customHolidayDate}
                    onChangeText={setCustomHolidayDate}
                    placeholder="2026-12-25"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Name</Text>
                  <TextInput
                    style={styles.input}
                    value={customHolidayLabel}
                    onChangeText={setCustomHolidayLabel}
                    placeholder="Christmas Day"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              </View>
              <TouchableOpacity
                style={[styles.addButton, { borderColor: colors.primary + '50' }]}
                onPress={() => {
                  if (!customHolidayDate || !/^\d{4}-\d{2}-\d{2}$/.test(customHolidayDate)) {
                    Alert.alert('Invalid Date', 'Please enter a date in YYYY-MM-DD format.');
                    return;
                  }
                  if (!customHolidayLabel.trim()) {
                    Alert.alert('Missing Name', 'Please enter a name for this holiday.');
                    return;
                  }
                  addHoliday(customHolidayDate, customHolidayLabel.trim());
                  setCustomHolidayDate('');
                  setCustomHolidayLabel('');
                  setShowCustomHoliday(false);
                }}
                activeOpacity={0.7}
              >
                <Feather name="check" size={16} color={colors.primary} />
                <Text style={[styles.addButtonText, { color: colors.primary }]}>Add Holiday</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Auto-Reply SMS</Text>
        <View style={styles.card}>
          <View style={styles.enableRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.enableLabel}>Auto-reply to callers</Text>
              <Text style={styles.enableSublabel}>Send an SMS to the caller after each AI-handled call confirming their message was received</Text>
            </View>
            <Switch
              value={autoReplyEnabled}
              onValueChange={setAutoReplyEnabled}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor={'#FFFFFF'}
              ios_backgroundColor={colors.border}
            />
          </View>
          {autoReplyEnabled && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={styles.inputLabel}>Reply message template</Text>
              <TextInput
                style={styles.textArea}
                value={autoReplyMessage}
                onChangeText={setAutoReplyMessage}
                placeholder="Thanks for calling {{business_name}}. We got your message and will get back to you shortly."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
              />
              <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.xs }}>
                Use {'{{business_name}}'} to insert your business name. SMS sent from your dedicated number only.
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, (isSaving || !configLoaded) && { opacity: 0.7 }]}
          onPress={() => {
            if (!configLoaded) return;
            if (!config?.dedicatedPhoneNumber) {
              handleSave();
              Alert.alert(
                'Request Submitted',
                'Your AI Receptionist preferences have been saved. Our team will provision a dedicated phone number and notify you when it\'s ready.',
                [{ text: 'OK' }]
              );
              return;
            }
            handleSave();
          }}
          disabled={isSaving || !configLoaded}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Text style={styles.saveButtonText}>
              {config?.dedicatedPhoneNumber ? 'Save Settings' : 'Save & Request Setup'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ backgroundColor: `${colors.info}10`, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: `${colors.info}20` }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
            <Feather name="info" size={16} color={colors.info} />
            <Text style={{ ...typography.label, color: colors.foreground }}>AI-Powered Service</Text>
          </View>
          <Text style={{ ...typography.caption, color: colors.mutedForeground, lineHeight: 18 }}>
            The AI Receptionist uses artificial intelligence to answer calls and respond to SMS messages on behalf of your business. Callers will hear an AI-generated voice. You are responsible for reviewing messages and call summaries for accuracy.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
            <Feather name="book-open" size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Knowledge Bank</Text>
          </View>
          <Text style={styles.cardSubtitle}>Train your AI with business-specific info so it can answer callers accurately.</Text>

          <Text style={styles.inputLabel}>Service Descriptions</Text>
          <TextInput
            style={[styles.textArea, { marginBottom: spacing.md }]}
            value={knowledgeBank.serviceDescriptions || ''}
            onChangeText={(v) => setKnowledgeBank(prev => ({ ...prev, serviceDescriptions: v }))}
            placeholder="Describe your services, specialties..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={2000}
          />

          <Text style={styles.inputLabel}>Pricing Information</Text>
          <TextInput
            style={[styles.textArea, { marginBottom: spacing.md }]}
            value={knowledgeBank.pricingInfo || ''}
            onChangeText={(v) => setKnowledgeBank(prev => ({ ...prev, pricingInfo: v }))}
            placeholder="Call-out fees, hourly rates..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={2000}
          />

          <Text style={styles.inputLabel}>Special Instructions</Text>
          <TextInput
            style={[styles.textArea, { marginBottom: spacing.md }]}
            value={knowledgeBank.specialInstructions || ''}
            onChangeText={(v) => setKnowledgeBank(prev => ({ ...prev, specialInstructions: v }))}
            placeholder="Areas you service, special handling..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={2000}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={styles.inputLabel}>FAQs</Text>
            <TouchableOpacity
              style={[styles.addButton, { borderColor: colors.primary + '50', paddingVertical: spacing.xs, paddingHorizontal: spacing.md }]}
              onPress={addFaq}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={14} color={colors.primary} />
              <Text style={[styles.addButtonText, { color: colors.primary, fontSize: typography.sizes.sm }]}>Add FAQ</Text>
            </TouchableOpacity>
          </View>
          {(knowledgeBank.faqs || []).map((faq, i) => (
            <View key={i} style={{ borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <TextInput
                    style={[styles.input, { marginBottom: spacing.xs }]}
                    value={faq.question}
                    onChangeText={(v) => updateFaq(i, 'question', v)}
                    placeholder="Common question..."
                    placeholderTextColor={colors.mutedForeground}
                  />
                  <TextInput
                    style={styles.textArea}
                    value={faq.answer}
                    onChangeText={(v) => updateFaq(i, 'answer', v)}
                    placeholder="Answer..."
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                  />
                </View>
                <TouchableOpacity onPress={() => removeFaq(i)} activeOpacity={0.7}>
                  <Feather name="trash-2" size={18} color={colors.destructive || '#ef4444'} />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.saveButton, isSavingKB && { opacity: 0.7 }]}
            onPress={handleSaveKnowledgeBank}
            disabled={isSavingKB}
            activeOpacity={0.8}
          >
            {isSavingKB ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={styles.saveButtonText}>Save Knowledge Bank</Text>
            )}
          </TouchableOpacity>
        </View>

        {analytics && analytics.totalCalls > 0 && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <Feather name="bar-chart-2" size={18} color={colors.primary} />
              <Text style={styles.cardTitle}>Call Analytics</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              <View style={{ flex: 1, backgroundColor: colors.muted, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' }}>
                <Text style={{ ...typography.statValue, color: colors.foreground }}>{analytics.totalCalls}</Text>
                <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 2 }}>Total Calls</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.muted, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' }}>
                <Text style={{ ...typography.statValue, color: colors.foreground }}>
                  {analytics.avgDuration >= 60 ? `${Math.floor(analytics.avgDuration / 60)}m ${analytics.avgDuration % 60}s` : `${analytics.avgDuration}s`}
                </Text>
                <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 2 }}>Avg Duration</Text>
              </View>
            </View>
            {analytics?.outcomeBreakdown && typeof analytics.outcomeBreakdown === 'object' && Object.keys(analytics.outcomeBreakdown).length > 0 && (
              <View style={{ gap: spacing.xs }}>
                <Text style={{ ...typography.caption, color: colors.mutedForeground, fontWeight: fontWeights.semibold, marginBottom: spacing.xs }}>Outcomes</Text>
                {Object.entries(analytics.outcomeBreakdown || {}).map(([outcome, count]) => {
                  const outcomeLabels: Record<string, string> = {
                    message_taken: 'Message Taken',
                    transferred: 'Transferred',
                    booked: 'Booked',
                    missed: 'Missed',
                    unknown: 'Other',
                  };
                  const label = outcomeLabels[outcome] || outcome.charAt(0).toUpperCase() + outcome.slice(1);
                  const pct = analytics.totalCalls > 0 ? Math.round((count / analytics.totalCalls) * 100) : 0;
                  return (
                    <View key={outcome} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={{ ...typography.caption, color: colors.foreground }}>{label}</Text>
                          <Text style={{ ...typography.caption, color: colors.mutedForeground }}>{count} ({pct}%)</Text>
                        </View>
                        <View style={{ height: 4, backgroundColor: colors.cardBorder, borderRadius: 2, overflow: 'hidden' }}>
                          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: colors.primary, borderRadius: 2 }} />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {recentCalls.length > 0 && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Feather name="phone-incoming" size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>Recent Calls</Text>
              </View>
              <View style={{ backgroundColor: colors.cardBorder, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
                <Text style={{ ...typography.caption, color: colors.mutedForeground }}>{filteredCalls.length} call{filteredCalls.length !== 1 ? 's' : ''}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md, flexWrap: 'wrap' }}>
              {['all', 'negative', 'neutral', 'positive'].map((s) => {
                const isActive = sentimentFilter === s;
                const filterColors: Record<string, { bg: string; text: string }> = {
                  all: { bg: colors.primary, text: colors.primaryForeground },
                  negative: { bg: '#ef4444', text: colors.white },
                  neutral: { bg: '#6b7280', text: colors.white },
                  positive: { bg: '#22c55e', text: colors.white },
                };
                const fc = filterColors[s] || filterColors.all;
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setSentimentFilter(s)}
                    activeOpacity={0.7}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs,
                      borderRadius: radius.full,
                      backgroundColor: isActive ? fc.bg : 'transparent',
                      borderWidth: 1,
                      borderColor: isActive ? fc.bg : colors.cardBorder,
                    }}
                  >
                    <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: isActive ? fc.text : colors.mutedForeground, textTransform: 'capitalize' }}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                onPress={() => setSentimentSort(!sentimentSort)}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.full,
                  backgroundColor: sentimentSort ? colors.primary : 'transparent',
                  borderWidth: 1,
                  borderColor: sentimentSort ? colors.primary : colors.cardBorder,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Feather name="alert-triangle" size={12} color={sentimentSort ? colors.primaryForeground : colors.mutedForeground} />
                <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.semibold, color: sentimentSort ? colors.primaryForeground : colors.mutedForeground }}>Urgent First</Text>
              </TouchableOpacity>
            </View>

            {filteredCalls.map((call) => {
              const isExpanded = expandedCallId === call.id;
              const isPlaying = playingCallId === call.id;
              const outcomeColors: Record<string, { bg: string; text: string; label: string }> = {
                message_taken: { bg: '#dbeafe', text: '#1d4ed8', label: 'Message' },
                transferred: { bg: '#dcfce7', text: '#15803d', label: 'Transferred' },
                booked: { bg: '#f3e8ff', text: '#7c3aed', label: 'Booked' },
                missed: { bg: '#fee2e2', text: '#b91c1c', label: 'Missed' },
              };
              const sentimentColors: Record<string, { bg: string; text: string; icon: FeatherIconName }> = {
                positive: { bg: '#dcfce7', text: '#15803d', icon: 'smile' },
                neutral: { bg: '#f3f4f6', text: '#6b7280', icon: 'minus-circle' },
                negative: { bg: '#fee2e2', text: '#b91c1c', icon: 'frown' },
              };
              const oc = outcomeColors[call.outcome || ''] || { bg: colors.cardBorder, text: colors.mutedForeground, label: call.outcome || 'Call' };
              const sc = sentimentColors[call.sentiment || ''] || sentimentColors.neutral;
              const callDate = new Date(call.createdAt);
              const durationText = call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : '';

              return (
                <TouchableOpacity
                  key={call.id}
                  activeOpacity={0.7}
                  onPress={() => setExpandedCallId(isExpanded ? null : call.id)}
                  style={{ borderWidth: 1, borderColor: call.sentiment === 'negative' ? '#fca5a5' : colors.cardBorder, borderRadius: radius.lg, marginBottom: spacing.sm, overflow: 'hidden' }}
                >
                  <View style={{ padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <Text style={{ ...typography.body, color: colors.foreground, fontWeight: fontWeights.semibold, flex: 1 }} numberOfLines={1}>
                          {call.callerName || (call.callerPhone ? formatPhoneDisplay(call.callerPhone) : 'Unknown Caller')}
                        </Text>
                      </View>
                      <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 2 }}>
                        {callDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                        {durationText ? ` \u00B7 ${durationText}` : ''}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      {call.sentiment && (
                        <View style={{ backgroundColor: sc.bg, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Feather name={sc.icon} size={10} color={sc.text} />
                          <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: sc.text, textTransform: 'capitalize' }}>{call.sentiment}</Text>
                        </View>
                      )}
                      {typeof call.latencyMs === 'number' && call.latencyMs > 0 && (() => {
                        const lt = getLatencyTone(call.latencyMs, colors);
                        return (
                          <View style={{ backgroundColor: lt.bg, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Feather name="zap" size={10} color={lt.text} />
                            <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: lt.text }}>{call.latencyMs}ms</Text>
                          </View>
                        );
                      })()}
                      <View style={{ backgroundColor: oc.bg, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
                        <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: oc.text }}>{oc.label}</Text>
                      </View>
                      {call.recordingUrl && (
                        <TouchableOpacity
                          onPress={(e) => { e.stopPropagation?.(); playRecording(call.id, call.recordingUrl!); }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.7}
                          style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isPlaying ? colors.primary : colors.cardBorder, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Feather name={isPlaying ? 'pause' : 'play'} size={14} color={isPlaying ? colors.primaryForeground : colors.foreground} />
                        </TouchableOpacity>
                      )}
                      <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
                    </View>
                  </View>
                  {isPlaying && (
                    <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
                      <View style={{ height: 3, backgroundColor: colors.cardBorder, borderRadius: 2, overflow: 'hidden' }}>
                        <View style={{ width: audioDuration > 0 ? `${(audioProgress / audioDuration) * 100}%` : '0%', height: '100%', backgroundColor: colors.primary, borderRadius: 2 }} />
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                        <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>{Math.floor(audioProgress / 1000)}s</Text>
                        <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>{audioDuration > 0 ? `${Math.floor(audioDuration / 1000)}s` : ''}</Text>
                      </View>
                    </View>
                  )}
                  {isExpanded && (
                    <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: spacing.md, gap: spacing.sm }}>
                      {typeof call.latencyMs === 'number' && call.latencyMs > 0 && (() => {
                        const lt = getLatencyTone(call.latencyMs, colors);
                        return (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                            <Feather name="zap" size={14} color={colors.mutedForeground} />
                            <Text style={{ ...typography.caption, color: colors.mutedForeground }}>Response time:</Text>
                            <View style={{ backgroundColor: lt.bg, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
                              <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: lt.text }}>{call.latencyMs}ms · {lt.label}</Text>
                            </View>
                          </View>
                        );
                      })()}
                      {call.summary && (
                        <View>
                          <Text style={{ ...typography.caption, color: colors.mutedForeground, fontWeight: fontWeights.semibold, marginBottom: 4 }}>Summary</Text>
                          <Text style={{ ...typography.body, color: colors.foreground, backgroundColor: colors.card, padding: spacing.sm, borderRadius: radius.md, fontSize: typography.sizes.sm }}>{call.summary}</Text>
                        </View>
                      )}
                      {call.transcript && (
                        <View>
                          <Text style={{ ...typography.caption, color: colors.mutedForeground, fontWeight: fontWeights.semibold, marginBottom: 4 }}>Transcript</Text>
                          <Text style={{ ...typography.body, color: colors.foreground, backgroundColor: colors.card, padding: spacing.sm, borderRadius: radius.md, fontSize: typography.sizes.sm }} numberOfLines={8}>{call.transcript}</Text>
                        </View>
                      )}
                      {call.recordingUrl && !isPlaying && (
                        <TouchableOpacity
                          onPress={() => playRecording(call.id, call.recordingUrl!)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}
                        >
                          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                            <Feather name="play" size={14} color={colors.primaryForeground} />
                          </View>
                          <Text style={{ ...typography.body, color: colors.primary, fontSize: typography.sizes.sm }}>Play Recording</Text>
                        </TouchableOpacity>
                      )}
                      {call.callerPhone && (
                        <TouchableOpacity
                          onPress={() => Linking.openURL(`tel:${call.callerPhone}`)}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}
                        >
                          <Feather name="phone" size={14} color={colors.primary} />
                          <Text style={{ ...typography.body, color: colors.primary, fontSize: typography.sizes.sm }}>{formatPhoneDisplay(call.callerPhone)}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
            <Feather name="mic" size={18} color={colors.primary} />
            <Text style={styles.cardTitle}>Need a Different Voice?</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            Our 3 built-in Aussie voices (Jess, Harry, Chris) not quite right? Describe the voice style you'd like and we'll add it to your options.
          </Text>

          {Array.isArray(voiceRequests) && voiceRequests.length > 0 && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={[styles.inputLabel, { marginBottom: spacing.sm }]}>Your Requests</Text>
              {voiceRequests.map((req) => (
                <View key={req.id} style={{ borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.body, color: colors.foreground }}>{req.requestedDescription}</Text>
                      {req.adminNotes ? <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 4 }}>Admin: {req.adminNotes}</Text> : null}
                      <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 4 }}>{new Date(req.createdAt).toLocaleDateString()}</Text>
                    </View>
                    <View style={[styles.statusBadge, {
                      backgroundColor: req.status === 'resolved' ? '#dcfce7' : req.status === 'in_progress' ? '#dbeafe' : req.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                    }]}>
                      <Text style={[styles.statusText, {
                        color: req.status === 'resolved' ? '#15803d' : req.status === 'in_progress' ? '#1d4ed8' : req.status === 'rejected' ? '#b91c1c' : '#92400e',
                      }]}>
                        {req.status === 'in_progress' ? 'In Progress' : req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          <TextInput
            style={[styles.textArea, { marginTop: spacing.md, marginBottom: spacing.md }]}
            value={voiceRequestText}
            onChangeText={setVoiceRequestText}
            placeholder="e.g. 'younger female voice', 'deeper male tone', 'British accent'..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.cardBorder }, (isSubmittingVR || voiceRequestText.length < 5) && { opacity: 0.5 }]}
            onPress={handleSubmitVoiceRequest}
            disabled={isSubmittingVR || voiceRequestText.length < 5}
            activeOpacity={0.8}
          >
            {isSubmittingVR ? (
              <ActivityIndicator size="small" color={colors.foreground} />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Feather name="send" size={16} color={colors.foreground} />
                <Text style={[styles.saveButtonText, { color: colors.foreground }]}>Request Custom Voice</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}
