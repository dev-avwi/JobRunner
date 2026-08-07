import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

type SmartImportType = 'clients' | 'catalog' | 'jobs' | 'quotes' | 'invoices';

const TYPE_LABELS: Record<SmartImportType, string> = {
  clients: 'Clients',
  catalog: 'Price list',
  jobs: 'Jobs',
  quotes: 'Quotes',
  invoices: 'Invoices',
};

interface FieldDef { field: string; label: string; required?: boolean; kind?: 'number' | 'date' }
interface MappingSuggestion { field: string | null; confidence: number }
interface RowIssue { row: number; issues: string[] }
interface DuplicateFlag { row: number; reason: string; matchId?: string; matchName?: string }

interface SmartJob {
  id: string;
  status: 'processing' | 'ready' | 'failed' | 'committing' | 'committed' | 'commit_failed';
  fileName: string;
  error: string | null;
  type: SmartImportType | null;
  typeConfidence: number | null;
  aiUsed: boolean | null;
  headers: string[] | null;
  rows: Record<string, string>[] | null;
  totalRows: number | null;
  mappings: Record<string, MappingSuggestion> | null;
  needsAttention: RowIssue[] | null;
  duplicates: DuplicateFlag[] | null;
  commitProgress: { total: number; done: number } | null;
  result: { imported: number; merged: number; skipped: number } | null;
  fields: FieldDef[] | null;
}

// Mirrors the server's validateRow so edits give instant feedback.
function parseNum(raw?: string): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const cleaned = String(raw).replace(/[$,\s]/g, '').replace(/^AUD?/i, '');
  if (cleaned === '') return undefined;
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
}
function parseDateStr(raw?: string): boolean {
  if (!raw || !raw.trim()) return true; // empty is fine
  const s = raw.trim();
  const au = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (au) {
    const d = parseInt(au[1], 10), m = parseInt(au[2], 10);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) return true;
  }
  return !isNaN(new Date(s).getTime());
}
function applyMappingsLocal(row: Record<string, string>, mappings: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [header, field] of Object.entries(mappings)) {
    if (!field) continue;
    const v = row[header];
    if (v !== undefined && v !== '') mapped[field] = v;
  }
  if (!mapped.name && (mapped.firstName || mapped.lastName)) mapped.name = [mapped.firstName, mapped.lastName].filter(Boolean).join(' ');
  if (!mapped.clientName && (mapped.clientFirstName || mapped.clientLastName)) mapped.clientName = [mapped.clientFirstName, mapped.clientLastName].filter(Boolean).join(' ');
  if (!mapped.address && mapped.street) mapped.address = [mapped.street, mapped.city, mapped.state, mapped.postcode].filter(Boolean).join(', ');
  return mapped;
}
function validateRowLocal(type: SmartImportType, mapped: Record<string, string>): string[] {
  const issues: string[] = [];
  if (type === 'clients') {
    if (!mapped.name) issues.push('Name is missing');
    if (mapped.email && !/.+@.+\..+/.test(mapped.email)) issues.push(`"${mapped.email}" doesn't look like an email`);
  } else if (type === 'catalog') {
    if (!mapped.name) issues.push('Item name is missing');
    if (mapped.unitPrice !== undefined && parseNum(mapped.unitPrice) === undefined) issues.push(`Unit price "${mapped.unitPrice}" is not a number`);
  } else if (type === 'jobs') {
    if (!mapped.title && !mapped.refNumber) issues.push('Job title or reference is missing');
    if (!mapped.clientName) issues.push('Client name is missing');
    if (mapped.scheduledAt && !parseDateStr(mapped.scheduledAt)) issues.push(`Can't read the date "${mapped.scheduledAt}"`);
  } else {
    if (!mapped.clientName) issues.push('Client name is missing');
    if (mapped.total !== undefined && parseNum(mapped.total) === undefined) issues.push(`Total "${mapped.total}" is not a number`);
    const dateField = type === 'quotes' ? 'validUntil' : 'dueDate';
    if (mapped[dateField] && !parseDateStr(mapped[dateField])) issues.push(`Can't read the date "${mapped[dateField]}"`);
  }
  return issues;
}

