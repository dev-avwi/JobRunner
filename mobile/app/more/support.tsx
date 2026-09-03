import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Linking,
  Platform,
  UIManager,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, fontWeights } from '../../src/lib/design-tokens';
import AppTour from '../../src/components/AppTour';
import * as Clipboard from 'expo-clipboard';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useOfflineStore } from '../../src/lib/offline-storage';
import { useAuthStore } from '../../src/lib/store';
import api from '../../src/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { useQuery, useMutation } from '@tanstack/react-query';
import FeedbackBottomSheet from '../../src/components/FeedbackBottomSheet';
import type { AppBottomSheetRef } from '../../src/components/ui/AppBottomSheet';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface HelpCategory {
  id: string;
  label: string;
  icon: string;
}

interface HelpArticle {
  id: string;
  category: string;
  title: string;
  body: string;
  summary: string;
  deeplink?: string;
  mobileDeeplink?: string;
}

interface HelpData {
  categories: HelpCategory[];
  articles: HelpArticle[];
}

type ViewState = 'home' | 'article';

// ─── Icon map ─────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  'getting-started': 'play-circle',
  jobs: 'briefcase',
  'quotes-invoices': 'file-text',
  team: 'users',
  payments: 'dollar-sign',
  settings: 'settings',
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (colors: ThemeColors, bottomNavHeight: number = 0) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingBottom: bottomNavHeight + spacing.xl,
    },
    // Search bar
    searchContainer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.muted,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
      height: 44,
    },
    searchInput: {
      flex: 1,
      ...typography.body,
      color: colors.foreground,
      paddingVertical: 0,
    },
    // Category chips
    chipRow: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
      backgroundColor: colors.muted,
    },
    chipActive: {
      backgroundColor: colors.primary,
    },
    chipText: {
      ...typography.caption,
      color: colors.mutedForeground,
      fontWeight: fontWeights.medium,
    },
    chipTextActive: {
      color: colors.primaryForeground,
    },
    // Section title
    sectionTitle: {
      ...typography.label,
      color: colors.mutedForeground,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      marginTop: spacing.lg,
    },
    // Article rows
    articleCard: {
      backgroundColor: colors.card,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.sm,
    },
    articleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      gap: spacing.md,
    },
    articleTitle: {
      ...typography.body,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
      flex: 1,
    },
    articleSummary: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: 2,
      lineHeight: 18,
    },
    // Article detail
    detailContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    detailContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl * 2,
    },
    detailTitle: {
      ...typography.pageTitle,
      color: colors.foreground,
      marginBottom: spacing.lg,
      lineHeight: 30,
    },
    detailBody: {
      ...typography.body,
      color: colors.mutedForeground,
      lineHeight: 24,
    },
    detailHeading: {
      ...typography.subtitle,
      color: colors.foreground,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
    },
    detailBold: {
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    detailListItem: {
      ...typography.body,
      color: colors.mutedForeground,
      lineHeight: 24,
      marginLeft: spacing.md,
    },
    deeplinkButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      marginTop: spacing.xl,
    },
    deeplinkButtonText: {
      ...typography.body,
      fontWeight: fontWeights.semibold,
      color: colors.primaryForeground,
    },
    // Feedback
    feedbackContainer: {
      marginTop: spacing.xl,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: 'center',
    },
    feedbackLabel: {
      ...typography.body,
      color: colors.mutedForeground,
      marginBottom: spacing.md,
    },
    feedbackRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    feedbackBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    feedbackBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    feedbackBtnText: {
      ...typography.body,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
    },
    feedbackBtnTextActive: {
      color: colors.primaryForeground,
    },
    feedbackThanks: {
      ...typography.body,
      color: colors.mutedForeground,
      textAlign: 'center',
    },
    // Empty state
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: spacing.xl * 2,
      paddingHorizontal: spacing.xl,
    },
    emptyTitle: {
      ...typography.subtitle,
      color: colors.foreground,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    emptySubtitle: {
      ...typography.body,
      color: colors.mutedForeground,
      textAlign: 'center',
    },
    askAssistantBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      marginTop: spacing.lg,
    },
    askAssistantText: {
      ...typography.body,
      fontWeight: fontWeights.semibold,
      color: colors.primaryForeground,
    },
    // Tour card
    tourCard: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      borderWidth: 2,
      borderColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      ...shadows.sm,
    },
    tourIconContainer: {
      width: 44,
      height: 44,
      borderRadius: radius.lg,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tourContent: { flex: 1 },
    tourTitle: {
      ...typography.subtitle,
      color: colors.foreground,
      marginBottom: 2,
    },
    tourSubtitle: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    // Contact / support section
    contactCard: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginHorizontal: spacing.lg,
      ...shadows.sm,
    },
    contactItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      gap: spacing.md,
    },
    contactItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    contactIconContainer: {
      width: 40,
      height: 40,
      borderRadius: radius.lg,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contactContent: { flex: 1 },
    contactTitle: {
      ...typography.body,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
    },
    contactSubtitle: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    // Debug info
    debugRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    debugLabel: {
      ...typography.caption,
      color: colors.mutedForeground,
      flex: 1,
    },
    debugValue: {
      ...typography.caption,
      color: colors.foreground,
      flex: 1,
      textAlign: 'right',
    },
    copyDebugButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      marginTop: spacing.md,
      marginHorizontal: spacing.lg,
    },
    copyDebugText: {
      ...typography.bodySmall,
      fontWeight: fontWeights.semibold,
    },
    footer: {
      alignItems: 'center',
      marginTop: spacing.xl,
      paddingTop: spacing.lg,
      marginHorizontal: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    footerText: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    versionText: {
      ...typography.captionSmall,
      color: colors.mutedForeground,
      marginTop: spacing.xs,
    },
  });

