/**
 * ClaimStagesSection - add/edit/remove progress claim milestones.
 * Validates: percentage > 0, total <= 100.
 */
import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Alert } from '@/lib/alert';
import { useTheme } from '../../lib/theme';
import { spacing, typography, fontWeights } from '../../lib/design-tokens';
import type { ClaimStage, ProjectPhase } from './types';
import { sharedStyles } from './sharedStyles';

let _idCounter = 0;
function genId() { return `claim_${Date.now()}_${++_idCounter}`; }

const EMPTY_CLAIM: Omit<ClaimStage, 'clientId'> = {
  name: '',
  claimDate: '',
  percentage: '',
  retentionPercent: '',
  phaseClientId: null,
};

interface Props {
  claimStages: ClaimStage[];
  phases: ProjectPhase[];
  onChange: (stages: ClaimStage[]) => void;
}

function validateClaim(claim: ClaimStage, allClaims: ClaimStage[], editingClientId: string | null): string | null {
  if (!claim.name.trim()) return 'Claim name is required';
  const pct = parseFloat(claim.percentage);
  if (isNaN(pct) || pct <= 0) return 'Percentage must be greater than 0';
  const totalOther = allClaims
    .filter((c) => c.clientId !== (editingClientId ?? claim.clientId))
    .reduce((acc, c) => acc + (parseFloat(c.percentage) || 0), 0);
  if (totalOther + pct > 100) return `Total claim percentages cannot exceed 100% (currently ${totalOther.toFixed(1)}% used)`;
  if (!claim.claimDate) return 'Claim date is required';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(claim.claimDate)) return 'Date must be YYYY-MM-DD';
  if (claim.retentionPercent) {
    const retention = Number(claim.retentionPercent);
    if (!Number.isFinite(retention) || retention < 0 || retention > 100) return 'Retention must be between 0 and 100%';
  }
  return null;
}

