/**
 * UnifiedWorkSection
 *
 * Replaces the separate ChecklistSection + JobTasksSection with a single
 * work-tracking card per job. Items are either:
 *   - Simple checklist items (checkbox only, draggable-reorderable)
 *   - Full tasks (title, optional description, hours/materials budget + log-work)
 *
 * Users can promote a checklist item to a full task inline.
 * The header shows combined progress: "3 of 7 complete".
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import { api } from '../lib/api';
import { showToast } from '../lib/toast';
import { formatCurrency } from '../lib/format';
import { fontWeights, spacing, radius, typography } from '../lib/design-tokens';

// ─── Constants ────────────────────────────────────────────────────────────────

const CHECKLIST_ROW_HEIGHT = 48;
const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.5 };

// ─── Data interfaces ──────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  jobId: string;
  text: string;
  isCompleted: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

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

// ─── Props ────────────────────────────────────────────────────────────────────

export interface UnifiedWorkSectionProps {
  jobId: string;
  /**
   * Locks task-specific owner actions (add/delete/cost/promote).
   * Set to `job.status === 'invoiced' || !(roleInfo?.isOwner || isSoloOwner)`.
   */
  readOnly?: boolean;
  /**
   * Locks checklist item edits independently of task ownership.
   * Defaults to `readOnly` when omitted.
   * Set to `job.status === 'invoiced'` so non-owners can still check off items.
   */
  checklistReadOnly?: boolean;
  /** Team members can log hours/materials even when readOnly (owner actions stay locked) */
  canLogWork?: boolean;
  containerStyle?: any;
  /** Called whenever the combined completion counts change */
  onCountsChange?: (completed: number, total: number) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatCostShort(c: number): string {
  if (c <= 0) return '';
  return `$${c.toFixed(0)}`;
}

// ─── Draggable checklist row ──────────────────────────────────────────────────

interface DraggableRowProps {
  item: ChecklistItem;
  index: number;
  total: number;
  activeIndex: SharedValue<number>;
  dragY: SharedValue<number>;
  colors: ReturnType<typeof import('../lib/theme').useTheme>['colors'];
  onToggle: (item: ChecklistItem) => void;
  onRemove: (item: ChecklistItem) => void;
  onPromote: (item: ChecklistItem) => void;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  readOnly: boolean;
  /** True only for owners — gates the promote-to-task action separately from checklist editing */
  canPromote: boolean;
}

