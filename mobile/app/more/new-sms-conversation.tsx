import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import api from '../../src/lib/api';
import { handleDedicatedNumberError } from '../../src/lib/smsGate';
import { spacing, radius, typography, fontWeights } from '../../src/lib/design-tokens';
import { getAvatarColor as getAvatarColorShared } from '../../src/lib/avatar-colors';
import { TeamAvatar } from '../../src/components/TeamAvatar';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company?: string;
}

type ScreenMode = 'select' | 'compose';

const SMS_TEMPLATES = [
  "G'day! Just reaching out to check in. Let me know if you need anything.",
  "Hi! I've got some availability coming up. Would you like to book in a job?",
  "Just following up on our chat. Let me know when suits for me to come by.",
  "G'day! Quick question about your property - give me a call when you get a chance.",
];

const SMS_MAX_LENGTH = 1600;
const SMS_SEGMENT_LENGTH = 160;

const getAvatarColorBg = (name: string) => getAvatarColorShared(name).bg;
const getAvatarColorFg = (name: string) => getAvatarColorShared(name).fg;

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.lg,
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
    marginRight: spacing.lg,
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
  smsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  smsBannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smsBannerText: {
    flex: 1,
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
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
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    marginHorizontal: spacing.lg,
    marginTop: 20,
    marginBottom: 8,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  clientAvatarText: {
    fontSize: typography.subtitle.fontSize,
    fontWeight: fontWeights.bold,
    color: colors.white,
  },
  clientInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  clientCompany: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  clientPhone: {
    fontSize: typography.sizes.sm,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  smsIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: typography.button.fontSize,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 8,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  noPhoneBadge: {
    fontSize: typography.sizes.xs,
    color: colors.destructive,
    marginTop: 2,
  },
  // Compose mode styles
  composeContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  composeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    backgroundColor: colors.muted,
  },
  composeHeaderContent: {
    flex: 1,
  },
  composeHeaderTitle: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  composeHeaderSubtitle: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  composeContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  templatesLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  templateChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    marginRight: spacing.sm,
  },
  templateChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  templateChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
    lineHeight: 18,
  },
  templateChipTextActive: {
    color: colors.primaryForeground,
  },
  templatesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  messageInputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
  },
  messageInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.foreground,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  charCount: {
    fontSize: typography.captionSmall.fontSize,
    color: colors.mutedForeground,
    marginBottom: spacing.lg,
    textAlign: 'right',
  },
  charCountWarning: {
    color: colors.destructive,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  sendButton: {
    backgroundColor: colors.success || '#22c55e',
  },
  sendButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.white,
  },
});

