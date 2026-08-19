import { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert } from '@/lib/alert';
import { useTheme } from '../../lib/theme';
import { spacing, radius, typography, fontWeights } from '../../lib/design-tokens';
import { AppBottomSheet } from '../ui/AppBottomSheet';
import { PhaseTeamPicker, getTeamMemberName } from '../PhaseTeamPicker';
import type { ProjectPhase } from './types';

let counter = 0;
const newId = () => `phase_${Date.now()}_${++counter}`;

type PhaseForm = Omit<ProjectPhase, 'assignedUserIds'> & { assignedUserIds: string[] };
const emptyForm = (sortOrder: number): PhaseForm => ({
  clientId: newId(), phaseCode: '', name: '', description: '', scheduledStart: '',
  scheduledEnd: '', budgetedCost: '', assignedUserId: null, assignedUserIds: [], sortOrder,
});

function validate(form: PhaseForm) {
  if (!form.name.trim()) return 'Phase name is required';
  if (form.scheduledStart && !/^\d{4}-\d{2}-\d{2}$/.test(form.scheduledStart)) return 'Start date must be YYYY-MM-DD';
  if (form.scheduledEnd && !/^\d{4}-\d{2}-\d{2}$/.test(form.scheduledEnd)) return 'End date must be YYYY-MM-DD';
  if (form.scheduledStart && form.scheduledEnd && form.scheduledEnd < form.scheduledStart) return 'End date must be on or after start date';
  if (form.budgetedCost && (!Number.isFinite(Number(form.budgetedCost)) || Number(form.budgetedCost) < 0)) return 'Budget must be a non-negative number';
  return null;
}

