import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import { api } from '../lib/api';
import { showToast } from '../lib/toast';
import { formatCurrency } from '../lib/format';
import { spacing, typography, fontWeights, radius } from '../lib/design-tokens';

interface JobTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  source?: string | null;
  estimatedHours?: string | null;
  actualHours?: string | null;
  estimatedMaterialCost?: string | null;
  actualMaterialCost?: string | null;
  totalHours?: number;
  totalMaterialsCost?: number;
}

interface JobTasksSectionProps {
  containerStyle?: any;
  jobId: string;
  readOnly?: boolean;
  canLogWork?: boolean; // team members can log even when readOnly (owner actions locked)
  onTasksLoaded?: (tasks: JobTask[]) => void;
}

interface LogSheet {
  taskId: string;
  taskTitle: string;
  mode: 'hours' | 'materials';
}

interface CostEditForm {
  estimatedHours: string;
  actualHours: string;
  estimatedMaterialCost: string;
  actualMaterialCost: string;
}

function parseNum(val: string | null | undefined): number {
  if (val == null) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function isHoursOverrun(task: JobTask): boolean {
  const est = parseNum(task.estimatedHours);
  const act = parseNum(task.actualHours);
  return est > 0 && act > est;
}

function isMaterialOverrun(task: JobTask): boolean {
  const est = parseNum(task.estimatedMaterialCost);
  const act = parseNum(task.actualMaterialCost);
  return est > 0 && act > est;
}

function isTaskOverrun(task: JobTask): boolean {
  return isHoursOverrun(task) || isMaterialOverrun(task);
}

function isTaskAtRisk(task: JobTask): boolean {
  if (isTaskOverrun(task)) return false;
  const estH = parseNum(task.estimatedHours);
  const actH = parseNum(task.actualHours);
  const estM = parseNum(task.estimatedMaterialCost);
  const actM = parseNum(task.actualMaterialCost);
  if (estH > 0 && actH > 0 && actH / estH >= 0.9) return true;
  if (estM > 0 && actM > 0 && actM / estM >= 0.9) return true;
  return false;
}

function formatHours(h: number): string {
  if (h <= 0) return '';
  if (h < 1) return `${Math.round(h * 60)}m`;
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return mins > 0 ? `${whole}h ${mins}m` : `${whole}h`;
}

function formatCost(c: number): string {
  if (c <= 0) return '';
  return `$${c.toFixed(0)}`;
}

export function JobTasksSection({ jobId, readOnly, canLogWork, containerStyle, onTasksLoaded }: JobTasksSectionProps) {
  const { colors } = useTheme();
  const [tasks, setTasks] = useState<JobTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Cost edit state (owner)
  const [editingCostTask, setEditingCostTask] = useState<JobTask | null>(null);
  const [costForm, setCostForm] = useState<CostEditForm>({ estimatedHours: '', actualHours: '', estimatedMaterialCost: '', actualMaterialCost: '' });
  const [savingCost, setSavingCost] = useState(false);

  // Log-work modal state (team members)
  const [logSheet, setLogSheet] = useState<LogSheet | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hoursInput, setHoursInput] = useState('');
  const [hoursDesc, setHoursDesc] = useState('');
  const [matName, setMatName] = useState('');
  const [matQty, setMatQty] = useState('1');
  const [matUnit, setMatUnit] = useState('');
  const [matUnitCost, setMatUnitCost] = useState('');

  const load = useCallback(async () => {
    const res = await api.get<JobTask[]>(`/api/jobs/${jobId}/tasks`);
    if (!res.error && Array.isArray(res.data)) {
      setTasks(res.data);
      onTasksLoaded?.(res.data);
    }
    setLoading(false);
  }, [jobId, onTasksLoaded]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggle = async (task: JobTask) => {
    const nextStatus = task.status === 'done' ? 'open' : 'done';
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    const res = await api.patch(`/api/tasks/${task.id}`, { status: nextStatus });
    if (res.error) {
      showToast({ type: 'error', message: 'Could not update task' });
      load();
    }
  };

  const remove = async (task: JobTask) => {
    const filtered = tasks.filter((t) => t.id !== task.id);
    setTasks(filtered);
    onTasksLoaded?.(filtered);
    const res = await api.delete(`/api/tasks/${task.id}`);
    if (res.error) {
      showToast({ type: 'error', message: 'Could not delete task' });
      load();
    }
  };

  const add = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    const res = await api.post<JobTask>('/api/tasks', { title, jobId });
    setAdding(false);
    if (res.error) {
      showToast({ type: 'error', message: 'Could not add task' });
      return;
    }
    setNewTitle('');
    load();
  };

  const toggleExpand = (taskId: string) => {
    setExpanded((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  // Cost edit (owner)
  const openCostEdit = (task: JobTask) => {
    setCostForm({
      estimatedHours: task.estimatedHours ?? '',
      actualHours: task.actualHours ?? '',
      estimatedMaterialCost: task.estimatedMaterialCost ?? '',
      actualMaterialCost: task.actualMaterialCost ?? '',
    });
    setEditingCostTask(task);
  };

  const saveCost = async () => {
    if (!editingCostTask) return;
    setSavingCost(true);
    const payload: any = {
      estimatedHours: costForm.estimatedHours !== '' ? parseFloat(costForm.estimatedHours) || null : null,
      actualHours: costForm.actualHours !== '' ? parseFloat(costForm.actualHours) || null : null,
      estimatedMaterialCost: costForm.estimatedMaterialCost !== '' ? parseFloat(costForm.estimatedMaterialCost) || null : null,
      actualMaterialCost: costForm.actualMaterialCost !== '' ? parseFloat(costForm.actualMaterialCost) || null : null,
    };
    const res = await api.patch(`/api/tasks/${editingCostTask.id}`, payload);
    setSavingCost(false);
    if (res.error) {
      showToast({ type: 'error', message: 'Could not save cost data' });
      return;
    }
    setEditingCostTask(null);
    load();
  };

  // Log work (team members)
  const openLogSheet = (task: JobTask, mode: 'hours' | 'materials') => {
    setHoursInput('');
    setHoursDesc('');
    setMatName('');
    setMatQty('1');
    setMatUnit('');
    setMatUnitCost('');
    setLogSheet({ taskId: task.id, taskTitle: task.title, mode });
  };

  const closeLogSheet = () => setLogSheet(null);

  const submitLogHours = async () => {
    if (!logSheet) return;
    const parsed = parseFloat(hoursInput.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) {
      showToast({ type: 'error', message: 'Enter a valid duration in hours' });
      return;
    }
    const durationMinutes = Math.round(parsed * 60);
    setSubmitting(true);
    const res = await api.post(`/api/tasks/${logSheet.taskId}/log-hours`, {
      durationMinutes,
      description: hoursDesc.trim() || undefined,
    });
    setSubmitting(false);
    if (res.error) {
      showToast({ type: 'error', message: 'Could not log hours' });
      return;
    }
    showToast({ type: 'success', message: `${formatHours(parsed)} logged` });
    closeLogSheet();
    load();
  };

  const submitLogMaterial = async () => {
    if (!logSheet) return;
    const name = matName.trim();
    if (!name) {
      showToast({ type: 'error', message: 'Enter a material name' });
      return;
    }
    const qty = parseFloat(matQty.replace(',', '.'));
    const cost = parseFloat(matUnitCost.replace(',', '.'));
    if (isNaN(qty) || qty <= 0) {
      showToast({ type: 'error', message: 'Enter a valid quantity' });
      return;
    }
    if (isNaN(cost) || cost < 0) {
      showToast({ type: 'error', message: 'Enter a valid unit cost' });
      return;
    }
    setSubmitting(true);
    const res = await api.post(`/api/tasks/${logSheet.taskId}/log-materials`, {
      name,
      quantity: qty,
      unit: matUnit.trim() || undefined,
      unitCost: cost,
    });
    setSubmitting(false);
    if (res.error) {
      showToast({ type: 'error', message: 'Could not log material' });
      return;
    }
    showToast({ type: 'success', message: `${name} logged` });
    closeLogSheet();
    load();
  };

  if (loading) return null;
  if (tasks.length === 0 && readOnly && !canLogWork) return null;

  const openCount = tasks.filter((t) => t.status !== 'done').length;
  const showLogWork = canLogWork || !readOnly;

  const styles = StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 16, fontWeight: '600', color: colors.foreground },
    badge: {
      backgroundColor: colors.muted,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    badgeText: { fontSize: 12, color: colors.secondaryText, fontWeight: '600' },
    row: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowMain: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 10,
    },
    check: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    taskContent: { flex: 1 },
    taskTitle: { fontSize: 14, color: colors.foreground },
    taskTitleDone: { textDecorationLine: 'line-through', color: colors.secondaryText },
    taskDesc: { fontSize: 12, color: colors.secondaryText, marginTop: 2 },
    taskTotals: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
      flexWrap: 'wrap',
    },
    totalChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.muted,
      borderRadius: 5,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    totalChipText: { fontSize: 11, color: colors.secondaryText, fontWeight: '500' },
    rowActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    expandBtn: { padding: 4 },
    expandPanel: {
      paddingBottom: 10,
      paddingLeft: 34,
      gap: 6,
    },
    logBtnRow: { flexDirection: 'row', gap: 8 },
    logBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 7,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    logBtnText: { fontSize: 13, color: colors.foreground, fontWeight: '500' },
    costRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
      marginLeft: 34,
      flexWrap: 'wrap',
    },
    costChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: colors.muted,
    },
    costChipText: {
      fontSize: 11,
      fontWeight: fontWeights.semibold,
    },
    overrunBanner: {
      marginLeft: 34,
      marginTop: 5,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    overrunText: {
      fontSize: 11,
      fontWeight: fontWeights.semibold,
    },
    editCostBtn: {
      padding: 4,
    },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.foreground,
      fontSize: 14,
      letterSpacing: 0,
      textAlign: 'left',
    },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Cost edit modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    },
    modalTitle: {
      fontSize: typography.subtitle.fontSize,
      fontWeight: fontWeights.bold,
      color: colors.foreground,
      marginBottom: spacing.md,
    },
    modalFieldLabel: {
      fontSize: 12,
      fontWeight: fontWeights.semibold,
      color: colors.secondaryText,
      marginBottom: spacing.xxs,
      marginTop: spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.foreground,
      fontSize: 14,
      backgroundColor: colors.background,
    },
    modalRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: radius.md,
      alignItems: 'center',
    },
    // Log work bottom sheet
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.card ?? colors.background,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 20,
      paddingBottom: Platform.OS === 'ios' ? 36 : 20,
      gap: 14,
    },
    sheetHandle: {
      width: 36,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 4,
    },
    sheetTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground },
    sheetSubtitle: { fontSize: 13, color: colors.secondaryText, marginTop: -8 },
    fieldLabel: { fontSize: 13, fontWeight: '500', color: colors.secondaryText, marginBottom: 4 },
    fieldInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.foreground,
      fontSize: 14,
    },
    fieldRow: { flexDirection: 'row', gap: 10 },
    fieldCol: { flex: 1 },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 4,
    },
    submitBtnText: { color: colors.primaryForeground ?? '#fff', fontWeight: '600', fontSize: 15 },
    cancelBtn: { alignItems: 'center', paddingVertical: 8 },
    cancelBtnText: { color: colors.secondaryText, fontSize: 14 },
  });

  return (
    <View style={containerStyle}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="check-square" size={18} color={colors.foreground} />
          <Text style={styles.title}>Follow-up Tasks</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{openCount} open</Text>
        </View>
      </View>

      {tasks.map((task) => {
        const done = task.status === 'done';
        const overrun = isTaskOverrun(task);
        const atRisk = !overrun && isTaskAtRisk(task);
        const statusColor = overrun ? colors.destructive : atRisk ? colors.warning : undefined;
        const isExpanded = !!expanded[task.id];

        const estH = parseNum(task.estimatedHours);
        const actH = parseNum(task.actualHours);
        const estM = parseNum(task.estimatedMaterialCost);
        const actM = parseNum(task.actualMaterialCost);
        const hasCostData = estH > 0 || actH > 0 || estM > 0 || actM > 0;

        const hasHours = (task.totalHours ?? 0) > 0;
        const hasMaterials = (task.totalMaterialsCost ?? 0) > 0;

        return (
          <View
            key={task.id}
            style={[
              styles.row,
              (overrun || atRisk) ? {
                backgroundColor: overrun ? `${colors.destructive}0D` : `${colors.warning}0D`,
                borderRadius: 8,
                paddingHorizontal: 6,
                marginHorizontal: -6,
              } : {},
            ]}
          >
            <View style={styles.rowMain}>
              <TouchableOpacity
                onPress={() => !readOnly && toggle(task)}
                disabled={readOnly}
                style={[
                  styles.check,
                  { borderColor: done ? colors.success : (statusColor ?? colors.border), backgroundColor: done ? colors.success : 'transparent' },
                ]}
              >
                {done && <Feather name="check" size={14} color={colors.primaryForeground ?? '#fff'} />}
              </TouchableOpacity>

              <View style={styles.taskContent}>
                <Text style={[styles.taskTitle, done && styles.taskTitleDone]}>{task.title}</Text>
                {!!task.description && <Text style={styles.taskDesc}>{task.description}</Text>}
                {/* Totals from work-log entries */}
                {(hasHours || hasMaterials) && (
                  <View style={styles.taskTotals}>
                    {hasHours && (
                      <View style={styles.totalChip}>
                        <Feather name="clock" size={11} color={colors.secondaryText} />
                        <Text style={styles.totalChipText}>{formatHours(task.totalHours!)}</Text>
                      </View>
                    )}
                    {hasMaterials && (
                      <View style={styles.totalChip}>
                        <Feather name="package" size={11} color={colors.secondaryText} />
                        <Text style={styles.totalChipText}>{formatCost(task.totalMaterialsCost!)}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.rowActions}>
                {showLogWork && (
                  <TouchableOpacity onPress={() => toggleExpand(task.id)} style={styles.expandBtn} hitSlop={8}>
                    <Feather
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={colors.secondaryText}
                    />
                  </TouchableOpacity>
                )}
                {!readOnly && (
                  <TouchableOpacity onPress={() => openCostEdit(task)} hitSlop={8} style={styles.editCostBtn}>
                    <Feather name="dollar-sign" size={15} color={hasCostData ? (statusColor ?? colors.primary) : colors.secondaryText} />
                  </TouchableOpacity>
                )}
                {!readOnly && (
                  <TouchableOpacity onPress={() => remove(task)} hitSlop={8}>
                    <Feather name="trash-2" size={18} color={colors.secondaryText} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Budget cost chips (estimated vs actual) */}
            {hasCostData && (
              <View style={styles.costRow}>
                {(estH > 0 || actH > 0) && (
                  <View style={[styles.costChip, isHoursOverrun(task) ? { backgroundColor: `${colors.destructive}18` } : {}]}>
                    <Feather name="clock" size={11} color={isHoursOverrun(task) ? colors.destructive : colors.secondaryText} />
                    <Text style={[styles.costChipText, { color: isHoursOverrun(task) ? colors.destructive : colors.secondaryText }]}>
                      {actH > 0 ? `${actH.toFixed(1)}h` : '—'}
                      {estH > 0 ? ` / ${estH.toFixed(1)}h est` : ''}
                    </Text>
                  </View>
                )}
                {(estM > 0 || actM > 0) && (
                  <View style={[styles.costChip, isMaterialOverrun(task) ? { backgroundColor: `${colors.destructive}18` } : {}]}>
                    <Feather name="package" size={11} color={isMaterialOverrun(task) ? colors.destructive : colors.secondaryText} />
                    <Text style={[styles.costChipText, { color: isMaterialOverrun(task) ? colors.destructive : colors.secondaryText }]}>
                      {actM > 0 ? formatCurrency(actM) : '—'}
                      {estM > 0 ? ` / ${formatCurrency(estM)} est` : ''}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {(overrun || atRisk) && hasCostData && (
              <View style={styles.overrunBanner}>
                <Feather name="alert-triangle" size={12} color={statusColor} />
                <Text style={[styles.overrunText, { color: statusColor }]}>
                  {overrun ? 'Over budget' : 'Near budget limit'}
                </Text>
              </View>
            )}

            {/* Log work expand panel */}
            {isExpanded && showLogWork && (
              <View style={styles.expandPanel}>
                <View style={styles.logBtnRow}>
                  <TouchableOpacity style={styles.logBtn} onPress={() => openLogSheet(task, 'hours')}>
                    <Feather name="clock" size={14} color={colors.foreground} />
                    <Text style={styles.logBtnText}>Log hours</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.logBtn} onPress={() => openLogSheet(task, 'materials')}>
                    <Feather name="package" size={14} color={colors.foreground} />
                    <Text style={styles.logBtnText}>Log materials</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        );
      })}

      {!readOnly && (
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="Add a task"
            placeholderTextColor={colors.secondaryText}
            returnKeyType="done"
            onSubmitEditing={add}
          />
          <TouchableOpacity style={styles.addBtn} onPress={add} disabled={adding || !newTitle.trim()}>
            {adding ? (
              <ActivityIndicator size="small" color={colors.primaryForeground ?? '#fff'} />
            ) : (
              <Feather name="plus" size={20} color={colors.primaryForeground ?? '#fff'} />
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Cost edit bottom sheet (owner) */}
      <Modal
        visible={!!editingCostTask}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingCostTask(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditingCostTask(null)}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <ScrollView style={styles.modalSheet} keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>Task Budget: {editingCostTask?.title}</Text>

                <Text style={styles.modalFieldLabel}>Estimated Hours</Text>
                <TextInput
                  style={styles.modalInput}
                  value={costForm.estimatedHours}
                  onChangeText={(v) => setCostForm((f) => ({ ...f, estimatedHours: v }))}
                  placeholder="e.g. 4"
                  placeholderTextColor={colors.secondaryText}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.modalFieldLabel}>Actual Hours</Text>
                <TextInput
                  style={styles.modalInput}
                  value={costForm.actualHours}
                  onChangeText={(v) => setCostForm((f) => ({ ...f, actualHours: v }))}
                  placeholder="e.g. 5.5"
                  placeholderTextColor={colors.secondaryText}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.modalFieldLabel}>Estimated Material Cost</Text>
                <TextInput
                  style={styles.modalInput}
                  value={costForm.estimatedMaterialCost}
                  onChangeText={(v) => setCostForm((f) => ({ ...f, estimatedMaterialCost: v }))}
                  placeholder="e.g. 200"
                  placeholderTextColor={colors.secondaryText}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.modalFieldLabel}>Actual Material Cost</Text>
                <TextInput
                  style={styles.modalInput}
                  value={costForm.actualMaterialCost}
                  onChangeText={(v) => setCostForm((f) => ({ ...f, actualMaterialCost: v }))}
                  placeholder="e.g. 240"
                  placeholderTextColor={colors.secondaryText}
                  keyboardType="decimal-pad"
                />

                <View style={styles.modalRow}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: colors.muted }]}
                    onPress={() => setEditingCostTask(null)}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: fontWeights.semibold }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                    onPress={saveCost}
                    disabled={savingCost}
                  >
                    {savingCost ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground ?? '#fff'} />
                    ) : (
                      <Text style={{ color: colors.primaryForeground ?? '#fff', fontWeight: fontWeights.semibold }}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Log work bottom sheet (team members) */}
      <Modal
        visible={!!logSheet}
        transparent
        animationType="slide"
        onRequestClose={closeLogSheet}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeLogSheet} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            {logSheet?.mode === 'hours' ? (
              <>
                <Text style={styles.sheetTitle}>Log hours</Text>
                <Text style={styles.sheetSubtitle} numberOfLines={1}>{logSheet.taskTitle}</Text>

                <View>
                  <Text style={styles.fieldLabel}>Duration (hours)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={hoursInput}
                    onChangeText={setHoursInput}
                    placeholder="e.g. 2.5"
                    placeholderTextColor={colors.secondaryText}
                    keyboardType="decimal-pad"
                    returnKeyType="next"
                  />
                </View>

                <View>
                  <Text style={styles.fieldLabel}>Description (optional)</Text>
                  <TextInput
                    style={[styles.fieldInput, { height: 72, textAlignVertical: 'top' }]}
                    value={hoursDesc}
                    onChangeText={setHoursDesc}
                    placeholder="What was done?"
                    placeholderTextColor={colors.secondaryText}
                    multiline
                    returnKeyType="done"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, (!hoursInput.trim() || submitting) && { opacity: 0.5 }]}
                  onPress={submitLogHours}
                  disabled={!hoursInput.trim() || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground ?? '#fff'} />
                  ) : (
                    <Text style={styles.submitBtnText}>Save hours</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeLogSheet}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.sheetTitle}>Log materials</Text>
                <Text style={styles.sheetSubtitle} numberOfLines={1}>{logSheet?.taskTitle}</Text>

                <View>
                  <Text style={styles.fieldLabel}>Material name</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={matName}
                    onChangeText={setMatName}
                    placeholder="e.g. Copper pipe 15mm"
                    placeholderTextColor={colors.secondaryText}
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.fieldRow}>
                  <View style={styles.fieldCol}>
                    <Text style={styles.fieldLabel}>Quantity</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={matQty}
                      onChangeText={setMatQty}
                      placeholder="1"
                      placeholderTextColor={colors.secondaryText}
                      keyboardType="decimal-pad"
                      returnKeyType="next"
                    />
                  </View>
                  <View style={styles.fieldCol}>
                    <Text style={styles.fieldLabel}>Unit (optional)</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={matUnit}
                      onChangeText={setMatUnit}
                      placeholder="m, kg, pc"
                      placeholderTextColor={colors.secondaryText}
                      returnKeyType="next"
                    />
                  </View>
                </View>

                <View>
                  <Text style={styles.fieldLabel}>Unit cost ($)</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={matUnitCost}
                    onChangeText={setMatUnitCost}
                    placeholder="0.00"
                    placeholderTextColor={colors.secondaryText}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, (!matName.trim() || submitting) && { opacity: 0.5 }]}
                  onPress={submitLogMaterial}
                  disabled={!matName.trim() || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground ?? '#fff'} />
                  ) : (
                    <Text style={styles.submitBtnText}>Save material</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeLogSheet}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
