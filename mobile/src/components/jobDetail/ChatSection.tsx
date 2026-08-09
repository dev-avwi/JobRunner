import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ThemeColors } from '../../lib/theme';
import { spacing, radius, typography } from '../../lib/design-tokens';

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface JobChatMessage {
  id: string;
  message: string;
  createdAt: string;
  senderName?: string;
  userId?: string;
  chatType?: string;
}

export interface ChatSectionProps {
  colors: ThemeColors;
  client: Client | null;
  currentUserId?: string;
  jobMessages: JobChatMessage[];
  isLoadingMessages: boolean;
  newMessage: string;
  setNewMessage: (value: string) => void;
  isSendingMessage: boolean;
  handleSendJobMessage: () => void;
  handleCall: () => void;
  handleSMS: () => void;
  handleEmail: () => void;
  setSendModalDefaultTab: (tab: 'email' | 'sms') => void;
  setShowSendModal: (value: boolean) => void;
}

export function ChatSection(props: ChatSectionProps) {
  const {
    colors,
    client,
    currentUserId,
    jobMessages,
    isLoadingMessages,
    newMessage,
    setNewMessage,
    isSendingMessage,
    handleSendJobMessage,
    handleCall,
    handleSMS,
    handleEmail,
    setSendModalDefaultTab,
    setShowSendModal,
  } = props;

  return (
    <>
      {/* Contact Client - compact action row */}
      {client && (client.phone || client.email) && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginBottom: spacing.md,
          paddingVertical: spacing.xs,
        }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${colors.invoiced}12`, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="user" size={14} color={colors.invoiced} />
          </View>
          <Text style={{ ...typography.bodySmall, fontWeight: '600', color: colors.foreground, flex: 1 }} numberOfLines={1}>
            {client.name || 'Client'}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            {client.phone && (
              <TouchableOpacity
                onPress={handleCall}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.success}12`, alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.7}
              >
                <Feather name="phone" size={15} color={colors.success} />
              </TouchableOpacity>
            )}
            {client.phone && (
              <TouchableOpacity
                onPress={handleSMS}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.scheduled}12`, alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.7}
              >
                <Feather name="message-square" size={15} color={colors.scheduled} />
              </TouchableOpacity>
            )}
            {client.email && (
              <TouchableOpacity
                onPress={handleEmail}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.invoiced}12`, alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.7}
              >
                <Feather name="mail" size={15} color={colors.invoiced} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                setSendModalDefaultTab(client?.email ? 'email' : 'sms');
                setShowSendModal(true);
              }}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.primary}10`, alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={0.7}
            >
              <Feather name="zap" size={15} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Team Chat Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
        <Feather name="users" size={14} color={colors.mutedForeground} style={{ marginRight: spacing.xs }} />
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.mutedForeground, letterSpacing: 0.3, flex: 1 }}>Team Chat</Text>
        {jobMessages.length > 0 && (
          <View style={{ backgroundColor: `${colors.primary}15`, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>{jobMessages.length}</Text>
          </View>
        )}
      </View>

      {/* Chat Messages Area */}
      <View style={{
        backgroundColor: colors.card,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        marginBottom: spacing.md,
        overflow: 'hidden',
      }}>
        {isLoadingMessages ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : jobMessages.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.md }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.primary}08`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
              <Feather name="message-circle" size={18} color={colors.mutedForeground} />
            </View>
            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.mutedForeground, textAlign: 'center' }}>
              No messages yet
            </Text>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2, textAlign: 'center', opacity: 0.7 }}>
              Discuss this job with your team
            </Text>
          </View>
        ) : (
          <View style={{ padding: spacing.sm, gap: spacing.xs }}>
            {jobMessages.map((msg) => {
              const isMe = msg.userId === currentUserId;
              return (
                <View
                  key={msg.id}
                  style={{
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '78%',
                  }}
                >
                  {!isMe && msg.senderName && (
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary, marginBottom: 2, marginLeft: spacing.sm }}>
                      {msg.senderName}
                    </Text>
                  )}
                  <View style={{
                    backgroundColor: isMe ? colors.primary : colors.muted,
                    borderRadius: 18,
                    borderTopRightRadius: isMe ? 4 : 18,
                    borderTopLeftRadius: isMe ? 18 : 4,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                  }}>
                    <Text style={{ fontSize: 14, lineHeight: 20, color: isMe ? colors.primaryForeground : colors.foreground }}>
                      {msg.message}
                    </Text>
                  </View>
                  <Text style={{
                    fontSize: 10,
                    color: colors.mutedForeground,
                    marginTop: 2,
                    marginHorizontal: spacing.xs,
                    textAlign: isMe ? 'right' : 'left',
                  }}>
                    {new Date(msg.createdAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Message Input - integrated into chat card */}
        <View style={{
          flexDirection: 'row',
          gap: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.cardBorder,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.sm,
          alignItems: 'flex-end',
        }}>
          <TextInput
            style={{
              flex: 1,
              fontSize: 14,
              color: colors.foreground,
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.sm,
              maxHeight: 100,
              minHeight: 34,
              backgroundColor: colors.muted,
              borderRadius: 18,
            }}
            placeholder="Message your team..."
            placeholderTextColor={colors.mutedForeground}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity
            onPress={handleSendJobMessage}
            disabled={!newMessage.trim() || isSendingMessage}
            style={{
              backgroundColor: newMessage.trim() ? colors.primary : 'transparent',
              borderRadius: radius.full,
              width: 34,
              height: 34,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            activeOpacity={0.7}
          >
            {isSendingMessage ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Feather name="send" size={16} color={newMessage.trim() ? colors.primaryForeground : colors.mutedForeground} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick link to full ChatHub */}
      <TouchableOpacity
        onPress={() => router.push('/more/chat-hub')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.sm + 2,
          borderRadius: radius.lg,
          backgroundColor: `${colors.primary}08`,
        }}
        activeOpacity={0.7}
      >
        <Feather name="message-circle" size={14} color={colors.primary} />
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>
          Open ChatHub
        </Text>
        <Feather name="chevron-right" size={14} color={colors.primary} />
      </TouchableOpacity>
    </>
  );
}