function DraggableChecklistRow({
  item,
  index,
  total,
  activeIndex,
  dragY,
  colors,
  onToggle,
  onRemove,
  onPromote,
  onDragEnd,
  readOnly,
  canPromote,
}: DraggableRowProps) {
  const done = item.isCompleted;
  const isActive = useSharedValue(false);

  const computeTarget = (fromIndex: number, dy: number): number => {
    'worklet';
    const rawTarget = fromIndex + Math.round(dy / CHECKLIST_ROW_HEIGHT);
    return Math.max(0, Math.min(total - 1, rawTarget));
  };

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart(() => {
      isActive.value = true;
      activeIndex.value = index;
      dragY.value = 0;
    })
    .onUpdate((e) => {
      dragY.value = e.translationY;
    })
    .onEnd(() => {
      const toIndex = computeTarget(index, dragY.value);
      isActive.value = false;
      activeIndex.value = -1;
      dragY.value = 0;
      if (toIndex !== index) {
        runOnJS(onDragEnd)(index, toIndex);
      }
    })
    .onFinalize(() => {
      if (isActive.value) {
        isActive.value = false;
        activeIndex.value = -1;
        dragY.value = 0;
      }
    });

  const animStyle = useAnimatedStyle(() => {
    const active = activeIndex.value;
    if (active === -1) {
      return { translateY: 0, zIndex: 0, shadowOpacity: 0, elevation: 0, opacity: 1 };
    }
    if (active === index) {
      return { translateY: dragY.value, zIndex: 100, shadowOpacity: 0.25, elevation: 8, opacity: 0.95 };
    }
    const hoverIndex = Math.max(0, Math.min(total - 1, Math.round(active + dragY.value / CHECKLIST_ROW_HEIGHT)));
    let shift = 0;
    if (active < index && hoverIndex >= index) shift = -CHECKLIST_ROW_HEIGHT;
    else if (active > index && hoverIndex <= index) shift = CHECKLIST_ROW_HEIGHT;
    return { translateY: withSpring(shift, SPRING_CONFIG), zIndex: 0, shadowOpacity: 0, elevation: 0, opacity: 1 };
  });

  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: CHECKLIST_ROW_HEIGHT,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
          gap: spacing.sm,
        },
        animStyle,
      ]}
    >
      {/* Drag handle */}
      {!readOnly && (
        <GestureDetector gesture={panGesture}>
          <View style={{ padding: 8, justifyContent: 'center', alignItems: 'center' }}>
            <Feather name="menu" size={16} color={colors.mutedForeground} />
          </View>
        </GestureDetector>
      )}

      {/* Checkbox */}
      <TouchableOpacity
        onPress={() => !readOnly && onToggle(item)}
        disabled={readOnly}
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 1.5,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          borderColor: done ? colors.success : colors.border,
          backgroundColor: done ? colors.success : 'transparent',
        }}
        hitSlop={8}
      >
        {done && <Feather name="check" size={13} color={colors.primaryForeground} />}
      </TouchableOpacity>

      {/* Label */}
      <Text
        style={{
          flex: 1,
          fontSize: typography.sizes.sm,
          color: done ? colors.mutedForeground : colors.foreground,
          lineHeight: 20,
          textDecorationLine: done ? 'line-through' : 'none',
        }}
        numberOfLines={2}
      >
        {item.text}
      </Text>

      {/* Promote + delete — visible when checklist editing is allowed */}
      {!readOnly && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {/* Promote to full task — owner-only */}
          {canPromote && (
            <TouchableOpacity onPress={() => onPromote(item)} hitSlop={8} style={{ padding: 4 }}>
              <Feather name="arrow-up-circle" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => onRemove(item)} hitSlop={8} style={{ padding: 4 }}>
            <Feather name="trash-2" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Cost / log-work modal state ──────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export function UnifiedWorkSection({
  jobId,
  readOnly,
  checklistReadOnly,
  canLogWork,
  containerStyle,
  onCountsChange,
}: UnifiedWorkSectionProps) {
  const { colors } = useTheme();
  // Checklist items can be edited by any non-read-only user (not owner-gated).
  // Fall back to `readOnly` when `checklistReadOnly` is not explicitly provided.
  const clReadOnly = checklistReadOnly !== undefined ? checklistReadOnly : (readOnly ?? false);

  // Data
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [tasks, setTasks] = useState<JobTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Add-row state
  const [addMode, setAddMode] = useState<'item' | 'task'>('item');
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);

  // Checklist drag state
  const activeIndex = useSharedValue(-1);
  const dragY = useSharedValue(0);

  // Task expand
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Cost edit modal (owner)
  const [editingCostTask, setEditingCostTask] = useState<JobTask | null>(null);
  const [costForm, setCostForm] = useState<CostEditForm>({
    estimatedHours: '', actualHours: '', estimatedMaterialCost: '', actualMaterialCost: '',
  });
  const [savingCost, setSavingCost] = useState(false);

  // Log-work modal (team)
  const [logSheet, setLogSheet] = useState<LogSheet | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hoursInput, setHoursInput] = useState('');
  const [hoursDesc, setHoursDesc] = useState('');
  const [matName, setMatName] = useState('');
  const [matQty, setMatQty] = useState('1');
  const [matUnit, setMatUnit] = useState('');
  const [matUnitCost, setMatUnitCost] = useState('');

  // ── Data loading ────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const [clRes, taskRes] = await Promise.all([
      api.get<ChecklistItem[]>(`/api/jobs/${jobId}/checklist`),
      api.get<JobTask[]>(`/api/jobs/${jobId}/tasks`),
    ]);
    if (!clRes.error && Array.isArray(clRes.data)) {
      setChecklistItems([...clRes.data].sort((a, b) => a.sortOrder - b.sortOrder));
    }
    if (!taskRes.error && Array.isArray(taskRes.data)) {
      setTasks(taskRes.data);
    }
    setLoading(false);
  }, [jobId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Counts reporting ────────────────────────────────────────────────────────

  const onCountsChangeRef = useRef(onCountsChange);
  onCountsChangeRef.current = onCountsChange;

  useEffect(() => {
    const completedCL = checklistItems.filter((i) => i.isCompleted).length;
    const completedTasks = tasks.filter((t) => t.status === 'done').length;
    const total = checklistItems.length + tasks.length;
    const completed = completedCL + completedTasks;
    onCountsChangeRef.current?.(completed, total);
  }, [checklistItems, tasks]);

  // ── Checklist mutations ─────────────────────────────────────────────────────

  const toggleChecklistItem = async (item: ChecklistItem) => {
    const next = !item.isCompleted;
    setChecklistItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isCompleted: next } : i)));
    const res = await api.patch(`/api/checklist/${item.id}`, { isCompleted: next });
    if (res.error) { showToast({ type: 'error', message: 'Could not update item' }); load(); }
  };

  const removeChecklistItem = async (item: ChecklistItem) => {
    setChecklistItems((prev) => prev.filter((i) => i.id !== item.id));
    const res = await api.delete(`/api/checklist/${item.id}`);
    if (res.error) { showToast({ type: 'error', message: 'Could not delete item' }); load(); }
  };

  const promoteToTask = async (item: ChecklistItem) => {
    // Sequential: create the task first; only delete the checklist item if creation succeeds.
    const taskRes = await api.post<JobTask>('/api/tasks', { title: item.text, jobId });
    if (taskRes.error) {
      showToast({ type: 'error', message: 'Could not create task' });
      return;
    }
    const deleteRes = await api.delete(`/api/checklist/${item.id}`);
    if (deleteRes.error) {
      showToast({ type: 'error', message: 'Task created, but the checklist item could not be removed. Please delete it manually.' });
    } else {
      showToast({ type: 'success', message: 'Converted to full task' });
    }
    load();
  };

  const handleChecklistDragEnd = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      const next = [...checklistItems];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      const reordered = next.map((item, idx) => ({ ...item, sortOrder: idx }));
      setChecklistItems(reordered);
      const toUpdate = reordered.filter((item) => {
        const original = checklistItems.find((o) => o.id === item.id);
        return original && original.sortOrder !== item.sortOrder;
      });
      if (toUpdate.length === 0) return;
      const results = await Promise.all(
        toUpdate.map((item) => api.patch(`/api/checklist/${item.id}`, { sortOrder: item.sortOrder }))
      );
      if (results.some((r) => r.error)) { showToast({ type: 'error', message: 'Could not save new order' }); load(); }
    },
    [checklistItems, load]
  );

  // ── Task mutations ──────────────────────────────────────────────────────────

  const toggleTask = async (task: JobTask) => {
    const nextStatus = task.status === 'done' ? 'open' : 'done';
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    const res = await api.patch(`/api/tasks/${task.id}`, { status: nextStatus });
    if (res.error) { showToast({ type: 'error', message: 'Could not update task' }); load(); }
  };

  const removeTask = async (task: JobTask) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    const res = await api.delete(`/api/tasks/${task.id}`);
    if (res.error) { showToast({ type: 'error', message: 'Could not delete task' }); load(); }
  };

  // ── Add new item / task ─────────────────────────────────────────────────────

  const addItem = async () => {
    const text = newText.trim();
    if (!text) return;
    setAdding(true);
    if (addMode === 'item') {
      const maxOrder = checklistItems.length > 0 ? Math.max(...checklistItems.map((i) => i.sortOrder)) : -1;
      const res = await api.post<ChecklistItem>(`/api/jobs/${jobId}/checklist`, { text, sortOrder: maxOrder + 1 });
      if (res.error) showToast({ type: 'error', message: 'Could not add item' });
    } else {
      const res = await api.post<JobTask>('/api/tasks', { title: text, jobId });
      if (res.error) showToast({ type: 'error', message: 'Could not add task' });
    }
    setAdding(false);
    setNewText('');
    load();
  };

  // ── Cost edit ───────────────────────────────────────────────────────────────

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
    if (res.error) { showToast({ type: 'error', message: 'Could not save cost data' }); return; }
    setEditingCostTask(null);
    load();
  };

  // ── Log work ────────────────────────────────────────────────────────────────

  const openLogSheet = (task: JobTask, mode: 'hours' | 'materials') => {
    setHoursInput(''); setHoursDesc('');
    setMatName(''); setMatQty('1'); setMatUnit(''); setMatUnitCost('');
    setLogSheet({ taskId: task.id, taskTitle: task.title, mode });
  };

  const closeLogSheet = () => setLogSheet(null);

  const submitLogHours = async () => {
    if (!logSheet) return;
    const parsed = parseFloat(hoursInput.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) { showToast({ type: 'error', message: 'Enter a valid duration in hours' }); return; }
    setSubmitting(true);
    const res = await api.post(`/api/tasks/${logSheet.taskId}/log-hours`, {
      durationMinutes: Math.round(parsed * 60),
      description: hoursDesc.trim() || undefined,
    });
    setSubmitting(false);
    if (res.error) { showToast({ type: 'error', message: 'Could not log hours' }); return; }
    showToast({ type: 'success', message: `${formatHours(parsed)} logged` });
    closeLogSheet();
    load();
  };

  const submitLogMaterial = async () => {
    if (!logSheet) return;
    const name = matName.trim();
    if (!name) { showToast({ type: 'error', message: 'Enter a material name' }); return; }
    const qty = parseFloat(matQty.replace(',', '.'));
    const cost = parseFloat(matUnitCost.replace(',', '.'));
    if (isNaN(qty) || qty <= 0) { showToast({ type: 'error', message: 'Enter a valid quantity' }); return; }
    if (isNaN(cost) || cost < 0) { showToast({ type: 'error', message: 'Enter a valid unit cost' }); return; }
    setSubmitting(true);
    const res = await api.post(`/api/tasks/${logSheet.taskId}/log-materials`, {
      name, quantity: qty, unit: matUnit.trim() || undefined, unitCost: cost,
    });
    setSubmitting(false);
    if (res.error) { showToast({ type: 'error', message: 'Could not log material' }); return; }
    showToast({ type: 'success', message: `${name} logged` });
    closeLogSheet();
    load();
  };

  // ── Computed values ─────────────────────────────────────────────────────────

  const completedCL = checklistItems.filter((i) => i.isCompleted).length;
  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const totalItems = checklistItems.length + tasks.length;
  const completedItems = completedCL + completedTasks;
  const showLogWork = canLogWork || !readOnly;

  // ── Styles ──────────────────────────────────────────────────────────────────

  const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    badge: { backgroundColor: colors.muted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
    badgeText: { fontSize: typography.sizes.sm, color: colors.mutedForeground, fontWeight: fontWeights.semibold },
    sectionLabel: {
      fontSize: typography.sizes.xs,
      fontWeight: fontWeights.semibold,
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    taskRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    taskRowMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
    taskCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    taskContent: { flex: 1 },
    taskTitle: { fontSize: typography.sizes.sm, color: colors.foreground },
    taskTitleDone: { textDecorationLine: 'line-through', color: colors.mutedForeground },
    taskDesc: { fontSize: typography.sizes.xs, color: colors.mutedForeground, marginTop: 2 },
    taskTotals: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
    totalChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.muted, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
    totalChipText: { fontSize: 11, color: colors.mutedForeground, fontWeight: fontWeights.medium },
    rowActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    expandPanel: { paddingBottom: 10, paddingLeft: 34, gap: 6 },
    logBtnRow: { flexDirection: 'row', gap: 8 },
    logBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 7 },
    logBtnText: { fontSize: 13, color: colors.foreground, fontWeight: fontWeights.medium },
    costRow: { flexDirection: 'row', gap: 8, marginTop: 4, marginLeft: 34, flexWrap: 'wrap' },
    costChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.muted },
    costChipText: { fontSize: 11, fontWeight: fontWeights.semibold },
    overrunBanner: { marginLeft: 34, marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
    overrunText: { fontSize: 11, fontWeight: fontWeights.semibold },
    // Add row
    addModeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm },
    addModeBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1 },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.foreground,
      fontSize: typography.sizes.sm,
      backgroundColor: colors.background,
    },
    addBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, paddingBottom: spacing.xl },
    modalTitle: { fontSize: 16, fontWeight: fontWeights.bold, color: colors.foreground, marginBottom: spacing.md },
    modalFieldLabel: { fontSize: 12, fontWeight: fontWeights.semibold, color: colors.mutedForeground, marginBottom: spacing.xxs, marginTop: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.4 },
    modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontSize: 14, backgroundColor: colors.background },
    modalRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.md, alignItems: 'center' },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.card ?? colors.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20, gap: 14 },
    sheetHandle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
    sheetTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground },
    sheetSubtitle: { fontSize: 13, color: colors.mutedForeground, marginTop: -8 },
    fieldLabel: { fontSize: 13, fontWeight: fontWeights.medium, color: colors.mutedForeground, marginBottom: 4 },
    fieldInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: colors.foreground, fontSize: 14 },
    fieldRow: { flexDirection: 'row', gap: 10 },
    fieldCol: { flex: 1 },
    submitBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    submitBtnText: { color: colors.primaryForeground ?? '#fff', fontWeight: '600', fontSize: 15 },
    cancelBtn: { alignItems: 'center', paddingVertical: 8 },
    cancelBtnText: { color: colors.mutedForeground, fontSize: 14 },
  });

  // ── Early returns ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[containerStyle, { paddingVertical: spacing.lg, alignItems: 'center' }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  const badgeLabel = totalItems > 0 ? `${completedItems} of ${totalItems} complete` : 'No items';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={containerStyle}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="check-square" size={18} color={colors.foreground} />
          <Text style={{ fontSize: typography.sizes.md, fontWeight: fontWeights.semibold, color: colors.foreground }}>
            Work Items
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeLabel}</Text>
        </View>
      </View>

      {/* ── Checklist items ── */}
      {checklistItems.length > 0 && (
        <>
          {tasks.length > 0 && (
            <Text style={styles.sectionLabel}>Checklist</Text>
          )}
          <View style={{ overflow: 'hidden' }}>
            {checklistItems.map((item, index) => (
              <DraggableChecklistRow
                key={item.id}
                item={item}
                index={index}
                total={checklistItems.length}
                activeIndex={activeIndex}
                dragY={dragY}
                colors={colors}
                onToggle={toggleChecklistItem}
                onRemove={removeChecklistItem}
                onPromote={promoteToTask}
                onDragEnd={handleChecklistDragEnd}
                readOnly={clReadOnly}
                canPromote={!(readOnly ?? false)}
              />
            ))}
          </View>
        </>
      )}

      {/* ── Tasks ── */}
      {tasks.length > 0 && (
        <>
          {checklistItems.length > 0 && (
            <Text style={styles.sectionLabel}>Tasks</Text>
          )}
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
                  styles.taskRow,
                  (overrun || atRisk) ? {
                    backgroundColor: overrun ? `${colors.destructive}0D` : `${colors.warning}0D`,
                    borderRadius: 8,
                    paddingHorizontal: 6,
                    marginHorizontal: -6,
                  } : {},
                ]}
              >
                <View style={styles.taskRowMain}>
                  {/* Circle checkbox for tasks */}
                  <TouchableOpacity
                    onPress={() => !readOnly && toggleTask(task)}
                    disabled={readOnly}
                    style={[
                      styles.taskCheck,
                      { borderColor: done ? colors.success : (statusColor ?? colors.border), backgroundColor: done ? colors.success : 'transparent' },
                    ]}
                    hitSlop={8}
                  >
                    {done && <Feather name="check" size={13} color={colors.primaryForeground ?? '#fff'} />}
                  </TouchableOpacity>

                  <View style={styles.taskContent}>
                    <Text style={[styles.taskTitle, done && styles.taskTitleDone]}>{task.title}</Text>
                    {!!task.description && <Text style={styles.taskDesc}>{task.description}</Text>}
                    {(hasHours || hasMaterials) && (
                      <View style={styles.taskTotals}>
                        {hasHours && (
                          <View style={styles.totalChip}>
                            <Feather name="clock" size={11} color={colors.mutedForeground} />
                            <Text style={styles.totalChipText}>{formatHours(task.totalHours!)}</Text>
                          </View>
                        )}
                        {hasMaterials && (
                          <View style={styles.totalChip}>
                            <Feather name="package" size={11} color={colors.mutedForeground} />
                            <Text style={styles.totalChipText}>{formatCostShort(task.totalMaterialsCost!)}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  <View style={styles.rowActions}>
                    {showLogWork && (
                      <TouchableOpacity onPress={() => setExpanded((p) => ({ ...p, [task.id]: !p[task.id] }))} hitSlop={8} style={{ padding: 4 }}>
                        <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    )}
                    {!readOnly && (
                      <TouchableOpacity onPress={() => openCostEdit(task)} hitSlop={8} style={{ padding: 4 }}>
                        <Feather name="dollar-sign" size={15} color={hasCostData ? (statusColor ?? colors.primary) : colors.mutedForeground} />
                      </TouchableOpacity>
                    )}
                    {!readOnly && (
                      <TouchableOpacity onPress={() => removeTask(task)} hitSlop={8} style={{ padding: 4 }}>
                        <Feather name="trash-2" size={16} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Budget chips */}
                {hasCostData && (
                  <View style={styles.costRow}>
                    {(estH > 0 || actH > 0) && (
                      <View style={[styles.costChip, isHoursOverrun(task) ? { backgroundColor: `${colors.destructive}18` } : {}]}>
                        <Feather name="clock" size={11} color={isHoursOverrun(task) ? colors.destructive : colors.mutedForeground} />
                        <Text style={[styles.costChipText, { color: isHoursOverrun(task) ? colors.destructive : colors.mutedForeground }]}>
                          {actH > 0 ? `${actH.toFixed(1)}h` : '—'}{estH > 0 ? ` / ${estH.toFixed(1)}h est` : ''}
                        </Text>
                      </View>
                    )}
                    {(estM > 0 || actM > 0) && (
                      <View style={[styles.costChip, isMaterialOverrun(task) ? { backgroundColor: `${colors.destructive}18` } : {}]}>
                        <Feather name="package" size={11} color={isMaterialOverrun(task) ? colors.destructive : colors.mutedForeground} />
                        <Text style={[styles.costChipText, { color: isMaterialOverrun(task) ? colors.destructive : colors.mutedForeground }]}>
                          {actM > 0 ? formatCurrency(actM) : '—'}{estM > 0 ? ` / ${formatCurrency(estM)} est` : ''}
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
        </>
      )}

      {/* Empty state */}
      {totalItems === 0 && (
        <Text style={{ fontSize: typography.sizes.sm, color: colors.mutedForeground, textAlign: 'center', paddingVertical: spacing.lg }}>
          {(readOnly && clReadOnly) ? 'No items.' : 'Add checklist items or tasks below.'}
        </Text>
      )}

      {/* ── Add row — visible whenever the user can add at least one item type ── */}
      {(!clReadOnly || !readOnly) && (
        <>
          {/* Mode toggle: only show the "Full task" option to owners */}
          {!readOnly && (
            <View style={styles.addModeRow}>
              <TouchableOpacity
                style={[
                  styles.addModeBtn,
                  {
                    borderColor: addMode === 'item' ? colors.primary : colors.border,
                    backgroundColor: addMode === 'item' ? `${colors.primary}15` : 'transparent',
                  },
                ]}
                onPress={() => setAddMode('item')}
              >
                <Feather name="check-square" size={13} color={addMode === 'item' ? colors.primary : colors.mutedForeground} />
                <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: addMode === 'item' ? colors.primary : colors.mutedForeground }}>
                  Checklist item
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.addModeBtn,
                  {
                    borderColor: addMode === 'task' ? colors.primary : colors.border,
                    backgroundColor: addMode === 'task' ? `${colors.primary}15` : 'transparent',
                  },
                ]}
                onPress={() => setAddMode('task')}
              >
                <Feather name="list" size={13} color={addMode === 'task' ? colors.primary : colors.mutedForeground} />
                <Text style={{ fontSize: typography.sizes.xs, fontWeight: fontWeights.semibold, color: addMode === 'task' ? colors.primary : colors.mutedForeground }}>
                  Full task
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Non-owners on active jobs can still add checklist items */}
          {(addMode === 'item' ? !clReadOnly : !readOnly) && (
            <View style={styles.addRow}>
              <TextInput
                style={styles.input}
                value={newText}
                onChangeText={setNewText}
                placeholder={addMode === 'item' ? 'Add a checklist item' : 'Add a task'}
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="done"
                onSubmitEditing={addItem}
              />
              <TouchableOpacity
                style={[styles.addBtn, (!newText.trim() || adding) && { opacity: 0.5 }]}
                onPress={addItem}
                disabled={adding || !newText.trim()}
              >
                {adding ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground ?? '#fff'} />
                ) : (
                  <Feather name="plus" size={20} color={colors.primaryForeground ?? '#fff'} />
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* ── Cost edit modal (owner) ── */}
      <Modal
        visible={!!editingCostTask}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingCostTask(null)}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditingCostTask(null)}>
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <ScrollView style={styles.modalSheet} keyboardShouldPersistTaps="handled">
                <Text style={styles.modalTitle}>Task Budget: {editingCostTask?.title}</Text>

                <Text style={styles.modalFieldLabel}>Estimated Hours</Text>
                <TextInput style={styles.modalInput} value={costForm.estimatedHours} onChangeText={(v) => setCostForm((f) => ({ ...f, estimatedHours: v }))} placeholder="e.g. 4" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />

                <Text style={styles.modalFieldLabel}>Actual Hours</Text>
                <TextInput style={styles.modalInput} value={costForm.actualHours} onChangeText={(v) => setCostForm((f) => ({ ...f, actualHours: v }))} placeholder="e.g. 5.5" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />

                <Text style={styles.modalFieldLabel}>Estimated Material Cost</Text>
                <TextInput style={styles.modalInput} value={costForm.estimatedMaterialCost} onChangeText={(v) => setCostForm((f) => ({ ...f, estimatedMaterialCost: v }))} placeholder="e.g. 200" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />

                <Text style={styles.modalFieldLabel}>Actual Material Cost</Text>
                <TextInput style={styles.modalInput} value={costForm.actualMaterialCost} onChangeText={(v) => setCostForm((f) => ({ ...f, actualMaterialCost: v }))} placeholder="e.g. 240" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" />

                <View style={styles.modalRow}>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.muted }]} onPress={() => setEditingCostTask(null)}>
                    <Text style={{ color: colors.foreground, fontWeight: fontWeights.semibold }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={saveCost} disabled={savingCost}>
                    {savingCost ? <ActivityIndicator size="small" color={colors.primaryForeground ?? '#fff'} /> : <Text style={{ color: colors.primaryForeground ?? '#fff', fontWeight: fontWeights.semibold }}>Save</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Log work bottom sheet ── */}
      <Modal visible={!!logSheet} transparent animationType="slide" onRequestClose={closeLogSheet}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeLogSheet} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            {logSheet?.mode === 'hours' ? (
              <>
                <Text style={styles.sheetTitle}>Log hours</Text>
                <Text style={styles.sheetSubtitle} numberOfLines={1}>{logSheet.taskTitle}</Text>
                <View>
                  <Text style={styles.fieldLabel}>Duration (hours)</Text>
                  <TextInput style={styles.fieldInput} value={hoursInput} onChangeText={setHoursInput} placeholder="e.g. 2.5" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" returnKeyType="next" />
                </View>
                <View>
                  <Text style={styles.fieldLabel}>Description (optional)</Text>
                  <TextInput style={[styles.fieldInput, { height: 72, textAlignVertical: 'top' }]} value={hoursDesc} onChangeText={setHoursDesc} placeholder="What was done?" placeholderTextColor={colors.mutedForeground} multiline returnKeyType="done" />
                </View>
                <TouchableOpacity style={[styles.submitBtn, (!hoursInput.trim() || submitting) && { opacity: 0.5 }]} onPress={submitLogHours} disabled={!hoursInput.trim() || submitting}>
                  {submitting ? <ActivityIndicator size="small" color={colors.primaryForeground ?? '#fff'} /> : <Text style={styles.submitBtnText}>Save hours</Text>}
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
                  <TextInput style={styles.fieldInput} value={matName} onChangeText={setMatName} placeholder="e.g. Copper pipe 15mm" placeholderTextColor={colors.mutedForeground} returnKeyType="next" />
                </View>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldCol}>
                    <Text style={styles.fieldLabel}>Quantity</Text>
                    <TextInput style={styles.fieldInput} value={matQty} onChangeText={setMatQty} placeholder="1" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" returnKeyType="next" />
                  </View>
                  <View style={styles.fieldCol}>
                    <Text style={styles.fieldLabel}>Unit (optional)</Text>
                    <TextInput style={styles.fieldInput} value={matUnit} onChangeText={setMatUnit} placeholder="m, kg, pc" placeholderTextColor={colors.mutedForeground} returnKeyType="next" />
                  </View>
                </View>
                <View>
                  <Text style={styles.fieldLabel}>Unit cost ($)</Text>
                  <TextInput style={styles.fieldInput} value={matUnitCost} onChangeText={setMatUnitCost} placeholder="0.00" placeholderTextColor={colors.mutedForeground} keyboardType="decimal-pad" returnKeyType="done" />
                </View>
                <TouchableOpacity style={[styles.submitBtn, (!matName.trim() || submitting) && { opacity: 0.5 }]} onPress={submitLogMaterial} disabled={!matName.trim() || submitting}>
                  {submitting ? <ActivityIndicator size="small" color={colors.primaryForeground ?? '#fff'} /> : <Text style={styles.submitBtnText}>Save material</Text>}
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