export default function NewSmsConversation() {
  const { colors } = useTheme();
  const bottomInset = useBottomInset(24);
  const styles = createStyles(colors);
  
  const [mode, setMode] = useState<ScreenMode>('select');
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const response = await api.get<Client[]>('/api/clients');
      if (response.data) {
        setClients(response.data);
      }
    } catch (error) {
      console.error('Failed to load clients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredClients = clients.filter(client => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
    return fullName.includes(term) || 
           client.phone?.toLowerCase().includes(term) ||
           client.company?.toLowerCase().includes(term);
  });

  const handleClientSelect = (client: Client) => {
    if (!client.phone) {
      Alert.alert(
        'No Phone Number',
        `${client.firstName} ${client.lastName} doesn't have a phone number on file. Would you like to add one?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Edit Client', onPress: () => router.push(`/client/${client.id}` as any) }
        ]
      );
      return;
    }
    
    setSelectedClient(client);
    setMessage('');
    setMode('compose');
  };

  const handleUseTemplate = (template: string) => {
    setMessage(template);
  };

  const handleSendSMS = async () => {
    if (!selectedClient || !message.trim()) {
      Alert.alert('Error', 'Please enter a message before sending.');
      return;
    }

    setIsSending(true);
    try {
      const response = await api.post('/api/sms/send', {
        clientId: selectedClient.id,
        clientPhone: selectedClient.phone,
        clientName: `${selectedClient.firstName} ${selectedClient.lastName}`.trim(),
        message: message.trim()
      });
      
      if (!response.error && response.data) {
        Alert.alert('Success', `SMS sent to ${selectedClient.firstName} ${selectedClient.lastName}`);
        setMode('select');
        setSelectedClient(null);
        setMessage('');
        router.back();
      } else if (handleDedicatedNumberError(response)) {
        // Friendly "get your business number" prompt shown
      } else {
        Alert.alert(
          'Failed to Send SMS',
          'Could not send SMS. Please check your Twilio configuration or try again later.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Failed to send SMS:', error);
      Alert.alert(
        'SMS Failed',
        error?.message || 'Failed to send SMS. Please check your Twilio settings and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleBack = () => {
    setMode('select');
    setSelectedClient(null);
    setMessage('');
  };

  const getInitials = (firstName: string, lastName: string, phone: string) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    if (first || last) return `${first}${last}`.toUpperCase();
    if (phone) return '#';
    return '?';
  };

  const getDisplayName = (client: Client) => {
    const fullName = `${client.firstName || ''} ${client.lastName || ''}`.trim();
    if (fullName) return fullName;
    if (client.phone) return client.phone;
    return 'Unknown Client';
  };

  const getClientKey = (client: Client) => {
    return `${client.firstName || ''}${client.lastName || ''}${client.phone || client.id}`;
  };

  const charCount = message.length;
  const isOverLimit = charCount > SMS_MAX_LENGTH;

  if (mode === 'compose' && selectedClient) {
    return (
      <>
        <Stack.Screen options={{ title: 'Compose SMS' }} />
        
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.composeContainer}
        >
          <View style={styles.composeHeader}>
            <PressableRow style={styles.backButton} onPress={handleBack} disabled={isSending} >
              <Feather name="chevron-left" size={24} color={colors.foreground} />
            </PressableRow>
            <View style={styles.composeHeaderContent}>
              <Text style={styles.composeHeaderTitle}>
                {selectedClient.firstName} {selectedClient.lastName}
              </Text>
              <Text style={styles.composeHeaderSubtitle}>{selectedClient.phone}</Text>
            </View>
          </View>

          <ScrollView style={styles.composeContent} contentContainerStyle={{ paddingBottom: spacing.lg + bottomInset }}>
            <Text style={styles.templatesLabel}>Quick Templates</Text>
            <View style={styles.templatesContainer}>
              {SMS_TEMPLATES.map((template, index) => (
                <PressableRow key={index} style={[ styles.templateChip, message === template && styles.templateChipActive ]} onPress={() => handleUseTemplate(template)} disabled={isSending} >
                  <Text
                    style={[
                      styles.templateChipText,
                      message === template && styles.templateChipTextActive
                    ]}
                  >
                    {template}
                  </Text>
                </PressableRow>
              ))}
            </View>

            <Text style={styles.messageInputLabel}>Custom Message</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Type your message..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
              value={message}
              onChangeText={setMessage}
              editable={!isSending}
              maxLength={SMS_MAX_LENGTH}
            />
            <Text style={[styles.charCount, isOverLimit && styles.charCountWarning]}>
              {charCount} / {SMS_MAX_LENGTH} characters{charCount > SMS_SEGMENT_LENGTH ? ` (${Math.ceil(charCount / SMS_SEGMENT_LENGTH)} SMS segments)` : ''}
            </Text>
          </ScrollView>

          <View style={styles.actionButtons}>
            <PressableRow style={[styles.actionButton, styles.sendButton]} onPress={handleSendSMS} disabled={isSending || !message.trim() || isOverLimit} >
              {isSending ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Feather name="send" size={18} color={colors.white} />
                  <Text style={styles.sendButtonText}>Send SMS</Text>
                </>
              )}
            </PressableRow>
          </View>
        </KeyboardAvoidingView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'New SMS' }} />
      
      <View style={styles.container}>
        <View style={styles.headerCard}>
          <View style={styles.headerIconContainer}>
            <Feather name="edit-3" size={24} color={colors.primary} />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>New SMS Conversation</Text>
            <Text style={styles.headerSubtitle}>Select a client to message</Text>
          </View>
        </View>

        <View style={styles.smsBanner}>
          <View style={styles.smsBannerIcon}>
            <Feather name="alert-circle" size={14} color={colors.white} />
          </View>
          <Text style={styles.smsBannerText}>
            SMS messages are sent via Twilio to the client's phone. Standard carrier rates may apply to the recipient.
          </Text>
        </View>

        <View style={styles.searchContainer}>
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search clients..."
            placeholderTextColor={colors.mutedForeground}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>

        <Text style={styles.sectionTitle}>
          {searchTerm ? 'SEARCH RESULTS' : 'CLIENTS'}
        </Text>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
          {isLoading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filteredClients.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="users" size={28} color={colors.mutedForeground} />
              </View>
              <Text style={styles.emptyTitle}>
                {searchTerm ? 'No matching clients' : 'No clients yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchTerm ? 'Try a different search term' : 'Add clients to start sending SMS messages'}
              </Text>
            </View>
          ) : (
            filteredClients.map((client) => {
              const displayName = getDisplayName(client);
              const hasName = !!(client.firstName || client.lastName);
              const avatarBg = getAvatarColorBg(getClientKey(client));
              const avatarFg = getAvatarColorFg(getClientKey(client));
              
              return (
                <PressableRow key={client.id} style={styles.clientCard} onPress={() => handleClientSelect(client)} >
                  <TeamAvatar
                    firstName={client.firstName}
                    lastName={client.lastName}
                    userId={String(client.id)}
                    size={40}
                  />
                  <View style={styles.clientInfo}>
                    <Text style={styles.clientName} numberOfLines={1}>
                      {displayName}
                    </Text>
                    {client.company ? (
                      <Text style={styles.clientCompany} numberOfLines={1}>{client.company}</Text>
                    ) : null}
                    {client.phone && hasName ? (
                      <Text style={styles.clientPhone}>{client.phone}</Text>
                    ) : !client.phone ? (
                      <Text style={styles.noPhoneBadge}>No phone number</Text>
                    ) : null}
                  </View>
                  <View style={[styles.smsIcon, !client.phone && { backgroundColor: colors.muted }]}>
                    <Feather 
                      name="message-circle" 
                      size={18} 
                      color={client.phone ? colors.primary : colors.mutedForeground} 
                    />
                  </View>
                </PressableRow>
              );
            })
          )}
        </ScrollView>
      </View>
    </>
  );
}
