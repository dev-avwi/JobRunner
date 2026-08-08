import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
  Image,
  Linking,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import api from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { TeamAvatar } from '../../src/components/TeamAvatar';
import { promptForAttachment, uploadChatAttachment, resolveAttachmentUrl } from '../../src/lib/chat-attachments';
import { typography, fontWeights } from '../../src/lib/design-tokens';

interface User {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
}

interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  attachmentUrl?: string | null;
  attachmentType?: string | null;
  isRead?: boolean;
  createdAt: string;
}

interface Conversation {
  otherUser: User;
  lastMessage?: DirectMessage;
  unreadCount: number;
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    height: 42,
    marginLeft: 10,
    fontSize: typography.sizes.md,
    color: colors.foreground,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: colors.primaryForeground,
    fontWeight: fontWeights.semibold,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    flex: 1,
  },
  conversationTime: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginLeft: 8,
  },
  conversationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conversationLastMessage: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    flex: 1,
  },
  memberEmail: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: colors.primaryForeground,
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
  },
  sectionDivider: {
    backgroundColor: colors.muted,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionDividerText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: 12,
  },
  chatHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatHeaderName: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  chatHeaderEmail: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  messageBubbleWrapper: {
    marginBottom: 12,
  },
  messageBubbleWrapperLeft: {
    alignItems: 'flex-start',
  },
  messageBubbleWrapperRight: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageBubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: colors.muted,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: typography.sizes.md,
    color: colors.foreground,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: colors.primaryForeground,
  },
  messageTime: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  readReceipt: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 2,
    gap: 3,
  },
  readReceiptText: {
    fontSize: typography.sizes.xs,
    color: 'rgba(255,255,255,0.6)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: typography.sizes.md,
    color: colors.foreground,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.muted,
  },
});

