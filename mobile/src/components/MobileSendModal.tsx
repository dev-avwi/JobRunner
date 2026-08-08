import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Linking,
  Image,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from './ui/PressableRow';
import AppBottomSheet from './ui/AppBottomSheet';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme, ThemeColors } from '../lib/theme';
import { spacing, radius, typography } from '../lib/design-tokens';
import { api, API_URL } from '../lib/api';
import { handleDedicatedNumberError } from '../lib/smsGate';

interface MobileSendModalProps {
  visible: boolean;
  onClose: () => void;
  documentType: 'quote' | 'invoice' | 'job' | 'receipt';
  documentId: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  documentTitle?: string;
  defaultTab?: 'email' | 'sms';
  onSendSuccess?: () => void;
}

const SMS_TEMPLATES = {
  quote: [
    { id: 'sent', label: "Quote ready", message: "Hi! I've sent through your quote. Have a look and let me know if you've got any questions or want to go ahead." },
    { id: 'followup', label: "Follow up", message: "Hi! Just following up on the quote I sent. Let me know if you have any questions or need any changes." },
    { id: 'accept', label: "Accept quote", message: "Hi! Your quote is ready to view and accept online. Check your email for the link, or reply to this message if you have any questions." },
  ],
  invoice: [
    { id: 'sent', label: "Invoice sent", message: "Hi! I've sent through your invoice. You can pay online using the link in the email. Thanks for your business!" },
    { id: 'reminder', label: "Payment reminder", message: "Hi! Just a friendly reminder that your invoice is due. Let me know if you have any questions." },
    { id: 'overdue', label: "Overdue", message: "Hi! Just a reminder that your invoice is now overdue. You can pay online using the link in your email. Please let me know if you have any questions." },
  ],
  job: [
    { id: 'omw', label: "On my way", message: "G'day! Just letting you know I'm on my way now. Should be there in about 20 minutes." },
    { id: 'arrived', label: "Just arrived", message: "Hi! I've just arrived. I'm ready to get started on the job." },
    { id: 'done', label: "Job complete", message: "All done! The job's been completed. Let me know if you have any questions." },
    { id: 'confirm', label: "Confirm appointment", message: "Just confirming our appointment. Please reply to let me know you're still available." },
    { id: 'running_late', label: "Running late", message: "Hi! Just letting you know I'm running a bit behind schedule. I'll be there as soon as I can. Sorry for the delay!" },
    { id: 'photo_update', label: "Photo update", message: "Hi! Just wanted to share a progress update on the job. Check your email for photos of the work so far." },
  ],
  receipt: [
    { id: 'thanks', label: "Payment thanks", message: "Thanks for your payment! Your receipt has been sent to your email." },
  ],
};