export function PhasesSection({ phases, teamMembers, onChange }: { phases: ProjectPhase[]; teamMembers: any[]; onChange: (phases: ProjectPhase[]) => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<PhaseForm>(emptyForm(0));
  const inputStyle = {
    minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    color: colors.foreground, backgroundColor: colors.card, paddingHorizontal: spacing.md,
    fontSize: typography.sizes.sm,
  };
  const labelStyle = { color: colors.mutedForeground, fontSize: typography.sizes.xs, fontWeight: fontWeights.medium, marginBottom: spacing.xs };

  const openAdd = () => { setEditingIndex(null); setForm(emptyForm(phases.length)); setVisible(true); };
  const openEdit = (index: number) => {
    const phase = phases[index];
    const ids = phase.assignedUserIds?.length ? phase.assignedUserIds : phase.assignedUserId ? [phase.assignedUserId] : [];
    setEditingIndex(index);
    setForm({ ...phase, assignedUserId: ids[0] || null, assignedUserIds: ids });
    setVisible(true);
  };
  const dismiss = () => setVisible(false);
  const save = useCallback(() => {
    const error = validate(form);
    if (error) return Alert.alert('Check phase', error);
    const selectedIds = [...new Set(form.assignedUserIds)];
    const phase: ProjectPhase = { ...form, name: form.name.trim(), phaseCode: form.phaseCode.trim(), assignedUserId: selectedIds[0] || null, assignedUserIds: selectedIds };
    onChange(editingIndex === null ? [...phases, phase] : phases.map((item, index) => index === editingIndex ? phase : item));
    setVisible(false);
  }, [editingIndex, form, onChange, phases]);
  const remove = (index: number) => Alert.alert('Remove phase', 'Remove this phase from the project setup?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => onChange(phases.filter((_, i) => i !== index).map((phase, i) => ({ ...phase, sortOrder: i }))) },
  ]);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= phases.length) return;
    const next = [...phases];
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next.map((phase, index) => ({ ...phase, sortOrder: index })));
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View><Text style={{ color: colors.foreground, fontSize: typography.sizes.lg, fontWeight: fontWeights.semibold }}>Project phases</Text><Text style={{ color: colors.mutedForeground, fontSize: typography.sizes.sm }}>Plan the work and phase teams</Text></View>
        <TouchableOpacity testID="add-phase" onPress={openAdd} style={{ padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primary }}><Feather name="plus" size={19} color={colors.primaryForeground} /></TouchableOpacity>
      </View>
      {phases.length === 0 ? (
        <TouchableOpacity testID="phase-empty-add" onPress={openAdd} style={{ padding: spacing.lg, alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: radius.lg }}>
          <Feather name="layers" size={24} color={colors.mutedForeground} /><Text style={{ color: colors.foreground, fontWeight: fontWeights.medium }}>Add your first phase</Text><Text style={{ color: colors.mutedForeground, fontSize: typography.sizes.sm, textAlign: 'center' }}>Break the project into clear stages and assign the whole team.</Text>
        </TouchableOpacity>
      ) : phases.map((phase, index) => {
        const memberNames = (phase.assignedUserIds?.length ? phase.assignedUserIds : phase.assignedUserId ? [phase.assignedUserId] : []).map((id) => getTeamMemberName(teamMembers.find((member) => String(member.userId || member.memberId || member.id) === id))).filter(Boolean);
        return <TouchableOpacity key={phase.clientId} testID={`phase-${phase.clientId}`} onPress={() => openEdit(index)} style={{ padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.card, gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}><View style={{ flex: 1 }}><Text style={{ color: colors.foreground, fontWeight: fontWeights.semibold }}>{phase.phaseCode ? `${phase.phaseCode} · ` : ''}{phase.name}</Text>{memberNames.length > 0 && <Text style={{ color: colors.mutedForeground, fontSize: typography.sizes.xs }} numberOfLines={1}>{memberNames.join(', ')}</Text>}</View><TouchableOpacity testID={`phase-move-up-${index}`} disabled={index === 0} onPress={() => move(index, index - 1)} hitSlop={8}><Feather name="chevron-up" size={18} color={index === 0 ? colors.mutedForeground : colors.primary} /></TouchableOpacity><TouchableOpacity testID={`phase-move-down-${index}`} disabled={index === phases.length - 1} onPress={() => move(index, index + 1)} hitSlop={8}><Feather name="chevron-down" size={18} color={index === phases.length - 1 ? colors.mutedForeground : colors.primary} /></TouchableOpacity><TouchableOpacity testID={`phase-remove-${index}`} onPress={() => remove(index)} hitSlop={8}><Feather name="trash-2" size={17} color={colors.destructive} /></TouchableOpacity></View>
          {(phase.scheduledStart || phase.scheduledEnd || phase.budgetedCost) && <Text style={{ color: colors.mutedForeground, fontSize: typography.sizes.xs }}>{[phase.scheduledStart && `Starts ${phase.scheduledStart}`, phase.scheduledEnd && `Ends ${phase.scheduledEnd}`, phase.budgetedCost && `$${phase.budgetedCost}`].filter(Boolean).join(' · ')}</Text>}
        </TouchableOpacity>;
      })}

      <AppBottomSheet visible={visible} title={editingIndex === null ? 'Add Phase' : 'Edit Phase'} onDismiss={dismiss} showCloseButton snapPoints={['92%']} footer={<View style={{ flexDirection: 'row', gap: spacing.sm }}><TouchableOpacity testID="phase-sheet-cancel" onPress={dismiss} style={{ flex: 1, alignItems: 'center', padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}><Text style={{ color: colors.foreground, fontWeight: fontWeights.semibold }}>Cancel</Text></TouchableOpacity><TouchableOpacity testID="phase-sheet-save" onPress={save} style={{ flex: 1, alignItems: 'center', padding: spacing.md, backgroundColor: colors.primary, borderRadius: radius.md }}><Text style={{ color: colors.primaryForeground, fontWeight: fontWeights.semibold }}>{editingIndex === null ? 'Add phase' : 'Save changes'}</Text></TouchableOpacity></View>}>
        <View style={{ gap: spacing.md }}>
          <View><Text style={labelStyle}>Phase name *</Text><TextInput testID="phase-name" value={form.name} onChangeText={(name) => setForm((value) => ({ ...value, name }))} placeholder="e.g. Site preparation" placeholderTextColor={colors.mutedForeground} style={inputStyle} /></View>
          <View><Text style={labelStyle}>Phase code</Text><TextInput testID="phase-code" value={form.phaseCode} onChangeText={(phaseCode) => setForm((value) => ({ ...value, phaseCode }))} placeholder="e.g. P1" placeholderTextColor={colors.mutedForeground} style={inputStyle} autoCapitalize="characters" /></View>
          <View><Text style={labelStyle}>Description</Text><TextInput testID="phase-description" value={form.description} onChangeText={(description) => setForm((value) => ({ ...value, description }))} placeholder="What does this phase cover?" placeholderTextColor={colors.mutedForeground} style={[inputStyle, { minHeight: 88, paddingTop: spacing.sm }]} multiline textAlignVertical="top" /></View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}><View style={{ flex: 1 }}><Text style={labelStyle}>Start date</Text><TextInput testID="phase-start" value={form.scheduledStart} onChangeText={(scheduledStart) => setForm((value) => ({ ...value, scheduledStart }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} style={inputStyle} /></View><View style={{ flex: 1 }}><Text style={labelStyle}>End date</Text><TextInput testID="phase-end" value={form.scheduledEnd} onChangeText={(scheduledEnd) => setForm((value) => ({ ...value, scheduledEnd }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} style={inputStyle} /></View></View>
          <View><Text style={labelStyle}>Budget</Text><TextInput testID="phase-budget" value={form.budgetedCost} onChangeText={(budgetedCost) => setForm((value) => ({ ...value, budgetedCost }))} placeholder="0.00" placeholderTextColor={colors.mutedForeground} style={inputStyle} keyboardType="decimal-pad" /></View>
          <PhaseTeamPicker selectedIds={form.assignedUserIds} teamMembers={teamMembers} onChange={(assignedUserIds) => setForm((value) => ({ ...value, assignedUserIds, assignedUserId: assignedUserIds[0] || null }))} onManageTeam={() => { setVisible(false); router.push('/more/team-management'); }} />
        </View>
      </AppBottomSheet>
    </View>
  );
}