import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemeColors } from '../../lib/theme';
import { spacing, radius, shadows, typography, fontWeights } from '../../lib/design-tokens';

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
  status?: string | null;
  orderDate?: string | null;
  total?: string | null;
  sentAt?: string | null;
  items?: POItem[];
}

const PO_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
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

export interface PurchaseOrdersSectionProps {
  colors: ThemeColors;
  purchaseOrders: PurchaseOrder[];
  isLoadingPOs: boolean;
  onAddPO?: () => void;
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

export function PurchaseOrdersSection({ colors, purchaseOrders, isLoadingPOs, onAddPO }: PurchaseOrdersSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => setExpandedId(prev => prev === id ? null : id);

  return (
    <View style={{ marginTop: spacing.lg }}>
      {/* Section header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
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
          alignItems: 'center',
          ...shadows.sm,
        }}>
          <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground }}>
            No purchase orders linked to this job.
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {purchaseOrders.map((po) => {
            const statusCfg = PO_STATUS_CONFIG[po.status || 'pending'] || PO_STATUS_CONFIG.pending;
            const isExpanded = expandedId === po.id;
            return (
              <View key={po.id} style={{
                backgroundColor: colors.card,
                borderRadius: radius.lg,
                overflow: 'hidden',
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
                      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: 3 }}>
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
                    <Feather
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.mutedForeground}
                    />
                  </View>
                </TouchableOpacity>

                {/* Expanded line items */}
                {isExpanded && po.items && po.items.length > 0 && (
                  <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                    {/* Table header */}
                    <View style={{ flexDirection: 'row', backgroundColor: colors.muted, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
                      <Text style={{ flex: 3, fontSize: 11, fontWeight: fontWeights.semibold as any, color: colors.mutedForeground }}>Description</Text>
                      <Text style={{ flex: 1, fontSize: 11, fontWeight: fontWeights.semibold as any, color: colors.mutedForeground, textAlign: 'center' }}>Qty</Text>
                      <Text style={{ flex: 1, fontSize: 11, fontWeight: fontWeights.semibold as any, color: colors.mutedForeground, textAlign: 'center' }}>Rcvd</Text>
                      <Text style={{ flex: 2, fontSize: 11, fontWeight: fontWeights.semibold as any, color: colors.mutedForeground, textAlign: 'right' }}>Status</Text>
                    </View>
                    {po.items.map((item, idx) => {
                      const itemCfg = ITEM_STATUS_CONFIG[item.status || 'pending'] || ITEM_STATUS_CONFIG.pending;
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
                          <Text style={{ flex: 1, fontSize: typography.sizes.xs, color: colors.mutedForeground, textAlign: 'center' }}>{item.quantity}</Text>
                          <Text style={{ flex: 1, fontSize: typography.sizes.xs, color: colors.mutedForeground, textAlign: 'center' }}>
                            {item.receivedQuantity ?? 0}
                          </Text>
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
                {isExpanded && (!po.items || po.items.length === 0) && (
                  <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md }}>
                    <Text style={{ fontSize: typography.sizes.xs, color: colors.mutedForeground }}>No line items.</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
