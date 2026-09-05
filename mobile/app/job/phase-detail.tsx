/**
 * Phase detail screen — dedicated full-screen view for a single job phase.
 * Navigate here via:
 *   router.push({ pathname: '/job/phase-detail', params: { jobId, phaseId } })
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, Animated, TextInput, Alert, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { spacing, radius, typography, fontWeights, shadows } from '../../src/lib/design-tokens';
import { TeamAvatar } from '../../src/components/TeamAvatar';
import { useUserRole } from '../../src/hooks/use-user-role';
import api, { API_URL } from '../../src/lib/api';
import { getDocumentPicker } from '../../src/lib/document-picker';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import { showToast } from '../../src/lib/toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type PhaseStatus = 'not_started' | 'in_progress' | 'complete' | 'invoiced';

interface PhaseAssignedUser {
  id: string;
  name: string;
  email?: string;
  themeColor?: string;
  isLead?: boolean;
}

interface JobPhase {
  id: string;
  jobId: string;
  phaseCode: string;
  name: string;
  description?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  bookedHours?: string | null;
  budgetedHours?: string | null;
  budgetedCost?: string | null;
  actualHours?: number | null;
  status: PhaseStatus;
  sortOrder: number;
  notes?: string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  assignedUsers?: PhaseAssignedUser[];
}

interface ChecklistItem {
  id: string;
  text: string;
  isCompleted: boolean;
  sortOrder: number;
}

interface PhaseDoc {
  id: string;
  docNumber: string;
  title: string;
  category: string;
  currentRevision: string;
  latestRevision?: { fileName: string; mimeType?: string | null; fileUrl?: string | null } | null;
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PhaseStatus, { label: string; color: string; bg: string; lightBg: string }> = {
  not_started: { label: 'Not Started', color: '#6B7280', bg: '#F3F4F6', lightBg: '#F9FAFB' },
  in_progress:  { label: 'In Progress', color: '#1E40AF', bg: '#DBEAFE', lightBg: '#EFF6FF' },
  complete:     { label: 'Complete',    color: '#065F46', bg: '#D1FAE5', lightBg: '#ECFDF5' },
  invoiced:     { label: 'Invoiced',   color: '#6D28D9', bg: '#EDE9FE', lightBg: '#F5F3FF' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d?: string | null): string | null {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' });
  } catch { return null; }
}

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

// ─── Animated progress bar ────────────────────────────────────────────────────

function AnimatedBar({ pct, color }: { pct: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: Math.min(pct, 1), duration: 600, useNativeDriver: false }).start();
  }, [pct]);
  return (
    <View style={{ height: 7, borderRadius: 4, backgroundColor: `${color}25`, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height: '100%',
          borderRadius: 4,
          backgroundColor: color,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const { colors } = useTheme();
  return (
    <View style={[{
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadows.sm,
    }, style]}>
      {children}
    </View>
  );
}

function SectionTitle({ icon, title, right }: { icon: string; title: string; right?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm }}>
        <Feather name={icon as any} size={14} color={colors.primary} />
      </View>
      <Text style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground, flex: 1 }}>
        {title}
      </Text>
      {right}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PhaseDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { jobId, phaseId } = useLocalSearchParams<{ jobId: string; phaseId: string }>();
  const { isStaff } = useUserRole();
  const isReadOnly = isStaff;

  // ── State ─────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<JobPhase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<ChecklistItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [newTaskText, setNewTaskText] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);

  const [docs, setDocs] = useState<PhaseDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const [showNotesSheet, setShowNotesSheet] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadPhase = useCallback(async () => {
    if (!jobId || !phaseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<JobPhase[]>(`/api/jobs/${jobId}/phases`);
      const found = (Array.isArray(res.data) ? res.data : []).find(p => p.id === phaseId);
      setPhase(found ?? null);
      if (!found) setError('Phase not found.');
    } catch {
      setError('Failed to load phase details.');
    } finally {
      setLoading(false);
    }
  }, [jobId, phaseId]);

  const loadTasks = useCallback(async () => {
    if (!jobId || !phaseId) return;
    setTasksLoading(true);
    try {
      const res = await api.get<ChecklistItem[]>(`/api/jobs/${jobId}/checklist?phaseId=${encodeURIComponent(phaseId)}`);
      setTasks(Array.isArray(res.data) ? [...res.data].sort((a, b) => a.sortOrder - b.sortOrder) : []);
    } catch {
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [jobId, phaseId]);

  const loadDocs = useCallback(async () => {
    if (!jobId || !phaseId) return;
    setDocsLoading(true);
    try {
      const res = await api.get<PhaseDoc[]>(`/api/jobs/${jobId}/project-documents?phaseId=${encodeURIComponent(phaseId)}`);
      setDocs(Array.isArray(res.data) ? res.data : []);
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  }, [jobId, phaseId]);

  useEffect(() => { loadPhase(); }, [loadPhase]);
  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => { loadDocs(); }, [loadDocs]);

  // ── Task actions ──────────────────────────────────────────────────────────

  const handleToggleTask = useCallback(async (item: ChecklistItem) => {
    setTogglingId(item.id);
    try {
      await api.patch(`/api/jobs/${jobId}/checklist/${item.id}`, { isCompleted: !item.isCompleted });
      setTasks(prev => prev.map(t => t.id === item.id ? { ...t, isCompleted: !t.isCompleted } : t));
    } catch {
      showToast({ type: 'error', message: 'Could not update task' });
    } finally {
      setTogglingId(null);
    }
  }, [jobId]);

  const handleAddTask = useCallback(async () => {
    const text = newTaskText.trim();
    if (!text || !phaseId) return;
    setAddingTask(true);
    try {
      const res = await api.post<ChecklistItem>(`/api/jobs/${jobId}/checklist`, { text, phaseId, isCompleted: false });
      if (!res.error && res.data) {
        setTasks(prev => [...prev, res.data!].sort((a, b) => a.sortOrder - b.sortOrder));
        setNewTaskText('');
        setShowAddTask(false);
      }
    } catch {
      showToast({ type: 'error', message: 'Could not add task' });
    } finally {
      setAddingTask(false);
    }
  }, [newTaskText, jobId, phaseId]);

  // ── Document actions ──────────────────────────────────────────────────────

  const handleAttachDoc = useCallback(async () => {
    const DocumentPicker = getDocumentPicker();
    if (!DocumentPicker) {
      Alert.alert('Update required', 'Please update the app to attach documents.');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      setUploadingDoc(true);
      const token = await api.getToken();
      const fd = new FormData();
      fd.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' } as any);
      fd.append('title', asset.name.replace(/\.[^/.]+$/, ''));
      fd.append('category', 'Other');
      fd.append('revision', 'A');
      fd.append('phaseId', phaseId!);
      const response = await fetch(`${API_URL}/api/jobs/${jobId}/project-documents`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'x-mobile-app': 'true' },
        body: fd,
      });
      if (!response.ok) throw new Error('Upload failed');
      await loadDocs();
      showToast({ type: 'success', message: 'Document attached' });
    } catch (e: any) {
      Alert.alert('Upload failed', e.message || 'Could not upload document.');
    } finally {
      setUploadingDoc(false);
    }
  }, [jobId, phaseId, loadDocs]);

  // ── Derived values ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={[styles.headerBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>Phase Detail</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  if (error || !phase) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={[styles.headerBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>Phase Detail</Text>
        </View>
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
          <Text style={{ marginTop: spacing.md, color: colors.destructive, fontSize: typography.body.fontSize, textAlign: 'center' }}>
            {error ?? 'Phase not found.'}
          </Text>
          <TouchableOpacity onPress={loadPhase} style={{ marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.md }} activeOpacity={0.8}>
            <Text style={{ color: colors.primaryForeground, fontWeight: fontWeights.semibold }}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const cfg = STATUS_CONFIG[phase.status] ?? STATUS_CONFIG.not_started;

  const phaseMembers: PhaseAssignedUser[] = phase.assignedUsers?.length
    ? phase.assignedUsers
    : phase.assignedUserId
      ? [{ id: phase.assignedUserId, name: phase.assignedUserName ?? 'Worker', isLead: true }]
      : [];

  const bookedHrs = parseFloat(phase.bookedHours ?? '0') || 0;
  const budgetedHrs = parseFloat(phase.budgetedHours ?? '0') || 0;
  const actualHrs = phase.actualHours ?? 0;
  const primaryHrsBudget = budgetedHrs > 0 ? budgetedHrs : bookedHrs > 0 ? bookedHrs : 0;
  const hrsBarPct = primaryHrsBudget > 0 ? actualHrs / primaryHrsBudget : 0;
  const hrsBarColor = hrsBarPct >= 1.0 ? '#DC2626' : hrsBarPct >= 0.85 ? '#D97706' : '#16A34A';

  const tasksDone = tasks.filter(t => t.isCompleted).length;
  const startStr = fmtDate(phase.scheduledStart);
  const endStr = fmtDate(phase.scheduledEnd);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* ── Navigation header ────────────────────────────────────────── */}
      <View style={[styles.headerBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 11, color: colors.mutedForeground, fontWeight: fontWeights.medium }}>Phase</Text>
          <Text style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.bold, color: colors.foreground }} numberOfLines={1}>
            {phase.phaseCode} · {phase.name}
          </Text>
        </View>
        {!isReadOnly && (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/job/[id]' as any, params: { id: jobId, tab: 'manage' } })}
            style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: typography.caption.fontSize, fontWeight: fontWeights.medium, color: colors.primary }}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero card ───────────────────────────────────────────────── */}
        <View style={[styles.heroCard, { backgroundColor: cfg.lightBg, borderColor: `${cfg.color}25` }]}>
          {/* Badges row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
            <View style={{ borderWidth: 1, borderColor: `${cfg.color}50`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.card }}>
              <Text style={{ fontSize: 11, fontWeight: fontWeights.bold, color: cfg.color, letterSpacing: 0.3 }}>
                {phase.phaseCode}
              </Text>
            </View>
            <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: fontWeights.semibold, color: cfg.color }}>{cfg.label}</Text>
            </View>
          </View>

          {/* Phase name */}
          <Text style={{ fontSize: 22, fontWeight: fontWeights.bold, color: colors.foreground, marginBottom: spacing.xs, lineHeight: 28 }}>
            {phase.name}
          </Text>

          {/* Date range */}
          {(startStr || endStr) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
              <Feather name="calendar" size={13} color={colors.mutedForeground} />
              <Text style={{ fontSize: typography.caption.fontSize, color: colors.mutedForeground }}>
                {startStr ?? '?'}  →  {endStr ?? '?'}
              </Text>
            </View>
          )}

          {/* Hours progress */}
          {(primaryHrsBudget > 0 || actualHrs > 0) && (
            <View style={{ marginTop: spacing.xs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Feather name="clock" size={12} color={colors.mutedForeground} />
                  <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                    {actualHrs > 0
                      ? primaryHrsBudget > 0
                        ? `${fmtHours(actualHrs)} of ${fmtHours(primaryHrsBudget)}`
                        : `${fmtHours(actualHrs)} logged`
                      : primaryHrsBudget > 0
                        ? `${fmtHours(primaryHrsBudget)} budgeted`
                        : 'No hours yet'}
                  </Text>
                </View>
                {primaryHrsBudget > 0 && actualHrs > 0 && (
                  <Text style={{ fontSize: 12, fontWeight: fontWeights.bold, color: hrsBarColor }}>
                    {Math.round(hrsBarPct * 100)}%
                  </Text>
                )}
              </View>
              {primaryHrsBudget > 0 && <AnimatedBar pct={hrsBarPct} color={hrsBarColor} />}
            </View>
          )}

          {/* Task progress pill */}
          {tasks.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
              <Feather name="check-square" size={12} color={colors.mutedForeground} />
              <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                {tasksDone} of {tasks.length} task{tasks.length !== 1 ? 's' : ''} done
              </Text>
            </View>
          )}
        </View>

        {/* ── Team ────────────────────────────────────────────────────── */}
        <Card>
          <SectionTitle icon="users" title="Team" />
          {phaseMembers.length === 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}>
              <Feather name="user-x" size={16} color={colors.mutedForeground} />
              <Text style={{ fontSize: typography.caption.fontSize, color: colors.mutedForeground }}>
                No team members assigned to this phase yet.
              </Text>
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {phaseMembers.map((member) => (
                <View key={member.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <TeamAvatar
                    name={member.name}
                    email={member.email}
                    userId={member.id}
                    themeColor={member.themeColor}
                    size={40}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                      {member.name}
                    </Text>
                    {member.isLead && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 }}>
                        <Feather name="star" size={10} color="#F59E0B" />
                        <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Phase Lead</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* ── Tasks ───────────────────────────────────────────────────── */}
        <Card>
          <SectionTitle
            icon="check-square"
            title="Tasks"
            right={
              tasks.length > 0 ? (
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, backgroundColor: colors.muted, borderRadius: radius.full }}>
                  <Text style={{ fontSize: 11, fontWeight: fontWeights.semibold, color: colors.mutedForeground }}>
                    {tasksDone}/{tasks.length}
                  </Text>
                </View>
              ) : null
            }
          />

          {tasksLoading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ fontSize: typography.caption.fontSize, color: colors.mutedForeground }}>Loading tasks...</Text>
            </View>
          ) : tasks.length === 0 && !showAddTask ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm }}>
              <Feather name="check-circle" size={28} color={colors.border} />
              <Text style={{ fontSize: typography.caption.fontSize, color: colors.mutedForeground, textAlign: 'center' }}>
                No tasks linked to this phase yet.
              </Text>
              {!isReadOnly && (
                <TouchableOpacity
                  onPress={() => setShowAddTask(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, borderStyle: 'dashed' }}
                  activeOpacity={0.7}
                >
                  <Feather name="plus" size={14} color={colors.primary} />
                  <Text style={{ fontSize: typography.caption.fontSize, fontWeight: fontWeights.medium, color: colors.primary }}>Add first task</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {tasks.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => !isReadOnly && handleToggleTask(item)}
                  style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}
                  activeOpacity={isReadOnly ? 1 : 0.7}
                >
                  <View style={{ marginTop: 2, width: 20, height: 20, borderRadius: 5, borderWidth: 2,
                    borderColor: item.isCompleted ? colors.primary : colors.border,
                    backgroundColor: item.isCompleted ? colors.primary : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {togglingId === item.id
                      ? <ActivityIndicator size="small" color={item.isCompleted ? colors.primaryForeground : colors.primary} style={{ width: 12, height: 12 }} />
                      : item.isCompleted
                        ? <Feather name="check" size={12} color={colors.primaryForeground} />
                        : null}
                  </View>
                  <Text style={{
                    flex: 1,
                    fontSize: typography.body.fontSize,
                    color: item.isCompleted ? colors.mutedForeground : colors.foreground,
                    textDecorationLine: item.isCompleted ? 'line-through' : 'none',
                    lineHeight: 22,
                  }}>
                    {item.text}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Add task input */}
              {!isReadOnly && (
                showAddTask ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
                    <TextInput
                      style={[styles.taskInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                      placeholder="Task description..."
                      placeholderTextColor={colors.mutedForeground}
                      value={newTaskText}
                      onChangeText={setNewTaskText}
                      onSubmitEditing={handleAddTask}
                      returnKeyType="done"
                      autoFocus
                      editable={!addingTask}
                    />
                    <TouchableOpacity
                      onPress={handleAddTask}
                      disabled={!newTaskText.trim() || addingTask}
                      style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: !newTaskText.trim() ? 0.5 : 1 }}
                      activeOpacity={0.8}
                    >
                      {addingTask
                        ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                        : <Feather name="check" size={16} color={colors.primaryForeground} />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setShowAddTask(false); setNewTaskText(''); }} style={{ width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }} activeOpacity={0.7}>
                      <Feather name="x" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowAddTask(true)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, marginTop: spacing.xs }}
                    activeOpacity={0.7}
                  >
                    <Feather name="plus-circle" size={14} color={colors.primary} />
                    <Text style={{ fontSize: typography.caption.fontSize, color: colors.primary, fontWeight: fontWeights.medium }}>Add task</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          )}
        </Card>

        {/* ── Documents ───────────────────────────────────────────────── */}
        <Card>
          <SectionTitle
            icon="file-text"
            title="Documents"
            right={
              !isReadOnly ? (
                <TouchableOpacity
                  onPress={handleAttachDoc}
                  disabled={uploadingDoc}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.md, backgroundColor: `${colors.primary}15` }}
                  activeOpacity={0.7}
                >
                  {uploadingDoc
                    ? <ActivityIndicator size="small" color={colors.primary} style={{ width: 14, height: 14 }} />
                    : <Feather name="paperclip" size={13} color={colors.primary} />}
                  <Text style={{ fontSize: 12, color: colors.primary, fontWeight: fontWeights.semibold }}>
                    {uploadingDoc ? 'Uploading...' : 'Attach'}
                  </Text>
                </TouchableOpacity>
              ) : null
            }
          />

          {docsLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : docs.length === 0 ? (
            <Text style={{ fontSize: typography.caption.fontSize, color: colors.mutedForeground }}>
              No documents attached to this phase yet.
            </Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {docs.map((doc) => (
                <TouchableOpacity
                  key={doc.id}
                  onPress={() => doc.latestRevision?.fileUrl
                    ? router.push({ pathname: '/job/document-viewer' as any, params: { url: doc.latestRevision.fileUrl, title: doc.title, mimeType: doc.latestRevision.mimeType ?? '' } })
                    : null}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}
                  activeOpacity={doc.latestRevision?.fileUrl ? 0.7 : 1}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: `${colors.primary}12`, alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="file-text" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.medium, color: colors.foreground }} numberOfLines={1}>
                      {doc.title}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                      {doc.docNumber} · {doc.category} · Rev {doc.currentRevision}
                    </Text>
                  </View>
                  {doc.latestRevision?.fileUrl && (
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card>

        {/* ── Notes ───────────────────────────────────────────────────── */}
        {(phase.notes || phase.description) ? (
          <Card>
            <SectionTitle icon="file" title="Notes" />
            {phase.notes ? (
              <Text style={{ fontSize: typography.body.fontSize, color: colors.foreground, lineHeight: 22, marginBottom: phase.description ? spacing.sm : 0 }}>
                {phase.notes}
              </Text>
            ) : null}
            {phase.description ? (
              <Text style={{ fontSize: typography.caption.fontSize, color: colors.mutedForeground, lineHeight: 20 }}>
                {phase.description}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {/* ── Quick actions ────────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/job/[id]' as any, params: { id: jobId } })}
            style={[styles.quickBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${colors.primary}15`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs }}>
              <Feather name="clock" size={16} color={colors.primary} />
            </View>
            <Text style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: colors.foreground }}>Log Time</Text>
            <Text style={{ fontSize: 11, color: colors.mutedForeground, textAlign: 'center', marginTop: 2 }}>Record hours</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/job/[id]' as any, params: { id: jobId } })}
            style={[styles.quickBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${colors.success}15`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs }}>
              <Feather name="dollar-sign" size={16} color={colors.success} />
            </View>
            <Text style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: colors.foreground }}>Log Expense</Text>
            <Text style={{ fontSize: 11, color: colors.mutedForeground, textAlign: 'center', marginTop: 2 }}>Add cost</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    minHeight: 56,
    ...Platform.select({ ios: { paddingTop: spacing.sm }, android: {} }),
  },
  backBtn: { padding: 4, marginRight: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  heroCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  taskInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    fontSize: typography.body.fontSize,
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    ...shadows.sm,
  },
});
