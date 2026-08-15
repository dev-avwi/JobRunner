/**
 * PurchaseOrdersSection — purchase orders for a job.
 *
 * Polish additions:
 *  - Status change from expanded card (Draft → Sent → Received)
 *  - "Mark as Received" quick action chip on Sent POs
 *  - Received qty vs ordered qty indicator on line items
 *  - Supplier phone/email shown in expanded PO for direct contact
 */
import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemeColors } from '../../lib/theme';
import { spacing, radius, shadows, typography, fontWeights } from '../../lib/design-tokens';
import api from '../../lib/api';
import { showToast } from '../../lib/toast';

interface POItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  receivedQuantity?: number;
  status?: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId?: string | null;
  supplierName?: string | null;
  supplierPhone?: string | null;
  supplierEmail?: string | null;
  status?: string | null;
  orderDate?: string | null;
  total?: string | null;
  sentAt?: string | null;
  receiptUrl?: string | null;
  items?: POItem[];
}

const PO_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  draft:    { label: 'Draft',    bg: '#F3F4F6', text: '#374151' },
  pending:  { label: 'Pending',  bg: '#FEF3C7', text: '#92400E' },
  approved: { label: 'Approved', bg: '#DBEAFE', text: '#1E40AF' },
  sent:     { label: 'Sent',     bg: '#EDE9FE', text: '#6D28D9' },
  received: { label: 'Received', bg: '#D1FAE5', text: '#065F46' },
  cancelled:{ label: 'Cancelled',bg: '#FEE2E2', text: '#991B1B' },
};

const ITEM_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending:  { label: 'Pending',  bg: '#FEF3C7', text: '#92400E' },
  partial:  { label: 'Partial',  bg: '#DBEAFE', text: '#1E40AF' },
  received: { label: 'Received', bg: '#D1FAE5', text: '#065F46' },
  cancelled:{ label: 'Cancelled',bg: '#FEE2E2', text: '#991B1B' },
};

// Status flow: draft → approved → sent → received
const STATUS_FLOW: Record<string, string | null> = {
  draft:    'approved',
  pending:  'approved',
  approved: 'sent',
  sent:     'received',
  received: null,
  cancelled: null,
};

const STATUS_FLOW_LABELS: Record<string, string> = {
  approved: 'Mark Approved',
  sent:     'Mark Sent',
  received: 'Mark Received',
};

export interface PurchaseOrdersSectionProps {
  colors: ThemeColors;
  purchaseOrders: PurchaseOrder[];
  isLoadingPOs: boolean;
  onAddPO?: () => void;
  /** Required for status changes */
  jobId?: string;
  onRefresh?: () => void;
  isOwnerOrManager?: boolean;
}

function formatCurrency(val: string | null | undefined): string {
  if (!val) return '-';
  const n = parseFloat(val);
  if (isNaN(n)) return '-';
  return `$${n.toFixed(2)}`;
}

