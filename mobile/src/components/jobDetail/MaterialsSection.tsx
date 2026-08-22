import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemeColors } from '../../lib/theme';
import { spacing, radius, shadows, typography, fontWeights } from '../../lib/design-tokens';

export interface JobMaterial {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  unitPrice?: number;
  markupPercent?: number;
  supplier?: string;
  category?: string;
  status?: string;
  phaseId?: string | null;
}

interface Invoice {
  total: number;
}

interface PhaseStub {
  id: string;
  phaseCode: string;
  name: string;
  status: string;
  sortOrder: number;
  budgetedCost?: string | null;
}

const MATERIAL_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  needed: { bg: '#FEF3C7', text: '#92400E' },
  ordered: { bg: '#DBEAFE', text: '#1E40AF' },
  shipped: { bg: '#EDE9FE', text: '#6D28D9' },
  received: { bg: '#D1FAE5', text: '#065F46' },
  installed: { bg: '#A7F3D0', text: '#047857' },
};

const PHASE_STATUS_COLORS: Record<string, { dot: string; badge: string; text: string }> = {
  not_started: { dot: '#9CA3AF', badge: '#F3F4F6', text: '#374151' },
  in_progress:  { dot: '#3B82F6', badge: '#DBEAFE', text: '#1E40AF' },
  complete:     { dot: '#10B981', badge: '#D1FAE5', text: '#065F46' },
  invoiced:     { dot: '#8B5CF6', badge: '#EDE9FE', text: '#6D28D9' },
};

const PHASE_STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress:  'In Progress',
  complete:     'Complete',
  invoiced:     'Invoiced',
};

export interface MaterialsSectionProps {
  colors: ThemeColors;
  styles: any;
  materials: JobMaterial[];
  isLoadingMaterials: boolean;
  invoice: Invoice | null;
  setEditingMaterial: (m: JobMaterial | null) => void;
  setMaterialForm: (f: { name: string; quantity: string; unitCost: string; unitPrice: string; markupPercent: string; supplier: string; description: string; phaseId: string }) => void;
  setShowAddMaterialModal: (value: boolean) => void;
  handleMaterialStatusChange: (material: JobMaterial) => void;
  handleDeleteMaterial: (material: JobMaterial) => void;
  /** When provided, materials are grouped under phase headers */
  phases?: PhaseStub[];
  /** Pre-filled phaseId when opening the Add form */
  activePhaseId?: string;
}

