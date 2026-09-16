/**
 * PhaseFormSheet — shared bottom sheet for adding and editing a project phase.
 *
 * Add mode:  code, name, description, dates, team, quick templates, starter
 *            tasks (created by the parent after the phase is saved).
 * Edit mode: code, name, dates, booked hours, status, description, team.
 *
 * The sheet owns all form state; the parent only supplies the phase being
 * edited (edit mode) and receives the completed form via onSubmit.
 */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppBottomSheet } from '../ui/AppBottomSheet';
import { SheetButton } from '../ui/SheetButton';
import { PhaseTeamPicker } from '../PhaseTeamPicker';
import { spacing, radius, typography, fontWeights } from '../../lib/design-tokens';
import type { JobPhase, PhaseStatus } from './PhasesSection';

export interface PhaseFormValues {
  phaseCode: string;
  name: string;
  description: string;
  scheduledStart: string;
  scheduledEnd: string;
  bookedHours: string;
  status: PhaseStatus;
  assignedUserId: string;
  assignedUserIds: string[];
}

const EMPTY_FORM: PhaseFormValues = {
  phaseCode: '',
  name: '',
  description: '',
  scheduledStart: '',
  scheduledEnd: '',
  bookedHours: '',
  status: 'not_started',
  assignedUserId: '',
  assignedUserIds: [],
};

/** Quick templates — fills Name, Description, and Starter Tasks with one tap. */
const PHASE_TEMPLATES: Array<{ name: string; description: string; tasks: string[] }> = [
  { name: 'Waterproofing', description: 'Waterproofing and membrane installation', tasks: ['Prepare substrate', 'Apply primer coat', 'Install membrane', 'Test for leaks', 'Final inspection'] },
  { name: 'Fit-Out', description: 'Interior fit-out and finishing', tasks: ['Frame walls', 'Run electrical & plumbing', 'Insulation', 'Line and set', 'Paint and finish'] },
  { name: 'Framing', description: 'Structural wall framing', tasks: ['Set out layout', 'Install bottom plate', 'Erect wall frames', 'Install top plate', 'Bracing and check'] },
  { name: 'Electrical', description: 'Electrical rough-in and fit-off', tasks: ['Cable runs', 'Install switchboard', 'Rough-in outlets', 'Inspection', 'Fit-off fittings'] },
  { name: 'Plumbing', description: 'Plumbing rough-in and fixtures', tasks: ['Rough-in pipes', 'Pressure test', 'Install fixtures', 'Connect hot water', 'Final inspection'] },
  { name: 'Demolition', description: 'Site demolition and clearing', tasks: ['Safety check', 'Remove fixtures', 'Strip walls', 'Clear debris', 'Make safe'] },
];

const STATUS_LABELS: Record<PhaseStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  complete: 'Complete',
  invoiced: 'Invoiced',
};

interface PhaseFormSheetProps {
  visible: boolean;
  mode: 'add' | 'edit';
  colors: any;
  /** Parent screen styles — needs cardLabel and singleLineInput. */
  styles: any;
  isDark: boolean;
  teamMembers: any[];
  /** Existing phase count, used for the auto phase-code placeholder (add mode). */
  phaseCount: number;
  /** Phase being edited — supplies initial values in edit mode. */
  phase?: JobPhase | null;
  isSaving: boolean;
  onSubmit: (form: PhaseFormValues, starterTasks: string[]) => void;
  onDismiss: () => void;
  onManageTeam: () => void;
}

function formFromPhase(phase: JobPhase): PhaseFormValues {
  return {
    phaseCode: phase.phaseCode,
    name: phase.name,
    description: phase.description ?? '',
    scheduledStart: phase.scheduledStart ?? '',
    scheduledEnd: phase.scheduledEnd ?? '',
    bookedHours: phase.bookedHours ?? '',
    status: phase.status,
    assignedUserId: phase.assignedUserId ?? '',
    assignedUserIds: phase.assignedUserIds?.length
      ? phase.assignedUserIds
      : phase.assignedUserId
        ? [phase.assignedUserId]
        : [],
  };
}