function formatDate(val: string | null | undefined): string {
  if (!val) return '';
  try {
    return new Date(val).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

export function PurchaseOrdersSection({
  colors,
  purchaseOrders,
  isLoadingPOs,
  onAddPO,
  jobId,
  onRefresh,
  isOwnerOrManager = false,
}: PurchaseOrdersSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);
  // Per-item received qty edits: itemId → draft string value
  const [itemQtyEdits, setItemQtyEdits] = useState<Record<string, string>>({});
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  const toggleExpand = (id: string) => setExpandedId(prev => prev === id ? null : id);

  const handleStatusChange = async (po: PurchaseOrder, newStatus: string) => {
    if (!jobId) return;
    setChangingStatusId(po.id);
    try {
      const res = await api.patch(`/api/purchase-orders/${po.id}`, { status: newStatus });
      if (res.error) {
        showToast({ type: 'error', message: res.error });
      } else {
        showToast({ type: 'success', message: `PO ${PO_STATUS_CONFIG[newStatus]?.label ?? newStatus}` });
        onRefresh?.();
      }
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message ?? 'Failed to update status' });
    } finally {
      setChangingStatusId(null);
    }
  };

  const handleUpdateItemQty = async (poId: string, item: POItem) => {
    const raw = itemQtyEdits[item.id];
    if (raw === undefined) return; // not edited
    const qty = parseInt(raw, 10);
    if (isNaN(qty) || qty < 0) {
      showToast({ type: 'error', message: 'Enter a valid quantity (0 or more)' });
      return;
    }
    setUpdatingItemId(item.id);
    try {
      const res = await api.patch(`/api/purchase-orders/${poId}/items/${item.id}`, { receivedQuantity: qty });
      if (res.error) {
        showToast({ type: 'error', message: res.error });
      } else {
        // Clear the draft edit and refresh to let server recompute PO status
        setItemQtyEdits((prev) => { const next = { ...prev }; delete next[item.id]; return next; });
        onRefresh?.();
      }
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message ?? 'Failed to update received quantity' });
    } finally {
      setUpdatingItemId(null);
    }
  };

  return (
    <View>
      {/* Section header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <Feather name="shopping-cart" size={16} color={colors.mutedForeground} />
        <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold as any, color: colors.foreground, flex: 1 }}>
          Purchase Orders
        </Text>
        {onAddPO && (
          <TouchableOpacity onPress={onAddPO} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8 }}>
              <Feather name="plus" size={13} color={colors.primary} />
              <Text style={{ fontSize: 12, fontWeight: fontWeights.semibold as any, color: colors.primary }}>Add</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {isLoadingPOs ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.md }} />
      ) : purchaseOrders.length === 0 ? (
        <View style={{
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: spacing.lg,
          marginHorizontal: spacing.md,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}>
          <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>
            No purchase orders linked to this job.
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.sm, paddingHorizontal: spacing.md }}>
          {purchaseOrders.map((po) => {
            const statusCfg = PO_STATUS_CONFIG[po.status || 'draft'] || PO_STATUS_CONFIG.draft;
            const isExpanded = expandedId === po.id;
            const nextStatus = STATUS_FLOW[po.status || 'draft'];
            const isChanging = changingStatusId === po.id;

            return (
              <View key={po.id} style={{
                backgroundColor: colors.card,
                borderRadius: radius.lg,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: colors.cardBorder,
                ...shadows.sm,
              }}>
                {/* PO header */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => toggleExpand(po.id)}
                  style={{ padding: spacing.md }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold as any, color: colors.foreground }}>
                          {po.poNumber}
                        </Text>
                        <View style={{
                          backgroundColor: statusCfg.bg,
                          borderRadius: radius.full,
                          paddingHorizontal: spacing.sm,
                          paddingVertical: 2,
                        }}>
                          <Text style={{ fontSize: 11, fontWeight: fontWeights.medium as any, color: statusCfg.text }}>
                            {statusCfg.label}
                          </Text>
                        </View>
                        {po.sentAt && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Feather name="mail" size={11} color={colors.mutedForeground} />
                            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Sent</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: 3, flexWrap: 'wrap' }}>
                        {po.supplierName && (
                          <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>
                            {po.supplierName}
                          </Text>
                        )}
                        {po.orderDate && (
                          <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>
                            {formatDate(po.orderDate)}
                          </Text>
                        )}
                        <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold as any, color: colors.foreground }}>
                          {formatCurrency(po.total)}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                      {/* Quick "Receive Items" shortcut for Sent POs — expands card to reconcile line items */}
                      {isOwnerOrManager && po.status === 'sent' && !isExpanded && (
                        <TouchableOpacity
                          onPress={() => setExpandedId(po.id)}
                          style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}
                          activeOpacity={0.8}
                          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: fontWeights.semibold as any, color: '#065F46' }}>
                            Receive Items
                          </Text>
                        </TouchableOpacity>
                      )}
                      <Feather
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={colors.mutedForeground}
                      />
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Expanded content */}
                {isExpanded && (
                  <>
                    {/* Supplier contact row */}
                    {(po.supplierPhone || po.supplierEmail) && (
                      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
                        {po.supplierPhone && (
                          <TouchableOpacity
                            onPress={() => Linking.openURL(`tel:${po.supplierPhone}`)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                            activeOpacity={0.7}
                          >
                            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' }}>
                              <Feather name="phone" size={13} color={colors.primary} />
                            </View>
                            <Text style={{ fontSize: typography.sizes.xs, color: colors.primary, fontWeight: fontWeights.medium as any }}>
                              {po.supplierPhone}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {po.supplierEmail && (
                          <TouchableOpacity
                            onPress={() => Linking.openURL(`mailto:${po.supplierEmail}`)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                            activeOpacity={0.7}
                          >
                            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center' }}>
                              <Feather name="mail" size={13} color={colors.primary} />
                            </View>
                            <Text style={{ fontSize: typography.sizes.xs, color: colors.primary, fontWeight: fontWeights.medium as any }}>
                              {po.supplierEmail}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* Line items */}
                    {po.items && po.items.length > 0 && (
                      <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                        {/* Table header */}
                        <View style={{ flexDirection: 'row', backgroundColor: colors.muted, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
                          <Text style={{ flex: 3, fontSize: 11, fontWeight: fontWeights.semibold as any, color: colors.mutedForeground }}>Description</Text>
                          <Text style={{ flex: 1, fontSize: 11, fontWeight: fontWeights.semibold as any, color: colors.mutedForeground, textAlign: 'center' }}>Ord</Text>
                          <Text style={{ flex: 1, fontSize: 11, fontWeight: fontWeights.semibold as any, color: colors.mutedForeground, textAlign: 'center' }}>Rcvd</Text>
                          <Text style={{ flex: 2, fontSize: 11, fontWeight: fontWeights.semibold as any, color: colors.mutedForeground, textAlign: 'right' }}>Status</Text>
                        </View>
                        {po.items.map((item, idx) => {
                          const itemCfg = ITEM_STATUS_CONFIG[item.status || 'pending'] || ITEM_STATUS_CONFIG.pending;
                          const received = item.receivedQuantity ?? 0;
                          const ordered = item.quantity;
                          const rcvdColor = received >= ordered ? '#065F46' : received > 0 ? '#1E40AF' : colors.mutedForeground;
                          const canEdit = isOwnerOrManager && po.status === 'sent' && item.status !== 'cancelled';
                          const draftQty = itemQtyEdits[item.id];
                          const isUpdating = updatingItemId === item.id;
                          return (
                            <View
                              key={item.id}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: spacing.md,
                                paddingVertical: spacing.sm,
                                borderTopWidth: idx > 0 ? 1 : 0,
                                borderTopColor: colors.border,
                              }}
                            >
                              <Text style={{ flex: 3, fontSize: typography.sizes.xs, color: colors.foreground }}>{item.description}</Text>
                              <Text style={{ flex: 1, fontSize: typography.sizes.xs, color: colors.mutedForeground, textAlign: 'center' }}>{ordered}</Text>
                              {/* Editable received qty for sent POs */}
                              {canEdit ? (
                                <View style={{ flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 2 }}>
                                  {isUpdating ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                  ) : (
                                    <>
                                      <TextInput
                                        value={draftQty !== undefined ? draftQty : String(received)}
                                        onChangeText={(t) => setItemQtyEdits((prev) => ({ ...prev, [item.id]: t.replace(/[^0-9]/g, '') }))}
                                        onBlur={() => draftQty !== undefined && handleUpdateItemQty(po.id, item)}
                                        keyboardType="number-pad"
                                        style={{
                                          width: 36,
                                          borderWidth: 1,
                                          borderColor: draftQty !== undefined ? colors.primary : colors.border,
                                          borderRadius: 4,
                                          paddingVertical: 2,
                                          paddingHorizontal: 4,
                                          fontSize: typography.sizes.xs,
                                          color: colors.foreground,
                                          textAlign: 'center',
                                        }}
                                      />
                                      {draftQty !== undefined && (
                                        <TouchableOpacity onPress={() => handleUpdateItemQty(po.id, item)} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}>
                                          <Feather name="check" size={12} color="#059669" />
                                        </TouchableOpacity>
                                      )}
                                    </>
                                  )}
                                </View>
                              ) : (
                                <Text style={{ flex: 1, fontSize: typography.sizes.xs, color: rcvdColor, textAlign: 'center', fontWeight: fontWeights.semibold as any }}>
                                  {received}
                                </Text>
                              )}
                              <View style={{ flex: 2, alignItems: 'flex-end' }}>
                                <View style={{
                                  backgroundColor: itemCfg.bg,
                                  borderRadius: radius.full,
                                  paddingHorizontal: spacing.xs,
                                  paddingVertical: 2,
                                }}>
                                  <Text style={{ fontSize: 10, fontWeight: fontWeights.medium as any, color: itemCfg.text }}>
                                    {itemCfg.label}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                    {(!po.items || po.items.length === 0) && (
                      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md }}>
                        <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>No line items.</Text>
                      </View>
                    )}

                    {/* Status picker row */}
                    {isOwnerOrManager && nextStatus && nextStatus !== 'received' && (
                      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Feather name="refresh-cw" size={13} color={colors.mutedForeground} />
                        <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground, flex: 1 }}>Update status:</Text>
                        <TouchableOpacity
                          onPress={() => handleStatusChange(po, nextStatus)}
                          disabled={isChanging}
                          style={{ backgroundColor: `${colors.primary}15`, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: 8, opacity: isChanging ? 0.5 : 1 }}
                          activeOpacity={0.8}
                        >
                          {isChanging ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <Text style={{ fontSize: 12, fontWeight: fontWeights.semibold as any, color: colors.primary }}>
                              {STATUS_FLOW_LABELS[nextStatus] ?? `Mark ${nextStatus}`}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Receipt link */}
                    {po.receiptUrl && (
                      <TouchableOpacity
                        style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
                        onPress={() => Linking.openURL(po.receiptUrl!)}
                        activeOpacity={0.7}
                      >
                        <Feather name="file-text" size={14} color={colors.primary} />
                        <Text style={{ fontSize: typography.sizes.xs, color: colors.primary, flex: 1 }} numberOfLines={1}>
                          View receipt / proof of purchase
                        </Text>
                        <Feather name="external-link" size={12} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
