/**
 * Phase detail screen — dedicated full-screen view for a single job phase.
 * Navigate here via:
 *   router.push({ pathname: '/job/phase-detail', params: { jobId, phaseId } })
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  StyleSheet, Animated, TextInput, Alert, Platform, Pressable, KeyboardAvoidingView, } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { getNestedHeaderOptions } from '../../src/lib/nested-header';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { spacing, radius, typography, fontWeights, shadows } from '../../src/lib/design-tokens';
import { TeamAvatar } from '../../src/components/TeamAvatar';
import { SkeletonPhaseDetail } from '../../src/components/Skeleton';
import { useUserRole } from '../../src/hooks/use-user-role';
import { useTimeTrackingStore } from '../../src/lib/store';
import api, { API_URL } from '../../src/lib/api';
import { getDocumentPicker } from '../../src/lib/document-picker';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import { TimerSheet } from '../../src/components/jobDetail/TimerSheet';
import { SheetButton } from '../../src/components/ui/SheetButton';
import { PhaseTeamPicker } from '../../src/components/PhaseTeamPicker';
import { showToast } from '../../src/lib/toast';
import { shouldShowPhaseClaimPrompt } from '../../src/utils/phaseClaimPrompt';
import { MarkdownText } from '../../src/components/MarkdownText';
import { MarkdownToolbar, applyMarkdownAction } from '../../src/components/MarkdownToolbar';

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
  description?: string | null;
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

interface TimeEntry {
  id: string;
  userId?: string | null;
  userName?: string | null;
  workerName?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  duration?: number | null;   // stored in MINUTES — divide by 60 for hours
  date?: string | null;
  notes?: string | null;
  isBreak?: boolean | null;
  phaseId?: string | null;
}

interface PhaseExpense {
  id: string;
  description: string;
  amount: string | number;
  expenseDate?: string | null;
  receiptUrl?: string | null;
  status?: string | null;
  submittedByName?: string | null;
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PhaseStatus, { label: string; color: string; bg: string; lightBg: string }> = {
  not_started: { label: 'Not Started', color: '#6B7280', bg: '#E5E7EB', lightBg: '#F9FAFB' },
  in_progress:  { label: 'In Progress', color: '#1D4ED8', bg: '#DBEAFE', lightBg: '#EFF6FF' },
  complete:     { label: 'Complete',    color: '#059669', bg: '#D1FAE5', lightBg: '#ECFDF5' },
  invoiced:     { label: 'Invoiced',   color: '#7C3AED', bg: '#EDE9FE', lightBg: '#F5F3FF' },
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
    Animated.timing(anim, { toValue: Math.min(pct, 1), duration: 700, useNativeDriver: false }).start();
  }, [pct]);
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: `${color}30`, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height: '100%',
          borderRadius: 3,
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

// ─── Inline field label ───────────────────────────────────────────────────────

function FieldLabel({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: 6, marginTop: spacing.sm }}>
      {children}
    </Text>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PhaseDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { jobId, phaseId } = useLocalSearchParams<{ jobId: string; phaseId: string }>();
  const { isStaff, isOwner, isManager } = useUserRole();
  // Workers are read-only. Owners and managers have full write access.
  const isReadOnly = isStaff;

  // ── Timer store ───────────────────────────────────────────────────────────
  const { activeTimer, startTimer, stopTimer } = useTimeTrackingStore();
  const isActivePhaseTimer = !!((activeTimer as any)?.phaseId === phaseId && activeTimer?.jobId === jobId);

  // ── Phase state ───────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<JobPhase | null>(null);
  // Full phase list for the job — feeds the TimerSheet phase selector.
  const [allPhases, setAllPhases] = useState<JobPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Tasks state ───────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<ChecklistItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [addingTask, setAddingTask] = useState(false);

  // Add task modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDescSel, setNewTaskDescSel] = useState({ start: 0, end: 0 });

  // Edit description modal
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editDescSel, setEditDescSel] = useState({ start: 0, end: 0 });
  const [savingDesc, setSavingDesc] = useState(false);

  // ── Documents state ───────────────────────────────────────────────────────
  const [docs, setDocs] = useState<PhaseDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // ── Time entries state ────────────────────────────────────────────────────
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [timeEntriesLoading, setTimeEntriesLoading] = useState(false);

  // ── Phase expenses state ──────────────────────────────────────────────────
  const [phaseExpenses, setPhaseExpenses] = useState<PhaseExpense[]>([]);
  const [phaseExpensesLoading, setPhaseExpensesLoading] = useState(false);

  // ── Log Time sheet ────────────────────────────────────────────────────────
  const [showLogTimeSheet, setShowLogTimeSheet] = useState(false);
  const [timerLoading, setTimerLoading] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState('0:00');

  // ── Log Expense sheet ─────────────────────────────────────────────────────
  const [showLogExpenseSheet, setShowLogExpenseSheet] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseReceiptUri, setExpenseReceiptUri] = useState<string | null>(null);
  const [isUploadingExpenseReceipt, setIsUploadingExpenseReceipt] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);

  // ── Edit Phase sheet ──────────────────────────────────────────────────────
  const [showEditPhaseSheet, setShowEditPhaseSheet] = useState(false);
  const [editPhaseForm, setEditPhaseForm] = useState({
    phaseCode: '',
    name: '',
    description: '',
    scheduledStart: '',
    scheduledEnd: '',
    bookedHours: '',
    status: 'not_started' as PhaseStatus,
    assignedUserId: '',
    assignedUserIds: [] as string[],
  });
  const [phaseDateTarget, setPhaseDateTarget] = useState<'start' | 'end' | null>(null);
  const [isSavingEditPhase, setIsSavingEditPhase] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; email?: string; role?: string; memberId?: string; userId?: string; themeColor?: string }[]>([]);

  // ── Phase-complete claim prompt ────────────────────────────────────────────
  const [showPhaseClaimPrompt, setShowPhaseClaimPrompt] = useState(false);
  const [claimPrefillPhase, setClaimPrefillPhase] = useState<JobPhase | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadPhase = useCallback(async () => {
    if (!jobId || !phaseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<JobPhase[]>(`/api/jobs/${jobId}/phases`);
      const list = Array.isArray(res.data) ? res.data : [];
      setAllPhases(list);
      const found = list.find(p => p.id === phaseId);
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

  const loadTeamMembers = useCallback(async () => {
    try {
      const res = await api.get<any[]>('/api/team/members');
      if (Array.isArray(res.data)) setTeamMembers(res.data);
    } catch {
      // silent — team picker still works, just empty
    }
  }, []);

  const loadTimeEntries = useCallback(async () => {
    if (!jobId || !phaseId) return;
    setTimeEntriesLoading(true);
    try {
      // Secure endpoint: scopes results by role — workers see only their own entries,
      // owners/managers see all. Returns minimal DTO; duration is in minutes.
      const res = await api.get<TimeEntry[]>(
        `/api/jobs/${encodeURIComponent(jobId)}/phases/${encodeURIComponent(phaseId)}/time-entries`
      );
      setTimeEntries(Array.isArray(res.data) ? res.data : []);
    } catch {
      setTimeEntries([]);
    } finally {
      setTimeEntriesLoading(false);
    }
  }, [jobId, phaseId]);

  const loadPhaseExpenses = useCallback(async () => {
    if (!jobId || !phaseId) return;
    setPhaseExpensesLoading(true);
    try {
      // Server does not filter by phaseId query param — fetch all job expenses
      // and filter client-side to the relevant phase.
      const res = await api.get<PhaseExpense[]>(`/api/jobs/${jobId}/expenses`);
      const all = Array.isArray(res.data) ? res.data : [];
      setPhaseExpenses(all.filter((e: any) => e.phaseId === phaseId));
    } catch {
      setPhaseExpenses([]);
    } finally {
      setPhaseExpensesLoading(false);
    }
  }, [jobId, phaseId]);

  useEffect(() => { loadPhase(); }, [loadPhase]);
  useEffect(() => { loadTasks(); }, [loadTasks]);
  useEffect(() => { loadDocs(); }, [loadDocs]);
  useEffect(() => { loadTimeEntries(); }, [loadTimeEntries]);
  useEffect(() => { loadPhaseExpenses(); }, [loadPhaseExpenses]);
  useEffect(() => { if (isOwner || isManager) loadTeamMembers(); }, [loadTeamMembers, isOwner, isManager]);

  // ── Timer elapsed ticker ──────────────────────────────────────────────────

  useEffect(() => {
    const startedAt = (activeTimer as any)?.startedAt ?? activeTimer?.startTime;
    if (!isActivePhaseTimer || !startedAt) { setTimerElapsed('0:00'); return; }
    const tick = () => {
      const diff = Math.max(0, Date.now() - new Date(startedAt).getTime());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimerElapsed(
        h > 0
          ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
          : `${m}:${String(s).padStart(2, '0')}`
      );
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isActivePhaseTimer, (activeTimer as any)?.startedAt, activeTimer?.startTime]);

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
      const payload: any = { text, phaseId, isCompleted: false };
      if (newTaskDesc.trim()) payload.description = newTaskDesc.trim();
      const res = await api.post<ChecklistItem>(`/api/jobs/${jobId}/checklist`, payload);
      if (!res.error && res.data) {
        setTasks(prev => [...prev, res.data!].sort((a, b) => a.sortOrder - b.sortOrder));
        setNewTaskText('');
        setNewTaskDesc('');
        setShowAddModal(false);
      }
    } catch {
      showToast({ type: 'error', message: 'Could not add task' });
    } finally {
      setAddingTask(false);
    }
  }, [newTaskText, newTaskDesc, jobId, phaseId]);

  const handleSaveDescription = useCallback(async () => {
    if (!editingItem) return;
    setSavingDesc(true);
    try {
      const res = await api.patch<ChecklistItem>(`/api/jobs/${jobId}/checklist/${editingItem.id}`, {
        description: editDesc.trim() || null,
      });
      if (!res.error) {
        setTasks(prev => prev.map(t => t.id === editingItem.id ? { ...t, description: editDesc.trim() || null } : t));
        setEditingItem(null);
      } else {
        showToast({ type: 'error', message: 'Could not save description' });
      }
    } catch {
      showToast({ type: 'error', message: 'Could not save description' });
    } finally {
      setSavingDesc(false);
    }
  }, [editingItem, editDesc, jobId]);

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

  // ── Timer actions ─────────────────────────────────────────────────────────

  const handleStartTimer = async (selectedPhaseId?: string) => {
    if (!jobId) return;
    const targetPhaseId = selectedPhaseId ?? phaseId;
    const targetPhase = allPhases.find(p => p.id === targetPhaseId) ?? phase;
    // Another timer is running elsewhere — get explicit consent before switching,
    // matching the old sheet's "Switch to this phase" flow.
    if (activeTimer && !isActivePhaseTimer) {
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Switch timer?',
          'You have a timer running for another job or phase. Starting this one will stop it.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Switch', onPress: () => resolve(true) },
          ],
        );
      });
      if (!proceed) return;
    }
    setTimerLoading(true);
    try {
      const ok = await startTimer(jobId, targetPhase ? `Phase: ${targetPhase.name}` : 'Timer', false, targetPhaseId);
      if (ok) {
        setShowLogTimeSheet(false);
        showToast({ type: 'success', message: 'Timer started' });
      } else {
        showToast({ type: 'error', message: 'Could not start timer. Stop any active timer first.' });
      }
    } catch {
      showToast({ type: 'error', message: 'Could not start timer' });
    } finally {
      setTimerLoading(false);
    }
  };

  const handleStopTimer = async () => {
    setTimerLoading(true);
    try {
      await stopTimer();
      setShowLogTimeSheet(false);
      showToast({ type: 'success', message: 'Timer stopped and hours logged' });
      // Refresh both the phase (actualHours) and the time entry list
      loadTimeEntries();
      loadPhase();
    } catch {
      showToast({ type: 'error', message: 'Could not stop timer' });
    } finally {
      setTimerLoading(false);
    }
  };

  // ── Expense actions ───────────────────────────────────────────────────────

  const handleLogExpense = async () => {
    const parsed = parseFloat(expenseAmount.replace(/[^0-9.]/g, ''));
    if (!parsed || parsed <= 0) {
      showToast({ type: 'error', message: 'Enter a valid dollar amount' });
      return;
    }
    if (!expenseDescription.trim()) {
      showToast({ type: 'error', message: 'Description is required' });
      return;
    }
    setSavingExpense(true);
    try {
      const body: Record<string, any> = {
        description: expenseDescription.trim(),
        amount: String(parsed),
        expenseDate: new Date().toISOString().split('T')[0],
        isBillable: true,
        categoryId: '_worker_receipt_',
        phaseId,
      };
      if (expenseReceiptUri) body.receiptUrl = expenseReceiptUri;
      const res = await api.post(`/api/jobs/${jobId}/expenses`, body);
      if (res.error) throw new Error(res.error);
      setShowLogExpenseSheet(false);
      setExpenseAmount('');
      setExpenseDescription('');
      setExpenseReceiptUri(null);
      showToast({ type: 'success', message: 'Expense logged', description: 'Sent to owner for approval.' });
      loadPhaseExpenses();
    } catch (err: any) {
      showToast({ type: 'error', message: 'Could not log expense', description: err?.message });
    } finally {
      setSavingExpense(false);
    }
  };

  const pickExpenseReceipt = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { showToast({ type: 'error', message: 'Camera permission required' }); return; }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { showToast({ type: 'error', message: 'Photo library permission required' }); return; }
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setIsUploadingExpenseReceipt(true);
    try {
      const token = await api.getToken();
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, name: asset.fileName || `receipt-${Date.now()}.jpg`, type: asset.mimeType || 'image/jpeg' } as any);
      formData.append('type', 'expense-receipt');
      const uploadRes = await fetch(`${API_URL}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
      const json = await uploadRes.json();
      if (json.url) setExpenseReceiptUri(json.url.startsWith('/') ? `${API_URL}${json.url}` : json.url);
      else showToast({ type: 'error', message: 'Upload failed' });
    } catch { showToast({ type: 'error', message: 'Upload failed' }); } finally { setIsUploadingExpenseReceipt(false); }
  };

  // ── Edit Phase actions ────────────────────────────────────────────────────

  const openEditPhaseSheet = useCallback(() => {
    if (!phase) return;
    setEditPhaseForm({
      phaseCode: phase.phaseCode ?? '',
      name: phase.name,
      description: phase.description ?? '',
      scheduledStart: phase.scheduledStart ?? '',
      scheduledEnd: phase.scheduledEnd ?? '',
      bookedHours: phase.bookedHours ?? '',
      status: phase.status,
      assignedUserId: phase.assignedUserId ?? '',
      assignedUserIds: phase.assignedUsers?.map(u => u.id) ?? (phase.assignedUserId ? [phase.assignedUserId] : []),
    });
    setPhaseDateTarget(null);
    setShowEditPhaseSheet(true);
  }, [phase]);

  const handleUpdatePhase = async () => {
    if (!phase || !editPhaseForm.name.trim()) {
      showToast({ type: 'error', message: 'Phase name is required' });
      return;
    }
    setIsSavingEditPhase(true);
    try {
      const payload: Record<string, any> = {
        phaseCode: editPhaseForm.phaseCode.trim().toUpperCase() || phase.phaseCode,
        name: editPhaseForm.name.trim(),
        description: editPhaseForm.description.trim() || null,
        scheduledStart: editPhaseForm.scheduledStart.trim() || null,
        scheduledEnd: editPhaseForm.scheduledEnd.trim() || null,
        bookedHours: editPhaseForm.bookedHours.trim() ? editPhaseForm.bookedHours.trim() : null,
        status: editPhaseForm.status,
        assignedUserId: editPhaseForm.assignedUserId || null,
        assignedUserIds: editPhaseForm.assignedUserIds,
      };
      const savedStatus = editPhaseForm.status;
      const savedPhase = phase;
      const res = await api.patch(`/api/jobs/${jobId}/phases/${phase.id}`, payload);
      if (res.error) throw new Error(res.error);
      setShowEditPhaseSheet(false);
      showToast({ type: 'success', message: 'Phase updated' });
      await loadPhase();
      // Prompt when transitioning to complete (fresh or re-completion after re-open)
      if (shouldShowPhaseClaimPrompt({ previousStatus: savedPhase.status, newStatus: savedStatus, isOwner, isManager })) {
        setClaimPrefillPhase(savedPhase);
        setShowPhaseClaimPrompt(true);
      }
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message || 'Failed to update phase' });
    } finally {
      setIsSavingEditPhase(false);
    }
  };

  // ── Loading / error states ────────────────────────────────────────────────

  // Shared back-only header options for loading/error states — prevents stale
  // edit button showing while data hasn't loaded yet.
  const backOnlyHeader = {
    ...getNestedHeaderOptions(),
    title: '',
    headerBackVisible: false,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.primary,
    headerRight: () => null,
    headerLeft: () => (
      <Pressable
        onPress={() => router.back()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{ flexDirection: 'row', alignItems: 'center' }}
      >
        <Feather name="chevron-left" size={17} color={colors.primary} />
        <Text style={{ fontSize: typography.subtitle.fontSize, color: colors.primary, marginLeft: -1 }}>Back</Text>
      </Pressable>
    ),
  };

  if (loading) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <Stack.Screen options={backOnlyHeader} />
        <SkeletonPhaseDetail />
      </View>
    );
  }

  if (error || !phase) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <Stack.Screen options={backOnlyHeader} />
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

  // ── Derived values ─────────────────────────────────────────────────────────

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

      {/* Native stack header — same pattern as job [id].tsx */}
      <Stack.Screen
        options={{
          ...getNestedHeaderOptions(),
          title: '',
          headerBackVisible: false,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <Feather name="chevron-left" size={17} color={colors.primary} />
              <Text style={{ fontSize: typography.subtitle.fontSize, color: colors.primary, marginLeft: -1 }}>Back</Text>
            </Pressable>
          ),
          headerRight: () => (isOwner || isManager) ? (
            <Pressable
              onPress={openEditPhaseSheet}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={{ width: 32, height: 30, alignItems: 'center', justifyContent: 'center' }}
            >
              <Feather name="edit-2" size={18} color={colors.primary} />
            </Pressable>
          ) : null,
        }}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Hero banner — full bleed, status-coloured ─────────────── */}
        <View style={[styles.heroBanner, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>

          {/* Badge row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 14 }}>
            {phase.phaseCode ? (
              <View style={{ borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: colors.card, borderWidth: 1, borderColor: cfg.color + '50' }}>
                <Text style={{ fontSize: 11, fontWeight: fontWeights.bold, color: cfg.color, letterSpacing: 0.5 }}>
                  {phase.phaseCode}
                </Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: cfg.color + '22' }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: cfg.color }} />
              <Text style={{ fontSize: 12, fontWeight: fontWeights.semibold, color: cfg.color }}>{cfg.label}</Text>
            </View>
            {isActivePhaseTimer && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#DC262622' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#DC2626' }} />
                <Text style={{ fontSize: 12, fontWeight: fontWeights.semibold, color: '#DC2626' }}>{timerElapsed}</Text>
              </View>
            )}
          </View>

          {/* Phase name — large */}
          <Text style={{ fontSize: 26, fontWeight: fontWeights.bold, color: colors.foreground, lineHeight: 32, marginBottom: 12 }}>
            {phase.name}
          </Text>

          {/* Date range */}
          {(startStr || endStr) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: primaryHrsBudget > 0 || actualHrs > 0 ? 14 : 6 }}>
              <Feather name="calendar" size={13} color={colors.mutedForeground} />
              <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
                {startStr && endStr ? `${startStr} – ${endStr}` : startStr ?? endStr}
              </Text>
            </View>
          )}

          {/* Hours progress bar */}
          {(primaryHrsBudget > 0 || actualHrs > 0) && (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
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

          {/* Task summary row */}
          {tasks.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Feather name="check-square" size={12} color={colors.mutedForeground} />
                <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                  {tasksDone}/{tasks.length} task{tasks.length !== 1 ? 's' : ''} done
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: spacing.md }}>

          {/* ── Instructions (phase description + notes) ──────────────── */}
          {(!!phase.description || !!phase.notes) && (
            <Card>
              <SectionTitle icon="file-text" title="Instructions" />
              {!!phase.description && (
                <MarkdownText style={{ marginTop: 2 }}>{phase.description}</MarkdownText>
              )}
              {!!phase.notes && (
                <View style={{ marginTop: phase.description ? spacing.sm : 2 }}>
                  {!!phase.description && (
                    <View style={{ height: 1, backgroundColor: colors.border, marginBottom: spacing.sm }} />
                  )}
                  <Text style={{ fontSize: 13, color: colors.foreground, lineHeight: 20 }}>
                    {phase.notes}
                  </Text>
                </View>
              )}
            </Card>
          )}

          {/* ── Team ──────────────────────────────────────────────────── */}
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

          {/* ── Tasks ─────────────────────────────────────────────────── */}
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
            ) : tasks.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm }}>
                <Feather name="check-circle" size={28} color={colors.border} />
                <Text style={{ fontSize: typography.caption.fontSize, color: colors.mutedForeground, textAlign: 'center' }}>
                  No tasks linked to this phase yet.
                </Text>
                {!isReadOnly && (
                  <TouchableOpacity
                    onPress={() => { setNewTaskText(''); setNewTaskDesc(''); setShowAddModal(true); }}
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
                  <View key={item.id}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                      <TouchableOpacity
                        onPress={() => !isReadOnly && handleToggleTask(item)}
                        style={{ marginTop: 2, width: 20, height: 20, borderRadius: 5, borderWidth: 2,
                          borderColor: item.isCompleted ? colors.primary : colors.border,
                          backgroundColor: item.isCompleted ? colors.primary : 'transparent',
                          alignItems: 'center', justifyContent: 'center',
                        }}
                        activeOpacity={isReadOnly ? 1 : 0.7}
                        hitSlop={8}
                      >
                        {togglingId === item.id
                          ? <ActivityIndicator size="small" color={item.isCompleted ? colors.primaryForeground : colors.primary} style={{ width: 12, height: 12 }} />
                          : item.isCompleted
                            ? <Feather name="check" size={12} color={colors.primaryForeground} />
                            : null}
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <Text style={{
                          fontSize: typography.body.fontSize,
                          color: item.isCompleted ? colors.mutedForeground : colors.foreground,
                          textDecorationLine: item.isCompleted ? 'line-through' : 'none',
                          lineHeight: 22,
                        }}>
                          {item.text}
                        </Text>
                        {!!item.description && (
                          <MarkdownText style={{ marginTop: 3 }}>
                            {item.description}
                          </MarkdownText>
                        )}
                      </View>
                      {!isReadOnly && (
                        <TouchableOpacity
                          onPress={() => { setEditingItem(item); setEditDesc(item.description ?? ''); setEditDescSel({ start: 0, end: 0 }); }}
                          hitSlop={8}
                          style={{ paddingTop: 2 }}
                        >
                          <Feather name="file-text" size={15} color={item.description ? colors.primary : colors.border} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}

                {/* Add task button */}
                {!isReadOnly && (
                  <TouchableOpacity
                    onPress={() => { setNewTaskText(''); setNewTaskDesc(''); setShowAddModal(true); }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, marginTop: spacing.xs }}
                    activeOpacity={0.7}
                  >
                    <Feather name="plus-circle" size={14} color={colors.primary} />
                    <Text style={{ fontSize: typography.caption.fontSize, color: colors.primary, fontWeight: fontWeights.medium }}>Add task</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Card>

          {/* ── Documents ─────────────────────────────────────────────── */}
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

          {/* ── Time Logged ───────────────────────────────────────────── */}
          <Card>
            <SectionTitle
              icon="clock"
              title="Time Logged"
              right={
                isActivePhaseTimer ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: '#DC262618' }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#DC2626' }} />
                    <Text style={{ fontSize: 12, fontWeight: fontWeights.semibold, color: '#DC2626' }}>{timerElapsed}</Text>
                  </View>
                ) : null
              }
            />

            {timeEntriesLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start' }} />
            ) : timeEntries.length === 0 ? (
              <Text style={{ fontSize: typography.caption.fontSize, color: colors.mutedForeground, marginBottom: spacing.sm }}>
                No time logged for this phase yet.
              </Text>
            ) : (
              <View style={{ gap: 1, marginBottom: spacing.sm }}>
                {timeEntries.map((entry) => {
                  // duration is stored in minutes; convert to hours for display
                  const hrs = (entry.duration ?? 0) / 60;
                  const name = entry.userName ?? entry.workerName ?? 'Worker';
                  const dateStr = entry.date
                    ? fmtDate(entry.date)
                    : entry.startTime
                      ? fmtDate(entry.startTime)
                      : null;
                  return (
                    <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                      <Text style={{ flex: 1, fontSize: 13, color: colors.foreground }}>{name}</Text>
                      <Text style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: colors.foreground, marginRight: spacing.md }}>{fmtHours(hrs)}</Text>
                      {dateStr ? <Text style={{ fontSize: 12, color: colors.mutedForeground, minWidth: 60, textAlign: 'right' }}>{dateStr}</Text> : null}
                    </View>
                  );
                })}
                {/* Total row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 8 }}>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: fontWeights.semibold, color: colors.foreground }}>Total</Text>
                  <Text style={{ fontSize: 13, fontWeight: fontWeights.bold, color: colors.primary }}>
                    {fmtHours(timeEntries.reduce((sum, e) => sum + (e.duration ?? 0) / 60, 0))}
                  </Text>
                </View>
              </View>
            )}

            {/* Log Time CTA */}
            <TouchableOpacity
              onPress={() => setShowLogTimeSheet(true)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: 11, borderRadius: radius.md, borderWidth: 1, borderColor: isActivePhaseTimer ? '#DC2626' : colors.primary, backgroundColor: isActivePhaseTimer ? '#DC262610' : `${colors.primary}10` }}
              activeOpacity={0.7}
            >
              {isActivePhaseTimer
                ? <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#DC2626' }} />
                : <Feather name="play" size={13} color={colors.primary} />}
              <Text style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: isActivePhaseTimer ? '#DC2626' : colors.primary }}>
                {isActivePhaseTimer ? 'Stop Timer' : 'Log Time'}
              </Text>
            </TouchableOpacity>
          </Card>

          {/* ── Expenses ──────────────────────────────────────────────── */}
          <Card>
            <SectionTitle icon="dollar-sign" title="Expenses" />

            {phaseExpensesLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start' }} />
            ) : phaseExpenses.length === 0 ? (
              <Text style={{ fontSize: typography.caption.fontSize, color: colors.mutedForeground, marginBottom: spacing.sm }}>
                No expenses logged for this phase yet.
              </Text>
            ) : (
              <View style={{ gap: 1, marginBottom: spacing.sm }}>
                {phaseExpenses.map((expense) => {
                  const amt = typeof expense.amount === 'number' ? expense.amount : parseFloat(expense.amount) || 0;
                  return (
                    <View key={expense.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm }}>
                      {expense.receiptUrl ? (
                        <Image source={{ uri: expense.receiptUrl }} style={{ width: 36, height: 36, borderRadius: radius.sm }} />
                      ) : (
                        <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: `${colors.primary}12`, alignItems: 'center', justifyContent: 'center' }}>
                          <Feather name="dollar-sign" size={16} color={colors.primary} />
                        </View>
                      )}
                      <Text style={{ flex: 1, fontSize: 13, color: colors.foreground }} numberOfLines={1}>{expense.description}</Text>
                      <Text style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: colors.foreground }}>${amt.toFixed(2)}</Text>
                    </View>
                  );
                })}
                {/* Total row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 8 }}>
                  <Text style={{ flex: 1, fontSize: 13, fontWeight: fontWeights.semibold, color: colors.foreground }}>Total</Text>
                  <Text style={{ fontSize: 13, fontWeight: fontWeights.bold, color: colors.foreground }}>
                    ${phaseExpenses.reduce((sum, e) => sum + (typeof e.amount === 'number' ? e.amount : parseFloat(e.amount) || 0), 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            )}

            {/* Log Expense CTA */}
            <TouchableOpacity
              onPress={() => setShowLogExpenseSheet(true)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: 11, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, backgroundColor: `${colors.primary}10` }}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={13} color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: colors.primary }}>Log Expense</Text>
            </TouchableOpacity>
          </Card>

          {/* ── Footer summary row ────────────────────────────────────── */}
          {(timeEntries.length > 0 || phaseExpenses.length > 0) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
              <Feather name="clock" size={14} color={colors.mutedForeground} />
              <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: fontWeights.semibold }}>
                {fmtHours(timeEntries.reduce((sum, e) => sum + (e.duration ?? 0) / 60, 0))} logged
              </Text>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
              <Feather name="dollar-sign" size={14} color={colors.mutedForeground} />
              <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: fontWeights.semibold }}>
                ${phaseExpenses.reduce((sum, e) => sum + (typeof e.amount === 'number' ? e.amount : parseFloat(e.amount) || 0), 0).toFixed(2)} in expenses
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Log Time ──────────────────────────────────────────────────────
          Active phase timer → compact stop sheet. Otherwise → the shared
          TimerSheet (live timer + manual entry), same as the job screen. */}
      {isActivePhaseTimer ? (
        <AppBottomSheet
          visible={showLogTimeSheet}
          onDismiss={() => { if (!timerLoading) setShowLogTimeSheet(false); }}
          title="Log Time"
          showCloseButton
          snapPoints={['40%']}
        >
          <View style={{ padding: spacing.md, gap: spacing.md }}>
            <View style={{ alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#DC262618', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: '#DC2626' }} />
              </View>
              <Text style={{ fontSize: 32, fontWeight: fontWeights.bold, color: '#DC2626', fontVariant: ['tabular-nums'] as any }}>
                {timerElapsed}
              </Text>
              <Text style={{ fontSize: 13, color: colors.mutedForeground }}>Timer running for {phase.name}</Text>
            </View>
            <TouchableOpacity
              onPress={handleStopTimer}
              disabled={timerLoading}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: 14, borderRadius: radius.lg, backgroundColor: '#DC2626', opacity: timerLoading ? 0.6 : 1 }}
              activeOpacity={0.8}
            >
              {timerLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Feather name="square" size={15} color="#fff" />}
              <Text style={{ fontSize: 15, fontWeight: fontWeights.semibold, color: '#fff' }}>Stop Timer</Text>
            </TouchableOpacity>
          </View>
        </AppBottomSheet>
      ) : (
        <TimerSheet
          visible={showLogTimeSheet}
          onDismiss={() => setShowLogTimeSheet(false)}
          colors={colors}
          jobId={jobId!}
          phases={allPhases.map((p) => ({ id: p.id, name: p.name, phaseCode: p.phaseCode ?? null }))}
          initialPhaseId={phaseId}
          hasActiveTimer={!!activeTimer}
          onStartLiveTimer={(selectedPhaseId) => { handleStartTimer(selectedPhaseId); }}
          onManualEntrySaved={() => { loadTimeEntries(); loadPhase(); }}
        />
      )}

      {/* ── Log Expense bottom sheet ──────────────────────────────────── */}
      <AppBottomSheet
        visible={showLogExpenseSheet}
        onDismiss={() => { if (!savingExpense) { setShowLogExpenseSheet(false); setExpenseAmount(''); setExpenseDescription(''); setExpenseReceiptUri(null); } }}
        title="Log Expense"
        showCloseButton
        snapPoints={['85%']}
        footer={(
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => { setShowLogExpenseSheet(false); setExpenseAmount(''); setExpenseDescription(''); setExpenseReceiptUri(null); }}
              disabled={savingExpense}
              style={{ flex: 1, paddingVertical: 13, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 15, fontWeight: fontWeights.medium, color: colors.foreground }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogExpense}
              disabled={savingExpense || !expenseAmount.trim() || !expenseDescription.trim()}
              style={{ flex: 2, paddingVertical: 13, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: (savingExpense || !expenseAmount.trim() || !expenseDescription.trim()) ? 0.5 : 1 }}
              activeOpacity={0.8}
            >
              {savingExpense
                ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                : <Text style={{ fontSize: 15, fontWeight: fontWeights.semibold, color: colors.primaryForeground }}>Log Expense</Text>}
            </TouchableOpacity>
          </View>
        )}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ padding: spacing.md, gap: spacing.md }}>

            {/* Receipt photo */}
            <View>
              <Text style={{ fontSize: typography.caption.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: spacing.xs }}>
                Receipt Photo <Text style={{ fontWeight: fontWeights.regular as any, color: colors.mutedForeground }}>(optional)</Text>
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 10, backgroundColor: colors.card, opacity: isUploadingExpenseReceipt ? 0.6 : 1 }}
                  activeOpacity={0.7}
                  disabled={isUploadingExpenseReceipt || savingExpense}
                  onPress={() => pickExpenseReceipt('camera')}
                >
                  {isUploadingExpenseReceipt
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <><Feather name="camera" size={14} color={colors.primary} /><Text style={{ fontSize: 12, fontWeight: fontWeights.medium as any, color: colors.primary }}>Take Photo</Text></>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 10, backgroundColor: colors.card, opacity: isUploadingExpenseReceipt ? 0.6 : 1 }}
                  activeOpacity={0.7}
                  disabled={isUploadingExpenseReceipt || savingExpense}
                  onPress={() => pickExpenseReceipt('library')}
                >
                  <Feather name="image" size={14} color={colors.primary} />
                  <Text style={{ fontSize: 12, fontWeight: fontWeights.medium as any, color: colors.primary }}>Choose Photo</Text>
                </TouchableOpacity>
              </View>
              {expenseReceiptUri && (
                <View style={{ marginTop: spacing.sm }}>
                  <Image source={{ uri: expenseReceiptUri }} style={{ width: '100%', height: 130, borderRadius: radius.md }} />
                  <TouchableOpacity
                    onPress={() => setExpenseReceiptUri(null)}
                    style={{ position: 'absolute', top: 6, right: 6, backgroundColor: colors.destructive, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}
                    accessibilityRole="button"
                    accessibilityLabel="Remove receipt photo"
                  >
                    <Feather name="x" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: typography.caption.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>Amount ($) *</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={expenseAmount}
                onChangeText={setExpenseAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.mutedForeground}
                editable={!savingExpense}
              />
            </View>

            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontSize: typography.caption.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>Description *</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                value={expenseDescription}
                onChangeText={setExpenseDescription}
                placeholder="e.g. Electrical fittings from Bunnings"
                placeholderTextColor={colors.mutedForeground}
                editable={!savingExpense}
                returnKeyType="done"
              />
            </View>

            {/* Phase context chip */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: `${colors.primary}10` }}>
              <Feather name="layers" size={13} color={colors.primary} />
              <Text style={{ fontSize: 12, color: colors.primary }}>
                Linked to: {phase.phaseCode ? `${phase.phaseCode} — ` : ''}{phase.name}
              </Text>
            </View>

            {/* Info note */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: `${colors.warning}15` }}>
              <Feather name="info" size={13} color={colors.warning} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 12, color: colors.mutedForeground, lineHeight: 18 }}>
                This expense will be sent to the owner for review and approval.
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </AppBottomSheet>

      {/* ── Edit Phase bottom sheet ──────────────────────────────────── */}
      <AppBottomSheet
        visible={showEditPhaseSheet}
        onDismiss={() => { if (!isSavingEditPhase) { setShowEditPhaseSheet(false); setPhaseDateTarget(null); } }}
        title="Edit Phase"
        showCloseButton
        snapPoints={['85%']}
        footer={(
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <SheetButton
              variant="outline"
              label="Cancel"
              onPress={() => { setShowEditPhaseSheet(false); setPhaseDateTarget(null); }}
              style={{ flex: 1 }}
            />
            <SheetButton
              onPress={handleUpdatePhase}
              loading={isSavingEditPhase}
              disabled={isSavingEditPhase || !editPhaseForm.name.trim()}
              label="Save Changes"
              style={{ flex: 1 }}
            />
          </View>
        )}
      >
        <View style={{ padding: spacing.md }}>
          {/* Phase Code */}
          <Text style={[styles.formLabel, { color: colors.foreground }]}>Phase Code</Text>
          <TextInput
            style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background, marginBottom: spacing.lg }]}
            placeholderTextColor={colors.mutedForeground}
            value={editPhaseForm.phaseCode}
            onChangeText={(t) => setEditPhaseForm(f => ({ ...f, phaseCode: t.toUpperCase() }))}
            maxLength={20}
            autoCapitalize="characters"
          />

          {/* Name */}
          <Text style={[styles.formLabel, { color: colors.foreground }]}>Name *</Text>
          <TextInput
            style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background, marginBottom: spacing.lg }]}
            placeholder="e.g. Foundation, Framing, Fit-out"
            placeholderTextColor={colors.mutedForeground}
            value={editPhaseForm.name}
            onChangeText={(t) => setEditPhaseForm(f => ({ ...f, name: t }))}
          />

          {/* Date range */}
          <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
            {(['start', 'end'] as const).map((field) => {
              const iso = field === 'start' ? editPhaseForm.scheduledStart : editPhaseForm.scheduledEnd;
              const isActive = phaseDateTarget === field;
              return (
                <View key={field} style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: colors.foreground }]}>{field === 'start' ? 'Start Date' : 'End Date'}</Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setPhaseDateTarget(isActive ? null : field)}
                    style={[styles.formInput, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48, borderColor: isActive ? colors.primary : colors.border, backgroundColor: colors.background }]}
                  >
                    <Text style={{ fontSize: 14, color: iso ? colors.foreground : colors.mutedForeground }} numberOfLines={1}>
                      {iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Set date'}
                    </Text>
                    <Feather name="calendar" size={14} color={isActive ? colors.primary : colors.mutedForeground} />
                  </TouchableOpacity>
                  {isActive && (
                    <DateTimePicker
                      value={iso ? new Date(iso) : new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'compact' : 'default'}
                      onChange={(event, date) => {
                        if (Platform.OS !== 'ios') setPhaseDateTarget(null);
                        if (event.type !== 'dismissed' && date) {
                          setEditPhaseForm(f => ({ ...f, [field === 'start' ? 'scheduledStart' : 'scheduledEnd']: date.toISOString() }));
                        }
                      }}
                      style={{ alignSelf: 'flex-start', marginTop: 4 }}
                    />
                  )}
                </View>
              );
            })}
          </View>

          {/* Booked Hours */}
          <Text style={[styles.formLabel, { color: colors.foreground }]}>Booked Hours</Text>
          <TextInput
            style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background, marginBottom: spacing.lg }]}
            placeholder="e.g. 40"
            placeholderTextColor={colors.mutedForeground}
            value={editPhaseForm.bookedHours}
            onChangeText={(t) => setEditPhaseForm(f => ({ ...f, bookedHours: t }))}
            keyboardType="decimal-pad"
          />

          {/* Status */}
          <Text style={[styles.formLabel, { color: colors.foreground }]}>Status</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
            {(['not_started', 'in_progress', 'complete', 'invoiced'] as PhaseStatus[]).map((s) => {
              const labels: Record<PhaseStatus, string> = { not_started: 'Not Started', in_progress: 'In Progress', complete: 'Complete', invoiced: 'Invoiced' };
              const isSelected = editPhaseForm.status === s;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setEditPhaseForm(f => ({ ...f, status: s }))}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: radius.full,
                    borderWidth: 1.5,
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary : colors.card,
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 13, fontWeight: isSelected ? fontWeights.semibold : fontWeights.regular, color: isSelected ? colors.primaryForeground : colors.foreground }}>
                    {labels[s]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Description */}
          <Text style={[styles.formLabel, { color: colors.foreground }]}>Description</Text>
          <TextInput
            style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background, height: 72, textAlignVertical: 'top' as any, paddingTop: 10, marginBottom: spacing.lg }]}
            placeholder="Optional notes about this phase"
            placeholderTextColor={colors.mutedForeground}
            value={editPhaseForm.description}
            onChangeText={(t) => setEditPhaseForm(f => ({ ...f, description: t }))}
            multiline
            numberOfLines={3}
          />

          {/* Team */}
          <PhaseTeamPicker
            selectedIds={editPhaseForm.assignedUserIds}
            teamMembers={teamMembers}
            onChange={(assignedUserIds) => setEditPhaseForm(f => ({ ...f, assignedUserIds, assignedUserId: assignedUserIds[0] || '' }))}
            onManageTeam={() => { setShowEditPhaseSheet(false); router.push('/more/team-management' as any); }}
            testID="phase-detail-edit-team"
          />
        </View>
      </AppBottomSheet>


      {/* ── Add task sheet ─────────────────────────────────────────────── */}
      <AppBottomSheet
        visible={showAddModal}
        onDismiss={() => { setShowAddModal(false); setNewTaskText(''); setNewTaskDesc(''); }}
        title="Add task"
        showCloseButton
        snapPoints={['75%']}
        footer={(
          <SheetButton
            label="Add task"
            onPress={handleAddTask}
            disabled={!newTaskText.trim() || addingTask}
            loading={addingTask}
          />
        )}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
          {/* Title field */}
          <View>
            <Text style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: 6 }}>Task title</Text>
            <TextInput
              style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card }]}
              placeholder="e.g. Install safety barrier"
              placeholderTextColor={colors.mutedForeground}
              value={newTaskText}
              onChangeText={setNewTaskText}
              autoFocus
              returnKeyType="next"
              editable={!addingTask}
            />
          </View>

          {/* Description field with markdown toolbar */}
          <View>
            <Text style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: 6 }}>Description (optional)</Text>
            <MarkdownToolbar
              value={newTaskDesc}
              selection={newTaskDescSel}
              onChange={setNewTaskDesc}
            />
            <TextInput
              style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card, height: 140, textAlignVertical: 'top', paddingTop: 10, borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}
              placeholder="Add step-by-step instructions, headings, or bullet points..."
              placeholderTextColor={colors.mutedForeground}
              value={newTaskDesc}
              onChangeText={setNewTaskDesc}
              onSelectionChange={e => setNewTaskDescSel(e.nativeEvent.selection)}
              multiline
              editable={!addingTask}
            />
          </View>
        </ScrollView>
      </AppBottomSheet>

      {/* ── Edit description sheet ─────────────────────────────────────── */}
      <AppBottomSheet
        visible={!!editingItem}
        onDismiss={() => setEditingItem(null)}
        title={editingItem?.text ?? 'Description'}
        showCloseButton
        snapPoints={['85%']}
        footer={(
          <View style={{ gap: spacing.sm }}>
            <SheetButton
              label="Save description"
              onPress={handleSaveDescription}
              disabled={savingDesc}
              loading={savingDesc}
            />
            {!!editDesc.trim() && (
              <TouchableOpacity
                onPress={() => setEditDesc('')}
                style={{ alignItems: 'center', paddingVertical: spacing.sm }}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.destructive, fontSize: 14 }}>Clear description</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.md }}>
          <Text style={{ fontSize: 13, fontWeight: fontWeights.semibold, color: colors.foreground, marginBottom: 6 }}>Description</Text>
          <MarkdownToolbar
            value={editDesc}
            selection={editDescSel}
            onChange={setEditDesc}
          />
          <TextInput
            style={[styles.formInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card, height: 200, textAlignVertical: 'top', paddingTop: 10, borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}
            placeholder="Add headings, bullet points, numbered steps..."
            placeholderTextColor={colors.mutedForeground}
            value={editDesc}
            onChangeText={setEditDesc}
            onSelectionChange={e => setEditDescSel(e.nativeEvent.selection)}
            multiline
            autoFocus
            editable={!savingDesc}
          />
          {!!editDesc.trim() && (
            <View style={{ marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.muted, borderRadius: radius.md }}>
              <Text style={{ fontSize: 11, fontWeight: fontWeights.semibold, color: colors.mutedForeground, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Preview</Text>
              <MarkdownText>{editDesc}</MarkdownText>
            </View>
          )}
        </ScrollView>
      </AppBottomSheet>

      {/* Phase-complete → create claim prompt (owners/managers only) */}
      <AppBottomSheet
        visible={showPhaseClaimPrompt}
        onDismiss={() => { setShowPhaseClaimPrompt(false); setClaimPrefillPhase(null); }}
        title="Phase complete"
        showCloseButton
        snapPoints={['40%']}
        footer={(
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <SheetButton
              variant="outline"
              label="Skip"
              onPress={() => { setShowPhaseClaimPrompt(false); setClaimPrefillPhase(null); }}
              style={{ flex: 1 }}
            />
            <SheetButton
              label={`Draft Claim for ${claimPrefillPhase?.name ?? 'Phase'}`}
              onPress={() => {
                setShowPhaseClaimPrompt(false);
                router.push({
                  pathname: '/job/[id]' as any,
                  params: { id: jobId, action: 'addClaim', _claimPhaseId: claimPrefillPhase?.id ?? '' },
                });
              }}
              style={{ flex: 1 }}
            />
          </View>
        )}
      >
        <View style={{ paddingVertical: spacing.sm }}>
          <Text style={{ fontSize: typography.body.fontSize, color: colors.mutedForeground, lineHeight: 22 }}>
            <Text style={{ color: colors.foreground, fontWeight: fontWeights.semibold }}>
              {claimPrefillPhase?.phaseCode} {claimPrefillPhase?.name}
            </Text>
            {' '}is now complete. Would you like to raise a progress claim for this phase?
          </Text>
        </View>
      </AppBottomSheet>

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
  heroBanner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.fontSize,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: fontWeights.semibold as any,
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.body.fontSize,
    height: 44,
  },
});
