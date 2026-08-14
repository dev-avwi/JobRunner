/**
 * ClaimsSection (mobile) — read-only summary of progress claims for a job.
 * Shows claim list with status, totals and a schedule-of-values breakdown
 * for the selected claim. Owners/managers also see action buttons.
 *
 * Draft claims open an edit sheet when tapped so users can set the claim
 * period, add line items and submit from mobile.
 */
import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet,
  ScrollView, TextInput, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ThemeColors } from '../../lib/theme';
import { spacing, radius, typography, fontWeights } from '../../lib/design-tokens';
import api from '../../lib/api';
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
  // Returns YYYY-MM-DD local date string
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
}

export function ClaimsSection({
  colors, claims, isLoading, jobId, isOwnerOrManager = false, onRefresh, onAddClaim,
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

  // Date picker state — which field is being edited, the current picked Date
  const [datePickerTarget, setDatePickerTarget] = useState<'claimDate' | 'periodStart' | 'periodEnd' | null>(null);
  const [datePickerValue, setDatePickerValue] = useState<Date>(new Date());

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

  // ── action buttons (submit / approve / mark-paid) ─────────────────────────
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

    // Fetch existing line items for this draft claim
    setLoadingEditItems(true);
    try {
      const res = await api.get<{ lineItems: ClaimLineItem[] }>(
        `/api/jobs/${jobId}/claims/${claim.id}`,
      );
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

  /** PATCH the claim header with the current form values */
  const saveClaimHeader = async (claimId: string) => {
    const body: Record<string, string> = {};
    if (editForm.claimDate)   body.claimDate   = new Date(editForm.claimDate).toISOString();
    if (editForm.periodStart) body.periodStart  = new Date(editForm.periodStart).toISOString();
    if (editForm.periodEnd)   body.periodEnd    = new Date(editForm.periodEnd).toISOString();
    await api.patch(`/api/jobs/${jobId}/claims/${claimId}`, body);
  };

  /** POST a new line item then refresh the list */
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
      // Refresh line items
      const res = await api.get<{ lineItems: ClaimLineItem[] }>(
        `/api/jobs/${jobId}/claims/${editingClaim.id}`,
      );
      setEditLineItems(res.data?.lineItems ?? []);
      setNewLineDesc('');
      setNewLineAmount('');
    } catch (e: any) {
      showToast({ type: 'error', message: e?.response?.data?.error || 'Failed to add line item' });
    } finally {
      setIsAddingLine(false);
    }
  };

  /** Save header fields and close the sheet */
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

  /** Save header fields then submit the claim */
  const handleSubmitFromEdit = async () => {
    if (!editingClaim) return;
    setIsSubmittingClaim(true);
    try {
      // Persist any header changes first
      await saveClaimHeader(editingClaim.id);
      // Then submit
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

  // ── date picker handlers ──────────────────────────────────────────────────

  const openDatePicker = (target: 'claimDate' | 'periodStart' | 'periodEnd') => {
    const existing = editForm[target];
    setDatePickerValue(existing ? parseDateStr(existing) : new Date());
    setDatePickerTarget(target);
  };

  const onDateChange = (_event: any, selectedDate?: Date) => {
    // On Android the dialog closes itself
    if (Platform.OS === 'android') setDatePickerTarget(null);
    if (selectedDate) {
      const iso = toISODateStr(selectedDate);
      setDatePickerValue(selectedDate);
      if (datePickerTarget) {
        setEditForm(f => ({ ...f, [datePickerTarget]: iso }));
      }
    }
  };

  const confirmDatePicker = () => {
    if (datePickerTarget) {
      setEditForm(f => ({ ...f, [datePickerTarget]: toISODateStr(datePickerValue) }));
    }
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
                    {/* SOV table — horizontal scroll */}
                    <Text style={[styles.sovTitle, { color: colors.mutedForeground }]}>Schedule of Values</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
                      <View>
                        {/* Table header */}
                        <View style={[styles.tableRow, styles.tableHead, { backgroundColor: colors.muted }]}>
                          {['Description', 'Contract', 'Prev.', 'This Claim', 'Cumul.%', 'Retention', 'Balance'].map((h) => (
                            <Text key={h} style={[styles.th, { color: colors.mutedForeground }, h === 'Description' ? styles.descCol : styles.numCol]}>{h}</Text>
                          ))}
                        </View>
                        {detail.lineItems.map((li, i) => (
                          <View key={li.id} style={[styles.tableRow, { backgroundColor: i % 2 === 0 ? colors.card : colors.muted + '40' }]}>
                            <Text style={[styles.td, styles.descCol, { color: colors.foreground }]} numberOfLines={2}>{li.description}</Text>
                            <Text style={[styles.td, styles.numCol, { color: colors.foreground }]}>{fmt(li.contractValue)}</Text>
                            <Text style={[styles.td, styles.numCol, { color: colors.foreground }]}>{fmt(li.previouslyClaimed)}</Text>
                            <Text style={[styles.td, styles.numCol, styles.thisClaimCol]}>{fmt(li.thisClaim)}</Text>
                            <Text style={[styles.td, styles.numCol, { color: colors.mutedForeground }]}>{li.cumulativePct?.toFixed(1) ?? '-'}%</Text>
                            <Text style={[styles.td, styles.numCol, { color: colors.foreground }]}>{fmt(li.retentionAmount)}</Text>
                            <Text style={[styles.td, styles.numCol, { color: colors.foreground }]}>{fmt(li.balance)}</Text>
                          </View>
                        ))}
                        {/* Totals row */}
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

                    {/* Action buttons (owner/manager only) */}
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
              onPress={handleSubmitFromEdit}
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
            {/* ── Claim Date ──────────────────────────────────────────── */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Claim Date</Text>
            <TouchableOpacity
              style={[styles.dateField, { borderColor: colors.border, backgroundColor: colors.card }]}
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
                <DateTimePicker
                  value={datePickerValue}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[styles.datePickerDone, { backgroundColor: colors.primary }]}
                    onPress={confirmDatePicker}
                  >
                    <Text style={{ color: '#fff', fontWeight: fontWeights.semibold }}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ── Period ──────────────────────────────────────────────── */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: spacing.md }]}>Claim Period</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TouchableOpacity
                style={[styles.dateField, { flex: 1, borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => openDatePicker('periodStart')}
                activeOpacity={0.7}
              >
                <Feather name="calendar" size={14} color={colors.mutedForeground} style={{ marginRight: 6 }} />
                <Text style={[styles.dateFieldText, { fontSize: 13, flex: 1, color: editForm.periodStart ? colors.foreground : colors.mutedForeground }]}>
                  {editForm.periodStart ? fmtDate(editForm.periodStart) : 'Start'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateField, { flex: 1, borderColor: colors.border, backgroundColor: colors.card }]}
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
                <DateTimePicker
                  value={datePickerValue}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={[styles.datePickerDone, { backgroundColor: colors.primary }]}
                    onPress={confirmDatePicker}
                  >
                    <Text style={{ color: '#fff', fontWeight: fontWeights.semibold }}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ── Existing Line Items ──────────────────────────────────── */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: spacing.lg }]}>Line Items</Text>

            {loadingEditItems && (
              <ActivityIndicator size="small" color={colors.mutedForeground} style={{ marginVertical: spacing.sm }} />
            )}

            {!loadingEditItems && editLineItems.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: 'left', paddingHorizontal: 0, paddingVertical: spacing.xs }]}>
                No line items yet. Add one below.
              </Text>
            )}

            {!loadingEditItems && editLineItems.map((li) => (
              <View key={li.id} style={[styles.lineItemRow, { borderColor: colors.cardBorder, backgroundColor: colors.muted + '60' }]}>
                <Text style={[styles.lineItemDesc, { color: colors.foreground }]} numberOfLines={2}>{li.description}</Text>
                <Text style={[styles.lineItemAmount, { color: colors.primary }]}>{fmt(li.thisClaim)}</Text>
              </View>
            ))}

            {/* ── Add Line Item ────────────────────────────────────────── */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: spacing.md }]}>Add Line Item</Text>
            <TextInput
              style={[styles.textInput, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
              placeholder="Description"
              placeholderTextColor={colors.mutedForeground}
              value={newLineDesc}
              onChangeText={setNewLineDesc}
              returnKeyType="next"
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <TextInput
                style={[styles.textInput, { flex: 1, borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
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

            {/* Bottom padding so keyboard doesn't cover the add button */}
            <View style={{ height: spacing.xl }} />
          </KeyboardAvoidingView>
        </BottomSheetScrollView>
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
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  actionBtn: { borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  actionBtnText: { fontSize: typography.sizes.sm, fontWeight: fontWeights.medium },
  primaryBtn: { backgroundColor: '#2563EB', borderColor: '#2563EB', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  primaryBtnText: { color: '#fff', fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold },
  // Edit sheet styles
  fieldLabel: {
    fontSize: 11,
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    height: 44,
  },
  dateFieldText: {
    flex: 1,
    fontSize: 14,
  },
  datePickerContainer: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  datePickerDone: {
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  lineItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  lineItemDesc: {
    flex: 1,
    fontSize: 13,
    marginRight: spacing.sm,
  },
  lineItemAmount: {
    fontSize: 13,
    fontWeight: fontWeights.semibold,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 14,
    height: 44,
  },
  addLineBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