export function PhaseFormSheet({
  visible,
  mode,
  colors,
  styles,
  isDark,
  teamMembers,
  phaseCount,
  phase,
  isSaving,
  onSubmit,
  onDismiss,
  onManageTeam,
}: PhaseFormSheetProps) {
  const [form, setForm] = useState<PhaseFormValues>(EMPTY_FORM);
  const [dateTarget, setDateTarget] = useState<'start' | 'end' | null>(null);
  const [starterTasks, setStarterTasks] = useState<string[]>([]);
  const [starterTaskInput, setStarterTaskInput] = useState('');

  // Reset the form each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setForm(mode === 'edit' && phase ? formFromPhase(phase) : EMPTY_FORM);
      setDateTarget(null);
      setStarterTasks([]);
      setStarterTaskInput('');
    }
  }, [visible, mode, phase]);

  const addStarterTask = () => {
    const t = starterTaskInput.trim();
    if (t) {
      setStarterTasks(prev => [...prev, t]);
      setStarterTaskInput('');
    }
  };

  const dateRow = (
    <View style={{ marginBottom: spacing.lg }}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {(['start', 'end'] as const).map((field) => {
          const iso = field === 'start' ? form.scheduledStart : form.scheduledEnd;
          const isActive = dateTarget === field;
          return (
            <View key={field} style={{ flex: 1 }}>
              <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>{field === 'start' ? 'Start Date' : 'End Date'}</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setDateTarget(isActive ? null : field)}
                style={[styles.singleLineInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48, borderColor: isActive ? colors.primary : colors.cardBorder }]}
              >
                <Text style={{ fontSize: 14, color: iso ? colors.foreground : colors.mutedForeground }} numberOfLines={1}>
                  {iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Set date'}
                </Text>
                <Feather name="calendar" size={14} color={isActive ? colors.primary : colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
      {/* Picker renders full-width BELOW the row so the iOS spinner never
          overflows the half-width End Date column. */}
      {dateTarget && (() => {
        const field = dateTarget;
        const iso = field === 'start' ? form.scheduledStart : form.scheduledEnd;
        return (
          <View style={{ marginTop: spacing.sm }}>
            <DateTimePicker
              value={iso ? new Date(iso) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                if (Platform.OS !== 'ios') setDateTarget(null);
                if (event.type !== 'dismissed' && date) {
                  setForm(f => ({ ...f, [field === 'start' ? 'scheduledStart' : 'scheduledEnd']: date.toISOString() }));
                }
              }}
              style={Platform.OS === 'ios' ? { alignSelf: 'center' } : undefined}
              themeVariant={isDark ? 'dark' : 'light'}
            />
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={{ backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.sm, marginTop: 4, alignItems: 'center' }}
                onPress={() => setDateTarget(null)}
              >
                <Text style={{ color: colors.primaryForeground, fontWeight: fontWeights.semibold, fontSize: 14 }}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })()}
    </View>
  );

  const descriptionField = (
    <>
      <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>Description</Text>
      <TextInput
        style={[styles.singleLineInput, { height: 72, textAlignVertical: 'top' as any, paddingTop: 10, marginBottom: spacing.lg }]}
        placeholder="Optional notes about this phase"
        placeholderTextColor={colors.mutedForeground}
        value={form.description}
        onChangeText={(t) => setForm(f => ({ ...f, description: t }))}
        multiline
        numberOfLines={3}
      />
    </>
  );

  const teamPicker = (
    <PhaseTeamPicker
      selectedIds={form.assignedUserIds}
      teamMembers={teamMembers}
      onChange={(assignedUserIds) => setForm(f => ({ ...f, assignedUserIds, assignedUserId: assignedUserIds[0] || '' }))}
      onManageTeam={onManageTeam}
      testID={`${mode}-phase-team`}
    />
  );

  return (
    <AppBottomSheet
      visible={visible}
      onDismiss={onDismiss}
      title={mode === 'add' ? 'Add Phase' : 'Edit Phase'}
      showCloseButton
      snapPoints={['80%']}
      footer={(
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <SheetButton variant="outline" label="Cancel" onPress={onDismiss} style={{ flex: 1 }} />
          <SheetButton
            onPress={() => onSubmit(form, starterTasks)}
            loading={isSaving}
            disabled={isSaving || !form.name.trim()}
            label={mode === 'add' ? 'Add Phase' : 'Save Changes'}
            style={{ flex: 1 }}
          />
        </View>
      )}>
      <View>
        <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>Phase Code</Text>
        <TextInput
          style={[styles.singleLineInput, { marginBottom: spacing.lg }]}
          placeholder={mode === 'add' ? `P${String(phaseCount + 1).padStart(2, '0')}` : undefined}
          placeholderTextColor={colors.mutedForeground}
          value={form.phaseCode}
          onChangeText={(t) => setForm(f => ({ ...f, phaseCode: t.toUpperCase() }))}
          maxLength={20}
          autoCapitalize="characters"
        />
        <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>Name *</Text>
        <TextInput
          style={[styles.singleLineInput, { marginBottom: spacing.lg }]}
          placeholder="e.g. Foundation, Framing, Fit-out"
          placeholderTextColor={colors.mutedForeground}
          value={form.name}
          onChangeText={(t) => setForm(f => ({ ...f, name: t }))}
        />

        {mode === 'add' && descriptionField}
        {dateRow}

        {mode === 'edit' && (
          <>
            <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>Booked Hours</Text>
            <TextInput
              style={[styles.singleLineInput, { marginBottom: spacing.lg }]}
              placeholder="e.g. 40"
              placeholderTextColor={colors.mutedForeground}
              value={form.bookedHours}
              onChangeText={(t) => setForm(f => ({ ...f, bookedHours: t }))}
              keyboardType="decimal-pad"
            />
            <Text style={[styles.cardLabel, { marginBottom: spacing.xs }]}>Status</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
              {(Object.keys(STATUS_LABELS) as PhaseStatus[]).map((s) => {
                const isSelected = form.status === s;
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setForm(f => ({ ...f, status: s }))}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: radius.pill,
                      borderWidth: 1.5,
                      borderColor: isSelected ? colors.primary : colors.cardBorder,
                      backgroundColor: isSelected ? colors.primary : colors.card,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: isSelected ? fontWeights.semibold : fontWeights.regular, color: isSelected ? colors.primaryForeground : colors.foreground }}>
                      {STATUS_LABELS[s]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {descriptionField}
          </>
        )}

        {teamPicker}

        {mode === 'add' && (
          <>
            <View style={{ marginTop: spacing.lg }}>
              <Text style={[styles.cardLabel, { marginBottom: spacing.sm }]}>Quick Templates</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: 2 }}>
                {PHASE_TEMPLATES.map(tmpl => (
                  <TouchableOpacity
                    key={tmpl.name}
                    onPress={() => {
                      setForm(f => ({ ...f, name: f.name || tmpl.name, description: f.description || tmpl.description }));
                      setStarterTasks(tmpl.tasks);
                      setStarterTaskInput('');
                    }}
                    style={{ paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: typography.caption.fontSize, color: colors.foreground, fontWeight: fontWeights.medium }}>{tmpl.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Starter tasks — created after the phase is saved, linked to the new phase */}
            <View style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
              <Text style={[styles.cardLabel, { marginBottom: spacing.sm }]}>Starter Tasks</Text>
              {starterTasks.map((task, idx) => (
                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs, paddingVertical: 3 }}>
                  <Feather name="check-square" size={13} color={colors.mutedForeground} />
                  <Text style={{ flex: 1, fontSize: typography.caption.fontSize, color: colors.foreground }}>{task}</Text>
                  <TouchableOpacity onPress={() => setStarterTasks(prev => prev.filter((_, i) => i !== idx))} hitSlop={8} activeOpacity={0.7}>
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: starterTasks.length > 0 ? spacing.xs : 0 }}>
                <TextInput
                  style={[styles.singleLineInput, { flex: 1, height: 40 }]}
                  placeholder="Add a task..."
                  placeholderTextColor={colors.mutedForeground}
                  value={starterTaskInput}
                  onChangeText={setStarterTaskInput}
                  onSubmitEditing={addStarterTask}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  onPress={addStarterTask}
                  disabled={!starterTaskInput.trim()}
                  style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: starterTaskInput.trim() ? colors.primary : colors.muted, alignItems: 'center', justifyContent: 'center' }}
                  activeOpacity={0.7}
                >
                  <Feather name="plus" size={16} color={starterTaskInput.trim() ? colors.primaryForeground : colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>
    </AppBottomSheet>
  );
}