// ─── Markdown renderer (plain text blocks) ────────────────────────────────────

function MarkdownBody({ text, styles, colors }: {
  text: string;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let key = 0;

  const renderInline = (s: string) => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith('**') && p.endsWith('**') ? (
        <Text key={i} style={styles.detailBold}>{p.slice(2, -2)}</Text>
      ) : (
        p
      )
    );
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      nodes.push(
        <Text key={key++} style={styles.detailHeading}>{line.slice(3)}</Text>
      );
      i++; continue;
    }
    if (line.startsWith('# ')) {
      nodes.push(
        <Text key={key++} style={[styles.detailHeading, { fontSize: 18 }]}>{line.slice(2)}</Text>
      );
      i++; continue;
    }
    // Skip table rows — render as plain text
    if (line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim()).join('  ');
      if (!/^[-| ]+$/.test(cells)) {
        nodes.push(
          <Text key={key++} style={styles.detailBody}>{renderInline(cells)}</Text>
        );
      }
      i++; continue;
    }
    if (line.startsWith('- ')) {
      nodes.push(
        <Text key={key++} style={styles.detailListItem}>{'• '}{renderInline(line.slice(2))}</Text>
      );
      i++; continue;
    }
    if (/^\d+\./.test(line)) {
      nodes.push(
        <Text key={key++} style={styles.detailListItem}>{renderInline(line)}</Text>
      );
      i++; continue;
    }
    if (line.trim() === '') { i++; continue; }

    nodes.push(
      <Text key={key++} style={styles.detailBody}>{renderInline(line)}</Text>
    );
    i++;
  }

  return <View style={{ gap: spacing.xs }}>{nodes}</View>;
}

// ─── ArticleDetail ────────────────────────────────────────────────────────────

