import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ThemeColors } from '../../lib/theme';
import { spacing, radius, typography, fontWeights } from '../../lib/design-tokens';
import { SkeletonSection } from '../Skeleton';

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
      {/* ── Client contact card ── */}
      {client && (
        <View style={{
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          padding: spacing.md,
          marginBottom: spacing.md,
          gap: spacing.sm,
        }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.primary}12`, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="user" size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: fontWeights.semibold, color: colors.foreground }} numberOfLines={1}>
                {client.name || 'Client'}
              </Text>
              {(client.phone || client.email) && (
                <Text style={{ fontSize: 12, color: colors.mutedForeground }} numberOfLines={1}>
                  {client.phone
                    ? (() => {
                        const d = client.phone.replace(/\D/g, '');
                        if (d.length === 10 && d.startsWith('04')) return `${d.slice(0,4)} ${d.slice(4,7)} ${d.slice(7)}`;
                        if (d.length === 10) return `(0${d.slice(1,2)}) ${d.slice(2,6)} ${d.slice(6)}`;
                        if (d.length === 11 && d.startsWith('61')) return `+61 ${d[2]} ${d.slice(3,7)} ${d.slice(7)}`;
                        return client.phone;
                      })()
                    : client.email}
                </Text>
              )}
            </View>
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {client.phone && (
              <TouchableOpacity
                onPress={handleCall}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: `${colors.success}12`, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: `${colors.success}25` }}
                activeOpacity={0.7}
              >
                <Feather name="phone" size={14} color={colors.success} />
                <Text style={{ fontSize: 13, fontWeight: fontWeights.medium, color: colors.success }}>Call</Text>
              </TouchableOpacity>
            )}
            {client.phone && (
              <TouchableOpacity
                onPress={handleSMS}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: `${colors.scheduled}12`, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: `${colors.scheduled}25` }}
                activeOpacity={0.7}
              >
                <Feather name="message-square" size={14} color={colors.scheduled} />
                <Text style={{ fontSize: 13, fontWeight: fontWeights.medium, color: colors.scheduled }}>SMS</Text>
              </TouchableOpacity>
            )}
            {client.email && (
              <TouchableOpacity
                onPress={handleEmail}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: `${colors.invoiced}12`, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: `${colors.invoiced}25` }}
                activeOpacity={0.7}
              >
                <Feather name="mail" size={14} color={colors.invoiced} />
                <Text style={{ fontSize: 13, fontWeight: fontWeights.medium, color: colors.invoiced }}>Email</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Send document / update */}
          <TouchableOpacity
            onPress={() => {
              setSendModalDefaultTab(client?.email ? 'email' : 'sms');
              setShowSendModal(true);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: `${colors.primary}08`, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: `${colors.primary}20` }}
            activeOpacity={0.7}
          >
            <Feather name="zap" size={14} color={colors.primary} />
            <Text style={{ fontSize: 13, fontWeight: fontWeights.medium, color: colors.primary }}>
              Send quote, invoice or update
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Team chat section label ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
        <Feather name="users" size={14} color={colors.mutedForeground} style={{ marginRight: spacing.xs }} />
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.mutedForeground, letterSpacing: 0.3, flex: 1 }}>
          Team Chat
        </Text>
        {!isLoadingMessages && (
          <View style={{ backgroundColor: jobMessages.length > 0 ? `${colors.primary}15` : `${colors.muted}80`, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: jobMessages.length > 0 ? colors.primary : colors.mutedForeground }}>
              {jobMessages.length}
            </Text>
          </View>
        )}
      </View>

      {/* ── Chat messages card ── */}
      <View style={{
        backgroundColor: colors.card,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        marginBottom: spacing.md,
        overflow: 'hidden',
      }}>
        {isLoadingMessages ? (
          <SkeletonSection rows={3} />
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
                    {(() => { const d = new Date(msg.createdAt); return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }); })()}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Message input */}
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

      {/* ── Quick links ── */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
        <TouchableOpacity
          onPress={() => router.push('/more/chat-hub')}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm + 2, borderRadius: radius.lg, backgroundColor: `${colors.primary}08`, borderWidth: 1, borderColor: `${colors.primary}20` }}
          activeOpacity={0.7}
        >
          <Feather name="message-circle" size={14} color={colors.primary} />
          <Text style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: colors.primary }}>Open ChatHub</Text>
          <Feather name="chevron-right" size={13} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Communication tips ── */}
      <View style={{
        backgroundColor: colors.muted,
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.xs,
      }}>
        <Text style={{ fontSize: 12, fontWeight: fontWeights.semibold, color: colors.mutedForeground, marginBottom: 2 }}>
          Communication tips
        </Text>
        {[
          { icon: 'zap' as const, text: 'Send automated updates when job status changes' },
          { icon: 'file-text' as const, text: 'Share quotes and invoices directly from the Docs tab' },
          { icon: 'users' as const, text: 'Use Team Chat to keep the crew aligned on site' },
        ].map((tip, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <Feather name={tip.icon} size={12} color={colors.mutedForeground} style={{ marginTop: 2 }} />
            <Text style={{ fontSize: 12, color: colors.mutedForeground, flex: 1, lineHeight: 17 }}>{tip.text}</Text>
          </View>
        ))}
      </View>
    </>
  );
}
