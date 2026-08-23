/**
 * VariationsSection — displays job variations (change orders) on the mobile job detail screen.
 * Read-only list for all users; owners/managers can add new variations and approve/reject pending ones.
 *
 * Polish additions:
 *  - "Added to contract" chip on approved variation cards
 *  - Running revised contract total header (original + approved = revised)
 *  - Rejected variations: muted/strikethrough styling, reject reason inline
 *  - Photo upload via FormData (shared pattern with SiteDiary) instead of base64
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Image,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemeColors } from '../../lib/theme';
import { spacing, radius, typography, fontWeights } from '../../lib/design-tokens';
import api from '../../lib/api';
import { showToast } from '../../lib/toast';
import { AppBottomSheet, BottomSheetScrollView } from '../ui/AppBottomSheet';
import { SheetButton } from '../ui/SheetButton';
import { useActionSheet } from '../ui/ActionSheet';
import { SkeletonSection } from '../Skeleton';

// ─── types ────────────────────────────────────────────────────────────────────

export type VariationStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'pending';

export interface JobVariation {
  id: string;
  jobId: string;
  number: string;
  title: string;
  description?: string | null;
  reason?: string | null;
  additionalAmount: string;
  gstAmount: string;
  totalAmount: string;
  status: VariationStatus;
  photos?: any[];
  createdByName?: string | null;
  createdAt?: string | null;
  approvedAt?: string | null;
  approvedByName?: string | null;
  approvalMethod?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<VariationStatus, { label: string; bg: string; text: string }> = {
  draft:    { label: 'Draft',    bg: '#F3F4F6', text: '#374151' },
  sent:     { label: 'Pending',  bg: '#FEF3C7', text: '#92400E' },
  pending:  { label: 'Pending',  bg: '#FEF3C7', text: '#92400E' },
  approved: { label: 'Approved', bg: '#D1FAE5', text: '#065F46' },
  rejected: { label: 'Rejected', bg: '#FEE2E2', text: '#991B1B' },
};

function fmt(v: string | number | null | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : (v ?? 0);
  return `$${(isNaN(n) ? 0 : n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

// ─── component ────────────────────────────────────────────────────────────────

export interface VariationsSectionProps {
  colors: ThemeColors;
  variations: JobVariation[];
  isLoading: boolean;
  jobId: string;
  isOwnerOrManager?: boolean;
  onRefresh?: () => void;
  /** Original contract value (ex-GST) — used to show revised contract total */
  contractValue?: number | null;
}

