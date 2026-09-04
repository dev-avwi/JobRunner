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
import { HELP_ARTICLES } from '../../src/data/helpArticles';

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

// ─── Local keyword fallback ───────────────────────────────────────────────────

const SORRY_PATTERN = /sorry|could not find|don't know|unable to|not sure|can't help/i;

function localSearch(query: string, limit = 3): RelatedArticle[] {
  const words = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  if (words.length === 0) return [];

  return HELP_ARTICLES
    .map(a => {
      const hay = `${a.title} ${a.summary} ${a.body}`.toLowerCase();
      const score = words.reduce((acc, w) => {
        // Title match counts more
        const titleHits = (a.title.toLowerCase().match(new RegExp(w, 'g')) ?? []).length * 3;
        const bodyHits  = (hay.match(new RegExp(w, 'g')) ?? []).length;
        return acc + titleHits + bodyHits;
      }, 0);
      return { article: a, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ article: a }) => ({
      id: a.id,
      title: a.title,
      summary: a.summary,
      deeplink: a.deeplink,
      mobileDeeplink: a.mobileDeeplink,
    }));
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

// ─── Simple markdown renderer ─────────────────────────────────────────────────

function renderMarkdown(text: string, colors: ThemeColors): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let key = 0;

  const renderInline = (line: string, baseStyle: any): React.ReactNode => {
    // Parse **bold** inline
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    if (parts.length === 1) return <Text style={baseStyle}>{line}</Text>;
    return (
      <Text style={baseStyle}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <Text key={i} style={[baseStyle, { fontWeight: fontWeights.semibold }]}>{part.slice(2, -2)}</Text>;
          }
          return <Text key={i}>{part}</Text>;
        })}
      </Text>
    );
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      nodes.push(
        <Text key={key++} style={{
          ...typography.body,
          fontWeight: fontWeights.semibold,
          color: colors.foreground,
          marginTop: i === 0 ? 0 : spacing.sm,
          marginBottom: 2,
        }}>
          {line.slice(3)}
        </Text>
      );
    } else if (line.startsWith('### ')) {
      nodes.push(
        <Text key={key++} style={{
          ...typography.bodySmall,
          fontWeight: fontWeights.semibold,
          color: colors.foreground,
          marginTop: i === 0 ? 0 : spacing.xs,
          marginBottom: 1,
        }}>
          {line.slice(4)}
        </Text>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      nodes.push(
        <View key={key++} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2 }}>
          <Text style={{ ...typography.body, color: colors.mutedForeground, marginRight: 6, marginTop: 1 }}>•</Text>
          <View style={{ flex: 1 }}>
            {renderInline(line.slice(2), { ...typography.body, color: colors.foreground, lineHeight: 22 })}
          </View>
        </View>
      );
    } else if (line.trim() === '') {
      if (i > 0 && i < lines.length - 1) {
        nodes.push(<View key={key++} style={{ height: spacing.xs }} />);
      }
    } else if (line.match(/^\d+\.\s/)) {
      const num = line.match(/^(\d+)\.\s(.*)/)!;
      nodes.push(
        <View key={key++} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2 }}>
          <Text style={{ ...typography.body, color: colors.mutedForeground, marginRight: 6, minWidth: 16 }}>{num[1]}.</Text>
          <View style={{ flex: 1 }}>
            {renderInline(num[2], { ...typography.body, color: colors.foreground, lineHeight: 22 })}
          </View>
        </View>
      );
    } else {
      nodes.push(
        <View key={key++} style={{ marginBottom: 1 }}>
          {renderInline(line, { ...typography.body, color: colors.foreground, lineHeight: 22 })}
        </View>
      );
    }
    i++;
  }

  return nodes;
}

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
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: colors.mutedForeground,
    marginHorizontal: 2.5,
    opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [{ translateY: val.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 }}>
      <Animated.View style={dotStyle(dot1)} />
      <Animated.View style={dotStyle(dot2)} />
      <Animated.View style={dotStyle(dot3)} />
    </View>
  );
}

// ─── Assistant avatar ─────────────────────────────────────────────────────────

