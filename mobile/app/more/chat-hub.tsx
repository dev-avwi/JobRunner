import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { useActionSheet } from '../../src/components/ui/ActionSheet';
import { Stack, router, useFocusEffect } from 'expo-router';
import { asHref } from '../../src/lib/nav';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes, componentStyles, fontWeights } from '../../src/lib/design-tokens';
import api, { API_URL } from '../../src/lib/api';
import { handleDedicatedNumberError, showGetNumberPrompt } from '../../src/lib/smsGate';
import { useAuthStore } from '../../src/lib/store';
import { useUserRole } from '../../src/hooks/use-user-role';
import { TeamAvatar } from '../../src/components/TeamAvatar';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
}

interface Job {
  id: string;
  title: string;
  status: string;
  address?: string;
  clientId?: string;
  client?: Client;
  assignedTo?: string;
}

interface SmsMessage {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  body: string;
  status: string;
  createdAt: string;
  fromNumber?: string;
  toNumber?: string;
}

interface SmsConversation {
  id: string;
  clientId: string | null;
  clientPhone: string;
  clientName: string | null;
  jobId: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  messages?: SmsMessage[];
}

interface UnreadCounts {
  teamChat: number;
  directMessages: number;
  jobChats: number;
  sms: number;
  total: number;
}

interface TwilioStatus {
  enabled: boolean;
  configured?: boolean;
  connected?: boolean;
  hasPhoneNumber?: boolean;
  hasDedicatedNumber?: boolean;
  phoneNumber: string | null;
}

interface DirectMessageConversation {
  otherUser: {
    id: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    profileImageUrl?: string | null;
  };
  lastMessage?: {
    id: string;
    senderId: string;
    recipientId: string;
    content: string;
    createdAt: string;
  };
  unreadCount: number;
}

interface TeamMember {
  id: string;
  userId: string;
  memberId?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
  phone?: string | null;
  role: string;
  profileImageUrl?: string | null;
  status?: string;
  inviteStatus?: string;
}

