import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { Alert } from '@/lib/alert';
import { Stack, router } from 'expo-router';
import { OwnerOnlyGuard } from '../../src/components/ui/OwnerOnlyGuard';
import { Feather } from '@expo/vector-icons';
import { useTheme, colorWithOpacity } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, typographySizes, pageShell, iconSizes, sizes, componentStyles, fontWeights } from '../../src/lib/design-tokens';
import { api } from '../../src/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';

interface ActionItem {
  id: string;
  priority: 'fix_now' | 'this_week' | 'suggestions';
  title: string;
  description: string;
  impact: string;
  cta: string;
  ctaUrl: string;
  metric?: string;
  category: string;
}

interface ActionCenterData {
  actions: ActionItem[];
  summary: {
    fixNowCount: number;
    thisWeekCount: number;
    suggestionsCount: number;
    totalCount: number;
  };
  sections: {
    fix_now: ActionItem[];
    this_week: ActionItem[];
    suggestions: ActionItem[];
  };
}

const getPriorityConfig = (colors: any) => ({
  fix_now: {
    label: 'Fix Now',
    shortLabel: 'Fix Now',
    sectionLabel: 'FIX NOW',
    icon: 'alert-triangle' as const,
    color: colors.destructive,
    bgColor: colorWithOpacity(colors.destructive, 0.12),
  },
  this_week: {
    label: 'This Week',
    shortLabel: 'This Week',
    sectionLabel: 'THIS WEEK',
    icon: 'clock' as const,
    color: colors.warning,
    bgColor: colorWithOpacity(colors.warning, 0.12),
  },
  suggestions: {
    label: 'Tips',
    shortLabel: 'Tips',
    sectionLabel: 'SUGGESTIONS',
    icon: 'zap' as const,
    color: colors.success,
    bgColor: colorWithOpacity(colors.success, 0.12),
  },
});

const getCategoryColors = (colors: any): Record<string, string> => ({
  scheduling: colors.info,
  invoicing: colors.warning,
  quoting: colors.primary,
  clients: colors.info,
  jobs: colors.success,
  revenue: colors.destructive,
  default: colors.mutedForeground,
});

const getCategoryIcon = (category: string): string => {
  const iconMap: Record<string, string> = {
    scheduling: 'calendar',
    invoicing: 'file-text',
    quoting: 'send',
    clients: 'users',
    jobs: 'briefcase',
    revenue: 'dollar-sign',
  };
  return iconMap[category.toLowerCase()] || 'activity';
};

