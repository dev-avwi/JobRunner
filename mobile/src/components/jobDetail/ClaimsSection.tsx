/**
 * ClaimsSection (mobile) — read-only summary of progress claims for a job.
 * Shows claim list with status, totals and a schedule-of-values breakdown
 * for the selected claim. Owners/managers also see action buttons.
 *
 * Draft claims open an edit sheet when tapped so users can set the claim
 * period, add line items and submit from mobile.
 *
 * Polish additions:
 *  - Cumulative progress bar on claim cards (claimed vs contract value)
 *  - Unclaimed line items highlighted in draft edit view
 *  - Pre-submit confirmation sheet summarising totals before final send
 *  - "Create Invoice" shortcut button on approved claims
 */
import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet,
  ScrollView, TextInput, Platform, KeyboardAvoidingView, Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ThemeColors } from '../../lib/theme';
import { spacing, radius, typography, fontWeights } from '../../lib/design-tokens';
import api, { API_URL } from '../../lib/api';
import { showToast } from '../../lib/toast';
import { AppBottomSheet, BottomSheetScrollView } from '../ui/AppBottomSheet';
import { SheetButton } from '../ui/SheetButton';

// ─── types ────────────────────────────────────────────────────────────────────

export type ClaimStatus = 'draft' | 'submitted' | 'approved' | 'paid';

export interface Claim {
  id: string;
  jobId: string;
  claimNumber: string;
  status: ClaimStatus;
  claimDate: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  subtotal: string;
  gstAmount: string;
  total: string;
  retentionPercent: string | null;
  retentionAmount: string | null;
  notes: string | null;
  xeroInvoiceId: string | null;
  /** Object-storage URL for the cost report PDF generated at submission time */
  costReportUrl: string | null;
}

interface ClaimLineItem {
  id: string;
  description: string;
  contractValue: string;
  previouslyClaimed: string;
  thisClaim: string;
  balance?: number;
  cumulativePct?: number;
  retentionAmount?: number;
}