const PAGE_SIZE = 25;

export function SmartImportFlow({ onDone }: { onDone?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<SmartJob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Editable state (initialised from the job preview)
  const [type, setType] = useState<SmartImportType>('clients');
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [confidences, setConfidences] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [dupResolutions, setDupResolutions] = useState<Record<number, 'merge' | 'keep' | 'skip'>>({});
  const [duplicates, setDuplicates] = useState<DuplicateFlag[]>([]);
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState('all');
  const [committing, setCommitting] = useState(false);
  const initializedForJob = useRef<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  useEffect(() => stopPolling, []);

  const fetchJob = useCallback(async (id: string): Promise<SmartJob | null> => {
    const res = await fetch(`/api/import/smart/jobs/${id}`, { credentials: 'include' });
    if (!res.ok) return null;
    return res.json();
  }, []);

  const startPolling = useCallback((id: string, until: (j: SmartJob) => boolean, onSettle: (j: SmartJob) => void) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const j = await fetchJob(id);
      if (!j) return;
      setJob(j);
      if (until(j)) {
        stopPolling();
        onSettle(j);
      }
    }, 1500);
  }, [fetchJob]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/import/smart/upload', { method: 'POST', body: formData, credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setJobId(data.jobId);
      initializedForJob.current = null;
      setJob({ status: 'processing', fileName: file.name } as SmartJob);
      startPolling(data.jobId,
        (j) => j.status !== 'processing',
        (j) => {
          if (j.status === 'failed') {
            toast({ variant: 'destructive', title: "Couldn't read that file", description: j.error || undefined });
            setJob(null);
            setJobId(null);
          } else {
            setDialogOpen(true);
          }
        });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: err.message });
      setJob(null);
    } finally {
      setUploading(false);
    }
  };

  // Initialise editable state when the preview arrives
  useEffect(() => {
    if (!job || job.status !== 'ready' || !job.rows || initializedForJob.current === job.id) return;
    initializedForJob.current = job.id;
    setType(job.type || 'clients');
    const flat: Record<string, string> = {};
    const conf: Record<string, number> = {};
    for (const [h, m] of Object.entries(job.mappings || {})) {
      flat[h] = m.field || '';
      conf[h] = m.confidence;
    }
    setMappings(flat);
    setConfidences(conf);
    setRows(job.rows);
    setExcluded(new Set());
    setDuplicates(job.duplicates || []);
    const resolutions: Record<number, 'merge' | 'keep' | 'skip'> = {};
    (job.duplicates || []).forEach(d => { resolutions[d.row] = 'skip'; });
    setDupResolutions(resolutions);
    setPage(0);
    setActiveTab('all');
  }, [job]);

  const headers = job?.headers || [];
  const fields: FieldDef[] = job?.fields || [];

  const activeMappings = useMemo(() => {
    const flat: Record<string, string> = {};
    for (const [h, f] of Object.entries(mappings)) if (f) flat[h] = f;
    return flat;
  }, [mappings]);

  // Live validation of every row against current mappings + edits
  const rowIssues = useMemo(() => {
    const map = new Map<number, string[]>();
    rows.forEach((r, i) => {
      const issues = validateRowLocal(type, applyMappingsLocal(r, activeMappings));
      if (issues.length) map.set(i, issues);
    });
    return map;
  }, [rows, activeMappings, type]);

  const dupByRow = useMemo(() => new Map(duplicates.map(d => [d.row, d])), [duplicates]);

  const includedCount = rows.length - Array.from(excluded).length -
    duplicates.filter(d => !excluded.has(d.row) && dupResolutions[d.row] === 'skip').length;
  const blockingIssues = Array.from(rowIssues.keys()).filter(i => !excluded.has(i) && dupResolutions[i] !== 'skip');

  // Re-run duplicate detection on the server when type or mappings change
  const recheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always send the latest edited rows so duplicate flags never go stale.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const recheck = useCallback((newType: SmartImportType, newMappings: Record<string, string>) => {
    if (!jobId) return;
    if (recheckTimer.current) clearTimeout(recheckTimer.current);
    recheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/import/smart/jobs/${jobId}/recheck`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ type: newType, mappings: newMappings, rows: rowsRef.current }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setDuplicates(data.duplicates || []);
        setDupResolutions(prev => {
          const next: Record<number, 'merge' | 'keep' | 'skip'> = {};
          (data.duplicates || []).forEach((d: DuplicateFlag) => { next[d.row] = prev[d.row] || 'skip'; });
          return next;
        });
        if (data.fields) setJob(j => j ? { ...j, fields: data.fields } : j);
      } catch { /* keep current flags */ }
    }, 600);
  }, [jobId]);

  const setMapping = (header: string, field: string) => {
    setMappings(prev => {
      const next = { ...prev };
      // one field per column: unset other headers pointing at the same field
      if (field) {
        for (const h of Object.keys(next)) if (h !== header && next[h] === field) next[h] = '';
      }
      next[header] = field;
      const flat: Record<string, string> = {};
      for (const [h, f] of Object.entries(next)) if (f) flat[h] = f;
      recheck(type, flat);
      return next;
    });
    setConfidences(prev => ({ ...prev, [header]: 1 })); // user-confirmed
  };

  const changeType = (t: SmartImportType) => {
    setType(t);
    recheck(t, activeMappings);
  };

  const editCell = (rowIndex: number, header: string, value: string) => {
    setRows(prev => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [header]: value };
      rowsRef.current = next;
      return next;
    });
    // Edited values can change duplicate/validation status — recheck (debounced).
    recheck(type, activeMappings);
  };

  const toggleExcluded = (rowIndex: number) => {
    setExcluded(prev => {
      const next = new Set(prev);
      next.has(rowIndex) ? next.delete(rowIndex) : next.add(rowIndex);
      return next;
    });
  };

  const handleCommit = async () => {
    if (!jobId) return;
    setCommitting(true);
    try {
      const res = await fetch(`/api/import/smart/jobs/${jobId}/commit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          type,
          mappings: activeMappings,
          rows: rows.map((data, i) => ({ data, excluded: excluded.has(i) })),
          duplicateResolutions: dupResolutions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      startPolling(jobId,
        (j) => j.status === 'committed' || j.status === 'commit_failed',
        (j) => {
          setCommitting(false);
          if (j.status === 'committed') {
            ['/api/clients', '/api/jobs', '/api/quotes', '/api/invoices', '/api/catalog'].forEach(k =>
              queryClient.invalidateQueries({ queryKey: [k] }));
            toast({ title: `Imported ${j.result?.imported ?? 0} ${TYPE_LABELS[type].toLowerCase()}${(j.result?.merged || 0) > 0 ? `, updated ${j.result!.merged} existing` : ''}` });
          } else {
            toast({ variant: 'destructive', title: 'Import failed', description: j.error || undefined });
          }
        });
    } catch (err: any) {
      setCommitting(false);
      toast({ variant: 'destructive', title: "Can't import yet", description: err.message });
    }
  };

  const resetAll = () => {
    stopPolling();
    setDialogOpen(false);
    setJob(null);
    setJobId(null);
    setRows([]);
    setCommitting(false);
    onDone?.();
  };

  // ---------- row rendering helpers ----------
  const visibleIndices = useMemo(() => {
    const all = rows.map((_, i) => i);
    if (activeTab === 'attention') return all.filter(i => rowIssues.has(i));
    if (activeTab === 'duplicates') return all.filter(i => dupByRow.has(i));
    return all;
  }, [rows, activeTab, rowIssues, dupByRow]);
  const pageCount = Math.max(1, Math.ceil(visibleIndices.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageIndices = visibleIndices.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const renderRow = (i: number) => {
    const issues = rowIssues.get(i);
    const dup = dupByRow.get(i);
    const isExcluded = excluded.has(i) || (dup && dupResolutions[i] === 'skip');
    return (
      <tr key={i} className={`border-t border-border/50 ${isExcluded ? 'opacity-45' : ''}`} data-testid={`row-import-${i}`}>
        <td className="p-1.5 align-top">
          <Checkbox
            checked={!excluded.has(i)}
            onCheckedChange={() => toggleExcluded(i)}
            aria-label={`Include row ${i + 1}`}
            data-testid={`checkbox-include-row-${i}`}
          />
        </td>
        <td className="p-1.5 text-xs text-muted-foreground align-top whitespace-nowrap">{i + 1}</td>
        {headers.map(h => (
          <td key={h} className="p-1 align-top min-w-[130px]">
            <Input
              value={rows[i][h] ?? ''}
              onChange={(e) => editCell(i, h, e.target.value)}
              className="h-8 text-xs"
              disabled={excluded.has(i)}
              data-testid={`input-cell-${i}-${h}`}
            />
          </td>
        ))}
        <td className="p-1.5 align-top min-w-[190px]">
          {issues && !excluded.has(i) && (
            <div className="flex items-start gap-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{issues.join('; ')}</span>
            </div>
          )}
          {dup && (
            <div className="mt-1 space-y-1">
              <div className="flex items-start gap-1.5 text-xs text-amber-600">
                <Copy className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{dup.reason}</span>
              </div>
              <Select value={dupResolutions[i] || 'skip'} onValueChange={(v) => setDupResolutions(prev => ({ ...prev, [i]: v as any }))}>
                <SelectTrigger className="h-7 text-xs w-[150px]" data-testid={`select-duplicate-${i}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dup.matchId && <SelectItem value="merge">Merge into existing</SelectItem>}
                  <SelectItem value="keep">Import anyway</SelectItem>
                  <SelectItem value="skip">Skip this row</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {!issues && !dup && !excluded.has(i) && (
            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
          )}
        </td>
      </tr>
    );
  };

  const isBusy = job?.status === 'committing' || committing;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Upload any CSV or Excel file — clients, price list, jobs, quotes or invoices in any layout.
        AI works out what the columns mean, and you can fix anything before it saves.
      </p>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
      <div className="flex gap-2 flex-wrap items-center">
        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading || job?.status === 'processing'} data-testid="button-smart-import-upload">
          {uploading || job?.status === 'processing' ? (
            <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Reading your file…</>
          ) : (
            <><Upload className="h-4 w-4 mr-1.5" />Upload CSV or Excel</>
          )}
        </Button>
        {job?.status === 'processing' && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            AI is analysing the columns — you can keep working, we'll open the preview when it's ready.
          </span>
        )}
      </div>
      {job?.status === 'processing' && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-5/6" />
          <Skeleton className="h-8 w-4/6" />
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !isBusy) resetAll(); }}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
              Review import — {job?.fileName}
            </DialogTitle>
            <DialogDescription>
              Check the AI's column mapping, fix any values, and choose what to do with duplicates. Nothing saves until you hit Import.
            </DialogDescription>
          </DialogHeader>

          {job?.status === 'committed' && job.result ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle className="h-10 w-10 text-green-600 mx-auto" />
              <p className="font-medium">
                Imported {job.result.imported} {TYPE_LABELS[type].toLowerCase()}
                {job.result.merged > 0 ? `, merged ${job.result.merged} into existing records` : ''}
                {job.result.skipped > 0 ? ` (${job.result.skipped} skipped)` : ''}
              </p>
              <Button onClick={resetAll} data-testid="button-import-done">Done</Button>
            </div>
          ) : isBusy ? (
            <div className="py-8 space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                Importing {job?.commitProgress?.done ?? 0} of {job?.commitProgress?.total ?? includedCount}…
              </p>
              <Progress value={job?.commitProgress?.total ? (job.commitProgress.done / job.commitProgress.total) * 100 : 5} />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={type} onValueChange={(v) => changeType(v as SmartImportType)}>
                  <SelectTrigger className="w-[150px] h-8" data-testid="select-import-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as SmartImportType[]).map(t => (
                      <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="outline">{rows.length} rows</Badge>
                {job?.aiUsed && (
                  <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" />AI mapped</Badge>
                )}
                {blockingIssues.length > 0 && (
                  <Badge variant="outline" className="text-destructive border-destructive/40">
                    {blockingIssues.length} need{blockingIssues.length === 1 ? 's' : ''} attention
                  </Badge>
                )}
                {duplicates.length > 0 && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    {duplicates.length} possible duplicate{duplicates.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>

              {/* Column mapping */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="text-xs w-full">
                  <tbody>
                    <tr className="bg-muted/40">
                      <td className="p-1.5 font-medium text-muted-foreground whitespace-nowrap">File column</td>
                      {headers.map(h => (
                        <td key={h} className="p-1.5 font-medium whitespace-nowrap min-w-[140px]">{h}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-1.5 text-muted-foreground whitespace-nowrap">Imports as</td>
                      {headers.map(h => {
                        const conf = confidences[h] ?? 0;
                        const mappedField = mappings[h] || '';
                        return (
                          <td key={h} className="p-1.5 min-w-[140px]">
                            <Select value={mappedField || '__skip__'} onValueChange={(v) => setMapping(h, v === '__skip__' ? '' : v)}>
                              <SelectTrigger className="h-8 text-xs" data-testid={`select-mapping-${h}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__skip__">Don't import</SelectItem>
                                {fields.map(f => (
                                  <SelectItem key={f.field} value={f.field}>{f.label}{f.required ? ' *' : ''}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {mappedField && conf > 0 && conf < 0.6 && (
                              <p className="text-[10px] text-amber-600 mt-0.5">Low confidence — please check</p>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Rows */}
              <Tabs value={activeTab} onValueChange={(t) => { setActiveTab(t); setPage(0); }} className="flex-1 min-h-0 flex flex-col">
                <TabsList>
                  <TabsTrigger value="all" data-testid="tab-all-rows">All rows ({rows.length})</TabsTrigger>
                  <TabsTrigger value="attention" data-testid="tab-needs-attention">
                    Needs attention ({Array.from(rowIssues.keys()).filter(i => !excluded.has(i)).length})
                  </TabsTrigger>
                  <TabsTrigger value="duplicates" data-testid="tab-duplicates">Duplicates ({duplicates.length})</TabsTrigger>
                </TabsList>
                {['all', 'attention', 'duplicates'].map(tab => (
                  <TabsContent key={tab} value={tab} className="flex-1 min-h-0 overflow-auto border rounded-lg mt-2 data-[state=inactive]:hidden">
                    {tab === 'attention' && visibleIndices.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground">Nothing needs attention — every row can be imported.</p>
                    ) : tab === 'duplicates' && visibleIndices.length === 0 ? (
                      <p className="p-4 text-sm text-muted-foreground">No duplicates found against your existing records.</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-background z-10">
                          <tr className="border-b">
                            <th className="p-1.5 text-left w-8"></th>
                            <th className="p-1.5 text-left w-8">#</th>
                            {headers.map(h => (
                              <th key={h} className="p-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                                {mappings[h] ? (fields.find(f => f.field === mappings[h])?.label || h) : <span className="line-through opacity-50">{h}</span>}
                              </th>
                            ))}
                            <th className="p-1.5 text-left font-medium text-muted-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageIndices.map(renderRow)}
                        </tbody>
                      </table>
                    )}
                  </TabsContent>
                ))}
              </Tabs>

              {pageCount > 1 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Page {safePage + 1} of {pageCount}</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={safePage >= pageCount - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <div className="flex items-center gap-2 mr-auto text-xs text-muted-foreground">
                  {blockingIssues.length > 0 && (
                    <span className="text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Fix or untick {blockingIssues.length} row{blockingIssues.length !== 1 ? 's' : ''} to import
                    </span>
                  )}
                </div>
                <Button variant="ghost" onClick={resetAll} data-testid="button-import-cancel">
                  <X className="h-4 w-4 mr-1" />Cancel
                </Button>
                <Button onClick={handleCommit} disabled={blockingIssues.length > 0 || includedCount === 0} data-testid="button-import-commit">
                  Import {includedCount} row{includedCount !== 1 ? 's' : ''}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
