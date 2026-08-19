/**
 * PhasesSection - add/edit/remove/reorder project phases
 */
import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Alert } from '@/lib/alert';
import { useTheme, ThemeColors } from '../../lib/theme';
import { spacing, typography, fontWeights } from '../../lib/design-tokens';
import type { ProjectPhase } from './types';
import { sharedStyles } from './sharedStyles';

let _idCounter = 0;
function genId() {
  return `phase_${Date.now()}_${++_idCounter}`;
}

interface PhaseFormState {
  clientId: string;
  phaseCode: string;
  name: string;
  description: string;
  scheduledStart: string;
  scheduledEnd: string;
  budgetedCost: string;
  assignedUserId: string | null;
  sortOrder: number;
}

const EMPTY_PHASE: Omit<PhaseFormState, 'clientId' | 'sortOrder'> = {
  phaseCode: '',
  name: '',
  description: '',
  scheduledStart: '',
  scheduledEnd: '',
  budgetedCost: '',
  assignedUserId: null,
};

interface PhasesProps {
  phases: ProjectPhase[];
  teamMembers: any[];
  onChange: (phases: ProjectPhase[]) => void;
}

function getTeamName(member: any) {
  if (member.name?.trim()) return member.name;
  const n = [member.firstName, member.lastName].filter(Boolean).join(' ');
  if (n.trim()) return n;
  return member.email || 'Team Member';
}

function validatePhaseForm(form: PhaseFormState): string | null {
  if (!form.name.trim()) return 'Phase name is required';
  if (form.scheduledStart && !/^\d{4}-\d{2}-\d{2}$/.test(form.scheduledStart)) return 'Start date must be YYYY-MM-DD';
  if (form.scheduledEnd && !/^\d{4}-\d{2}-\d{2}$/.test(form.scheduledEnd)) return 'End date must be YYYY-MM-DD';
  if (form.scheduledStart && form.scheduledEnd && form.scheduledEnd < form.scheduledStart) {
    return 'End date must be on or after start date';
  }
  if (form.budgetedCost && isNaN(parseFloat(form.budgetedCost))) return 'Budget must be a valid number';
  return null;
}

