import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography, fontWeights, iconSizes, shadows } from '../../src/lib/design-tokens';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import api from '../../src/lib/api';

// ─── Persistence ──────────────────────────────────────────────────────────────

const CHAT_STORAGE_KEY = '@help_chat_history';
const MAX_STORED_MESSAGES = 50;

interface RelatedArticle {
  id: string;
  title: string;
  summary: string;
  deeplink?: string;
  mobileDeeplink?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  relatedArticles?: RelatedArticle[];
  deeplink?: string;
  mobileDeeplink?: string;
  confidence?: 'high' | 'medium' | 'low';
}

// ─── Starter prompts ──────────────────────────────────────────────────────────

const STARTERS: { icon: string; label: string; question: string }[] = [
  { icon: 'file-text',   label: 'Create a quote',    question: 'How do I create and send a quote?' },
  { icon: 'users',       label: 'Add team members',  question: 'How do I add a team member?' },
  { icon: 'clock',       label: 'Track time',        question: 'How do I track time on a job?' },
  { icon: 'credit-card', label: 'Take payment',      question: 'How do I take a payment from a client?' },
  { icon: 'calendar',    label: 'Schedule a job',    question: 'How do I schedule a job?' },
  { icon: 'briefcase',   label: 'Manage jobs',       question: 'How do I create and manage jobs?' },
];

// ─── Thinking dots animation ──────────────────────────────────────────────────

