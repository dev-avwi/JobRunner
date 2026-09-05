/**
 * Phase detail screen — dedicated full screen for a single job phase.
 * Accessible to workers (read-only) and owners/managers (can navigate to edit).
 *
 * Route params: jobId, phaseId
 * Navigate here via router.push({ pathname: '/job/phase-detail', params: { jobId, phaseId } })
 */
import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Linking, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { spacing, radius, typography, fontWeights } from '../../src/lib/design-tokens';
import { TeamAvatar } from '../../src/components/TeamAvatar';
import { useUserRole } from '../../src/hooks/use-user-role';
import api, { API_URL } from '../../src/lib/api';
import { getDocumentPicker } from '../../src/lib/document-picker';

// ─── Types ────────────────────────────────────────────────────────────────────
type PhaseStatus = 'not_started' | 'in_progress' | 'complete' | 'invoiced';

interface PhaseAssignedUser {
  id: string;
  name: string;
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
  actualHours?: number | null;
  status: PhaseStatus;
  sortOrder: number;
  notes?: string | null;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  assignedUsers?: PhaseAssignedUser[];
}

const STATUS_CONFIG: Record<PhaseStatus, { label: string; bg: string; text: string }> = {
  not_started: { label: 'Not Started', bg: '#F3F4F6', text: '#374151' },
  in_progress:  { label: 'In Progress',  bg: '#DBEAFE', text: '#1E40AF' },
  complete:     { label: 'Complete',     bg: '#D1FAE5', text: '#065F46' },
  invoiced:     { label: 'Invoiced',     bg: '#EDE9FE', text: '#6D28D9' },
};

