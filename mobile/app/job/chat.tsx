import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import type { ReactElement } from 'react';
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
  Modal,
  Linking,
  Image,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { getAvatarColor as getAvatarColorUtil } from '../../src/lib/avatar-colors';
import { TeamAvatar } from '../../src/components/TeamAvatar';
import { spacing, radius, typography, fontWeights } from '../../src/lib/design-tokens';
import api from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';

interface JobChatMessage {
  id: string;
  jobId: string;
  userId: string;
  message: string;
  messageType?: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  isSystemMessage?: boolean;
  readBy?: string[];
  createdAt: string;
  senderName: string;
  senderAvatar?: string | null;
  senderId?: string;
  avatar?: string | null;
  sendStatus?: 'sending' | 'sent' | 'failed';
  localId?: string;
}

interface SmsMessage {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  status: string;
  createdAt: string;
  clientPhone?: string;
  clientName?: string;
  mediaUrls?: string[] | null;
}

interface Participant {
  id: string;
  name: string;
  role: string;
  avatar?: string | null;
}

interface Job {
  id: string;
  title: string;
  status: string;
  clientId?: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
}

interface JobPhoto {
  id: string;
  url: string;
  caption?: string;
}

interface Quote {
  id: string;
  number: string;
  total: number;
  status: string;
  clientName?: string;
  jobTitle?: string;
}

interface Invoice {
  id: string;
  number: string;
  total: number;
  status: string;
  clientName?: string;
  jobTitle?: string;
}

function getDocStatusColors(status: string, colors: ThemeColors): { bg: string; text: string } {
  const s = (status || '').toLowerCase();
  if (s === 'paid' || s === 'accepted' || s === 'approved') {
    return { bg: colors.successLight, text: colors.success };
  }
  if (s === 'sent' || s === 'pending' || s === 'viewed') {
    return { bg: colors.infoLight, text: colors.info };
  }
  if (s === 'overdue' || s === 'declined' || s === 'rejected' || s === 'cancelled') {
    return { bg: colors.destructiveLight, text: colors.destructive };
  }
  if (s === 'draft') {
    return { bg: colors.muted, text: colors.mutedForeground };
  }
  return { bg: colors.muted, text: colors.mutedForeground };
}

function getAvatarBg(name: string): string {
  return getAvatarColorUtil(name).bg;
}

