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
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import api from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { TeamAvatar } from '../../src/components/TeamAvatar';
import { promptForAttachment, uploadChatAttachment, resolveAttachmentUrl } from '../../src/lib/chat-attachments';
import { typography, fontWeights } from '../../src/lib/design-tokens';

interface TeamChatMessage {
  id: string;
  businessOwnerId: string;
  senderId: string;
  message: string;
  messageType?: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  isAnnouncement?: boolean;
  isPinned?: boolean;
  readBy?: string[];
  createdAt: string;
  senderName: string;
  senderAvatar?: string | null;
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
  pinnedFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.warningLight,
    borderWidth: 1,
    borderColor: `${colors.warning}30`,
  },
  pinnedFilterActive: {
    backgroundColor: colors.warning,
  },
  pinnedFilterText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.warning,
  },
  pinnedFilterTextActive: {
    color: colors.primaryForeground,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  messageBubbleContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
  },
  messageBubbleContainerRight: {
    flexDirection: 'row-reverse',
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarSmallText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
  },
  messageBubble: {
    borderRadius: 16,
    padding: 12,
  },
  messageBubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  messageBubblePinned: {
    borderColor: colors.warning,
    borderWidth: 1,
  },
  messageBubbleAnnouncement: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warning,
  },
  senderName: {
    fontSize: typography.captionSmall.fontSize,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
    marginBottom: 4,
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  pinnedBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.warning,
  },
  messageText: {
    fontSize: typography.sizes.md,
    color: colors.foreground,
    lineHeight: 20,
  },
  messageTextUser: {
    color: colors.primaryForeground,
  },
  messageTime: {
    fontSize: typography.sizes.xs,
    color: colors.mutedForeground,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeUser: {
    color: 'rgba(255,255,255,0.7)',
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: 12,
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
  headerButton: {
    padding: 8,
    marginRight: -8,
  },
  actionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  overlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  actionsMenu: {
    position: 'absolute',
    bottom: '100%',
    right: 0,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 8,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  actionText: {
    fontSize: typography.sizes.md,
    color: colors.foreground,
  },
});

export default function TeamChatScreen() {
  const { colors } = useTheme();
  const confirm = useConfirmDialog();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomInset = useBottomInset();
  
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const fetchMessages = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    try {
      const { offlineStorage, useOfflineStore } = await import('@/lib/offline-storage');
      const isOnline = useOfflineStore.getState().isOnline;
      if (!isOnline) {
        const cached = await offlineStorage.getChatMessagesOffline('team', 'team', 200);
        setMessages(cached as any);
        return;
      }
      const response = await api.get<any[]>('/api/team-chat');
      const data = response.data || [];
      // Write-through cache so we have something to show next time we're offline.
      offlineStorage.cacheChatMessages('team', 'team', data).catch(() => {});
      // Merge in pending local messages so optimistic sends don't disappear on poll.
      const pending = await offlineStorage.getPendingChatMessages('team', 'team');
      const serverIds = new Set(data.map((m: any) => String(m.id)));
      const merged = [...data, ...pending.filter((p: any) => !serverIds.has(String(p.id)))];
      setMessages(merged as any);
    } catch (error) {
      if (__DEV__) console.log('Failed to fetch team chat, falling back to cache:', error);
      try {
        const { offlineStorage } = await import('@/lib/offline-storage');
        const cached = await offlineStorage.getChatMessagesOffline('team', 'team', 200);
        if (cached.length > 0) setMessages(cached as any);
      } catch {}
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(() => fetchMessages(false), 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Reconnect-replay: when the device comes back online, fire an immediate fetch
  // so the user doesn't wait up to 5s for the next poll tick.
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
          fetchMessages(false);
        }
        prevOnline = state.isOnline;
      });
    })();
    return () => { mounted = false; if (unsub) unsub(); };
  }, [fetchMessages]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchMessages(false);
  };

  const handleAttachment = async () => {
    if (isSending) return;
    const asset = await promptForAttachment();
    if (!asset) return;
    setIsSending(true);
    try {
      await uploadChatAttachment('/api/team-chat/upload', asset, {});
      await fetchMessages(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Could not send the attachment. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || isSending) return;

    setIsSending(true);
    const text = messageText.trim();
    setMessageText('');

    try {
      const { offlineStorage, useOfflineStore } = await import('@/lib/offline-storage');
      const isOnline = useOfflineStore.getState().isOnline;
      if (!isOnline) {
        const optimistic = await offlineStorage.sendChatMessageOffline('team', 'team', text, {
          senderId: user?.id,
          senderName: (user as any)?.firstName || (user as any)?.name || 'You',
        });
        setMessages(prev => [...prev, optimistic as any]);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        return;
      }
      const response = await api.post('/api/team-chat', {
        message: text,
        messageType: 'text',
      });
      if (response.error) throw new Error(response.error);
      await fetchMessages(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      // Online send failed — queue for later instead of dropping the message.
      try {
        const { offlineStorage } = await import('@/lib/offline-storage');
        const optimistic = await offlineStorage.sendChatMessageOffline('team', 'team', text, {
          senderId: user?.id,
          senderName: (user as any)?.firstName || (user as any)?.name || 'You',
        });
        setMessages(prev => [...prev, optimistic as any]);
      } catch {
        Alert.alert('Error', 'Failed to send message. Please try again.');
        setMessageText(text);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handlePinMessage = async (messageId: string, pinned: boolean) => {
    try {
      await api.patch(`/api/team-chat/${messageId}/pin`, { pinned });
      await fetchMessages(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update pin status.');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await api.delete(`/api/team-chat/${messageId}`);
      await fetchMessages(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to delete message.');
    }
  };

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const pinnedMessages = messages.filter(m => m.isPinned);
  const displayMessages = showPinnedOnly ? pinnedMessages : messages;
  const isBusinessOwner = user && messages.length > 0 
    ? messages[0]?.businessOwnerId === user.id 
    : true;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-AU', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return parts.map(p => p[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Team Chat',
          headerRight: () => (
            <PressableRow onPress={() => fetchMessages(false)} style={styles.headerButton}>
              <Feather name="refresh-cw" size={20} color={colors.mutedForeground} />
            </PressableRow>
          )
        }} 
      />
      
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <View style={styles.headerCard}>
          <View style={styles.headerIconContainer}>
            <Feather name="users" size={24} color={colors.primary} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Team Chat</Text>
            <Text style={styles.headerSubtitle}>
              {messages.length} {messages.length === 1 ? 'message' : 'messages'}
            </Text>
          </View>
          {pinnedMessages.length > 0 && (
            <PressableRow style={[ styles.pinnedFilter, showPinnedOnly && styles.pinnedFilterActive ]} onPress={() => setShowPinnedOnly(!showPinnedOnly)} >
              <Feather name="bookmark" size={14} color={showPinnedOnly ? colors.primaryForeground : colors.warning} />
              <Text style={[
                styles.pinnedFilterText,
                showPinnedOnly && styles.pinnedFilterTextActive
              ]}>
                {pinnedMessages.length}
              </Text>
            </PressableRow>
          )}
        </View>

        <ScrollView 
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
          onScrollBeginDrag={() => setSelectedMessageId(null)}
        >
          {isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : displayMessages.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Feather name="users" size={48} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>
                {showPinnedOnly ? 'No pinned messages' : 'No messages yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {showPinnedOnly 
                  ? 'Pin important messages to see them here' 
                  : 'Start chatting with your team'}
              </Text>
            </View>
          ) : (
            displayMessages.map((msg) => {
              const isCurrentUser = user ? msg.senderId === user.id : false;
              const canDelete = isCurrentUser || isBusinessOwner;
              const canPin = isBusinessOwner;
              const showActions = selectedMessageId === msg.id;

              const handleLongPress = () => {
                if (canDelete || canPin) {
                  setSelectedMessageId(showActions ? null : msg.id);
                }
              };

              const confirmDelete = async () => {
                setSelectedMessageId(null);
                const ok = await confirm({ title: 'Delete Message', message: 'Are you sure you want to delete this message?', confirmText: 'Delete', cancelText: 'Cancel', destructive: true });
                if (ok) {
                  handleDeleteMessage(msg.id);
                }
              };

              return (
                <View 
                  key={msg.id}
                  style={[
                    styles.messageBubbleContainer,
                    isCurrentUser && styles.messageBubbleContainerRight
                  ]}
                >
                  {!isCurrentUser && (
                    <TeamAvatar
                      name={msg.senderName}
                      userId={String(msg.senderId)}
                      size={28}
                    />
                  )}
                  
                  <View style={{ maxWidth: '75%', flexShrink: 1 }}>
                    <PressableRow onLongPress={handleLongPress} delayLongPress={400} style={[
                      styles.messageBubble,
                      isCurrentUser ? styles.messageBubbleUser : styles.messageBubbleOther,
                      msg.isPinned && styles.messageBubblePinned,
                      msg.isAnnouncement && styles.messageBubbleAnnouncement
                    ]}>
                      {!isCurrentUser && (
                        <Text style={styles.senderName}>{msg.senderName}</Text>
                      )}
                      
                      {msg.isPinned && (
                        <View style={styles.pinnedBadge}>
                          <Feather name="bookmark" size={10} color={colors.warning} />
                          <Text style={styles.pinnedBadgeText}>Pinned</Text>
                        </View>
                      )}

                      {msg.attachmentUrl && msg.messageType === 'image' && (
                        <PressableRow onPress={() => { const u = resolveAttachmentUrl(msg.attachmentUrl); if (u) Linking.openURL(u); }} style={{ marginBottom: msg.message ? 6 : 0 }} >
                          <Image
                            source={{ uri: resolveAttachmentUrl(msg.attachmentUrl) || '' }}
                            style={{ width: 220, height: 220, borderRadius: 8, backgroundColor: colors.cardBorder }}
                            resizeMode="cover"
                          />
                        </PressableRow>
                      )}

                      {msg.attachmentUrl && msg.messageType !== 'image' && (
                        <PressableRow onPress={() => { const u = resolveAttachmentUrl(msg.attachmentUrl); if (u) Linking.openURL(u); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: isCurrentUser ? 'rgba(255,255,255,0.15)' : colors.cardBorder, marginBottom: msg.message ? 6 : 0, }} >
                          <Feather name="file" size={16} color={isCurrentUser ? colors.primaryForeground : colors.foreground} />
                          <Text
                            numberOfLines={1}
                            style={{
                              flex: 1,
                              fontSize: typography.sizes.sm,
                              fontWeight: fontWeights.semibold,
                              color: isCurrentUser ? colors.primaryForeground : colors.foreground,
                            }}
                          >
                            {msg.attachmentName || 'Attachment'}
                          </Text>
                        </PressableRow>
                      )}

                      {!!msg.message && msg.message !== msg.attachmentName && (
                        <Text style={[
                          styles.messageText,
                          isCurrentUser && styles.messageTextUser
                        ]}>
                          {msg.message}
                        </Text>
                      )}
                      
                      <Text style={[
                        styles.messageTime,
                        isCurrentUser && styles.messageTimeUser
                      ]}>
                        {formatTime(msg.createdAt)}
                      </Text>
                      {(msg as any).sendStatus === 'failed' && (
                        <PressableRow onPress={async () => { const { offlineStorage } = await import('@/lib/offline-storage'); const ok = await offlineStorage.retryFailedChatMessage((msg as any).localId || msg.id); if (ok) fetchMessages(false); }} style={{ marginTop: 4 }} >
                          <Text style={{ color: colors.destructive, fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold }}>
                            Failed to send · tap to retry
                          </Text>
                        </PressableRow>
                      )}
                    </PressableRow>

                    {showActions && (
                      <View style={[
                        styles.actionsMenu,
                        { position: 'relative', bottom: 'auto', right: 'auto', marginTop: 4 }
                      ]}>
                        {canPin && (
                          <PressableRow style={styles.actionItem} onPress={() => { setSelectedMessageId(null); handlePinMessage(msg.id, !msg.isPinned); }} >
                            <Feather 
                              name={msg.isPinned ? "bookmark" : "bookmark"} 
                              size={16} 
                              color={msg.isPinned ? colors.warning : colors.foreground} 
                            />
                            <Text style={styles.actionText}>
                              {msg.isPinned ? 'Unpin' : 'Pin'}
                            </Text>
                          </PressableRow>
                        )}
                        {canDelete && (
                          <PressableRow style={styles.actionItem} onPress={confirmDelete} >
                            <Feather name="trash-2" size={16} color={colors.destructive} />
                            <Text style={[styles.actionText, { color: colors.destructive }]}>
                              Delete
                            </Text>
                          </PressableRow>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={[styles.inputContainer, { paddingBottom: 12 + bottomInset }]}>
          <PressableRow onPress={handleAttachment} disabled={isSending} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', opacity: isSending ? 0.5 : 1, }} accessibilityLabel="Attach photo" >
            <Feather name="paperclip" size={20} color={colors.mutedForeground} />
          </PressableRow>
          <TextInput
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Message your team..."
            placeholderTextColor={colors.mutedForeground}
            style={styles.input}
            multiline
            maxLength={1000}
            editable={!isSending}
            returnKeyType="send"
            onSubmitEditing={handleSendMessage}
          />
          <PressableRow onPress={handleSendMessage} disabled={!messageText.trim() || isSending} style={[ styles.sendButton, (!messageText.trim() || isSending) && styles.sendButtonDisabled ]} >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Feather name="send" size={20} color={colors.primaryForeground} />
            )}
          </PressableRow>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