function fmtDate(d?: string | null): string | null {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' });
  } catch { return null; }
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title }: { icon: string; title: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
      <Feather name={icon as any} size={14} color={colors.primary} />
      <Text style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>
        {title}
      </Text>
    </View>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────
function SectionCard({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    }}>
      {children}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function PhaseDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ jobId: string; phaseId: string }>();
  const { jobId, phaseId } = params;
  // Workers (staff role) get a read-only view with no edit/delete controls
  const { isStaff } = useUserRole();
  const isTradie = isStaff;

  const [phase, setPhase] = useState<JobPhase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Phase documents ────────────────────────────────────────────────────────
  interface PhaseDoc {
    id: string;
    docNumber: string;
    title: string;
    category: string;
    currentRevision: string;
    latestRevision?: { fileName: string; mimeType?: string | null; fileUrl?: string | null } | null;
  }
  const [phaseDocs, setPhaseDocs] = useState<PhaseDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  const loadPhase = useCallback(async () => {
    if (!jobId || !phaseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<JobPhase[]>(`/api/jobs/${jobId}/phases`);
      const phases = Array.isArray(res.data) ? res.data : [];
      const found = phases.find((p) => p.id === phaseId);
      setPhase(found ?? null);
      if (!found) setError('Phase not found.');
    } catch (e: any) {
      setError('Failed to load phase details.');
    } finally {
      setLoading(false);
    }
  }, [jobId, phaseId]);

  const loadDocs = useCallback(async () => {
    if (!jobId || !phaseId) return;
    setDocsLoading(true);
    try {
      const res = await api.get<PhaseDoc[]>(
        `/api/jobs/${jobId}/project-documents?phaseId=${encodeURIComponent(phaseId)}`,
      );
      setPhaseDocs(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Non-fatal: documents section just shows empty state
      setPhaseDocs([]);
    } finally {
      setDocsLoading(false);
    }
  }, [jobId, phaseId]);

  useEffect(() => { loadPhase(); }, [loadPhase]);
  useEffect(() => { loadDocs(); }, [loadDocs]);

  const attachPhaseDoc = useCallback(async () => {
    const DocumentPicker = getDocumentPicker();
    if (!DocumentPicker) {
      Alert.alert('Update required', 'Attaching documents needs the latest app build. Please update the app.');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;

      setIsUploadingDoc(true);
      const token = await api.getToken();
      const fd = new FormData();
      fd.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' } as any);
      fd.append('title', asset.name.replace(/\.[^/.]+$/, ''));
      fd.append('category', 'Other');
      fd.append('revision', 'A');
      fd.append('phaseId', phaseId);

      const response = await fetch(`${API_URL}/api/jobs/${jobId}/project-documents`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'x-mobile-app': 'true' },
        body: fd,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      await loadDocs();
    } catch (e: any) {
      Alert.alert('Upload failed', e.message || 'Could not upload document.');
    } finally {
      setIsUploadingDoc(false);
    }
  }, [jobId, phaseId, loadDocs]);

  const cfg = phase ? (STATUS_CONFIG[phase.status] ?? STATUS_CONFIG.not_started) : null;
  const phaseMembers: PhaseAssignedUser[] = phase?.assignedUsers
    ?? (phase?.assignedUserId ? [{ id: phase.assignedUserId, name: phase.assignedUserName ?? '', isLead: true }] : []);

  const budgetedHrs = parseFloat(phase?.budgetedHours ?? '0') || 0;
  const actualHrs = phase?.actualHours ?? 0;
  const pct = budgetedHrs > 0 ? actualHrs / budgetedHrs : null;
  const barColor = pct === null
    ? colors.primary
    : pct >= 1.0 ? '#DC2626' : pct >= 0.8 ? '#D97706' : '#16A34A';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ── Header bar ─────────────────────────────────────────────── */}
      <View style={[styles.headerBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: typography.caption.fontSize, color: colors.mutedForeground }}>Phase Detail</Text>
          {phase && (
            <Text style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }} numberOfLines={1}>
              {phase.phaseCode} · {phase.name}
            </Text>
          )}
        </View>
      </View>

      {/* ── Body ────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ marginTop: spacing.sm, color: colors.mutedForeground, fontSize: typography.body.fontSize }}>
            Loading phase…
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={32} color={colors.destructive} />
          <Text style={{ marginTop: spacing.sm, color: colors.destructive, fontSize: typography.body.fontSize, textAlign: 'center' }}>
            {error}
          </Text>
          <TouchableOpacity onPress={loadPhase} style={{ marginTop: spacing.md }} activeOpacity={0.7}>
            <Text style={{ color: colors.primary, fontWeight: fontWeights.semibold }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : phase && cfg ? (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Phase header card ───────────────────────────────────── */}
          <SectionCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
              <View style={{
                borderWidth: 1,
                borderColor: `${colors.primary}66`,
                borderRadius: 4,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}>
                <Text style={{ fontSize: 11, fontWeight: fontWeights.semibold, color: colors.primary }}>
                  {phase.phaseCode}
                </Text>
              </View>
              <View style={{ backgroundColor: cfg.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 }}>
                <Text style={{ fontSize: 11, fontWeight: fontWeights.semibold, color: cfg.text }}>{cfg.label}</Text>
              </View>
            </View>

            <Text style={{ fontSize: 20, fontWeight: fontWeights.bold, color: colors.foreground, marginBottom: spacing.xs }}>
              {phase.name}
            </Text>

            {/* Date range */}
            {(phase.scheduledStart || phase.scheduledEnd) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
                <Feather name="calendar" size={12} color={colors.mutedForeground} />
                <Text style={{ fontSize: typography.caption.fontSize, color: colors.mutedForeground }}>
                  {fmtDate(phase.scheduledStart) ?? '?'} → {fmtDate(phase.scheduledEnd) ?? '?'}
                </Text>
              </View>
            )}

            {/* Hours progress */}
            {(budgetedHrs > 0 || actualHrs > 0) && (
              <View style={{ marginTop: spacing.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Feather name="clock" size={11} color={colors.mutedForeground} />
                    <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                      {budgetedHrs > 0
                        ? `${actualHrs.toFixed(1)} / ${budgetedHrs.toFixed(1)} hrs`
                        : `${actualHrs.toFixed(1)} hrs logged`}
                    </Text>
                  </View>
                  {pct !== null && (
                    <Text style={{ fontSize: 11, fontWeight: fontWeights.semibold, color: barColor }}>
                      {Math.round(pct * 100)}%
                    </Text>
                  )}
                </View>
                {budgetedHrs > 0 && (
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: `${barColor}25`, overflow: 'hidden' }}>
                    <View style={{
                      height: '100%',
                      width: `${Math.min((pct ?? 0) * 100, 100)}%`,
                      borderRadius: 3,
                      backgroundColor: barColor,
                    }} />
                  </View>
                )}
              </View>
            )}
          </SectionCard>

          {/* ── Team ────────────────────────────────────────────────── */}
          <SectionCard>
            <SectionHeader icon="users" title="Team" />
            {phaseMembers.length === 0 ? (
              <Text style={{ fontSize: typography.caption.fontSize, color: colors.mutedForeground, fontStyle: 'italic' }}>
                No team members assigned to this phase.
              </Text>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {phaseMembers.map((member) => (
                  <View key={member.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <TeamAvatar name={member.name} userId={member.id} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.medium, color: colors.foreground }}>
                        {member.name}
                      </Text>
                      {member.isLead && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Feather name="star" size={10} color="#F59E0B" />
                          <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Lead</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </SectionCard>

          {/* ── Tasks ────────────────────────────────────────────────── */}
          <SectionCard>
            <SectionHeader icon="check-square" title="Tasks" />
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              padding: spacing.sm,
              backgroundColor: colors.muted,
              borderRadius: radius.md,
            }}>
              <Feather name="info" size={13} color={colors.mutedForeground} />
              <Text style={{ fontSize: typography.caption.fontSize, color: colors.mutedForeground, flex: 1 }}>
                Tasks linked to this phase will appear here.
              </Text>
            </View>
          </SectionCard>

          {/* ── Documents ────────────────────────────────────────────── */}
          <SectionCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs }}>
              <SectionHeader icon="file-text" title="Documents" />
              {!isTradie && (
                <TouchableOpacity
                  onPress={attachPhaseDoc}
                  disabled={isUploadingDoc}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: isUploadingDoc ? 0.5 : 1,
                  }}
                >
                  {isUploadingDoc
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <Feather name="paperclip" size={12} color={colors.primary} />}
                  <Text style={{ fontSize: 11, color: colors.primary, fontWeight: fontWeights.medium }}>
                    {isUploadingDoc ? 'Uploading…' : 'Attach'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {docsLoading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.xs }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ fontSize: typography.caption.fontSize, color: colors.mutedForeground }}>
                  Loading documents…
                </Text>
              </View>
            ) : phaseDocs.length > 0 ? (
              <View style={{ gap: spacing.xs }}>
                {phaseDocs.map((doc) => (
                  <View
                    key={doc.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    }}
                  >
                    <Feather name="file-text" size={14} color={colors.mutedForeground} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{ fontSize: typography.body.fontSize, fontWeight: fontWeights.medium, color: colors.foreground }}
                        numberOfLines={1}
                      >
                        {doc.title}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
                        {doc.docNumber} · {doc.category} · Rev {doc.currentRevision}
                      </Text>
                    </View>
                    {doc.latestRevision?.fileUrl ? (
                      <TouchableOpacity
                        onPress={() => Linking.openURL(doc.latestRevision!.fileUrl!)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                      >
                        <Feather name="external-link" size={16} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                padding: spacing.sm,
                backgroundColor: colors.muted,
                borderRadius: radius.md,
              }}>
                <Feather name="file-text" size={13} color={colors.mutedForeground} />
                <Text style={{ fontSize: typography.caption.fontSize, color: colors.mutedForeground, flex: 1 }}>
                  No documents attached to this phase yet.
                </Text>
              </View>
            )}
          </SectionCard>

          {/* ── Notes ────────────────────────────────────────────────── */}
          {(phase.notes || phase.description) && (
            <SectionCard>
              <SectionHeader icon="sticky-note" title="Notes" />
              {phase.notes && (
                <Text style={{ fontSize: typography.body.fontSize, color: colors.foreground, lineHeight: 22, marginBottom: phase.description ? spacing.sm : 0 }}>
                  {phase.notes}
                </Text>
              )}
              {phase.description && (
                <Text style={{ fontSize: typography.caption.fontSize, color: colors.mutedForeground, lineHeight: 20 }}>
                  {phase.description}
                </Text>
              )}
            </SectionCard>
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    minHeight: 56,
  },
  backBtn: {
    padding: 4,
    marginRight: 4,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
});
