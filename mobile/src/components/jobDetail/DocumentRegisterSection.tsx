/**
 * ProjectDocumentRegister mobile section.
 * Renders registered project documents (with revision history) and RFIs.
 * Used inside the Documents tab of the job detail screen.
 */
import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import api from '../../lib/api';
import { showToast } from '../../lib/toast';
import { spacing, radius, typography, fontWeights, iconSizes } from '../../lib/design-tokens';

const DOC_CATEGORIES = ['Drawings', 'Specifications', 'RFIs', 'SWMS', 'Certificates', 'Other'] as const;
type DocCategory = (typeof DOC_CATEGORIES)[number];
type RfiStatus = 'open' | 'answered' | 'closed';

interface ProjectDocument {
  id: string;
  jobId: string;
  docNumber: string;
  title: string;
  category: string;
  currentRevision: string;
  createdAt: string;
  updatedAt: string;
  latestRevision: RevisionRecord | null;
  revisionCount: number;
}

interface RevisionRecord {
  id: string;
  documentId: string;
  revision: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  notes: string | null;
  uploadedAt: string;
  fileUrl: string | null;
}

interface ProjectRfi {
  id: string;
  jobId: string;
  rfiNumber: string;
  question: string;
  description: string | null;
  assignedToName: string | null;
  status: RfiStatus;
  answeredAt: string | null;
  answerText: string | null;
  answerFileUrl: string | null;
  createdAt: string;
}

interface DocumentRegisterSectionProps {
  jobId: string;
  colors: any;
  styles: any;
  canUpload?: boolean;
}

