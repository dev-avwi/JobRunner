import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Image,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography, shadows, sizes, fontWeights } from '../../src/lib/design-tokens';

import api from '../../src/lib/api';
import { handleDedicatedNumberError, isDedicatedNumberReason } from '../../src/lib/smsGate';
import { useAuthStore } from '../../src/lib/store';
import { useTeamMemberColors, memberColorFor } from '../../src/lib/team-colors';

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

interface SmsMessage {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  status: string;
  createdAt: string;
  fromNumber?: string;
  toNumber?: string;
  mediaUrls?: string[] | null;
  senderUserId?: string | null;
  senderName?: string | null;
  errorMessage?: string | null;
}

function buildQuickReplies(clientFirstName: string, senderName: string) {
  const hi = clientFirstName ? `Hi ${clientFirstName}` : "G'day";
  const from = senderName ? `, ${senderName}` : '';
  return [
    { id: 'omw', label: "On my way", icon: 'navigation' as const, message: `${hi}, just letting you know I'm heading to you now${from}. I'll text you when I'm close.` },
    { id: 'running-late', label: "Running late", icon: 'clock' as const, message: `${hi}, apologies — I'm running a bit behind today. I'll let you know my updated arrival time shortly${from}.` },
    { id: 'arrived', label: "Arrived", icon: 'map-pin' as const, message: `${hi}, I've arrived at the property. Let me know if there's anything specific you'd like me to look at first.` },
    { id: 'job-done', label: "Job done", icon: 'check' as const, message: `${hi}, the job's all done. Let me know if you have any questions or need anything else${from}.` },
    { id: 'quote-sent', label: "Quote sent", icon: 'file-text' as const, message: `${hi}, I've sent through your quote. Have a look and let me know if you've got any questions or want to go ahead.` },
    { id: 'invoice-sent', label: "Invoice sent", icon: 'dollar-sign' as const, message: `${hi}, your invoice has been sent through. Let me know if you have any questions about it.` },
    { id: 'confirm', label: "Confirm appt", icon: 'calendar' as const, message: `${hi}, just confirming our upcoming appointment. Please reply to let me know you're still available, or give us a bell if you need to reschedule.` },
    { id: 'thanks', label: "Thanks", icon: 'thumbs-up' as const, message: `${hi}, thanks for your business — really appreciate it. Don't hesitate to reach out if you need anything in the future.` },
    { id: 'reschedule', label: "Reschedule", icon: 'refresh-cw' as const, message: `${hi}, unfortunately I need to reschedule our appointment. Could you let me know what other days/times work for you?` },
  ];
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.primary}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 2,
  },
  headerName: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  headerPhone: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.success}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messagesArea: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${colors.primary}10`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  emptySubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 4,
  },
  dateSeparator: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  dateSeparatorPill: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },
  messageRow: {
    marginBottom: 3,
  },
  messageRowOutbound: {
    alignItems: 'flex-end',
  },
  messageRowInbound: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bubbleOutbound: {
    // Muted, calm blue (not bright/neon) — same single colour for every outbound
    // message so the thread doesn't read as loud or multi-coloured.
    backgroundColor: colors.isDark ? '#34506F' : '#5C7FA6',
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  bubbleInbound: {
    backgroundColor: colors.isDark ? colors.muted : '#F1F3F5',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: typography.sizes.md,
    lineHeight: 21,
    fontWeight: fontWeights.medium,
  },
  bubbleTextOutbound: {
    color: '#FFFFFF',
  },
  bubbleTextInbound: {
    color: colors.foreground,
  },
  bubbleTime: {
    fontSize: typography.sizes.xs,
    marginTop: 3,
  },
  bubbleTimeOutbound: {
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'right',
  },
  bubbleTimeInbound: {
    color: colors.mutedForeground,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
    gap: 3,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
  },
  statusDelivered: {
    color: colors.success,
  },
  composerWrap: {
    backgroundColor: colors.background,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  quickRepliesRow: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
  },
  quickRepliesScroll: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.muted,
    gap: 5,
  },
  quickChipText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  composerInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    gap: spacing.xs,
  },
  zapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: 20,
    overflow: 'hidden',
  },
  textInput: {
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 9 : 7,
    fontSize: typography.sizes.md,
    color: colors.foreground,
    maxHeight: 100,
    minHeight: 36,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  sendBtnDisabled: {
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default function SmsConversationScreen() {
  const { id, phone, name, jobId: jobIdParam } = useLocalSearchParams<{ id: string; phone: string; name: string; jobId: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, businessSettings } = useAuthStore();
  const memberColors = useTeamMemberColors();

  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageText, setMessageText] = useState('');

  // SMS character / segment counter — Twilio bills per segment, so a stray emoji or 161-char
  // body can quietly triple the cost. We compute GSM-7 vs UCS-2 and show segments in real time.
  const smsInfo = useMemo(() => {
    const text = messageText;
    if (text.length === 0) return { chars: 0, segments: 0, encoding: 'GSM-7' as 'GSM-7' | 'UCS-2', remaining: 160 };
    // GSM 03.38 basic + extension tables.
    const GSM_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
    const GSM_EXTENDED = "\f^{}\\[~]|€";
    let isGsm = true;
    let gsmCharCount = 0;
    for (const c of text) {
      if (GSM_BASIC.includes(c)) {
        gsmCharCount += 1;
      } else if (GSM_EXTENDED.includes(c)) {
        gsmCharCount += 2;
      } else {
        isGsm = false;
        break;
      }
    }
    if (isGsm) {
      const segments = gsmCharCount <= 160 ? 1 : Math.ceil(gsmCharCount / 153);
      const cap = segments === 1 ? 160 : segments * 153;
      return { chars: gsmCharCount, segments, encoding: 'GSM-7' as const, remaining: cap - gsmCharCount };
    }
    // UCS-2: count code units (matches what Twilio counts).
    const ucs2Count = text.length;
    const segments = ucs2Count <= 70 ? 1 : Math.ceil(ucs2Count / 67);
    const cap = segments === 1 ? 70 : segments * 67;
    return { chars: ucs2Count, segments, encoding: 'UCS-2' as const, remaining: cap - ucs2Count };
  }, [messageText]);
  const [isSending, setIsSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  const clientPhone = phone ? decodeURIComponent(phone) : '';
  const [resolvedClientName, setResolvedClientName] = useState<string | null>(null);
  const clientName = resolvedClientName || (name ? decodeURIComponent(name) : 'Unknown');
  const clientFirstName = clientName.split(' ')[0] !== 'Unknown' ? clientName.split(' ')[0] : '';
  const senderName = user?.firstName || businessSettings?.businessName || '';
  const [savedTemplates, setSavedTemplates] = useState<{ id: string; label: string; message: string }[]>([]);

  // Live context (latest unpaid invoice, pending quote, active job + real public
  // links) so templates resolve real numbers/amounts/links instead of raw
  // {invoice_number}-style placeholders.
  type SmsContext = {
    invoice?: { number?: string; total?: string; dueDate?: string; url?: string } | null;
    quote?: { number?: string; total?: string; url?: string } | null;
    job?: { title?: string; address?: string; scheduledDate?: string; url?: string | null } | null;
  };
  const [smsContext, setSmsContext] = useState<SmsContext | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    api.get<SmsContext>(`/api/sms/conversations/${id}/context`)
      .then((res) => {
        if (!active || res.error || !res.data || typeof res.data !== 'object') return;
        setSmsContext(res.data);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [id]);

  const applyMergeFields = useCallback((body: string) => {
    const clientFull = clientName && clientName !== 'Unknown' ? clientName : '';
    const businessName = businessSettings?.businessName || '';
    const inv = smsContext?.invoice;
    const qt = smsContext?.quote;
    const jb = smsContext?.job;

    const money = (v?: string) => {
      const n = parseFloat(v || '');
      return isNaN(n) ? '' : n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    const dateStr = (v?: string) => {
      if (!v) return '';
      const d = new Date(v);
      return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    let out = body
      .replace(/\{client_first_name\}/gi, clientFirstName || 'there')
      .replace(/\{first_name\}/gi, clientFirstName || 'there')
      .replace(/\{client_name\}/gi, clientFull || 'there')
      .replace(/\{name\}/gi, clientFull || 'there')
      .replace(/\{business_name\}/gi, businessName)
      .replace(/\{sender_name\}/gi, senderName)
      .replace(/\{sender\}/gi, senderName);

    // Invoice fields — only substitute when we have a real invoice; otherwise
    // the raw placeholder stays visible so the sender knows to fix it.
    if (inv) {
      out = out
        .replace(/\{invoice_number\}/gi, inv.number || '')
        .replace(/\{invoice_total\}/gi, money(inv.total))
        .replace(/\{amount\}/gi, money(inv.total))
        .replace(/\{due_date\}/gi, dateStr(inv.dueDate))
        .replace(/\{invoice_link\}/gi, inv.url || '')
        .replace(/\{payment_link\}/gi, inv.url || '');
    }
    if (qt) {
      out = out
        .replace(/\{quote_number\}/gi, qt.number || '')
        .replace(/\{quote_total\}/gi, money(qt.total))
        .replace(/\{quote_amount\}/gi, money(qt.total))
        .replace(/\{quote_link\}/gi, qt.url || '');
    }
    if (jb) {
      out = out
        .replace(/\{job_title\}/gi, jb.title || '')
        .replace(/\{job_address\}/gi, jb.address || '')
        .replace(/\{job_date\}/gi, dateStr(jb.scheduledDate))
        .replace(/\{tracking_link\}/gi, jb.url || '')
        .replace(/\{job_link\}/gi, jb.url || '');
    }

    // Auto-append the right real link when the message clearly needs one but
    // the template didn't include a link placeholder.
    const hasUrl = /https?:\/\//i.test(out);
    if (!hasUrl) {
      if (inv?.url && /invoice|pay/i.test(out)) {
        out = `${out.trimEnd()}\n\nPay securely here:\n${inv.url}`;
      } else if (qt?.url && /quote/i.test(out)) {
        out = `${out.trimEnd()}\n\nView & accept your quote:\n${qt.url}`;
      } else if (jb?.url && /(on my way|heading to you|running (a bit )?(late|behind)|track|eta|arriv)/i.test(out)) {
        out = `${out.trimEnd()}\n\nTrack your job:\n${jb.url}`;
      }
    }
    return out;
  }, [clientName, clientFirstName, senderName, businessSettings?.businessName, smsContext]);

  const builtInReplies = useMemo(() => buildQuickReplies(clientFirstName, senderName), [clientFirstName, senderName]);
  const quickReplies = useMemo(() => {
    const savedNames = new Set(savedTemplates.map((t) => t.label.trim().toLowerCase()));
    return [
      ...savedTemplates.map((t) => ({ id: t.id, label: t.label, icon: 'message-square' as const, message: applyMergeFields(t.message) })),
      // Skip built-ins whose name matches a saved template (server seeds defaults
      // with the same names, so showing both duplicates every chip)
      ...builtInReplies
        .filter((r) => !savedNames.has(r.label.trim().toLowerCase()))
        .map((r) => ({ ...r, message: applyMergeFields(r.message) })),
    ];
  }, [savedTemplates, builtInReplies, applyMergeFields]);

  useEffect(() => {
    let active = true;
    api.get<any[]>('/api/message-templates?channel=sms')
      .then((res) => {
        if (!active || res.error || !Array.isArray(res.data)) return;
        // Dedupe by name — some accounts have double-seeded default templates
        const seen = new Set<string>();
        setSavedTemplates(
          res.data
            .filter((t) => t && t.body && t.name)
            .filter((t) => {
              const key = String(t.name).trim().toLowerCase();
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            })
            .map((t) => ({ id: String(t.id), label: t.name, message: t.body }))
        );
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (id) {
      api.get<any>(`/api/sms/conversations/${id}`).then(res => {
        if (res.data?.clientName) {
          setResolvedClientName(res.data.clientName);
        }
      }).catch(() => {});
    }
  }, [id]);

  // Single overlap guard — covers polling AND every other caller (refresh, send, quick-reply).
  const smsFetchInFlightRef = useRef(false);

  useEffect(() => {
    loadMessages();
    api.post(`/api/sms/conversations/${id}/read`).catch(() => {});
    // 15s polling (was 5s — drained battery + ran up cellular costs on site).
    const interval = setInterval(() => { loadMessages(); }, 15000);
    return () => clearInterval(interval);
  }, [id]);

  const loadMessages = async () => {
    if (smsFetchInFlightRef.current) return;
    smsFetchInFlightRef.current = true;
    try {
      const response = await api.get<SmsMessage[]>(`/api/sms/conversations/${id}/messages`);
      if (Array.isArray(response.data)) {
        setMessages(response.data);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
      }
    } catch (error) {
      console.error('Error loading SMS messages:', error);
      setMessages([]);
    } finally {
      setIsLoading(false);
      smsFetchInFlightRef.current = false;
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
  };

  const handleSend = async () => {
    if (!messageText.trim() || isSending) return;

    setIsSending(true);
    try {
      const response = await api.post('/api/sms/send', {
        clientPhone,
        message: messageText.trim(),
        conversationId: id,
      });
      if (response.error) {
        if (!handleDedicatedNumberError(response)) {
          Alert.alert('Error', 'Failed to send SMS. Please try again.');
        }
      } else {
        setMessageText('');
        await loadMessages();
        scrollRef.current?.scrollToEnd({ animated: true });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send SMS. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const renderMessageBody = useCallback((body: string, isOutbound: boolean) => {
    const parts = body.split(URL_REGEX);
    if (parts.length === 1) return body;

    return parts.map((part, i) => {
      if (URL_REGEX.test(part)) {
        URL_REGEX.lastIndex = 0;
        let label = 'Open link';
        if (part.includes('/p/')) label = 'Track your job';
        else if (part.includes('/quote')) label = 'View quote';
        else if (part.includes('/invoice')) label = 'View invoice';
        else if (part.includes('jobrunner')) label = 'Open in JobRunner';

        return (
          <Text
            key={i}
            style={{
              textDecorationLine: 'underline',
              // Outbound bubbles have a saturated blue background with white
              // text, so the link must be white to stay legible (it was using
              // primary blue, which blended into the bubble). Inbound bubbles are
              // neutral, so primary blue reads fine there.
              color: isOutbound ? '#FFFFFF' : colors.primary,
              fontWeight: fontWeights.bold,
            }}
            onPress={() => Linking.openURL(part)}
          >
            {'\n'}{label} {'→'}
          </Text>
        );
      }
      return part;
    });
  }, [colors]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }


  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <PressableRow style={styles.backButton} onPress={() => router.back()}>
            <Feather name="chevron-left" size={22} color={colors.foreground} />
          </PressableRow>

          <View style={styles.avatar}>
            <Feather name="message-circle" size={18} color={colors.primary} />
          </View>

          <PressableRow style={styles.headerInfo} onPress={() => { const jid = jobIdParam || (messages[0] as any)?.jobId; if (jid) { router.push(`/job/${jid}` as any); } }} >
            <Text style={styles.headerName} numberOfLines={1}>{clientName}</Text>
            <Text style={styles.headerPhone}>{clientPhone}</Text>
          </PressableRow>

          {clientPhone ? (
            <PressableRow onPress={() => Linking.openURL(`tel:${clientPhone}`)} style={styles.callButton} >
              <Feather name="phone" size={16} color={colors.success} />
            </PressableRow>
          ) : null}
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messagesArea}
          contentContainerStyle={styles.messagesContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Feather name="message-circle" size={24} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>Send an SMS to start the conversation</Text>
            </View>
          ) : (
            messages.map((msg, index) => {
              const isOutbound = msg.direction === 'outbound';
              const msgDate = new Date(msg.createdAt).toDateString();
              const prevDate = index > 0 ? new Date(messages[index - 1].createdAt).toDateString() : null;
              const showDateSep = index === 0 || msgDate !== prevDate;

              const prevMsg = index > 0 ? messages[index - 1] : null;
              const isMine = isOutbound && !!user?.id && msg.senderUserId === user.id;
              // Outbound: my own messages use the app blue; teammates use their chosen
              // colour. Inbound (the client) keeps the neutral bubble.
              const senderColor = isOutbound
                ? (isMine ? colors.primary : (msg.senderUserId ? memberColorFor(memberColors, msg.senderUserId) : null))
                : null;
              const showSenderLabel =
                isOutbound &&
                (isMine || !!msg.senderName) &&
                (!prevMsg ||
                  prevMsg.direction !== 'outbound' ||
                  prevMsg.senderUserId !== msg.senderUserId);

              return (
                <View key={msg.id}>
                  {showDateSep && (
                    <View style={styles.dateSeparator}>
                      <Text style={styles.dateSeparatorPill}>
                        {new Date(msg.createdAt).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  )}
                  {showSenderLabel && (
                    <Text
                      style={{
                        alignSelf: 'flex-end',
                        fontSize: typography.sizes.xs,
                        fontWeight: fontWeights.semibold,
                        color: senderColor || colors.mutedForeground,
                        marginRight: spacing.sm,
                        marginBottom: 2,
                      }}
                    >
                      {isMine ? 'You' : msg.senderName}
                    </Text>
                  )}
                  <View style={[styles.messageRow, isOutbound ? styles.messageRowOutbound : styles.messageRowInbound]}>
                    <View
                      style={[
                        styles.bubble,
                        isOutbound ? styles.bubbleOutbound : styles.bubbleInbound,
                        isOutbound && senderColor ? { backgroundColor: senderColor } : null,
                      ]}
                    >
                      {msg.mediaUrls && Array.isArray(msg.mediaUrls) && msg.mediaUrls.length > 0 && (
                        <View style={{ marginBottom: msg.body ? 6 : 0 }}>
                          {msg.mediaUrls.map((url: string, i: number) => (
                            <PressableRow key={`media-${i}`} onPress={() => Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open image'))} >
                              <Image
                                source={{ uri: url }}
                                style={{ width: 200, height: 200, borderRadius: 8, marginBottom: i < (msg.mediaUrls?.length ?? 0) - 1 ? 4 : 0 }}
                                resizeMode="cover"
                              />
                            </PressableRow>
                          ))}
                        </View>
                      )}
                      {msg.body ? (
                        <Text style={[styles.bubbleText, isOutbound ? styles.bubbleTextOutbound : styles.bubbleTextInbound]}>
                          {renderMessageBody(decodeHtmlEntities(msg.body), isOutbound)}
                        </Text>
                      ) : null}
                      <Text style={[styles.bubbleTime, isOutbound ? styles.bubbleTimeOutbound : styles.bubbleTimeInbound]}>
                        {formatTime(msg.createdAt)}
                      </Text>
                    </View>
                    {isOutbound && msg.status && (
                      <View style={styles.statusRow}>
                        <Feather 
                          name={msg.status === 'delivered' ? 'check-circle' : msg.status === 'failed' ? 'alert-circle' : 'check'} 
                          size={10} 
                          color={msg.status === 'delivered' ? colors.success : msg.status === 'failed' ? colors.destructive : colors.mutedForeground} 
                        />
                        <Text style={[styles.statusText, msg.status === 'delivered' && styles.statusDelivered]}>
                          {msg.status === 'sent' ? 'Sent' : msg.status === 'delivered' ? 'Delivered' : msg.status === 'failed' ? 'Failed' : msg.status}
                        </Text>
                      </View>
                    )}
                  </View>
                  {isOutbound && msg.status === 'failed' && msg.errorMessage && (
                    isDedicatedNumberReason(msg.errorMessage) ? (
                      <PressableRow
                        onPress={() => router.push('/more/phone-numbers' as any)}
                        style={{ alignSelf: 'flex-end', marginTop: 2, maxWidth: '80%' }}
                      >
                        <Text style={{ fontSize: 11, color: colors.destructive, textAlign: 'right' }}>
                          Not sent — no business number.{' '}
                          <Text style={{ textDecorationLine: 'underline', fontWeight: '600' }}>Get a business number</Text>
                        </Text>
                      </PressableRow>
                    ) : (
                      <Text style={{ fontSize: 11, color: colors.destructive, alignSelf: 'flex-end', marginTop: 2, maxWidth: '80%', textAlign: 'right' }}>
                        Not sent — {msg.errorMessage}
                      </Text>
                    )
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Composer */}
        <View style={styles.composerWrap}>
          {showQuickReplies && (
            <View style={styles.quickRepliesRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRepliesScroll}>
                {quickReplies.map((template) => (
                  <PressableRow key={template.id} style={styles.quickChip} onPress={() => { setMessageText(template.message); setShowQuickReplies(false); }} onLongPress={() => { Alert.alert(template.label, template.message, [ { text: 'Edit first', onPress: () => { setMessageText(template.message); setShowQuickReplies(false); }}, { text: 'Send now', onPress: async () => { setShowQuickReplies(false); setMessageText(template.message); setIsSending(true); try { const quickRes = await api.post('/api/sms/send', { clientPhone, message: template.message, conversationId: id }); if (quickRes.error) { if (!handleDedicatedNumberError(quickRes)) Alert.alert('Error', 'Failed to send SMS.'); } else { setMessageText(''); await loadMessages(); scrollRef.current?.scrollToEnd({ animated: true }); } } catch { Alert.alert('Error', 'Failed to send SMS.'); } finally { setIsSending(false); } }}, { text: 'Cancel', style: 'cancel' }, ]); }} >
                    <Feather name={template.icon} size={12} color={colors.primary} />
                    <Text style={styles.quickChipText}>{template.label}</Text>
                  </PressableRow>
                ))}
                <PressableRow key="edit-templates" style={styles.quickChip} onPress={() => router.push('/more/business-templates?tab=sms' as any)}>
                  <Feather name="edit-2" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.quickChipText, { color: colors.mutedForeground }]}>Edit templates</Text>
                </PressableRow>
              </ScrollView>
            </View>
          )}

          <View style={styles.composerInner}>
            <PressableRow style={styles.zapButton} onPress={() => setShowQuickReplies(!showQuickReplies)} >
              <Feather name="zap" size={18} color={showQuickReplies ? colors.primary : colors.mutedForeground} />
            </PressableRow>

            {id ? (
              <PressableRow style={styles.zapButton} onPress={() => { const jobId = jobIdParam || (messages[0] as any)?.jobId; if (jobId) router.push(`/job/${jobId}` as any); else Alert.alert('No Job Linked', 'This conversation is not linked to a specific job.'); }} >
                <Feather name="file-text" size={18} color={colors.mutedForeground} />
              </PressableRow>
            ) : null}

            <View style={styles.inputWrap}>
              <TextInput
                style={styles.textInput}
                placeholder="Type an SMS..."
                placeholderTextColor={colors.mutedForeground}
                value={messageText}
                onChangeText={setMessageText}
                multiline
                returnKeyType="default"
              />
              {smsInfo.chars > 0 && (
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                    paddingHorizontal: spacing.md,
                    paddingBottom: 4,
                    gap: 6,
                  }}
                  pointerEvents="none"
                >
                  <Text
                    style={{
                      fontSize: typography.sizes.xs,
                      fontWeight: fontWeights.semibold,
                      color:
                        smsInfo.segments >= 3
                          ? '#ef4444'
                          : smsInfo.segments === 2
                            ? '#f59e0b'
                            : colors.mutedForeground,
                    }}
                  >
                    {smsInfo.chars} chars · {smsInfo.segments} segment{smsInfo.segments === 1 ? '' : 's'}
                    {smsInfo.encoding === 'UCS-2' ? ' (Unicode)' : ''}
                  </Text>
                </View>
              )}
            </View>

            <PressableRow style={[styles.sendBtn, (!messageText.trim() || isSending) && styles.sendBtnDisabled]} onPress={handleSend} disabled={!messageText.trim() || isSending} >
              {isSending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Feather name="send" size={16} color={messageText.trim() ? colors.primaryForeground : colors.mutedForeground} />
              )}
            </PressableRow>
          </View>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
