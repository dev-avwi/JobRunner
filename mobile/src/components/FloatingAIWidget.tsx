import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { PressableRow } from './ui/PressableRow';
import { useBottomInset } from './ui/BottomInsetSpacer';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors } from '../lib/colors';
import api from '../lib/api';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.65;

interface AIAction {
  type: 'send_email' | 'send_sms' | 'send_invoice' | 'send_quote' | 'navigate' | 'draft_message' | 'plan_route' | 'view_job' | 'view_quote' | 'view_invoice' | 'view_client' | 'none';
  data?: any;
  confirmationRequired?: boolean;
  message?: string;
}

interface RichContentItem {
  type: 'job_link' | 'quote_link' | 'invoice_link' | 'client_link' | 'action_button';
  id: string;
  label: string;
  url?: string;
  action?: AIAction;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  action?: AIAction;
  suggestedFollowups?: string[];
  richContent?: RichContentItem[];
}

interface FloatingAIWidgetProps {
  isVisible: boolean;
  onClose: () => void;
}

export function FloatingAIWidget({ isVisible, onClose }: FloatingAIWidgetProps) {
  const bottomInset = useBottomInset();
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<AIAction | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      fetchSuggestions();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SHEET_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible]);

  const fetchSuggestions = async () => {
    try {
      const response = await api.get<{ suggestions: string[] }>('/api/ai/suggestions');
      if (response.data?.suggestions) {
        setSuggestions(response.data.suggestions);
      }
    } catch (error) {
      if (__DEV__) console.error('Failed to fetch AI suggestions:', error);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage = text.trim();
    setMessage('');
    setIsLoading(true);
    Keyboard.dismiss();

    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const response = await api.post<{
        response: string;
        action?: AIAction;
        suggestedFollowups?: string[];
        richContent?: RichContentItem[];
      }>('/api/ai/chat', { message: userMessage });

      if (response.data) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: response.data.response,
          action: response.data.action,
          suggestedFollowups: response.data.suggestedFollowups,
          richContent: response.data.richContent,
        };

        setChatHistory(prev => [...prev, assistantMessage]);

        const respAction = response.data?.action;
        if (respAction) {
          if (respAction.type === 'navigate' && !respAction.confirmationRequired) {
            setTimeout(() => {
              handleNavigation(respAction.data?.path);
            }, 1500);
          } else if (respAction.confirmationRequired) {
            setPendingAction(respAction);
          }
        }
      }
    } catch (error) {
      if (__DEV__) console.error('AI chat error:', error);
      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I had trouble processing that. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigation = (path?: string) => {
    if (!path) return;
    onClose();
    
    // Map web paths to mobile routes
    const pathMappings: Record<string, string> = {
      '/jobs': '/(tabs)/jobs',
      '/clients': '/more/clients',
      '/quotes': '/more/quotes',
      '/invoices': '/more/invoices',
      '/calendar': '/more/dispatch-board',
      '/map': '/(tabs)/map',
      '/settings': '/more/business-settings',
    };

    const mobilePath = pathMappings[path] || path;
    router.push(mobilePath as any);
  };

  const handleRichContentClick = (item: RichContentItem) => {
    if (item.type === 'action_button' && item.action) {
      if (item.action.confirmationRequired) {
        setPendingAction(item.action);
      } else {
        executeAction(item.action);
      }
    } else if (item.url) {
      handleNavigation(item.url);
    } else {
      // Navigate based on type
      switch (item.type) {
        case 'job_link':
          router.push(`/job/${item.id}` as any);
          onClose();
          break;
        case 'quote_link':
          router.push(`/more/quote/${item.id}` as any);
          onClose();
          break;
        case 'invoice_link':
          router.push(`/more/invoice/${item.id}` as any);
          onClose();
          break;
        case 'client_link':
          router.push(`/more/client/${item.id}` as any);
          onClose();
          break;
      }
    }
  };

  const executeAction = async (action: AIAction) => {
    try {
      const response = await api.post<{ success: boolean; message: string }>('/api/ai/execute-action', { action });
      
      if (response.data?.success) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: response.data!.message }]);
      } else {
        setChatHistory(prev => [...prev, { role: 'assistant', content: response.data?.message || 'Could not complete that action.' }]);
      }
      setPendingAction(null);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
      setPendingAction(null);
    }
  };

  const confirmAction = () => {
    if (pendingAction) {
      executeAction(pendingAction);
    }
  };

  const cancelAction = () => {
    setPendingAction(null);
    setChatHistory(prev => [...prev, { role: 'assistant', content: 'No worries, cancelled that.' }]);
  };

  const clearChat = () => {
    setChatHistory([]);
    setPendingAction(null);
  };

  const getRichContentIcon = (type: RichContentItem['type']) => {
    switch (type) {
      case 'job_link':
        return <Feather name="briefcase" size={16} color={colors.primary} />;
      case 'quote_link':
        return <Feather name="file-text" size={16} color={colors.primary} />;
      case 'invoice_link':
        return <Feather name="file-text" size={16} color={colors.primary} />;
      case 'client_link':
        return <Feather name="user" size={16} color={colors.primary} />;
      case 'action_button':
        return <Feather name="arrow-right" size={16} color={colors.primary} />;
      default:
        return <Feather name="arrow-right" size={16} color={colors.primary} />;
    }
  };

  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatHistory]);

  if (!isVisible) return null;

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.aiIcon}>
                <Feather name="star" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.headerTitle}>JobRunner AI</Text>
                <Text style={styles.headerSubtitle}>Your smart business mate</Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              {chatHistory.length > 0 && (
                <PressableRow onPress={clearChat} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>Clear</Text>
                </PressableRow>
              )}
              <PressableRow onPress={onClose} style={styles.closeButton}>
                <Feather name="x" size={20} color={colors.foreground} />
              </PressableRow>
            </View>
          </View>

          {/* Chat Content */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatContainer}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
          >
            {chatHistory.length === 0 ? (
              <View style={styles.welcomeContainer}>
                <Text style={styles.welcomeText}>
                  G'day! I can help with emails, invoices, jobs, and more.
                </Text>

                <View style={styles.suggestionsContainer}>
                  <View style={styles.suggestionsHeader}>
                    <Feather name="info" size={14} color={colors.mutedForeground} />
                    <Text style={styles.suggestionsTitle}>Quick actions:</Text>
                  </View>

                  {(suggestions.length > 0 ? suggestions.slice(0, 4) : [
                    "What needs my attention today?",
                    "Help me chase up overdue payments",
                    "Draft a follow-up email for a quote",
                    "Show me this week's jobs",
                  ]).map((suggestion, index) => (
                    <PressableRow key={index} onPress={() => sendMessage(suggestion)} style={styles.suggestionButton} >
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </PressableRow>
                  ))}
                </View>
              </View>
            ) : (
              chatHistory.map((msg, index) => (
                <View key={index}>
                  <View
                    style={[
                      styles.messageBubble,
                      msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
                    ]}
                  >
                    <Text style={styles.messageText}>{msg.content}</Text>

                    {/* Rich Content */}
                    {msg.role === 'assistant' && msg.richContent && msg.richContent.length > 0 && (
                      <View style={styles.richContentContainer}>
                        {msg.richContent.filter(item => item.type !== 'action_button').map((item) => (
                          <PressableRow key={item.id} onPress={() => handleRichContentClick(item)} style={styles.richContentItem} >
                            {getRichContentIcon(item.type)}
                            <Text style={styles.richContentLabel}>{item.label}</Text>
                            <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
                          </PressableRow>
                        ))}

                        {msg.richContent.filter(item => item.type === 'action_button').map((item) => (
                          <PressableRow key={item.id} onPress={() => handleRichContentClick(item)} style={styles.actionButton} >
                            {item.label.includes('Map') && <Feather name="map-pin" size={14} color={colors.primaryForeground} />}
                            <Text style={styles.actionButtonText}>{item.label}</Text>
                          </PressableRow>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Pending Action Confirmation */}
                  {msg.role === 'assistant' && pendingAction && index === chatHistory.length - 1 && (
                    <View style={styles.confirmationButtons}>
                      <PressableRow onPress={confirmAction} style={styles.confirmButton}>
                        <Feather name="check" size={16} color={colors.primaryForeground} />
                        <Text style={styles.confirmButtonText}>
                          {pendingAction.type === 'send_email' ? 'Send it' : 'Do it'}
                        </Text>
                      </PressableRow>
                      <PressableRow onPress={cancelAction} style={styles.cancelButton}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </PressableRow>
                    </View>
                  )}

                  {/* Follow-up Suggestions */}
                  {msg.role === 'assistant' && msg.suggestedFollowups && msg.suggestedFollowups.length > 0 && index === chatHistory.length - 1 && !pendingAction && (
                    <View style={styles.followupContainer}>
                      {msg.suggestedFollowups.slice(0, 3).map((followup, i) => (
                        <PressableRow key={i} onPress={() => sendMessage(followup)} style={styles.followupButton} >
                          <Text style={styles.followupText}>{followup}</Text>
                        </PressableRow>
                      ))}
                    </View>
                  )}
                </View>
              ))
            )}

            {isLoading && (
              <View style={styles.loadingBubble}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Thinking...</Text>
              </View>
            )}
          </ScrollView>

          {/* Input */}
          <View style={[styles.inputContainer, { paddingBottom: 12 + bottomInset }]}>
            <TextInput
              style={styles.input}
              placeholder="Ask me anything..."
              placeholderTextColor={colors.mutedForeground}
              value={message}
              onChangeText={setMessage}
              onSubmitEditing={() => sendMessage(message)}
              returnKeyType="send"
              multiline={false}
            />
            <PressableRow onPress={() => sendMessage(message)} disabled={!message.trim() || isLoading} style={[ styles.sendButton, (!message.trim() || isLoading) && styles.sendButtonDisabled, ]} >
              <Feather name="send" size={20} color={colors.primaryForeground} />
            </PressableRow>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

// Floating button component to trigger the widget
export function FloatingAIButton({ onPress }: { onPress: () => void }) {
  return (
    <PressableRow onPress={onPress} style={styles.floatingButton} >
      <Feather name="star" size={24} color={colors.primaryForeground} />
    </PressableRow>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SHEET_HEIGHT,
    minHeight: SHEET_HEIGHT,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.muted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aiIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${colors.primary}25`,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.foreground,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearButtonText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatContainer: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 8,
  },
  welcomeContainer: {
    paddingVertical: 8,
  },
  welcomeText: {
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 16,
  },
  suggestionsContainer: {
    gap: 8,
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.mutedForeground,
  },
  suggestionButton: {
    backgroundColor: `${colors.primary}08`,
    borderWidth: 1,
    borderColor: `${colors.primary}15`,
    borderRadius: 12,
    padding: 14,
  },
  suggestionText: {
    fontSize: 14,
    color: colors.foreground,
  },
  messageBubble: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: colors.muted,
    alignSelf: 'flex-end',
    marginLeft: 40,
  },
  assistantBubble: {
    backgroundColor: `${colors.primary}08`,
    borderWidth: 1,
    borderColor: `${colors.primary}12`,
    alignSelf: 'flex-start',
    marginRight: 40,
  },
  messageText: {
    fontSize: 14,
    color: colors.foreground,
    lineHeight: 20,
  },
  richContentContainer: {
    marginTop: 12,
    gap: 8,
  },
  richContentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${colors.primary}10`,
    borderWidth: 1,
    borderColor: `${colors.primary}18`,
    borderRadius: 10,
    padding: 10,
  },
  richContentLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
    marginRight: 40,
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryForeground,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: 14,
    color: colors.foreground,
  },
  followupContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    marginBottom: 8,
    marginRight: 40,
  },
  followupButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
  },
  followupText: {
    fontSize: 12,
    color: colors.primary,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${colors.primary}08`,
    borderWidth: 1,
    borderColor: `${colors.primary}12`,
    borderRadius: 16,
    padding: 12,
    alignSelf: 'flex-start',
    marginRight: 40,
  },
  loadingText: {
    fontSize: 13,
    color: colors.mutedForeground,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: colors.muted,
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.foreground,
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
  floatingButton: {
    position: 'absolute',
    right: 16,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
});
