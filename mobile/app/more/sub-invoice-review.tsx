import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, ThemeColors, colorWithOpacity } from '../../src/lib/theme';
import { spacing, radius, typography, fontWeights, iconSizes } from '../../src/lib/design-tokens';
import { formatCurrency } from '../../src/lib/format';
import { showToast } from '../../src/lib/toast';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import { PressableRow } from '../../src/components/ui/PressableRow';
import api from '../../src/lib/api';
import { format } from 'date-fns';

type StatusFilter = 'all' | 'submitted' | 'approved' | 'rejected';

interface SubInvoiceSummary {
  id: string;
  invoiceNumber: string;
  docType?: 'invoice' | 'quote';
  status: string;
  subtotalAmount: string;
  gstAmount: string;
  totalAmount: string;
  dueDate: string | null;
  createdAt: string | null;
  subcontractorName: string;
  notes?: string | null;
}

interface SubInvoiceItem {
  id: string;
  description: string;
  hours: string | null;
  rate: string | null;
  quantity: string | null;
  unitPrice: string | null;
  amount: string;
}

interface SubInvoiceDetail extends SubInvoiceSummary {
  items: SubInvoiceItem[];
  rejectionReason?: string | null;
  businessAbn?: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: (c: ThemeColors) => string }> = {
  draft:     { label: 'Draft',     color: c => c.mutedForeground },
  submitted: { label: 'Pending',   color: c => c.warning },
  approved:  { label: 'Approved',  color: c => c.success },
  paid:      { label: 'Paid',      color: c => c.info },
  rejected:  { label: 'Rejected',  color: c => c.destructive },
};

function statusLabel(status: string) {
  return STATUS_CONFIG[status]?.label ?? status;
}

function statusColor(status: string, colors: ThemeColors): string {
  return STATUS_CONFIG[status]?.color(colors) ?? colors.mutedForeground;
}