export function MobileSendModal({
  visible,
  onClose,
  documentType,
  documentId,
  recipientName,
  recipientEmail,
  recipientPhone,
  documentTitle,
  defaultTab,
  onSendSuccess,
}: MobileSendModalProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [activeTab, setActiveTab] = useState<'email' | 'sms'>(defaultTab || 'email');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [attachedPhoto, setAttachedPhoto] = useState<{ uri: string; fileName: string } | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const hasEmail = !!recipientEmail;
  const hasPhone = !!recipientPhone;
  const typeLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1);

  useEffect(() => {
    if (visible) {
      setEmailSubject(`Your ${typeLabel} from JobRunner`);
      setEmailBody(`Hi ${recipientName},\n\nPlease find your ${documentType} attached.\n\nIf you have any questions, please don't hesitate to reach out.\n\nCheers!`);
      setSmsMessage(SMS_TEMPLATES[documentType]?.[0]?.message || '');
      setAttachedPhoto(null);
    }
  }, [visible, documentType, recipientName]);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, visible]);

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      Alert.alert('Missing Information', 'Please enter both subject and message.');
      return;
    }

    setIsSendingEmail(true);
    try {
      const response = await api.post(`/api/${documentType}s/${documentId}/send`, {
        method: 'email',
        subject: emailSubject,
        body: emailBody,
      });

      if (response.error) {
        handleEmailFallback();
        return;
      }

      Alert.alert('Email Sent', `${typeLabel} sent to ${recipientEmail}`);
      onSendSuccess?.();
      onClose();
    } catch {
      handleEmailFallback();
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleEmailFallback = () => {
    Alert.alert(
      'Send via Email App?',
      'Could not send directly. Would you like to open your email app instead?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Email App',
          onPress: () => {
            const mailto = `mailto:${recipientEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
            Linking.openURL(mailto).catch(() => {
              Alert.alert('Error', 'Could not open email app.');
            });
          },
        },
      ]
    );
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setAttachedPhoto({
      uri: asset.uri,
      fileName: asset.fileName || `photo_${Date.now()}.jpg`,
    });
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setAttachedPhoto({
      uri: asset.uri,
      fileName: asset.fileName || `photo_${Date.now()}.jpg`,
    });
  };

  const uploadPhotoForMms = async (): Promise<string | null> => {
    if (!attachedPhoto) return null;

    setIsUploadingPhoto(true);
    try {
      const token = await api.getToken();
      const uploadUrl = `${API_URL}/api/sms/upload-media`;
      const uploadType = FileSystem.FileSystemUploadType?.MULTIPART ?? 1;
      const uploadResult = await FileSystem.uploadAsync(uploadUrl, attachedPhoto.uri, {
        httpMethod: 'POST',
        uploadType,
        fieldName: 'file',
        mimeType: 'image/jpeg',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (uploadResult.status !== 200) {
        return null;
      }

      const { url } = JSON.parse(uploadResult.body);
      return url;
    } catch {
      return null;
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSendSms = async () => {
    if (!smsMessage.trim()) {
      Alert.alert('Missing Message', 'Please enter a message to send.');
      return;
    }

    setIsSendingSms(true);
    try {
      let mediaUrls: string[] | undefined;
      if (attachedPhoto) {
        const mediaUrl = await uploadPhotoForMms();
        if (!mediaUrl) {
          Alert.alert('Upload Failed', 'Could not upload the photo. Try sending without the photo.');
          setIsSendingSms(false);
          return;
        }
        mediaUrls = [mediaUrl];
      }

      const response = await api.post('/api/sms/send', {
        clientPhone: recipientPhone,
        message: smsMessage,
        mediaUrls,
      });

      if (response.error) {
        if (handleDedicatedNumberError(response)) {
          onClose();
          return;
        }
        handleSmsFallback();
        return;
      }

      Alert.alert('SMS Sent', `Message sent to ${recipientPhone}`);
      onSendSuccess?.();
      onClose();
    } catch {
      handleSmsFallback();
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleSmsFallback = () => {
    Alert.alert(
      'Send via SMS App?',
      'Could not send directly. Would you like to open your messaging app instead?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open SMS App',
          onPress: () => {
            let formattedPhone = recipientPhone?.replace(/\s+/g, '').replace(/^0/, '+61') || '';
            if (formattedPhone && !formattedPhone.startsWith('+')) {
              formattedPhone = '+61' + formattedPhone.replace(/^61/, '');
            }
            const encodedMessage = encodeURIComponent(smsMessage);
            const smsUrl = Platform.OS === 'ios'
              ? `sms:${formattedPhone}&body=${encodedMessage}`
              : `sms:${formattedPhone}?body=${encodedMessage}`;
            Linking.openURL(smsUrl).catch(() => {
              Alert.alert('Error', 'Could not open messaging app.');
            });
          },
        },
      ]
    );
  };

  const applyTemplate = (message: string) => {
    setSmsMessage(message);
  };

  const isEmail = activeTab === 'email';
  const sendDisabled = isEmail
    ? (isSendingEmail || !emailSubject.trim() || !emailBody.trim())
    : (isSendingSms || isUploadingPhoto || !smsMessage.trim());
  const sendBusy = isEmail ? isSendingEmail : (isSendingSms || isUploadingPhoto);
  const sendLabel = isEmail
    ? (isSendingEmail ? 'Sending...' : 'Send Email')
    : (isUploadingPhoto ? 'Uploading photo...' : isSendingSms ? 'Sending...' : attachedPhoto ? 'Send MMS' : 'Send SMS');
  const sendBg = isEmail ? colors.primary : '#16a34a';

  return (
    <AppBottomSheet
      visible={visible}
      onDismiss={onClose}
      title={`Send ${typeLabel}`}
      showCloseButton
      snapPoints={['90%']}
      contentPadding={0}
      footer={(
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.md,
            borderRadius: radius.md,
            backgroundColor: sendBg,
            opacity: sendDisabled ? 0.5 : 1,
            minHeight: 48,
          }}
          onPress={isEmail ? handleSendEmail : handleSendSms}
          disabled={sendDisabled}
          activeOpacity={0.8}
        >
          {sendBusy ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Feather name="send" size={18} color={colors.primaryForeground} />
          )}
          <Text style={[typography.button, { color: colors.primaryForeground }]}>{sendLabel}</Text>
        </TouchableOpacity>
      )}
    >
      <View>
        <Text style={[styles.headerSubtitle, { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }]}>
          {documentTitle ? `"${documentTitle}"` : `this ${documentType}`} to {recipientName}
        </Text>

        <View style={styles.tabsContainer}>
          <PressableRow style={[styles.tab, activeTab === 'email' && styles.tabActive, !hasEmail && styles.tabDisabled]} onPress={() => hasEmail && setActiveTab('email')} disabled={!hasEmail} >
            <Feather
              name="mail"
              size={16}
              color={!hasEmail ? colors.mutedForeground : activeTab === 'email' ? colors.primary : colors.mutedForeground}
            />
            <Text style={[
              styles.tabLabel,
              activeTab === 'email' && styles.tabLabelActive,
              !hasEmail && styles.tabLabelDisabled,
            ]}>
              Email{!hasEmail ? ' (no email)' : ''}
            </Text>
          </PressableRow>

          <PressableRow style={[styles.tab, activeTab === 'sms' && styles.tabActive, !hasPhone && styles.tabDisabled]} onPress={() => hasPhone && setActiveTab('sms')} disabled={!hasPhone} >
            <Feather
              name="message-square"
              size={16}
              color={!hasPhone ? colors.mutedForeground : activeTab === 'sms' ? colors.primary : colors.mutedForeground}
            />
            <Text style={[
              styles.tabLabel,
              activeTab === 'sms' && styles.tabLabelActive,
              !hasPhone && styles.tabLabelDisabled,
            ]}>
              SMS{!hasPhone ? ' (no phone)' : ''}
            </Text>
          </PressableRow>
        </View>

        <View>
          {activeTab === 'email' && (
            <View style={styles.tabContent}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>To</Text>
                <View style={styles.readOnlyField}>
                  <Feather name="mail" size={16} color={colors.mutedForeground} />
                  <Text style={styles.readOnlyText}>{recipientEmail}</Text>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Subject</Text>
                <TextInput
                  style={styles.textInput}
                  value={emailSubject}
                  onChangeText={setEmailSubject}
                  placeholder="Email subject..."
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Message</Text>
                <TextInput
                  style={styles.messageInput}
                  value={emailBody}
                  onChangeText={setEmailBody}
                  placeholder="Write your message..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.infoRow}>
                <Feather name="link" size={14} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.primary }]}>
                  {documentType === 'quote' ? 'A link to view and accept the quote will be included' :
                   documentType === 'invoice' ? 'A payment link will be included in the email' :
                   'Document will be attached as PDF'}
                </Text>
              </View>
            </View>
          )}

          {activeTab === 'sms' && (
            <View style={styles.tabContent}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>To</Text>
                <View style={styles.readOnlyField}>
                  <Feather name="phone" size={16} color={colors.mutedForeground} />
                  <Text style={styles.readOnlyText}>{recipientPhone}</Text>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Quick Templates</Text>
                <View style={styles.chipContainer}>
                  {(SMS_TEMPLATES[documentType] || []).map((template) => (
                    <PressableRow key={template.id} style={[ styles.chip, smsMessage === template.message && styles.chipActive, ]} onPress={() => applyTemplate(template.message)} >
                      <Text style={[
                        styles.chipText,
                        smsMessage === template.message && styles.chipTextActive,
                      ]}>
                        {template.label}
                      </Text>
                    </PressableRow>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Message</Text>
                <TextInput
                  style={styles.messageInput}
                  value={smsMessage}
                  onChangeText={setSmsMessage}
                  placeholder="Type your message..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>
                  {smsMessage.length} characters
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Photo Attachment (MMS)</Text>
                {attachedPhoto ? (
                  <View style={styles.photoPreviewRow}>
                    <Image source={{ uri: attachedPhoto.uri }} style={styles.photoPreviewThumb} />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text style={[styles.chipText, { color: colors.foreground }]} numberOfLines={1}>
                        {attachedPhoto.fileName}
                      </Text>
                      <PressableRow onPress={() => setAttachedPhoto(null)} style={{ marginTop: spacing.xs }}>
                        <Text style={[styles.chipText, { color: colors.destructive || '#ef4444' }]}>Remove</Text>
                      </PressableRow>
                    </View>
                  </View>
                ) : (
                  <View style={styles.photoButtonsRow}>
                    <PressableRow style={styles.photoAttachButton} onPress={handlePickPhoto}>
                      <Feather name="image" size={18} color={colors.primary} />
                      <Text style={[styles.chipText, { color: colors.primary }]}>Gallery</Text>
                    </PressableRow>
                    <PressableRow style={styles.photoAttachButton} onPress={handleTakePhoto}>
                      <Feather name="camera" size={18} color={colors.primary} />
                      <Text style={[styles.chipText, { color: colors.primary }]}>Camera</Text>
                    </PressableRow>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
    </AppBottomSheet>
  );
}

function createStyles(colors: ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: Platform.OS === 'ios' ? spacing['2xl'] : spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    closeButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
    },
    headerSubtitle: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    tabsContainer: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: 'transparent',
    },
    tabActive: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    tabDisabled: {
      opacity: 0.4,
    },
    tabLabel: {
      ...typography.body,
      color: colors.mutedForeground,
    },
    tabLabelActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    tabLabelDisabled: {
      color: colors.mutedForeground,
    },
    content: {
      flex: 1,
    },
    tabContent: {
      padding: spacing.lg,
      gap: spacing.lg,
    },
    fieldGroup: {
      gap: spacing.xs,
    },
    fieldLabel: {
      ...typography.subtitle,
      color: colors.foreground,
    },
    readOnlyField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    readOnlyText: {
      ...typography.body,
      color: colors.mutedForeground,
      flex: 1,
    },
    textInput: {
      ...typography.body,
      color: colors.foreground,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.background,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 44,
    },
    messageInput: {
      ...typography.body,
      color: colors.foreground,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.background,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 120,
      maxHeight: 200,
    },
    charCount: {
      ...typography.caption,
      color: colors.mutedForeground,
      textAlign: 'right',
      marginTop: spacing.xs,
    },
    chipContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.background,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)',
    },
    chipText: {
      ...typography.caption,
      color: colors.mutedForeground,
      fontWeight: '500',
    },
    chipTextActive: {
      color: colors.primary,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.05)',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)',
    },
    infoText: {
      ...typography.caption,
      color: colors.mutedForeground,
      flex: 1,
    },
    sendButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      minHeight: 48,
    },
    emailSendButton: {
      backgroundColor: colors.primary,
    },
    smsSendButton: {
      backgroundColor: '#16a34a',
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    sendButtonText: {
      ...typography.button,
      color: colors.primaryForeground,
    },
    photoPreviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    photoPreviewThumb: {
      width: 56,
      height: 56,
      borderRadius: radius.md,
    },
    photoButtonsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    photoAttachButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.05)',
    },
  });
}