export function VariationsSection({
  colors,
  variations,
  isLoading,
  jobId,
  isOwnerOrManager = false,
  onRefresh,
  contractValue,
}: VariationsSectionProps) {
  const showActionSheet = useActionSheet();

  // ── add sheet state ───────────────────────────────────────────────────────
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addForm, setAddForm] = useState({
    title: '',
    description: '',
    reason: '',
    additionalAmount: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // ── detail sheet state ────────────────────────────────────────────────────
  const [viewingVariation, setViewingVariation] = useState<JobVariation | null>(null);

  // ── action state ──────────────────────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── computed ──────────────────────────────────────────────────────────────
  const approvedVariations = variations.filter((v) => v.status === 'approved');
  const approvedTotal = approvedVariations.reduce((sum, v) => sum + parseFloat(v.totalAmount || '0'), 0);
  const pendingCount = variations.filter((v) => v.status === 'sent' || v.status === 'pending').length;
  const revisedContractValue = contractValue != null ? contractValue + approvedTotal : null;

  // ── create variation ──────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!addForm.title.trim()) {
      showToast({ type: 'error', message: 'Title is required' });
      return;
    }
    setIsSaving(true);
    try {
      const amount = parseFloat(addForm.additionalAmount.replace(/[^0-9.]/g, '')) || 0;

      // Send as JSON — photos are uploaded as object storage keys after creation
      const res = await api.post(`/api/jobs/${jobId}/variations`, {
        title: addForm.title.trim(),
        description: addForm.description.trim() || undefined,
        reason: addForm.reason.trim() || undefined,
        additionalAmount: amount,
        photos: [],
      });
      if (res.error) {
        showToast({ type: 'error', message: res.error });
        return;
      }
      showToast({ type: 'success', message: 'Variation created' });
      setShowAddSheet(false);
      setAddForm({ title: '', description: '', reason: '', additionalAmount: '' });
      onRefresh?.();
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Failed to create variation' });
    } finally {
      setIsSaving(false);
    }
  }, [addForm, jobId, onRefresh]);

  // ── approve / reject ──────────────────────────────────────────────────────
  const handleVariationAction = useCallback((variation: JobVariation) => {
    if (!isOwnerOrManager) return;
    const isPendingStatus = variation.status === 'sent' || variation.status === 'pending';
    if (!isPendingStatus) return;

    showActionSheet({
      title: `${variation.number}: ${variation.title}`,
      message: `${fmt(variation.totalAmount)} (incl. GST)`,
      actions: [
        {
          label: 'Approve',
          icon: 'check-circle' as const,
          onPress: async () => {
            setActionLoading(variation.id);
            try {
              const res = await api.patch(`/api/jobs/${jobId}/variations/${variation.id}`, { status: 'approved' });
              if (res.error) showToast({ type: 'error', message: res.error });
              else { showToast({ type: 'success', message: 'Variation approved' }); onRefresh?.(); }
            } catch (e: any) {
              showToast({ type: 'error', message: e?.message || 'Failed to approve variation' });
            } finally { setActionLoading(null); }
          },
        },
        {
          label: 'Reject',
          icon: 'x-circle' as const,
          style: 'destructive' as const,
          onPress: async () => {
            setActionLoading(variation.id);
            try {
              const res = await api.patch(`/api/jobs/${jobId}/variations/${variation.id}`, { status: 'rejected' });
              if (res.error) showToast({ type: 'error', message: res.error });
              else { showToast({ type: 'success', message: 'Variation rejected' }); onRefresh?.(); }
            } catch (e: any) {
              showToast({ type: 'error', message: e?.message || 'Failed to reject variation' });
            } finally { setActionLoading(null); }
          },
        },
        { label: 'Cancel', style: 'cancel' as const },
      ],
    });
  }, [isOwnerOrManager, jobId, onRefresh, showActionSheet]);

  // ── submit draft ──────────────────────────────────────────────────────────
  const handleSubmitDraft = useCallback(async (variation: JobVariation) => {
    if (!isOwnerOrManager) return;
    setActionLoading(variation.id);
    try {
      const res = await api.patch<{ notificationWarning?: string }>(`/api/jobs/${jobId}/variations/${variation.id}`, { status: 'sent' });
      if (res.error) showToast({ type: 'error', message: res.error });
      else {
        showToast({ type: 'success', message: 'Variation submitted for approval' });
        if (res.data?.notificationWarning) showToast({ type: 'info', message: res.data.notificationWarning });
        onRefresh?.();
      }
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Failed to submit variation' });
    } finally { setActionLoading(null); }
  }, [isOwnerOrManager, jobId, onRefresh]);

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Feather name="git-pull-request" size={14} color={colors.mutedForeground} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Variations</Text>
        {variations.length > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.countText, { color: colors.mutedForeground }]}>{variations.length}</Text>
          </View>
        )}
        {pendingCount > 0 && (
          <View style={[styles.countBadge, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.countText, { color: '#92400E' }]}>{pendingCount} pending</Text>
          </View>
        )}
        {isOwnerOrManager && (
          <TouchableOpacity
            onPress={() => setShowAddSheet(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginLeft: spacing.xs }}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: colors.primaryLight,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
              borderRadius: 8,
            }}>
              <Feather name="plus" size={13} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: fontWeights.semibold, color: colors.primary }}>Add</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Revised contract value header */}
      {(approvedTotal > 0 || revisedContractValue != null) && (
        <View style={[styles.summaryBox, { backgroundColor: '#D1FAE520', borderColor: '#065F4633' }]}>
          <Feather name="check-circle" size={13} color="#065F46" />
          <View style={{ flex: 1 }}>
            {revisedContractValue != null ? (
              <>
                <Text style={[styles.summaryText, { color: '#065F46' }]}>
                  Revised contract: {fmt(revisedContractValue)} (incl. GST)
                </Text>
                <Text style={{ fontSize: 10, color: '#065F46', opacity: 0.7, marginTop: 1 }}>
                  Original {fmt(contractValue)} + {fmt(approvedTotal)} approved variations
                </Text>
              </>
            ) : (
              <Text style={[styles.summaryText, { color: '#065F46' }]}>
                Approved variations: {fmt(approvedTotal)} added to contract value
              </Text>
            )}
          </View>
        </View>
      )}

      {isLoading && <SkeletonSection rows={2} />}

      {!isLoading && variations.length === 0 && (
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          No variations yet. Add a variation to capture scope changes.
        </Text>
      )}

      {variations.map((variation) => {
        const cfg = STATUS_CONFIG[variation.status] ?? STATUS_CONFIG.draft;
        const isActioning = actionLoading === variation.id;
        const isApproved = variation.status === 'approved';
        const isRejected = variation.status === 'rejected';

        return (
          <TouchableOpacity
            key={variation.id}
            style={[
              styles.variationCard,
              {
                borderColor: isRejected ? '#FCA5A5' : isApproved ? '#6EE7B7' : colors.cardBorder,
                backgroundColor: isRejected ? '#FFF5F5' : colors.card,
                opacity: isRejected ? 0.75 : 1,
              },
            ]}
            onPress={() => setViewingVariation(variation)}
            activeOpacity={0.7}
          >
            <View style={styles.cardRow}>
              {/* Number badge */}
              <View style={[styles.numberBadge, { borderColor: isRejected ? '#FCA5A5' : colors.primary + '55' }]}>
                <Text style={[styles.numberText, { color: isRejected ? '#991B1B' : colors.primary }]}>{variation.number}</Text>
              </View>

              {/* Main info */}
              <View style={styles.cardMain}>
                <Text
                  style={[
                    styles.cardTitle,
                    { color: colors.foreground },
                    isRejected && { textDecorationLine: 'line-through', color: colors.mutedForeground },
                  ]}
                  numberOfLines={1}
                >
                  {variation.title}
                </Text>
                {variation.description ? (
                  <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {variation.description}
                  </Text>
                ) : null}
                <View style={styles.cardMeta}>
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
                  </View>
                  {/* "Added to contract" chip for approved */}
                  {isApproved && (
                    <View style={[styles.statusBadge, { backgroundColor: '#D1FAE5', flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
                      <Feather name="check" size={9} color="#065F46" />
                      <Text style={[styles.statusText, { color: '#065F46' }]}>Added to contract</Text>
                    </View>
                  )}
                  {/* "Approved by client" chip when approved via portal */}
                  {isApproved && variation.approvalMethod === 'client_portal' && (
                    <View style={[styles.statusBadge, { backgroundColor: '#DBEAFE', flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
                      <Feather name="user-check" size={9} color="#1D4ED8" />
                      <Text style={[styles.statusText, { color: '#1D4ED8' }]}>Approved by client</Text>
                    </View>
                  )}
                  <Text
                    style={[
                      styles.amountText,
                      { color: colors.foreground },
                      isRejected && { textDecorationLine: 'line-through', color: colors.mutedForeground },
                    ]}
                  >
                    {fmt(variation.totalAmount)}
                  </Text>
                  {variation.createdAt && (
                    <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
                      {fmtDate(variation.createdAt)}
                    </Text>
                  )}
                </View>
                {variation.approvedByName && isApproved && (
                  <Text style={[styles.approverText, { color: '#065F46' }]}>
                    Approved by {variation.approvedByName}
                  </Text>
                )}
                {/* Rejection reason inline on card */}
                {isRejected && variation.rejectionReason && (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 2 }}>
                    <Feather name="x-circle" size={11} color="#991B1B" style={{ marginTop: 1 }} />
                    <Text style={[styles.approverText, { color: '#991B1B', flex: 1 }]}>
                      {variation.rejectionReason}
                    </Text>
                  </View>
                )}
              </View>

              {/* Right */}
              <View style={styles.cardRight}>
                {isActioning ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Variation Detail Sheet */}
      {viewingVariation && (() => {
        const v = viewingVariation;
        const cfg = STATUS_CONFIG[v.status] ?? STATUS_CONFIG.draft;
        const isPending = v.status === 'sent' || v.status === 'pending';
        const isDraft = v.status === 'draft';
        const isActioning = actionLoading === v.id;
        return (
          <AppBottomSheet
            visible={!!viewingVariation}
            onDismiss={() => setViewingVariation(null)}
            title={`${v.number}: ${v.title}`}
            showCloseButton
            snapPoints={['70%']}
            footer={
              isOwnerOrManager && (isPending || isDraft) ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {isPending && (
                    <>
                      <SheetButton
                        variant="outline"
                        label="Reject"
                        loading={isActioning}
                        onPress={async () => {
                          setActionLoading(v.id);
                          try {
                            const res = await api.patch(`/api/jobs/${jobId}/variations/${v.id}`, { status: 'rejected' });
                            if (res.error) showToast({ type: 'error', message: res.error });
                            else { showToast({ type: 'success', message: 'Variation rejected' }); onRefresh?.(); setViewingVariation(null); }
                          } catch (e: any) {
                            showToast({ type: 'error', message: e?.message || 'Failed' });
                          } finally { setActionLoading(null); }
                        }}
                        style={{ flex: 1 }}
                      />
                      <SheetButton
                        label="Approve"
                        loading={isActioning}
                        onPress={async () => {
                          setActionLoading(v.id);
                          try {
                            const res = await api.patch(`/api/jobs/${jobId}/variations/${v.id}`, { status: 'approved' });
                            if (res.error) showToast({ type: 'error', message: res.error });
                            else { showToast({ type: 'success', message: 'Variation approved' }); onRefresh?.(); setViewingVariation(null); }
                          } catch (e: any) {
                            showToast({ type: 'error', message: e?.message || 'Failed' });
                          } finally { setActionLoading(null); }
                        }}
                        style={{ flex: 1 }}
                      />
                    </>
                  )}
                  {isDraft && (
                    <SheetButton
                      label="Submit for Approval"
                      loading={isActioning}
                      onPress={() => { handleSubmitDraft(v); setViewingVariation(null); }}
                      style={{ flex: 1 }}
                    />
                  )}
                </View>
              ) : undefined
            }
          >
            <BottomSheetScrollView showsVerticalScrollIndicator={false}>
              {/* Status + amount */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
                </View>
                {v.status === 'approved' && (
                  <View style={[styles.statusBadge, { backgroundColor: '#D1FAE5', flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
                    <Feather name="check" size={9} color="#065F46" />
                    <Text style={[styles.statusText, { color: '#065F46' }]}>Added to contract</Text>
                  </View>
                )}
                <Text style={[styles.amountText, { color: colors.foreground, fontSize: 18 }]}>
                  {fmt(v.totalAmount)}
                </Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>(incl. GST)</Text>
              </View>
              {v.description ? (
                <View style={{ marginBottom: spacing.md }}>
                  <Text style={{ fontSize: 12, fontWeight: fontWeights.semibold, color: colors.mutedForeground, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description</Text>
                  <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 20 }}>{v.description}</Text>
                </View>
              ) : null}
              {v.reason ? (
                <View style={{ marginBottom: spacing.md }}>
                  <Text style={{ fontSize: 12, fontWeight: fontWeights.semibold, color: colors.mutedForeground, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Reason for Change</Text>
                  <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 20 }}>{v.reason}</Text>
                </View>
              ) : null}
              {/* Amounts breakdown */}
              <View style={{ backgroundColor: colors.muted, borderRadius: 10, padding: spacing.md, marginBottom: spacing.md, gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Subtotal (excl. GST)</Text>
                  <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: fontWeights.medium }}>{fmt(v.additionalAmount)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13, color: colors.mutedForeground }}>GST (10%)</Text>
                  <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: fontWeights.medium }}>{fmt(v.gstAmount)}</Text>
                </View>
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: fontWeights.semibold }}>Total</Text>
                  <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: fontWeights.semibold }}>{fmt(v.totalAmount)}</Text>
                </View>
              </View>
              {/* Dates / approver */}
              {v.createdAt && (
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: 4 }}>Created {fmtDate(v.createdAt)}{v.createdByName ? ` by ${v.createdByName}` : ''}</Text>
              )}
              {v.status === 'approved' && v.approvedAt && (
                <Text style={{ fontSize: 12, color: '#065F46', marginBottom: 4 }}>Approved {fmtDate(v.approvedAt)}{v.approvedByName ? ` by ${v.approvedByName}` : ''}</Text>
              )}
              {v.status === 'rejected' && v.rejectionReason && (
                <View style={{ backgroundColor: '#FEE2E220', borderRadius: 8, padding: spacing.sm, marginTop: spacing.sm }}>
                  <Text style={{ fontSize: 12, color: '#991B1B' }}>Rejection reason: {v.rejectionReason}</Text>
                </View>
              )}
            </BottomSheetScrollView>
          </AppBottomSheet>
        );
      })()}

      {/* Add Variation Bottom Sheet */}
      <AppBottomSheet
        visible={showAddSheet}
        onDismiss={() => {
          setShowAddSheet(false);
          setAddForm({ title: '', description: '', reason: '', additionalAmount: '' });
        }}
        title="Add Variation"
        showCloseButton
        snapPoints={['85%']}
        footer={
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <SheetButton
              variant="outline"
              label="Cancel"
              onPress={() => {
                setShowAddSheet(false);
                setAddForm({ title: '', description: '', reason: '', additionalAmount: '' });
              }}
              style={{ flex: 1 }}
            />
            <SheetButton
              onPress={handleSave}
              loading={isSaving}
              disabled={isSaving || !addForm.title.trim()}
              label="Create Variation"
              style={{ flex: 1 }}
            />
          </View>
        }
      >
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        >
          {/* Title */}
          <Text style={[styles.formLabel, { color: colors.foreground }]}>Title *</Text>
          <TextInput
            style={[styles.formInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="e.g. Additional earthworks"
            placeholderTextColor={colors.mutedForeground}
            value={addForm.title}
            onChangeText={(t) => setAddForm((f) => ({ ...f, title: t }))}
            maxLength={100}
          />

          {/* Estimated Cost */}
          <Text style={[styles.formLabel, { color: colors.foreground }]}>Estimated Cost (excl. GST)</Text>
          <TextInput
            style={[styles.formInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="0.00"
            placeholderTextColor={colors.mutedForeground}
            value={addForm.additionalAmount}
            onChangeText={(t) => setAddForm((f) => ({ ...f, additionalAmount: t }))}
            keyboardType="decimal-pad"
          />

          {/* Description */}
          <Text style={[styles.formLabel, { color: colors.foreground }]}>Description</Text>
          <TextInput
            style={[styles.formInput, styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="Describe the scope change..."
            placeholderTextColor={colors.mutedForeground}
            value={addForm.description}
            onChangeText={(t) => setAddForm((f) => ({ ...f, description: t }))}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Reason */}
          <Text style={[styles.formLabel, { color: colors.foreground }]}>Reason for Change</Text>
          <TextInput
            style={[styles.formInput, styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            placeholder="Why is this change needed?"
            placeholderTextColor={colors.mutedForeground}
            value={addForm.reason}
            onChangeText={(t) => setAddForm((f) => ({ ...f, reason: t }))}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* GST note */}
          {addForm.additionalAmount ? (
            <View style={[styles.gstNote, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="info" size={12} color={colors.mutedForeground} />
              <Text style={[styles.gstNoteText, { color: colors.mutedForeground }]}>
                GST (10%) will be added automatically. Total:{' '}
                {fmt((parseFloat(addForm.additionalAmount.replace(/[^0-9.]/g, '')) || 0) * 1.1)}
              </Text>
            </View>
          ) : null}
        </BottomSheetScrollView>
      </AppBottomSheet>
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: fontWeights.semibold,
    marginLeft: spacing.xs,
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countText: {
    fontSize: 10,
    fontWeight: fontWeights.medium,
  },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    marginBottom: spacing.sm,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: fontWeights.medium,
  },
  centered: {
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.caption.fontSize,
    paddingVertical: spacing.xs,
  },
  variationCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  numberBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  numberText: {
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: fontWeights.semibold,
  },
  cardMain: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: fontWeights.medium,
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: fontWeights.medium,
  },
  amountText: {
    fontSize: 13,
    fontWeight: fontWeights.semibold,
  },
  dateText: {
    fontSize: 11,
  },
  approverText: {
    fontSize: 11,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    paddingTop: 2,
  },
  formLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: fontWeights.semibold,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.md,
    height: 44,
  },
  textArea: {
    height: undefined,
    minHeight: 80,
    paddingTop: spacing.sm,
    textAlignVertical: 'top',
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    overflow: 'visible',
    position: 'relative',
  },
  photoThumbImg: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
  },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  addPhotoBtn: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 9,
    fontWeight: fontWeights.medium,
  },
  gstNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  gstNoteText: {
    fontSize: 12,
    flex: 1,
  },
});