export default function DirectMessagesScreen() {
  const { colors } = useTheme();
  const bottomInset = useBottomInset(24);
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { user: currentUser } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [conversationsRes, teamRes] = await Promise.all([
        api.get<Conversation[]>('/api/direct-messages/conversations'),
        api.get<User[]>('/api/team/members')
      ]);
      setConversations(conversationsRes.data || []);
      setTeamMembers(teamRes.data || []);
    } catch (error) {
      if (__DEV__) console.log('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const getUserDisplayName = (user: User) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email || 'Unknown User';
  };

  const getInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email?.[0]?.toUpperCase() || '?';
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-AU', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    }
  };

  if (selectedUser) {
    return (
      <ChatView 
        selectedUser={selectedUser} 
        onBack={() => {
          setSelectedUser(null);
          fetchData();
        }}
        colors={colors}
        styles={styles}
        currentUser={currentUser}
      />
    );
  }

  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const name = getUserDisplayName(conv.otherUser).toLowerCase();
    const email = (conv.otherUser.email || '').toLowerCase();
    const term = searchQuery.toLowerCase();
    return name.includes(term) || email.includes(term);
  });

  const existingIds = new Set(conversations.map(c => c.otherUser.id));
  const availableNewContacts = teamMembers.filter(m => {
    if (existingIds.has(m.id)) return false;
    if (!searchQuery) return true;
    const name = getUserDisplayName(m).toLowerCase();
    const email = (m.email || '').toLowerCase();
    const term = searchQuery.toLowerCase();
    return name.includes(term) || email.includes(term);
  });

  return (
    <>
      <Stack.Screen options={{ title: 'Direct Messages' }} />
      
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <View style={styles.headerIconContainer}>
            <Feather name="message-square" size={24} color={colors.primary} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Direct Messages</Text>
            <Text style={styles.headerSubtitle}>
              {conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}
            </Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search team members..."
            placeholderTextColor={colors.mutedForeground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView 
          style={styles.listContainer}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset }]}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          {isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filteredConversations.length === 0 && availableNewContacts.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Feather name="users" size={48} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>No team members</Text>
              <Text style={styles.emptySubtitle}>Add team members first to start messaging</Text>
            </View>
          ) : (
            <>
              {filteredConversations.map((conversation) => (
                <PressableRow key={conversation.otherUser.id} style={styles.conversationItem} onPress={() => setSelectedUser(conversation.otherUser)} >
                  <TeamAvatar
                    firstName={conversation.otherUser.firstName ?? undefined}
                    lastName={conversation.otherUser.lastName ?? undefined}
                    email={conversation.otherUser.email || undefined}
                    userId={String(conversation.otherUser.id)}
                    profileImageUrl={conversation.otherUser.profileImageUrl ?? undefined}
                    size={44}
                  />
                  <View style={styles.conversationContent}>
                    <View style={styles.conversationHeader}>
                      <Text style={styles.conversationName} numberOfLines={1}>
                        {getUserDisplayName(conversation.otherUser)}
                      </Text>
                      {conversation.lastMessage && (
                        <Text style={styles.conversationTime}>
                          {formatTime(conversation.lastMessage.createdAt)}
                        </Text>
                      )}
                    </View>
                    <View style={styles.conversationPreview}>
                      <Text style={styles.conversationLastMessage} numberOfLines={1}>
                        {conversation.lastMessage?.content || 'No messages yet'}
                      </Text>
                      {conversation.unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>{conversation.unreadCount}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </PressableRow>
              ))}
              
              {availableNewContacts.length > 0 && (
                <>
                  <View style={styles.sectionDivider}>
                    <Text style={styles.sectionDividerText}>Start New Conversation</Text>
                  </View>
                  {availableNewContacts.map((member) => (
                    <PressableRow key={member.id} style={styles.conversationItem} onPress={() => setSelectedUser(member)} >
                      <TeamAvatar
                        firstName={member.firstName ?? undefined}
                        lastName={member.lastName ?? undefined}
                        email={member.email || undefined}
                        userId={String(member.id)}
                        profileImageUrl={member.profileImageUrl ?? undefined}
                        size={44}
                      />
                      <View style={styles.conversationContent}>
                        <Text style={styles.conversationName} numberOfLines={1}>
                          {getUserDisplayName(member)}
                        </Text>
                        <Text style={styles.memberEmail} numberOfLines={1}>
                          {member.email}
                        </Text>
                      </View>
                      <Feather name="message-square" size={20} color={colors.mutedForeground} />
                    </PressableRow>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </>
  );
}

function ChatView({ 
  selectedUser, 
  onBack,
  colors,
  styles,
  currentUser
}: { 
  selectedUser: User; 
  onBack: () => void;
  colors: any;
  styles: any;
  currentUser: any;
}) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  // Single overlap guard — covers the polling loop AND every other caller (send, reconnect, etc).
  // Stable across renders via ref.
  const dmFetchInFlightRef = useRef(false);

  const fetchMessages = useCallback(async () => {
    if (dmFetchInFlightRef.current) return;
    dmFetchInFlightRef.current = true;
    try {
      const { offlineStorage, useOfflineStore } = await import('@/lib/offline-storage');
      const isOnline = useOfflineStore.getState().isOnline;
      if (!isOnline) {
        const cached = await offlineStorage.getChatMessagesOffline('dm', selectedUser.id, 200);
        setMessages(cached as any);
        return;
      }
      const response = await api.get<any[]>(`/api/direct-messages/${selectedUser.id}`);
      const data = response.data || [];
      offlineStorage.cacheChatMessages('dm', selectedUser.id, data).catch(() => {});
      const pending = await offlineStorage.getPendingChatMessages('dm', selectedUser.id);
      const serverIds = new Set(data.map((m: any) => String(m.id)));
      const merged = [...data, ...pending.filter((p: any) => !serverIds.has(String(p.id)))];
      setMessages(merged as any);
    } catch (error) {
      if (__DEV__) console.log('Failed to fetch messages, falling back to cache:', error);
      try {
        const { offlineStorage } = await import('@/lib/offline-storage');
        const cached = await offlineStorage.getChatMessagesOffline('dm', selectedUser.id, 200);
        if (cached.length > 0) setMessages(cached as any);
      } catch {}
    } finally {
      setIsLoading(false);
      dmFetchInFlightRef.current = false;
    }
  }, [selectedUser.id]);

  useEffect(() => {
    fetchMessages();
    // 10s polling (was 3s — drained battery and stacked overlapping requests on slow networks).
    // Overlap guard now lives inside fetchMessages itself, so every call site is protected.
    const interval = setInterval(() => { fetchMessages(); }, 10000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

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
          fetchMessages();
        }
        prevOnline = state.isOnline;
      });
    })();
    return () => { mounted = false; if (unsub) unsub(); };
  }, [fetchMessages]);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);
  }, [messages]);

  const handleAttachment = async () => {
    if (isSending) return;
    const asset = await promptForAttachment();
    if (!asset) return;
    setIsSending(true);
    try {
      await uploadChatAttachment(`/api/direct-messages/${selectedUser.id}/upload`, asset, {});
      await fetchMessages();
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Could not send the attachment. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return;
    
    setIsSending(true);
    const text = newMessage.trim();
    setNewMessage('');

    try {
      const { offlineStorage, useOfflineStore } = await import('@/lib/offline-storage');
      const isOnline = useOfflineStore.getState().isOnline;
      if (!isOnline) {
        const optimistic = await offlineStorage.sendChatMessageOffline('dm', selectedUser.id, text);
        setMessages(prev => [...prev, optimistic as any]);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        return;
      }
      const response = await api.post(`/api/direct-messages/${selectedUser.id}`, { content: text });
      if (response.error) throw new Error(response.error);
      await fetchMessages();
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      try {
        const { offlineStorage } = await import('@/lib/offline-storage');
        const optimistic = await offlineStorage.sendChatMessageOffline('dm', selectedUser.id, text);
        setMessages(prev => [...prev, optimistic as any]);
      } catch {
        setNewMessage(text);
      }
    } finally {
      setIsSending(false);
    }
  };

  const getUserDisplayName = (user: User) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email || 'Unknown User';
  };

  const getInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email?.[0]?.toUpperCase() || '?';
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.chatHeader}>
        <PressableRow onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </PressableRow>
        <TeamAvatar
          firstName={selectedUser.firstName ?? undefined}
          lastName={selectedUser.lastName ?? undefined}
          email={selectedUser.email || undefined}
          userId={String(selectedUser.id)}
          profileImageUrl={selectedUser.profileImageUrl ?? undefined}
          size={40}
        />
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderName}>{getUserDisplayName(selectedUser)}</Text>
          <Text style={styles.chatHeaderEmail} numberOfLines={1}>{selectedUser.email}</Text>
        </View>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {isLoading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Feather name="message-square" size={48} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptySubtitle}>Start the conversation!</Text>
          </View>
        ) : (
          messages.map((message) => {
            const isOwn = message.senderId !== selectedUser.id;
            return (
              <View 
                key={message.id}
                style={[
                  styles.messageBubbleWrapper,
                  isOwn ? styles.messageBubbleWrapperRight : styles.messageBubbleWrapperLeft
                ]}
              >
                <View style={[
                  styles.messageBubble,
                  isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther
                ]}>
                  {message.attachmentUrl && message.attachmentType === 'image' && (
                    <PressableRow onPress={() => { const u = resolveAttachmentUrl(message.attachmentUrl); if (u) Linking.openURL(u); }} style={{ marginBottom: message.content && message.content !== (message as any).attachmentName ? 6 : 0 }} >
                      <Image
                        source={{ uri: resolveAttachmentUrl(message.attachmentUrl) || '' }}
                        style={{ width: 220, height: 220, borderRadius: 8, backgroundColor: colors.cardBorder }}
                        resizeMode="cover"
                      />
                    </PressableRow>
                  )}
                  {message.attachmentUrl && message.attachmentType !== 'image' && (
                    <PressableRow onPress={() => { const u = resolveAttachmentUrl(message.attachmentUrl); if (u) Linking.openURL(u); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: isOwn ? 'rgba(255,255,255,0.15)' : colors.cardBorder, marginBottom: 6, }} >
                      <Feather name="file" size={16} color={isOwn ? colors.primaryForeground : colors.foreground} />
                      <Text
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          fontSize: typography.sizes.sm,
                          fontWeight: fontWeights.semibold,
                          color: isOwn ? colors.primaryForeground : colors.foreground,
                        }}
                      >
                        {message.content || 'Attachment'}
                      </Text>
                    </PressableRow>
                  )}
                  {!!message.content && !(message.attachmentUrl && message.attachmentType !== 'image') && (
                    <Text style={[
                      styles.messageText,
                      isOwn && styles.messageTextOwn
                    ]}>
                      {message.content}
                    </Text>
                  )}
                  <Text style={[
                    styles.messageTime,
                    isOwn && styles.messageTimeOwn
                  ]}>
                    {formatTime(message.createdAt)}
                  </Text>
                  {isOwn && (message as any).sendStatus !== 'failed' && (
                    <View style={styles.readReceipt}>
                      <Feather 
                        name={message.isRead ? "check-circle" : "check"} 
                        size={12} 
                        color={message.isRead ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)'} 
                      />
                      <Text style={styles.readReceiptText}>
                        {message.isRead ? 'Read' : 'Sent'}
                      </Text>
                    </View>
                  )}
                  {(message as any).sendStatus === 'failed' && (
                    <PressableRow onPress={async () => { const { offlineStorage } = await import('@/lib/offline-storage'); const ok = await offlineStorage.retryFailedChatMessage((message as any).localId || message.id); if (ok) fetchMessages(); }} style={{ marginTop: 4 }} >
                      <Text style={{ color: colors.destructive, fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold }}>
                        Failed to send · tap to retry
                      </Text>
                    </PressableRow>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <PressableRow onPress={handleAttachment} disabled={isSending} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', opacity: isSending ? 0.5 : 1, }} accessibilityLabel="Attach photo" >
          <Feather name="paperclip" size={20} color={colors.mutedForeground} />
        </PressableRow>
        <TextInput
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Type a message..."
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
          multiline
          maxLength={1000}
          editable={!isSending}
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />
        <PressableRow onPress={handleSend} disabled={!newMessage.trim() || isSending} style={[ styles.sendButton, (!newMessage.trim() || isSending) && styles.sendButtonDisabled ]} >
          {isSending ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Feather name="send" size={20} color={colors.primaryForeground} />
          )}
        </PressableRow>
      </View>
    </KeyboardAvoidingView>
  );
}