export function ClaimStagesSection({ claimStages, phases, onChange }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => sharedStyles(colors), [colors]);
  const [showModal, setShowModal] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [form, setForm] = useState<ClaimStage>({ clientId: '', ...EMPTY_CLAIM });
  const [showPhasePicker, setShowPhasePicker] = useState(false);

  const totalPct = claimStages.reduce((acc, c) => acc + (parseFloat(c.percentage) || 0), 0);

  const openAdd = useCallback(() => {
    setEditingClientId(null);
    setForm({ clientId: genId(), ...EMPTY_CLAIM });
    setShowModal(true);
  }, []);

  const openEdit = useCallback((stage: ClaimStage) => {
    setEditingClientId(stage.clientId);
    setForm({ ...stage });
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setShowPhasePicker(false);
  }, []);

  const saveStage = useCallback(() => {
    const err = validateClaim(form, claimStages, editingClientId);
    if (err) { Alert.alert('Validation', err); return; }
    if (editingClientId !== null) {
      onChange(claimStages.map((c) => c.clientId === editingClientId ? { ...form } : c));
    } else {
      onChange([...claimStages, { ...form }]);
    }
    setShowModal(false);
  }, [form, editingClientId, claimStages, onChange]);

  const removeStage = useCallback((clientId: string) => {
    Alert.alert('Remove Claim Stage', 'Remove this claim stage?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onChange(claimStages.filter((c) => c.clientId !== clientId)) },
    ]);
  }, [claimStages, onChange]);

  const selectedPhase = phases.find((p) => p.clientId === form.phaseClientId);

  return (
    <View>
      {claimStages.length > 0 && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: totalPct > 100 ? colors.destructiveLight + '40' : colors.success + '15',
          borderRadius: 8,
          padding: spacing.sm,
          marginBottom: spacing.md,
        }}>
          <Feather name="percent" size={14} color={totalPct > 100 ? colors.destructive : colors.success} />
          <Text style={{ fontSize: typography.sizes.sm, color: totalPct > 100 ? colors.destructive : colors.success }}>
            {totalPct.toFixed(1)}% of 100% claimed
          </Text>
        </View>
      )}

      {claimStages.length === 0 ? (
        <Text style={s.empty}>No claim stages yet. Add milestones for progress billing.</Text>
      ) : (
        <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
          {claimStages.map((stage, idx) => (
            <View key={stage.clientId} style={s.itemCard}>
              <View style={s.itemBullet}>
                <Text style={s.itemBulletText}>{idx + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitle} numberOfLines={1}>{stage.name || 'Unnamed stage'}</Text>
                <Text style={s.itemMeta}>
                  {stage.percentage ? `${stage.percentage}%` : ''}
                  {stage.claimDate ? `  ${stage.claimDate}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => openEdit(stage)} testID={`claim-edit-${idx}`}>
                <Feather name="edit-2" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeStage(stage.clientId)} testID={`claim-remove-${idx}`}>
                <Feather name="trash-2" size={18} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[s.addButton, totalPct >= 100 && { opacity: 0.5 }]}
        onPress={openAdd}
        disabled={totalPct >= 100}
        testID="claim-add-button"
      >
        <Feather name="plus" size={16} color={colors.primary} />
        <Text style={s.addButtonText}>Add Claim Stage</Text>
      </TouchableOpacity>
      {totalPct >= 100 && (
        <Text style={{ fontSize: typography.captionSmall.fontSize, color: colors.mutedForeground, marginTop: spacing.xs, textAlign: 'center' }}>
          Total is already 100%. Edit existing stages to adjust.
        </Text>
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={[s.modalContainer, { backgroundColor: colors.background }]}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={closeModal} testID="claim-modal-cancel">
                <Text style={s.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>{editingClientId ? 'Edit Claim Stage' : 'Add Claim Stage'}</Text>
              <TouchableOpacity onPress={saveStage} testID="claim-modal-save">
                <Text style={s.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              <View style={s.field}>
                <Text style={s.label}>Stage Name *</Text>
                <TextInput
                  style={s.input}
                  value={form.name}
                  onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                  placeholder="e.g. Foundation Complete"
                  placeholderTextColor={colors.mutedForeground}
                  testID="claim-input-name"
                />
              </View>

              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Percentage % *</Text>
                  <TextInput
                    style={s.input}
                    value={form.percentage}
                    onChangeText={(v) => setForm((f) => ({ ...f, percentage: v }))}
                    placeholder="e.g. 25"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                    testID="claim-input-percentage"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Retention %</Text>
                  <TextInput
                    style={s.input}
                    value={form.retentionPercent}
                    onChangeText={(v) => setForm((f) => ({ ...f, retentionPercent: v }))}
                    placeholder="5"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                    testID="claim-input-retention"
                  />
                </View>
              </View>

              <View style={s.field}>
                <Text style={s.label}>Claim Date (YYYY-MM-DD) *</Text>
                <TextInput
                  style={s.input}
                  value={form.claimDate}
                  onChangeText={(v) => setForm((f) => ({ ...f, claimDate: v }))}
                  placeholder="2024-09-30"
                  placeholderTextColor={colors.mutedForeground}
                  testID="claim-input-date"
                />
              </View>

              <View style={s.field}>
                <Text style={s.label}>Phase (optional)</Text>
                <TouchableOpacity style={s.selector} onPress={() => setShowPhasePicker(true)} testID="claim-phase-picker">
                  <Text style={selectedPhase ? s.selectorValue : s.selectorPlaceholder}>
                    {selectedPhase ? selectedPhase.name : 'Link to a phase (optional)'}
                  </Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        <Modal visible={showPhasePicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPhasePicker(false)}>
          <View style={[s.modalContainer, { backgroundColor: colors.background }]}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setShowPhasePicker(false)}><Text style={s.modalCancel}>Cancel</Text></TouchableOpacity>
              <Text style={s.modalTitle}>Link to Phase</Text>
              <View style={{ width: 60 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
              <TouchableOpacity
                style={[s.itemCard, !form.phaseClientId && { borderColor: colors.primary }]}
                onPress={() => { setForm((f) => ({ ...f, phaseClientId: null })); setShowPhasePicker(false); }}
              >
                <Text style={s.itemTitle}>No phase</Text>
                {!form.phaseClientId && <Feather name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
              {phases.map((ph) => {
                const isSel = form.phaseClientId === ph.clientId;
                return (
                  <TouchableOpacity
                    key={ph.clientId}
                    style={[s.itemCard, isSel && { borderColor: colors.primary }]}
                    onPress={() => { setForm((f) => ({ ...f, phaseClientId: ph.clientId })); setShowPhasePicker(false); }}
                  >
                    <Text style={s.itemTitle}>{ph.name}</Text>
                    {isSel && <Feather name="check" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Modal>
      </Modal>
    </View>
  );
}