function ArticleDetail({
  article,
  styles,
  colors,
}: {
  article: HelpArticle;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const [feedback, setFeedback] = useState<'yes' | 'no' | null>(null);

  const feedbackMutation = useMutation({
    mutationFn: (helpful: boolean) =>
      api.post(`/api/help/articles/${article.id}/feedback`, { helpful }),
  });

  const handleFeedback = (helpful: boolean) => {
    if (feedback) return;
    setFeedback(helpful ? 'yes' : 'no');
    feedbackMutation.mutate(helpful);
  };

  const handleDeeplink = () => {
    if (article.mobileDeeplink) {
      router.push(article.mobileDeeplink as any);
    }
  };

  return (
    <ScrollView style={styles.detailContainer} contentContainerStyle={styles.detailContent}>
      <Text style={styles.detailTitle}>{article.title}</Text>

      <MarkdownBody text={article.body} styles={styles} colors={colors} />

      {article.mobileDeeplink && (
        <TouchableOpacity style={styles.deeplinkButton} onPress={handleDeeplink} activeOpacity={0.8}>
          <Feather name="external-link" size={iconSizes.md} color={colors.primaryForeground} />
          <Text style={styles.deeplinkButtonText}>Take me there</Text>
        </TouchableOpacity>
      )}

      <View style={styles.feedbackContainer}>
        {!feedback ? (
          <>
            <Text style={styles.feedbackLabel}>Was this helpful?</Text>
            <View style={styles.feedbackRow}>
              <TouchableOpacity
                style={styles.feedbackBtn}
                onPress={() => handleFeedback(true)}
                activeOpacity={0.8}
              >
                <Feather name="thumbs-up" size={iconSizes.md} color={colors.foreground} />
                <Text style={styles.feedbackBtnText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.feedbackBtn}
                onPress={() => handleFeedback(false)}
                activeOpacity={0.8}
              >
                <Feather name="thumbs-down" size={iconSizes.md} color={colors.foreground} />
                <Text style={styles.feedbackBtnText}>No</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <Text style={styles.feedbackThanks}>
            {feedback === 'yes' ? 'Thanks for the feedback!' : 'Thanks, we will work on improving this.'}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SupportScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const { openArticleId } = useLocalSearchParams<{ openArticleId?: string }>();

  const [viewState, setViewState] = useState<ViewState>('home');
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showTour, setShowTour] = useState(false);
  const feedbackSheetRef = useRef<AppBottomSheetRef>(null);

  const { data, isLoading } = useQuery<HelpData>({
    queryKey: ['/api/help/articles'],
    queryFn: () => api.get('/api/help/articles').then((r: any) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const categories = data?.categories ?? [];
  const allArticles = data?.articles ?? [];

  const filteredArticles = useMemo(() => {
    let list = allArticles;
    if (activeCategory !== 'all') {
      list = list.filter(a => a.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        a =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.body.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allArticles, activeCategory, search]);

  const openArticle = useCallback((article: HelpArticle) => {
    setSelectedArticle(article);
    setViewState('article');
  }, []);

  // When navigating from the Help Chat with a specific article ID, open it once
  // articles are loaded.
  useEffect(() => {
    if (openArticleId && allArticles.length > 0) {
      const target = allArticles.find(a => a.id === openArticleId);
      if (target) openArticle(target);
    }
  }, [openArticleId, allArticles, openArticle]);

  const goBack = () => {
    setViewState('home');
    setSelectedArticle(null);
  };

  // ─── Debug info ───────────────────────────────────────────────────────────

  const { isOnline, isSyncing, pendingSyncCount, lastSyncTime } = useOfflineStore();
  const user = useAuthStore((state: any) => state.user);

  const debugInfo = useMemo(() => {
    const appVersion = Application.nativeApplicationVersion || '1.1.0';
    const buildNumber = Application.nativeBuildVersion || 'dev';
    const sdkVersion = Constants.expoConfig?.sdkVersion || 'unknown';
    const deviceModel = Device.modelName || 'unknown';
    const osName = Platform.OS;
    const osVersion = Platform.Version?.toString() || 'unknown';
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'default';
    const lastSync = lastSyncTime ? new Date(lastSyncTime).toLocaleString('en-AU') : 'Never';

    return {
      'App Version': `${appVersion} (${buildNumber})`,
      'Expo SDK': sdkVersion,
      'Platform': `${osName} ${osVersion}`,
      'Device': deviceModel,
      'User ID': user?.id?.toString() || 'Not logged in',
      'Online': isOnline ? 'Yes' : 'No',
      'Syncing': isSyncing ? 'Yes' : 'No',
      'Pending Sync': pendingSyncCount.toString(),
      'Last Sync': lastSync,
      'API Endpoint': apiUrl,
    };
  }, [isOnline, isSyncing, pendingSyncCount, lastSyncTime, user]);

  const handleCopyDebugInfo = async () => {
    const lines = Object.entries(debugInfo).map(([key, value]) => `${key}: ${value}`);
    const text = `--- JobRunner Debug Info ---\n${lines.join('\n')}\nTimestamp: ${new Date().toISOString()}\n---`;
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Debug info copied to clipboard. You can paste it in a support email.');
  };

  const handleEmailSupport = () => {
    Linking.openURL('mailto:admin@avwebinnovation.com');
  };

  const handleOpenDocs = () => {
    Linking.openURL('https://jobrunner.com.au/docs');
  };

  // ─── Article detail view ──────────────────────────────────────────────────

  if (viewState === 'article' && selectedArticle) {
    return (
      <>
        <Stack.Screen
          options={{
            title: selectedArticle.title.length > 30
              ? selectedArticle.title.slice(0, 30) + '...'
              : selectedArticle.title,
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.foreground,
            headerLeft: () => (
              <TouchableOpacity onPress={goBack} style={{ paddingHorizontal: spacing.md }}>
                <Feather name="arrow-left" size={iconSizes.lg} color={colors.foreground} />
              </TouchableOpacity>
            ),
          }}
        />
        <ArticleDetail article={selectedArticle} styles={styles} colors={colors} />
      </>
    );
  }

  // ─── Home view ────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Help & Support',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }}
      />

      <ScrollView style={styles.container}>
        <View style={styles.content}>
          {/* Ask a question (Help Assistant) */}
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                backgroundColor: colors.card,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: colors.primary + '40',
                padding: spacing.lg,
                ...shadows.sm,
              }}
              onPress={() => router.push('/more/help-chat' as any)}
              activeOpacity={0.7}
            >
              <View style={{
                width: 40, height: 40, borderRadius: radius.lg,
                backgroundColor: colors.primaryLight,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Feather name="help-circle" size={iconSizes.xl} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.body, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: 2 }}>
                  Ask a question
                </Text>
                <Text style={{ ...typography.caption, color: colors.mutedForeground }}>
                  Get instant answers from the Help Assistant
                </Text>
              </View>
              <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchRow}>
              <Feather name="search" size={iconSizes.md} color={colors.mutedForeground} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search help articles..."
                placeholderTextColor={colors.mutedForeground}
                value={search}
                onChangeText={(t) => {
                  setSearch(t);
                  if (t) setActiveCategory('all');
                }}
                returnKeyType="search"
                autoCorrect={false}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Feather name="x" size={iconSizes.md} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Category chips */}
          {!search && (
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, activeCategory === 'all' && styles.chipActive]}
                onPress={() => setActiveCategory('all')}
              >
                <Text style={[styles.chipText, activeCategory === 'all' && styles.chipTextActive]}>
                  All
                </Text>
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.chip, activeCategory === cat.id && styles.chipActive]}
                  onPress={() => setActiveCategory(cat.id)}
                >
                  <Feather
                    name={CATEGORY_ICONS[cat.id] ?? 'help-circle'}
                    size={12}
                    color={activeCategory === cat.id ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text
                    style={[styles.chipText, activeCategory === cat.id && styles.chipTextActive]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* App Tour card — shown only on home with no search */}
          {!search && activeCategory === 'all' && (
            <PressableRow style={styles.tourCard} onPress={() => setShowTour(true)}>
              <View style={styles.tourIconContainer}>
                <Feather name="navigation" size={iconSizes.xl} color={colors.primary} />
              </View>
              <View style={styles.tourContent}>
                <Text style={styles.tourTitle}>Start App Tour</Text>
                <Text style={styles.tourSubtitle}>Take a guided walkthrough of the app</Text>
              </View>
              <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
            </PressableRow>
          )}

          {/* Articles */}
          {isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xl * 2 }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filteredArticles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="help-circle" size={48} color={colors.mutedForeground + '60'} />
              <Text style={styles.emptyTitle}>No articles found</Text>
              <Text style={styles.emptySubtitle}>
                Try different keywords, or ask the Help Assistant.
              </Text>
              {search.trim().length > 0 && (
                <TouchableOpacity
                  style={styles.askAssistantBtn}
                  onPress={() => router.push({ pathname: '/more/help-chat', params: { query: search.trim() } } as any)}
                  activeOpacity={0.75}
                >
                  <Feather name="message-circle" size={iconSizes.md} color={colors.primaryForeground} />
                  <Text style={styles.askAssistantText}>Ask a question</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>
                {search
                  ? `${filteredArticles.length} RESULT${filteredArticles.length === 1 ? '' : 'S'}`
                  : activeCategory === 'all'
                  ? 'HELP ARTICLES'
                  : (categories.find(c => c.id === activeCategory)?.label ?? 'ARTICLES').toUpperCase()}
              </Text>
              {filteredArticles.map((article) => (
                <View key={article.id} style={styles.articleCard}>
                  <PressableRow style={styles.articleRow} onPress={() => openArticle(article)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.articleTitle}>{article.title}</Text>
                      <Text style={styles.articleSummary} numberOfLines={2}>
                        {article.summary}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={iconSizes.md} color={colors.mutedForeground} />
                  </PressableRow>
                </View>
              ))}
            </>
          )}

          {/* Send Feedback */}
          <Text style={styles.sectionTitle}>FEEDBACK</Text>
          <PressableRow
            style={[styles.tourCard, { borderColor: colors.primary, marginHorizontal: spacing.lg, marginTop: 0 }]}
            onPress={() => feedbackSheetRef.current?.present()}
          >
            <View style={styles.tourIconContainer}>
              <Feather name="message-square" size={iconSizes.xl} color={colors.primary} />
            </View>
            <View style={styles.tourContent}>
              <Text style={styles.tourTitle}>Send Feedback</Text>
              <Text style={styles.tourSubtitle}>Share ideas, report bugs, or leave a rating</Text>
            </View>
            <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
          </PressableRow>

          {/* Report a Bug */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>REPORT A PROBLEM</Text>
          <PressableRow
            style={[styles.tourCard, { borderColor: colors.destructive, marginHorizontal: spacing.lg, marginTop: 0 }]}
            onPress={() => router.push('/more/report-bug')}
          >
            <View style={[styles.tourIconContainer, { backgroundColor: colors.destructive + '20' }]}>
              <Feather name="alert-circle" size={iconSizes.xl} color={colors.destructive} />
            </View>
            <View style={styles.tourContent}>
              <Text style={styles.tourTitle}>Report a Bug</Text>
              <Text style={styles.tourSubtitle}>Something not working? Let us know!</Text>
            </View>
            <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
          </PressableRow>

          {/* Contact */}
          <Text style={styles.sectionTitle}>CONTACT US</Text>
          <View style={styles.contactCard}>
            <PressableRow
              style={[styles.contactItem, styles.contactItemBorder]}
              onPress={handleEmailSupport}
            >
              <View style={styles.contactIconContainer}>
                <Feather name="mail" size={iconSizes.lg} color={colors.primary} />
              </View>
              <View style={styles.contactContent}>
                <Text style={styles.contactTitle}>Email Support</Text>
                <Text style={styles.contactSubtitle}>admin@avwebinnovation.com</Text>
              </View>
              <Feather name="external-link" size={iconSizes.md} color={colors.mutedForeground} />
            </PressableRow>
            <PressableRow style={styles.contactItem} onPress={handleOpenDocs}>
              <View style={styles.contactIconContainer}>
                <Feather name="book-open" size={iconSizes.lg} color={colors.primary} />
              </View>
              <View style={styles.contactContent}>
                <Text style={styles.contactTitle}>Documentation</Text>
                <Text style={styles.contactSubtitle}>Browse guides and tutorials</Text>
              </View>
              <Feather name="external-link" size={iconSizes.md} color={colors.mutedForeground} />
            </PressableRow>
          </View>

          {/* Debug Info */}
          <Text style={styles.sectionTitle}>DEBUG INFO</Text>
          <View style={styles.contactCard}>
            {Object.entries(debugInfo).map(([key, value], index, arr) => (
              <View
                key={key}
                style={[
                  styles.debugRow,
                  index < arr.length - 1 && styles.contactItemBorder,
                ]}
              >
                <Text style={styles.debugLabel}>{key}</Text>
                <Text style={styles.debugValue} selectable>{value}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.copyDebugButton, { backgroundColor: colors.primary }]}
            onPress={handleCopyDebugInfo}
            activeOpacity={0.8}
          >
            <Feather name="copy" size={iconSizes.md} color={colors.primaryForeground} />
            <Text style={[styles.copyDebugText, { color: colors.primaryForeground }]}>Copy Debug Info</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>JobRunner Mobile</Text>
            <Text style={styles.versionText}>Version {debugInfo['App Version']}</Text>
          </View>
        </View>
      </ScrollView>

      <AppTour visible={showTour} onClose={() => setShowTour(false)} />
      <FeedbackBottomSheet sheetRef={feedbackSheetRef} currentScreen="more/support" />
    </>
  );
}