function AssistantAvatar({ colors }: { colors: ThemeColors }) {
  return (
    <View style={{
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: colors.primaryLight,
      alignItems: 'center', justifyContent: 'center',
      marginRight: spacing.sm,
      flexShrink: 0,
    }}>
      <Feather name="cpu" size={13} color={colors.primary} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scrollContent: { flexGrow: 1, paddingTop: spacing.md, paddingBottom: spacing.lg },

    // Empty state
    emptyContainer: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
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

    // Chat rows
    bubbleRow: {
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },

    // User bubble
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary,
      borderRadius: 20,
      borderBottomRightRadius: 5,
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
      maxWidth: '82%',
    },
    userBubbleText: {
      ...typography.body,
      color: colors.primaryForeground,
      lineHeight: 22,
    },

    // Assistant bubble
    assistantRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    assistantBubble: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 20,
      borderBottomLeftRadius: 5,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingVertical: 12,
      maxWidth: '100%',
      ...shadows.sm,
    },

    // Thinking bubble (matches assistant bubble)
    thinkingRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    thinkingBubble: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderBottomLeftRadius: 5,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingVertical: 0,
      ...shadows.sm,
    },

    // Deeplink button inside bubble
    deeplinkBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
      backgroundColor: colors.primaryLight,
      borderRadius: radius.lg,
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    deeplinkText: {
      ...typography.bodySmall,
      color: colors.primary,
      fontWeight: fontWeights.medium,
    },

    // Low confidence note
    lowConfidenceNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    lowConfidenceText: {
      ...typography.caption,
      color: colors.mutedForeground,
      flex: 1,
      lineHeight: 16,
    },

    // Related articles — chips
    relatedSection: {
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: spacing.xs,
    },
    relatedLabel: {
      ...typography.caption,
      color: colors.mutedForeground,
      fontWeight: fontWeights.medium,
      marginBottom: 2,
    },
    relatedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.muted,
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      alignSelf: 'flex-start',
    },
    relatedChipText: {
      ...typography.caption,
      color: colors.foreground,
      fontWeight: fontWeights.medium,
    },

    // Input bar
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
      gap: spacing.sm,
    },
    inputWrapper: {
      flex: 1,
      backgroundColor: colors.muted,
      borderRadius: 22,
      paddingHorizontal: spacing.lg,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
      minHeight: 44,
      justifyContent: 'center',
    },
    input: {
      ...typography.body,
      color: colors.foreground,
      paddingVertical: 0,
      maxHeight: 120,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
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
      .catch(() => {})
      .finally(() => setHistoryLoaded(true));
  }, []);

  // Persist messages whenever they change (after initial load)
  useEffect(() => {
    if (!historyLoaded) return;
    const toSave = messages.slice(-MAX_STORED_MESSAGES);
    AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave)).catch(() => {});
  }, [messages, historyLoaded]);

  // Auto-send when launched with a query param (e.g. from support page chips).
  // Only fires once history is confirmed empty so we don't double-send on re-mount.
  useEffect(() => {
    if (query && historyLoaded && messages.length === 0) {
      sendMessage(query);
    } else if (query) {
      setInputValue(query);
    }
  }, [historyLoaded]);

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

    const currentMessages = messages;
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);

    try {
      const response = await api.post('/api/help/chat', {
        message: trimmed,
        history: currentMessages.map((m) => ({ role: m.role, content: m.content })),
      });
      const data = response.data as any;
      const content: string = data.response ?? '';
      const apiRelated: RelatedArticle[] = data.relatedArticles ?? [];

      // If the AI couldn't answer, surface locally-matched articles instead
      const needsFallback = SORRY_PATTERN.test(content) || data.confidence === 'low';
      const relatedArticles = (apiRelated.length > 0)
        ? apiRelated
        : (needsFallback ? localSearch(trimmed) : []);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: content || 'Sorry, I could not find an answer. Please try rephrasing or contact support.',
          relatedArticles,
          deeplink: data.deeplink,
          mobileDeeplink: data.mobileDeeplink,
          confidence: data.confidence ?? 'medium',
        },
      ]);
    } catch {
      // Network/server error — still show locally matched articles
      const fallbackArticles = localSearch(trimmed);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'I couldn\'t reach the server right now. Here are some articles that might help:',
          relatedArticles: fallbackArticles,
          confidence: 'low',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [messages, isSending]);

  const handleSend = () => sendMessage(inputValue);
  const handleStarter = (text: string) => sendMessage(text);
  const handleDeeplink = (path: string) => { router.push(path as any); };
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
                  style={{ paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="edit" size={iconSizes.md} color={colors.primary} />
                  <Text style={{ ...typography.bodySmall, color: colors.primary, fontWeight: fontWeights.semibold }}>
                    New chat
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
                  <View style={styles.assistantRow}>
                    <AssistantAvatar colors={colors} />
                    <View style={styles.assistantBubble}>
                      {/* Rendered markdown content */}
                      {renderMarkdown(msg.content, colors)}

                      {/* Deeplink CTA */}
                      {msg.mobileDeeplink && (
                        <TouchableOpacity
                          style={styles.deeplinkBtn}
                          onPress={() => handleDeeplink(msg.mobileDeeplink!)}
                          activeOpacity={0.7}
                        >
                          <Feather name="map-pin" size={13} color={colors.primary} />
                          <Text style={styles.deeplinkText}>Take me there</Text>
                        </TouchableOpacity>
                      )}

                      {/* Related articles as chips */}
                      {msg.relatedArticles && msg.relatedArticles.length > 0 && (
                        <View style={styles.relatedSection}>
                          <Text style={styles.relatedLabel}>RELATED ARTICLES</Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                            {msg.relatedArticles.map((article) => (
                              <TouchableOpacity
                                key={article.id}
                                style={styles.relatedChip}
                                onPress={() => router.push({ pathname: '/more/support', params: { openArticleId: article.id } } as any)}
                                activeOpacity={0.7}
                              >
                                <Feather name="file-text" size={11} color={colors.mutedForeground} />
                                <Text style={styles.relatedChipText} numberOfLines={1}>
                                  {article.title}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* Low confidence note */}
                      {msg.confidence === 'low' && (
                        <View style={styles.lowConfidenceNote}>
                          <Feather name="alert-circle" size={12} color={colors.mutedForeground} />
                          <Text style={styles.lowConfidenceText}>
                            Not fully confident in this answer. Email support@avwebinnovation.com for more help.
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            ))
          )}

          {/* Start-over nudge — shown below the last AI message */}
          {messages.length > 0 && !isSending && messages[messages.length - 1]?.role === 'assistant' && (
            <View style={{ alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.xs }}>
              <TouchableOpacity
                onPress={handleClear}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
                  backgroundColor: colors.muted,
                  borderRadius: radius.full,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                }}
                activeOpacity={0.7}
              >
                <Feather name="rotate-ccw" size={12} color={colors.mutedForeground} />
                <Text style={{ ...typography.caption, color: colors.mutedForeground, fontWeight: fontWeights.medium }}>
                  Start a new conversation
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Thinking indicator — aligned with avatar */}
          {isSending && (
            <View style={styles.thinkingRow}>
              <AssistantAvatar colors={colors} />
              <View style={styles.thinkingBubble}>
                <ThinkingDots colors={colors} />
              </View>
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
              <Feather name="send" size={16} color={inputValue.trim() ? colors.primaryForeground : colors.mutedForeground} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