interface ScheduleOfValues {
  contractValueTotal: number;
  previouslyClaimedTotal: number;
  thisClaimTotal: number;
  retentionTotal: number;
  subtotal: number;
  gstAmount: number;
  total: number;
  balanceTotal: number;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ClaimStatus, { label: string; bg: string; text: string }> = {
  draft:     { label: 'Draft',     bg: '#F3F4F6', text: '#374151' },
  submitted: { label: 'Submitted', bg: '#DBEAFE', text: '#1E40AF' },
  approved:  { label: 'Approved',  bg: '#D1FAE5', text: '#065F46' },
  paid:      { label: 'Paid',      bg: '#EDE9FE', text: '#6D28D9' },
};

function fmt(v: string | number | null | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
  return `$${(isNaN(n) ? 0 : n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

function toISODateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateStr(s: string | null | undefined): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

// ─── component ────────────────────────────────────────────────────────────────

export interface ClaimsSectionProps {
  colors: ThemeColors;
  claims: Claim[];
  isLoading: boolean;
  jobId: string;
  isOwnerOrManager?: boolean;
  onRefresh?: () => void;
  onAddClaim?: () => void;
  /** Pass contract value (excl GST) to show progress bars */
  contractValue?: number | null;
  /** Callback when user taps Create Invoice on approved claim */
  onCreateInvoice?: (claim: Claim) => void;
}

export function ClaimsSection({
  colors, claims, isLoading, jobId, isOwnerOrManager = false, onRefresh, onAddClaim,
  contractValue, onCreateInvoice,
}: ClaimsSectionProps) {
  // ── read-only expand state ────────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    lineItems: ClaimLineItem[];
    scheduleOfValues: ScheduleOfValues;
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── edit sheet state ──────────────────────────────────────────────────────
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null);
  const [editForm, setEditForm] = useState({ claimDate: '', periodStart: '', periodEnd: '' });
  const [editLineItems, setEditLineItems] = useState<ClaimLineItem[]>([]);
  const [loadingEditItems, setLoadingEditItems] = useState(false);
  const [newLineDesc, setNewLineDesc] = useState('');
  const [newLineAmount, setNewLineAmount] = useState('');
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);

  // ── pre-submit confirmation ───────────────────────────────────────────────
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmDetail, setConfirmDetail] = useState<{
    claimNumber: string;
    thisClaimTotal: number;
    retentionHeld: number;
    amountDue: number;
  } | null>(null);

  // ── date picker ───────────────────────────────────────────────────────────
  const [datePickerTarget, setDatePickerTarget] = useState<'claimDate' | 'periodStart' | 'periodEnd' | null>(null);
  const [datePickerValue, setDatePickerValue] = useState<Date>(new Date());

  // ── computed: cumulative claimed total across non-draft claims ────────────
  const cumulativeClaimed = claims
    .filter((c) => c.status !== 'draft')
    .reduce((sum, c) => sum + parseFloat(c.total || '0'), 0);
  const claimProgressPct = contractValue && contractValue > 0
    ? Math.min(100, (cumulativeClaimed / contractValue) * 100)
    : null;

  // ── read-only expand ──────────────────────────────────────────────────────
  const loadDetail = useCallback(async (claimId: string) => {
    if (expandedId === claimId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(claimId);
    setLoadingDetail(true);
    try {
      const res = await api.get<{ claim: Claim; lineItems: ClaimLineItem[]; scheduleOfValues: ScheduleOfValues }>(
        `/api/jobs/${jobId}/claims/${claimId}`,
      );
      setDetail(res.data ? { lineItems: res.data.lineItems, scheduleOfValues: res.data.scheduleOfValues } : null);
    } catch (e) {
      console.error('Error loading claim detail:', e);
    } finally {
      setLoadingDetail(false);
    }
  }, [expandedId, jobId]);

  // ── action buttons ────────────────────────────────────────────────────────
  const handleAction = async (claimId: string, action: 'submit' | 'approve' | 'mark-paid') => {
    setActionLoading(action);
    try {
      await api.post(`/api/jobs/${jobId}/claims/${claimId}/${action}`);
      showToast({ type: 'success', message: action === 'submit' ? 'Claim submitted' : action === 'approve' ? 'Claim approved' : 'Marked as paid' });
      onRefresh?.();
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Action failed' });
    } finally {
      setActionLoading(null);
    }
  };

  // ── edit sheet helpers ────────────────────────────────────────────────────
  const openEditSheet = useCallback(async (claim: Claim) => {
    setEditingClaim(claim);
    setEditForm({
      claimDate:   claim.claimDate   ?? toISODateStr(new Date()),
      periodStart: claim.periodStart ?? '',
      periodEnd:   claim.periodEnd   ?? '',
    });
    setNewLineDesc('');
    setNewLineAmount('');
    setDatePickerTarget(null);

    setLoadingEditItems(true);
    try {
      const res = await api.get<{ lineItems: ClaimLineItem[] }>(`/api/jobs/${jobId}/claims/${claim.id}`);
      setEditLineItems(res.data?.lineItems ?? []);
    } catch {
      setEditLineItems([]);
    } finally {
      setLoadingEditItems(false);
    }
  }, [jobId]);

  const closeEditSheet = () => {
    setEditingClaim(null);
    setEditLineItems([]);
    setNewLineDesc('');
    setNewLineAmount('');
    setDatePickerTarget(null);
  };

  const saveClaimHeader = async (claimId: string) => {
    const body: Record<string, string> = {};
    if (editForm.claimDate)   body.claimDate   = new Date(editForm.claimDate).toISOString();
    if (editForm.periodStart) body.periodStart  = new Date(editForm.periodStart).toISOString();
    if (editForm.periodEnd)   body.periodEnd    = new Date(editForm.periodEnd).toISOString();
    await api.patch(`/api/jobs/${jobId}/claims/${claimId}`, body);
  };

  const handleAddLineItem = async () => {
    if (!editingClaim) return;
    const desc = newLineDesc.trim();
    if (!desc) {
      showToast({ type: 'error', message: 'Description is required' });
      return;
    }
    const amount = parseFloat(newLineAmount.replace(/[^0-9.]/g, '')) || 0;
    setIsAddingLine(true);
    try {
      await api.post(`/api/jobs/${jobId}/claims/${editingClaim.id}/line-items`, {
        description:      desc,
        thisClaim:        amount.toFixed(2),
        contractValue:    amount.toFixed(2),
        previouslyClaimed: '0.00',
      });
      const res = await api.get<{ lineItems: ClaimLineItem[] }>(`/api/jobs/${jobId}/claims/${editingClaim.id}`);
      setEditLineItems(res.data?.lineItems ?? []);
      setNewLineDesc('');
      setNewLineAmount('');
    } catch (e: any) {
      showToast({ type: 'error', message: e?.response?.data?.error || 'Failed to add line item' });
    } finally {
      setIsAddingLine(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingClaim) return;
    setIsSavingEdit(true);
    try {
      await saveClaimHeader(editingClaim.id);
      showToast({ type: 'success', message: 'Claim updated' });
      onRefresh?.();
      closeEditSheet();
    } catch (e: any) {
      showToast({ type: 'error', message: e?.response?.data?.error || 'Failed to save claim' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ── submit flow: show confirmation sheet first ────────────────────────────
  const handleRequestSubmit = async () => {
    if (!editingClaim) return;
    // Load latest line items for confirmation summary
    try {
      const res = await api.get<{ claim: Claim; scheduleOfValues: ScheduleOfValues }>(
        `/api/jobs/${jobId}/claims/${editingClaim.id}`,
      );
      const sov = res.data?.scheduleOfValues;
      if (sov) {
        setConfirmDetail({
          claimNumber: editingClaim.claimNumber,
          thisClaimTotal: sov.thisClaimTotal,
          retentionHeld: sov.retentionTotal,
          amountDue: sov.total,
        });
        setShowConfirmModal(true);
      } else {
        // Fallback: submit directly
        await doSubmit();
      }
    } catch {
      await doSubmit();
    }
  };

  const doSubmit = async () => {
    if (!editingClaim) return;
    setIsSubmittingClaim(true);
    try {
      await saveClaimHeader(editingClaim.id);
      await api.post(`/api/jobs/${jobId}/claims/${editingClaim.id}/submit`);
      showToast({ type: 'success', message: 'Claim submitted' });
      onRefresh?.();
      closeEditSheet();
    } catch (e: any) {
      showToast({ type: 'error', message: e?.response?.data?.error || 'Failed to submit claim' });
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  // ── date picker ───────────────────────────────────────────────────────────
  const openDatePicker = (target: 'claimDate' | 'periodStart' | 'periodEnd') => {
    const existing = editForm[target];
    setDatePickerValue(existing ? parseDateStr(existing) : new Date());
    setDatePickerTarget(target);
  };

  const onDateChange = (_event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setDatePickerTarget(null);
    if (selectedDate) {
      const iso = toISODateStr(selectedDate);
      setDatePickerValue(selectedDate);
      if (datePickerTarget) setEditForm(f => ({ ...f, [datePickerTarget]: iso }));
    }
  };

  const confirmDatePicker = () => {
    if (datePickerTarget) setEditForm(f => ({ ...f, [datePickerTarget]: toISODateStr(datePickerValue) }));
    setDatePickerTarget(null);
  };

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <View>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Feather name="file-text" size={14} color={colors.mutedForeground} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Progress Claims
        </Text>
        {claims.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.countText, { color: colors.mutedForeground }]}>{claims.length}</Text>
          </View>
        )}
        {isOwnerOrManager && onAddClaim && (
          <TouchableOpacity onPress={onAddClaim} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8 }}>
              <Feather name="plus" size={13} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: fontWeights.semibold, color: colors.primary }}>Add</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Cumulative progress bar across all non-draft claims */}
      {claimProgressPct !== null && cumulativeClaimed > 0 && (
        <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
            <Text style={{ fontSize: 10, color: colors.mutedForeground }}>Cumulative claimed</Text>
            <Text style={{ fontSize: 10, fontWeight: fontWeights.semibold, color: colors.foreground }}>
              {fmt(cumulativeClaimed)} ({claimProgressPct.toFixed(0)}%)
            </Text>
          </View>
          <View style={{ height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ width: `${claimProgressPct}%` as any, height: '100%', backgroundColor: colors.primary, borderRadius: 3 }} />
          </View>
        </View>
      )}

      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={colors.mutedForeground} />
        </View>
      )}

      {!isLoading && claims.length === 0 && (
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          No progress claims yet. Add a claim to bill for completed project work.
        </Text>
      )}

      {claims.map((claim) => {
        const cfg = STATUS_CONFIG[claim.status] ?? STATUS_CONFIG.draft;
        const isExpanded = expandedId === claim.id;
        const isDraft = claim.status === 'draft';
        const isApproved = claim.status === 'approved';

        return (
          <View key={claim.id} style={[styles.claimCard, { borderColor: colors.cardBorder, backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={styles.claimHeader}
              onPress={() => {
                if (isDraft && isOwnerOrManager) {
                  openEditSheet(claim);
                } else {
                  loadDetail(claim.id);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.claimHeaderLeft}>
                <View style={styles.claimTitleRow}>
                  <Text style={[styles.claimNumber, { color: colors.foreground }]}>{claim.claimNumber}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
                  </View>
                  {claim.xeroInvoiceId && (
                    <View style={[styles.statusBadge, { backgroundColor: '#D1FAE5' }]}>
                      <Text style={[styles.statusText, { color: '#065F46' }]}>Xero ✓</Text>
                    </View>
                  )}
                  {isDraft && isOwnerOrManager && (
                    <View style={[styles.statusBadge, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.statusText, { color: colors.primary }]}>Tap to edit</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.claimMeta, { color: colors.mutedForeground }]}>
                  {fmtDate(claim.claimDate)}
                  {claim.periodStart ? ` · ${fmtDate(claim.periodStart)} – ${fmtDate(claim.periodEnd)}` : ''}
                </Text>
                <Text style={[styles.claimTotal, { color: colors.foreground }]}>
                  {fmt(claim.total)}
                </Text>
              </View>
              <Feather
                name={isDraft && isOwnerOrManager ? 'edit-2' : isExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={isDraft && isOwnerOrManager ? colors.primary : colors.mutedForeground}
              />
            </TouchableOpacity>

            {/* Expanded detail for non-draft claims */}
            {isExpanded && !isDraft && (
              <View style={[styles.detailArea, { borderTopColor: colors.cardBorder }]}>
                {loadingDetail && (
                  <ActivityIndicator size="small" color={colors.mutedForeground} style={{ margin: spacing.md }} />
                )}

                {!loadingDetail && detail && (
                  <>
                    {/* Progress bar: cumulative % of contract claimed via this SOV */}
                    {detail.scheduleOfValues.contractValueTotal > 0 && (
                      <View style={{ marginBottom: spacing.sm }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                          <Text style={{ fontSize: 10, color: colors.mutedForeground }}>Previously claimed</Text>
                          <Text style={{ fontSize: 10, color: colors.mutedForeground }}>
                            {((detail.scheduleOfValues.previouslyClaimedTotal / detail.scheduleOfValues.contractValueTotal) * 100).toFixed(0)}% of contract
                          </Text>
                        </View>
                        <View style={{ height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' }}>
                          <View style={{
                            width: `${Math.min(100, (detail.scheduleOfValues.previouslyClaimedTotal / detail.scheduleOfValues.contractValueTotal) * 100)}%` as any,
                            height: '100%',
                            backgroundColor: colors.primary,
                            borderRadius: 3,
                          }} />
                        </View>
                      </View>
                    )}

                    {/* SOV table */}
                    <Text style={[styles.sovTitle, { color: colors.mutedForeground }]}>Schedule of Values</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
                      <View>
                        <View style={[styles.tableRow, styles.tableHead, { backgroundColor: colors.muted }]}>
                          {['Description', 'Contract', 'Prev.', 'This Claim', 'Cumul.%', 'Retention', 'Balance'].map((h) => (
                            <Text key={h} style={[styles.th, { color: colors.mutedForeground }, h === 'Description' ? styles.descCol : styles.numCol]}>{h}</Text>
                          ))}
                        </View>
                        {detail.lineItems.map((li, i) => {
                          const isUnclaimed = parseFloat(li.previouslyClaimed || '0') <= 0 && (li.cumulativePct ?? 0) <= 0;
                          return (
                            <View
                              key={li.id}
                              style={[
                                styles.tableRow,
                                { backgroundColor: i % 2 === 0 ? colors.card : colors.muted + '40' },
                                isUnclaimed && { backgroundColor: '#FEF3C720' },
                              ]}
                            >
                              <View style={[styles.descCol, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                                {isUnclaimed && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#F59E0B' }} />}
                                <Text style={[styles.td, { color: colors.foreground, flex: 1 }]} numberOfLines={2}>{li.description}</Text>
                              </View>
                              <Text style={[styles.td, styles.numCol, { color: colors.foreground }]}>{fmt(li.contractValue)}</Text>
                              <Text style={[styles.td, styles.numCol, { color: colors.foreground }]}>{fmt(li.previouslyClaimed)}</Text>
                              <Text style={[styles.td, styles.numCol, styles.thisClaimCol]}>{fmt(li.thisClaim)}</Text>
                              <Text style={[styles.td, styles.numCol, { color: colors.mutedForeground }]}>{li.cumulativePct?.toFixed(1) ?? '-'}%</Text>
                              <Text style={[styles.td, styles.numCol, { color: colors.foreground }]}>{fmt(li.retentionAmount)}</Text>
                              <Text style={[styles.td, styles.numCol, { color: colors.foreground }]}>{fmt(li.balance)}</Text>
                            </View>
                          );
                        })}
                        <View style={[styles.tableRow, styles.tableFooter, { backgroundColor: colors.muted }]}>
                          <Text style={[styles.th, styles.descCol, { color: colors.foreground }]}>Totals</Text>
                          <Text style={[styles.th, styles.numCol, { color: colors.foreground }]}>{fmt(detail.scheduleOfValues.contractValueTotal)}</Text>
                          <Text style={[styles.th, styles.numCol, { color: colors.foreground }]}>{fmt(detail.scheduleOfValues.previouslyClaimedTotal)}</Text>
                          <Text style={[styles.th, styles.numCol, styles.thisClaimCol]}>{fmt(detail.scheduleOfValues.thisClaimTotal)}</Text>
                          <Text style={[styles.th, styles.numCol, { color: colors.mutedForeground }]}>-</Text>
                          <Text style={[styles.th, styles.numCol, { color: colors.foreground }]}>{fmt(detail.scheduleOfValues.retentionTotal)}</Text>
                          <Text style={[styles.th, styles.numCol, { color: colors.foreground }]}>{fmt(detail.scheduleOfValues.balanceTotal)}</Text>
                        </View>
                      </View>
                    </ScrollView>

                    {/* Summary */}
                    <View style={[styles.summaryBox, { borderColor: colors.cardBorder }]}>
                      {[
                        ['This Claim', detail.scheduleOfValues.thisClaimTotal],
                        ['Less Retention', -detail.scheduleOfValues.retentionTotal],
                        ['Subtotal', detail.scheduleOfValues.subtotal],
                        ...(detail.scheduleOfValues.gstAmount > 0 ? [['GST (10%)', detail.scheduleOfValues.gstAmount]] : []),
                      ].map(([label, val]) => (
                        <View key={String(label)} style={styles.summaryRow}>
                          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
                          <Text style={[styles.summaryValue, { color: colors.foreground }]}>{fmt(Number(val))}</Text>
                        </View>
                      ))}
                      <View style={[styles.summaryRow, styles.totalRow, { borderTopColor: colors.cardBorder }]}>
                        <Text style={[styles.totalLabel, { color: colors.foreground }]}>Total Due</Text>
                        <Text style={[styles.totalValue, { color: colors.foreground }]}>{fmt(detail.scheduleOfValues.total)}</Text>
                      </View>
                    </View>

                    {claim.notes ? (
                      <Text style={[styles.notes, { color: colors.mutedForeground }]}>{claim.notes}</Text>
                    ) : null}

                    {/* Cost report PDF attached at submission — open via signed URL */}
                    {claim.costReportUrl ? (
                      <TouchableOpacity
                        style={[styles.costReportBtn, { borderColor: colors.cardBorder, backgroundColor: colors.card }]}
                        onPress={async () => {
                          try {
                            const res = await api.get<{ url: string }>(
                              `/api/jobs/${jobId}/claims/${claim.id}/cost-report-pdf`,
                            );
                            const signedUrl = res.data?.url;
                            if (signedUrl) {
                              await Linking.openURL(signedUrl);
                            } else {
                              showToast({ type: 'error', message: 'Could not get download link' });
                            }
                          } catch {
                            showToast({ type: 'error', message: 'Failed to open cost report' });
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Feather name="file-text" size={14} color={colors.primary} />
                        <Text style={[styles.costReportBtnText, { color: colors.primary }]}>Download Cost Report PDF</Text>
                        <Feather name="download" size={14} color={colors.primary} />
                      </TouchableOpacity>
                    ) : null}

                    {/* Action buttons */}
                    {isOwnerOrManager && (
                      <View style={styles.actions}>
                        {claim.status === 'submitted' && (
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.primaryBtn]}
                            onPress={() => handleAction(claim.id, 'approve')}
                            disabled={actionLoading !== null}
                          >
                            {actionLoading === 'approve' ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={styles.primaryBtnText}>Approve & Push Xero</Text>
                            )}
                          </TouchableOpacity>
                        )}
                        {isApproved && !claim.xeroInvoiceId && onCreateInvoice && (
                          <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#D1FAE5', borderColor: '#6EE7B7' }]}
                            onPress={() => onCreateInvoice(claim)}
                          >
                            <Feather name="file-plus" size={14} color="#065F46" />
                            <Text style={[styles.actionBtnText, { color: '#065F46' }]}>Create Invoice</Text>
                          </TouchableOpacity>
                        )}
                        {claim.status === 'approved' && (
                          <TouchableOpacity
                            style={[styles.actionBtn, { borderColor: colors.cardBorder }]}
                            onPress={() => handleAction(claim.id, 'mark-paid')}
                            disabled={actionLoading !== null}
                          >
                            {actionLoading === 'mark-paid' ? (
                              <ActivityIndicator size="small" color={colors.mutedForeground} />
                            ) : (
                              <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Mark Paid</Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </View>
        );
      })}

      {/* ── Edit Draft Claim sheet ────────────────────────────────────────── */}
      <AppBottomSheet
        visible={!!editingClaim}
        onDismiss={closeEditSheet}
        title={editingClaim ? `Edit ${editingClaim.claimNumber}` : 'Edit Claim'}
        showCloseButton
        snapPoints={['90%']}
        footer={(
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <SheetButton
              variant="outline"
              label="Save & Close"
              onPress={handleSaveEdit}
              loading={isSavingEdit}
              disabled={isSavingEdit || isSubmittingClaim}
              style={{ flex: 1 }}
            />
            <SheetButton
              label="Submit Claim"
              onPress={handleRequestSubmit}
              loading={isSubmittingClaim}
              disabled={isSavingEdit || isSubmittingClaim}
              style={{ flex: 1 }}
            />
          </View>
        )}
      >
        <BottomSheetScrollView keyboardShouldPersistTaps="handled">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            {/* Claim Date */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Claim Date</Text>
            <TouchableOpacity
              style={[styles.dateField, { borderColor: colors.border, backgroundColor: colors.muted }]}
              onPress={() => openDatePicker('claimDate')}
              activeOpacity={0.7}
            >
              <Feather name="calendar" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
              <Text style={[styles.dateFieldText, { color: editForm.claimDate ? colors.foreground : colors.mutedForeground }]}>
                {editForm.claimDate ? fmtDate(editForm.claimDate) : 'Select date'}
              </Text>
              <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
            {datePickerTarget === 'claimDate' && (
              <View style={[styles.datePickerContainer, { backgroundColor: colors.muted, borderColor: colors.cardBorder }]}>
                <DateTimePicker value={datePickerValue} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onDateChange} />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity style={[styles.datePickerDone, { backgroundColor: colors.primary }]} onPress={confirmDatePicker}>
                    <Text style={{ color: '#fff', fontWeight: fontWeights.semibold }}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Period */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: spacing.md }]}>Claim Period</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TouchableOpacity
                style={[styles.dateField, { flex: 1, borderColor: colors.border, backgroundColor: colors.muted }]}
                onPress={() => openDatePicker('periodStart')}
                activeOpacity={0.7}
              >
                <Feather name="calendar" size={14} color={colors.mutedForeground} style={{ marginRight: 6 }} />
                <Text style={[styles.dateFieldText, { fontSize: 13, flex: 1, color: editForm.periodStart ? colors.foreground : colors.mutedForeground }]}>
                  {editForm.periodStart ? fmtDate(editForm.periodStart) : 'Start'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateField, { flex: 1, borderColor: colors.border, backgroundColor: colors.muted }]}
                onPress={() => openDatePicker('periodEnd')}
                activeOpacity={0.7}
              >
                <Feather name="calendar" size={14} color={colors.mutedForeground} style={{ marginRight: 6 }} />
                <Text style={[styles.dateFieldText, { fontSize: 13, flex: 1, color: editForm.periodEnd ? colors.foreground : colors.mutedForeground }]}>
                  {editForm.periodEnd ? fmtDate(editForm.periodEnd) : 'End'}
                </Text>
              </TouchableOpacity>
            </View>
            {(datePickerTarget === 'periodStart' || datePickerTarget === 'periodEnd') && (
              <View style={[styles.datePickerContainer, { backgroundColor: colors.muted, borderColor: colors.cardBorder }]}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: 'center', marginBottom: 4 }}>
                  {datePickerTarget === 'periodStart' ? 'Period Start' : 'Period End'}
                </Text>
                <DateTimePicker value={datePickerValue} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onDateChange} />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity style={[styles.datePickerDone, { backgroundColor: colors.primary }]} onPress={confirmDatePicker}>
                    <Text style={{ color: '#fff', fontWeight: fontWeights.semibold }}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Line Items */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: spacing.lg }]}>Line Items</Text>
            {loadingEditItems && (
              <ActivityIndicator size="small" color={colors.mutedForeground} style={{ marginVertical: spacing.sm }} />
            )}
            {!loadingEditItems && editLineItems.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: 'left', paddingHorizontal: 0, paddingVertical: spacing.xs }]}>
                No line items yet. Add one below.
              </Text>
            )}
            {!loadingEditItems && editLineItems.map((li) => {
              const isUnclaimed = parseFloat(li.previouslyClaimed || '0') <= 0 && (li.cumulativePct ?? 0) <= 0;
              return (
                <View
                  key={li.id}
                  style={[
                    styles.lineItemRow,
                    { borderColor: isUnclaimed ? '#F59E0B' : colors.cardBorder, backgroundColor: isUnclaimed ? '#FEF3C720' : colors.muted + '60' },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lineItemDesc, { color: colors.foreground }]} numberOfLines={2}>{li.description}</Text>
                    {isUnclaimed && (
                      <Text style={{ fontSize: 10, color: '#92400E', marginTop: 2 }}>Never claimed</Text>
                    )}
                  </View>
                  <Text style={[styles.lineItemAmount, { color: colors.primary }]}>{fmt(li.thisClaim)}</Text>
                </View>
              );
            })}

            {/* Add Line Item */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: spacing.md }]}>Add Line Item</Text>
            <TextInput
              style={[styles.textInput, { borderColor: colors.border, backgroundColor: colors.muted, color: colors.foreground }]}
              placeholder="Description"
              placeholderTextColor={colors.mutedForeground}
              value={newLineDesc}
              onChangeText={setNewLineDesc}
              returnKeyType="next"
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <TextInput
                style={[styles.textInput, { flex: 1, borderColor: colors.border, backgroundColor: colors.muted, color: colors.foreground }]}
                placeholder="Amount ($)"
                placeholderTextColor={colors.mutedForeground}
                value={newLineAmount}
                onChangeText={setNewLineAmount}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.addLineBtn, { backgroundColor: newLineDesc.trim() ? colors.primary : colors.muted, opacity: isAddingLine ? 0.6 : 1 }]}
                onPress={handleAddLineItem}
                disabled={isAddingLine || !newLineDesc.trim()}
              >
                {isAddingLine
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Feather name="plus" size={18} color={newLineDesc.trim() ? '#fff' : colors.mutedForeground} />
                }
              </TouchableOpacity>
            </View>

            <View style={{ height: spacing.xl }} />
          </KeyboardAvoidingView>
        </BottomSheetScrollView>
      </AppBottomSheet>

      {/* Pre-submit Confirmation Sheet */}
      <AppBottomSheet
        visible={showConfirmModal}
        onDismiss={() => setShowConfirmModal(false)}
        title={`Submit ${confirmDetail?.claimNumber ?? 'Claim'}?`}
        showCloseButton
        autoHeight
        footer={(
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <SheetButton
              variant="outline"
              label="Cancel"
              onPress={() => setShowConfirmModal(false)}
              style={{ flex: 1 }}
            />
            <SheetButton
              label="Submit Claim"
              onPress={async () => {
                setShowConfirmModal(false);
                await doSubmit();
              }}
              loading={isSubmittingClaim}
              disabled={isSubmittingClaim}
              style={{ flex: 1 }}
            />
          </View>
        )}
      >
        <View style={{ gap: spacing.md, paddingVertical: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="send" size={18} color={colors.primary} />
            </View>
            <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
              Review totals before sending. Once submitted, the claim cannot be edited.
            </Text>
          </View>

          {confirmDetail && (
            <View style={{ backgroundColor: colors.muted, borderRadius: radius.md, padding: spacing.md, gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: colors.mutedForeground }}>This Claim</Text>
                <Text style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                  {fmt(confirmDetail.thisClaimTotal)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Retention Held</Text>
                <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                  -{fmt(confirmDetail.retentionHeld)}
                </Text>
              </View>
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, fontWeight: fontWeights.bold, color: colors.foreground }}>Amount Due</Text>
                <Text style={{ fontSize: 14, fontWeight: fontWeights.bold, color: colors.primary }}>
                  {fmt(confirmDetail.amountDue)}
                </Text>
              </View>
            </View>
          )}
        </View>
      </AppBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sectionTitle: { fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, flex: 1 },
  countBadge: { borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 },
  countText: { fontSize: 10, fontWeight: fontWeights.semibold },
  centered: { alignItems: 'center', paddingVertical: spacing.lg },
  emptyText: { fontSize: typography.sizes.sm, textAlign: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  claimCard: { marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  claimHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
  claimHeaderLeft: { flex: 1 },
  claimTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  claimNumber: { fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold },
  statusBadge: { borderRadius: 99, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: fontWeights.semibold },
  claimMeta: { fontSize: 11, marginTop: 2 },
  claimTotal: { fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold, marginTop: 2 },
  detailArea: { borderTopWidth: 1, padding: spacing.md },
  sovTitle: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm, fontWeight: fontWeights.semibold },
  tableScroll: { marginBottom: spacing.sm },
  tableRow: { flexDirection: 'row', alignItems: 'center' },
  tableHead: { borderRadius: 4 },
  tableFooter: { borderRadius: 4 },
  th: { padding: 6, fontSize: 9, fontWeight: fontWeights.semibold, textTransform: 'uppercase', letterSpacing: 0.3 },
  td: { padding: 6, fontSize: 10 },
  descCol: { width: 140 },
  numCol: { width: 80, textAlign: 'right' },
  thisClaimCol: { color: '#1E40AF', fontWeight: '600' },
  summaryBox: { borderWidth: 1, borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  summaryLabel: { fontSize: 11 },
  summaryValue: { fontSize: 11 },
  totalRow: { borderTopWidth: 1, marginTop: 4, paddingTop: 6 },
  totalLabel: { fontSize: 13, fontWeight: fontWeights.bold },
  totalValue: { fontSize: 13, fontWeight: fontWeights.bold },
  notes: { fontSize: 11, marginBottom: spacing.sm, fontStyle: 'italic' },
  costReportBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, marginBottom: spacing.sm },
  costReportBtnText: { flex: 1, fontSize: typography.sizes.sm, fontWeight: fontWeights.medium },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  actionBtnText: { fontSize: typography.sizes.sm, fontWeight: fontWeights.medium },
  primaryBtn: { backgroundColor: '#2563EB', borderColor: '#2563EB', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  primaryBtnText: { color: '#fff', fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold },
  fieldLabel: {
    fontSize: 11, fontWeight: fontWeights.semibold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs,
  },
  dateField: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, height: 44,
  },
  dateFieldText: { flex: 1, fontSize: 14 },
  datePickerContainer: {
    borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.xs, marginBottom: spacing.sm,
  },
  datePickerDone: {
    borderRadius: radius.sm, paddingVertical: spacing.xs, alignItems: 'center', marginTop: spacing.xs,
  },
  lineItemRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, marginBottom: spacing.xs,
  },
  lineItemDesc: { flex: 1, fontSize: 13, marginRight: spacing.sm },
  lineItemAmount: { fontSize: 13, fontWeight: fontWeights.semibold },
  textInput: {
    borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, fontSize: 14, height: 44,
  },
  addLineBtn: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