function getAvatarFg(name: string): string {
  return getAvatarColorUtil(name).fg;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    zIndex: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.regular,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.success}12`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBadge: {
    backgroundColor: colors.primary + '10',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  messageBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  internalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.isDark ? colors.primary + '08' : colors.infoLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: spacing.sm,
  },
  internalBannerIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
  },
  internalBannerText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.isDark ? colors.info : colors.mutedForeground,
  },
  textClientBannerBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.isDark ? 'rgba(37,99,235,0.15)' : 'rgba(37,99,235,0.1)',
  },
  textClientBannerBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  contactClientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    gap: 4,
  },
  contactClientText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.primaryForeground,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  dateSeparatorLine: {
    position: 'absolute',
    top: '50%',
    left: spacing.xl,
    right: spacing.xl,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dateSeparatorPill: {
    backgroundColor: colors.isDark ? colors.muted : colors.card,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dateSeparatorText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: spacing['2xl'],
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyText: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptySubtext: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.regular,
    color: colors.mutedForeground,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xl,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  emptyHintText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  systemMessage: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginVertical: spacing.xs,
  },
  systemMessagePill: {
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  systemMessageText: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.regular,
    color: colors.mutedForeground,
    fontStyle: 'italic',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingHorizontal: 2,
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  messageRowGroupStart: {
    marginTop: spacing.md,
  },
  avatarContainer: {
    width: 32,
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.white,
  },
  avatarSpacer: {
    width: 32,
    marginRight: 8,
  },
  messageBubbleWrapper: {
    maxWidth: '78%',
  },
  messageSender: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    marginBottom: 3,
    marginLeft: 4,
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  messageBubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.medium,
    lineHeight: 21,
  },
  messageTextOwn: {
    color: colors.primaryForeground,
  },
  messageTextOther: {
    color: colors.foreground,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
    marginTop: 3,
  },
  messageTime: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.regular,
  },
  messageTimeOwn: {
    color: 'rgba(255,255,255,0.6)',
  },
  messageTimeOther: {
    color: colors.mutedForeground,
  },
  attachmentPreview: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: radius.md,
  },
  attachmentDoc: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.md,
    gap: 6,
    marginTop: 6,
  },
  attachmentDocText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.medium,
  },
  smsBubbleOwn: {
    backgroundColor: '#34b759',
    borderBottomRightRadius: 4,
  },
  smsBubbleOther: {
    backgroundColor: colors.isDark ? '#1a3a1a' : '#dcf8c6',
    borderBottomLeftRadius: 4,
  },
  smsTextOwn: {
    color: colors.white,
  },
  smsTextOther: {
    color: colors.isDark ? '#d4e8c0' : '#1c1e21',
  },
  smsTimeOwn: {
    color: 'rgba(255,255,255,0.6)',
  },
  smsTimeOther: {
    color: colors.isDark ? '#7aaa60' : '#65676b',
  },
  smsTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  smsTypeBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    letterSpacing: 0.3,
  },
  composerContainer: {
    paddingTop: 8,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  composerInputWrapper: {
    flex: 1,
    backgroundColor: colors.muted,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  composerInput: {
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.regular,
    color: colors.foreground,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  sendButtonDisabled: {
    opacity: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  modalCloseBtn: {
    padding: spacing.xs,
  },
  attachmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.md,
  },
  attachmentOption: {
    width: '30%',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
  },
  attachmentOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  attachmentOptionText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
    textAlign: 'center',
  },
  documentsList: {
    maxHeight: 400,
    paddingBottom: spacing.sm,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
    gap: 2,
  },
  documentTitle: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  documentMeta: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.bold,
    color: colors.foreground,
  },
  documentStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginTop: 2,
  },
  documentStatusText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  documentSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing['2xl'],
  },
  documentEmptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  documentEmptyText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    textAlign: 'center',
  },
  documentEmptySubtext: {
    fontSize: typography.button.fontSize,
    fontWeight: fontWeights.regular,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
});

export default function JobChatScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const scrollRef = useRef<ScrollView>(null);

  const [job, setJob] = useState<Job | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [messages, setMessages] = useState<JobChatMessage[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showAttachModal, setShowAttachModal] = useState(false);
  // Pixel widths — percentage widths collapse inside PressableRow on iOS
  const [attachGridWidth, setAttachGridWidth] = useState(0);
  const attachItemWidthStyle = useMemo(() => {
    if (!attachGridWidth) return { width: '30%' as const };
    const inner = attachGridWidth - spacing.md * 2; // grid padding
    return { width: Math.floor((inner - spacing.md * 2) / 3) };
  }, [attachGridWidth]);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [documentType, setDocumentType] = useState<'photos' | 'quotes' | 'invoices' | null>(null);
  const [jobPhotos, setJobPhotos] = useState<JobPhoto[]>([]);
  const [jobQuotes, setJobQuotes] = useState<Quote[]>([]);
  const [jobInvoices, setJobInvoices] = useState<Invoice[]>([]);
  const [smsMessages, setSmsMessages] = useState<SmsMessage[]>([]);
  const [smsConversation, setSmsConversation] = useState<any>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadMessages();
      loadSmsMessages();
    }, 5000);
    return () => clearInterval(interval);
  }, [jobId]);

  // Reconnect-replay: when the device comes back online, fetch immediately.
  useEffect(() => {
    let mounted = true;
    let unsub: (() => void) | null = null;
    let prevOnline = true;
    (async () => {
      const { useOfflineStore } = await import('@/lib/offline-storage');
      if (!mounted) return;
      prevOnline = useOfflineStore.getState().isOnline;
      unsub = useOfflineStore.subscribe((state) => {
        if (!prevOnline && state.isOnline) {
          loadMessages();
          loadSmsMessages();
        }
        prevOnline = state.isOnline;
      });
    })();
    return () => { mounted = false; if (unsub) unsub(); };
  }, [jobId]);

  const loadData = async () => {
    setIsLoading(true);
    await Promise.all([loadJob(), loadMessages(), loadParticipants(), loadSmsMessages()]);
    setIsLoading(false);
  };

  const loadJob = async () => {
    try {
      const response = await api.get<Job>(`/api/jobs/${jobId}`);
      if (response.data) {
        setJob(response.data);
        if (response.data.clientId) {
          loadClient(response.data.clientId);
        }
      }
    } catch (error) {
      console.error('Error loading job:', error);
    }
  };

  const loadClient = async (clientId: string) => {
    try {
      const response = await api.get<Client>(`/api/clients/${clientId}`);
      if (response.data) {
        setClient(response.data);
      }
    } catch (error) {
      console.error('Error loading client:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const { offlineStorage, useOfflineStore } = await import('@/lib/offline-storage');
      const isOnline = useOfflineStore.getState().isOnline;
      if (!isOnline) {
        const cached = await offlineStorage.getChatMessagesOffline('job', String(jobId), 200);
        setMessages(cached as any);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
        return;
      }
      const response = await api.get<JobChatMessage[]>(`/api/jobs/${jobId}/chat`);
      if (response.data) {
        offlineStorage.cacheChatMessages('job', String(jobId), response.data).catch(() => {});
        const pending = await offlineStorage.getPendingChatMessages('job', String(jobId));
        const serverIds = new Set(response.data.map((m: any) => String(m.id)));
        const merged = [...response.data, ...pending.filter((p: any) => !serverIds.has(String(p.id)))];
        setMessages(merged as any);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      try {
        const { offlineStorage } = await import('@/lib/offline-storage');
        const cached = await offlineStorage.getChatMessagesOffline('job', String(jobId), 200);
        if (cached.length > 0) setMessages(cached as any);
        else setMessages([]);
      } catch {
        setMessages([]);
      }
    }
  };

  const loadParticipants = async () => {
    try {
      const response = await api.get<{ participants: Participant[] }>(`/api/jobs/${jobId}/chat/participants`);
      if (response.data?.participants) {
        setParticipants(response.data.participants);
      }
    } catch (error) {
      console.error('Error loading participants:', error);
      setParticipants([]);
    }
  };

  const loadSmsMessages = async () => {
    try {
      const convosResponse = await api.get<any[]>('/api/sms/conversations');
      if (convosResponse.data) {
        const matchingConvo = convosResponse.data.find((c: any) => String(c.jobId) === String(jobId));
        if (matchingConvo) {
          setSmsConversation(matchingConvo);
          const msgsResponse = await api.get<any[]>(`/api/sms/conversations/${matchingConvo.id}/messages`);
          if (msgsResponse.data) {
            setSmsMessages(msgsResponse.data);
          }
        } else {
          setSmsConversation(null);
          setSmsMessages([]);
        }
      }
    } catch (error) {
      console.error('Error loading SMS messages:', error);
    }
  };

  const loadJobDocuments = async (type: 'photos' | 'quotes' | 'invoices') => {
    try {
      if (type === 'photos') {
        const response = await api.get<JobPhoto[]>(`/api/jobs/${jobId}/photos`);
        setJobPhotos(response.data || []);
      } else if (type === 'quotes') {
        const response = await api.get<Quote[]>(`/api/quotes?jobId=${jobId}`);
        setJobQuotes(response.data || []);
      } else if (type === 'invoices') {
        const response = await api.get<Invoice[]>(`/api/invoices?jobId=${jobId}`);
        setJobInvoices(response.data || []);
      }
    } catch (error) {
      console.error(`Error loading ${type}:`, error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadMessages(), loadSmsMessages()]);
    setRefreshing(false);
  };

  const handleSend = async () => {
    if (!messageText.trim() || isSending) return;

    setIsSending(true);
    const text = messageText.trim();
    try {
      const { offlineStorage, useOfflineStore } = await import('@/lib/offline-storage');
      const isOnline = useOfflineStore.getState().isOnline;
      if (!isOnline) {
        const optimistic = await offlineStorage.sendChatMessageOffline('job', String(jobId), text);
        setMessages(prev => [...prev, optimistic as any]);
        setMessageText('');
        scrollRef.current?.scrollToEnd({ animated: true });
        return;
      }
      const response = await api.post(`/api/jobs/${jobId}/chat`, {
        message: text,
        messageType: 'text',
      });
      if (response.error) throw new Error(response.error);
      setMessageText('');
      await loadMessages();
      scrollRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      try {
        const { offlineStorage } = await import('@/lib/offline-storage');
        const optimistic = await offlineStorage.sendChatMessageOffline('job', String(jobId), text);
        setMessages(prev => [...prev, optimistic as any]);
        setMessageText('');
      } catch {
        Alert.alert('Error', 'Failed to send message. Please try again.');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleAttachPhoto = async () => {
    setShowAttachModal(false);
    Alert.alert(
      'Add Photo',
      'To share photos in this discussion, please add them to the job\'s photo gallery first, then share from "Job Photos".',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Go to Job Photos', 
          onPress: () => router.push(`/job/${jobId}` as any) 
        }
      ]
    );
  };

  const handleTakePhoto = async () => {
    setShowAttachModal(false);
    Alert.alert(
      'Take Photo',
      'To share photos in this discussion, please add them to the job\'s photo gallery first, then share from "Job Photos".',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Go to Job', 
          onPress: () => router.push(`/job/${jobId}` as any) 
        }
      ]
    );
  };

  const handleShareDocument = async (type: 'photos' | 'quotes' | 'invoices') => {
    setShowAttachModal(false);
    setDocumentType(type);
    await loadJobDocuments(type);
    setShowDocumentsModal(true);
  };

  const handleSelectDocument = async (docType: string, docId: string, docName: string) => {
    setShowDocumentsModal(false);
    setIsSending(true);
    try {
      await api.post(`/api/jobs/${jobId}/chat`, {
        message: `Shared ${docType}: ${docName}`,
        messageType: docType.toLowerCase(),
        attachmentName: docName,
        attachmentUrl: docId,
      });
      await loadMessages();
      Alert.alert('Shared', `${docType} "${docName}" shared. Team members can tap to view.`);
    } catch (error) {
      Alert.alert('Error', `Failed to share ${docType}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleAttachmentTap = (msg: JobChatMessage) => {
    const docType = msg.messageType;
    const docId = msg.attachmentUrl;
    
    if (docType === 'quote' && docId) {
      router.push(`/more/quote/${docId}` as any);
    } else if (docType === 'invoice' && docId) {
      router.push(`/more/invoice/${docId}` as any);
    } else if (docType === 'photo' && docId) {
      router.push(`/job/${jobId}` as any);
    } else {
      router.push(`/job/${jobId}` as any);
    }
  };

  const handleContactClient = () => {
    if (!client) {
      Alert.alert('No Client', 'This job does not have an assigned client');
      return;
    }

    Alert.alert(
      `Contact ${client.firstName}`,
      'How would you like to contact the client?',
      [
        { text: 'Cancel', style: 'cancel' },
        client.phone ? { text: 'Call', onPress: () => Linking.openURL(`tel:${client.phone}`) } : null,
        client.phone ? { text: 'SMS', onPress: async () => {
          const message = `Hi ${client.firstName}, just reaching out regarding your job.`;
          try {
            const response = await api.post('/api/sms/send', {
              clientPhone: client.phone,
              message,
              clientId: client.id,
            });
            if (response.error) {
              Alert.alert(
                'Send via SMS App?',
                'Could not send directly. Would you like to open your messaging app instead?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Open SMS App',
                    onPress: () => {
                      const url = `sms:${client.phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;
                      Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open SMS app'));
                    },
                  },
                ]
              );
            } else {
              Alert.alert('SMS Sent', `Message sent to ${client.firstName}`);
            }
          } catch {
            Alert.alert(
              'Send via SMS App?',
              'Could not send directly. Would you like to open your messaging app instead?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Open SMS App',
                  onPress: () => {
                    const url = `sms:${client.phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;
                    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open SMS app'));
                  },
                },
              ]
            );
          }
        }} : null,
        client.email ? { text: 'Email', onPress: () => Linking.openURL(`mailto:${client.email}`) } : null,
      ].filter(Boolean) as any[]
    );
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDateSeparator = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString('en-AU', { weekday: 'long' });
    return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: diffDays > 365 ? 'numeric' : undefined });
  };

  const getDateKey = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isOwnMessage = (msg: JobChatMessage) => msg.userId === user?.id;

  const formatMessageText = (text: string): string => {
    return text.replace(/(https?:\/\/[^\s]+)/g, (url) => {
      try {
        const parsed = new URL(url);
        const host = parsed.hostname;
        if (host.includes('.replit.dev') || host.includes('.repl.co')) {
          return '[tracking link]';
        }
        const short = host.replace(/^www\./, '');
        if (short.length > 30) return short.substring(0, 25) + '.../';
        return short + parsed.pathname.substring(0, 15) + (parsed.pathname.length > 15 ? '...' : '');
      } catch {
        return url.length > 40 ? url.substring(0, 35) + '...' : url;
      }
    });
  };

  const allMessages = useMemo(() => {
    const combined: Array<{
      id: string;
      type: 'chat' | 'sms';
      message: string;
      senderName: string;
      createdAt: string;
      isOwn: boolean;
      isSystem?: boolean;
      direction?: 'inbound' | 'outbound';
      attachmentName?: string | null;
      attachmentUrl?: string | null;
      messageType?: string;
      mediaUrls?: string[];
      senderId?: string;
      avatar?: string | null;
      sendStatus?: 'sending' | 'sent' | 'failed';
      localId?: string;
      originalMessage: JobChatMessage | SmsMessage;
    }> = [];

    messages.forEach(msg => {
      combined.push({
        id: msg.id,
        type: 'chat',
        message: msg.message,
        senderName: msg.senderName,
        createdAt: msg.createdAt,
        isOwn: msg.userId === user?.id,
        isSystem: msg.isSystemMessage,
        attachmentName: msg.attachmentName,
        attachmentUrl: msg.attachmentUrl,
        messageType: msg.messageType,
        senderId: msg.userId,
        avatar: msg.senderAvatar,
        originalMessage: msg,
      });
    });

    smsMessages.forEach(sms => {
      combined.push({
        id: `sms-${sms.id}`,
        type: 'sms',
        message: sms.body,
        mediaUrls: sms.mediaUrls || [],
        senderName: sms.direction === 'inbound' ? (smsConversation?.clientName || smsConversation?.clientPhone || 'Client') : 'You (SMS)',
        createdAt: sms.createdAt,
        isOwn: sms.direction === 'outbound',
        direction: sms.direction,
        originalMessage: sms,
      });
    });

    return combined.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, smsMessages, user?.id, smsConversation]);

  const renderAttachment = (msg: JobChatMessage) => {
    if (!msg.attachmentName && !msg.attachmentUrl) return null;
    
    const isOwn = isOwnMessage(msg);
    const docName = msg.attachmentName || 'Document';
    const docType = msg.messageType || 'document';
    const hasLink = msg.attachmentUrl;
    
    return (
      <PressableRow style={styles.attachmentDoc} onPress={() => handleAttachmentTap(msg)} disabled={!hasLink} >
        <Feather 
          name={docType === 'quote' ? 'file-text' : docType === 'invoice' ? 'dollar-sign' : docType === 'photo' ? 'image' : 'file'} 
          size={14} 
          color={isOwn ? colors.primaryForeground : colors.foreground} 
        />
        <Text style={[styles.attachmentDocText, { color: isOwn ? colors.primaryForeground : colors.foreground }]}>
          {docName}
        </Text>
        {hasLink && (
          <Feather 
            name="external-link" 
            size={12} 
            color={isOwn ? colors.primaryForeground : colors.mutedForeground} 
          />
        )}
      </PressableRow>
    );
  };

  const renderMessages = () => {
    if (allMessages.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Feather name="message-circle" size={34} color={colors.primary} />
          </View>
          <Text style={styles.emptyText}>No team notes yet</Text>
          <Text style={styles.emptySubtext}>
            Add internal notes about this job — only your team can see these
          </Text>
          {client?.phone && (
            <PressableRow style={[styles.contactClientBtn, { marginTop: 12 }]} onPress={handleContactClient} >
              <Feather name="smartphone" size={14} color={colors.primaryForeground} />
              <Text style={[styles.contactClientText, { fontSize: typography.sizes.sm }]}>Text Client Instead</Text>
            </PressableRow>
          )}
          <View style={styles.emptyHint}>
            <Feather name="arrow-down" size={14} color={colors.mutedForeground} />
            <Text style={styles.emptyHintText}>Add a note below</Text>
          </View>
        </View>
      );
    }

    const elements: ReactElement[] = [];
    let lastDateKey = '';
    let lastSenderId = '';

    allMessages.forEach((msg, index) => {
      const currentDateKey = getDateKey(msg.createdAt);
      if (currentDateKey !== lastDateKey) {
        elements.push(
          <View key={`date-${currentDateKey}`} style={styles.dateSeparator}>
            <View style={styles.dateSeparatorLine} />
            <View style={styles.dateSeparatorPill}>
              <Text style={styles.dateSeparatorText}>{formatDateSeparator(msg.createdAt)}</Text>
            </View>
          </View>
        );
        lastDateKey = currentDateKey;
        lastSenderId = '';
      }

      if (msg.isSystem) {
        elements.push(
          <View key={msg.id} style={styles.systemMessage}>
            <View style={styles.systemMessagePill}>
              <Text style={styles.systemMessageText}>{msg.message}</Text>
            </View>
          </View>
        );
        lastSenderId = '';
        return;
      }

      const own = msg.isOwn;
      const isSms = msg.type === 'sms';
      const senderId = own ? '__own__' : msg.senderName;
      const isGroupStart = senderId !== lastSenderId;
      const showAvatar = !own && isGroupStart;
      lastSenderId = senderId;

      const bubbleStyle = isSms
        ? (own ? styles.smsBubbleOwn : styles.smsBubbleOther)
        : (own ? styles.messageBubbleOwn : styles.messageBubbleOther);

      const textStyle = isSms
        ? (own ? styles.smsTextOwn : styles.smsTextOther)
        : (own ? styles.messageTextOwn : styles.messageTextOther);

      const timeStyle = isSms
        ? (own ? styles.smsTimeOwn : styles.smsTimeOther)
        : (own ? styles.messageTimeOwn : styles.messageTimeOther);

      const badgeIconColor = isSms
        ? (own ? 'rgba(255,255,255,0.7)' : (colors.isDark ? '#7aaa60' : '#65676b'))
        : (own ? 'rgba(255,255,255,0.7)' : (colors.isDark ? '#8a8d91' : '#65676b'));

      elements.push(
        <View
          key={msg.id}
          style={[
            styles.messageRow,
            own ? styles.messageRowOwn : styles.messageRowOther,
            isGroupStart && styles.messageRowGroupStart,
          ]}
        >
          {!own && (
            showAvatar ? (
              <View style={styles.avatarContainer}>
                <TeamAvatar
                  name={msg.senderName}
                  userId={String(msg.senderId ?? '')}
                  profileImageUrl={msg.avatar ?? undefined}
                  size={32}
                />
              </View>
            ) : (
              <View style={styles.avatarSpacer} />
            )
          )}
          <View style={styles.messageBubbleWrapper}>
            {!own && isGroupStart && (
              <Text style={styles.messageSender}>{msg.senderName}</Text>
            )}
            <View style={[styles.messageBubble, bubbleStyle]}>
              {msg.mediaUrls && msg.mediaUrls.length > 0 && (
                <View style={{ marginBottom: msg.message ? 6 : 0 }}>
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
              {msg.message ? (
                <Text style={[styles.messageText, textStyle]}>
                  {isSms ? formatMessageText(msg.message) : msg.message}
                </Text>
              ) : null}
              {msg.type === 'chat' && renderAttachment(msg.originalMessage as JobChatMessage)}
              <View style={styles.messageFooter}>
                <Text style={[styles.messageTime, timeStyle]}>
                  {formatTime(msg.createdAt)}
                </Text>
                {isSms ? (
                  <View style={[styles.smsTypeBadge, own && { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                    <Feather name="smartphone" size={8} color={badgeIconColor} />
                    <Text style={[styles.smsTypeBadgeText, { color: badgeIconColor }]}>
                      SMS · CLIENT
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.smsTypeBadge, own && { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                    <Feather name="lock" size={8} color={badgeIconColor} />
                    <Text style={[styles.smsTypeBadgeText, { color: badgeIconColor }]}>
                      INTERNAL
                    </Text>
                  </View>
                )}
              </View>
              {msg.sendStatus === 'failed' && (
                <PressableRow onPress={async () => { const { offlineStorage } = await import('@/lib/offline-storage'); const ok = await offlineStorage.retryFailedChatMessage(msg.localId || msg.id); if (ok) loadMessages(); }} style={{ marginTop: 4 }} >
                  <Text style={{ color: colors.destructive, fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold }}>
                    Failed to send · tap to retry
                  </Text>
                </PressableRow>
              )}
            </View>
          </View>
        </View>
      );
    });

    return elements;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.headerCard}>
          <PressableRow style={styles.backButton} onPress={() => router.back()} >
            <Feather name="chevron-left" size={22} color={colors.foreground} />
          </PressableRow>
          <View style={styles.headerIconContainer}>
            <Feather name="lock" size={18} color={colors.primary} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle} numberOfLines={1}>{job?.title || 'Job Chat'}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>Internal team notes</Text>
          </View>
          <View style={styles.headerActions}>
            {allMessages.length > 0 && (
              <View style={styles.messageBadge}>
                <Text style={styles.messageBadgeText}>
                  {allMessages.length}
                </Text>
              </View>
            )}
            {client && (
              <PressableRow style={styles.headerActionBtn} onPress={handleContactClient}>
                <Feather name="phone" size={16} color={colors.success} />
              </PressableRow>
            )}
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          onContentSizeChange={() => {
            if (allMessages.length > 5) {
              scrollRef.current?.scrollToEnd({ animated: false });
            }
          }}
        >
          {renderMessages()}
        </ScrollView>

        <View style={[styles.composerContainer, { paddingBottom: spacing.lg + insets.bottom }]}>
          <View style={styles.composerRow}>
            <PressableRow style={styles.attachButton} onPress={() => setShowAttachModal(true)} >
              <Feather name="plus" size={20} color={colors.mutedForeground} />
            </PressableRow>
            <View style={styles.composerInputWrapper}>
              <TextInput
                style={styles.composerInput}
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Add a team note..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={1000}
              />
            </View>
            <PressableRow style={[styles.sendButton, (!messageText.trim() || isSending) && styles.sendButtonDisabled]} onPress={handleSend} disabled={!messageText.trim() || isSending} >
              {isSending ? (
                <ActivityIndicator size={16} color={colors.primaryForeground} />
              ) : (
                <Feather name="send" size={16} color={colors.primaryForeground} />
              )}
            </PressableRow>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showAttachModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttachModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowAttachModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share</Text>
              <PressableRow style={styles.modalCloseBtn} onPress={() => setShowAttachModal(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </PressableRow>
            </View>
            <View style={styles.attachmentGrid} onLayout={(e) => setAttachGridWidth(e.nativeEvent.layout.width)}>
              <PressableRow style={[styles.attachmentOption, attachItemWidthStyle]} onPress={handleTakePhoto}>
                <View style={[styles.attachmentOptionIcon, { backgroundColor: colors.primaryLight }]}>
                  <Feather name="camera" size={24} color={colors.primary} />
                </View>
                <Text style={styles.attachmentOptionText}>Camera</Text>
              </PressableRow>
              <PressableRow style={[styles.attachmentOption, attachItemWidthStyle]} onPress={handleAttachPhoto}>
                <View style={[styles.attachmentOptionIcon, { backgroundColor: colors.successLight }]}>
                  <Feather name="image" size={24} color={colors.success} />
                </View>
                <Text style={styles.attachmentOptionText}>Gallery</Text>
              </PressableRow>
              <PressableRow style={[styles.attachmentOption, attachItemWidthStyle]} onPress={() => handleShareDocument('photos')}>
                <View style={[styles.attachmentOptionIcon, { backgroundColor: colors.warningLight }]}>
                  <Feather name="folder" size={24} color={colors.warning} />
                </View>
                <Text style={styles.attachmentOptionText}>Job Photos</Text>
              </PressableRow>
              <PressableRow style={[styles.attachmentOption, attachItemWidthStyle]} onPress={() => handleShareDocument('quotes')}>
                <View style={[styles.attachmentOptionIcon, { backgroundColor: colors.infoLight }]}>
                  <Feather name="file-text" size={24} color={colors.info} />
                </View>
                <Text style={styles.attachmentOptionText}>Quotes</Text>
              </PressableRow>
              <PressableRow style={[styles.attachmentOption, attachItemWidthStyle]} onPress={() => handleShareDocument('invoices')}>
                <View style={[styles.attachmentOptionIcon, { backgroundColor: colors.destructiveLight }]}>
                  <Feather name="dollar-sign" size={24} color={colors.destructive} />
                </View>
                <Text style={styles.attachmentOptionText}>Invoices</Text>
              </PressableRow>
              <PressableRow style={[styles.attachmentOption, attachItemWidthStyle]} onPress={() => { setShowAttachModal(false); router.push(`/job/${jobId}` as any); }} >
                <View style={[styles.attachmentOptionIcon, { backgroundColor: colors.muted }]}>
                  <Feather name="briefcase" size={24} color={colors.mutedForeground} />
                </View>
                <Text style={styles.attachmentOptionText}>Job Details</Text>
              </PressableRow>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showDocumentsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDocumentsModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowDocumentsModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {documentType === 'photos' ? 'Select Photo' : 
                 documentType === 'quotes' ? 'Select Quote' : 'Select Invoice'}
              </Text>
              <PressableRow style={styles.modalCloseBtn} onPress={() => setShowDocumentsModal(false)}>
                <Feather name="x" size={24} color={colors.foreground} />
              </PressableRow>
            </View>
            <ScrollView style={styles.documentsList}>
              {documentType === 'photos' && jobPhotos.map((photo) => (
                <PressableRow key={photo.id} style={styles.documentItem} onPress={() => handleSelectDocument('Photo', photo.id, photo.caption || 'Job Photo')} >
                  <Image source={{ uri: photo.url }} style={{ width: 44, height: 44, borderRadius: radius.lg }} />
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentTitle}>{photo.caption || 'Job Photo'}</Text>
                  </View>
                  <View style={styles.documentSendBtn}>
                    <Feather name="send" size={16} color={colors.primary} />
                  </View>
                </PressableRow>
              ))}
              {documentType === 'quotes' && jobQuotes.map((quote) => {
                const statusColors = getDocStatusColors(quote.status, colors);
                return (
                  <PressableRow key={quote.id} style={styles.documentItem} onPress={() => handleSelectDocument('Quote', quote.id, quote.number || `Q-${quote.id.slice(0,6)}`)} >
                    <View style={[styles.documentIcon, { backgroundColor: colors.infoLight }]}>
                      <Feather name="file-text" size={20} color={colors.info} />
                    </View>
                    <View style={styles.documentInfo}>
                      <Text style={styles.documentTitle} numberOfLines={1}>{quote.number || `Quote #${quote.id.slice(0,6)}`}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Text style={styles.documentMeta}>${parseFloat(String(quote.total || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                        <View style={[styles.documentStatusBadge, { backgroundColor: statusColors.bg }]}>
                          <Text style={[styles.documentStatusText, { color: statusColors.text }]}>{(quote.status || '').toUpperCase()}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.documentSendBtn}>
                      <Feather name="send" size={14} color={colors.primary} />
                    </View>
                  </PressableRow>
                );
              })}
              {documentType === 'invoices' && jobInvoices.map((invoice) => {
                const statusColors = getDocStatusColors(invoice.status, colors);
                return (
                  <PressableRow key={invoice.id} style={styles.documentItem} onPress={() => handleSelectDocument('Invoice', invoice.id, invoice.number || `INV-${invoice.id.slice(0,6)}`)} >
                    <View style={[styles.documentIcon, { backgroundColor: colors.warningLight }]}>
                      <Feather name="dollar-sign" size={20} color={colors.warning} />
                    </View>
                    <View style={styles.documentInfo}>
                      <Text style={styles.documentTitle} numberOfLines={1}>{invoice.number || `Invoice #${invoice.id.slice(0,6)}`}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Text style={styles.documentMeta}>${parseFloat(String(invoice.total || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                        <View style={[styles.documentStatusBadge, { backgroundColor: statusColors.bg }]}>
                          <Text style={[styles.documentStatusText, { color: statusColors.text }]}>{(invoice.status || '').toUpperCase()}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.documentSendBtn}>
                      <Feather name="send" size={14} color={colors.primary} />
                    </View>
                  </PressableRow>
                );
              })}
              {((documentType === 'photos' && jobPhotos.length === 0) ||
                (documentType === 'quotes' && jobQuotes.length === 0) ||
                (documentType === 'invoices' && jobInvoices.length === 0)) && (
                <View style={styles.documentEmptyContainer}>
                  <View style={styles.documentEmptyIcon}>
                    <Feather 
                      name={documentType === 'photos' ? 'image' : documentType === 'quotes' ? 'file-text' : 'dollar-sign'} 
                      size={28} 
                      color={colors.mutedForeground} 
                    />
                  </View>
                  <Text style={styles.documentEmptyText}>
                    No {documentType === 'photos' ? 'photos' : documentType === 'quotes' ? 'quotes' : 'invoices'} found
                  </Text>
                  <Text style={styles.documentEmptySubtext}>
                    {documentType === 'photos' 
                      ? 'Add photos to this job to share them here' 
                      : documentType === 'quotes' 
                        ? 'Create a quote for this job to share it here' 
                        : 'Create an invoice for this job to share it here'}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