export default function SubInvoiceReview() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [invoices, setInvoices] = useState<SubInvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('submitted');

  // Detail sheet state
  const [detailInvoice, setDetailInvoice] = useState<SubInvoiceDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const detailRequestRef = useRef(0);

  // Approve/reject state
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.get<SubInvoiceSummary[]>('/api/business/subcontractor-invoices');
      setInvoices(Array.isArray(res.data) ? res.data : []);
    } catch {
      showToast({ type: 'error', message: 'Could not load invoices' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return invoices;
    return invoices.filter(inv => inv.status === filter);
  }, [invoices, filter]);

  // Pending count for badge
  const pendingCount = useMemo(
    () => invoices.filter(inv => inv.status === 'submitted').length,
    [invoices]
  );

  const openDetail = useCallback(async (inv: SubInvoiceSummary) => {
    const reqId = ++detailRequestRef.current;
    setDetailInvoice({ ...inv, items: [] });
    setIsLoadingDetail(true);
    setRejectMode(false);
    setRejectionReason('');
    setDetailVisible(true);
    try {
      const res = await api.get<SubInvoiceDetail>(`/api/subcontractor/invoices/${inv.id}`);
      if (reqId !== detailRequestRef.current) return;
      if (res.error || !res.data) {
        showToast({ type: 'error', message: 'Could not load invoice details' });
        setDetailVisible(false);
        return;
      }
      setDetailInvoice(res.data);
    } catch {
      if (reqId !== detailRequestRef.current) return;
      showToast({ type: 'error', message: 'Could not load invoice details' });
      setDetailVisible(false);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  const handleApprove = useCallback(async () => {
    if (!detailInvoice) return;
    setActionLoading(true);
    try {
      const res = await api.patch(`/api/business/subcontractor-invoices/${detailInvoice.id}/status`, {
        status: 'approved',
      });
      if (res.error) {
        showToast({ type: 'error', message: res.error });
        return;
      }
      showToast({ type: 'success', message: 'Invoice approved' });
      setDetailVisible(false);
      load();
    } catch {
      showToast({ type: 'error', message: 'Could not approve invoice' });
    } finally {
      setActionLoading(false);
    }
  }, [detailInvoice, load]);

  const handleReject = useCallback(async () => {
    if (!detailInvoice) return;
    setActionLoading(true);
    try {
      const res = await api.patch(`/api/business/subcontractor-invoices/${detailInvoice.id}/status`, {
        status: 'rejected',
        rejectionReason: rejectionReason.trim() || undefined,
      });
      if (res.error) {
        showToast({ type: 'error', message: res.error });
        return;
      }
      showToast({ type: 'success', message: 'Invoice rejected' });
      setDetailVisible(false);
      load();
    } catch {
      showToast({ type: 'error', message: 'Could not reject invoice' });
    } finally {
      setActionLoading(false);
    }
  }, [detailInvoice, rejectionReason, load]);

  const isActionable = detailInvoice?.status === 'submitted';

  const renderFilterTab = (tab: StatusFilter, label: string, count?: number) => {
    const isActive = filter === tab;
    return (
      <TouchableOpacity
        key={tab}
        style={[styles.filterTab, isActive && styles.filterTabActive]}
        onPress={() => setFilter(tab)}
        activeOpacity={0.7}
      >
        <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>{label}</Text>
        {count !== undefined && count > 0 && (
          <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
            <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>{count}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderCard = (inv: SubInvoiceSummary) => {
    const sc = statusColor(inv.status, colors);
    const isQuote = (inv.docType || 'invoice') === 'quote';
    return (
      <PressableRow key={inv.id} style={styles.card} onPress={() => openDetail(inv)}>
        <View style={[styles.cardIcon, { backgroundColor: colorWithOpacity(colors.primary, 0.1) }]}>
          <Feather name={isQuote ? 'file' : 'file-text'} size={iconSizes.md} color={colors.primary} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {inv.subcontractorName}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: colorWithOpacity(sc, 0.14) }]}>
              <Text style={[styles.statusText, { color: sc }]}>{statusLabel(inv.status)}</Text>
            </View>
          </View>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {isQuote ? 'Quote' : 'Invoice'} {inv.invoiceNumber}
            {inv.createdAt ? ` · ${format(new Date(inv.createdAt), 'dd MMM yyyy')}` : ''}
          </Text>
          <View style={styles.cardBottomRow}>
            <Text style={styles.cardAmount}>{formatCurrency(inv.totalAmount)}</Text>
            {inv.dueDate && (
              <Text style={styles.cardDue}>Due {format(new Date(inv.dueDate), 'dd MMM')}</Text>
            )}
          </View>
        </View>
        <Feather name="chevron-right" size={iconSizes.md} color={colors.mutedForeground} />
      </PressableRow>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Subcontractor Invoices</Text>
          <Text style={styles.headerSub}>Review and approve submitted invoices</Text>
        </View>
      </View>

      <View style={styles.filtersWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
          {renderFilterTab('submitted', 'Pending', pendingCount)}
          {renderFilterTab('all', 'All')}
          {renderFilterTab('approved', 'Approved')}
          {renderFilterTab('rejected', 'Rejected')}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing['3xl'] }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 120 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Feather name="inbox" size={40} color={colors.mutedForeground} />
              <Text style={styles.emptyTitle}>
                {filter === 'submitted' ? 'No pending invoices' : 'No invoices'}
              </Text>
              <Text style={styles.emptyText}>
                {filter === 'submitted'
                  ? 'Subcontractors have not submitted any invoices yet.'
                  : 'Nothing to show for this filter.'}
              </Text>
            </View>
          ) : (
            filtered.map(renderCard)
          )}
        </ScrollView>
      )}

      {/* Invoice detail sheet */}
      <AppBottomSheet
        visible={detailVisible}
        onDismiss={() => { setDetailVisible(false); setRejectMode(false); setRejectionReason(''); }}
        title={detailInvoice ? `Invoice ${detailInvoice.invoiceNumber}` : 'Invoice'}
        showCloseButton
        snapPoints={['85%']}
        footer={
          isActionable && !isLoadingDetail ? (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={styles.sheetFooter}>
                {rejectMode ? (
                  <>
                    <TextInput
                      style={styles.rejectInput}
                      placeholder="Reason for rejection (optional)"
                      placeholderTextColor={colors.mutedForeground}
                      value={rejectionReason}
                      onChangeText={setRejectionReason}
                      multiline
                      numberOfLines={2}
                    />
                    <View style={styles.footerRow}>
                      <TouchableOpacity
                        style={[styles.footerBtn, styles.footerBtnSecondary, { flex: 1 }]}
                        onPress={() => { setRejectMode(false); setRejectionReason(''); }}
                        activeOpacity={0.7}
                        disabled={actionLoading}
                      >
                        <Text style={styles.footerBtnSecondaryText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.footerBtn, styles.footerBtnDestructive, { flex: 2 }, actionLoading && { opacity: 0.6 }]}
                        onPress={handleReject}
                        activeOpacity={0.7}
                        disabled={actionLoading}
                      >
                        {actionLoading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Feather name="x-circle" size={16} color="#fff" />
                            <Text style={styles.footerBtnText}>Confirm Reject</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <View style={styles.footerRow}>
                    <TouchableOpacity
                      style={[styles.footerBtn, styles.footerBtnDestructiveOutline, { flex: 1 }]}
                      onPress={() => setRejectMode(true)}
                      activeOpacity={0.7}
                      disabled={actionLoading}
                    >
                      <Feather name="x" size={16} color={colors.destructive} />
                      <Text style={[styles.footerBtnSecondaryText, { color: colors.destructive }]}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.footerBtn, styles.footerBtnPrimary, { flex: 2 }, actionLoading && { opacity: 0.6 }]}
                      onPress={handleApprove}
                      activeOpacity={0.7}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color={colors.primaryForeground} />
                      ) : (
                        <>
                          <Feather name="check" size={16} color={colors.primaryForeground} />
                          <Text style={styles.footerBtnText}>Approve</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </KeyboardAvoidingView>
          ) : undefined
        }
      >
        {isLoadingDetail ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing['3xl'] }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : detailInvoice ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xl }}>
            {/* Status badge */}
            <View style={{ marginBottom: spacing.md }}>
              {(() => {
                const sc = statusColor(detailInvoice.status, colors);
                return (
                  <View style={[styles.detailStatusBadge, { backgroundColor: colorWithOpacity(sc, 0.12), borderColor: colorWithOpacity(sc, 0.3) }]}>
                    <View style={[styles.detailStatusDot, { backgroundColor: sc }]} />
                    <Text style={[styles.detailStatusText, { color: sc }]}>{statusLabel(detailInvoice.status)}</Text>
                  </View>
                );
              })()}
            </View>

            {/* Summary rows */}
            <View style={styles.detailSection}>
              <DetailRow label="Subcontractor" value={detailInvoice.subcontractorName} />
              <DetailRow label="Document" value={`${(detailInvoice.docType || 'invoice') === 'quote' ? 'Quote' : 'Invoice'} ${detailInvoice.invoiceNumber}`} />
              {detailInvoice.createdAt && (
                <DetailRow label="Submitted" value={format(new Date(detailInvoice.createdAt), 'dd MMM yyyy')} />
              )}
              {detailInvoice.dueDate && (
                <DetailRow label="Due" value={format(new Date(detailInvoice.dueDate), 'dd MMM yyyy')} />
              )}
              {detailInvoice.businessAbn && (
                <DetailRow label="ABN" value={detailInvoice.businessAbn} />
              )}
            </View>

            {/* Line items */}
            {detailInvoice.items.length > 0 && (
              <View style={[styles.detailSection, { marginTop: spacing.md }]}>
                <Text style={styles.detailSectionTitle}>Line Items</Text>
                {detailInvoice.items.map((item, idx) => (
                  <View key={item.id || idx} style={styles.lineItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lineItemDesc}>{item.description}</Text>
                      {item.hours && item.rate ? (
                        <Text style={styles.lineItemMeta}>
                          {parseFloat(item.hours).toFixed(1)}h @ {formatCurrency(item.rate)}/h
                        </Text>
                      ) : item.quantity && item.unitPrice ? (
                        <Text style={styles.lineItemMeta}>
                          {item.quantity} x {formatCurrency(item.unitPrice)}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.lineItemAmount}>{formatCurrency(item.amount)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Totals */}
            <View style={[styles.detailSection, styles.totalsSection, { marginTop: spacing.md }]}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>{formatCurrency(detailInvoice.subtotalAmount)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>GST</Text>
                <Text style={styles.totalValue}>{formatCurrency(detailInvoice.gstAmount)}</Text>
              </View>
              <View style={[styles.totalRow, styles.totalRowFinal]}>
                <Text style={styles.totalLabelBold}>Total</Text>
                <Text style={styles.totalValueBold}>{formatCurrency(detailInvoice.totalAmount)}</Text>
              </View>
            </View>

            {/* Notes */}
            {detailInvoice.notes ? (
              <View style={[styles.detailSection, { marginTop: spacing.md }]}>
                <Text style={styles.detailSectionTitle}>Notes</Text>
                <Text style={styles.notesText}>{detailInvoice.notes}</Text>
              </View>
            ) : null}

            {/* Rejection reason if already rejected */}
            {detailInvoice.status === 'rejected' && detailInvoice.rejectionReason ? (
              <View style={[styles.detailSection, styles.rejectionSection, { marginTop: spacing.md }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
                  <Feather name="x-circle" size={14} color={colors.destructive} />
                  <Text style={[styles.detailSectionTitle, { color: colors.destructive }]}>Rejection Reason</Text>
                </View>
                <Text style={styles.notesText}>{detailInvoice.rejectionReason}</Text>
              </View>
            ) : null}
          </ScrollView>
        ) : null}
      </AppBottomSheet>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, gap: spacing.md }}>
      <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: typography.sizes.sm, color: colors.foreground, fontWeight: fontWeights.medium, flex: 2, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: fontWeights.bold,
      color: colors.foreground,
    },
    headerSub: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
    },

    filtersWrap: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    filterTab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: colors.muted,
    },
    filterTabActive: {
      backgroundColor: colors.primary,
    },
    filterTabText: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.medium,
      color: colors.mutedForeground,
    },
    filterTabTextActive: {
      color: colors.primaryForeground,
    },
    filterBadge: {
      backgroundColor: colorWithOpacity(colors.foreground, 0.15),
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    filterBadgeActive: {
      backgroundColor: colorWithOpacity(colors.primaryForeground, 0.25),
    },
    filterBadgeText: {
      fontSize: 11,
      fontWeight: fontWeights.bold,
      color: colors.mutedForeground,
    },
    filterBadgeTextActive: {
      color: colors.primaryForeground,
    },

    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.sm,
      gap: spacing.md,
    },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardBody: { flex: 1, minWidth: 0 },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: 2,
    },
    cardTitle: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
      flex: 1,
    },
    cardMeta: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
      marginBottom: spacing.xs,
    },
    cardBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardAmount: {
      fontSize: typography.subtitle.fontSize,
      fontWeight: fontWeights.bold,
      color: colors.foreground,
    },
    cardDue: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
    },
    statusPill: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    statusText: {
      fontSize: typography.sizes.xs,
      fontWeight: fontWeights.bold,
    },

    emptyWrap: {
      alignItems: 'center',
      paddingTop: spacing['4xl'],
      gap: spacing.sm,
    },
    emptyTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    emptyText: {
      fontSize: typography.sizes.sm,
      color: colors.mutedForeground,
      textAlign: 'center',
      maxWidth: 280,
    },

    // Sheet footer
    sheetFooter: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: spacing.sm,
    },
    footerRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    footerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
    },
    footerBtnPrimary: {
      backgroundColor: colors.success,
    },
    footerBtnDestructive: {
      backgroundColor: colors.destructive,
    },
    footerBtnDestructiveOutline: {
      borderWidth: 1,
      borderColor: colors.destructive,
      backgroundColor: colorWithOpacity(colors.destructive, 0.06),
    },
    footerBtnSecondary: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
    },
    footerBtnText: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.semibold,
      color: '#fff',
    },
    footerBtnSecondaryText: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    rejectInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
      fontSize: typography.sizes.md,
      color: colors.foreground,
      minHeight: 64,
      textAlignVertical: 'top',
    },

    // Detail sheet
    detailSection: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    detailSectionTitle: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.semibold,
      color: colors.mutedForeground,
      marginBottom: spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    detailStatusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    detailStatusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    detailStatusText: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.semibold,
    },

    lineItemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    lineItemDesc: {
      fontSize: typography.sizes.sm,
      color: colors.foreground,
    },
    lineItemMeta: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    lineItemAmount: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.medium,
      color: colors.foreground,
    },

    totalsSection: {
      gap: 0,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    totalRowFinal: {
      borderBottomWidth: 0,
      paddingTop: spacing.sm,
    },
    totalLabel: {
      fontSize: typography.sizes.sm,
      color: colors.mutedForeground,
    },
    totalValue: {
      fontSize: typography.sizes.sm,
      color: colors.foreground,
    },
    totalLabelBold: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.bold,
      color: colors.foreground,
    },
    totalValueBold: {
      fontSize: typography.sizes.md,
      fontWeight: fontWeights.bold,
      color: colors.foreground,
    },

    notesText: {
      fontSize: typography.sizes.sm,
      color: colors.foreground,
      lineHeight: 20,
    },
    rejectionSection: {
      borderColor: colorWithOpacity(colors.destructive, 0.3),
      backgroundColor: colorWithOpacity(colors.destructive, 0.04),
    },
  });
}