type PickedFile = {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getCategoryColor(category: string): string {
  const map: Record<string, string> = {
    Drawings: '#3B82F6',
    Specifications: '#8B5CF6',
    RFIs: '#F59E0B',
    SWMS: '#EF4444',
    Certificates: '#10B981',
    Other: '#6B7280',
  };
  return map[category] ?? '#6B7280';
}

function getRfiStatusColor(status: RfiStatus): string {
  if (status === 'open') return '#F59E0B';
  if (status === 'answered') return '#3B82F6';
  return '#6B7280';
}

/** Build a FormData blob suitable for api.uploadFile() from a picked file. */
function buildFormData(file: PickedFile, fields: Record<string, string>): FormData {
  const fd = new FormData();
  // React Native FormData accepts {uri, name, type} blobs
  fd.append('file', {
    uri: Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri,
    name: file.name,
    type: file.mimeType ?? 'application/octet-stream',
  } as any);
  for (const [k, v] of Object.entries(fields)) {
    fd.append(k, v);
  }
  return fd;
}

export function DocumentRegisterSection({
  jobId,
  colors,
  canUpload = true,
}: DocumentRegisterSectionProps) {
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [rfis, setRfis] = useState<ProjectRfi[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isLoadingRfis, setIsLoadingRfis] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [docRevisions, setDocRevisions] = useState<Record<string, RevisionRecord[]>>({});
  const [isLoadingRevisions, setIsLoadingRevisions] = useState<string | null>(null);
  const [expandedRfiId, setExpandedRfiId] = useState<string | null>(null);

  // Upload doc modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<DocCategory>('Drawings');
  const [docRevision, setDocRevision] = useState('A');
  const [docNotes, setDocNotes] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<PickedFile | null>(null);

  // Upload revision modal
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionDocId, setRevisionDocId] = useState<string | null>(null);
  const [revisionDocTitle, setRevisionDocTitle] = useState('');
  const [revisionLabel, setRevisionLabel] = useState('');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [selectedRevFile, setSelectedRevFile] = useState<PickedFile | null>(null);

  // RFI create modal
  const [showRfiModal, setShowRfiModal] = useState(false);
  const [isCreatingRfi, setIsCreatingRfi] = useState(false);
  const [rfiQuestion, setRfiQuestion] = useState('');
  const [rfiDescription, setRfiDescription] = useState('');
  const [rfiAssignedToName, setRfiAssignedToName] = useState('');

  // RFI answer modal
  const [showAnswerModal, setShowAnswerModal] = useState(false);
  const [answeringRfiId, setAnsweringRfiId] = useState<string | null>(null);
  const [answeringRfiNumber, setAnsweringRfiNumber] = useState('');
  const [answerStatus, setAnswerStatus] = useState<RfiStatus>('answered');
  const [answerText, setAnswerText] = useState('');

  const loadDocuments = useCallback(async () => {
    setIsLoadingDocs(true);
    try {
      const res = await api.get<ProjectDocument[]>(`/api/jobs/${jobId}/project-documents`);
      setDocuments(res.data ?? []);
    } catch {
      // silently ignore; user can pull-to-refresh
    } finally {
      setIsLoadingDocs(false);
    }
  }, [jobId]);

  const loadRfis = useCallback(async () => {
    setIsLoadingRfis(true);
    try {
      const res = await api.get<ProjectRfi[]>(`/api/jobs/${jobId}/rfis`);
      setRfis(res.data ?? []);
    } catch {
      // silently ignore
    } finally {
      setIsLoadingRfis(false);
    }
  }, [jobId]);

  // Load documents and RFIs on mount
  useEffect(() => {
    loadDocuments();
    loadRfis();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRevisions = useCallback(
    async (docId: string) => {
      if (docRevisions[docId]) return;
      setIsLoadingRevisions(docId);
      try {
        const res = await api.get<RevisionRecord[]>(
          `/api/jobs/${jobId}/project-documents/${docId}/revisions`,
        );
        setDocRevisions(prev => ({ ...prev, [docId]: res.data ?? [] }));
      } catch {
        // ignore
      } finally {
        setIsLoadingRevisions(null);
      }
    },
    [jobId, docRevisions],
  );

  const toggleDocExpand = (docId: string) => {
    if (expandedDocId === docId) {
      setExpandedDocId(null);
    } else {
      setExpandedDocId(docId);
      loadRevisions(docId);
    }
  };

  const pickFile = async (forRevision = false) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const picked: PickedFile = {
        uri: asset.uri,
        name: asset.name,
        size: asset.size ?? undefined,
        mimeType: asset.mimeType ?? undefined,
      };
      if (forRevision) setSelectedRevFile(picked);
      else setSelectedDoc(picked);
    } catch {
      showToast({ type: 'error', message: 'Could not open file picker' });
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedDoc || !docTitle.trim()) {
      showToast({ type: 'error', message: 'Title and file are required' });
      return;
    }
    setIsUploading(true);
    try {
      const fd = buildFormData(selectedDoc, {
        title: docTitle.trim(),
        category: docCategory,
        revision: docRevision.trim() || 'A',
        ...(docNotes.trim() ? { notes: docNotes.trim() } : {}),
      });
      const res = await api.uploadFile<ProjectDocument>(
        `/api/jobs/${jobId}/project-documents`,
        fd,
      );
      if (res.error) {
        showToast({ type: 'error', message: res.error });
        return;
      }
      showToast({ type: 'success', message: 'Document registered' });
      setShowUploadModal(false);
      setSelectedDoc(null);
      setDocTitle('');
      setDocCategory('Drawings');
      setDocRevision('A');
      setDocNotes('');
      loadDocuments();
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddRevision = async () => {
    if (!selectedRevFile || !revisionLabel.trim() || !revisionDocId) {
      showToast({ type: 'error', message: 'Revision label and file are required' });
      return;
    }
    setIsUploading(true);
    try {
      const fd = buildFormData(selectedRevFile, {
        revision: revisionLabel.trim(),
        ...(revisionNotes.trim() ? { notes: revisionNotes.trim() } : {}),
      });
      const res = await api.uploadFile<RevisionRecord>(
        `/api/jobs/${jobId}/project-documents/${revisionDocId}/revisions`,
        fd,
      );
      if (res.error) {
        showToast({ type: 'error', message: res.error });
        return;
      }
      showToast({ type: 'success', message: 'Revision added' });
      setShowRevisionModal(false);
      setSelectedRevFile(null);
      setRevisionLabel('');
      setRevisionNotes('');
      // Invalidate cached revisions so the next expand re-fetches
      setDocRevisions(prev => {
        const next = { ...prev };
        if (revisionDocId) delete next[revisionDocId];
        return next;
      });
      setRevisionDocId(null);
      loadDocuments();
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateRfi = async () => {
    if (!rfiQuestion.trim()) {
      showToast({ type: 'error', message: 'Question is required' });
      return;
    }
    setIsCreatingRfi(true);
    try {
      const res = await api.post<ProjectRfi>(`/api/jobs/${jobId}/rfis`, {
        question: rfiQuestion.trim(),
        description: rfiDescription.trim() || undefined,
        assignedToName: rfiAssignedToName.trim() || undefined,
      });
      if (res.error) {
        showToast({ type: 'error', message: res.error });
        return;
      }
      showToast({ type: 'success', message: 'RFI raised' });
      setShowRfiModal(false);
      setRfiQuestion('');
      setRfiDescription('');
      setRfiAssignedToName('');
      loadRfis();
    } finally {
      setIsCreatingRfi(false);
    }
  };

  const handleAnswerRfi = async () => {
    if (!answeringRfiId) return;
    try {
      const res = await api.patch<ProjectRfi>(`/api/jobs/${jobId}/rfis/${answeringRfiId}`, {
        status: answerStatus,
        answerText: answerText.trim() || undefined,
      });
      if (res.error) {
        showToast({ type: 'error', message: res.error });
        return;
      }
      showToast({ type: 'success', message: 'RFI updated' });
      setShowAnswerModal(false);
      setAnsweringRfiId(null);
      setAnswerText('');
      setAnswerStatus('answered');
      loadRfis();
    } catch {
      showToast({ type: 'error', message: 'Update failed' });
    }
  };

  const openAnswerModal = (rfi: ProjectRfi) => {
    setAnsweringRfiId(rfi.id);
    setAnsweringRfiNumber(rfi.rfiNumber);
    setAnswerStatus(rfi.status === 'open' ? 'answered' : rfi.status);
    setAnswerText(rfi.answerText ?? '');
    setShowAnswerModal(true);
  };

  const s = localStyles(colors);

  const openRfiCount = rfis.filter(r => r.status === 'open').length;

  return (
    <View>
      {/* ── Document Register ── */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <View style={s.headerLeft}>
            <View style={[s.iconWrap, { backgroundColor: `${colors.primary}15` }]}>
              <Feather name="folder" size={iconSizes.lg} color={colors.primary} />
            </View>
            <Text style={[s.headerLabel, { color: colors.foreground }]}>Document Register</Text>
            {documents.length > 0 && (
              <View style={[s.countBadge, { backgroundColor: colors.muted }]}>
                <Text style={[s.countText, { color: colors.mutedForeground }]}>{documents.length}</Text>
              </View>
            )}
          </View>
          {canUpload && (
            <TouchableOpacity
              style={[s.addBtn, { borderColor: colors.border }]}
              onPress={() => setShowUploadModal(true)}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={14} color={colors.primary} />
              <Text style={[s.addBtnText, { color: colors.primary }]}>Register</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoadingDocs ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: spacing.lg }} />
        ) : documents.length === 0 ? (
          <View style={s.empty}>
            <Feather name="file-plus" size={28} color={colors.mutedForeground} />
            <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No documents registered yet</Text>
          </View>
        ) : (
          <View style={s.list}>
            {documents.map(doc => {
              const catColor = getCategoryColor(doc.category);
              const isExpanded = expandedDocId === doc.id;
              return (
                <View key={doc.id} style={[s.docRow, { borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={[s.docHeader, { backgroundColor: colors.background }]}
                    onPress={() => toggleDocExpand(doc.id)}
                    activeOpacity={0.7}
                  >
                    <View style={s.docInfo}>
                      <View style={s.docTitleRow}>
                        <Text style={[s.docNumber, { color: colors.mutedForeground }]}>{doc.docNumber}</Text>
                        <Text style={[s.docTitle, { color: colors.foreground }]} numberOfLines={1}>
                          {doc.title}
                        </Text>
                      </View>
                      <View style={s.docMeta}>
                        <View style={[s.catBadge, { backgroundColor: `${catColor}20` }]}>
                          <Text style={[s.catText, { color: catColor }]}>{doc.category}</Text>
                        </View>
                        <View style={[s.revBadge, { backgroundColor: colors.muted }]}>
                          <Text style={[s.revText, { color: colors.mutedForeground }]}>Rev {doc.currentRevision}</Text>
                        </View>
                        {doc.revisionCount > 0 && (
                          <Text style={[s.revCountText, { color: colors.mutedForeground }]}>
                            {doc.revisionCount} revision{doc.revisionCount !== 1 ? 's' : ''}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={s.docActions}>
                      {canUpload && (
                        <TouchableOpacity
                          onPress={() => {
                            setRevisionDocId(doc.id);
                            setRevisionDocTitle(doc.title);
                            setShowRevisionModal(true);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ marginRight: spacing.sm }}
                        >
                          <Feather name="upload" size={15} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      )}
                      <Feather
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={15}
                        color={colors.mutedForeground}
                      />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={[s.revHistory, { backgroundColor: colors.muted }]}>
                      <Text style={[s.revHistoryLabel, { color: colors.mutedForeground }]}>
                        Revision History
                      </Text>
                      {isLoadingRevisions === doc.id ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                          style={{ marginTop: spacing.sm }}
                        />
                      ) : (docRevisions[doc.id] ?? []).length === 0 ? (
                        <Text style={[s.emptyText, { color: colors.mutedForeground, fontSize: typography.captionSmall.fontSize }]}>
                          No revisions yet
                        </Text>
                      ) : (
                        (docRevisions[doc.id] ?? []).map((rev, i) => (
                          <View key={rev.id} style={s.revItem}>
                            <View
                              style={[
                                s.revLabelBadge,
                                { backgroundColor: i === 0 ? `${colors.primary}20` : colors.card },
                              ]}
                            >
                              <Text
                                style={[
                                  s.revLabelText,
                                  { color: i === 0 ? colors.primary : colors.mutedForeground },
                                ]}
                              >
                                Rev {rev.revision}
                              </Text>
                            </View>
                            <Text
                              style={[s.revFileName, { color: colors.foreground }]}
                              numberOfLines={1}
                            >
                              {rev.fileName}
                            </Text>
                            {rev.fileSize ? (
                              <Text style={[s.revMeta, { color: colors.mutedForeground }]}>
                                {formatFileSize(rev.fileSize)}
                              </Text>
                            ) : null}
                            <Text style={[s.revMeta, { color: colors.mutedForeground }]}>
                              {new Date(rev.uploadedAt).toLocaleDateString()}
                            </Text>
                            {rev.fileUrl ? (
                              <TouchableOpacity
                                onPress={() => Linking.openURL(rev.fileUrl!)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Feather name="external-link" size={14} color={colors.primary} />
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* ── RFIs ── */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <View style={s.headerLeft}>
            <View style={[s.iconWrap, { backgroundColor: '#F59E0B15' }]}>
              <Feather name="help-circle" size={iconSizes.lg} color="#F59E0B" />
            </View>
            <Text style={[s.headerLabel, { color: colors.foreground }]}>RFIs</Text>
            {rfis.length > 0 && (
              <View style={[s.countBadge, { backgroundColor: colors.muted }]}>
                <Text style={[s.countText, { color: colors.mutedForeground }]}>{rfis.length}</Text>
              </View>
            )}
            {openRfiCount > 0 && (
              <View style={[s.countBadge, { backgroundColor: '#F59E0B20' }]}>
                <Text style={[s.countText, { color: '#D97706' }]}>{openRfiCount} open</Text>
              </View>
            )}
          </View>
          {canUpload && (
            <TouchableOpacity
              style={[s.addBtn, { borderColor: colors.border }]}
              onPress={() => setShowRfiModal(true)}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={14} color={colors.primary} />
              <Text style={[s.addBtnText, { color: colors.primary }]}>Raise RFI</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoadingRfis ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: spacing.lg }} />
        ) : rfis.length === 0 ? (
          <View style={s.empty}>
            <Feather name="help-circle" size={28} color={colors.mutedForeground} />
            <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No RFIs raised yet</Text>
          </View>
        ) : (
          <View style={s.list}>
            {rfis.map(rfi => {
              const statusColor = getRfiStatusColor(rfi.status);
              const isExpanded = expandedRfiId === rfi.id;
              return (
                <View key={rfi.id} style={[s.docRow, { borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={[s.docHeader, { backgroundColor: colors.background }]}
                    onPress={() => setExpandedRfiId(isExpanded ? null : rfi.id)}
                    activeOpacity={0.7}
                  >
                    <View style={s.docInfo}>
                      <View style={s.docTitleRow}>
                        <Text style={[s.docNumber, { color: colors.mutedForeground }]}>
                          {rfi.rfiNumber}
                        </Text>
                        <Text style={[s.docTitle, { color: colors.foreground }]} numberOfLines={1}>
                          {rfi.question}
                        </Text>
                      </View>
                      <View style={s.docMeta}>
                        <View style={[s.catBadge, { backgroundColor: `${statusColor}20` }]}>
                          <Text style={[s.catText, { color: statusColor }]}>
                            {rfi.status.charAt(0).toUpperCase() + rfi.status.slice(1)}
                          </Text>
                        </View>
                        {rfi.assignedToName ? (
                          <Text style={[s.revCountText, { color: colors.mutedForeground }]}>
                            → {rfi.assignedToName}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={s.docActions}>
                      {canUpload && rfi.status !== 'closed' && (
                        <TouchableOpacity
                          onPress={() => openAnswerModal(rfi)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ marginRight: spacing.sm }}
                        >
                          <Feather name="edit-2" size={14} color={colors.primary} />
                        </TouchableOpacity>
                      )}
                      <Feather
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={15}
                        color={colors.mutedForeground}
                      />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={[s.revHistory, { backgroundColor: colors.muted }]}>
                      {rfi.description ? (
                        <Text
                          style={[s.revMeta, { color: colors.foreground, marginBottom: spacing.sm }]}
                        >
                          {rfi.description}
                        </Text>
                      ) : null}
                      {rfi.answerText || rfi.answerFileUrl ? (
                        <View style={{ gap: spacing.xs }}>
                          <Text style={[s.revHistoryLabel, { color: colors.mutedForeground }]}>
                            Answer
                          </Text>
                          {rfi.answerText ? (
                            <Text style={[s.revMeta, { color: colors.foreground }]}>
                              {rfi.answerText}
                            </Text>
                          ) : null}
                          {rfi.answerFileUrl ? (
                            <TouchableOpacity
                              style={[s.docActions, { alignSelf: 'flex-start', gap: spacing.xs }]}
                              onPress={() => Linking.openURL(rfi.answerFileUrl!)}
                              activeOpacity={0.7}
                            >
                              <Feather name="paperclip" size={13} color={colors.primary} />
                              <Text style={[s.addBtnText, { color: colors.primary }]}>
                                View attachment
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                          {rfi.answeredAt ? (
                            <Text style={[s.revMeta, { color: colors.mutedForeground }]}>
                              Answered {new Date(rfi.answeredAt).toLocaleDateString()}
                            </Text>
                          ) : null}
                        </View>
                      ) : (
                        <Text
                          style={[
                            s.revMeta,
                            { color: colors.mutedForeground, fontStyle: 'italic' },
                          ]}
                        >
                          No answer yet
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* ── Upload Document Modal ── */}
      <Modal
        visible={showUploadModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowUploadModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: colors.background }}
        >
          <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Register Document</Text>
            <TouchableOpacity onPress={() => setShowUploadModal(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          >
            <View style={s.field}>
              <Text style={[s.label, { color: colors.foreground }]}>Title *</Text>
              <TextInput
                style={[
                  s.input,
                  { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
                ]}
                placeholder="e.g. Ground Floor Plan"
                placeholderTextColor={colors.mutedForeground}
                value={docTitle}
                onChangeText={setDocTitle}
              />
            </View>
            <View style={s.field}>
              <Text style={[s.label, { color: colors.foreground }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {DOC_CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        s.chip,
                        { borderColor: colors.border },
                        docCategory === cat && {
                          backgroundColor: `${colors.primary}20`,
                          borderColor: colors.primary,
                        },
                      ]}
                      onPress={() => setDocCategory(cat)}
                    >
                      <Text
                        style={[
                          s.chipText,
                          { color: docCategory === cat ? colors.primary : colors.mutedForeground },
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View style={s.field}>
              <Text style={[s.label, { color: colors.foreground }]}>Initial Revision</Text>
              <TextInput
                style={[
                  s.input,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    width: 80,
                  },
                ]}
                placeholder="A"
                placeholderTextColor={colors.mutedForeground}
                value={docRevision}
                onChangeText={setDocRevision}
                autoCapitalize="characters"
              />
            </View>
            <View style={s.field}>
              <Text style={[s.label, { color: colors.foreground }]}>File *</Text>
              <TouchableOpacity
                style={[s.filePicker, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => pickFile(false)}
              >
                {selectedDoc ? (
                  <View>
                    <Text style={[s.filePickerText, { color: colors.foreground }]}>
                      {selectedDoc.name}
                    </Text>
                    {selectedDoc.size ? (
                      <Text style={[s.filePickerMeta, { color: colors.mutedForeground }]}>
                        {formatFileSize(selectedDoc.size)}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <>
                    <Feather name="upload" size={20} color={colors.mutedForeground} />
                    <Text style={[s.filePickerText, { color: colors.mutedForeground }]}>
                      Tap to select a file
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <View style={s.field}>
              <Text style={[s.label, { color: colors.foreground }]}>Notes (optional)</Text>
              <TextInput
                style={[
                  s.input,
                  s.textArea,
                  { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
                ]}
                placeholder="Any notes about this revision…"
                placeholderTextColor={colors.mutedForeground}
                value={docNotes}
                onChangeText={setDocNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
          <View style={[s.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[
                s.submitBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: !selectedDoc || !docTitle.trim() || isUploading ? 0.5 : 1,
                },
              ]}
              onPress={handleUploadDocument}
              disabled={!selectedDoc || !docTitle.trim() || isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.submitBtnText}>Register Document</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Upload Revision Modal ── */}
      <Modal
        visible={showRevisionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRevisionModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: colors.background }}
        >
          <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Upload New Revision</Text>
              {revisionDocTitle ? (
                <Text style={[s.modalSubtitle, { color: colors.mutedForeground }]}>
                  {revisionDocTitle}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => setShowRevisionModal(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          >
            <View style={s.field}>
              <Text style={[s.label, { color: colors.foreground }]}>Revision Label *</Text>
              <TextInput
                style={[
                  s.input,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    width: 100,
                  },
                ]}
                placeholder="e.g. B, C, 2…"
                placeholderTextColor={colors.mutedForeground}
                value={revisionLabel}
                onChangeText={setRevisionLabel}
                autoCapitalize="characters"
              />
            </View>
            <View style={s.field}>
              <Text style={[s.label, { color: colors.foreground }]}>File *</Text>
              <TouchableOpacity
                style={[s.filePicker, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => pickFile(true)}
              >
                {selectedRevFile ? (
                  <Text style={[s.filePickerText, { color: colors.foreground }]}>
                    {selectedRevFile.name}
                  </Text>
                ) : (
                  <>
                    <Feather name="upload" size={20} color={colors.mutedForeground} />
                    <Text style={[s.filePickerText, { color: colors.mutedForeground }]}>
                      Tap to select a file
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <View style={s.field}>
              <Text style={[s.label, { color: colors.foreground }]}>Notes (optional)</Text>
              <TextInput
                style={[
                  s.input,
                  s.textArea,
                  { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
                ]}
                placeholder="What changed in this revision?"
                placeholderTextColor={colors.mutedForeground}
                value={revisionNotes}
                onChangeText={setRevisionNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
          <View style={[s.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[
                s.submitBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: !selectedRevFile || !revisionLabel.trim() || isUploading ? 0.5 : 1,
                },
              ]}
              onPress={handleAddRevision}
              disabled={!selectedRevFile || !revisionLabel.trim() || isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.submitBtnText}>Upload Revision</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Raise RFI Modal ── */}
      <Modal
        visible={showRfiModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRfiModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: colors.background }}
        >
          <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Raise RFI</Text>
            <TouchableOpacity onPress={() => setShowRfiModal(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          >
            <View style={s.field}>
              <Text style={[s.label, { color: colors.foreground }]}>Question *</Text>
              <TextInput
                style={[
                  s.input,
                  { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
                ]}
                placeholder="What information do you need?"
                placeholderTextColor={colors.mutedForeground}
                value={rfiQuestion}
                onChangeText={setRfiQuestion}
              />
            </View>
            <View style={s.field}>
              <Text style={[s.label, { color: colors.foreground }]}>Description (optional)</Text>
              <TextInput
                style={[
                  s.input,
                  s.textArea,
                  { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
                ]}
                placeholder="Provide more context…"
                placeholderTextColor={colors.mutedForeground}
                value={rfiDescription}
                onChangeText={setRfiDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
            <View style={s.field}>
              <Text style={[s.label, { color: colors.foreground }]}>Assign to (optional)</Text>
              <TextInput
                style={[
                  s.input,
                  { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
                ]}
                placeholder="Name of person to answer this RFI"
                placeholderTextColor={colors.mutedForeground}
                value={rfiAssignedToName}
                onChangeText={setRfiAssignedToName}
              />
            </View>
          </ScrollView>
          <View style={[s.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[
                s.submitBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: !rfiQuestion.trim() || isCreatingRfi ? 0.5 : 1,
                },
              ]}
              onPress={handleCreateRfi}
              disabled={!rfiQuestion.trim() || isCreatingRfi}
            >
              {isCreatingRfi ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.submitBtnText}>Raise RFI</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Answer RFI Modal ── */}
      <Modal
        visible={showAnswerModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAnswerModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, backgroundColor: colors.background }}
        >
          <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Update RFI</Text>
              {answeringRfiNumber ? (
                <Text style={[s.modalSubtitle, { color: colors.mutedForeground }]}>
                  {answeringRfiNumber}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => setShowAnswerModal(false)}>
              <Feather name="x" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          >
            <View style={s.field}>
              <Text style={[s.label, { color: colors.foreground }]}>Status</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {(['open', 'answered', 'closed'] as RfiStatus[]).map(st => (
                  <TouchableOpacity
                    key={st}
                    style={[
                      s.chip,
                      { borderColor: colors.border },
                      answerStatus === st && {
                        backgroundColor: `${colors.primary}20`,
                        borderColor: colors.primary,
                      },
                    ]}
                    onPress={() => setAnswerStatus(st)}
                  >
                    <Text
                      style={[
                        s.chipText,
                        {
                          color:
                            answerStatus === st ? colors.primary : colors.mutedForeground,
                        },
                      ]}
                    >
                      {st.charAt(0).toUpperCase() + st.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={s.field}>
              <Text style={[s.label, { color: colors.foreground }]}>Answer</Text>
              <TextInput
                style={[
                  s.input,
                  s.textArea,
                  { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card },
                ]}
                placeholder="Provide the answer here…"
                placeholderTextColor={colors.mutedForeground}
                value={answerText}
                onChangeText={setAnswerText}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
          <View style={[s.modalFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: colors.primary }]}
              onPress={handleAnswerRfi}
            >
              <Text style={s.submitBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const localStyles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      paddingBottom: spacing.sm,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerLabel: {
      fontSize: typography.button.fontSize,
      fontWeight: fontWeights.semibold,
    },
    countBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    countText: {
      fontSize: typography.captionSmall.fontSize,
      fontWeight: fontWeights.semibold,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    addBtnText: {
      fontSize: typography.captionSmall.fontSize,
      fontWeight: fontWeights.semibold,
    },
    empty: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
      gap: spacing.sm,
    },
    emptyText: {
      fontSize: typography.caption.fontSize,
    },
    list: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      gap: spacing.sm,
    },
    docRow: {
      borderWidth: 1,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    docHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.sm,
    },
    docInfo: {
      flex: 1,
      gap: 3,
    },
    docTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    docNumber: {
      fontSize: typography.captionSmall.fontSize,
      fontWeight: fontWeights.medium,
      flexShrink: 0,
    },
    docTitle: {
      fontSize: typography.caption.fontSize,
      fontWeight: fontWeights.semibold,
      flex: 1,
    },
    docMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    catBadge: {
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: radius.sm,
    },
    catText: {
      fontSize: typography.captionSmall.fontSize,
      fontWeight: fontWeights.bold,
    },
    revBadge: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: radius.sm,
    },
    revText: {
      fontSize: typography.captionSmall.fontSize,
    },
    revCountText: {
      fontSize: typography.captionSmall.fontSize,
    },
    docActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexShrink: 0,
    },
    revHistory: {
      padding: spacing.sm,
      gap: spacing.xs,
    },
    revHistoryLabel: {
      fontSize: typography.captionSmall.fontSize,
      fontWeight: fontWeights.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    revItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    revLabelBadge: {
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: radius.sm,
      flexShrink: 0,
    },
    revLabelText: {
      fontSize: typography.captionSmall.fontSize,
      fontWeight: fontWeights.semibold,
    },
    revFileName: {
      fontSize: typography.captionSmall.fontSize,
      flex: 1,
    },
    revMeta: {
      fontSize: typography.captionSmall.fontSize,
      flexShrink: 0,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
    },
    modalTitle: {
      fontSize: typography.sizes.lg,
      fontWeight: fontWeights.bold,
    },
    modalSubtitle: {
      fontSize: typography.caption.fontSize,
      marginTop: 2,
    },
    modalFooter: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
    },
    submitBtn: {
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    submitBtnText: {
      color: '#fff',
      fontWeight: fontWeights.semibold,
      fontSize: typography.button.fontSize,
    },
    field: {
      gap: spacing.xs,
    },
    label: {
      fontSize: typography.caption.fontSize,
      fontWeight: fontWeights.semibold,
    },
    input: {
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.button.fontSize,
      minHeight: 44,
    },
    textArea: {
      minHeight: 88,
      paddingTop: spacing.sm,
    },
    filePicker: {
      borderWidth: 2,
      borderStyle: 'dashed',
      borderRadius: radius.md,
      padding: spacing.lg,
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 80,
      justifyContent: 'center',
    },
    filePickerText: {
      fontSize: typography.caption.fontSize,
      fontWeight: fontWeights.medium,
      textAlign: 'center',
    },
    filePickerMeta: {
      fontSize: typography.captionSmall.fontSize,
      textAlign: 'center',
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    chipText: {
      fontSize: typography.captionSmall.fontSize,
      fontWeight: fontWeights.medium,
    },
  });