const createStyles = (colors: any, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingTop: pageShell.paddingTop,
    paddingBottom: bottomNavHeight,
  },
  header: {
    marginBottom: spacing.sm,
  },
  pageTitle: {
    ...typography.largeTitle,
    color: colors.foreground,
  },
  pageSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: fontWeights.bold,
    letterSpacing: -0.5,
  },
  statLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
    fontSize: typography.sizes.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
  },
  sectionContainer: {
    marginBottom: spacing.sm,
  },
  actionCard: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    marginBottom: spacing.sm,
    overflow: 'hidden',
    flexDirection: 'row',
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  actionAccentBar: {
    width: 4,
  },
  actionCardContent: {
    flex: 1,
    padding: spacing.md,
  },
  actionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  priorityText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.bold,
    letterSpacing: 0.3,
  },
  actionTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  actionDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginBottom: spacing.md,
  },
  actionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  metricText: {
    ...typography.caption,
    color: colors.mutedForeground,
    fontWeight: fontWeights.medium,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  ctaText: {
    ...typography.button,
    color: colors.primaryForeground,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  loadingText: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colorWithOpacity(colors.success, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.destructive,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  retryButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  retryButtonText: {
    ...typography.button,
    color: colors.primaryForeground,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    paddingTop: spacing.xl,
  },
  modalTitle: {
    fontSize: typographySizes.lg,
    fontWeight: fontWeights.bold,
  },
  modalSelectAll: {
    fontSize: typographySizes.sm,
    fontWeight: fontWeights.semibold,
  },
  batchSubtitle: {
    fontSize: typographySizes.sm,
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  batchJobList: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  batchJobItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  batchCheckbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  batchJobInfo: {
    flex: 1,
  },
  batchJobTitle: {
    fontSize: typographySizes.md,
    fontWeight: fontWeights.semibold,
  },
  batchJobClient: {
    fontSize: typographySizes.sm,
    marginTop: 2,
  },
  batchStatusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  batchStatusText: {
    fontSize: typographySizes.xs,
    fontWeight: fontWeights.semibold,
  },
  batchFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    paddingBottom: spacing.xl,
  },
  batchFooterText: {
    fontSize: typographySizes.sm,
  },
  batchCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  batchCreateText: {
    fontSize: typographySizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.white,
  },
});

function ActionCenterScreenInner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = createStyles(colors, bottomNavHeight);

  const scrollViewRef = useRef<ScrollView>(null);
  const sectionYPositions = useRef<Record<string, number>>({});

  const [data, setData] = useState<ActionCenterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchJobs, setBatchJobs] = useState<Array<{id: string; title: string; clientName?: string; selected: boolean}>>([]);
  const [isBatchCreating, setIsBatchCreating] = useState(false);
  const [batchJobIds, setBatchJobIds] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get<ActionCenterData>('/api/bi/action-center');
      if (response.error) {
        setError(response.error);
      } else {
        setData(response.data || null);
      }
    } catch (err) {
      setError('Failed to load action centre');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const openBatchInvoiceModal = useCallback(async (jobIdsCsv: string) => {
    const ids = jobIdsCsv.split(',').filter(Boolean);
    if (ids.length === 0) {
      router.push('/more/invoices' as any);
      return;
    }
    setBatchJobIds(ids);
    setBatchJobs(ids.map(id => {
      const actionTitle = data?.actions.find(a => a.id === 'revenue-leak-uninvoiced')?.title || '';
      return { id, title: '', clientName: '', selected: true };
    }));

    try {
      const response = await api.get<any[]>('/api/jobs');
      if (response.data) {
        const jobMap = new Map(response.data.map((j: any) => [j.id, j]));
        const clientIds = [...new Set(response.data.filter((j: any) => j.clientId).map((j: any) => j.clientId))];
        let clientMap = new Map<string, string>();
        try {
          const clientResponse = await api.get<any[]>('/api/clients');
          if (clientResponse.data) {
            clientMap = new Map(clientResponse.data.map((c: any) => [c.id, c.name || c.firstName || 'Client']));
          }
        } catch {}
        
        setBatchJobs(ids.map(id => {
          const job = jobMap.get(id);
          return {
            id,
            title: job?.title || `Job #${id.slice(0, 6)}`,
            clientName: job?.clientId ? (clientMap.get(job.clientId) || '') : '',
            selected: true,
          };
        }));
      }
    } catch {}

    setShowBatchModal(true);
  }, [data]);

  const toggleBatchJob = (jobId: string) => {
    setBatchJobs(prev => prev.map(j => j.id === jobId ? { ...j, selected: !j.selected } : j));
  };

  const selectAllBatchJobs = () => {
    const allSelected = batchJobs.every(j => j.selected);
    setBatchJobs(prev => prev.map(j => ({ ...j, selected: !allSelected })));
  };

  const handleBatchCreate = () => {
    const selectedIds = batchJobs.filter(j => j.selected).map(j => j.id);
    if (selectedIds.length === 0) {
      Alert.alert('No Jobs Selected', 'Please select at least one job to create invoices for.');
      return;
    }
    Alert.alert(
      'Create Invoices',
      `${selectedIds.length} job${selectedIds.length !== 1 ? 's' : ''} selected. Review each invoice in the builder before saving, or create them all automatically.`,
      [
        { text: 'Review Each', style: 'default', onPress: () => startBatchReview(selectedIds) },
        { text: 'Create Automatically', style: 'secondary', onPress: runBatchAuto },
        { text: 'Cancel', style: 'plain' },
      ],
    );
  };

  const startBatchReview = (selectedIds: string[]) => {
    setShowBatchModal(false);
    const queue = selectedIds.join(',');
    router.push(`/more/invoice/new?jobId=${selectedIds[0]}&batchQueue=${queue}&batchIndex=0` as any);
  };

  const runBatchAuto = async () => {
    const selectedIds = batchJobs.filter(j => j.selected).map(j => j.id);
    if (selectedIds.length === 0) {
      Alert.alert('No Jobs Selected', 'Please select at least one job to create invoices for.');
      return;
    }
    setIsBatchCreating(true);
    try {
      const response = await api.post<{ results: any[]; summary: { success: number; failed: number; totalAmount: string } }>('/api/invoices/batch', { jobIds: selectedIds });
      if (response.error) {
        Alert.alert('Error', response.error);
      } else if (response.data) {
        const { summary } = response.data;
        setShowBatchModal(false);
        Alert.alert(
          'Invoices Created',
          `${summary.success} invoice${summary.success !== 1 ? 's' : ''} created${summary.failed > 0 ? `, ${summary.failed} failed` : ''}.\n\nTotal: $${parseFloat(summary.totalAmount).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          [
            { text: 'View Invoices', onPress: () => router.push('/more/invoices' as any) },
            { text: 'OK', onPress: () => fetchData() },
          ]
        );
      }
    } catch {
      Alert.alert('Error', 'Failed to create invoices. Please try again.');
    } finally {
      setIsBatchCreating(false);
    }
  };

  const handleCTA = (url: string) => {
    if (url.startsWith('http')) {
      Linking.openURL(url);
      return;
    }
    if (!url.startsWith('/')) return;

    const [basePath, queryString] = url.split('?');
    const params = new URLSearchParams(queryString || '');
    const tab = params.get('tab');
    const action = params.get('action');

    if (basePath === '/documents' || basePath.startsWith('/documents')) {
      if (action === 'batch_invoice') {
        const jobIds = params.get('jobIds') || '';
        openBatchInvoiceModal(jobIds);
      } else if (tab === 'invoices') {
        router.push('/more/invoices' as any);
      } else if (tab === 'quotes') {
        router.push('/more/quotes' as any);
      } else {
        router.push('/more/documents' as any);
      }
    } else if (basePath === '/schedule' || basePath.startsWith('/schedule')) {
      router.push('/more/dispatch-board' as any);
    } else if (basePath === '/work' || basePath.startsWith('/work')) {
      router.push('/(tabs)/jobs' as any);
    } else if (basePath.startsWith('/jobs/')) {
      const jobId = basePath.split('/jobs/')[1];
      router.push(`/job/${jobId}` as any);
    } else if (basePath === '/clients' || basePath.startsWith('/clients')) {
      router.push('/more/clients' as any);
    } else if (basePath === '/chat' || basePath.startsWith('/chat')) {
      router.push('/more/chat-hub' as any);
    } else if (basePath === '/quotes' || basePath.startsWith('/quotes')) {
      router.push('/more/quotes' as any);
    } else if (basePath === '/invoices' || basePath.startsWith('/invoices')) {
      router.push('/more/invoices' as any);
    } else if (basePath === '/time-tracking' || basePath.startsWith('/time-tracking')) {
      router.push('/more/time-tracking' as any);
    } else if (basePath === '/team' || basePath.startsWith('/team')) {
      router.push('/more/team-management' as any);
    } else if (basePath === '/reports' || basePath.startsWith('/reports')) {
      router.push('/more/reports' as any);
    } else {
      router.push('/(tabs)/jobs' as any);
    }
  };

  const scrollToSection = useCallback((priority: string) => {
    const y = sectionYPositions.current[priority];
    if (y !== undefined && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y, animated: true });
    }
  }, []);

  const PRIORITY_CONFIG = getPriorityConfig(colors);
  const CATEGORY_COLORS = getCategoryColors(colors);

  const getCategoryColor = (category: string) => {
    return CATEGORY_COLORS[category.toLowerCase()] || CATEGORY_COLORS.default;
  };

  const renderStatCards = () => {
    if (!data?.summary) return null;
    const { fixNowCount, thisWeekCount, suggestionsCount } = data.summary;

    return (
      <View style={styles.statsRow}>
        <PressableRow style={[styles.statCard, { backgroundColor: colorWithOpacity(colors.destructive, 0.04) }]} onPress={() => scrollToSection('fix_now')} >
          <View style={[styles.statIconContainer, { backgroundColor: colorWithOpacity(colors.destructive, 0.12) }]}>
            <Feather name="alert-triangle" size={16} color={colors.destructive} />
          </View>
          <Text style={[styles.statValue, { color: colors.destructive }]}>{fixNowCount}</Text>
          <Text style={styles.statLabel}>Fix Now</Text>
        </PressableRow>

        <PressableRow style={styles.statCard} onPress={() => scrollToSection('this_week')} >
          <View style={[styles.statIconContainer, { backgroundColor: colorWithOpacity(colors.warning, 0.12) }]}>
            <Feather name="clock" size={16} color={colors.warning} />
          </View>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{thisWeekCount}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </PressableRow>

        <PressableRow style={styles.statCard} onPress={() => scrollToSection('suggestions')} >
          <View style={[styles.statIconContainer, { backgroundColor: colorWithOpacity(colors.success, 0.12) }]}>
            <Feather name="zap" size={16} color={colors.success} />
          </View>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{suggestionsCount}</Text>
          <Text style={styles.statLabel}>Tips</Text>
        </PressableRow>
      </View>
    );
  };

  const renderActionCard = (action: ActionItem) => {
    const config = PRIORITY_CONFIG[action.priority];
    const catColor = getCategoryColor(action.category);
    const catIcon = getCategoryIcon(action.category);

    return (
      <View key={action.id} style={styles.actionCard}>
        <View style={[styles.actionAccentBar, { backgroundColor: config.color }]} />
        <View style={styles.actionCardContent}>
          <View style={styles.actionTopRow}>
            <View style={[styles.categoryIconContainer, { backgroundColor: colorWithOpacity(catColor, 0.1) }]}>
              <Feather name={catIcon as any} size={iconSizes.xl} color={catColor} />
            </View>
            <View style={[styles.priorityBadge, { backgroundColor: config.bgColor }]}>
              <Feather name={config.icon} size={10} color={config.color} />
              <Text style={[styles.priorityText, { color: config.color }]}>{config.label}</Text>
            </View>
          </View>
          <Text style={styles.actionTitle} numberOfLines={2}>{action.title}</Text>
          <Text style={styles.actionDescription} numberOfLines={3}>{action.description}</Text>
          <View style={styles.actionFooter}>
            {action.metric ? (
              <View style={styles.metricRow}>
                <Feather name="bar-chart-2" size={iconSizes.sm} color={colors.mutedForeground} />
                <Text style={styles.metricText}>{action.metric}</Text>
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <PressableRow style={styles.ctaButton} onPress={() => handleCTA(action.ctaUrl)} >
              <Text style={styles.ctaText}>{action.cta}</Text>
              <Feather name="chevron-right" size={iconSizes.sm} color={colors.primaryForeground} />
            </PressableRow>
          </View>
        </View>
      </View>
    );
  };

  const renderSection = (priority: 'fix_now' | 'this_week' | 'suggestions', actions: ActionItem[]) => {
    if (!actions || actions.length === 0) return null;
    const config = PRIORITY_CONFIG[priority];

    return (
      <View
        style={styles.sectionContainer}
        onLayout={(e) => {
          sectionYPositions.current[priority] = e.nativeEvent.layout.y;
        }}
      >
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionDot, { backgroundColor: config.color }]} />
          <Text style={styles.sectionTitle}>{config.sectionLabel}</Text>
        </View>
        {actions.map(renderActionCard)}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Feather name="check-circle" size={40} color={colors.success} />
      </View>
      <Text style={styles.emptyTitle}>All clear!</Text>
      <Text style={styles.emptySubtitle}>No actions needed right now. Keep up the great work.</Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Feather name="alert-circle" size={40} color={colors.destructive} />
      <Text style={styles.errorText}>{error}</Text>
      <PressableRow style={styles.retryButton} onPress={fetchData}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </PressableRow>
    </View>
  );

  const hasActions = data && data.summary && data.summary.totalCount > 0;

  const selectedCount = batchJobs.filter(j => j.selected).length;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {isLoading && !data ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading action centre...</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
          >
            <View style={styles.header}>
              <Text style={styles.pageTitle}>Action Centre</Text>
              <Text style={styles.pageSubtitle}>Items that need your attention</Text>
            </View>

            {error ? renderErrorState() : !hasActions ? renderEmptyState() : (
              <>
                {renderStatCards()}
                {renderSection('fix_now', data!.sections.fix_now)}
                {renderSection('this_week', data!.sections.this_week)}
                {renderSection('suggestions', data!.sections.suggestions)}
              </>
            )}
          </ScrollView>
        )}
      </View>

      <AppBottomSheet
        visible={showBatchModal}
        onDismiss={() => setShowBatchModal(false)}
        title="Create Invoices"
        snapPoints={['80%']}
        scrollable
        footer={
          <View style={[styles.batchFooter, { borderTopColor: colors.border }]}>
            <Text style={[styles.batchFooterText, { color: colors.mutedForeground }]}>
              {selectedCount} of {batchJobs.length} job{batchJobs.length !== 1 ? 's' : ''} selected
            </Text>
            <PressableRow style={[styles.batchCreateButton, { backgroundColor: selectedCount > 0 ? colors.primary : colors.muted, opacity: isBatchCreating ? 0.7 : 1 }]} onPress={handleBatchCreate} disabled={isBatchCreating || selectedCount === 0}>
              {isBatchCreating ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <>
                  <Feather name="file-text" size={16} color={selectedCount > 0 ? colors.primaryForeground : colors.white} />
                  <Text style={[styles.batchCreateText, { color: selectedCount > 0 ? colors.primaryForeground : colors.white }]}>
                    Create {selectedCount} Invoice{selectedCount !== 1 ? 's' : ''}
                  </Text>
                </>
              )}
            </PressableRow>
          </View>
        }
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
          <Text style={[styles.batchSubtitle, { color: colors.mutedForeground, marginBottom: 0, flex: 1 }]}>
            Select completed jobs to generate draft invoices.
          </Text>
          <PressableRow onPress={selectAllBatchJobs} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={[styles.modalSelectAll, { color: colors.primary }]}>
              {batchJobs.every(j => j.selected) ? 'Deselect All' : 'Select All'}
            </Text>
          </PressableRow>
        </View>

        {batchJobs.map(job => (
          <PressableRow key={job.id} style={[styles.batchJobItem, { borderColor: job.selected ? colors.primary : colors.border, backgroundColor: job.selected ? colorWithOpacity(colors.primary, 0.04) : 'transparent' }]} onPress={() => toggleBatchJob(job.id)}>
            <View style={[styles.batchCheckbox, { borderColor: job.selected ? colors.primary : colors.border, backgroundColor: job.selected ? colors.primary : 'transparent' }]}>
              {job.selected && <Feather name="check" size={14} color={colors.primaryForeground} />}
            </View>
            <View style={styles.batchJobInfo}>
              <Text style={[styles.batchJobTitle, { color: colors.foreground }]} numberOfLines={1}>
                {job.title || `Job #${job.id.slice(0, 6)}`}
              </Text>
              {job.clientName ? (
                <Text style={[styles.batchJobClient, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {job.clientName}
                </Text>
              ) : null}
            </View>
            <View style={[styles.batchStatusBadge, { backgroundColor: colorWithOpacity(colors.success, 0.12) }]}>
              <Text style={[styles.batchStatusText, { color: colors.success }]}>Done</Text>
            </View>
          </PressableRow>
        ))}
      </AppBottomSheet>
    </>
  );
}

export default function ActionCenterScreen() {
  return (
    <OwnerOnlyGuard requiredPermission={['view_action_center']}>
      <ActionCenterScreenInner />
    </OwnerOnlyGuard>
  );
}
