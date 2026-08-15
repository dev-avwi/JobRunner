import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  FileText,
  Upload,
  Plus,
  Loader2,
  Trash2,
  Download,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  History,
  Bell,
  HelpCircle,
  CheckCircle2,
  Clock,
  X,
  AlertCircle,
  FileDown,
  Flag,
  CalendarDays,
  User,
} from 'lucide-react';
import { queryClient, getAuthHeaders } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format, isPast, parseISO } from 'date-fns';

const DOC_CATEGORIES = ['Drawings', 'Specifications', 'RFIs', 'SWMS', 'Certificates', 'Other'] as const;
type DocCategory = typeof DOC_CATEGORIES[number];

interface ProjectDocument {
  id: string;
  jobId: string;
  userId: string;
  docNumber: string;
  title: string;
  category: string;
  currentRevision: string;
  isClientVisible: boolean;
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
  uploadedBy: string | null;
  uploadedByName: string | null;
  uploadedAt: string;
  fileUrl: string | null;
}

interface ProjectRfi {
  id: string;
  jobId: string;
  rfiNumber: string;
  question: string;
  description: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  status: 'open' | 'answered' | 'closed';
  priority: 'low' | 'medium' | 'high' | null;
  dueDate: string | null;
  answeredAt: string | null;
  answerText: string | null;
  answerFileUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TeamMember {
  id: string;
  name: string;
  email?: string;
  userId?: string;
}

interface ProjectDocumentRegisterProps {
  jobId: string;
  canUpload?: boolean;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getCategoryColor(category: string): string {
  const map: Record<string, string> = {
    Drawings: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    Specifications: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    RFIs: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    SWMS: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    Certificates: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    Other: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };
  return map[category] || map.Other;
}

function getRfiStatusConfig(status: string) {
  if (status === 'open') return { label: 'Open', icon: AlertCircle, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
  if (status === 'answered') return { label: 'Answered', icon: CheckCircle2, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
  return { label: 'Closed', icon: X, className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };
}

function getRfiPriorityConfig(priority: string | null) {
  if (priority === 'high') return { label: 'High', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
  if (priority === 'medium') return { label: 'Medium', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' };
  if (priority === 'low') return { label: 'Low', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
  return null;
}

// ── Document Row ─────────────────────────────────────────────────────────────
function DocumentRow({
  doc,
  jobId,
  canUpload,
  onDelete,
  teamMembers,
}: {
  doc: ProjectDocument;
  jobId: string;
  canUpload: boolean;
  onDelete: (id: string) => void;
  teamMembers: TeamMember[];
}) {
  const { toast } = useToast();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [revisionFile, setRevisionFile] = useState<File | null>(null);
  const [revisionLabel, setRevisionLabel] = useState('');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [selectedNotifyUsers, setSelectedNotifyUsers] = useState<string[]>([]);
  const [notifyMessage, setNotifyMessage] = useState('');
  const revFileRef = useRef<HTMLInputElement>(null);

  const { data: revisions = [], isLoading: revisionsLoading } = useQuery<RevisionRecord[]>({
    queryKey: ['/api/jobs', jobId, 'project-documents', doc.id, 'revisions'],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/project-documents/${doc.id}/revisions`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load revisions');
      return res.json();
    },
    enabled: historyOpen,
  });

  const addRevisionMutation = useMutation({
    mutationFn: async () => {
      if (!revisionFile || !revisionLabel) throw new Error('Missing required fields');
      const fd = new FormData();
      fd.append('file', revisionFile);
      fd.append('revision', revisionLabel);
      if (revisionNotes) fd.append('notes', revisionNotes);
      const res = await fetch(`/api/jobs/${jobId}/project-documents/${doc.id}/revisions`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Revision added', description: `Revision ${revisionLabel} uploaded.` });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'project-documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'project-documents', doc.id, 'revisions'] });
      setShowRevisionDialog(false);
      setRevisionFile(null);
      setRevisionLabel('');
      setRevisionNotes('');
    },
    onError: (err: any) => toast({ title: 'Upload failed', description: err.message, variant: 'destructive' }),
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async (isClientVisible: boolean) => {
      const res = await fetch(`/api/jobs/${jobId}/project-documents/${doc.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ isClientVisible }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_, isClientVisible) => {
      toast({ title: isClientVisible ? 'Visible to client' : 'Hidden from client', description: isClientVisible ? `"${doc.title}" is now visible on the client portal.` : `"${doc.title}" is now hidden from the client portal.` });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'project-documents'] });
    },
    onError: (err: any) => toast({ title: 'Update failed', description: err.message, variant: 'destructive' }),
  });

  const notifyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/project-documents/${doc.id}/notify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userIds: selectedNotifyUsers, message: notifyMessage }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Team notified', description: `Sent to ${data.notified} team member(s).` });
      setShowNotifyDialog(false);
      setSelectedNotifyUsers([]);
      setNotifyMessage('');
    },
    onError: (err: any) => toast({ title: 'Notification failed', description: err.message, variant: 'destructive' }),
  });

  const openFile = (url: string | null) => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-3 bg-card hover:bg-muted/30 transition-colors">
        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{doc.docNumber}</span>
            <span className="font-medium text-sm truncate">{doc.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getCategoryColor(doc.category)}`}>
              {doc.category}
            </span>
            <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
              Rev {doc.currentRevision}
            </span>
            {doc.latestRevision && (
              <span className="text-xs text-muted-foreground">
                {format(new Date(doc.latestRevision.uploadedAt), 'dd MMM yyyy')}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {doc.latestRevision?.fileUrl && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openFile(doc.latestRevision!.fileUrl)} title="Preview">
                <Eye className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Download">
                <a href={doc.latestRevision.fileUrl} download={doc.latestRevision.fileName} target="_blank" rel="noopener noreferrer">
                  <Download className="h-3.5 w-3.5" />
                </a>
              </Button>
            </>
          )}
          {canUpload && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 ${doc.isClientVisible ? 'text-green-600 hover:text-green-700' : 'text-muted-foreground'}`}
                onClick={() => toggleVisibilityMutation.mutate(!doc.isClientVisible)}
                disabled={toggleVisibilityMutation.isPending}
                title={doc.isClientVisible ? 'Visible to client — click to hide' : 'Hidden from client — click to share'}
              >
                {toggleVisibilityMutation.isPending
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : doc.isClientVisible
                    ? <Eye className="h-3.5 w-3.5" />
                    : <EyeOff className="h-3.5 w-3.5" />
                }
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowRevisionDialog(true)} title="Upload new revision">
                <Upload className="h-3.5 w-3.5" />
              </Button>
              {teamMembers.length > 0 && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowNotifyDialog(true)} title="Notify team">
                  <Bell className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(doc.id)} title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setHistoryOpen(v => !v)} title="Revision history">
            {historyOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <History className="h-3.5 w-3.5 text-muted-foreground" />}
          </Button>
        </div>
      </div>

      {/* Revision history */}
      {historyOpen && (
        <div className="border-t border-border bg-muted/20 px-3 pb-3 pt-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <History className="h-3 w-3" /> Revision History ({doc.revisionCount})
          </p>
          {revisionsLoading ? (
            <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : revisions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No revisions yet.</p>
          ) : (
            <div className="space-y-1.5">
              {revisions.map((rev, i) => (
                <div key={rev.id} className="flex items-start gap-2 text-xs">
                  <span className={`font-mono px-1.5 py-0.5 rounded flex-shrink-0 ${i === 0 ? 'bg-primary/10 text-primary font-semibold' : 'bg-muted text-muted-foreground'}`}>
                    Rev {rev.revision}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="truncate block text-muted-foreground">{rev.fileName}</span>
                    <span className="text-muted-foreground/60 flex items-center gap-1 mt-0.5">
                      {rev.uploadedByName && (
                        <>
                          <User className="h-2.5 w-2.5" />
                          {rev.uploadedByName}
                          <span className="mx-0.5">·</span>
                        </>
                      )}
                      {format(new Date(rev.uploadedAt), 'dd MMM yy')}
                      {rev.fileSize && <><span className="mx-0.5">·</span>{formatFileSize(rev.fileSize)}</>}
                    </span>
                  </div>
                  {rev.fileUrl && (
                    <a href={rev.fileUrl} download={rev.fileName} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary flex-shrink-0">
                      <Download className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload new revision dialog */}
      <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload New Revision — {doc.title}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Revision Label *</Label>
              <Input placeholder="e.g. B, C, 2, 3 …" value={revisionLabel} onChange={e => setRevisionLabel(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>File *</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => revFileRef.current?.click()}
              >
                {revisionFile ? (
                  <p className="text-sm">{revisionFile.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Click to select a file</p>
                )}
                <input ref={revFileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.tiff,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.dwg,.dxf" onChange={e => setRevisionFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="What changed in this revision?" value={revisionNotes} onChange={e => setRevisionNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevisionDialog(false)}>Cancel</Button>
            <Button onClick={() => addRevisionMutation.mutate()} disabled={!revisionFile || !revisionLabel || addRevisionMutation.isPending}>
              {addRevisionMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notify team dialog */}
      <Dialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Notify Team — {doc.title} (Rev {doc.currentRevision})</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Select team members to notify</Label>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {teamMembers.map(m => (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={selectedNotifyUsers.includes(m.userId || m.id)}
                      onChange={e => {
                        const uid = m.userId || m.id;
                        setSelectedNotifyUsers(prev => e.target.checked ? [...prev, uid] : prev.filter(id => id !== uid));
                      }}
                    />
                    <span className="text-sm">{m.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Custom message (optional)</Label>
              <Input placeholder={`${doc.docNumber} updated to Rev ${doc.currentRevision}`} value={notifyMessage} onChange={e => setNotifyMessage(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotifyDialog(false)}>Cancel</Button>
            <Button onClick={() => notifyMutation.mutate()} disabled={selectedNotifyUsers.length === 0 || notifyMutation.isPending}>
              {notifyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Notification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── RFI Row ──────────────────────────────────────────────────────────────────
function RfiRow({
  rfi,
  jobId,
  canEdit,
  onDelete,
}: {
  rfi: ProjectRfi;
  jobId: string;
  canEdit: boolean;
  onDelete: (id: string) => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [showAnswerDialog, setShowAnswerDialog] = useState(false);
  const [answerText, setAnswerText] = useState(rfi.answerText || '');
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [newStatus, setNewStatus] = useState<string>(rfi.status);
  const answerFileRef = useRef<HTMLInputElement>(null);
  const statusCfg = getRfiStatusConfig(rfi.status);
  const StatusIcon = statusCfg.icon;
  const priorityCfg = getRfiPriorityConfig(rfi.priority ?? null);
  const isOverdue = rfi.status === 'open' && rfi.dueDate && isPast(parseISO(rfi.dueDate));

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const fd = new FormData();
      Object.entries(updates).forEach(([k, v]) => v !== undefined && fd.append(k, v));
      if (answerFile) fd.append('answerFile', answerFile);
      const res = await fetch(`/api/jobs/${jobId}/rfis/${rfi.id}`, {
        method: 'PATCH',
        body: fd,
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'RFI updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'rfis'] });
      setShowAnswerDialog(false);
      setAnswerFile(null);
    },
    onError: (err: any) => toast({ title: 'Update failed', description: err.message, variant: 'destructive' }),
  });

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div
        className="flex items-start gap-3 p-3 bg-card hover:bg-muted/30 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <HelpCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{rfi.rfiNumber}</span>
            <span className="font-medium text-sm">{rfi.question}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex items-center gap-1 ${statusCfg.className}`}>
              <StatusIcon className="h-3 w-3" />{statusCfg.label}
            </span>
            {priorityCfg && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex items-center gap-1 ${priorityCfg.className}`}>
                <Flag className="h-3 w-3" />{priorityCfg.label}
              </span>
            )}
            {rfi.dueDate && (
              <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-muted-foreground'}`}>
                <CalendarDays className="h-3 w-3" />
                {isOverdue ? 'Overdue · ' : 'Due '}
                {format(parseISO(rfi.dueDate), 'dd MMM yyyy')}
              </span>
            )}
            {rfi.assignedToName && (
              <span className="text-xs text-muted-foreground">→ {rfi.assignedToName}</span>
            )}
            <span className="text-xs text-muted-foreground">
              {format(new Date(rfi.createdAt), 'dd MMM yyyy')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {canEdit && rfi.status !== 'closed' && (
            <Button
              variant="ghost" size="sm" className="h-7 text-xs"
              onClick={e => { e.stopPropagation(); setShowAnswerDialog(true); }}
            >
              {rfi.status === 'open' ? 'Answer' : 'Update'}
            </Button>
          )}
          {canEdit && (
            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-destructive"
              onClick={e => { e.stopPropagation(); onDelete(rfi.id); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border bg-muted/10 px-3 py-2 space-y-2 text-sm">
          {rfi.description && (
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</span>
              <p className="mt-0.5 text-sm whitespace-pre-wrap">{rfi.description}</p>
            </div>
          )}
          {rfi.answerText && (
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Answer</span>
              <p className="mt-0.5 text-sm whitespace-pre-wrap">{rfi.answerText}</p>
              {rfi.answeredAt && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Answered {format(new Date(rfi.answeredAt), 'dd MMM yyyy')}
                </p>
              )}
            </div>
          )}
          {rfi.answerFileUrl && (
            <a href={rfi.answerFileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex items-center gap-1">
              <Download className="h-3 w-3" /> View answer attachment
            </a>
          )}
        </div>
      )}

      {/* Answer / update dialog */}
      <Dialog open={showAnswerDialog} onOpenChange={setShowAnswerDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update RFI — {rfi.rfiNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="answered">Answered</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Answer</Label>
              <Textarea placeholder="Provide the answer here…" value={answerText} onChange={e => setAnswerText(e.target.value)} rows={4} />
            </div>
            <div className="space-y-1">
              <Label>Answer attachment (optional)</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-3 text-center cursor-pointer hover:border-primary/50"
                onClick={() => answerFileRef.current?.click()}
              >
                {answerFile ? (
                  <p className="text-sm">{answerFile.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Click to attach a file</p>
                )}
                <input ref={answerFileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.tiff,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.dwg,.dxf" onChange={e => setAnswerFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnswerDialog(false)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate({ status: newStatus, answerText })} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function ProjectDocumentRegister({ jobId, canUpload = true }: ProjectDocumentRegisterProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/project-documents/export`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => 'Unknown error');
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match ? match[1] : `document-register-${jobId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Export ready', description: 'Document register PDF downloaded.' });
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    } finally {
      setExportingPdf(false);
    }
  };

  // Upload document dialog state
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<DocCategory>('Drawings');
  const [docRevision, setDocRevision] = useState('A');
  const [docNotes, setDocNotes] = useState('');

  // RFI create dialog state
  const [showRfiDialog, setShowRfiDialog] = useState(false);
  const [rfiQuestion, setRfiQuestion] = useState('');
  const [rfiDescription, setRfiDescription] = useState('');
  const [rfiAssignedToName, setRfiAssignedToName] = useState('');
  const [rfiPriority, setRfiPriority] = useState<'low' | 'medium' | 'high' | ''>('');
  const [rfiDueDate, setRfiDueDate] = useState('');

  // Delete confirm
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [deleteRfiId, setDeleteRfiId] = useState<string | null>(null);

  // Active category filter
  const [activeCategory, setActiveCategory] = useState<DocCategory | 'All'>('All');

  const { data: documents = [], isLoading: docsLoading } = useQuery<ProjectDocument[]>({
    queryKey: ['/api/jobs', jobId, 'project-documents'],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/project-documents`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load documents');
      return res.json();
    },
  });

  const { data: rfis = [], isLoading: rfisLoading } = useQuery<ProjectRfi[]>({
    queryKey: ['/api/jobs', jobId, 'rfis'],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/rfis`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load RFIs');
      return res.json();
    },
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ['/api/team/members'],
  });

  const uploadDocMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !docTitle) throw new Error('Missing required fields');
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('title', docTitle);
      fd.append('category', docCategory);
      fd.append('revision', docRevision);
      if (docNotes) fd.append('notes', docNotes);
      const res = await fetch(`/api/jobs/${jobId}/project-documents`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Document registered', description: `${docTitle} added to the document register.` });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'project-documents'] });
      setShowUploadDialog(false);
      setSelectedFile(null);
      setDocTitle('');
      setDocCategory('Drawings');
      setDocRevision('A');
      setDocNotes('');
    },
    onError: (err: any) => toast({ title: 'Upload failed', description: err.message, variant: 'destructive' }),
  });

  const createRfiMutation = useMutation({
    mutationFn: async () => {
      if (!rfiQuestion) throw new Error('Question is required');
      const res = await fetch(`/api/jobs/${jobId}/rfis`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          question: rfiQuestion,
          description: rfiDescription || undefined,
          assignedToName: rfiAssignedToName || undefined,
          priority: rfiPriority || undefined,
          dueDate: rfiDueDate || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'RFI raised' });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'rfis'] });
      setShowRfiDialog(false);
      setRfiQuestion('');
      setRfiDescription('');
      setRfiAssignedToName('');
      setRfiPriority('');
      setRfiDueDate('');
    },
    onError: (err: any) => toast({ title: 'Failed to create RFI', description: err.message, variant: 'destructive' }),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/jobs/${jobId}/project-documents/${docId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Document deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'project-documents'] });
      setDeleteDocId(null);
    },
    onError: (err: any) => toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }),
  });

  const deleteRfiMutation = useMutation({
    mutationFn: async (rfiId: string) => {
      const res = await fetch(`/api/jobs/${jobId}/rfis/${rfiId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'RFI deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'rfis'] });
      setDeleteRfiId(null);
    },
    onError: (err: any) => toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }),
  });

  const filteredDocs = activeCategory === 'All' ? documents : documents.filter(d => d.category === activeCategory);

  // Group docs by category for display
  const categoryCounts: Record<string, number> = {};
  documents.forEach(d => { categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1; });

  const openRfiCount = rfis.filter(r => r.status === 'open').length;

  return (
    <div className="space-y-4">
      {/* Document Register Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
              Document Register
              {documents.length > 0 && <Badge variant="secondary" className="text-xs">{documents.length}</Badge>}
            </CardTitle>
            <div className="flex items-center gap-1.5">
              {documents.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportPdf}
                  disabled={exportingPdf}
                  className="h-7 text-xs gap-1"
                  title="Export document register as PDF"
                >
                  {exportingPdf
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <FileDown className="h-3 w-3" />}
                  Export register
                </Button>
              )}
              {canUpload && (
                <Button size="sm" variant="outline" onClick={() => setShowUploadDialog(true)} className="h-7 text-xs gap-1">
                  <Plus className="h-3 w-3" />
                  Register Document
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Category filter chips */}
          {documents.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(['All', ...DOC_CATEGORIES] as const).map(cat => {
                const count = cat === 'All' ? documents.length : (categoryCounts[cat] || 0);
                if (count === 0 && cat !== 'All') return null;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      activeCategory === cat
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    {cat} {count > 0 && <span className="opacity-70">({count})</span>}
                  </button>
                );
              })}
            </div>
          )}

          {docsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {documents.length === 0 ? 'No documents registered yet' : `No ${activeCategory} documents`}
              </p>
              {canUpload && documents.length === 0 && (
                <Button size="sm" variant="outline" className="mt-3 h-7 text-xs gap-1" onClick={() => setShowUploadDialog(true)}>
                  <Plus className="h-3 w-3" />
                  Register first document
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDocs.map(doc => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  jobId={jobId}
                  canUpload={canUpload}
                  onDelete={setDeleteDocId}
                  teamMembers={teamMembers}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* RFI Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HelpCircle className="h-4 w-4" style={{ color: 'hsl(var(--trade))' }} />
              RFIs
              {rfis.length > 0 && <Badge variant="secondary" className="text-xs">{rfis.length}</Badge>}
              {openRfiCount > 0 && <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">{openRfiCount} open</Badge>}
            </CardTitle>
            {canUpload && (
              <Button size="sm" variant="outline" onClick={() => setShowRfiDialog(true)} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" />
                Raise RFI
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {rfisLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rfis.length === 0 ? (
            <div className="text-center py-8">
              <HelpCircle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No RFIs raised yet</p>
              {canUpload && (
                <Button size="sm" variant="outline" className="mt-3 h-7 text-xs gap-1" onClick={() => setShowRfiDialog(true)}>
                  <Plus className="h-3 w-3" />
                  Raise first RFI
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {rfis.map(rfi => (
                <RfiRow
                  key={rfi.id}
                  rfi={rfi}
                  jobId={jobId}
                  canEdit={canUpload}
                  onDelete={setDeleteRfiId}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload document dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Register Document</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input placeholder="e.g. Ground Floor Plan, Structural Specification…" value={docTitle} onChange={e => setDocTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={docCategory} onValueChange={v => setDocCategory(v as DocCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Initial Revision</Label>
                <Input placeholder="A" value={docRevision} onChange={e => setDocRevision(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>File *</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div>
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                    <p className="text-sm text-muted-foreground">Click to select a file</p>
                    <p className="text-xs text-muted-foreground/60">PDF, images, Word, Excel, DWG…</p>
                  </>
                )}
                <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.tiff,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.dwg,.dxf" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea placeholder="Any notes about this revision…" value={docNotes} onChange={e => setDocNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
            <Button onClick={() => uploadDocMutation.mutate()} disabled={!selectedFile || !docTitle || uploadDocMutation.isPending}>
              {uploadDocMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Register Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create RFI dialog */}
      <Dialog open={showRfiDialog} onOpenChange={setShowRfiDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Raise RFI</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Question *</Label>
              <Input placeholder="What information do you need?" value={rfiQuestion} onChange={e => setRfiQuestion(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Textarea placeholder="Provide more context…" value={rfiDescription} onChange={e => setRfiDescription(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select value={rfiPriority} onValueChange={v => setRfiPriority(v as 'low' | 'medium' | 'high' | '')}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Due Date</Label>
                <Input type="date" value={rfiDueDate} onChange={e => setRfiDueDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Assign to (optional)</Label>
              <Input placeholder="Name of person to answer this RFI" value={rfiAssignedToName} onChange={e => setRfiAssignedToName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRfiDialog(false)}>Cancel</Button>
            <Button onClick={() => createRfiMutation.mutate()} disabled={!rfiQuestion || createRfiMutation.isPending}>
              {createRfiMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Raise RFI
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete document confirm */}
      <AlertDialog open={!!deleteDocId} onOpenChange={open => !open && setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>This will delete the document and all its revision history. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteDocId && deleteDocMutation.mutate(deleteDocId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete RFI confirm */}
      <AlertDialog open={!!deleteRfiId} onOpenChange={open => !open && setDeleteRfiId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete RFI?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this RFI and its answer. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteRfiId && deleteRfiMutation.mutate(deleteRfiId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