const formatPhoneDisplay = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('61') && digits.length === 11) {
    const local = '0' + digits.slice(2);
    return `${local.slice(0,4)} ${local.slice(4,7)} ${local.slice(7)}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `${digits.slice(0,4)} ${digits.slice(4,7)} ${digits.slice(7)}`;
  }
  return phone;
};

interface ConversationItem {
  id: string;
  type: 'job' | 'jobchat' | 'team' | 'client' | 'sms' | 'direct' | 'member';
  title: string;
  subtitle?: string;
  avatarFallback: string;
  avatarImageUrl?: string | null;
  avatarUserId?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  status?: string;
  phone?: string;
  email?: string;
  data: any;
}

const SMS_QUICK_ACTIONS = [
  { id: 'omw', label: 'On my way', icon: 'navigation' as const, message: "G'day! Just letting you know I'm on my way now. Should be there in about 20 minutes." },
  { id: 'running-late', label: 'Running late', icon: 'clock' as const, message: "Apologies, I'm running a bit behind schedule. Will be there as soon as I can - should only be another 15-20 minutes." },
  { id: 'job-done', label: 'Job done', icon: 'check-circle' as const, message: "All done! The job's been completed. Let me know if you have any questions or need anything else." },
];

type FilterType = 'jobs' | 'jobchats' | 'team';

const JOB_STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
  { key: 'invoiced', label: 'Invoiced' },
];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingTop: pageShell.paddingTop,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    ...typography.largeTitle,
    color: colors.foreground,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    gap: spacing.sm,
    minHeight: sizes.quickActionBtn,
  },
  quickActionButtonPrimary: {
    backgroundColor: colors.primary,
  },
  quickActionButtonSecondary: {
    backgroundColor: colors.muted,
  },
  quickActionButtonSuccess: {
    backgroundColor: colors.success || '#22c55e',
  },
  quickActionText: {
    ...typography.button,
  },
  quickActionTextPrimary: {
    color: colors.primaryForeground,
  },
  quickActionTextSecondary: {
    color: colors.foreground,
  },
  quickActionTextSuccess: {
    color: colors.white,
  },
  searchContainer: {
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingBottom: spacing.md,
    marginTop: spacing.xs,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    borderRadius: radius['2xl'],
    height: sizes.searchBarHeight,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  searchTextInput: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
    letterSpacing: 0,
    textAlign: 'left',
    height: sizes.searchBarHeight,
    paddingVertical: 0,
    includeFontPadding: false,
  },
  filterContainer: {
    paddingBottom: 0,
    marginTop: spacing.sm,
    paddingHorizontal: pageShell.paddingHorizontal,
  },
  filterContainerContent: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
    minHeight: 46,
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary + '70',
  },
  filterButtonText: {
    ...typography.button,
    color: colors.mutedForeground,
  },
  filterButtonTextActive: {
    color: colors.primaryForeground,
  },
  filterBadge: {
    backgroundColor: colors.destructive || '#ef4444',
    minWidth: sizes.filterCountMin,
    height: sizes.filterCountMin,
    borderRadius: sizes.filterCountMin / 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filterBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.white,
  },
  subFilterContainer: {
    paddingHorizontal: pageShell.paddingHorizontal,
    marginTop: spacing.xs,
    maxHeight: 44,
    flexGrow: 0,
  },
  subFilterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
  },
  subFilterButtonActive: {
    backgroundColor: colors.muted,
  },
  subFilterText: {
    ...typography.caption,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  subFilterTextActive: {
    color: colors.foreground,
    fontWeight: fontWeights.semibold,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pageShell.paddingHorizontal,
    marginTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
  },
  sectionCount: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  conversationsList: {
    flex: 1,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: pageShell.paddingHorizontal,
    backgroundColor: 'transparent',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  conversationCardUnread: {
    backgroundColor: colors.primaryLight,
  },
  conversationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  conversationAvatarJob: {
    backgroundColor: colors.primaryLight,
  },
  conversationAvatarTeam: {
    backgroundColor: colors.infoLight,
  },
  conversationAvatarClient: {
    backgroundColor: colors.successLight,
  },
  conversationAvatarDirect: {
    backgroundColor: colors.infoLight,
  },
  conversationAvatarMember: {
    backgroundColor: colors.muted,
  },
  conversationAvatarText: {
    ...typography.button,
    color: colors.primary,
  },
  conversationAvatarTextTeam: {
    color: colors.info,
  },
  conversationAvatarTextClient: {
    color: colors.success,
  },
  conversationAvatarTextDirect: {
    color: colors.info,
  },
  conversationAvatarTextMember: {
    color: colors.foreground,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    gap: spacing.sm,
  },
  conversationTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    flex: 1,
    minWidth: 0,
  },
  conversationTitleUnread: {
    fontWeight: fontWeights.bold,
  },
  conversationTime: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  conversationSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.xs,
  },
  conversationLastMessage: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  conversationLastMessageUnread: {
    color: colors.foreground,
    fontWeight: fontWeights.medium,
  },
  conversationBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusBadgeText: {
    ...typography.badge,
    textTransform: 'uppercase',
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    minWidth: sizes.filterCountMin,
    height: sizes.filterCountMin,
    borderRadius: sizes.filterCountMin / 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    ...typography.badge,
    color: colors.primaryForeground,
  },
  contactActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  contactAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
    gap: spacing.xs,
  },
  contactActionText: {
    ...typography.captionSmall,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  chevronIcon: {
    marginLeft: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.xl,
  },
  emptyStateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyStateTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  twilioSetupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    marginHorizontal: pageShell.paddingHorizontal,
    marginBottom: spacing.md,
    marginTop: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  twilioSetupTitle: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  twilioSetupButton: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  twilioConnectedBanner: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    marginHorizontal: pageShell.paddingHorizontal,
    marginBottom: spacing.sm,
    marginTop: 0,
    padding: spacing.sm,
    borderRadius: radius['2xl'],
    gap: spacing.sm,
    ...shadows.sm,
  },
  twilioConnectedIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.xl,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  twilioConnectedText: {
    ...typography.caption,
    fontWeight: fontWeights.medium,
    color: colors.success,
    flex: 1,
  },
  smsConversationAvatar: {
    backgroundColor: colors.successLight,
  },
  smsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.successLight,
  },
  smsBadgeText: {
    ...typography.badge,
    color: colors.success,
  },
  quickActionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.warningLight,
  },
  quickActionBadgeText: {
    ...typography.badge,
    color: colors.warning,
  },
  smsLockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.muted,
  },
  smsLockedBadgeText: {
    ...typography.badge,
    color: colors.mutedForeground,
  },
  smsLockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: pageShell.paddingHorizontal,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  smsLockedNoticeText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
    lineHeight: 16,
  },
});

export default function ChatHubScreen() {
  const confirm = useConfirmDialog();
  const showActionSheet = useActionSheet();
  const { colors } = useTheme();
  const bottomInset = useBottomInset(40);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuthStore();
  const { isSubcontractor, teamMemberId } = useUserRole();
  
  const [activeFilter, setActiveFilter] = useState<FilterType>('jobs');
  const [jobStatusFilter, setJobStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const conversationsScrollRef = useRef<ScrollView>(null);
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [smsConversations, setSmsConversations] = useState<SmsConversation[]>([]);
  const [twilioStatus, setTwilioStatus] = useState<TwilioStatus | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts | null>(null);
  const [pendingChatCounts, setPendingChatCounts] = useState<Record<string, number>>({});
  const [dmConversations, setDmConversations] = useState<DirectMessageConversation[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [latestJobChats, setLatestJobChats] = useState<Map<string, { message: string; userId: string; createdAt: string | null; isSystemMessage: boolean | null }>>(new Map());

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [jobsRes, clientsRes, smsRes, twilioRes, unreadRes, dmRes, teamRes, latestChatsRes] = await Promise.all([
        api.get<Job[]>('/api/jobs').catch(() => ({ data: [] as Job[], error: 'jobs' })),
        api.get<Client[]>('/api/clients').catch(() => ({ data: [] as Client[], error: 'clients' })),
        api.get<SmsConversation[]>('/api/sms/conversations').catch(() => ({ data: [] as SmsConversation[], error: 'sms' })),
        api.get<TwilioStatus>('/api/sms/status').catch(() => ({ data: null })),
        api.get<UnreadCounts>('/api/chat/unread-counts').catch(() => ({ data: null })),
        api.get<DirectMessageConversation[]>('/api/direct-messages/conversations').catch(() => ({ data: [] as DirectMessageConversation[], error: 'dm' })),
        api.get<TeamMember[]>('/api/team/members').catch(() => ({ data: [] as TeamMember[] })),
        api.get<any[]>('/api/jobs/chat/latest').catch(() => ({ data: [] as any[] })),
      ]);
      const allJobs = Array.isArray(jobsRes.data) ? jobsRes.data : [];
      setJobs(isSubcontractor && user?.id ? allJobs.filter(j => j.assignedTo === user.id || (teamMemberId && j.assignedTo === teamMemberId)) : allJobs);
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
      setSmsConversations(Array.isArray(smsRes.data) ? smsRes.data : []);
      setTwilioStatus(twilioRes.data && !('error' in twilioRes) ? twilioRes.data : null);
      setUnreadCounts(unreadRes.data && !('error' in unreadRes) ? unreadRes.data : null);
      setDmConversations(Array.isArray(dmRes.data) ? dmRes.data : []);
      setTeamMembers(Array.isArray(teamRes.data) ? teamRes.data : []);
      const chatMap = new Map<string, { message: string; userId: string; createdAt: string | null; isSystemMessage: boolean | null }>();
      const latestChatsData = Array.isArray(latestChatsRes.data) ? latestChatsRes.data : [];
      latestChatsData.forEach((c: any) => chatMap.set(c.jobId, c));
      setLatestJobChats(chatMap);
      try {
        const { offlineStorage } = await import('@/lib/offline-storage');
        const pending = await offlineStorage.getAllPendingChatCounts();
        setPendingChatCounts(pending || {});
      } catch {}
    } catch (error) {
      console.error('Error loading data:', error);
      setLoadError('Could not load conversations. Pull down to retry.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getClientName = (clientId?: string) => {
    if (!clientId) return null;
    const client = clients.find(c => c.id === clientId);
    if (!client) return null;
    return `${client.firstName || ''} ${client.lastName || ''}`.trim() || null;
  };

  const getClient = (clientId?: string) => {
    if (!clientId) return null;
    return clients.find(c => c.id === clientId) || null;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return { bg: colors.muted, text: colors.mutedForeground };
      case 'scheduled': return { bg: colors.infoLight, text: colors.info };
      case 'in_progress': return { bg: colors.warningLight, text: colors.warning };
      case 'done': return { bg: colors.successLight, text: colors.success };
      case 'invoiced': return { bg: colors.primaryLight, text: colors.primary };
      default: return { bg: colors.muted, text: colors.mutedForeground };
    }
  };

  const getUserDisplayName = (user: { firstName?: string | null; lastName?: string | null; email?: string | null; name?: string }) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    if (user.name) return user.name;
    return user.email || 'Unknown';
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Only treat SMS as connected when the business has its OWN dedicated number.
  // The shared platform number is never a valid business sender.
  const twilioConnected = twilioStatus?.hasDedicatedNumber === true || (!!twilioStatus?.phoneNumber && twilioStatus?.hasPhoneNumber === true);

  const jobSmsMap = useMemo(() => {
    const byJobId = new Map<string, SmsConversation>();
    const byClientId = new Map<string, SmsConversation[]>();
    smsConversations.forEach(sms => {
      if (sms.jobId) byJobId.set(sms.jobId, sms);
      if (sms.clientId) {
        const existing = byClientId.get(sms.clientId) || [];
        existing.push(sms);
        byClientId.set(sms.clientId, existing);
      }
    });
    return { byJobId, byClientId };
  }, [smsConversations]);

  const clientsWithJobs = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach(job => { if (job.clientId) set.add(job.clientId); });
    return set;
  }, [jobs]);

  // Unread SMS across conversations tied to a job (the "Clients" tab signal).
  const clientsUnreadCount = useMemo(() => {
    return smsConversations
      .filter(sms => sms.jobId || (sms.clientId && clientsWithJobs.has(sms.clientId)))
      .reduce((sum, sms) => sum + (sms.unreadCount || 0), 0);
  }, [smsConversations, clientsWithJobs]);

  const isAcceptedMember = (m: TeamMember) => m.inviteStatus === 'accepted' || m.status === 'accepted';

  const conversations: ConversationItem[] = useMemo(() => {
    const items: ConversationItem[] = [];
    
    if (activeFilter === 'jobs') {
      let filteredJobs = jobs;
      if (jobStatusFilter !== 'all') {
        filteredJobs = jobs.filter(job => job.status === jobStatusFilter);
      }

      const usedSmsConversationIds = new Set<string>();
      jobSmsMap.byJobId.forEach(sms => usedSmsConversationIds.add(sms.id));
      const clientsWithSmsAssigned = new Set<string>();
      jobSmsMap.byJobId.forEach((sms, jobId) => {
        const job = jobs.find(j => j.id === jobId);
        if (job?.clientId) clientsWithSmsAssigned.add(job.clientId);
      });
      
      filteredJobs.forEach(job => {
        const clientName = getClientName(job.clientId);

        const directSms = jobSmsMap.byJobId.get(job.id);
        let clientSms: SmsConversation | undefined;
        if (!directSms && job.clientId && !clientsWithSmsAssigned.has(job.clientId)) {
          const clientConvos = jobSmsMap.byClientId.get(job.clientId) || [];
          clientSms = clientConvos.find(sms => !usedSmsConversationIds.has(sms.id));
        }
        const linkedSms = directSms || clientSms || null;
        if (linkedSms) {
          if (!directSms) usedSmsConversationIds.add(linkedSms.id);
          if (job.clientId) clientsWithSmsAssigned.add(job.clientId);
        }

        const smsUnread = linkedSms?.unreadCount || 0;

        let lastMessage = 'No messages yet';
        let lastMessageTime: string | undefined = linkedSms?.lastMessageAt || undefined;
        
        const smsTime = linkedSms?.lastMessageAt ? new Date(linkedSms.lastMessageAt).getTime() : 0;
        const latestChat = latestJobChats.get(job.id);
        const chatTime = latestChat?.createdAt ? new Date(latestChat.createdAt).getTime() : 0;
        
        if (chatTime > smsTime && latestChat) {
          const prefix = latestChat.isSystemMessage ? '' : 'Note: ';
          lastMessage = prefix + latestChat.message;
          lastMessageTime = latestChat.createdAt || undefined;
        } else if (linkedSms?.messages && linkedSms.messages.length > 0) {
          const lastMsg = linkedSms.messages[linkedSms.messages.length - 1];
          lastMessage = (lastMsg.direction === 'outbound' ? 'You: ' : '') + lastMsg.body;
        } else if (latestChat) {
          const prefix = latestChat.isSystemMessage ? '' : 'Note: ';
          lastMessage = prefix + latestChat.message;
          lastMessageTime = latestChat.createdAt || undefined;
        } else if (clientName) {
          lastMessage = `${clientName} - ${(job.status || 'pending').replace('_', ' ')}`;
        }

        items.push({
          id: `job-${job.id}`,
          type: 'job',
          title: job.title,
          subtitle: clientName || job.address || 'No client assigned',
          avatarFallback: job.title.substring(0, 2).toUpperCase(),
          lastMessage,
          lastMessageTime,
          unreadCount: smsUnread,
          status: job.status,
          data: { ...job, linkedSms },
        });
      });
    }
    
    if (activeFilter === 'jobchats') {
      // Internal team chat for each job (workers only see jobs assigned to them,
      // which `jobs` is already filtered to above).
      jobs.forEach(job => {
        const clientName = getClientName(job.clientId);
        const latestChat = latestJobChats.get(job.id);
        let lastMessage = 'Tap to open team job chat';
        let lastMessageTime: string | undefined;
        if (latestChat) {
          const prefix = latestChat.isSystemMessage ? '' : 'Note: ';
          lastMessage = prefix + latestChat.message;
          lastMessageTime = latestChat.createdAt || undefined;
        }
        items.push({
          id: `jobchat-${job.id}`,
          type: 'jobchat',
          title: job.title,
          subtitle: clientName || job.address || 'Team job chat',
          avatarFallback: job.title.substring(0, 2).toUpperCase(),
          lastMessage,
          lastMessageTime,
          unreadCount: pendingChatCounts[`job:${job.id}`] || 0,
          status: job.status,
          data: job,
        });
      });
    }
    
    if (activeFilter === 'team') {
      items.push({
        id: 'team-chat',
        type: 'team',
        title: 'Team Chat',
        subtitle: 'General team discussion',
        avatarFallback: 'TC',
        lastMessage: 'Tap to join team chat',
        unreadCount: (unreadCounts?.teamChat || 0) + Object.entries(pendingChatCounts).filter(([k]) => k.startsWith('team:')).reduce((sum, [, v]) => sum + v, 0),
        data: null,
      });

      dmConversations.forEach(dm => {
        const name = getUserDisplayName(dm.otherUser);
        items.push({
          id: `dm-${dm.otherUser.id}`,
          type: 'direct',
          title: name,
          subtitle: dm.otherUser.email || undefined,
          avatarFallback: getInitials(name),
          avatarImageUrl: dm.otherUser.profileImageUrl,
          avatarUserId: String(dm.otherUser.id),
          lastMessage: dm.lastMessage?.content || 'No messages yet',
          lastMessageTime: dm.lastMessage?.createdAt || undefined,
          unreadCount: (dm.unreadCount || 0) + (pendingChatCounts[`direct:${dm.otherUser.id}`] || 0),
          data: dm,
        });
      });

      const existingDmUserIds = new Set(dmConversations.map(dm => dm.otherUser.id));
      teamMembers.filter(isAcceptedMember).forEach(member => {
        const memberUserId = member.userId || member.memberId || member.id;
        if (existingDmUserIds.has(memberUserId)) return;
        if (existingDmUserIds.has(member.id)) return;

        const name = getUserDisplayName(member);
        items.push({
          id: `member-${member.id}`,
          type: 'member',
          title: name,
          subtitle: member.email || member.role || undefined,
          avatarFallback: getInitials(name),
          avatarImageUrl: member.profileImageUrl,
          avatarUserId: String(member.userId || member.memberId || member.id),
          lastMessage: 'Tap to start a conversation',
          unreadCount: 0,
          data: member,
        });
      });
    }

    items.sort((a, b) => {
      if ((a.type as string) === 'team') return -1;
      if ((b.type as string) === 'team') return 1;

      if ((a.type as string) === 'direct' && (b.type as string) !== 'direct' && (b.type as string) !== 'team') return -1;
      if ((b.type as string) === 'direct' && (a.type as string) !== 'direct' && (a.type as string) !== 'team') return 1;

      if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;

      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA;
    });
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return items.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.subtitle?.toLowerCase().includes(query)
      );
    }
    
    return items;
  }, [jobs, clients, smsConversations, dmConversations, teamMembers, activeFilter, searchQuery, unreadCounts, jobStatusFilter, latestJobChats, pendingChatCounts]);

  const handleQuickActionSend = async (item: ConversationItem, actionId: string) => {
    const template = SMS_QUICK_ACTIONS.find(a => a.id === actionId);
    if (!template) return;

    let phone: string | undefined;
    let clientId: string | undefined;
    let jobId: string | undefined;

    if (item.type === 'job') {
      const linkedSms = item.data?.linkedSms as SmsConversation | null;
      phone = linkedSms?.clientPhone || (item.data?.clientId ? getClient(item.data.clientId)?.phone : undefined) || undefined;
      clientId = linkedSms?.clientId || item.data?.clientId || undefined;
      jobId = item.data?.id;
    } else if (item.type === 'sms') {
      phone = item.phone || item.data?.clientPhone;
      clientId = item.data?.clientId || undefined;
      jobId = item.data?.jobId || undefined;
    }

    if (!phone) {
      Alert.alert('No Phone Number', 'This contact does not have a phone number for SMS.');
      return;
    }

    try {
      const response = await api.post('/api/sms/send', {
        clientPhone: phone,
        message: template.message,
        clientId,
        jobId,
      });
      if (response.error) {
        if (!handleDedicatedNumberError(response)) {
          Alert.alert('Error', 'Could not send SMS. Please try again.');
        }
      } else {
        Alert.alert('Sent', `"${template.label}" message sent successfully.`);
        handleRefresh();
        setTimeout(() => conversationsScrollRef.current?.scrollTo({ y: 0, animated: true }), 300);
      }
    } catch {
      Alert.alert('Error', 'Could not send SMS. Please try again.');
    }
  };

  const handleSendPhoto = async (item: ConversationItem) => {
    let phone: string | undefined;
    let clientId: string | undefined;
    let jobId: string | undefined;

    if (item.type === 'job') {
      const linkedSms = item.data?.linkedSms as SmsConversation | null;
      phone = linkedSms?.clientPhone || (item.data?.clientId ? getClient(item.data.clientId)?.phone : undefined) || undefined;
      clientId = linkedSms?.clientId || item.data?.clientId || undefined;
      jobId = item.data?.id;
    } else if (item.type === 'sms') {
      phone = item.phone || item.data?.clientPhone;
      clientId = item.data?.clientId || undefined;
      jobId = item.data?.jobId || undefined;
    }

    if (!phone) {
      Alert.alert('No Phone Number', 'This contact does not have a phone number for SMS.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const uri = asset.uri;

    showActionSheet({
      title: 'Send Photo via MMS',
      message: 'Add a message to send with this photo?',
      actions: [
        {
          label: 'Send with message',
          icon: 'edit-3',
          onPress: () => {
            const promptFn = (Alert as { prompt?: (...args: unknown[]) => unknown }).prompt;
            if (typeof promptFn === 'function') {
              promptFn(
                'Message',
                'Enter a message to accompany the photo:',
                async (text: string) => {
                  await uploadAndSendMms(uri, phone!, text || 'Photo update', clientId, jobId);
                },
                'plain-text',
                "Here's a photo update for you.",
              );
            } else {
              uploadAndSendMms(uri, phone!, 'Photo update', clientId, jobId);
            }
          },
        },
        {
          label: 'Send photo only',
          icon: 'image',
          onPress: () => { uploadAndSendMms(uri, phone!, 'Photo update', clientId, jobId); },
        },
      ],
    });
  };

  const uploadAndSendMms = async (uri: string, phone: string, message: string, clientId?: string, jobId?: string) => {
    try {
      const token = await api.getToken();
      const uploadUrl = `${API_URL}/api/sms/upload-media`;
      const uploadType = FileSystem.FileSystemUploadType?.MULTIPART ?? 1;
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, uri, {
        httpMethod: 'POST',
        uploadType,
        fieldName: 'file',
        mimeType: 'image/jpeg',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (uploadResult.status !== 200) {
        Alert.alert('Upload Failed', 'Could not upload the photo. Please try again.');
        return;
      }

      const { url: mediaUrl } = JSON.parse(uploadResult.body);

      const response = await api.post('/api/sms/send', {
        clientPhone: phone,
        message,
        clientId,
        jobId,
        mediaUrls: [mediaUrl],
      });

      if (response.error) {
        if (!handleDedicatedNumberError(response)) {
          Alert.alert('Error', 'Photo uploaded but SMS failed to send.');
        }
      } else {
        Alert.alert('Sent', 'Photo message sent successfully via MMS.');
        handleRefresh();
        setTimeout(() => conversationsScrollRef.current?.scrollTo({ y: 0, animated: true }), 300);
      }
    } catch {
      Alert.alert('Error', 'Could not send photo message. Please try again.');
    }
  };

  const showQuickActions = (item: ConversationItem) => {
    showActionSheet({
      title: 'Quick SMS',
      message: 'Send a quick message:',
      layout: 'grid',
      gridColumns: 2,
      actions: [
        ...SMS_QUICK_ACTIONS.map(action => ({
          label: action.label,
          icon: action.icon,
          description: action.message,
          onPress: () => handleQuickActionSend(item, action.id),
        })),
        {
          label: 'Send Photo',
          icon: 'camera' as const,
          description: 'Snap or pick a photo to send via MMS',
          onPress: () => handleSendPhoto(item),
        },
      ],
    });
  };

  const smsLocked = twilioStatus !== null && !twilioConnected;

  const handleConversationPress = (item: ConversationItem) => {
    if (smsLocked && item.type === 'sms') {
      showGetNumberPrompt();
      return;
    }
    if (smsLocked && item.type === 'job') {
      Alert.alert(
        'No Business Number Set Up',
        'Client SMS messaging requires a business number. Opening the internal job notes instead.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Set Up Number',
            onPress: () => router.push(asHref('/more/phone-numbers')),
          },
          {
            text: 'Open Job Notes',
            onPress: () => {
              setActiveFilter('jobchats');
              router.push(`/job/chat?jobId=${item.data.id}` as any);
            },
          },
        ]
      );
      return;
    }
    if (item.type === 'team') {
      router.push('/more/team-chat');
    } else if (item.type === 'job') {
      const linkedSms = item.data?.linkedSms;
      if (linkedSms) {
        const smsClientName = linkedSms.clientName || getClientName(item.data?.clientId) || getClientName(linkedSms.clientId) || item.subtitle || item.title;
        router.push(`/more/sms-conversation?id=${linkedSms.id}&phone=${encodeURIComponent(linkedSms.clientPhone || '')}&name=${encodeURIComponent(smsClientName)}&jobId=${item.data.id}` as any);
      } else {
        router.push(`/job/chat?jobId=${item.data.id}` as any);
      }
    } else if (item.type === 'jobchat') {
      router.push(`/job/chat?jobId=${item.data.id}` as any);
    } else if (item.type === 'sms') {
      router.push(`/more/sms-conversation?id=${item.data.id}&phone=${encodeURIComponent(item.phone || '')}&name=${encodeURIComponent(item.title)}` as any);
    } else if (item.type === 'direct') {
      router.push(`/more/direct-messages?userId=${item.data.otherUser.id}` as any);
    } else if (item.type === 'member') {
      const memberUserId = item.data.userId || item.data.memberId || item.data.id;
      router.push(`/more/direct-messages?userId=${memberUserId}` as any);
    }
  };

  const handleSendSmsToClient = async (phone: string, clientName?: string, clientId?: string) => {
    const message = `Hi${clientName ? ` ${clientName}` : ''}, just reaching out regarding your service.`;
    try {
      const response = await api.post('/api/sms/send', {
        clientPhone: phone,
        message,
        clientId,
      });
      if (response.error) {
        if (handleDedicatedNumberError(response)) return;
        confirm({
          title: 'Send via SMS App?',
          message: 'Could not send directly. Would you like to open your messaging app instead?',
          confirmText: 'Open SMS App',
        }).then((ok) => {
          if (ok) Linking.openURL(`sms:${phone}`).catch(() => Alert.alert('Error', 'Could not open SMS app'));
        });
      } else {
        Alert.alert('SMS Sent', `Message sent to ${clientName || phone}`);
      }
    } catch {
      confirm({
        title: 'Send via SMS App?',
        message: 'Could not send directly. Would you like to open your messaging app instead?',
        confirmText: 'Open SMS App',
      }).then((ok) => {
        if (ok) Linking.openURL(`sms:${phone}`).catch(() => Alert.alert('Error', 'Could not open SMS app'));
      });
    }
  };

  const handleContactClient = (client: Client) => {
    const actions: { label: string; icon: 'phone' | 'message-square' | 'mail'; onPress: () => void }[] = [];
    if (client.phone) {
      actions.push({ label: 'Call', icon: 'phone', onPress: () => { Linking.openURL(`tel:${client.phone}`); } });
      actions.push({ label: 'SMS', icon: 'message-square', onPress: () => { handleSendSmsToClient(client.phone!, client.firstName, client.id); } });
    }
    if (client.email) {
      actions.push({ label: 'Email', icon: 'mail', onPress: () => { Linking.openURL(`mailto:${client.email}`); } });
    }
    showActionSheet({
      title: `Contact ${client.firstName || 'Client'}`,
      message: 'Choose how to contact:',
      actions,
    });
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-AU', { weekday: 'short' });
    }
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  };

  const getFilterUnreadCount = (filter: FilterType): number => {
    switch (filter) {
      case 'jobs':
        return clientsUnreadCount;
      case 'team':
        return (unreadCounts?.teamChat || 0) + (unreadCounts?.directMessages || 0);
      case 'jobchats':
        return (unreadCounts?.jobChats || 0) + Object.entries(pendingChatCounts)
          .filter(([k]) => k.startsWith('job:'))
          .reduce((sum, [, v]) => sum + v, 0);
      default:
        return 0;
    }
  };

  const renderConversation = (item: ConversationItem) => {
    const statusColor = item.status ? getStatusColor(item.status) : null;
    const client = item.type === 'job' && item.data?.clientId ? getClient(item.data.clientId) : null;
    const linkedSms = item.type === 'job' ? item.data?.linkedSms : null;
    
    return (
      <PressableRow key={item.id} style={[styles.conversationCard, item.unreadCount> 0 && styles.conversationCardUnread]} onPress={() => handleConversationPress(item)} onLongPress={() => { if (item.type === 'job' || item.type === 'sms') { showQuickActions(item); } }} >
        <View style={[
          styles.conversationAvatar,
          item.type === 'job' && styles.conversationAvatarJob,
          item.type === 'team' && styles.conversationAvatarTeam,
          item.type === 'client' && styles.conversationAvatarClient,
          item.type === 'sms' && styles.smsConversationAvatar,
          item.type === 'direct' && styles.conversationAvatarDirect,
          item.type === 'member' && styles.conversationAvatarMember,
        ]}>
          {item.type === 'job' ? (
            <Feather name="message-square" size={20} color={colors.primary} />
          ) : item.type === 'jobchat' ? (
            <Feather name="briefcase" size={20} color={colors.primary} />
          ) : item.type === 'team' ? (
            <Feather name="users" size={20} color={colors.info} />
          ) : item.type === 'sms' ? (
            <Feather name={smsLocked ? 'lock' : 'smartphone'} size={20} color={smsLocked ? colors.mutedForeground : colors.success} />
          ) : (item.type === 'direct' || item.type === 'member') ? (
            <TeamAvatar
              name={item.title}
              userId={item.avatarUserId}
              profileImageUrl={item.avatarImageUrl}
              size={40}
            />
          ) : (
            <Text style={[styles.conversationAvatarText, { color: colors.success }]}>
              {item.avatarFallback}
            </Text>
          )}
        </View>
        
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.conversationTitle, item.unreadCount > 0 && styles.conversationTitleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            {item.lastMessageTime && (
              <Text style={styles.conversationTime}>{formatTime(item.lastMessageTime)}</Text>
            )}
          </View>
          
          {item.subtitle && (
            <Text style={styles.conversationSubtitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
          )}

          {item.lastMessage && (
            <Text style={[styles.conversationLastMessage, item.unreadCount > 0 && styles.conversationLastMessageUnread]} numberOfLines={1}>
              {item.lastMessage}
            </Text>
          )}
          
          <View style={styles.conversationBadges}>
            {statusColor && (
              <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                <Text style={[styles.statusBadgeText, { color: statusColor.text }]}>
                  {item.status?.replace('_', ' ')}
                </Text>
              </View>
            )}
            {linkedSms && (
              <View style={styles.smsBadge}>
                <Feather name="smartphone" size={10} color={colors.success} />
                <Text style={styles.smsBadgeText}>SMS</Text>
              </View>
            )}
            {(item.type === 'job' || item.type === 'sms') && !smsLocked && (
              <PressableRow style={styles.quickActionBadge} onPress={(e) => { e.stopPropagation?.(); showQuickActions(item); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} >
                <Feather name="zap" size={10} color={colors.warning} />
                <Text style={styles.quickActionBadgeText}>Quick</Text>
              </PressableRow>
            )}
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
          
        </View>
        
        <Feather name="chevron-right" size={20} color={colors.mutedForeground} style={styles.chevronIcon} />
      </PressableRow>
    );
  };

  const renderTwilioBanner = () => {
    if (twilioStatus === null) return null;

    if (twilioConnected) {
      return (
        <PressableRow style={styles.twilioConnectedBanner} onPress={() => router.push(asHref('/more/phone-numbers'))} >
          <View style={styles.twilioConnectedIcon}>
            <Feather name="check" size={16} color={colors.white} />
          </View>
          <Text style={styles.twilioConnectedText}>
            {twilioStatus.phoneNumber ? formatPhoneDisplay(twilioStatus.phoneNumber) : 'SMS connected'}
          </Text>
          <Feather name="settings" size={16} color={colors.success} style={{ marginLeft: 'auto' }} />
        </PressableRow>
      );
    }

    return (
      <PressableRow style={styles.twilioSetupBanner} onPress={() => router.push(asHref('/more/phone-numbers'))}>
        <Feather name="phone-missed" size={13} color={colors.warning} />
        <Text style={styles.twilioSetupTitle} numberOfLines={1}>No business number set up</Text>
        <Text style={styles.twilioSetupButton}>Set Up →</Text>
      </PressableRow>
    );
  };

  const getEmptyStateMessage = () => {
    switch (activeFilter) {
      case 'jobchats':
        return {
          title: 'No job chats yet',
          text: 'Create a job to start an internal team chat for it. Workers see only their assigned jobs.',
          icon: 'message-circle' as const,
          iconColor: colors.success,
        };
      case 'team':
        return {
          title: 'No team conversations',
          text: 'Use Team Chat to coordinate with your crew, or start a direct message.',
          icon: 'users' as const,
          iconColor: colors.info,
        };
      case 'jobs':
      default:
        return {
          title: 'No job conversations yet',
          text: 'Create jobs to start job discussions and communicate with clients.',
          icon: 'briefcase' as const,
          iconColor: colors.primary,
        };
    }
  };

  const getSectionInfo = () => {
    switch (activeFilter) {
      case 'jobs': return { title: 'CLIENT CONVERSATIONS', icon: 'message-square' as const };
      case 'jobchats': return { title: 'TEAM JOB CHATS', icon: 'briefcase' as const };
      case 'team': return { title: 'TEAM & DIRECT MESSAGES', icon: 'users' as const };
      default: return { title: 'CONVERSATIONS', icon: 'message-circle' as const };
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.headerCard}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Chat Hub</Text>
            <Text style={styles.headerSubtitle}>Messages, SMS & team chat</Text>
          </View>
        </View>

        {renderTwilioBanner()}
        
        <View style={styles.quickActionsContainer}>
          <PressableRow style={[styles.quickActionButton, styles.quickActionButtonPrimary]} onPress={() => router.push('/more/team-chat')} >
            <Feather name="users" size={18} color={colors.primaryForeground} />
            <Text style={[styles.quickActionText, styles.quickActionTextPrimary]}>Team Chat</Text>
          </PressableRow>
          {!isSubcontractor && (
            <>
              <PressableRow style={[styles.quickActionButton, styles.quickActionButtonSuccess, smsLocked && { opacity: 0.6 }]} onPress={() => { if (smsLocked) { showGetNumberPrompt(); return; } router.push('/more/new-sms-conversation' as any); }} >
                <Feather name={smsLocked ? 'lock' : 'edit-3'} size={18} color={colors.white} />
                <Text style={[styles.quickActionText, styles.quickActionTextSuccess]}>New SMS</Text>
              </PressableRow>
              <PressableRow style={[styles.quickActionButton, styles.quickActionButtonSecondary]} onPress={() => router.push('/more/clients')} >
                <Feather name="user" size={18} color={colors.foreground} />
                <Text style={[styles.quickActionText, styles.quickActionTextSecondary]}>Clients</Text>
              </PressableRow>
            </>
          )}
        </View>
        
        <View style={styles.searchContainer}>
          <View style={styles.searchInput}>
            <Feather name="search" size={18} color={colors.mutedForeground} />
            <TextInput
              style={styles.searchTextInput}
              placeholder="Search conversations..."
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
        
        <View style={[styles.filterContainer, styles.filterContainerContent]}>
          {(isSubcontractor ? ['jobs', 'jobchats'] as FilterType[] : ['jobs', 'jobchats', 'team'] as FilterType[]).map((filter) => {
            const count = getFilterUnreadCount(filter);
            const isActive = activeFilter === filter;
            return (
              <PressableRow key={filter} style={[styles.filterButton, isActive && styles.filterButtonActive]} onPress={() => { setActiveFilter(filter); if (filter !== 'jobs') setJobStatusFilter('all'); }} >
                <Feather
                  name={filter === 'jobs' ? 'message-square' : filter === 'jobchats' ? 'briefcase' : 'users'}
                  size={14}
                  color={isActive ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text style={[
                  styles.filterButtonText,
                  isActive && styles.filterButtonTextActive
                ]}>
                  {filter === 'jobs' ? 'Clients' : filter === 'jobchats' ? 'Job Chats' : 'Team'}
                </Text>
                {count > 0 && (
                  <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                    <Text style={styles.filterBadgeText}>{count > 99 ? '99+' : count}</Text>
                  </View>
                )}
              </PressableRow>
            );
          })}
        </View>

        {activeFilter === 'jobs' && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.subFilterContainer}
            contentContainerStyle={{ gap: spacing.xs, flexDirection: 'row', alignItems: 'center' }}
          >
            {JOB_STATUS_FILTERS.map(sf => (
              <PressableRow key={sf.key} style={[ styles.subFilterButton, jobStatusFilter === sf.key && styles.subFilterButtonActive, ]} onPress={() => setJobStatusFilter(sf.key)} >
                <Text style={[
                  styles.subFilterText,
                  jobStatusFilter === sf.key && styles.subFilterTextActive,
                ]}>
                  {sf.label}
                </Text>
              </PressableRow>
            ))}
          </ScrollView>
        )}
        
        <ScrollView
          ref={conversationsScrollRef}
          style={styles.conversationsList}
          contentContainerStyle={{ paddingBottom: bottomInset }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : loadError ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIcon}>
                <Feather name="wifi-off" size={28} color={colors.destructive} />
              </View>
              <Text style={styles.emptyStateTitle}>Something went wrong</Text>
              <Text style={styles.emptyStateText}>{loadError}</Text>
            </View>
          ) : conversations.length === 0 ? (
            (() => {
              const emptyMsg = getEmptyStateMessage();
              return (
                <View style={styles.emptyState}>
                  <View style={styles.emptyStateIcon}>
                    <Feather name={emptyMsg.icon} size={28} color={emptyMsg.iconColor} />
                  </View>
                  <Text style={styles.emptyStateTitle}>
                    {emptyMsg.title}
                  </Text>
                  <Text style={styles.emptyStateText}>
                    {emptyMsg.text}
                  </Text>
                </View>
              );
            })()
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Feather name={getSectionInfo().icon} size={14} color={colors.mutedForeground} />
                  <Text style={styles.sectionTitle}>{getSectionInfo().title}</Text>
                </View>
                <Text style={styles.sectionCount}>{conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}</Text>
              </View>
              {conversations.map(renderConversation)}
              <View style={{ height: spacing['4xl'] * 2 + spacing.lg }} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
