import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme, ThemeColors, colorWithOpacity } from '../../src/lib/theme';
import { spacing, radius, typography, fontWeights } from '../../src/lib/design-tokens';
import { formatCurrency } from '../../src/lib/format';
import { showToast } from '../../src/lib/toast';
import api, { API_URL } from '../../src/lib/api';

type FilterTab = 'all' | 'quote' | 'invoice';

interface BillingDoc {
  id: string;
  invoiceNumber: string;
  docType?: 'invoice' | 'quote';
  title?: string | null;
  status: string;
  subtotalAmount: string;
  gstAmount: string;
  totalAmount: string;
  dueDate: string | null;
  validUntil?: string | null;
  createdAt: string | null;
  businessName: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  paid: 'Paid',
  rejected: 'Rejected',
};

export default function SubbieEarnings() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [docs, setDocs] = useState<BillingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<FilterTab>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.get<BillingDoc[]>('/api/subcontractor/invoices');
      setDocs(res.data || []);
    } catch {
      showToast({ type: 'error', message: 'Could not load documents' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (tab === 'all') return docs;
    return docs.filter(d => (d.docType || 'invoice') === tab);
  }, [docs, tab]);

  const statusColor = useCallback((status: string) => {
    switch (status) {
      case 'paid': return colors.success;
      case 'approved': return colors.info;
      case 'submitted': return colors.warning;
      case 'rejected': return colors.destructive;
      default: return colors.mutedForeground;
    }
  }, [colors]);

  const openPdf = useCallback(async (doc: BillingDoc) => {
    setDownloadingId(doc.id);
    try {
      const token = await api.getToken();
      if (!token) throw new Error('Not signed in');
      const fileUri = `${FileSystem.cacheDirectory}${doc.invoiceNumber || 'document'}_${Date.now()}.pdf`;
      const result = await FileSystem.createDownloadResumable(
        `${API_URL}/api/subcontractor/invoices/${doc.id}/pdf`,
        fileUri,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' } }
      ).downloadAsync();
      if (!result || result.status !== 200) throw new Error('Could not generate PDF');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Save document' });
      } else {
        showToast({ type: 'success', message: 'PDF saved' });
      }
    } catch (e) {
      showToast({ type: 'error', message: e instanceof Error ? e.message : 'PDF failed' });
    } finally {
      setDownloadingId(null);
    }
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quotes & Invoices</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.segment}>
        {(['all', 'quote', 'invoice'] as FilterTab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.segmentItem, tab === t && styles.segmentItemActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
              {t === 'all' ? 'All' : t === 'quote' ? 'Quotes' : 'Invoices'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing['3xl'] }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Feather name="file-text" size={40} color={colors.mutedForeground} />
              <Text style={styles.emptyText}>No documents yet</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/more/subbie-bill' as any)} activeOpacity={0.85}>
                <Text style={styles.emptyBtnText}>Bill a business</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filtered.map(doc => {
              const isQuote = (doc.docType || 'invoice') === 'quote';
              const sc = statusColor(doc.status);
              return (
                <TouchableOpacity
                  key={doc.id}
                  style={styles.card}
                  onPress={() => openPdf(doc)}
                  activeOpacity={0.85}
                  disabled={downloadingId === doc.id}
                >
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{doc.title || doc.invoiceNumber}</Text>
                      <Text style={styles.cardMeta}>
                        {isQuote ? 'Quote' : 'Invoice'} · {doc.businessName}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: colorWithOpacity(sc, 0.14) }]}>
                      <Text style={[styles.statusText, { color: sc }]}>{STATUS_LABEL[doc.status] || doc.status}</Text>
                    </View>
                  </View>
                  <View style={styles.cardBottom}>
                    <Text style={styles.cardAmount}>{formatCurrency(doc.totalAmount)}</Text>
                    {downloadingId === doc.id ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : (
                      <View style={styles.pdfHint}>
                        <Feather name="download" size={14} color={colors.mutedForeground} />
                        <Text style={styles.pdfHintText}>PDF</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { fontSize: typography.sizes.lg, fontWeight: fontWeights.semibold, color: colors.foreground },
    headerRight: { width: 36 },
    segment: {
      flexDirection: 'row',
      backgroundColor: colors.muted,
      borderRadius: radius.md,
      padding: 4,
      gap: 4,
      margin: spacing.md,
    },
    segmentItem: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
    segmentItemActive: { backgroundColor: colors.card },
    segmentText: { fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.mutedForeground },
    segmentTextActive: { color: colors.foreground },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    cardTitle: { fontSize: typography.sizes.md, fontWeight: fontWeights.semibold, color: colors.foreground },
    cardMeta: { fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: 2 },
    statusPill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
    statusText: { fontSize: typography.sizes.xs, fontWeight: fontWeights.bold },
    cardBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
    },
    cardAmount: { fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.bold, color: colors.foreground },
    pdfHint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    pdfHintText: { fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground },
    emptyWrap: { alignItems: 'center', paddingTop: spacing['4xl'], gap: spacing.md },
    emptyText: { fontSize: typography.sizes.md, color: colors.mutedForeground },
    emptyBtn: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    emptyBtnText: { fontSize: typography.button.fontSize, fontWeight: fontWeights.bold, color: colors.primaryForeground },
  });
}
