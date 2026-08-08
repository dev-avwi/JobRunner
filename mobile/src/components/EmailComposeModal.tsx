import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from './ui/PressableRow';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, radius, shadows, typography } from '../lib/design-tokens';
import { api } from '../lib/api';

// Email app options for the selector
type EmailAppOption = 'gmail' | 'outlook' | 'apple' | 'default';

interface AIEmailSuggestion {
  subject: string;
  greeting: string;
  body: string;
  closing: string;
  fullMessage: string;
}

interface EmailComposeModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'quote' | 'invoice' | 'receipt';
  documentId: string;
  clientName: string;
  clientEmail: string;
  documentNumber: string;
  documentTitle: string;
  total: string;
  businessName?: string;
  publicUrl?: string;
  onSend: (customSubject: string, customMessage: string) => Promise<void>;
  onOpenWithEmailApp?: (subject: string, message: string, app: EmailAppOption) => Promise<void>;
}

type TabKey = 'compose' | 'ai' | 'preview';

export function EmailComposeModal({
  visible,
  onClose,
  type,
  documentId,
  clientName,
  clientEmail,
  documentNumber,
  documentTitle,
  total,
  businessName,
  publicUrl,
  onSend,
  onOpenWithEmailApp,
}: EmailComposeModalProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [activeTab, setActiveTab] = useState<TabKey>('compose');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AIEmailSuggestion | null>(null);
  // Track the document ID and type to detect when we need to reinitialize
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [showEmailAppSelector, setShowEmailAppSelector] = useState(false);
  const [isOpeningEmailApp, setIsOpeningEmailApp] = useState(false);

  const clientFirstName = useMemo(() => clientName?.split(' ')[0] || 'there', [clientName]);

  // Create a unique key for this document to detect when we need to reinitialize
  const documentKey = `${type}-${documentId}-${documentNumber}`;

  useEffect(() => {
    if (visible && initializedFor !== documentKey) {
      // Initialize/reinitialize for this specific document
      let defaultSubject: string;
      let defaultMessage: string;

      if (type === 'quote') {
        defaultSubject = `Quote ${documentNumber} from ${businessName || 'Us'}`;
        defaultMessage = `Hi ${clientFirstName},\n\nPlease find attached your quote for ${documentTitle}.\n\nTotal: ${total}\n\nIf you have any questions, please don't hesitate to reach out.\n\nKind regards,\n${businessName || 'Your Business'}`;
      } else if (type === 'invoice') {
        defaultSubject = `Invoice ${documentNumber} from ${businessName || 'Us'}`;
        defaultMessage = `Hi ${clientFirstName},\n\nPlease find attached your invoice for ${documentTitle}.\n\nTotal: ${total}\n\nPayment is due within 14 days.\n\nThank you for your business.\n\nKind regards,\n${businessName || 'Your Business'}`;
      } else {
        // Receipt
        defaultSubject = `Payment Receipt ${documentNumber} from ${businessName || 'Us'}`;
        defaultMessage = `Hi ${clientFirstName},\n\nThank you for your payment!\n\nPlease find attached your receipt for ${total}.\n\nWe appreciate your business.\n\nKind regards,\n${businessName || 'Your Business'}`;
      }

      setSubject(defaultSubject);
      setMessage(defaultMessage);
      setAiSuggestion(null);
      setActiveTab('compose');
      setIsSending(false);
      setIsGeneratingAI(false);
      setInitializedFor(documentKey);
    } else if (!visible) {
      // Reset all state when modal closes - important for clean reopen
      setInitializedFor(null);
      setSubject('');
      setMessage('');
      setAiSuggestion(null);
      setActiveTab('compose');
      setIsSending(false);
      setIsGeneratingAI(false);
    }
  }, [visible, documentKey, initializedFor, type, documentNumber, documentTitle, total, businessName, clientFirstName]);

  const generateAISuggestion = useCallback(async () => {
    setIsGeneratingAI(true);
    try {
      const response = await api.post<AIEmailSuggestion>('/api/ai/email-suggestion', {
        type,
        documentId,
        clientName,
        documentNumber,
        documentTitle,
        total,
        businessName,
      });

      if (response.data) {
        setAiSuggestion(response.data);
      }
    } catch (error) {
      if (__DEV__) console.error('AI suggestion error:', error);
      Alert.alert('Error', 'Failed to generate AI suggestion. Please try again.');
    } finally {
      setIsGeneratingAI(false);
    }
  }, [type, documentId, clientName, documentNumber, documentTitle, total, businessName]);

  const applyAISuggestion = () => {
    if (aiSuggestion) {
      setSubject(aiSuggestion.subject);
      setMessage(aiSuggestion.fullMessage);
      setActiveTab('compose');
    }
  };

  // Quick tone adjustments with Australian English (matches web app)
  const adjustTone = (tone: 'formal' | 'friendly' | 'brief') => {
    let toneMessage: string;
    
    if (type === 'quote') {
      if (tone === 'formal') {
        toneMessage = `Dear ${clientFirstName},\n\nPlease find attached the quotation for "${documentTitle}" as requested.\n\nThe quoted amount is ${total}. This quote remains valid for 30 days from the date of issue.\n\nShould you have any queries or require clarification, please do not hesitate to contact us.\n\nKind regards,\n${businessName || 'Your Business'}`;
      } else if (tone === 'friendly') {
        toneMessage = `Hey ${clientFirstName}!\n\nGreat chatting with you - here's the quote we discussed for "${documentTitle}".\n\nIt comes to ${total} all up. Let me know if you've got any questions or want to tweak anything!\n\nCheers mate,\n${businessName || 'Your Business'}`;
      } else {
        toneMessage = `Hi ${clientFirstName},\n\nAttached: Quote for "${documentTitle}" - ${total}.\n\nAny questions, just ask.\n\nCheers,\n${businessName || 'Your Business'}`;
      }
    } else if (type === 'invoice') {
      if (tone === 'formal') {
        toneMessage = `Dear ${clientFirstName},\n\nPlease find attached your tax invoice for "${documentTitle}".\n\nThe total amount payable is ${total}. Payment is due within the terms specified on the invoice.\n\nShould you have any queries regarding this invoice, please do not hesitate to contact us.\n\nKind regards,\n${businessName || 'Your Business'}`;
      } else if (tone === 'friendly') {
        toneMessage = `Hey ${clientFirstName}!\n\nJust popping this invoice through for "${documentTitle}".\n\nThe total is ${total}. You can pay online using the link below - super easy!\n\nThanks heaps for your custom - really appreciate it!\n\nCheers mate,\n${businessName || 'Your Business'}`;
      } else {
        toneMessage = `Hi ${clientFirstName},\n\nAttached: Invoice for "${documentTitle}" - ${total}.\n\nPayment link included.\n\nCheers,\n${businessName || 'Your Business'}`;
      }
    } else {
      // Receipt
      if (tone === 'formal') {
        toneMessage = `Dear ${clientFirstName},\n\nThank you for your recent payment.\n\nPlease find attached your official receipt for ${total}.\n\nWe appreciate your prompt payment and look forward to being of service again.\n\nKind regards,\n${businessName || 'Your Business'}`;
      } else if (tone === 'friendly') {
        toneMessage = `Hey ${clientFirstName}!\n\nThanks heaps for the payment!\n\nHere's your receipt for ${total} - all sorted!\n\nReally appreciate your business mate!\n\nCheers,\n${businessName || 'Your Business'}`;
      } else {
        toneMessage = `Hi ${clientFirstName},\n\nAttached: Receipt for ${total}.\n\nThanks for your payment!\n\nCheers,\n${businessName || 'Your Business'}`;
      }
    }
    
    setMessage(toneMessage);
  };

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Missing Information', 'Please enter both subject and message.');
      return;
    }

    setIsSending(true);
    try {
      await onSend(subject, message);
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to send email. Please try again.';
      Alert.alert('Send Failed', errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  // Open email in external app with composed message
  const openEmailInApp = async (app: EmailAppOption) => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Missing Information', 'Please enter both subject and message.');
      return;
    }

    setIsOpeningEmailApp(true);
    setShowEmailAppSelector(false);

    try {
      // Build the email body with public URL if available
      let fullBody = message;
      if (publicUrl) {
        fullBody += `\n\n---\nView ${type === 'quote' ? 'Quote' : type === 'invoice' ? 'Invoice' : 'Receipt'}: ${publicUrl}`;
      }

      const encodedSubject = encodeURIComponent(subject);
      const encodedBody = encodeURIComponent(fullBody);
      const encodedEmail = encodeURIComponent(clientEmail);

      let url: string;

      switch (app) {
        case 'gmail':
          // Gmail app URL scheme with compose
          url = `googlegmail://co?to=${encodedEmail}&subject=${encodedSubject}&body=${encodedBody}`;
          break;
        case 'outlook':
          // Outlook app URL scheme
          url = `ms-outlook://compose?to=${encodedEmail}&subject=${encodedSubject}&body=${encodedBody}`;
          break;
        case 'apple':
        case 'default':
        default:
          // Standard mailto for Apple Mail and default
          url = `mailto:${clientEmail}?subject=${encodedSubject}&body=${encodedBody}`;
          break;
      }

      const canOpen = await Linking.canOpenURL(url);
      let emailOpened = false;
      let usedFallback = false;
      
      if (canOpen) {
        await Linking.openURL(url);
        emailOpened = true;
      } else if (app !== 'apple' && app !== 'default') {
        // Specific app not installed, try mailto fallback
        const mailtoUrl = `mailto:${clientEmail}?subject=${encodedSubject}&body=${encodedBody}`;
        const canOpenMailto = await Linking.canOpenURL(mailtoUrl);
        
        if (canOpenMailto) {
          await Linking.openURL(mailtoUrl);
          emailOpened = true;
          usedFallback = true;
        }
      }

      if (emailOpened) {
        // Always call callback when email was opened (even via fallback)
        if (onOpenWithEmailApp) {
          await onOpenWithEmailApp(subject, message, usedFallback ? 'default' : app);
        }
        
        // Ask if they want to mark as sent
        const appName = usedFallback ? 'your default email app' : 
          (app === 'gmail' ? 'Gmail' : app === 'outlook' ? 'Outlook' : 'your email app');
        
        setTimeout(() => {
          Alert.alert(
            'Email Opened',
            `Your ${type === 'quote' ? 'quote' : type === 'invoice' ? 'invoice' : 'receipt'} message is ready in ${appName}.\n\nNote: To attach the PDF, go back and use "Use JobRunner" which sends it automatically.\n\nMark as sent?`,
            [
              { text: 'Not Yet', style: 'cancel' },
              { 
                text: 'Mark as Sent',
                onPress: () => {
                  onClose();
                }
              },
            ]
          );
        }, 500);
      } else {
        Alert.alert(
          'Email App Not Found',
          `Couldn't open ${app === 'gmail' ? 'Gmail' : app === 'outlook' ? 'Outlook' : 'email app'}. Please make sure it's installed, or try "Use JobRunner" to send with PDF attached.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      if (__DEV__) console.error('Error opening email app:', error);
      Alert.alert('Error', 'Failed to open email app. Please try again.');
    } finally {
      setIsOpeningEmailApp(false);
    }
  };

  const showEmailAppOptions = () => {
    if (Platform.OS === 'ios') {
      Alert.alert(
        'Choose Email App',
        'Select which app to compose your email in',
        [
          { text: 'Gmail', onPress: () => openEmailInApp('gmail') },
          { text: 'Outlook', onPress: () => openEmailInApp('outlook') },
          { text: 'Apple Mail', onPress: () => openEmailInApp('apple') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      setShowEmailAppSelector(true);
    }
  };

  const tabs: { key: TabKey; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: 'compose', label: 'Compose', icon: 'edit-3' },
    { key: 'ai', label: 'AI Assist', icon: 'zap' },
    { key: 'preview', label: 'Preview', icon: 'eye' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        // iOS pageSheet modals sit ~status-bar height below the window top;
        // compensate so keyboard padding isn't short by that gap.
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <PressableRow onPress={onClose} style={styles.closeButton}>
            <Feather name="x" size={24} color={colors.foreground} />
          </PressableRow>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {type === 'quote' ? 'Send Quote' : type === 'invoice' ? 'Send Invoice' : 'Send Receipt'}
            </Text>
            <Text style={styles.headerSubtitle}>to {clientName}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {tabs.map((tab) => (
            <TouchableOpacity key={tab.key} activeOpacity={0.7} style={[styles.tab, activeTab === tab.key && styles.tabActive]} onPress={() => setActiveTab(tab.key)} >
              <Feather
                name={tab.icon}
                size={16}
                color={activeTab === tab.key ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === tab.key && styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Compose Tab */}
          {activeTab === 'compose' && (
            <View style={styles.composeContent}>
              {/* Recipient Info */}
              <View style={styles.recipientCard}>
                <View style={styles.recipientRow}>
                  <Feather name="mail" size={16} color={colors.mutedForeground} />
                  <Text style={styles.recipientLabel}>To:</Text>
                  <Text style={styles.recipientEmail}>{clientEmail}</Text>
                </View>
              </View>

              {/* Subject */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Subject</Text>
                <TextInput
                  style={styles.subjectInput}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Email subject..."
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              {/* Message */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Message</Text>
                <TextInput
                  style={styles.messageInput}
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Write your message..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {/* Quick Actions */}
              <View style={styles.quickActions}>
                <PressableRow style={styles.quickActionButton} onPress={() => setActiveTab('ai')} >
                  <Feather name="zap" size={16} color={colors.primary} />
                  <Text style={styles.quickActionText}>AI</Text>
                </PressableRow>
                
                {/* Tone adjustment buttons like web app */}
                <PressableRow style={styles.toneButton} onPress={() => adjustTone('friendly')} >
                  <Text style={styles.toneButtonText}>Friendly</Text>
                </PressableRow>
                <PressableRow style={styles.toneButton} onPress={() => adjustTone('formal')} >
                  <Text style={styles.toneButtonText}>Formal</Text>
                </PressableRow>
                <PressableRow style={styles.toneButton} onPress={() => adjustTone('brief')} >
                  <Text style={styles.toneButtonText}>Brief</Text>
                </PressableRow>
              </View>
              
              {/* Info about auto-attached content */}
              <View style={styles.autoIncludedInfo}>
                <Feather name="paperclip" size={14} color={colors.mutedForeground} />
                <Text style={styles.autoIncludedText}>
                  {type === 'receipt' ? 'PDF attached automatically' : 'PDF + payment link included automatically'}
                </Text>
              </View>
            </View>
          )}

          {/* AI Tab */}
          {activeTab === 'ai' && (
            <View style={styles.aiContent}>
              <View style={styles.aiHeader}>
                <View style={styles.aiIconContainer}>
                  <Feather name="zap" size={24} color={colors.primary} />
                </View>
                <Text style={styles.aiTitle}>AI Email Assistant</Text>
                <Text style={styles.aiDescription}>
                  Generate a professional email tailored to your {type} and client
                </Text>
              </View>

              {!aiSuggestion && !isGeneratingAI && (
                <PressableRow style={styles.generateButton} onPress={generateAISuggestion} >
                  <Feather name="zap" size={18} color={colors.primaryForeground} />
                  <Text style={styles.generateButtonText}>Generate AI Suggestion</Text>
                </PressableRow>
              )}

              {isGeneratingAI && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Generating professional email...</Text>
                </View>
              )}

              {aiSuggestion && !isGeneratingAI && (
                <View style={styles.suggestionContainer}>
                  <View style={styles.suggestionCard}>
                    <Text style={styles.suggestionLabel}>Subject</Text>
                    <Text style={styles.suggestionText}>{aiSuggestion.subject}</Text>
                  </View>

                  <View style={styles.suggestionCard}>
                    <Text style={styles.suggestionLabel}>Message</Text>
                    <Text style={styles.suggestionText}>{aiSuggestion.fullMessage}</Text>
                  </View>

                  <View style={styles.suggestionActions}>
                    <PressableRow style={styles.applyButton} onPress={applyAISuggestion} >
                      <Feather name="check" size={16} color={colors.primaryForeground} />
                      <Text style={styles.applyButtonText}>Use This Email</Text>
                    </PressableRow>

                    <PressableRow style={styles.regenerateButton} onPress={generateAISuggestion} >
                      <Feather name="refresh-cw" size={16} color={colors.foreground} />
                      <Text style={styles.regenerateButtonText}>Regenerate</Text>
                    </PressableRow>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <View style={styles.previewContent}>
              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewLabel}>From</Text>
                  <Text style={styles.previewValue}>{businessName || 'Your Business'}</Text>
                </View>

                <View style={styles.previewHeader}>
                  <Text style={styles.previewLabel}>To</Text>
                  <Text style={styles.previewValue}>{clientEmail}</Text>
                </View>

                <View style={styles.previewHeader}>
                  <Text style={styles.previewLabel}>Subject</Text>
                  <Text style={styles.previewSubject}>{subject}</Text>
                </View>

                <View style={styles.previewDivider} />

                <Text style={styles.previewMessage}>{message}</Text>

                {publicUrl && (
                  <View style={styles.attachmentPreview}>
                    <Feather name="paperclip" size={16} color={colors.mutedForeground} />
                    <Text style={styles.attachmentText}>
                      {type === 'quote' ? 'Quote PDF' : type === 'invoice' ? 'Invoice PDF' : 'Receipt PDF'} will be attached
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer with Send Options */}
        <View style={styles.footer}>
          <View style={styles.footerButtons}>
            {/* Primary: Use JobRunner (backend send) */}
            <TouchableOpacity activeOpacity={0.8} onPress={handleSend} disabled={isSending || isOpeningEmailApp || !subject.trim() || !message.trim()} style={[ styles.footerButton, styles.footerButtonPrimary, (isSending || !subject.trim() || !message.trim()) && styles.footerButtonDisabled ]} >
              {isSending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="send" size={18} color={colors.primaryForeground} />
                  <Text style={styles.footerButtonPrimaryText}>Use JobRunner</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Secondary: Open with Email App */}
            <TouchableOpacity activeOpacity={0.8} onPress={showEmailAppOptions} disabled={isSending || isOpeningEmailApp || !subject.trim() || !message.trim()} style={[ styles.footerButton, styles.footerButtonSecondary, (isOpeningEmailApp || !subject.trim() || !message.trim()) && styles.footerButtonDisabled ]} >
              {isOpeningEmailApp ? (
                <ActivityIndicator size="small" color={colors.foreground} />
              ) : (
                <>
                  <Feather name="external-link" size={18} color={colors.foreground} />
                  <Text style={styles.footerButtonSecondaryText}>Open Email App</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.footerHint}>
            JobRunner sends automatically with PDF attached. Email App lets you review first.
          </Text>
        </View>
      </KeyboardAvoidingView>

      {/* Android Email App Selector Modal */}
      {Platform.OS === 'android' && (
        <Modal
          visible={showEmailAppSelector}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEmailAppSelector(false)}
        >
          <TouchableOpacity
            style={styles.emailAppOverlay}
            activeOpacity={1}
            onPress={() => setShowEmailAppSelector(false)}
          >
            <View style={styles.emailAppModal}>
              <Text style={styles.emailAppTitle}>Choose Email App</Text>
              <Text style={styles.emailAppSubtitle}>
                Select which app to compose your email in
              </Text>

              <PressableRow style={styles.emailAppOption} onPress={() => openEmailInApp('gmail')} >
                <View style={[styles.emailAppIcon, { backgroundColor: '#EA4335' }]}>
                  <Feather name="mail" size={20} color={colors.white} />
                </View>
                <Text style={styles.emailAppLabel}>Gmail</Text>
              </PressableRow>

              <PressableRow style={styles.emailAppOption} onPress={() => openEmailInApp('outlook')} >
                <View style={[styles.emailAppIcon, { backgroundColor: '#0078D4' }]}>
                  <Feather name="mail" size={20} color={colors.white} />
                </View>
                <Text style={styles.emailAppLabel}>Outlook</Text>
              </PressableRow>

              <PressableRow style={styles.emailAppOption} onPress={() => openEmailInApp('default')} >
                <View style={[styles.emailAppIcon, { backgroundColor: colors.muted }]}>
                  <Feather name="mail" size={20} color={colors.foreground} />
                </View>
                <Text style={styles.emailAppLabel}>Default Email</Text>
              </PressableRow>

              <PressableRow style={styles.emailAppCancel} onPress={() => setShowEmailAppSelector(false)} >
                <Text style={styles.emailAppCancelText}>Cancel</Text>
              </PressableRow>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </Modal>
  );
}

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingTop: spacing['2xl'],
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    closeButton: {
      padding: spacing.xs,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.foreground,
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    sendButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      gap: spacing.xs,
    },
    sendButtonDisabled: {
      opacity: 0.6,
    },
    sendButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primaryForeground,
    },
    tabsContainer: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      gap: spacing.xs,
      backgroundColor: colors.muted,
    },
    tabActive: {
      backgroundColor: colors.primaryLight,
    },
    tabLabel: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontWeight: '500',
    },
    tabLabelActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    content: {
      flex: 1,
    },
    composeContent: {
      padding: spacing.lg,
    },
    recipientCard: {
      backgroundColor: colors.muted,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    recipientRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    recipientLabel: {
      fontSize: 13,
      color: colors.mutedForeground,
    },
    recipientEmail: {
      fontSize: 14,
      color: colors.foreground,
      fontWeight: '500',
    },
    inputGroup: {
      marginBottom: spacing.lg,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.foreground,
      marginBottom: spacing.sm,
    },
    subjectInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 15,
      color: colors.foreground,
    },
    messageInput: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 15,
      color: colors.foreground,
      minHeight: 200,
    },
    quickActions: {
      marginTop: spacing.md,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    quickActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      gap: spacing.xs,
    },
    quickActionText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    toneButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toneButtonText: {
      fontSize: 13,
      color: colors.foreground,
    },
    autoIncludedInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.cardHover,
      borderRadius: radius.md,
    },
    autoIncludedText: {
      fontSize: 12,
      color: colors.mutedForeground,
    },
    aiContent: {
      padding: spacing.lg,
    },
    aiHeader: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    aiIconContainer: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    aiTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.foreground,
      marginBottom: spacing.xs,
    },
    aiDescription: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
    },
    generateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: spacing.lg,
      borderRadius: radius.xl,
      gap: spacing.sm,
    },
    generateButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.primaryForeground,
    },
    loadingContainer: {
      alignItems: 'center',
      paddingVertical: spacing['2xl'],
    },
    loadingText: {
      fontSize: 14,
      color: colors.mutedForeground,
      marginTop: spacing.md,
    },
    suggestionContainer: {
      gap: spacing.md,
    },
    suggestionCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    suggestionLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.mutedForeground,
      marginBottom: spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    suggestionText: {
      fontSize: 14,
      color: colors.foreground,
      lineHeight: 20,
    },
    suggestionActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    applyButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      gap: spacing.sm,
    },
    applyButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primaryForeground,
    },
    regenerateButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.muted,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    regenerateButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
    },
    previewContent: {
      padding: spacing.lg,
    },
    previewCard: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewHeader: {
      marginBottom: spacing.md,
    },
    previewLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    previewValue: {
      fontSize: 14,
      color: colors.foreground,
    },
    previewSubject: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.foreground,
    },
    previewDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.lg,
    },
    previewMessage: {
      fontSize: 14,
      color: colors.foreground,
      lineHeight: 22,
    },
    attachmentPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.muted,
      padding: spacing.md,
      borderRadius: radius.lg,
      marginTop: spacing.lg,
    },
    attachmentText: {
      fontSize: 13,
      color: colors.mutedForeground,
    },
    // Footer styles
    footer: {
      padding: spacing.md,
      paddingBottom: spacing.xl,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.card,
    },
    footerButtons: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    footerButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      gap: spacing.sm,
    },
    footerButtonPrimary: {
      backgroundColor: colors.primary,
    },
    footerButtonSecondary: {
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    footerButtonDisabled: {
      opacity: 0.5,
    },
    footerButtonPrimaryText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primaryForeground,
    },
    footerButtonSecondaryText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.foreground,
    },
    footerHint: {
      fontSize: 11,
      color: colors.mutedForeground,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    // Email app selector styles (Android)
    emailAppOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    emailAppModal: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.lg,
      paddingBottom: spacing['2xl'],
    },
    emailAppTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.foreground,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    emailAppSubtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    emailAppOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      backgroundColor: colors.muted,
      borderRadius: radius.lg,
      marginBottom: spacing.sm,
      gap: spacing.md,
    },
    emailAppIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emailAppLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.foreground,
    },
    emailAppCancel: {
      alignItems: 'center',
      paddingVertical: spacing.md,
      marginTop: spacing.sm,
    },
    emailAppCancelText: {
      fontSize: 16,
      color: colors.mutedForeground,
      fontWeight: '500',
    },
  });

export default EmailComposeModal;