function ThinkingDots({ colors }: { colors: ThemeColors }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      );

    const a1 = animateDot(dot1, 0);
    const a2 = animateDot(dot2, 150);
    const a3 = animateDot(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  const dotStyle = (val: Animated.Value) => ({
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primary,
    marginHorizontal: 3,
    opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
      <Animated.View style={dotStyle(dot1)} />
      <Animated.View style={dotStyle(dot2)} />
      <Animated.View style={dotStyle(dot3)} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1, paddingVertical: spacing.lg },

    // Empty state
    emptyContainer: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    emptyIntro: {
      ...typography.body,
      color: colors.mutedForeground,
      lineHeight: 22,
      marginBottom: spacing.xl,
    },
    starterLabel: {
      ...typography.label,
      color: colors.mutedForeground,
      marginBottom: spacing.sm,
    },
    starterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      width: '48%',
      ...shadows.sm,
    },
    starterText: {
      ...typography.bodySmall,
      color: colors.foreground,
      fontWeight: fontWeights.medium,
      flex: 1,
    },

    // Chat bubbles
    bubbleRow: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
      borderRadius: radius.xl,
      borderBottomRightRadius: radius.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      maxWidth: '80%',
    },
    userBubbleText: {
      ...typography.body,
      color: colors.primaryForeground,
    },
    assistantBubble: {
      alignSelf: 'flex-start',
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderBottomLeftRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      maxWidth: '85%',
      ...shadows.sm,
    },
    bubbleLabel: {
      ...typography.captionSmall,
      color: colors.mutedForeground,
      fontWeight: fontWeights.medium,
      marginBottom: 4,
    },
    assistantBubbleText: {
      ...typography.body,
      color: colors.foreground,
      lineHeight: 22,
    },
    thinkingBubble: {
      alignSelf: 'flex-start',
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderBottomLeftRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      ...shadows.sm,
    },

    // Deeplink button
    deeplinkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    deeplinkText: {
      ...typography.bodySmall,
      color: colors.primary,
      fontWeight: fontWeights.medium,
    },

    // Low confidence note
    lowConfidenceText: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: spacing.sm,
      fontStyle: 'italic',
    },

    // Related articles
    relatedLabel: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    relatedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.muted,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      marginBottom: spacing.xs,
      gap: spacing.sm,
    },
    relatedText: {
      ...typography.bodySmall,
      color: colors.foreground,
      flex: 1,
    },

    // Input bar
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
      gap: spacing.sm,
    },
    inputWrapper: {
      flex: 1,
      backgroundColor: colors.muted,
      borderRadius: radius.xl,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      minHeight: 44,
      justifyContent: 'center',
    },
    input: {
      ...typography.body,
      color: colors.foreground,
      paddingVertical: 0,
      maxHeight: 100,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: {
      backgroundColor: colors.muted,
    },
  });

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HelpChatScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomInset = useBottomInset(12);
  const { query } = useLocalSearchParams<{ query?: string }>();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState(query ?? '');
  const [isSending, setIsSending] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  // Load persisted history on mount
  useEffect(() => {
    AsyncStorage.getItem(CHAT_STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setMessages(parsed);
            }
          } catch {
            // ignore malformed data
          }
        }
      })
      .catch(() => {
        // ignore storage errors
      })
      .finally(() => setHistoryLoaded(true));
  }, []);

  // Persist messages whenever they change (after initial load)
  useEffect(() => {
    if (!historyLoaded) return;
    const toSave = messages.slice(-MAX_STORED_MESSAGES);
    AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave)).catch(() => {});
  }, [messages, historyLoaded]);

  // Pre-fill input when launched with a query param from the article search empty state
  useEffect(() => {
    if (query) setInputValue(query);
  }, [query]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setInputValue('');
    setIsSending(true);

    // Optimistically add user message
    const currentMessages = messages;
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);

    try {
      const response = await api.post('/api/help/chat', {
        message: trimmed,
        history: currentMessages.map((m) => ({ role: m.role, content: m.content })),
      });
      const data = response.data as any;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.response ?? 'Sorry, I could not find an answer. Please try rephrasing or contact support.',
          relatedArticles: data.relatedArticles ?? [],
          deeplink: data.deeplink,
          mobileDeeplink: data.mobileDeeplink,
          confidence: data.confidence ?? 'medium',
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Something went wrong. Please try again or contact support at admin@avwebinnovation.com.',
          confidence: 'low',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [messages, isSending]);

  const handleSend = () => sendMessage(inputValue);

  const handleStarter = (text: string) => sendMessage(text);

  const handleDeeplink = (path: string) => {
    router.push(path as any);
  };

  const handleClear = () => {
    setMessages([]);
    AsyncStorage.removeItem(CHAT_STORAGE_KEY).catch(() => {});
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Help Assistant',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: spacing.md }}>
              <Feather name="arrow-left" size={iconSizes.lg} color={colors.foreground} />
            </TouchableOpacity>
          ),
          headerRight: messages.length > 0
            ? () => (
                <TouchableOpacity
                  onPress={handleClear}
                  style={{ paddingHorizontal: spacing.md }}
                >
                  <Text style={{ ...typography.body, color: colors.primary, fontWeight: fontWeights.medium }}>
                    Clear
                  </Text>
                </TouchableOpacity>
              )
            : undefined,
        }}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.container}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              {/* Hero */}
              <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                <View style={{
                  width: 72, height: 72, borderRadius: 36,
                  backgroundColor: colors.primaryLight,
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: spacing.lg,
                }}>
                  <Feather name="message-circle" size={36} color={colors.primary} />
                </View>
                <Text style={{ ...typography.subtitle, color: colors.foreground, textAlign: 'center', marginBottom: spacing.xs }}>
                  What can I help you with?
                </Text>
                <Text style={{ ...typography.body, color: colors.mutedForeground, textAlign: 'center', lineHeight: 22 }}>
                  Ask me anything about using JobRunner — features, settings, and workflows.
                </Text>
              </View>

              {/* 2-column topic grid */}
              <Text style={styles.starterLabel}>QUICK TOPICS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {STARTERS.map((s) => (
                  <TouchableOpacity
                    key={s.label}
                    style={styles.starterBtn}
                    onPress={() => handleStarter(s.question)}
                    activeOpacity={0.7}
                  >
                    <Feather name={s.icon as any} size={18} color={colors.primary} />
                    <Text style={styles.starterText}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{
                ...typography.caption, color: colors.mutedForeground,
                textAlign: 'center', marginTop: spacing.xl, lineHeight: 18,
              }}>
                Or type your own question below
              </Text>
            </View>
          ) : (
            messages.map((msg, idx) => (
              <View key={idx} style={styles.bubbleRow}>
                {msg.role === 'user' ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <View style={styles.userBubble}>
                      <Text style={styles.userBubbleText}>{msg.content}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={{ alignItems: 'flex-start' }}>
                    <Text style={styles.bubbleLabel}>Help Assistant</Text>
                    <View style={styles.assistantBubble}>
                      <Text style={styles.assistantBubbleText}>{msg.content}</Text>

                      {/* Deeplink */}
                      {msg.mobileDeeplink && (
                        <TouchableOpacity
                          style={styles.deeplinkBtn}
                          onPress={() => handleDeeplink(msg.mobileDeeplink!)}
                          activeOpacity={0.7}
                        >
                          <Feather name="arrow-right" size={14} color={colors.primary} />
                          <Text style={styles.deeplinkText}>Take me there</Text>
                        </TouchableOpacity>
                      )}

                      {/* Low confidence note */}
                      {msg.confidence === 'low' && (
                        <Text style={styles.lowConfidenceText}>
                          Not sure about this one. Contact support at admin@avwebinnovation.com if you need more help.
                        </Text>
                      )}

                      {/* Related articles */}
                      {msg.relatedArticles && msg.relatedArticles.length > 0 && (
                        <View style={{ marginTop: spacing.sm }}>
                          <Text style={styles.relatedLabel}>Related articles:</Text>
                          {msg.relatedArticles.map((article) => (
                            <TouchableOpacity
                              key={article.id}
                              style={styles.relatedRow}
                              onPress={() => router.push({ pathname: '/more/support', params: { openArticleId: article.id } } as any)}
                              activeOpacity={0.7}
                            >
                              <Feather name="file-text" size={14} color={colors.mutedForeground} />
                              <Text style={styles.relatedText} numberOfLines={2}>
                                {article.title}
                              </Text>
                              <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            ))
          )}

          {/* Thinking indicator */}
          {isSending && (
            <View style={styles.thinkingBubble}>
              <ThinkingDots colors={colors} />
            </View>
          )}
        </ScrollView>

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(styles.inputBar.paddingBottom as number, bottomInset) }]}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              value={inputValue}
              onChangeText={setInputValue}
              placeholder="Ask anything about JobRunner..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={handleSend}
              editable={!isSending}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, (!inputValue.trim() || isSending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputValue.trim() || isSending}
            activeOpacity={0.8}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Feather name="send" size={iconSizes.md} color={inputValue.trim() ? colors.primaryForeground : colors.mutedForeground} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