export function PhasesSection({ phases, teamMembers, onChange }: PhasesProps) {
  const { colors } = useTheme();
  const s = useMemo(() => sharedStyles(colors), [colors]);

  const [showModal, setShowModal] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [form, setForm] = useState<PhaseFormState>({
    clientId: '',
    sortOrder: 0,
    ...EMPTY_PHASE,
  });
  const [showTeamPicker, setShowTeamPicker] = useState(false);

  const openAdd = useCallback(() => {
    setEditingIdx(null);
    setForm({
      clientId: genId(),
      sortOrder: phases.length,
      ...EMPTY_PHASE,
    });
    setShowModal(true);
  }, [phases.length]);

  const openEdit = useCallback((idx: number) => {
    const ph = phases[idx];
    setEditingIdx(idx);
    setForm({ ...ph });
    setShowModal(true);
  }, [phases]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setShowTeamPicker(false);
  }, []);

  const savePhase = useCallback(() => {
    const err = validatePhaseForm(form);
    if (err) { Alert.alert('Validation', err); return; }
    if (editingIdx !== null) {
      const updated = [...phases];
      updated[editingIdx] = { ...form };
      onChange(updated);
    } else {
      onChange([...phases, { ...form }]);
    }
    setShowModal(false);
  }, [form, editingIdx, phases, onChange]);

  const removePhase = useCallback((idx: number) => {
    Alert.alert('Remove Phase', 'Remove this phase?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        const updated = phases.filter((_, i) => i !== idx);
        onChange(updated.map((p, i) => ({ ...p, sortOrder: i })));
      }},
    ]);
  }, [phases, onChange]);

  const moveUp = useCallback((idx: number) => {
    if (idx === 0) return;
    const updated = [...phases];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    onChange(updated.map((p, i) => ({ ...p, sortOrder: i })));
  }, [phases, onChange]);

  const moveDown = useCallback((idx: number) => {
    if (idx === phases.length - 1) return;
    const updated = [...phases];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    onChange(updated.map((p, i) => ({ ...p, sortOrder: i })));
  }, [phases, onChange]);

  const selectedMember = teamMembers.find((m) => String(m.userId || m.memberId || m.id) === form.assignedUserId);

  return (
    <View>
      {phases.length === 0 ? (
        <Text style={[s.empty]}>No phases yet. Add phases to break the project into stages.</Text>
      ) : (
        <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
          {phases.map((ph, idx) => (
            <View key={ph.clientId} style={s.itemCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                <View style={s.itemBullet}>
                  <Text style={s.itemBulletText}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTitle} numberOfLines={1}>{ph.name || 'Unnamed phase'}</Text>
                  {(ph.scheduledStart || ph.budgetedCost) && (
                    <Text style={s.itemMeta} numberOfLines={1}>
                      {[ph.scheduledStart, ph.scheduledEnd].filter(Boolean).join(' to ')}
                      {ph.budgetedCost ? `  $${ph.budgetedCost}` : ''}
                    </Text>
                  )}
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <TouchableOpacity onPress={() => moveUp(idx)} testID={`phase-move-up-${idx}`}>
                  <Feather name="chevron-up" size={18} color={idx === 0 ? colors.muted : colors.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => moveDown(idx)} testID={`phase-move-down-${idx}`}>
                  <Feather name="chevron-down" size={18} color={idx === phases.length - 1 ? colors.muted : colors.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openEdit(idx)} testID={`phase-edit-${idx}`}>
                  <Feather name="edit-2" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removePhase(idx)} testID={`phase-remove-${idx}`}>
                  <Feather name="trash-2" size={18} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={s.addButton} onPress={openAdd} testID="phase-add-button">
        <Feather name="plus" size={16} color={colors.primary} />
        <Text style={s.addButtonText}>Add Phase</Text>
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={[s.modalContainer, { backgroundColor: colors.background }]}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={closeModal} testID="phase-modal-cancel">
                <Text style={s.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>{editingIdx !== null ? 'Edit Phase' : 'Add Phase'}</Text>
              <TouchableOpacity onPress={savePhase} testID="phase-modal-save">
                <Text style={s.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={s.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={s.field}>
                <Text style={s.label}>Phase Name *</Text>
                <TextInput
                  style={s.input}
                  value={form.name}
                  onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                  placeholder="e.g. Foundations"
                  placeholderTextColor={colors.mutedForeground}
                  testID="phase-input-name"
                />
              </View>

              <View style={s.field}>
                <Text style={s.label}>Phase Code</Text>
                <TextInput
                  style={s.input}
                  value={form.phaseCode}
                  onChangeText={(v) => setForm((f) => ({ ...f, phaseCode: v }))}
                  placeholder="e.g. PH-01"
                  placeholderTextColor={colors.mutedForeground}
                  testID="phase-input-code"
                />
              </View>

              <View style={s.field}>
                <Text style={s.label}>Description</Text>
                <TextInput
                  style={[s.input, s.textArea]}
                  value={form.description}
                  onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                  placeholder="Details about this phase..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={3}
                  testID="phase-input-description"
                />
              </View>

              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Start Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={s.input}
                    value={form.scheduledStart}
                    onChangeText={(v) => setForm((f) => ({ ...f, scheduledStart: v }))}
                    placeholder="2024-07-01"
                    placeholderTextColor={colors.mutedForeground}
                    testID="phase-input-start"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>End Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={s.input}
                    value={form.scheduledEnd}
                    onChangeText={(v) => setForm((f) => ({ ...f, scheduledEnd: v }))}
                    placeholder="2024-09-30"
                    placeholderTextColor={colors.mutedForeground}
                    testID="phase-input-end"
                  />
                </View>
              </View>

              <View style={s.field}>
                <Text style={s.label}>Budget ($)</Text>
                <TextInput
                  style={s.input}
                  value={form.budgetedCost}
                  onChangeText={(v) => setForm((f) => ({ ...f, budgetedCost: v }))}
                  placeholder="e.g. 15000"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  testID="phase-input-budget"
                />
              </View>

              <View style={s.field}>
                <Text style={s.label}>Assigned Team Member</Text>
                <TouchableOpacity
                  style={s.selector}
                  onPress={() => setShowTeamPicker(true)}
                  testID="phase-team-picker"
                >
                  <Text style={selectedMember ? s.selectorValue : s.selectorPlaceholder}>
                    {selectedMember ? getTeamName(selectedMember) : 'Select team member (optional)'}
                  </Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        {/* Team picker nested modal */}
        <Modal visible={showTeamPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowTeamPicker(false)}>
          <View style={[s.modalContainer, { backgroundColor: colors.background }]}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setShowTeamPicker(false)}>
                <Text style={s.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>Assign Team Member</Text>
              <View style={{ width: 60 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
              <TouchableOpacity
                style={[s.itemCard, !form.assignedUserId && { borderColor: colors.primary }]}
                onPress={() => { setForm((f) => ({ ...f, assignedUserId: null })); setShowTeamPicker(false); }}
                testID="phase-team-none"
              >
                <Text style={s.itemTitle}>None</Text>
                {!form.assignedUserId && <Feather name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
              {teamMembers.map((m) => {
                const mid = String(m.userId || m.memberId || m.id);
                const isSelected = form.assignedUserId === mid;
                return (
                  <TouchableOpacity
                    key={mid}
                    style={[s.itemCard, isSelected && { borderColor: colors.primary }]}
                    onPress={() => { setForm((f) => ({ ...f, assignedUserId: mid })); setShowTeamPicker(false); }}
                  >
                    <Text style={s.itemTitle}>{getTeamName(m)}</Text>
                    {isSelected && <Feather name="check" size={16} color={colors.primary} />}
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