export function MaterialsSection(props: MaterialsSectionProps) {
  const {
    colors,
    styles,
    materials,
    isLoadingMaterials,
    invoice,
    setEditingMaterial,
    setMaterialForm,
    setShowAddMaterialModal,
    handleMaterialStatusChange,
    handleDeleteMaterial,
    phases,
    activePhaseId,
  } = props;

  const totalCost = materials.reduce((s, m) => s + (Number(m.totalCost) || 0), 0);
  const totalSellPrice = materials.reduce((s, m) => {
    const up = Number(m.unitPrice || 0);
    return s + (up > 0 ? up * Number(m.quantity || 1) : 0);
  }, 0);
  const hasPricing = totalSellPrice > 0;
  const overallMargin = hasPricing && totalSellPrice > 0 ? ((totalSellPrice - totalCost) / totalSellPrice) * 100 : 0;

  const openAddForm = (prefillPhaseId?: string) => {
    setEditingMaterial(null);
    setMaterialForm({
      name: '',
      quantity: '1',
      unitCost: '',
      unitPrice: '',
      markupPercent: '',
      supplier: '',
      description: '',
      phaseId: prefillPhaseId ?? activePhaseId ?? '',
    });
    setShowAddMaterialModal(true);
  };

  const openEditForm = (material: JobMaterial) => {
    setEditingMaterial(material);
    setMaterialForm({
      name: material.name,
      quantity: String(material.quantity),
      unitCost: String(material.unitCost),
      unitPrice: material.unitPrice ? String(material.unitPrice) : '',
      markupPercent: material.markupPercent ? String(material.markupPercent) : '',
      supplier: material.supplier || '',
      description: material.description || '',
      phaseId: material.phaseId || '',
    });
    setShowAddMaterialModal(true);
  };

  const renderMaterialRow = (material: JobMaterial) => {
    const matStatus = material.status || 'needed';
    const statusColor = MATERIAL_STATUS_COLORS[matStatus] || MATERIAL_STATUS_COLORS.needed;
    return (
      <View key={material.id} style={[styles.card, { paddingVertical: spacing.sm, flexDirection: 'column' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={{ ...typography.body, color: colors.foreground, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                {material.name}
              </Text>
              <Text style={{ ...typography.body, color: Number(material.unitCost || 0) > 0 ? colors.foreground : colors.mutedForeground, fontWeight: '600', marginLeft: spacing.sm }}>
                {Number(material.unitCost || 0) > 0 ? `$${Number(material.totalCost || 0).toFixed(2)}` : 'Add cost'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4, flexWrap: 'wrap' }}>
              <TouchableOpacity
                onPress={() => handleMaterialStatusChange(material)}
                activeOpacity={0.7}
                style={{
                  backgroundColor: statusColor.bg,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radius.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor.text, textTransform: 'capitalize' }}>
                  {matStatus}
                </Text>
                <Feather name="chevron-down" size={10} color={statusColor.text} />
              </TouchableOpacity>
              <Text style={{ ...typography.caption, color: colors.mutedForeground }}>
                Qty: {material.quantity} {Number(material.unitCost || 0) > 0 ? `× $${Number(material.unitCost || 0).toFixed(2)}` : ''}
              </Text>
              {material.unitPrice && Number(material.unitPrice) > 0 && (
                <Text style={{ ...typography.caption, color: colors.primary, fontWeight: '600' }}>
                  Sell: ${(Number(material.unitPrice) * Number(material.quantity || 1)).toFixed(2)}
                </Text>
              )}
              {material.unitPrice && Number(material.unitPrice) > 0 && Number(material.unitCost) > 0 && (
                <Text style={{ ...typography.caption, fontWeight: '600', color: Number(material.unitPrice) > Number(material.unitCost) ? colors.success : colors.destructive }}>
                  {(((Number(material.unitPrice) - Number(material.unitCost)) / Number(material.unitPrice)) * 100).toFixed(0)}% margin
                </Text>
              )}
              {(!material.unitPrice || Number(material.unitPrice) === 0) && material.markupPercent && Number(material.markupPercent) > 0 && (
                <Text style={{ ...typography.caption, color: colors.mutedForeground }}>
                  +{Number(material.markupPercent).toFixed(0)}% markup
                </Text>
              )}
              {material.supplier && (
                <Text style={{ ...typography.caption, color: colors.mutedForeground }}>
                  · {material.supplier}
                </Text>
              )}
            </View>
            {material.description && (
              <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 2 }} numberOfLines={2}>
                {material.description}
              </Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.xs, marginLeft: spacing.sm }}>
            <TouchableOpacity
              onPress={() => openEditForm(material)}
              style={{ padding: spacing.xs }}
              activeOpacity={0.7}
            >
              <Feather name="edit-2" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteMaterial(material)}
              style={{ padding: spacing.xs }}
              activeOpacity={0.7}
            >
              <Feather name="trash-2" size={16} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const addButton = (prefillPhaseId?: string) => (
    <TouchableOpacity
      onPress={() => openAddForm(prefillPhaseId)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: `${colors.primary}12`,
        borderWidth: 1,
        borderColor: `${colors.primary}25`,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
      }}
      activeOpacity={0.7}
    >
      <Feather name="plus" size={14} color={colors.primary} />
      <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 13 }}>Add</Text>
    </TouchableOpacity>
  );

  // ── Phase-grouped view (projects) ─────────────────────────────────────
  if (phases && phases.length > 0) {
    const sortedPhases = [...phases].sort((a, b) => a.sortOrder - b.sortOrder);

    const byPhase = new Map<string | null, JobMaterial[]>();
    byPhase.set(null, []);
    for (const ph of sortedPhases) byPhase.set(ph.id, []);
    for (const m of materials) {
      const key = m.phaseId ?? null;
      if (!byPhase.has(key)) byPhase.set(null, []);
      (byPhase.get(byPhase.has(key) ? key : null)!).push(m);
    }

    const unassigned = byPhase.get(null) ?? [];

    // Only show a phase card if it has materials OR is the active/in-progress phase.
    // This avoids rendering a screen full of empty chips when nothing has been added yet.
    const activePh = sortedPhases.find(p => p.id === activePhaseId)
      ?? sortedPhases.find(p => p.status === 'in_progress')
      ?? sortedPhases.find(p => p.status === 'not_started');
    const phasesToShow = sortedPhases.filter(ph => {
      const hasMaterials = (byPhase.get(ph.id) ?? []).length > 0;
      return hasMaterials || ph.id === activePh?.id;
    });

    return (
      <>
        {/* Section header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, paddingHorizontal: spacing.md }}>
          <View>
            <Text style={styles.tabSectionTitle}>MATERIALS</Text>
            {materials.length > 0 && (
              <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 2 }}>
                {materials.length} item{materials.length !== 1 ? 's' : ''} · Total ${totalCost.toFixed(2)}
              </Text>
            )}
          </View>
          {addButton(activePhaseId)}
        </View>

        {isLoadingMaterials ? (
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            {phasesToShow.map(phase => {
              const phaseMaterials = byPhase.get(phase.id) ?? [];
              const phaseCost = phaseMaterials.reduce((s, m) => s + (Number(m.totalCost) || 0), 0);
              const sc = PHASE_STATUS_COLORS[phase.status] ?? PHASE_STATUS_COLORS.not_started;
              const label = PHASE_STATUS_LABELS[phase.status] ?? phase.status;

              return (
                <View key={phase.id} style={{
                  backgroundColor: colors.card,
                  borderRadius: radius.xl,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  marginBottom: spacing.md,
                  overflow: 'hidden',
                  ...shadows.sm,
                }}>
                  {/* Phase header row */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm + 2,
                    backgroundColor: `${sc.dot}10`,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sc.dot }} />
                    <Text style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: colors.foreground, flex: 1 }} numberOfLines={1}>
                      {phase.phaseCode ? `${phase.phaseCode} · ` : ''}{phase.name}
                    </Text>
                    {phaseCost > 0 && (
                      <Text style={{ fontSize: 12, fontWeight: fontWeights.semibold, color: colors.mutedForeground }}>
                        ${phaseCost.toFixed(2)}
                      </Text>
                    )}
                    <View style={{ backgroundColor: sc.badge, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                      <Text style={{ fontSize: 10, fontWeight: fontWeights.semibold, color: sc.text }}>{label}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => openAddForm(phase.id)}
                      activeOpacity={0.7}
                      style={{ padding: 4 }}
                    >
                      <Feather name="plus" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  </View>

                  {/* Materials for this phase — only shown when there are items */}
                  {phaseMaterials.length > 0 && (
                    <View style={{ padding: spacing.sm }}>
                      {phaseMaterials.map(renderMaterialRow)}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Unassigned */}
            {unassigned.length > 0 && (
              <View style={{
                backgroundColor: colors.card,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                marginBottom: spacing.md,
                overflow: 'hidden',
                ...shadows.sm,
              }}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm + 2,
                  backgroundColor: colors.muted,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border }} />
                  <Text style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: colors.mutedForeground, flex: 1 }}>
                    Unassigned
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: fontWeights.semibold, color: colors.mutedForeground }}>
                    ${unassigned.reduce((s, m) => s + (Number(m.totalCost) || 0), 0).toFixed(2)}
                  </Text>
                </View>
                <View style={{ padding: spacing.sm }}>
                  {unassigned.map(renderMaterialRow)}
                </View>
              </View>
            )}

            {/* Empty state when no materials at all */}
            {materials.length === 0 && (
              <View style={{
                backgroundColor: colors.card,
                borderRadius: radius.xl,
                padding: spacing.xl,
                marginBottom: spacing.xl,
                flexDirection: 'column',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.cardBorder,
                ...shadows.sm,
              }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${colors.primary}10`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
                  <Feather name="package" size={28} color={colors.mutedForeground} />
                </View>
                <Text style={{ ...typography.body, color: colors.mutedForeground, textAlign: 'center' }}>
                  No materials added yet
                </Text>
                <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.md }}>
                  Tap the phase + button or Add above to track materials
                </Text>
              </View>
            )}
          </>
        )}
      </>
    );
  }

  // ── Flat view (service calls / no phases) ──────────────────────────────
  return (
    <>
      {/* Materials Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, paddingHorizontal: spacing.md }}>
        <View>
          <Text style={styles.tabSectionTitle}>JOB MATERIALS</Text>
          {materials.length > 0 && (() => {
            const headerHasCost = materials.some(m => Number(m.unitCost || 0) > 0);
            return (
              <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: 2 }}>
                {materials.length} item{materials.length !== 1 ? 's' : ''} · Cost {headerHasCost ? `$${totalCost.toFixed(2)}` : 'Not set'}{hasPricing ? ` · Sell $${totalSellPrice.toFixed(2)}` : ''}
              </Text>
            );
          })()}
        </View>
        {addButton()}
      </View>

      {isLoadingMaterials ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : materials.length === 0 ? (
        <View style={{
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          padding: spacing.xl,
          marginBottom: spacing.xl,
          flexDirection: 'column',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.cardBorder,
          ...shadows.sm,
        }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${colors.primary}10`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
            <Feather name="package" size={28} color={colors.mutedForeground} />
          </View>
          <Text style={{ ...typography.body, color: colors.mutedForeground, textAlign: 'center' }}>
            No materials added yet
          </Text>
          <Text style={{ ...typography.caption, color: colors.mutedForeground, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.md }}>
            Track parts, materials and supplies used on this job
          </Text>
        </View>
      ) : (
        <>
          {materials.map(renderMaterialRow)}

          {/* Cost vs Price Summary */}
          {(() => {
            const hasCostData = materials.some(m => Number(m.unitCost || 0) > 0);
            return (
              <View style={{
                backgroundColor: `${colors.primary}08`,
                borderRadius: radius.xl,
                padding: spacing.xl,
                marginBottom: spacing.xl,
                flexDirection: 'column',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.cardBorder,
                ...shadows.sm,
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.caption, color: colors.mutedForeground }}>COST</Text>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: hasCostData ? colors.foreground : colors.mutedForeground, marginTop: 2 }}>
                      {hasCostData ? `$${totalCost.toFixed(2)}` : 'Not set'}
                    </Text>
                  </View>
                  {hasPricing && (
                    <View style={{ flex: 1, alignItems: 'center' }}>
                      <Text style={{ ...typography.caption, color: colors.mutedForeground }}>SELL PRICE</Text>
                      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.primary, marginTop: 2 }}>
                        ${totalSellPrice.toFixed(2)}
                      </Text>
                    </View>
                  )}
                  {hasPricing && hasCostData && (
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ ...typography.caption, color: colors.mutedForeground }}>MARGIN</Text>
                      <Text style={{ fontSize: 20, fontWeight: '700', color: overallMargin >= 0 ? colors.success : colors.destructive, marginTop: 2 }}>
                        {overallMargin.toFixed(1)}%
                      </Text>
                    </View>
                  )}
                </View>
                {hasPricing && hasCostData && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: `${colors.border}80` }}>
                    <Text style={{ ...typography.caption, color: colors.mutedForeground }}>Profit</Text>
                    <Text style={{ ...typography.body, fontWeight: '600', color: (totalSellPrice - totalCost) >= 0 ? colors.success : colors.destructive }}>
                      ${(totalSellPrice - totalCost).toFixed(2)}
                    </Text>
                  </View>
                )}
                {invoice && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: `${colors.border}80` }}>
                    <Text style={{ ...typography.caption, color: colors.mutedForeground }}>Invoice Total</Text>
                    <Text style={{ ...typography.body, color: colors.success, fontWeight: '600' }}>
                      ${Number(invoice.total).toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })()}
        </>
      )}
    </>
  );
}
